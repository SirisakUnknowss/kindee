# KinDee — Product Roadmap & Architecture

> **Brand:** KinDee
>
> **Tagline:** กินดีตาม TDEE ของคุณ
> **Status:** Canonical plan for v1 — 14 September 2026

## 1. Product decisions

KinDee helps people in Thailand log everyday food quickly, understand intake against a personal TDEE-based target, and build a sustainable habit without shame.

### Non-negotiable principles

1. **Guest-first.** A user can calculate a target and log food before creating an account.
2. **Three-second logging.** Recent foods and Thai portions are the default; grams are secondary.
3. **Local-first and recoverable.** Guest data stays on the device; an account enables backup and multi-device sync.
4. **User confirmation.** Barcode and AI can suggest a food, never log it automatically.
5. **Supportive health UX.** No punitive over-target messages, unsafe calorie targets, or guilt-based streaks.

## 2. Plans and entitlements

| Capability | Guest | Free account | Premium |
|---|---|---|---|
| TDEE target, daily logging, Thai food search | Yes, on device | Yes | Yes |
| Offline use and recent foods | Yes | Yes | Yes |
| Backup and multi-device sync | No | Yes | Yes |
| Cloud history | Device only | 90 days | Unlimited |
| Barcode lookup | Limited local cache | Standard | Standard |
| AI food-photo analysis | No | Small trial quota | Monthly quota |
| Trend insights, export, advanced goals | No | Basic weekly view | Yes |

The product must not block first logging behind sign-up. Prompt an anonymous user to create a free account only after meaningful value—for example after the first 2–3 logged meals, when opening history, changing devices, or using a cloud-cost feature.

Premium is not required for v1 launch. Build the entitlement boundary now, but only introduce payment after retention and willingness-to-pay are validated. A trial begins only when a user intentionally opens a Premium feature; it never begins automatically on install.

## 3. User flows

### 3.1 Guest activation

```text
Install / open PWA
  → “เริ่มบันทึกเลย”
  → Short onboarding: demographic inputs, activity, goal
  → Explain calculated TDEE target and safe lower limit
  → Today
  → Add first food (recent / search / barcode / photo when entitled)
  → Local save immediately
  → Soft account prompt at a value moment
```

The existing five-step onboarding can remain, but must add a Guest entry point and remove mandatory email verification before the first log.

### 3.2 Account conversion

```text
Guest chooses “สำรองข้อมูลฟรี”
  → Sign up / sign in (email or Google)
  → Verify email where required
  → Link local anonymous installation to account
  → Upload local outbox idempotently
  → Show “ข้อมูลบนเครื่องนี้ถูกสำรองแล้ว”
```

Never delete local entries during conversion. The server accepts a `client_id` only once per owner, and returns a reconciliation result before the UI reports success.

### 3.3 Daily logging

```text
Today → choose meal → recent / search / barcode / photo
  → choose Thai portion and quantity
  → save locally → immediate total update + undo
  → queue sync if signed in → sync when online
```

### 3.4 Premium gate

```text
User selects a Premium feature
  → explain benefit, quota/price, and data handling
  → purchase or dismiss
  → verify entitlement server-side before consuming AI or exporting data
```

## 4. Recommended architecture

Keep the existing React + Vite PWA. Replace GitHub Pages because it cannot run the current `/api/*` routes.

```text
┌─────────────── KinDee PWA (React + Vite) ────────────────┐
│ UI · TDEE calculator · service worker · Dexie/IndexedDB   │
│ local entries · outbox · anonymous installation_id         │
└──────────────┬───────────────────────────┬────────────────┘
               │ Supabase Auth / PostgREST │ authenticated API calls
               ▼                           ▼
     ┌─────────────────────┐     ┌─────────────────────────┐
     │ Supabase             │     │ Cloudflare Pages         │
     │ Auth + Postgres      │     │ static PWA + Functions   │
     │ Storage + RLS        │     │ /api/photo /api/barcode  │
     └──────────┬──────────┘     │ /api/sync /api/checkout  │
                │                └───────────┬─────────────┘
                ▼                            ▼
        profiles, entries,              AI provider, food
        food data, entitlements         data providers, payments
```

Cloudflare Pages is appropriate for the static Vite app plus lightweight server functions; its Functions run in the Workers runtime. Keep Pages Functions restricted to the API paths so static assets remain static. Secrets such as `SUPABASE_SERVICE_ROLE_KEY`, AI keys, and payment webhooks live only in the function environment—never in Vite variables or the browser bundle.

### 4.1 Responsibilities

| Layer | Owns |
|---|---|
| React PWA | Rendering, form validation, local TDEE calculations, local cache/outbox, optimistic UI |
| Dexie | Guest entries, authenticated local mirror, outbox, cached food records, sync cursor |
| Supabase Auth | Anonymous installation linking (optional), email/Google identity, sessions, account recovery |
| Supabase Postgres | Source of truth for signed-in data, RLS, food catalogue, durable entitlements |
| Pages Functions | Token verification, provider calls, rate limiting, safe sync orchestration, purchase webhooks |
| Object storage | User-consented photo uploads with expiry/deletion policy; do not retain raw photos by default |

### 4.2 Identity and data ownership

Every installation creates `installation_id` locally. Entries have an immutable `client_id` (UUID) and one of two owners:

- `guest_installation_id` while the user is anonymous;
- `user_id` after account linking.

Do not create a cloud guest profile merely to make the UI work. Local guest mode must work with no network. At conversion, the authenticated sync endpoint atomically claims entries sent from the installation after explicit user intent. Server-side authorization, not a client-supplied user id, decides ownership.

### 4.3 Core tables

```text
profiles(user_id PK, … TDEE inputs and target)
weight_logs(user_id, logged_on, weight_kg)
foods(id, barcode, name_th, nutrition, source, quality, …)
food_portions(id, food_id, label_th, grams, is_default)
entries(id, user_id, client_id, food snapshot, portion snapshot, eaten_on,
        macros, deleted_at, updated_at, UNIQUE(user_id, client_id))
daily_summaries(user_id, date, totals…)
entitlements(user_id, plan, status, provider_customer_id, period_end)
usage_counters(user_id, feature, period_start, count)
```

`entries` retains nutrition and display-name snapshots. Updating the food catalogue must never rewrite historical intake.

### 4.4 API boundaries

| Endpoint | Authentication | Role |
|---|---|---|
| `POST /api/sync` | Required for cloud sync | Validate batch, upsert by client ID, reconcile remote changes |
| `GET /api/barcode/:code` | Optional / rate-limited | Cache-first product lookup; return a candidate, never an entry |
| `POST /api/photo` | Required + entitlement | Resize/validate input, quota/cache, call AI, return candidates |
| `POST /api/billing/webhook` | Provider signature | Update entitlement transactionally |
| `GET /api/export` | Required + entitlement policy | Generate a data export and expire the download |

All endpoint inputs have schemas, batch/size limits, structured error codes, audit-safe logs, and per-user/IP rate limits. API handlers verify the Supabase access token; they do not trust `user_id` from request JSON.

### 4.5 Security and privacy baseline

- Enable RLS on every user-owned table and explicitly define policies for `foods` and `food_portions`.
- Service-role credentials are server-only. No permissive placeholder credentials or demo-login fallback in production.
- Treat food, weight, target, and photo data as personal health-adjacent data: minimize collection, document purpose/retention, obtain consent before cloud upload, and provide export/delete-account flows.
- Separate development, staging, and production Supabase projects and secrets.
- Log operational events, not raw meal names, images, tokens, or personal data.

## 5. Delivery roadmap

### Phase 0 — Product foundations (1 week)

- Confirm brand: **KinDee — กินดีตาม TDEE ของคุณ**.
- Define Free/Premium entitlements and success metrics; no payment integration yet.
- Write privacy notice, consent copy, account deletion/export requirements, and food-data licensing decision log.
- Choose production domains and create dev/staging/prod environments.

**Exit:** product copy, ownership model, and legal/data-source decisions approved.

### Phase 1 — Releaseable guest MVP (2–3 weeks)

- Guest-first splash and onboarding; local `installation_id`.
- Reliable search/recent/quantity/edit/delete flows using the bundled Thai food set.
- Local-first Dexie persistence and PWA install/offline experience.
- Today, basic history, profile/target editing, accessibility and Thai copy pass.
- Remove misleading fake results and demo logins from production paths.

**Exit:** a new user can install, set a safe target, log a meal, return later, and retain data without a network.

### Phase 2 — Free account and safe sync (2–3 weeks)

- Email/Google Auth, account recovery, production redirect configuration.
- Guest-to-account migration, idempotent outbox sync, reconciliation and conflict tests.
- RLS migration, migration CI, error tracking, backups, delete/export request design.

**Exit:** a user can sign in on a second device and see the same verified entries without duplication or loss.

### Phase 3 — Public beta readiness (2 weeks)

- Deploy Vite build to Pages and move all real API routes to Pages Functions.
- Barcode lookup using cache plus an approved provider; manual-add fallback if not found.
- Test suite: typecheck, unit TDEE/calories/Thai normalization, sync integration, core E2E flows.
- Analytics limited to privacy-respecting funnel and reliability metrics; release checklist and rollback plan.

**Exit:** monitored public beta with a functional backend, no client secrets, and reproducible deploys.

### Phase 4 — Monetization validation (after beta evidence)

- Measure activation, D7/D30 retention, logging time, sync success, and demand for advanced insights.
- Add server-side entitlement checks and a billing provider only if evidence supports it.
- Premium: expanded history/insights/export first; keep essential logging free.

**Exit:** paid conversion is tested without degrading the free core experience.

### Phase 5 — Costed intelligence (optional)

- Real barcode scanner with iOS fallback and user-contributed product flow.
- AI food photo candidates with explicit confirmation, quotas, rate limits, cache, and spend alerts.
- Label OCR is prioritized over open-ended food-photo AI if Thai packaged-food coverage is weak.

**Exit:** each paid provider feature has a unit-cost budget, abuse controls, and a useful non-AI fallback.

## 6. Launch gates

Do not release publicly until all are true:

- Production build installs and updates as a PWA on Android and iOS Safari.
- Guest onboarding and first log work offline; data remains after restart.
- No production client bundle contains privileged credentials or fake success fallback.
- Auth, guest conversion, sync retry, update, delete, and cross-device reconciliation are tested.
- RLS tests prove one account cannot read/write another account’s data.
- Privacy notice, deletion/export path, food-data attribution/licensing, monitoring, backup, and rollback ownership are in place.
- Core E2E test passes: Guest → log food → register → sync → sign in on device two → edit entry.

## 7. Metrics that decide what comes next

| Metric | Decision it informs |
|---|---|
| First food logged rate | Is onboarding too long? |
| Median time to log a meal | Are recent/search/portion flows truly fast? |
| D1 / D7 / D30 retained users | Is the core habit valuable before monetizing? |
| Guest-to-free-account conversion | Is backup/sync prompt timed well? |
| Sync error and duplicate-entry rate | Is cloud reliability safe to expand? |
| Barcode found rate by store sample | Invest in provider data vs manual/OCR flow |
| AI acceptance and cost per accepted log | Is AI economically useful? |

# KinDee mobile (React Native / Expo)

iOS/Android app for KinDee. It reuses the existing Cloudflare Pages Functions (`/api/sync`, `/api/barcode`, `/api/report`, `/api/account`) and Supabase project; the web PWA in `../kindee-app` is unchanged.

Round 1 scope (App Store): guest-first onboarding + TDEE, food logging (1,872 bundled Thai foods + Supabase search), barcode scan (camera + gallery), favorites, calendar, offline-first sync, email/password auth, PDPA export/delete, feedback.
Intentionally left out: Pricing/Stripe (Apple requires In-App Purchase for digital subscriptions, guideline 3.1.1), AI photo analysis (disabled in the web app too), admin, Google sign-in (would trigger guideline 4.8 Sign in with Apple).

## Develop

```bash
cp .env.example .env   # fill in the publishable Supabase key and API base
npm install
npm run web            # quick UI preview in a browser (camera does not work there)
npm run ios            # needs a Mac, or use Expo Go / a dev build
npm run typecheck && npm test
```

## Publish to the App Store

Requires an Apple Developer Program account (owner action, cannot be automated).

1. In App Store Connect create the app. The bundle id in `app.json` is `com.kindee.app` (**Not confirmed** — change it if that id is taken or you prefer another, then register the same id in the Apple Developer portal).
2. `npx eas-cli@latest login` then `npx eas-cli@latest init` (links the project; adds `extra.eas.projectId` to `app.json`).
3. Set the public env vars for the production build (EAS dashboard → Environment variables, or `eas env:create`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_API_BASE`, optionally the privacy/support emails. `.env` is git-ignored and not uploaded.
4. `npm run build:ios` (EAS creates certificates/profiles with your Apple login) → then put the App Store Connect app id in `eas.json` (`submit.production.ios.ascAppId`) and run `npm run submit:ios`. Test via TestFlight first.
5. App Store Connect listing checklist:
   - Privacy Policy URL and Support URL (public pages; Not confirmed that they exist yet — the `/privacy` text is currently only inside the app).
   - App Privacy "nutrition label": email, user ID, health & fitness data (weight, height, food log), diagnostics; linked to the user; not used for tracking.
   - Age rating 17+ is not required, but the app is for 18+; mention health content ("not medical advice").
   - Screenshots (6.9" iPhone), description, keywords, category Health & Fitness.
   - Review notes: a demo account, or "tap 'เริ่มบันทึกเลย' to use without an account".
   - Account deletion is in-app: Profile → "ลบบัญชีและข้อมูลทั้งหมด" (required by guideline 5.1.1(v)).

## Data layer

`src/lib/db.ts` replaces Dexie/IndexedDB with an in-memory store persisted to AsyncStorage (same table shapes: entries, outbox, favorites, meta, scanQueue), so the `/api/sync` protocol is identical. If entry volume grows large, move it to `expo-sqlite`.

`src/lib/{types,calc,thai}.ts`, `src/data/*` and `src/content/*` are copies of the web app's pure logic/data. Keep them in sync (or extract a shared package later).

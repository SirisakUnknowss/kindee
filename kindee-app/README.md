# KinDee application

โค้ด React PWA และ Cloudflare Pages Functions ของ KinDee อยู่ในโฟลเดอร์นี้ คู่มือ setup, environment, Supabase, deployment และ UAT ฉบับเต็มอยู่ที่ [README หลัก](../README.md)

## Quick start

```bash
npm install
copy .env.development.example .env.development.local
npm run dev
```

## Verify

```bash
npm run typecheck
npm test
npm run build
```

## Environment templates

- `.env.development.example` — local browser build
- `.env.staging.example` — staging/UAT browser build
- `.env.production.example` — production browser build
- `.dev.vars.example` — local Pages Functions secrets
- `wrangler.jsonc` — non-secret Cloudflare Pages configuration

ค่าจริงอยู่ในไฟล์ `.local`, `.dev.vars` หรือ Cloudflare Variables and Secrets เท่านั้น ห้าม commit secrets ลง repository

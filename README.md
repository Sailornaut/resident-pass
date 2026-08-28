# ResidentPass

A lightweight multi-tenant web application for residential communities (HOAs and condominium associations) to issue, manage, and verify **temporary guest parking passes**.

Residents request passes through a self-service portal. The system enforces community-specific rules, issues a unique pass with a QR code, and gives enforcement staff an instant, login-free way to verify validity — without exposing resident identity.

Built from the [MVP scaffold specification](docs/HOA_Temporary_Parking_Pass_MVP_Scaffold.md).

## Stack

- **Next.js 15** (App Router, React Server Components, Server Actions)
- **Supabase** — PostgreSQL, email/password Auth, Row-Level Security
- **Tailwind CSS 4**
- **Zod** for validation, **qrcode** for QR generation, **Vitest** for tests

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (use `supabase status -o env` for local keys)
cp .env.local.example .env.local
#    → fill in the local or hosted Supabase URL and keys

# 3. Start local Supabase and apply the schema
npm run db:start
npm run db:migrate

# 4. Seed development data (2 communities, 18 units, sample passes)
npm run db:seed

# 5. Run the app
npm run dev
```

Open http://localhost:3000. Local seeded accounts use the development password
`ResidentPass-E2E-2026!`. New users can create an account from the sign-in page.
Set `SEED_USER_PASSWORD` explicitly if you intentionally seed a hosted project.

## Project structure

```
src/
  app/
    (resident)/         Resident portal: dashboard, request, my passes, print
    verify/[code]/      Public QR verification (no login, minimal data)
    admin/              Community admin: dashboard, passes, units, rules
    platform/           Internal platform administration
    auth/               Sign-in, signup profile completion, sign-out
    api/public/         Rate-limited public status endpoint
  components/           UI kit + resident/admin/pass components
  lib/
    auth/               Session + authorized-context helpers
    db/                 Supabase clients + entity types
    parking-rules/      Centralized issuance rules engine + status calc
    permissions/        Role-based access control
    qr/                 Pass codes + QR generation
    validation/         Zod schemas
  server/
    actions/            Server actions (resident + admin)
    services/           Business logic (issue, cancel, revoke, verify)
supabase/
  migrations/           SQL schema with RLS policies
database/
  seed/                 Two-community seed data with edge cases
tests/
  unit/                 Rules engine, status calculation, pass codes
```

## Key design decisions

- **Multi-tenant from the first migration.** Every community-owned record carries `community_id`; RLS policies plus server-side checks prevent cross-community access.
- **The database is the source of truth.** The printed pass is a convenience; effective status (valid / expired / revoked / not-yet-valid) is always computed live at verification time.
- **Centralized rules engine** (`src/lib/parking-rules`) evaluates all ten issuance checks in deterministic order and returns human-readable rejection reasons.
- **Two identifiers per pass**: an internal UUID and a human-friendly public code (`RP-XXXX-XXXX`, unambiguous alphabet, non-sequential). The QR encodes only the verification URL with the public code — never resident data.
- **Verification is public but minimal**: community, plate, state, validity window. No resident names, no login.

## Testing

```bash
npm test          # unit tests (rules engine, status, codes)

# First E2E run only: install the browser runtime
npx playwright install chromium

# Starts local Supabase, migrates, seeds, and runs the browser suite
npm run test:e2e
```

Highest-value coverage per the MVP spec: tenant isolation, rule enforcement,
status calculation, public-code uniqueness, and the authenticated issuance →
verification → revocation golden path.

## Deployment

Deploy to Vercel (or similar) with the environment variables from `.env.local.example`. Point `NEXT_PUBLIC_APP_URL` at the deployed origin so QR codes resolve correctly.

## MVP boundaries

Deliberately **not** included: license-plate recognition, towing integrations, payments, amenity access, native apps, or general HOA management. See §3 and §22 of the scaffold doc for the roadmap.
# resident-pass

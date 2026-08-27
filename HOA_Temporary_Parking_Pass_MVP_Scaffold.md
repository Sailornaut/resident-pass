# Temporary Parking Pass Platform — MVP Product & Engineering Scaffold

Working title: CommunityPass | Pilot: HOA / Condominium Community

## 1. Product Summary

CommunityPass is a lightweight multi-tenant web application for residential communities to issue, manage, and verify temporary guest parking passes. Residents request a temporary pass through a self-service portal. The system applies community-specific rules, creates a unique pass, and provides a printable version with a verification code and QR code. Authorized community staff can verify, revoke, and audit passes without exposing unnecessary resident information.

### Core value proposition

- Replace manually issued or reusable guest placards with controlled, time-limited digital issuance.
- Give residents a fast self-service workflow without requiring board or management intervention for every guest.
- Give property managers and enforcement personnel an immediate way to determine whether a displayed pass is valid.
- Preserve accountability by associating every issued pass with a residence and request history.
- Support multiple communities from one platform so a property manager can onboard additional associations without deploying separate applications.

## 2. MVP Goals

The MVP should prove four things: residents can obtain a legitimate temporary pass with minimal friction; the community can enforce configurable limits; an enforcement user can verify a pass in seconds; and administrators can see who issued a pass and revoke it when necessary.

### Success criteria

- A resident can request and print a valid pass in under two minutes.
- Every issued pass has a globally unique identifier and QR verification link.
- Community rules are enforced automatically before issuance.
- Verification does not require login for basic validity checks, but does not expose resident identity.
- Authorized admins can view issuance history, revoke passes, and configure basic parking rules.
- The data model supports more than one community without code duplication.

## 3. Explicit Non-Goals for MVP

To prevent scope creep, the first release should NOT include automatic license-plate recognition, towing integrations, payments, resident violation billing, pool/amenity access, architectural requests, package tracking, clubhouse reservations, native iOS/Android apps, hardware scanners, or generalized HOA management features. The product should remain narrowly focused on temporary parking issuance and verification.

## 4. User Roles

### Resident
A verified user associated with one or more units. Can request, view, print, and cancel their own active temporary passes subject to community rules.

### Community Administrator
Board member, property manager, or designated staff member. Can manage community parking rules, resident/unit associations, all passes, revocations, and audit history.

### Enforcement / Verifier
Security, parking patrol, tow contractor, or authorized volunteer. Can validate a pass by QR code or pass ID. MVP should minimize the data shown to this role.

### Platform Administrator
Internal operator role used to create communities, manage tenant configuration, troubleshoot accounts, and support onboarding. This role is not exposed in the resident-facing UI.

## 5. Primary User Flows

### Flow A — Resident requests a temporary pass

1. Resident signs in.
2. Dashboard shows permanent parking policy, active temporary passes, and remaining allowance.
3. Resident selects **Request Temporary Pass**.
4. Resident enters guest vehicle license plate, state, start date/time, end date/time, and optional note/category.
5. Backend validates the request against community rules.
6. If valid, backend creates the pass and returns a unique pass ID.
7. Resident sees a confirmation screen and can open/print the pass.
8. Pass contains a human-readable ID, QR code, validity window, vehicle plate, and community name.

### Flow B — Verify a pass

1. Verifier scans QR code or opens verification page and enters the pass ID.
2. Backend retrieves the pass and determines current status.
3. Verification page clearly shows **VALID**, **EXPIRED**, **REVOKED**, **NOT YET VALID**, or **NOT FOUND**.
4. For a valid pass, display only enforcement-relevant data: community, plate, state, and expiration. Resident name should remain hidden by default.

### Flow C — Administrator revokes a pass

1. Admin searches or filters active passes.
2. Admin opens a pass record.
3. Admin selects **Revoke**, optionally entering a reason.
4. Backend records the revocation timestamp and actor.
5. Any future verification returns **REVOKED** immediately.

### Flow D — Configure community rules

1. Admin opens Parking Rules.
2. Admin sets limits such as maximum active passes per unit, maximum pass duration, advance-request window, and rolling monthly issuance limit.
3. Rules apply to all subsequent requests. Existing passes remain unchanged unless manually revoked.

## 6. Recommended MVP Screens

### Resident experience

1. **Sign In** — email/password or passwordless link.
2. **Resident Dashboard** — unit, active passes, recent pass history, allowance/rule summary, Request Pass CTA.
3. **Request Pass** — compact form with clear validity rules and inline validation.
4. **Pass Confirmation** — issued pass summary plus Print / Save as PDF action.
5. **Printable Pass** — intentionally high-contrast and legible through a windshield.
6. **My Passes** — active, upcoming, expired, revoked; ability to cancel eligible passes.

### Public/enforcement experience

7. **Verify Pass** — QR destination plus manual ID entry. Large status banner, minimal data, mobile-first layout.

### Community admin experience

8. **Admin Dashboard** — active passes, passes expiring today, recent issuance, revoked passes, basic usage metrics.
9. **Pass Management** — search/filter by ID, plate, unit, date, and status.
10. **Pass Detail** — full audit data, resident/unit attribution, revoke action.
11. **Units & Residents** — manage unit records and resident associations.
12. **Parking Rules** — configure limits and default pass behavior.

### Platform administration

13. **Communities** — create/edit communities and assign community administrators. This may initially be internal-only and visually minimal.

## 7. Printable Pass Requirements

The printed object must be easy to inspect visually but should never be treated as the source of truth. The database determines validity.

Required fields: community name/logo placeholder, `TEMPORARY PARKING PASS`, unique pass ID, QR code, vehicle plate/state, valid-from and valid-until timestamps, and a short statement such as `Scan QR or enter Pass ID to verify current status.`

Recommended visual hierarchy: status/purpose at top, plate in very large type, expiration prominently visible, QR code large enough for phone scanning through glass, unique ID directly below QR, minimal decorative content.

## 8. Multi-Tenant Domain Model

The application should be multi-tenant from the first migration. Every community-owned record must include or derive a `community_id`, and authorization checks must prevent cross-community data access.

### Core entities

| Entity | Purpose | Key fields |
|---|---|---|
| ManagementCompany | Optional parent organization | id, name |
| Community | Tenant / HOA / condo association | id, management_company_id, name, timezone, status |
| Unit | Residence within a community | id, community_id, unit_label/address_label, status |
| User | Authentication identity | id, email, name, status |
| Membership | User-to-community/unit role mapping | id, user_id, community_id, unit_id, role, status |
| ParkingRuleSet | Configurable policy | id, community_id, max_active, max_duration, monthly_limit, advance_window |
| ParkingPass | Issued temporary credential | id, public_code, community_id, unit_id, requester_user_id, plate, state, valid_from, valid_until, status |
| PassEvent | Immutable audit event | id, pass_id, actor_user_id, event_type, timestamp, metadata |
| CommunityBranding | Optional visual configuration | community_id, display_name, logo_url, footer_text |

### Suggested pass status values

`scheduled`, `active`, `expired`, `revoked`, `cancelled`. Status may be stored for explicit lifecycle events while effective status is calculated using timestamps and revocation state.

## 9. Suggested API Surface

API naming is illustrative and can be implemented with REST endpoints, server actions, or equivalent framework conventions.

### Resident

- `GET /api/me`
- `GET /api/me/passes`
- `POST /api/passes`
- `GET /api/passes/{id}`
- `POST /api/passes/{id}/cancel`
- `GET /api/passes/{id}/print`

### Public verification

- `GET /verify/{publicCode}`
- `GET /api/public/passes/{publicCode}/status`

### Community administration

- `GET /api/admin/passes`
- `GET /api/admin/passes/{id}`
- `POST /api/admin/passes/{id}/revoke`
- `GET /api/admin/units`
- `POST /api/admin/units`
- `PATCH /api/admin/units/{id}`
- `GET /api/admin/rules`
- `PUT /api/admin/rules`

### Platform administration

- `POST /api/platform/communities`
- `PATCH /api/platform/communities/{id}`
- `POST /api/platform/communities/{id}/admins`

## 10. Pass Issuance Rules Engine — MVP

Before issuing a pass, evaluate rules in a deterministic order and return a human-readable rejection reason. Suggested checks: requester has an active membership; selected unit belongs to the requester; community is active; plate format is present; requested interval is valid; duration does not exceed community maximum; start date is not beyond the allowed advance window; unit does not exceed maximum simultaneous active/scheduled passes; rolling issuance limit has not been exceeded; and an identical overlapping pass does not already exist for the same plate/unit.

Keep the rule implementation centralized so future communities can have different policies without branching UI code.

## 11. Unique ID and QR Design

Use two identifiers: an internal database UUID and a shorter public pass code intended for humans. Example public format: `CP-7K4M-9Q2F`. Public codes should be randomly generated with sufficient entropy and must not be sequential.

QR code payload should point to a verification URL containing only the public code. Do not encode resident name, unit, email, or other private data directly into the QR code.

## 12. Security & Privacy Requirements

- Enforce tenant isolation server-side on every authenticated query. Never trust a community ID supplied only by the client.
- Public verification exposes the minimum information required for parking enforcement.
- Public pass codes must be non-sequential and difficult to enumerate.
- Apply rate limiting to public verification endpoints.
- Record issuance, cancellation, revocation, and administrative changes as audit events.
- Avoid storing more personal information than needed. For MVP, vehicle plate/state and unit attribution are sufficient for most workflows.
- Do not expose resident names or contact information on printable passes or public verification pages by default.
- Store timestamps in UTC and render them in each community’s configured timezone.
- Use role-based access checks for resident, verifier, community administrator, and platform administrator actions.
- Administrative exports, bulk tools, and integrations should be deferred until access-control behavior is well tested.

## 13. Authentication & Onboarding

For the pilot, avoid open public registration. Accounts should be invited or pre-associated with an approved unit. A simple initial workflow is: platform/community admin creates or imports units; admin invites a resident by email and associates the invitation with a unit; resident accepts invitation and creates/signs into account; membership becomes active.

For later deployments, resident identity could integrate with property-management systems, but that is outside MVP scope.

## 14. Suggested Technical Architecture

The design is intentionally framework-neutral, but a fast implementation path is a modern React/Next.js web application with a managed PostgreSQL database and managed authentication. Supabase is a strong MVP option because authentication, PostgreSQL, row-level security, storage, and server-side functions can coexist in one service; equivalent platforms are acceptable. Deploying the web application to Vercel or a similar managed host keeps operational overhead low during the pilot.

### Logical components

`Browser / Mobile Browser` → `Web Application` → `Authorization + Rule Service` → `PostgreSQL`

Supporting services: authentication, QR generation, PDF/print rendering, transactional email for invitations, and application logging.

Avoid unnecessary microservices for the MVP. The system is small enough to remain a modular monolith until scale or integration requirements justify separation.

## 15. Suggested Repository Structure

```text
/communitypass
  /app
    /(auth)
    /(resident)
      /dashboard
      /passes
      /passes/new
    /verify/[code]
    /admin
      /passes
      /units
      /rules
    /platform
      /communities
  /components
    /resident
    /admin
    /parking-pass
    /ui
  /lib
    /auth
    /db
    /parking-rules
    /permissions
    /qr
    /validation
  /server
    /actions
    /services
  /database
    /migrations
    /seed
  /tests
    /unit
    /integration
    /e2e
  /docs
```

## 16. Fable / UI Design Brief

Design for ordinary residents first, not technical users. The interface should feel closer to a simple municipal parking portal than a property-management enterprise suite. Use generous spacing, clear status language, and very few decisions per screen.

### Visual direction

- Clean, contemporary residential/community aesthetic.
- Light theme as primary MVP experience.
- Strong typography and accessible contrast.
- Status chips for Active, Scheduled, Expired, Revoked, and Cancelled.
- Resident dashboard should prioritize one obvious primary action: **Request Temporary Pass**.
- Admin dashboard may be denser, but should still avoid enterprise-software clutter.
- Verification page must be extremely fast to parse outdoors on a phone. A full-width status treatment should dominate the page.
- Printable pass should be mostly monochrome/high contrast so it remains usable on inexpensive home printers.

### Fable should generate

Resident Dashboard, Request Pass form, Pass Confirmation, Printable Pass, My Passes, mobile Verify Pass page, Admin Dashboard, Pass Management table, Pass Detail, Units & Residents, Parking Rules, and a minimal Community Setup page.

## 17. Validation and Error States to Design

Fable and frontend implementation should explicitly include: invalid date range, pass duration too long, active-pass limit reached, monthly limit reached, duplicate/overlapping plate request, account not associated with an active unit, revoked pass verification, expired pass verification, unknown pass ID, network/API failure, and successful cancellation/revocation confirmations.

## 18. MVP Acceptance Criteria

### Resident

- Authenticated resident sees only passes associated with their authorized unit(s).
- Resident can create a valid pass when all configured rules are satisfied.
- Invalid requests are rejected before creation with a clear reason.
- Resident receives a unique public pass code.
- Resident can open a print-friendly pass containing the correct plate and validity window.
- Resident can cancel their own future/active pass if community policy permits.

### Verification

- Scanning the QR reaches the correct public verification record.
- Validity result reflects current time and revocation state.
- Public page does not reveal resident identity or contact information.
- Manually entering a public code produces the same result as scanning the QR.

### Administration

- Admin can list/search/filter passes belonging to their community only.
- Admin can identify the responsible unit/requester on the authenticated detail page.
- Admin can revoke a pass and the public verification result changes immediately.
- Admin can modify MVP rule settings.
- Admin actions are recorded in the audit log.

### Multi-tenancy

- Two seeded communities can coexist in the same deployment.
- A user/admin from Community A cannot access Community B records by changing URLs, IDs, API parameters, or client state.

## 19. Seed Data for Development

Create at least two communities to validate tenant isolation from the beginning. Example: `Oak Ridge Condominiums` and `Pine Creek HOA`. Seed each with 8–12 units, one community admin, several residents, and a mixture of active, scheduled, expired, and revoked passes. Include one unit at its active-pass limit and one resident with no remaining monthly allowance so error states are easy to test.

## 20. Testing Priorities

Highest-value automated tests should cover tenant isolation, rule enforcement, pass status calculation, public-code uniqueness, authorization boundaries, revocation behavior, timezone edge cases, and the QR/public verification path. Add end-to-end tests for the golden path: resident logs in → requests pass → pass is issued → verifier sees valid status → admin revokes → verifier sees revoked status.

## 21. Pilot Deployment Checklist

- Confirm written parking rules with HOA/property manager.
- Create pilot community and unit list.
- Select initial administrator(s).
- Invite a small resident test cohort.
- Test pass printing on ordinary black-and-white home printers.
- Test QR scanning through a vehicle windshield in daylight and at night.
- Define who is authorized to revoke passes.
- Define resident support/contact path.
- Establish a short privacy notice and data-retention policy before broad rollout.
- Run the pilot alongside the existing process briefly before relying on it operationally.

## 22. Post-MVP Roadmap

### Near-term
Community branding, resident bulk import, admin CSV export, configurable cancellation rules, custom guest categories, email notifications, vehicle history/autocomplete, better reporting, and management-company dashboard spanning multiple communities.

### Later
Property-management system integrations, towing/enforcement integrations, digital wallet-style passes, optional vehicle allowlists, custom enforcement roles, configurable exception approval workflows, analytics across communities, SSO, and white-label domains.

### Explicitly resist unless customer demand is strong
General HOA dues, amenity reservations, architectural-review workflows, broad violation management, and unrelated property-management modules. These features change the product category and dramatically increase implementation and support burden.

## 23. Commercialization Hypothesis

The pilot should be treated as validation rather than a free custom build. If the workflow succeeds, the natural buyer is the HOA/condominium association or its property-management company, while residents remain end users. A simple recurring per-community subscription is easier to understand than per-pass billing. Pricing can be tested after the pilot based on community size, administrative savings, enforcement value, and support burden.

A useful future management-company feature is a portfolio view where one property manager can switch between authorized communities while tenant data remains isolated. This makes referral-based expansion possible without creating a separate deployment for each association.

## 24. Build Sequence

### Phase 1 — Foundation
Database schema, tenant isolation, authentication, memberships, seed data, permissions.

### Phase 2 — Resident golden path
Resident dashboard, request form, centralized rule validation, pass creation, pass view/print template.

### Phase 3 — Verification
Public verification page, QR generation, effective status calculation, rate limiting.

### Phase 4 — Administration
Pass list/detail, revocation, unit/resident management, rule configuration, audit events.

### Phase 5 — Pilot hardening
Error states, logging, tests, accessibility, mobile QA, printer QA, security review, privacy copy, deployment documentation.

## 25. Definition of “Ready for HOA Pilot”

The product is ready when a nontechnical resident can issue and print a temporary pass without assistance, a parking-enforcement user can verify that pass from a phone without logging in, an administrator can trace and revoke it, and cross-community access has been explicitly tested and prevented. Everything else is secondary for the first real-world pilot.

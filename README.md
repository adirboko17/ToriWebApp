# Tori Web

Separate RTL, mobile-first booking website for the existing Barber English Supabase project. Built with React, TypeScript and Vinext (Next.js App Router APIs) for the Sites Cloudflare runtime.

## Run

`npm install` then `npm run dev`. Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and a random 32+ character `SESSION_SECRET` in ignored `.dev.vars`. Production values are stored in Sites runtime secrets. No service-role key is used or shipped.

## Tenant identity and theme

All pages live under `/b/[slug]`. Business resolution uses `business_profile.web_slug`. Apply `supabase/migrations/20260909_business_web_slug.sql` to enable arbitrary new slugs without rebuilding. Until that additive migration is applied, existing app configuration mappings for `tori`, `linbitton`, and `shirlavy` resolve by their original UUID. The root redirects to `/b/tori` and never enumerates businesses. Theme colors, logo and imagery come from the resolved business on every load.

## Existing app compatibility

- Manual table interfaces copied from the app into `lib/types.ts`.
- Phone normalization and booking cursor rules copied directly from the app.
- Availability follows personal/global weekly hours, overrides, breaks, constraints, occupied rows, service durations, gaps, per-staff booking windows, client limits and Asia/Jerusalem time.
- `auth-phone-otp` is unchanged. A successful verification creates a signed HttpOnly web session. Every protected request rechecks the user, business, role and blocked state against the database. Local storage stores language preferences only.
- Booking preserves the native update-available-row / insert workflow, with another availability check before writing. The web adds `client_user_id` alongside canonical phone identity.
- Client pages include booking, appointment cancellation, ICS export, waitlist, swap-request creation, gallery, products, notifications, profile and avatar upload.
- Admin includes day/week list, manual booking, client approval/blocking, waitlist scheduling, weekly hours, multiple breaks, overrides and constraints.

## Validation

`npx tsc --noEmit`, `node scripts/check.mjs`, `node scripts/check.mjs --integration` (running local server, read-only integration), and `npm run build`.

## Outstanding production verification

- SMS verification and real booking/cancellation were not exercised against customer records. Complete these with a designated test customer before external launch.
- The native read-then-insert flow cannot guarantee exclusion of simultaneous overlapping inserts. A database exclusion constraint or transactional booking RPC is required for a strict cross-app concurrency guarantee; none is installed by this website.
- Existing database RLS is disabled as described in the supplied specification. This site's server gateway enforces scope and identity, but it does not repair direct access through the pre-existing native app's public credentials. Review database policies separately before broad production use.
- `web_slug` migration is supplied but not applied. No existing database schema or Edge Function was modified.
- i18next and persisted language preferences are included; full English translation is pending. The complete current interface is Hebrew RTL.
- Swap requests are created in the existing table. Matching notifications and execution remain in the existing application. Advanced phase-two admin features (finance, recurring visits, broadcasts, editing products/gallery) are outside this delivered core.
- Automatic notifications beyond existing database triggers are not fully ported. Booking/cancellation history remains subject to the native slot-reuse model.
- WebMCP configuration is feature-detected. Mobile browser visual QA covered the home page and staff, service, date/time and confirmation steps at 390px. Real SMS and booking submission remain untested.
- Current deployment targets Sites/Cloudflare; Vercel deployment would require switching from Vinext to Next.js and adapting runtime environment access.

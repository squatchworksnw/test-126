# Security Readiness Checklist

Use this before broader pilot testing. Items marked manual must be confirmed in Supabase or hosting dashboards.

## Auth

- [ ] Confirm Site URL:
  - `https://squatchworksnw.github.io/test-126/`
- [ ] Confirm allowed redirect URLs:
  - `https://squatchworksnw.github.io/test-126/`
  - `https://squatchworksnw.github.io/test-126/?mode=recovery`
- [ ] Do not use cache-busted URLs for auth redirects.
- [ ] Confirm password recovery sends users to:
  - `https://squatchworksnw.github.io/test-126/?mode=recovery`
- [ ] Confirm password recovery works with a real email before pilot testing.
- [ ] Confirm sign-in rate limits in Supabase Authentication settings.
- [ ] Confirm email OTP / magic-link limits in Supabase Authentication settings.
- [ ] Confirm password reset limits in Supabase Authentication settings.

## Session Policy

- [ ] Review Supabase JWT/session duration.
- [ ] Choose a session length appropriate for shared field devices.
- [ ] Document whether users should sign out on shared devices.
- [ ] Confirm users can recover access without administrator intervention.

## Storage

- [ ] Enforce server-side upload size limit: 10MB maximum.
- [ ] Enforce allowed file types:
  - `.jpg`
  - `.jpeg`
  - `.png`
  - `.pdf`
  - `.xlsx`
  - `.csv`
  - `.doc`
  - `.docx`
- [ ] Confirm Storage bucket name:
  - `documents`
- [ ] Confirm users can only upload/read files for their workspace.
- [ ] Confirm upload replacement policy is intentional.
  - Current app upload uses `upsert:false`.
- [ ] Keep browser validation, but do not rely on browser validation alone.

## CSP

Current status: not ready for immediate strict CSP.

Reason:

- The app uses many inline `onclick` handlers.
- The app has several inline `style` attributes.
- The app loads scripts from:
  - `https://cdn.jsdelivr.net`
  - local app files
- The app connects to:
  - Supabase project API
  - Supabase Storage

Minimum migration plan:

1. Move inline `onclick` handlers to JavaScript event listeners.
2. Move inline `style` attributes to CSS classes.
3. Pin third-party CDN versions already in use.
4. Add CSP in report-only mode first.
5. Review browser console violations.
6. Promote to enforced CSP after violations are clean.

Draft CSP target after migration:

```text
default-src 'self';
script-src 'self' https://cdn.jsdelivr.net;
style-src 'self';
img-src 'self' data: blob: https://vkjbmqpdrixjjjrrnbza.supabase.co;
font-src 'self' data:;
connect-src 'self' https://vkjbmqpdrixjjjrrnbza.supabase.co;
media-src 'self' blob: https://vkjbmqpdrixjjjrrnbza.supabase.co;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
manifest-src 'self';
```

Temporary CSP, if used before handler migration, would need `'unsafe-inline'` for scripts/styles. That is not a meaningful production security improvement and should be avoided unless used only as a short report-only diagnostic.

## Backup Policy

- [ ] Confirm Supabase backup/PITR availability for the project plan.
- [ ] If PITR is not available, define a daily backup/export process.
- [ ] Confirm who can restore data.
- [ ] Keep app backup restore guarded by:
  - valid backup structure
  - matching workspace ID
  - explicit overwrite confirmation

## Recovery Policy

- [ ] Confirm support contact shown in Settings is real.
- [ ] Confirm workspace administrator knows how to reset or invite users.
- [ ] Confirm password recovery redirect settings before sending pilot invites.
- [ ] Confirm first-month incident process:
  - screen
  - user
  - time
  - action being attempted
  - screenshot
  - console error if available

## Demo Controls

- [ ] Confirm `Demo mode`, `Load Demo Data`, and `Clear Demo` remain hidden from production users.
- [ ] Confirm demo workspace writes are blocked.
- [ ] Confirm demo data is clearly labeled as temporary and local.

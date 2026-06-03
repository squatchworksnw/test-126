# Production Dashboard Checklist

These items must be configured manually before broader user testing.

## Supabase Auth

- Add password recovery redirect URLs:
  - `https://squatchworksnw.github.io/test-126/`
  - `https://squatchworksnw.github.io/test-126/?mode=recovery`
- Confirm the site URL is set to:
  - `https://squatchworksnw.github.io/test-126/`
- Review sign-in rate limiting if available for the project plan.
- Review session timeout / JWT expiry policy.
- Confirm password reset emails use calm support language and point to the stable recovery URL, not a cache-busted URL.

## Supabase Storage

- Enforce the same upload rules server-side:
  - allowed extensions: `.jpg`, `.jpeg`, `.png`, `.pdf`, `.xlsx`, `.csv`, `.doc`, `.docx`
  - maximum file size: 10MB
- Confirm storage policies only allow valid workspace users to upload/read files for their workspace.
- Confirm file replacement policy is intentional. The app currently uploads with `upsert:false`.

## Backups

- Confirm backup/PITR availability for the project plan.
- If PITR is unavailable, configure a daily backup/export process.
- Keep manual workspace backup restore guarded. Restore should only happen after validation and confirmation.

## First-Month Support

- Replace app placeholder support contact:
  - support email
  - support phone
  - workspace administrator
- Decide whether error monitoring starts with Sentry or a Supabase `field_ops_error_log` table.
- Keep a simple incident note format:
  - user
  - time
  - screen
  - action
  - screenshot
  - console error if available

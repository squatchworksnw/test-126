# Deployment Manifest

Date: 2026-05-15

## GitHub Pages Runtime

For GitHub Pages, upload the contents of `github-pages-runtime/` to the repository root.

Do not upload the parent folder itself.

Required runtime files and folders:

```text
.nojekyll
index.html
app.js
styles.css
README.md
BUG_HUNT_REPORT.md
LIVE_PILOT_DEPLOYMENT_STEPS.md
PILOT_TEST_CHECKLIST.md
SECURITY_TRUST_REVIEW.md
auth/
components/
services/
state/
styles/
sync/
views/
```

## Source-Only Files

These are useful for development/audit, but do not need to be uploaded for the app to run:

```text
AGENTS.md
DESIGN_ARCHITECTURE.md
FACILITIES_COMMAND_CENTER_V2_BLUEPRINT.md
FIELD_OPS_ARCHITECTURE.md
MODULARIZATION_PHASE_2_STATUS.md
OPERATIONAL_COMMAND_CENTER_ARCHITECTURE.md
OPERATIONAL_MATURITY_ROADMAP.md
SUPABASE_CRUD_RLS_AUDIT.md
LICENSE
sql/
tests/
```

## Removed During Housekeeping

```text
_incoming_working_loop/
state.js
```

Why:

- `_incoming_working_loop/` was an older nested working-copy import.
- `state.js` was a pre-modular legacy state file. The app now uses `state/app-state.js`.

## Do Not Commit

Avoid committing:

```text
node_modules/
.env
*.log
temporary zip extracts
old nested app copies
```

## Current Pilot URL

```text
https://squatchworksnw.github.io/Tes124/
```

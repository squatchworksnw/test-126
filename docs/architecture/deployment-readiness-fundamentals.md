# Deployment Readiness Fundamentals

These rules must hold before outside users touch the app.

## File Upload Rules

Allowed user upload types:

```text
.jpg, .jpeg, .png, .pdf, .xlsx, .csv, .doc, .docx
```

Maximum user upload size:

```text
10MB
```

The browser checks file type and size before upload. This is only a first line of defense.

TODO: Supabase Storage policy, bucket settings, or server-side upload handling must also enforce the same file type and 10MB maximum size.

## Soft Delete Requirement

Archive, reject, and remove-from-active actions must preserve history.

Expected behavior:

- Update `archived_at` / `archived_by`, or update a status.
- Do not use SQL `DELETE` for operational records.
- Keep records recoverable for historical memory unless a separate owner-only data removal process is intentionally designed.

Clear Demo and Clear Temporary Cache are local/device maintenance actions. They should not remove shared workspace records.

## Backup Restore Safety

Backup restore must validate before applying anything:

- Backup structure looks like a Field Operations workspace backup.
- Backup workspace ID matches the current workspace.
- User sees a clear confirmation before restore:
  `This will overwrite current workspace data.`

Invalid or mismatched backups must be rejected with calm plain-English errors.

## Mobile Zoom Requirement

The app must not disable native browser zoom.

Viewport settings must not include:

```text
user-scalable=no
maximum-scale=1
```

Users must be able to zoom on mobile browsers.

# Simple Pilot Login Setup

Use three real Supabase users:

- Owner email
- Admin email
- Submitter email

The app uses email sign-in links. No shared pilot password is needed.

## 1. Create The Users

In Supabase:

1. Go to Authentication.
2. Go to Users.
3. Add or invite the three test emails.

## 2. Assign Roles

Open:

```text
sql/pilot_user_roles.sql
```

Replace:

```text
owner@example.com
admin@example.com
submitter@example.com
```

with your three real test emails.

Run the SQL in Supabase SQL Editor.

## 3. Test

Open the app:

```text
https://squatchworksnw.github.io/test-126/
```

Use Email sign-in link.

Expected:

- Owner sees the full command center.
- Admin sees daily operations.
- Submitter sees the simple request/upload portal.

If a user can sign in but sees no workspace, their email exists in Authentication but does not have a matching row in `field_ops_memberships`.

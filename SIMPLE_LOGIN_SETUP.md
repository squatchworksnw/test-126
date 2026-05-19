# Simple Pilot Login Setup

Use three real Supabase users:

- Owner email
- Admin email
- Submitter email

The app uses email sign-in links. No shared pilot password is needed.

Your owner email is already the default in the pilot SQL:

```text
squatchworksnw@gmail.com
```

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

Also run:

```text
sql/owner_manage_memberships.sql
```

That enables the Settings page to add existing Supabase users and change their roles from the frontend.

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

## 4. Add People From The App

After `sql/owner_manage_memberships.sql` is run:

1. Sign in as the Owner.
2. Open Settings.
3. Use People + Roles.
4. Enter an email and choose Owner, Admin, or Submitter.

The email must already exist in Supabase Authentication. If it does not, invite/add them in Authentication > Users first.

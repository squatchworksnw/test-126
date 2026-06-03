# Supabase Auth Redirects

The app supports email sign-in links and password recovery links from Supabase Auth.

## Required Redirect URLs

Add these exact URLs in the Supabase dashboard under Authentication redirect URLs:

```text
https://squatchworksnw.github.io/test-126/
https://squatchworksnw.github.io/test-126/?mode=recovery
```

## Important

Do not use cache-busted URLs as auth redirects.

Use:

```text
https://squatchworksnw.github.io/test-126/?mode=recovery
```

Do not use:

```text
https://squatchworksnw.github.io/test-126/?v=commit&mode=recovery
```

The app may be opened with a cache-busted URL for testing, but the password recovery email should always return to the stable recovery URL.

## Manual QA

1. Open the app.
2. Enter the user's email.
3. Choose `Forgot password?`.
4. Confirm the email arrives.
5. Open the reset link.
6. Confirm the app shows `Set a new password`.
7. Enter and confirm the new password.
8. Save.
9. Confirm the app says `Password updated. You can sign in now.`
10. Sign in with the new password.

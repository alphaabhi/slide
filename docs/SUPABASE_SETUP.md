# Supabase setup

Project: `slide-dev` · Region: South Asia (Mumbai) · URL: `https://ouqltnuudjwwxfaqtpms.supabase.co`

Do these once, in order. Never share the database password or the **secret / service_role** key.

## 1. Run the database migrations

Supabase dashboard → **SQL Editor** → **New query**. Paste the contents of each file in `supabase/migrations/`, oldest first, and press **Run**. Each should end with "Success. No rows returned".

| File                          | Stage | Status |
| ----------------------------- | ----- | ------ |
| `20261105000000_profiles.sql` | 2     | To run |

Never edit a migration that has already been run; changes always come as a new file.

## 2. Make sign-in emails send a code

SLIDE signs people in with a code typed into the app (no links to click).

1. **Authentication → Emails → Templates**.
2. Open **Magic link**. Set the subject to `Your SLIDE sign-in code` and replace the body with the contents of `docs/email-templates/sign-in-code.html`. Save.
3. Open **Confirm signup** and do the same (first-time sign-ins use this template).

The important part is `{{ .Token }}` — that's the code.

## 3. Check the email sign-in settings

**Authentication → Sign In / Providers → Email**:

- Email provider: **enabled**
- Email OTP length: **6**
- Email OTP expiration: **3600** seconds (1 hour) is fine

## 4. Site URL

**Authentication → URL Configuration → Site URL**: set to the Vercel production URL once it exists (e.g. `https://slide-xxxx.vercel.app`).

## Known limit: who receives emails

Supabase's built-in email sender is for testing only: it sends just a few emails per hour, and only to addresses that are members of your Supabase organisation. You can test with your own email now. **Before anyone else can sign in**, connect a real email service under **Project Settings → Authentication → SMTP Settings** (e.g. Resend, which has a free tier). This is tracked in `PROJECT_STATUS.md`.

## Vercel environment variables

| Name                     | Value                                      |
| ------------------------ | ------------------------------------------ |
| `VITE_SUPABASE_URL`      | `https://ouqltnuudjwwxfaqtpms.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the publishable key (`sb_publishable_…`)   |

Both are public by design; row-level security protects the data.

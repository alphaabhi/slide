# Supabase setup

Project: `slide-dev` · Region: South Asia (Mumbai) · URL: `https://ouqltnuudjwwxfaqtpms.supabase.co`

Do these once, in order. Never share the database password or the **secret / service_role** key.

## 1. Run the database migrations

Supabase dashboard → **SQL Editor** → **New query**. Paste the contents of each file in `supabase/migrations/`, oldest first, and press **Run**. Each should end with "Success. No rows returned".

| File                          | Stage | Status |
| ----------------------------- | ----- | ------ |
| `20261105000000_profiles.sql` | 2     | To run |

Never edit a migration that has already been run; changes always come as a new file.

## 2. Connect an email service (required before templates can be edited)

Supabase only lets you edit email templates once a custom SMTP sender is set up. Without it, emails contain a link instead of the code SLIDE needs. We use **Resend** (free tier).

1. Sign up at resend.com using the email address you'll test SLIDE with.
2. Resend → **API Keys → Create API key** (permission: _Sending access_). Copy it. It's a secret — it goes into Supabase only, never into the app or a chat.
3. Supabase → **Authentication → Emails → Set up SMTP** (top of the Templates page) → enable **Custom SMTP**:

   | Field        | Value                                                                                    |
   | ------------ | ---------------------------------------------------------------------------------------- |
   | Sender email | `signin@mail.slidedm.space` (was `onboarding@resend.dev` before the domain was verified) |
   | Sender name  | `SLIDE`                                                                                  |
   | Host         | `smtp.resend.com`                                                                        |
   | Port         | `465`                                                                                    |
   | Username     | `resend`                                                                                 |
   | Password     | the Resend API key                                                                       |

4. Save.

Sending domain: **`mail.slidedm.space`** (domain `slidedm.space`, registered at Hostinger, DNS managed in Hostinger → Domains → slidedm.space → DNS / Nameservers). The DKIM, SPF and DMARC records Resend shows are added there, with the **Name exactly as Resend shows it** (Hostinger appends `.slidedm.space` itself). Until Resend shows the domain as _Verified_, emails only reach the Resend account owner's address.

## 3. Make sign-in emails send a code

`{{ .Token }}` is a placeholder: Supabase replaces it with a fresh 6-digit code in every email. You don't type a code here.

1. **Authentication → Emails → Templates → Magic link**.
2. **Subject**: `Your SLIDE sign-in code`
3. **Body**: switch to **Source**, delete everything, paste the contents of `docs/email-templates/sign-in-code.html`. Save.
4. Repeat for **Confirm signup** (first-time sign-ins use this one).

## 4. Check the email sign-in settings

**Authentication → Sign In / Providers → Email**:

- Email provider: **enabled**
- Email OTP length: **6**
- Email OTP expiration: **3600** seconds (1 hour) is fine

## 5. Site URL

**Authentication → URL Configuration → Site URL**: `https://slidedm.space`.

## Vercel environment variables

| Name                     | Value                                      |
| ------------------------ | ------------------------------------------ |
| `VITE_SUPABASE_URL`      | `https://ouqltnuudjwwxfaqtpms.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the publishable key (`sb_publishable_…`)   |

Both are public by design; row-level security protects the data.

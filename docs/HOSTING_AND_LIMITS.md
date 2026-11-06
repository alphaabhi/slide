# Hosting, data and free-plan limits

_Checked 2026-11-06. Plans change: confirm figures on each provider's pricing page before relying on them._

## Where things live

| What                                | Where                                                         | Notes                                                              |
| ----------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| Website code                        | Vercel (CDN)                                                  | Static files only; no user data                                    |
| Accounts (email, sessions)          | Supabase Auth, project `slide-dev`, AWS Mumbai (`ap-south-1`) | Passwordless; emails sent via Resend from `mail.slidedm.space`     |
| Profiles, spaces, invites, messages | Supabase Postgres, same project                               | Row-level security: only the two members can read a space          |
| Live updates                        | Supabase Realtime                                             | Streams new messages to the open chat; applies the same read rules |

Not end-to-end encrypted: data is encrypted in transit (HTTPS) and at rest by the provider, and the project owner can read it in the Supabase dashboard. The Privacy page must say so (stage 7).

## How a message travels

1. Phone A calls `send_message` (HTTPS → Supabase API → Postgres) with a device-chosen id.
2. Postgres checks membership, space open, length, flood limit; saves the row with server time; returns it. Only now does A show "Sent".
3. Supabase Realtime sees the new row, checks B may read it, and pushes it over B's websocket. B's screen adds it.
4. If B wasn't connected, B loads it from history next time (or within 5 s via the fallback check).

## Free-plan limits that matter

| Limit                                        | Free                                       | Roughly means for SLIDE                                                                 | When exceeded                                                                                                                                                           |
| -------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase database size                       | 500 MB quota (2 GB disk)                   | ~1 million+ text messages (est. 300–400 bytes each incl. indexes)                       | Disk at 95% → database read-only: sending fails ("Not sent", nothing lost silently), reading still works. Org over quota on average → API may answer 402 until upgrade. |
| Realtime concurrent connections              | ~200                                       | ~200 open chats at once (~100 couples chatting simultaneously)                          | New live connections refused → app falls back to checking every 5 s; messages still arrive                                                                              |
| Realtime messages                            | ~2 M / month                               | Each message delivered live counts                                                      | Over → live updates may be limited; fallback still works                                                                                                                |
| Auth monthly active users                    | 50,000                                     | Plenty for beta                                                                         | —                                                                                                                                                                       |
| Egress                                       | 5 GB uncached + 5 GB cached / month        | History pages are small (~15 KB per 50 messages)                                        | Fair-use restriction                                                                                                                                                    |
| **Inactivity pause**                         | Paused after 7 days with no activity       | If nobody uses SLIDE for a week, the site stops working until restored in the dashboard | Restore from Supabase dashboard; Pro never pauses                                                                                                                       |
| Backups                                      | None you can restore yourself              | —                                                                                       | Pro: daily backups, 7 days                                                                                                                                              |
| Resend emails                                | 100/day, 3,000/month                       | ~100 sign-ins per day                                                                   | Codes stop sending until the next UTC day/month                                                                                                                         |
| Supabase Auth email rate limit (custom SMTP) | Adjustable in Authentication → Rate Limits | Check it's ≥ expected sign-ins/hour                                                     | "Too many attempts" message                                                                                                                                             |

## When to upgrade

- **Private beta (5–20 pairs):** free plans are fine. Watch Supabase → Usage and Resend → Usage weekly.
- **Before a public launch:** Supabase Pro ($25/month: 8 GB database, no pausing, daily backups, 500 realtime connections) and a paid Resend plan if sign-ins exceed ~100/day. Keep Supabase's spend cap on to avoid surprise bills.

Sources: Supabase docs "Understanding Database and Disk Size"; Jet Admin "Supabase Pricing 2026" (checked against Supabase pricing 2026-07-16); Resend docs "Email quota".

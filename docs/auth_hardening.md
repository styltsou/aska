# Auth hardening

Follow-ups from the email-verification, Google-linking and password-reset work.
Done items are listed for context; the open items are what to do next.

## Done

- Email verification required for email+password accounts (no session until the
  link is clicked; unverified sign-in re-sends the link).
- Google links automatically only into an account whose email is verified
  (`requireLocalEmailVerified` stays at its default `true`; no
  `trustedProviders`).
- Forgot / reset password flow, with standalone pages and route guards.
- Password reset revokes all other sessions (`revokeSessionsOnPasswordReset`).
- Rate limiting stored in Postgres (`rate_limit` table, `rateLimit.storage:
  "database"`), with a stricter 3 requests per 60s on
  `/send-verification-email` and `/request-password-reset`.

## Open

### 1. Pre-hijacking via an attacker-created account (medium)

An attacker signs up with a victim's email and a password they choose. The
victim receives a real verification email and clicks it, so the email becomes
verified on the attacker's account. A later "Continue with Google" by the victim
links to that account, and the attacker's password still works.

Options:

- When a Google account is linked into a credential account, clear the password
  (`account` row with `providerId = "credential"`) and revoke its sessions, if
  the credential account was created before the email was verified.
- Or require the password to be (re)set by the verifier before the first
  sign-in.

Implement through Better Auth `databaseHooks` (`account.create.after`) or in the
verification callback.

### 2. Existing sessions of unverified password users stay valid (low)

`requireEmailVerification` only blocks new sign-ins. Sessions created before the
change (for example, the owner's own account) keep working. One-off fix: revoke
sessions for users with `email_verified = false` and a credential account.

### 3. Tests for the auth flows (medium)

No automated coverage yet. Add:

- Route guards: signed-in users are redirected away from `/login`, `/signup`,
  `/forgot-password`, `/reset-password`, `/verify-email`; `/verify-email` with no
  params goes to `/login`; `/reset-password` with no token or error goes to
  `/forgot-password`.
- Server (integration): unverified sign-in returns `EMAIL_NOT_VERIFIED` and
  sends a mail; Google link is refused for an unverified credential account and
  allowed after verification; reset revokes sessions; rate limits trigger.

### 4. Error mapping on `/login` (low)

`google-sign-in.tsx` shows "Google sign-in could not be completed" for any
unrecognised `?error=` value, including non-Google ones. Map known codes
(`token_expired`, `invalid_token`, `account_not_linked`) explicitly and show a
neutral message otherwise.

### 5. Email deliverability (verify before launch)

Confirm the sending domain has SPF, DKIM and DMARC. Without them, verification
and reset mails are likely to land in spam.

### 6. Verify the client IP used for rate limits (check after deploy)

Limits are keyed by IP. Confirm Better Auth reads the real client IP behind
CloudFront / API Gateway (`advanced.ipAddress.ipAddressHeaders`, default
`x-forwarded-for`). If it reads the wrong value, all users share one limit
(or none). Check after deploy: hit a limited endpoint (for example
`/request-password-reset`, 3 per 60s) from two different networks and confirm
one does not trip the other's limit, and look at the stored `rate_limit.key`
values in Postgres to see which IP is recorded.

### 7. Move rate limiting to Redis (planned)

Counters live in Postgres for now (one small write per rate-limited auth
request, no new infrastructure). We want to move them to Redis: for example
Upstash, which works from Lambda without a VPC. Supply a Better Auth
`secondaryStorage` backed by Redis and set `rateLimit.storage` to
`"secondary-storage"`. Once done, drop the `rate_limit` table with a
migration.

### 8. Nice to have

- 2FA or passkeys for sensitive accounts.
- Notify the user by email when their password is changed or reset.
- Referrer-Policy on auth pages so reset tokens in the URL are never leaked.

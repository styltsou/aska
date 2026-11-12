# Auth hardening

Work that is **not yet done** for authentication. How the flows work today is in
[Authentication](./authentication.md). Delete an item when it ships.

## Tests for the auth flows (medium)

No automated coverage yet. Add:

- Route guards: signed-in users are redirected away from `/login`, `/signup`,
  `/forgot-password`, `/reset-password`, `/verify-email`; `/verify-email` with no
  `email` goes to `/login`; `/reset-password` with no `email` goes to
  `/forgot-password`.
- Server (integration): linking Google into an unverified credential account
  deletes its password and sessions, and into a verified one keeps them;
  unverified sign-in returns `EMAIL_NOT_VERIFIED` and mails a code; a reset
  revokes sessions; a code dies after 3 wrong guesses; sign-in OTP is not
  deliverable; the email rate limits trigger.

## Error mapping on `/login` (low)

`google-sign-in.tsx` shows "Google sign-in could not be completed" for any
unrecognised `?error=` value, including non-Google ones. Map known codes
(`account_not_linked`, access denied) explicitly and show a
neutral message otherwise.

## Hint for password sign-in after a Google link (low)

A user whose unverified account was linked through Google loses its password and
then sees only "Invalid email or password". A safe hint can be shown under every
failed sign-in (it reveals nothing): "Signed up with Google? Use Continue with
Google, or reset your password." Skipped while there are very few users.

## Email deliverability (verify before launch)

Confirm the sending domain has SPF, DKIM and DMARC. Without them, verification
and reset mails are likely to land in spam.

## Verify the client IP used for rate limits (check after deploy)

Limits are keyed by IP. Confirm Better Auth reads the real client IP behind
CloudFront / API Gateway (`advanced.ipAddress.ipAddressHeaders`, default
`x-forwarded-for`). If it reads the wrong value, all users share one limit (or
none). Check after deploy: hit a limited endpoint (for example
`/email-otp/request-password-reset`, 3 per 60s) from two different networks and confirm one
does not trip the other's limit, and look at the stored `rate_limit.key` values in
Postgres to see which IP is recorded.

## Move rate limiting to Redis (planned)

Counters live in Postgres for now (one small write per rate-limited auth request,
no new infrastructure). We want to move them to Redis, for example Upstash, which
works from Lambda without a VPC. Supply a Better Auth `secondaryStorage` backed by
Redis and set `rateLimit.storage` to `"secondary-storage"`. Once done, drop the
`rate_limit` table with a migration.

## Nice to have

- 2FA or passkeys for sensitive accounts.
- Notify the user by email when their password is changed or reset.

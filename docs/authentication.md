# Authentication

Mnemee uses [Better Auth](https://better-auth.com) on the server
(`apps/server/src/lib/auth.ts`) and its React client on the web app
(`apps/web/src/lib/auth-client.ts`). Sign-in methods are email + password and
Google. The server owns every decision; the web app only reads error codes and
the session.

## Source of truth

- **Who is signed in:** the server session (cookie). The web app reads it with
  `getSession` through `apps/web/src/lib/auth-flow.ts`.
- **Whether an email is verified:** `user.email_verified` in Postgres.
- **Responses:** a sign-in or sign-up response never implies a session on its
  own. Sign-up with verification required returns `token: null`, and an
  unverified sign-in returns HTTP 403 with code `EMAIL_NOT_VERIFIED`. The client
  branches on those, never on its own state.

## Flows

### Sign up (email + password)

1. `/signup` calls `signUp.email` with an absolute `callbackURL` of `/login`.
2. The server creates the account, sends the verification link, and returns no
   session (`requireEmailVerification: true`).
3. The web app goes to `/verify-email?email=…` ("Check your email", with a
   resend button and a 30s cooldown).
4. Opening the link verifies the email and signs the user in
   (`autoSignInAfterVerification`), then redirects to `/login`, whose guard sends
   them on to onboarding or their workspace.

### Sign in (email + password)

- Correct password and verified email: session created, the user is sent to their
  destination.
- Correct password, **unverified** email: no session. The server sends a fresh
  verification link (`sendOnSignIn`) and returns `EMAIL_NOT_VERIFIED`; the web
  app goes to `/verify-email?email=…`.
- Wrong password, unknown email, or an account with no password: the same generic
  "Invalid email or password" error, so nothing leaks about which accounts exist.

### Google

- **New email:** an account is created and the user is signed in. Google's email
  counts as verified.
- **Existing verified account with that email:** Google is linked automatically
  and the user is signed in (`accountLinking.enabled`). The password, if any,
  keeps working.
- **Existing account that was never verified:** Google is linked and the user is
  signed in, but the account's password and sessions are deleted first
  (`discardUnverifiedLocalCredentials`, a `databaseHooks.account.create.before`
  hook). This is the standard pre-hijacking defence: someone may have registered
  the address with a password before its real owner, and Google has now proven
  who owns it. The user can set a password again through "Forgot password?".
- Linking requires Google to report a verified email; `requireLocalEmailVerified`
  is `false` because of the hook above, and there is no `trustedProviders`.
- A failed Google flow returns to `/login?error=…`. `GoogleSignIn` shows a short
  message under the button.

### Forgot and reset password

1. "Forgot password?" (right-aligned on the Password label row of `/login`) goes
   to `/forgot-password`, which calls `requestPasswordReset` and always says "If
   an account exists…".
2. The emailed link (valid 1 hour) opens `/reset-password?token=…`. The page sets
   the new password, then goes to `/login`.
3. A reset revokes all existing sessions (`revokeSessionsOnPasswordReset`). If the
   account had no password (Google-only), the reset creates one.
4. An invalid or expired link shows "Link expired" with a button to request a new
   one.

## Web routes and guards

| Route              | Reachable when                              | Otherwise                       |
| ------------------ | ------------------------------------------- | ------------------------------- |
| `/login`           | signed out                                  | signed in → their destination   |
| `/signup`          | signed out                                  | signed in → their destination   |
| `/forgot-password` | signed out                                  | signed in → their destination   |
| `/reset-password`  | signed out, URL has `token` or `error`      | no params → `/forgot-password`  |
| `/verify-email`    | signed out, URL has `email`                 | no email → `/login`             |

- Guards run in each route's `beforeLoad`, before any component mounts, using
  `redirectIfSignedIn` from `auth-flow.ts`.
- `/login` and `/signup` use the two-column `AuthPageLayout`. The secondary
  pages (`/verify-email`, `/forgot-password`, `/reset-password`) use the
  standalone `CenteredAuthLayout`, like onboarding.
- Every one of these routes must be listed in `SHELLLESS_ROUTE_IDS`
  (`apps/web/src/lib/root-shell.ts`) so the workspace app shell never renders
  around them. A new auth page needs an entry there and in its test.
- The five routes set `pendingMs: 0` and `pendingComponent: AuthPending`, so a
  guard that has to wait for the session shows a centered full-page spinner
  immediately instead of a blank page.

## Server configuration

| Setting                                           | Why                                                      |
| ------------------------------------------------- | -------------------------------------------------------- |
| `emailAndPassword.requireEmailVerification`       | no session until the email link is opened                |
| `emailVerification.sendOnSignUp` / `sendOnSignIn` | link on signup and on every unverified sign-in           |
| `emailVerification.autoSignInAfterVerification`   | opening the link signs the user in                       |
| `emailAndPassword.sendResetPassword`              | reset email through `sendEmail`                          |
| `emailAndPassword.revokeSessionsOnPasswordReset`  | a reset signs out everywhere                             |
| `account.accountLinking`                          | automatic linking as described above                     |
| `rateLimit.storage: "database"`                   | counters in the `rate_limit` table; Lambda has no shared memory |
| `rateLimit.customRules`                           | 3 requests per 60s on the two email-sending endpoints    |

Callback and redirect URLs sent from the web app are always absolute, and must
belong to `BETTER_AUTH_URL` or `CORS_ORIGINS` (trusted origins).

## Changing auth

- Add a page: create the route with the guard, `pendingComponent`/`pendingMs`, and
  the right layout; add it to `SHELLLESS_ROUTE_IDS` and `root-shell.test.ts`.
- Add a server option or hook: keep it in `auth.ts` and document it here.
- Open follow-ups live in [Auth hardening](./auth_hardening.md).

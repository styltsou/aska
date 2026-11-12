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

1. `/signup` calls `signUp.email`.
2. The server creates the account, mails a 6-digit code, and returns no session
   (`requireEmailVerification: true`).
3. The web app goes to `/verify-email?email=…`: a code input (shadcn
   `InputOTP`) that submits when the sixth digit is typed, plus "Resend code"
   with a 30s cooldown.
4. A correct code verifies the email and signs the user in
   (`autoSignInAfterVerification`) on the device that entered it, then the page
   goes to `/login`, whose guard sends them on to onboarding or their workspace.
   The code works from any device, so opening the email on a phone is fine.

### Sign in (email + password)

- Correct password and verified email: session created, the user is sent to their
  destination.
- Correct password, **unverified** email: no session. The server mails a fresh
  code (`sendOnSignIn`) and returns `EMAIL_NOT_VERIFIED`; the web
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

1. "Forgot password?" (right-aligned under the password input on `/login`) goes to
   `/forgot-password`, which calls `emailOtp.requestPasswordReset` and always
   continues to `/reset-password?email=…`, whether or not the account exists.
2. `/reset-password` takes the 6-digit code plus the new password and calls
   `emailOtp.resetPassword`, then goes to `/login`. Its copy says "If an account
   exists…" so nothing leaks.
3. A reset revokes all existing sessions (`revokeSessionsOnPasswordReset`), marks
   the email verified, and, if the account had no password (Google-only), creates
   one.
4. A wrong, expired or used-up code shows the server's message; "Resend code" sends
   a new one.

### Codes (email OTP)

Verification and reset use the Better Auth `emailOTP` plugin, not links. Codes are
6 digits, valid 10 minutes, stored hashed, and invalidated after 3 wrong guesses.
Sign-in and change-email codes are never delivered and `disableSignUp` is on, so
the plugin's routes cannot be used as a passwordless login or to create accounts.

## Web routes and guards

| Route              | Reachable when                              | Otherwise                       |
| ------------------ | ------------------------------------------- | ------------------------------- |
| `/login`           | signed out                                  | signed in → their destination   |
| `/signup`          | signed out                                  | signed in → their destination   |
| `/forgot-password` | signed out                                  | signed in → their destination   |
| `/reset-password`  | signed out, URL has `email`                 | no email → `/forgot-password`   |
| `/verify-email`    | signed out, URL has `email`                 | no email → `/login`             |

- Guards run in each route's `beforeLoad`, before any component mounts, using
  `redirectIfSignedIn` from `auth-flow.ts`.
- `/login`, `/signup`, `/forgot-password` and `/reset-password` use the
  two-column `AuthPageLayout` (form plus canvas mockup). `/verify-email` uses the
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
| `emailVerification.sendOnSignUp` / `sendOnSignIn` | code on signup and on every unverified sign-in           |
| `emailVerification.autoSignInAfterVerification`   | a correct code signs the user in                         |
| `emailOTP` plugin                                 | codes for verification and reset, mailed via `sendEmail` |
| `emailAndPassword.revokeSessionsOnPasswordReset`  | a reset signs out everywhere                             |
| `account.accountLinking`                          | automatic linking as described above                     |
| `rateLimit.storage: "database"`                   | counters in the `rate_limit` table; Lambda has no shared memory |
| `rateLimit.customRules` + plugin rules            | 3 requests per 60s on every email and code endpoint      |

Callback and redirect URLs sent from the web app are always absolute, and must
belong to `BETTER_AUTH_URL` or `CORS_ORIGINS` (trusted origins).

## Changing auth

- Add a page: create the route with the guard, `pendingComponent`/`pendingMs`, and
  the right layout; add it to `SHELLLESS_ROUTE_IDS` and `root-shell.test.ts`.
- Add a server option or hook: keep it in `auth.ts` and document it here.
- Open follow-ups live in [Auth hardening](./auth_hardening.md).

## Transactional emails

Templates are React Email components in `apps/server/src/emails/`: a shared
`EmailLayout` (logo, white card, footer), a `CodeEmail` body, and one file per
template (`verification-code.tsx`, `reset-password-code.tsx`). `buildOtpEmail`
(`otp-emails.tsx`) maps an OTP type to its subject and component; `sendEmail`
(`lib/email.ts`) renders HTML plus a plain-text part and sends through Resend.

- Preview and edit live with `bun run --cwd apps/server email:dev`
  (http://localhost:3010).
- These files use React, not the server's default Hono JSX, so each starts with
  `/** @jsxImportSource react */`.
- The logo is a PNG at `apps/website/public/email/mnemee-logo.png`, served at
  `https://mnemee.space/email/mnemee-logo.png` (email clients block SVG). It ships
  with the website deploy, which is separate from the app's; deploy the website
  before relying on a new or moved logo.
- Colours are inline and light-only on purpose: clients recolour dark-mode emails
  unpredictably.

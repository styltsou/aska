# Auth mock

A dev-only stand-in for the auth API, so every auth view (sign in, sign up,
verify email, forgot and reset password, onboarding) can be walked through
without a real account or a running server. Use it for UI work and for
checking the auth panel's animation.

```bash
bun run --cwd apps/web dev:auth-mock
```

This starts Vite with `VITE_AUTH_MOCK=true`. The mock intercepts `fetch` calls
to the Better Auth base URL and answers from state kept in `localStorage`
(`mnemee:auth-mock:v1`). Requests to the server's other endpoints are refused,
so nothing reaches a real backend. It is compiled out of production builds.

A small **Auth mock** button at the bottom right opens a toolbar with links to
every view, a sign-out/reset control, a switch for what a new sign-in finds (no
workspace → onboarding, or one workspace), and the network delay.

## Happy path

- Any email and password signs in.
- Sign up with any email, then enter any 6-digit code to verify.
- Forgot password: any email, any 6-digit code, any new password.
- Onboarding: any workspace name. The app then navigates to the workspace
  route, which needs the real API, so that final screen will show an error.

## Triggering the unhappy paths

| Input | Result |
| --- | --- |
| password `wrong` on sign in | invalid email or password |
| email containing `unverified` on sign in | sent to the verify-email view |
| email containing `taken` on sign up | user already exists |
| code `000000` | invalid code |
| code `999999` | valid, but expires at the final reset step |

## Files

- `mock-server.ts`: the in-memory API and its persisted state.
- `toolbar.tsx`: the floating toolbar.
- `index.ts`: `installAuthMock(router)`, called from `src/main.tsx`.

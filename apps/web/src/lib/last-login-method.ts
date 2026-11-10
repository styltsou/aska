const LAST_LOGIN_METHOD_KEY = "mnemee:last-login-method";
const GOOGLE_SIGN_IN_ATTEMPT_KEY = "mnemee:google-sign-in-attempt";

export function wasGoogleLastUsed() {
  try {
    return window.localStorage.getItem(LAST_LOGIN_METHOD_KEY) === "google";
  } catch {
    return false;
  }
}

export function clearLastLoginMethod() {
  try {
    window.localStorage.removeItem(LAST_LOGIN_METHOD_KEY);
  } catch {
    // Remembering the login method must never prevent sign-in.
  }
}

export function beginGoogleSignIn() {
  try {
    window.sessionStorage.setItem(GOOGLE_SIGN_IN_ATTEMPT_KEY, "1");
  } catch {
    // OAuth still works when browser storage is unavailable.
  }
}

export function clearGoogleSignInAttempt() {
  try {
    window.sessionStorage.removeItem(GOOGLE_SIGN_IN_ATTEMPT_KEY);
  } catch {
    // OAuth still works when browser storage is unavailable.
  }
}

export function completeGoogleSignIn(signedIn: boolean) {
  try {
    const attempted =
      window.sessionStorage.getItem(GOOGLE_SIGN_IN_ATTEMPT_KEY) === "1";
    window.sessionStorage.removeItem(GOOGLE_SIGN_IN_ATTEMPT_KEY);
    if (attempted && signedIn) {
      window.localStorage.setItem(LAST_LOGIN_METHOD_KEY, "google");
    }
  } catch {
    // Remembering the login method must never prevent sign-in.
  }
}

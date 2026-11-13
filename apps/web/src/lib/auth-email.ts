import { useCallback, useState } from "react";

/**
 * The email typed on any auth view, kept in memory so the next view's email
 * field starts filled (login -> signup -> forgot password and back). It is
 * deliberately not persisted: a reload or a closed tab forgets it.
 */
let currentEmail = "";

export function getAuthEmail() {
  return currentEmail;
}

export function setAuthEmail(email: string) {
  currentEmail = email;
}

/** `useState` for the shared auth email; initial value is the last one typed. */
export function useAuthEmail() {
  const [email, setLocalEmail] = useState(getAuthEmail);
  const update = useCallback((next: string) => {
    setAuthEmail(next);
    setLocalEmail(next);
  }, []);
  return [email, update] as const;
}

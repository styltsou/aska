import { AnimatePresence } from "motion/react";
import { PasswordStrength } from "./password-strength";

export function PasswordStrengthFeedback({
  password,
  email,
  expanded,
}: {
  password: string;
  email: string;
  expanded: boolean;
}) {
  return (
    <AnimatePresence>
      {password ? (
        <PasswordStrength
          key="strength"
          password={password}
          email={email}
          expanded={expanded}
        />
      ) : null}
    </AnimatePresence>
  );
}

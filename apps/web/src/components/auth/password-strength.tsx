import {
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  XIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import zxcvbn from "zxcvbn";

const labels = ["Very weak", "Weak", "Medium", "Good", "Strong"] as const;
const colors = [
  "bg-red-500",
  "bg-red-500",
  "bg-amber-500",
  "bg-emerald-600",
  "bg-emerald-600",
] as const;
const easeOut = [0.23, 1, 0.32, 1] as const;

export function PasswordStrength({
  password,
  email,
  expanded,
}: {
  password: string;
  email: string;
  expanded: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const result = zxcvbn(password, [email, email.split("@")[0] ?? ""]);
  const hasUppercase = /\p{Lu}/u.test(password);
  const score =
    password.length < 8 ? 0 : Math.min(result.score, hasUppercase ? 4 : 2);
  const filledSegments = score + 1;
  const checks = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Add an uppercase letter (optional)", met: hasUppercase },
    {
      label: "Add a special character (optional)",
      met: /[^\p{L}\p{N}\s]/u.test(password),
    },
  ];

  return (
    <motion.div
      id="password-feedback"
      initial={false}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.22, ease: easeOut }}
      className="overflow-hidden"
    >
      <div className="relative pt-2">
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-2 bottom-0 rounded-lg bg-muted"
          initial={
            reduceMotion
              ? false
              : { opacity: 0, clipPath: "inset(0 28% 0 0 round 8px)" }
          }
          animate={{
            opacity: expanded ? 1 : 0,
            clipPath: expanded
              ? "inset(0 0 0 0 round 8px)"
              : "inset(0 28% 0 0 round 8px)",
          }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: easeOut }}
        />
        <div className={`relative ${expanded ? "p-3" : "py-1"}`}>
          <span className="sr-only">Password strength: {labels[score]}.</span>
          <AnimatePresence>
            {expanded ? (
              <motion.div
                key="details"
                initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.22,
                  ease: easeOut,
                }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-1.5 pb-2 text-xs font-semibold text-foreground">
                  {score < 3 ? (
                    <CircleAlertIcon
                      aria-hidden="true"
                      className="size-3.5 fill-current text-foreground [&_path]:stroke-background"
                    />
                  ) : (
                    <CircleCheckIcon
                      aria-hidden="true"
                      className="size-3.5 fill-current text-foreground [&_path]:stroke-background"
                    />
                  )}
                  <span>{labels[score]}</span>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <motion.div
            className="flex gap-1"
            aria-hidden="true"
            style={{ transformOrigin: "top left" }}
            initial={reduceMotion ? false : { scaleX: 0.72 }}
            animate={{ scaleX: expanded ? 1 : 0.72 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: easeOut }}
          >
            {[1, 2, 3, 4, 5].map((segment) => (
              <span
                key={segment}
                className="relative h-1 flex-1 overflow-hidden rounded-full bg-border"
              >
                <motion.span
                  className={`absolute inset-0 rounded-full transition-colors duration-150 motion-reduce:transition-none ${colors[score]}`}
                  style={{ transformOrigin: "left center" }}
                  initial={reduceMotion ? false : { scaleX: 0 }}
                  animate={{
                    scaleX: segment <= filledSegments ? 1 : 0,
                  }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.18,
                    ease: easeOut,
                  }}
                />
              </span>
            ))}
          </motion.div>
          <AnimatePresence>
            {expanded ? (
              <motion.div
                key="checklist"
                initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.22,
                  ease: easeOut,
                }}
                className="overflow-hidden"
              >
                <ul className="space-y-1.5 pt-3 text-xs">
                  {checks.map(({ label, met }) => (
                    <li
                      key={label}
                      className={`flex items-center gap-2 transition-colors duration-150 motion-reduce:transition-none ${met ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      <span
                        className={`relative flex size-4 shrink-0 items-center justify-center transition-colors duration-150 motion-reduce:transition-none ${met ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
                        aria-hidden="true"
                      >
                        <CheckIcon
                          className={`absolute size-3 transition-opacity duration-150 motion-reduce:transition-none ${met ? "opacity-100" : "opacity-0"}`}
                        />
                        <XIcon
                          className={`absolute size-3 transition-opacity duration-150 motion-reduce:transition-none ${met ? "opacity-0" : "opacity-100"}`}
                        />
                      </span>
                      <span>
                        <span className="sr-only">
                          {met ? "Met: " : "Not met: "}
                        </span>
                        {label}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

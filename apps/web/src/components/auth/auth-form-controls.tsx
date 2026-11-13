import type { ComponentProps } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";

const easeOut = [0.23, 1, 0.32, 1] as const;

export function AuthActionButton(props: ComponentProps<typeof Button>) {
  return <Button className="h-10 w-full text-[13px]" {...props} />;
}

export function ResendCodeLabel({ seconds }: { seconds: number }) {
  if (seconds <= 0) return "Resend code";

  return (
    <>
      Resend code in{" "}
      <span className="inline-block min-w-[2ch] text-right font-mono tabular-nums">
        {seconds}
      </span>
      s
    </>
  );
}

export function AuthError({ message }: { message: string | null }) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.div
          key="error"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{
            height: 0,
            opacity: 0,
            transition: { duration: reduceMotion ? 0 : 0.09, ease: easeOut },
          }}
          transition={{ duration: reduceMotion ? 0 : 0.12, ease: easeOut }}
          className="overflow-hidden"
        >
          <p
            className="pt-2 text-xs leading-relaxed text-destructive"
            role="alert"
          >
            {message}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MousePointer2Icon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

function isVisible(element: HTMLElement) {
  return (
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== "hidden" &&
    !element.closest("[inert]")
  );
}

export function useOnboardingTarget(selector: string | null, enabled: boolean) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!selector || !enabled) return;
    const resolve = () => {
      const candidates = document.querySelectorAll<HTMLElement>(selector);
      const next = [...candidates].filter(isVisible).at(-1) ?? null;
      setTarget((current) => (current === next ? current : next));
    };
    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = window.setInterval(resolve, 350);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [enabled, selector]);

  useEffect(() => {
    if (!target || !enabled || !selector || !target.matches(selector)) return;
    target.setAttribute("data-onboarding-target", "");
    return () => target.removeAttribute("data-onboarding-target");
  }, [enabled, selector, target]);

  return enabled && selector && target?.matches(selector) ? target : null;
}

export function OnboardingCursor({
  target,
  gesture,
}: {
  target: HTMLElement;
  gesture: "click" | "drag";
}) {
  const reduceMotion = useReducedMotion();
  const click = gesture === "click";
  const nearRightEdge =
    target.getBoundingClientRect().right > window.innerWidth - 140;

  return createPortal(
    <motion.span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-50 flex w-max items-start gap-1 drop-shadow-lg",
        click ? "top-1/2" : "top-1/4",
        nearRightEdge ? "right-1/2 flex-row-reverse" : "left-1/2",
      )}
      initial={false}
      animate={
        reduceMotion
          ? { x: 0, y: 0, scale: 1 }
          : click
            ? { x: [36, 0, 0, 36], y: [26, 0, 0, 26], scale: [1, 1, 0.88, 1] }
            : { x: [0, 0, 70, 70, 0], y: [0, 0, 42, 42, 0], scale: 1 }
      }
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              duration: click ? 2.6 : 3.2,
              ease: "easeInOut",
              times: click ? [0, 0.3, 0.7, 1] : [0, 0.18, 0.6, 0.78, 1],
              repeat: Infinity,
            }
      }
    >
      <span className="relative inline-flex">
        {click && !reduceMotion ? (
          <motion.span
            className="absolute -top-1 -left-1 size-4 rounded-full border-2 border-primary"
            animate={{ opacity: [0, 0, 0.8, 0], scale: [0.5, 0.5, 1.7, 1.7] }}
            transition={{
              duration: 2.6,
              times: [0, 0.3, 0.65, 1],
              repeat: Infinity,
            }}
          />
        ) : null}
        <MousePointer2Icon
          className="size-6 -rotate-12 fill-white text-zinc-950"
          strokeWidth={2}
        />
      </span>
      <span className="mt-4 rounded-full border border-foreground/15 bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background shadow-md">
        {click ? "Click" : "Drag"}
      </span>
    </motion.span>,
    target,
  );
}

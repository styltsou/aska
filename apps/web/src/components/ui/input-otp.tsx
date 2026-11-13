import * as React from "react";
import { cn } from "@/lib/utils";
import { OTPInput, OTPInputContext } from "input-otp";
import { MinusIcon } from "lucide-react";

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string;
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "cn-input-otp flex items-center has-disabled:opacity-50",
        containerClassName,
      )}
      spellCheck={false}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn(
        "flex items-center rounded-lg has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

function InputOTPFocusRing({ invalid }: { invalid?: boolean }) {
  const context = React.useContext(OTPInputContext);
  const activeIndex = context?.slots.findIndex((slot) => slot.isActive) ?? -1;
  const ringRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const ring = ringRef.current;
    const container = ring?.parentElement;
    if (!ring || !container) return;

    const position = () => {
      const slot = container.querySelector<HTMLElement>(
        `[data-slot="input-otp-slot"][data-index="${activeIndex}"]`,
      );
      if (!slot) {
        ring.hidden = true;
        return;
      }

      const bounds = slot.getBoundingClientRect();
      const parentBounds = container.getBoundingClientRect();
      ring.style.width = `${bounds.width}px`;
      ring.style.height = `${bounds.height}px`;
      ring.style.transform = `translate(${bounds.left - parentBounds.left}px, ${bounds.top - parentBounds.top}px)`;
      ring.style.borderRadius = getComputedStyle(slot).borderRadius;
      ring.dataset.invalid = String(Boolean(invalid));
      ring.hidden = false;
      if (!ring.dataset.ready) {
        requestAnimationFrame(() => {
          ring.dataset.ready = "true";
        });
      }
    };

    position();
    const observer = new ResizeObserver(position);
    observer.observe(container);
    return () => observer.disconnect();
  }, [activeIndex, invalid]);

  return (
    <div
      ref={ringRef}
      aria-hidden="true"
      hidden
      className="pointer-events-none absolute top-0 left-0 z-10 border border-ring ring-3 ring-ring/50 data-[invalid=true]:border-destructive data-[invalid=true]:ring-destructive/20 data-[ready=true]:transition-[transform,width,height,border-radius] data-[ready=true]:duration-120 data-[ready=true]:ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none dark:data-[invalid=true]:ring-destructive/40"
    />
  );
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number;
}) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

  return (
    <div
      data-slot="input-otp-slot"
      data-index={index}
      data-active={isActive}
      className={cn(
        "relative flex size-8 items-center justify-center border-y border-r border-input text-sm outline-none first:rounded-l-lg first:border-l last:rounded-r-lg aria-invalid:border-destructive dark:bg-input/30",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
}

function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-separator"
      className="flex items-center [&_svg:not([class*='size-'])]:size-4"
      role="separator"
      {...props}
    >
      <MinusIcon />
    </div>
  );
}

export {
  InputOTP,
  InputOTPFocusRing,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
};

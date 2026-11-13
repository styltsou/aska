import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { AUTH_TILTED_PLANE } from "./auth-tilted-plane";
import { AuthSlot, authSlotStyle } from "./auth-slot";
import { AuthCanvasPreview } from "./canvas/auth-canvas-preview";

const DEFAULT_CAPTION = (
  <>
    Collect ideas and inspiration.
    <br />
    Keep it all on one canvas.
  </>
);

export function AuthPageLayout({
  children,
  caption,
  footer,
  anchorContent = false,
  back,
}: {
  children: ReactNode;
  caption?: ReactNode;
  footer?: ReactNode;
  anchorContent?: boolean;
  /** A back link/button, shown above the title without moving it. */
  back?: ReactNode;
}) {
  return (
    <main className="grid min-h-[100svh] grid-cols-[minmax(24rem,45fr)_minmax(0,55fr)] bg-background max-[48rem]:grid-cols-1">
      <section
        className="relative col-start-2 row-start-1 m-[1rem_1rem_1rem_0] min-h-[calc(100svh-2rem)] overflow-hidden rounded-[1.25rem] border border-border bg-[color-mix(in_oklch,var(--muted)_58%,var(--background))] max-[48rem]:hidden"
        aria-label="A preview of an Mnemee canvas"
        style={authSlotStyle("panel", "static")}
      >
        <div
          aria-hidden="true"
          className={`${AUTH_TILTED_PLANE} pointer-events-none absolute inset-[-18%] z-0 bg-[radial-gradient(color-mix(in_oklch,var(--foreground)_17%,transparent)_1px,transparent_1px)] bg-[size:24px_24px]`}
        />
        <AuthCanvasPreview />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[2] shadow-[inset_0_0_7rem_color-mix(in_oklch,var(--background)_54%,transparent)]"
        />
        <p className="absolute bottom-[clamp(1.5rem,4vw,3rem)] left-[clamp(1.5rem,4vw,3rem)] z-[3] max-w-[19rem] text-[clamp(1.125rem,1.5vw,1.375rem)] leading-[1.35] font-[550] tracking-[-0.025em] text-[color-mix(in_oklch,var(--foreground)_78%,transparent)]">
          {caption ?? DEFAULT_CAPTION}
        </p>
      </section>
      <section
        className={
          footer
            ? `relative col-start-1 row-start-1 grid min-h-[100svh] px-[clamp(1.5rem,4vw,5rem)] py-4 max-[48rem]:px-5 max-[48rem]:pt-6 max-[48rem]:pb-6 ${anchorContent ? "grid-rows-[clamp(7rem,16svh,11rem)_auto_minmax(3rem,1fr)]" : "grid-rows-[minmax(4rem,1fr)_auto_minmax(3rem,1fr)]"}`
            : anchorContent
              ? "relative col-start-1 row-start-1 grid min-h-[100svh] grid-rows-[clamp(7rem,16svh,11rem)_auto_minmax(3rem,1fr)] px-[clamp(1.5rem,4vw,5rem)] py-4 max-[48rem]:px-5 max-[48rem]:pt-6 max-[48rem]:pb-6"
              : "relative col-start-1 row-start-1 grid min-h-[100svh] content-center p-[clamp(1.5rem,4vw,5rem)] max-[48rem]:p-[5rem_1.25rem_2rem]"
        }
      >
        <a
          aria-label="Mnemee home"
          className="absolute top-[1rem] left-[1rem] cursor-pointer max-[48rem]:top-6 max-[48rem]:left-[max(1.25rem,calc((100%-23rem)/2))]"
          href="https://mnemee.space"
          style={authSlotStyle("logo", "static")}
        >
          <BrandLogo />
        </a>
        <div
          className={
            footer || anchorContent
              ? "relative row-start-2 w-[min(100%,23rem)] justify-self-center"
              : "relative w-[min(100%,23rem)] justify-self-center"
          }
        >
          {back ? (
            <AuthSlot name="back" className="absolute bottom-full left-0 mb-2">
              {back}
            </AuthSlot>
          ) : null}
          {children}
        </div>
        {footer ? (
          <div
            className="row-start-3 w-full self-end"
            style={authSlotStyle("footer", "static")}
          >
            {footer}
          </div>
        ) : null}
      </section>
    </main>
  );
}

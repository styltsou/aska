import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
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
}: {
  children: ReactNode;
  caption?: ReactNode;
}) {
  return (
    <main className="grid min-h-[100svh] grid-cols-2 bg-background max-[62rem]:grid-cols-1">
      <section
        className="relative col-start-2 row-start-1 m-[1rem_1rem_1rem_0] min-h-[calc(100svh-2rem)] overflow-hidden rounded-[1.25rem] border border-border bg-[color-mix(in_oklch,var(--muted)_58%,var(--background))] max-[62rem]:hidden"
        aria-label="A preview of an Aska canvas"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(color-mix(in_oklch,var(--foreground)_17%,transparent)_1px,transparent_1px)] bg-[size:24px_24px]"
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
      <section className="relative col-start-1 row-start-1 grid min-h-[100svh] content-center p-[clamp(2rem,5vw,5rem)] max-[62rem]:p-[5rem_1.25rem_2rem]">
        <BrandLogo className="absolute top-[1rem] left-[1rem] max-[62rem]:top-6 max-[62rem]:left-6" />
        <div className="w-[min(100%,23rem)] justify-self-center">
          {children}
        </div>
      </section>
    </main>
  );
}

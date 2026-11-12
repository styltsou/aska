import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";

/** Standalone single-column frame for the simple auth steps (verify email,
 * forgot / reset password, onboarding). It mirrors the form side of
 * `AuthPageLayout`: logo pinned top-left, content in the same 23rem column,
 * vertically centered, so these pages line up with sign-in and with each other
 * regardless of how tall their content is. */
export function CenteredAuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative grid min-h-svh content-center bg-background p-[clamp(2rem,5vw,5rem)] max-[62rem]:p-[5rem_1.25rem_2rem]">
      <a
        aria-label="Mnemee home"
        className="absolute top-[1rem] left-[1rem] cursor-pointer max-[62rem]:top-6 max-[62rem]:left-6"
        href="https://mnemee.space"
      >
        <BrandLogo />
      </a>
      <div className="w-[min(100%,23rem)] justify-self-center">{children}</div>
    </main>
  );
}

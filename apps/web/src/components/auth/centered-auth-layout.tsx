import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";

/** Standalone, single-column layout for secondary auth steps (verify email,
 * password reset). The logo is left-aligned with the content column. */
export function CenteredAuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <BrandLogo className="mb-8" />
        {children}
      </div>
    </main>
  );
}

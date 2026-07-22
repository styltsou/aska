import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type BrandLogoProps = Omit<ComponentProps<"img">, "alt" | "src">;

export function BrandLogo({ className, ...props }: BrandLogoProps) {
  return (
    <>
      <img
        alt="Aska"
        className={cn("h-8 w-auto dark:hidden", className)}
        src="/aska-logo.svg"
        {...props}
      />
      <img
        alt=""
        aria-hidden="true"
        className={cn("hidden h-8 w-auto dark:block", className)}
        src="/aska-logo-dark.svg"
        {...props}
      />
    </>
  );
}

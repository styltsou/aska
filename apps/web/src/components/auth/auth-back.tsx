import { ArrowLeftIcon } from "lucide-react";

/**
 * Back control for auth steps. It is rendered by AuthPageLayout in a fixed
 * spot above the title, so the heading never shifts between views that do or
 * don't have one. Apply to a router `Link` or a `button`.
 */
export const authBackClassName =
  "-ml-1.5 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-sm text-muted-foreground transition-[color,transform] duration-150 ease-out hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.97]";

export function AuthBackLabel() {
  return (
    <>
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      Back
    </>
  );
}

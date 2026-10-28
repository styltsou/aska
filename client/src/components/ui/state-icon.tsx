import type { LucideIcon, LucideProps } from "lucide-react";

import { cn } from "@/lib/utils";

type StateIconProps = LucideProps & { icon: LucideIcon };

/** A restrained fade when a control switches between Lucide icons. */
export function StateIcon({ icon: Icon, className, ...props }: StateIconProps) {
  return (
    <Icon
      key={Icon.displayName}
      className={cn("motion-safe:animate-[icon-swap-in_150ms_ease-in-out]", className)}
      {...props}
    />
  );
}

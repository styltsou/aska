import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";

import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4.5 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-foreground/25 transition-[background,color,border-color,box-shadow] duration-100 ease-out outline-none hover:data-unchecked:bg-secondary group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-foreground/25 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary [--control-primary-top:#373737] [--control-primary-bottom:#171717] [--control-primary-edge:#0e0e0e] [--control-primary-foreground:#fafafa] data-checked:border-(--control-primary-edge) data-checked:bg-linear-to-b data-checked:from-(--control-primary-top) data-checked:to-(--control-primary-bottom) data-checked:text-(--control-primary-foreground) data-checked:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.12),0_1px_2px_rgb(0_0_0_/_0.12)] active:data-checked:shadow-[inset_0_1px_1px_rgb(0_0_0_/_0.12)] group-has-[:focus-visible]/field-label:data-checked:border-(--control-primary-edge) dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 dark:[--control-primary-top:#ffffff] dark:[--control-primary-bottom:#e5e5e5] dark:[--control-primary-edge:#c9c9c9] dark:[--control-primary-foreground:#171717] dark:data-checked:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.10),0_1px_2px_rgb(0_0_0_/_0.20)] dark:active:data-checked:shadow-[inset_0_1px_1px_rgb(0_0_0_/_0.20)]",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };

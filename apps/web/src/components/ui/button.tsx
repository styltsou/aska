import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 touch-manipulation items-center justify-center rounded-lg border text-sm font-medium whitespace-nowrap outline-none select-none transition-[background,color,border-color,box-shadow] duration-100 ease-out motion-reduce:transition-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "[--control-primary-top:#373737] [--control-primary-bottom:#171717] [--control-primary-hover-top:#4a4a4a] [--control-primary-hover-bottom:#202020] [--control-primary-edge:#0e0e0e] [--control-primary-foreground:#fafafa] border-(--control-primary-edge) bg-linear-to-b from-(--control-primary-top) to-(--control-primary-bottom) font-semibold text-(--control-primary-foreground) shadow-[inset_0_1px_0_rgb(255_255_255_/_0.12),0_1px_2px_rgb(0_0_0_/_0.12)] hover:from-(--control-primary-hover-top) hover:to-(--control-primary-hover-bottom) active:not-disabled:shadow-[inset_0_1px_1px_rgb(0_0_0_/_0.12)] dark:[--control-primary-top:#ffffff] dark:[--control-primary-bottom:#e5e5e5] dark:[--control-primary-hover-top:#ffffff] dark:[--control-primary-hover-bottom:#eeeeee] dark:[--control-primary-edge:#c9c9c9] dark:[--control-primary-foreground:#171717] dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.10),0_1px_2px_rgb(0_0_0_/_0.20)] dark:active:not-disabled:shadow-[inset_0_1px_1px_rgb(0_0_0_/_0.20)]",
        outline:
          "[--control-outline-surface:oklch(1_0_0)] [--control-outline-hover:oklch(0.975_0_0)] [--control-outline-edge:oklch(0.9_0_0)] [--control-surface:var(--control-outline-surface)] [--control-surface-hover:var(--control-outline-hover)] border-(--control-outline-edge) bg-(--control-surface) text-foreground shadow-[0_1px_2px_rgb(0_0_0_/_0.06)] hover:bg-(--control-surface-hover) aria-expanded:bg-(--control-surface-hover) active:not-disabled:bg-(--control-surface-hover) active:not-disabled:shadow-[inset_0_1px_1px_rgb(0_0_0_/_0.06)] dark:[--control-outline-surface:oklch(0.19_0_0)] dark:[--control-outline-hover:oklch(0.225_0_0)] dark:[--control-outline-edge:oklch(1_0_0_/_12%)] dark:shadow-[0_1px_2px_rgb(0_0_0_/_0.14)] dark:active:not-disabled:shadow-[inset_0_1px_1px_rgb(0_0_0_/_0.12)]",
        secondary:
          "[--control-secondary-surface:oklch(0.97_0_0)] [--control-secondary-hover:oklch(0.95_0_0)] [--control-secondary-edge:oklch(0.88_0_0)] [--control-surface:var(--control-secondary-surface)] [--control-surface-hover:var(--control-secondary-hover)] border-(--control-secondary-edge) bg-(--control-surface) text-foreground shadow-[0_1px_1px_rgb(0_0_0_/_0.04)] hover:bg-(--control-surface-hover) aria-expanded:bg-(--control-surface-hover) active:not-disabled:bg-(--control-surface-hover) active:not-disabled:shadow-[inset_0_1px_1px_rgb(0_0_0_/_0.06)] dark:[--control-secondary-surface:oklch(0.255_0_0)] dark:[--control-secondary-hover:oklch(0.275_0_0)] dark:[--control-secondary-edge:oklch(1_0_0_/_14%)] dark:shadow-[0_1px_1px_rgb(0_0_0_/_0.10)] dark:active:not-disabled:shadow-[inset_0_1px_1px_rgb(0_0_0_/_0.12)]",
        ghost:
          "border-transparent text-foreground hover:bg-secondary hover:text-foreground active:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-foreground aria-pressed:bg-secondary aria-pressed:text-foreground data-popup-open:bg-secondary data-popup-open:text-foreground dark:hover:bg-secondary/50 dark:active:bg-secondary/40 dark:aria-pressed:bg-secondary/50",
        destructive:
          "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20 active:bg-destructive/25 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:active:bg-destructive/35 dark:focus-visible:ring-destructive/40",
        "destructive-primary":
          "border-[color-mix(in_oklch,var(--destructive)_84%,black)] bg-linear-to-b from-[color-mix(in_oklch,var(--destructive)_90%,white)] to-[color-mix(in_oklch,var(--destructive)_94%,black)] font-semibold text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.12),0_1px_2px_rgb(0_0_0_/_0.12)] hover:from-[color-mix(in_oklch,var(--destructive)_84%,white)] hover:to-[color-mix(in_oklch,var(--destructive)_98%,black)] active:not-disabled:shadow-[inset_0_1px_1px_rgb(0_0_0_/_0.12)] dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.10),0_1px_2px_rgb(0_0_0_/_0.20)] dark:active:not-disabled:shadow-[inset_0_1px_1px_rgb(0_0_0_/_0.20)]",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };

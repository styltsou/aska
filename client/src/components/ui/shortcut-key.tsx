import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

function ShortcutKey({
  className,
  ...props
}: React.ComponentProps<typeof Kbd>) {
  return (
    <Kbd
      variant="solid"
      className={cn(
        "h-[18px] min-w-[18px] px-1 text-[10px] leading-none text-muted-foreground [&_svg:not([class*='size-'])]:size-2.5",
        className,
      )}
      {...props}
    />
  );
}

export { ShortcutKey };

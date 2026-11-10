import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "border-input focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 relative flex items-center rounded-lg border bg-transparent transition-colors focus-within:ring-3",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(
        "placeholder:text-muted-foreground h-8 min-w-0 flex-1 rounded-lg bg-transparent px-2.5 py-1 text-base outline-none md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupAddon({
  className,
  align,
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn(
        "flex items-center",
        align === "end" && "pr-1.5",
        align === "start" && "pl-1.5",
        className,
      )}
      {...props}
    />
  );
}

export { InputGroup, InputGroupInput, InputGroupAddon };

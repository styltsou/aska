import {
  createContext,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import {
  motion,
  MotionConfig,
  useReducedMotion,
  type Transition,
} from "motion/react";

import { cn } from "@/lib/utils";

type TabsVariant = "segment" | "pill" | "underline";

const SPRING_TRANSITION: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 35,
  mass: 0.9,
};

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

type TabsContextValue = {
  current: string;
  variant: TabsVariant;
  layoutId: string;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) throw new Error("Tabs.* must be used inside <Tabs>");
  return context;
}

export function Tabs({
  value,
  defaultValue = "",
  onValueChange,
  variant = "segment",
  className,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: TabsVariant;
  className?: string;
  children: ReactNode;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const reduceMotion = useReducedMotion();
  const layoutId = useId();
  const current = value !== undefined ? value : internalValue;

  const contextValue = useMemo(
    () => ({ current, variant, layoutId }),
    [current, layoutId, variant],
  );

  return (
    <TabsPrimitive.Root
      value={current}
      onValueChange={(nextValue) => {
        if (typeof nextValue !== "string") return;
        if (value === undefined) setInternalValue(nextValue);
        onValueChange?.(nextValue);
      }}
    >
      <MotionConfig
        transition={reduceMotion ? { duration: 0 } : SPRING_TRANSITION}
      >
        <TabsContext.Provider value={contextValue}>
          <motion.div layoutRoot className={className}>
            {children}
          </motion.div>
        </TabsContext.Provider>
      </MotionConfig>
    </TabsPrimitive.Root>
  );
}

const listVariantClasses: Record<TabsVariant, string> = {
  segment:
    "gap-0.5 rounded-md border border-border/60 bg-muted p-0.5 shadow-[0_1px_1px_rgb(0_0_0_/_0.02)] ring-1 ring-foreground/[0.025] backdrop-blur-sm",
  pill: "inline-flex items-center gap-1 rounded-full bg-card p-1",
  underline: "inline-flex items-center gap-1 border-b border-border",
};

export function TabsList({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const { variant } = useTabsContext();
  return (
    <TabsPrimitive.List
      className={cn(listVariantClasses[variant], className)}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  );
}

const triggerRadiusClasses: Record<
  Exclude<TabsVariant, "underline">,
  string
> = {
  segment: "rounded-[calc(var(--radius-md)-2px)]",
  pill: "rounded-full",
};

const triggerBaseClasses =
  "relative isolate inline-flex min-w-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap px-2.5 text-sm font-medium outline-none [&_svg]:pointer-events-none [&_svg]:size-4";

const triggerInactiveClasses =
  "text-muted-foreground transition-colors duration-[50ms] hover:bg-foreground/[0.05] hover:text-foreground active:bg-foreground/[0.08] dark:hover:bg-foreground/[0.1] dark:active:bg-foreground/[0.14]";

export function TabsTrigger({
  value,
  disabled,
  className,
  children,
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { current, variant, layoutId } = useTabsContext();
  const active = current === value;

  if (variant === "underline") {
    return (
      <TabsPrimitive.Tab
        value={value}
        disabled={disabled}
        className={cn(
          triggerBaseClasses,
          "-mb-px border-b border-transparent pb-2 pt-1",
          active
            ? "text-foreground"
            : cn(triggerInactiveClasses, "hover:bg-transparent"),
          className,
        )}
      >
        <span className="relative z-10 flex items-center gap-1">
          {children}
        </span>
        {active ? (
          <motion.span
            aria-hidden="true"
            layoutId={layoutId}
            layout="position"
            className="absolute inset-x-0 -bottom-px z-0 h-0.5 bg-primary"
          />
        ) : null}
      </TabsPrimitive.Tab>
    );
  }

  return (
    <TabsPrimitive.Tab
      value={value}
      disabled={disabled}
      aria-selected={active}
      className={cn(
        triggerBaseClasses,
        triggerRadiusClasses[variant],
        active ? "text-foreground" : triggerInactiveClasses,
        className,
      )}
    >
      {active ? (
        <motion.span
          aria-hidden="true"
          layoutId={layoutId}
          layout="position"
          className={cn(
            "absolute inset-0 z-0 bg-gradient-to-b from-background to-background/85 shadow-[0_1px_2px_rgb(0_0_0_/_0.12),inset_0_1px_0_rgb(255_255_255_/_0.12)] ring-1 ring-foreground/[0.05]",
            triggerRadiusClasses[variant],
          )}
        />
      ) : null}
      <span className="relative z-10 flex items-center justify-center gap-1">
        {children}
      </span>
    </TabsPrimitive.Tab>
  );
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <TabsPrimitive.Panel
      keepMounted
      value={value}
      render={
        <motion.div
          initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.12, ease: EASE_OUT }}
        />
      }
      className={className}
    >
      {children}
    </TabsPrimitive.Panel>
  );
}

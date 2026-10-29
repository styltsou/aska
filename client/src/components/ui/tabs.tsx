import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type Transition,
} from "motion/react";

import { cn } from "@/lib/utils";

type TabsVariant = "segment" | "segment-contrast" | "pill" | "underline";
type TabsSize = "sm" | "md";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Thumb timing: a fixed transition both directions, nudged a touch faster
 * than the motion-token 250ms for dense editor-style toolbars (a step
 * toward --duration-quick, 150ms). The thumb tracks its trigger on resize
 * instantly; only real tab switches animate.
 */
const THUMB_TRANSITION: Transition = {
  duration: 0.18, // between --duration-fast (250ms) and --duration-quick (150ms)
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number], // --ease-smooth-out
};

type TabsContextValue = {
  current: string;
  variant: TabsVariant;
  size: TabsSize;
  transition?: Transition;
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
  size = "md",
  className,
  transition,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: TabsVariant;
  size?: TabsSize;
  className?: string;
  /** Pass to fix the thumb transition verbatim; disables velocity matching. */
  transition?: Transition;
  children: ReactNode;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const current = value !== undefined ? value : internalValue;

  const contextValue = useMemo(
    () => ({ current, variant, size, transition }),
    [current, variant, size, transition],
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
      <TabsContext.Provider value={contextValue}>
        <div className={className}>{children}</div>
      </TabsContext.Provider>
    </TabsPrimitive.Root>
  );
}

const listVariantClasses: Record<TabsVariant, string> = {
  segment:
    "relative gap-0.5 rounded-md border border-border/60 bg-muted p-0.5 shadow-[0_1px_1px_rgb(0_0_0_/_0.02)] ring-1 ring-foreground/[0.025] backdrop-blur-sm",
  "segment-contrast":
    "relative inline-flex items-center rounded-lg border border-border/70 bg-background/80 p-0.5",
  pill: "relative inline-flex items-center gap-1 rounded-full bg-card p-1",
  underline: "relative inline-flex items-center gap-1 border-b border-border",
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
      {/* Thumb renders before the triggers so its surface stays behind
          every trigger's label while painting above the list background. */}
      <TabsThumb />
      {children}
    </TabsPrimitive.List>
  );
}

const triggerRadiusClasses: Record<
  Exclude<TabsVariant, "underline">,
  string
> = {
  segment: "rounded-[calc(var(--radius-md)-2px)]",
  "segment-contrast": "rounded-md",
  pill: "rounded-full",
};

const triggerBaseClasses =
  "relative isolate inline-flex min-w-0 cursor-pointer items-center justify-center whitespace-nowrap font-medium outline-none [&_svg]:pointer-events-none";

const triggerSizeClasses: Record<TabsSize, string> = {
  sm: "px-2.5 py-1 text-xs gap-1",
  md: "px-2.5 text-sm gap-1.5",
};

const triggerIconSizeClasses: Record<TabsSize, string> = {
  sm: "[&_svg]:size-3",
  md: "[&_svg]:size-3.5",
};

const triggerInactiveClasses =
  "text-muted-foreground transition-colors duration-[50ms] hover:text-foreground";

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
  const { current, variant, size } = useTabsContext();
  const active = current === value;

  if (variant === "underline") {
    return (
      <TabsPrimitive.Tab
        value={value}
        disabled={disabled}
        data-tab-value={value}
        className={cn(
          triggerBaseClasses,
          triggerSizeClasses[size],
          triggerIconSizeClasses[size],
          "-mb-px border-b border-transparent pb-2 pt-1",
          active ? "text-foreground" : triggerInactiveClasses,
          className,
        )}
      >
        <span className="relative z-10 flex items-center gap-1">
          {children}
        </span>
      </TabsPrimitive.Tab>
    );
  }

  return (
    <TabsPrimitive.Tab
      value={value}
      disabled={disabled}
      aria-selected={active}
      data-tab-value={value}
      className={cn(
        triggerBaseClasses,
        triggerSizeClasses[size],
        triggerIconSizeClasses[size],
        triggerRadiusClasses[variant],
        active
          ? variant === "segment-contrast"
            ? "text-background"
            : "text-foreground"
          : triggerInactiveClasses,
        variant === "segment-contrast" && "font-normal",
        className,
      )}
    >
      <span className="relative z-10 flex items-center justify-center gap-1">
        {children}
      </span>
    </TabsPrimitive.Tab>
  );
}

type ThumbGeometry = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function measureThumbGeometry(
  list: HTMLElement,
  trigger: HTMLElement,
  variant: TabsVariant,
): ThumbGeometry {
  const listRect = list.getBoundingClientRect();
  const triggerRect = trigger.getBoundingClientRect();

  // Absolute positioning resolves offsets against the list's padding box,
  // so measure from that origin. getBoundingClientRect spans the border box
  // and would shift the thumb by the list border width, breaking the
  // gutters against adjacent triggers. Fractional values are kept — that
  // mirrors how an inset-0 thumb inside the trigger would render.
  const originLeft = listRect.left + list.clientLeft;
  const originTop = listRect.top + list.clientTop;

  if (variant === "underline") {
    // 2px bar pinned to the trigger's bottom edge, 1px below its border box.
    return {
      left: triggerRect.left - originLeft,
      top: triggerRect.bottom - originTop - 1,
      width: triggerRect.width,
      height: 2,
    };
  }

  return {
    left: triggerRect.left - originLeft,
    top: triggerRect.top - originTop,
    width: triggerRect.width,
    height: triggerRect.height,
  };
}

const thumbSurfaceClasses: Record<Exclude<TabsVariant, "underline">, string> = {
  segment:
    "bg-gradient-to-b from-background to-background/85 shadow-[0_1px_2px_rgb(0_0_0_/_0.12),inset_0_1px_0_rgb(255_255_255_/_0.12)] ring-1 ring-foreground/[0.05]",
  "segment-contrast": "bg-foreground shadow-sm",
  pill: "bg-gradient-to-b from-background to-background/85 shadow-[0_1px_2px_rgb(0_0_0_/_0.12),inset_0_1px_0_rgb(255_255_255_/_0.12)] ring-1 ring-foreground/[0.05]",
};

function TabsThumb() {
  const { current, variant, transition } = useTabsContext();
  const reduceMotion = useReducedMotion();
  const thumbRef = useRef<HTMLDivElement>(null);
  const prevGeometry = useRef<ThumbGeometry | null>(null);
  // Read inside the ResizeObserver effect without re-creating the observer
  // on every tab switch (its initial callback would snap the fresh thumb).
  const currentRef = useRef(current);
  currentRef.current = current;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const width = useMotionValue(0);
  const height = useMotionValue(0);

  useLayoutEffect(() => {
    const thumb = thumbRef.current;
    if (!thumb) return;
    const list = thumb.parentElement;
    if (!list) return;

    const triggers = list.querySelectorAll<HTMLElement>("[data-tab-value]");
    const trigger = Array.from(triggers).find(
      (tab) => tab.dataset.tabValue === current,
    );
    if (!trigger) return;

    const geometry = measureThumbGeometry(list, trigger, variant);
    const before = prevGeometry.current;
    prevGeometry.current = geometry;

    // Nothing moved (reflow matched the previous geometry) — no work to do.
    if (
      before &&
      before.left === geometry.left &&
      before.top === geometry.top &&
      before.width === geometry.width &&
      before.height === geometry.height
    ) {
      return;
    }

    if (reduceMotion || (transition && transition.duration === 0)) {
      x.set(geometry.left);
      y.set(geometry.top);
      width.set(geometry.width);
      height.set(geometry.height);
      return;
    }

    // Resize/reflow: the tab didn't change, so track the new box without a
    // positional animation (it would read as a stray jiggle).
    if (before && before.left === geometry.left) {
      x.set(geometry.left);
      y.set(geometry.top);
      height.set(geometry.height);
      animate(width, geometry.width, { duration: 0 });
      return;
    }

    const isTabSwitch = Boolean(before);
    const duration = isTabSwitch ? (transition ?? THUMB_TRANSITION) : { duration: 0 };

    y.set(geometry.top);
    height.set(geometry.height);
    animate(x, geometry.left, duration);
    animate(width, geometry.width, duration);
    // Tabs are single-row: horizontal travel is the only distance worth
    // timing; vertical/top settles instantly.
  }, [current, variant, transition, reduceMotion, x, y, width, height]);

  useLayoutEffect(() => {
    const thumb = thumbRef.current;
    if (!thumb) return;
    const list = thumb.parentElement;
    if (!list) return;

    const remeasure = () => {
      const triggers = list.querySelectorAll<HTMLElement>("[data-tab-value]");
      const trigger = Array.from(triggers).find(
        (tab) => tab.dataset.tabValue === currentRef.current,
      );
      if (!trigger) return;

      const geometry = measureThumbGeometry(list, trigger, variant);
      const before = prevGeometry.current;
      if (
        before &&
        before.left === geometry.left &&
        before.top === geometry.top &&
        before.width === geometry.width &&
        before.height === geometry.height
      ) {
        // Geometry unchanged (e.g. the observer's initial callback right
        // after a switch): leave an in-flight animation untouched.
        return;
      }
      prevGeometry.current = geometry;
      x.set(geometry.left);
      y.set(geometry.top);
      width.set(geometry.width);
      height.set(geometry.height);
    };

    const observer = new ResizeObserver(remeasure);
    observer.observe(list);
    // Font swaps can change trigger widths without resizing the list.
    document.fonts?.ready.then(remeasure);

    return () => observer.disconnect();
  }, [variant, x, y, width, height]);

  if (variant === "underline") {
    return (
      <motion.div
        aria-hidden="true"
        ref={thumbRef}
        className="absolute z-0 h-0.5 bg-primary"
        style={{ x, y, width, height }}
      />
    );
  }

  return (
    <motion.div
      aria-hidden="true"
      ref={thumbRef}
      className={cn(
        "absolute z-0",
        thumbSurfaceClasses[variant as Exclude<TabsVariant, "underline">],
        triggerRadiusClasses[variant as Exclude<TabsVariant, "underline">],
      )}
      style={{ x, y, width, height }}
    />
  );
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string;
  className: string;
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

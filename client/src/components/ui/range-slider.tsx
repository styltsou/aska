import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function snapSliderValue(next: number, min: number, max: number, step: number) {
  if (!(max > min)) return min;
  if (!(step > 0)) return clamp(next, min, max);
  const whole = Math.floor(Number(((max - min) / step).toFixed(6)));
  const lastWhole = Number((min + whole * step).toFixed(6));
  const toGrid = clamp(
    Math.round((next - min) / step) * step + min,
    min,
    lastWhole,
  );
  const snapped =
    lastWhole < max && Math.abs(next - max) <= Math.abs(next - toGrid)
      ? max
      : toGrid;
  return Number(snapped.toFixed(6));
}

function capturePointer(element: Element, pointerId: number) {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    return;
  }
}

function releasePointer(element: Element, pointerId: number) {
  try {
    if (element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  } catch {
    return;
  }
}

export interface RangeSliderProps {
  className?: string;
  defaultValue?: number;
  disabled?: boolean;
  /** Announced instead of the raw number, e.g. "150%" instead of 1.5. */
  formatValueText?: (value: number) => string;
  "aria-label"?: string;
  max?: number;
  min?: number;
  onValueChange?: (value: number) => void;
  showTicks?: boolean;
  step?: number;
  value?: number;
}

function useSliderState({
  "aria-label": ariaLabel,
  defaultValue = 0,
  disabled = false,
  formatValueText,
  max = 100,
  min = 0,
  onValueChange,
  step = 1,
  value,
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLElement | null>(null);
  const draggingRef = useRef(false);
  const [internal, setInternal] = useState(defaultValue);
  const [dragging, setDragging] = useState(false);
  const controlled = value !== undefined;
  const lo = min;
  const hi = max > min ? max : min;
  const stride = step > 0 ? step : 1;
  const current = clamp(controlled ? value : internal, lo, hi);
  const percent = hi > lo ? ((current - lo) / (hi - lo)) * 100 : 0;

  const commit = useCallback(
    (next: number) => {
      const clean = snapSliderValue(next, lo, hi, stride);
      if (!controlled) setInternal(clean);
      onValueChange?.(clean);
    },
    [controlled, onValueChange, lo, hi, stride],
  );

  const commitFromX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      commit(lo + ratio * (hi - lo));
    },
    [commit, lo, hi],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      draggingRef.current = true;
      setDragging(true);
      capturePointer(event.currentTarget, event.pointerId);
      thumbRef.current?.focus({ preventScroll: true });
      commitFromX(event.clientX);
    },
    [disabled, commitFromX],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || disabled) return;
      commitFromX(event.clientX);
    },
    [disabled, commitFromX],
  );

  const endDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    releasePointer(event.currentTarget, event.pointerId);
    draggingRef.current = false;
    setDragging(false);
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (disabled) return;
      const map: Record<string, number> = {
        ArrowRight: current + stride,
        ArrowUp: current + stride,
        ArrowLeft: current - stride,
        ArrowDown: current - stride,
        PageUp: current + stride * 10,
        PageDown: current - stride * 10,
        Home: lo,
        End: hi,
      };
      if (event.key in map) {
        event.preventDefault();
        commit(map[event.key]);
      }
    },
    [disabled, current, stride, lo, hi, commit],
  );

  return {
    current,
    dragging,
    max: hi,
    min: lo,
    percent,
    sliderProps: {
      ref: (node: HTMLElement | null) => {
        thumbRef.current = node;
      },
      role: "slider" as const,
      tabIndex: disabled ? -1 : 0,
      "aria-label": ariaLabel,
      "aria-valuemin": lo,
      "aria-valuemax": hi,
      "aria-valuenow": current,
      "aria-valuetext": formatValueText?.(current),
      "aria-disabled": disabled || undefined,
      onKeyDown,
    },
    step: stride,
    trackProps: {
      ref: trackRef,
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: endDrag,
    },
  };
}

const SPRING_GLIDE = { stiffness: 700, damping: 50, mass: 0.5 } as const;
const SPRING_BOUNCY = {
  type: "spring",
  stiffness: 500,
  damping: 14,
  mass: 0.7,
} as const;

export function RangeSlider({
  showTicks = true,
  className,
  ...options
}: RangeSliderProps) {
  const reduce = useReducedMotion();
  const { percent, dragging, min, max, step, trackProps, sliderProps } =
    useSliderState(options);

  const target = useMotionValue(percent);
  useEffect(() => {
    target.set(percent);
  }, [percent, target]);
  const smooth = useSpring(target, SPRING_GLIDE);
  const pos = reduce ? target : smooth;
  const left = useMotionTemplate`${pos}%`;
  const thumbX = useTransform(pos, (p) => `${-p}%`);

  // Floor rather than round, and settle float noise first, so ranges the step
  // does not divide (0–10 by 4, 1–3 by 0.01) draw dots only on whole steps.
  const steps = Math.floor(Number(((max - min) / step).toFixed(6)));
  const ticks =
    showTicks && steps > 0 && steps <= 50
      ? Array.from({ length: steps + 1 }, (_, i) =>
          Number((min + i * step).toFixed(6)),
        )
      : [];

  return (
    <div
      {...trackProps}
      className={cn(
        "relative flex h-10 w-full touch-none items-center overflow-hidden rounded-lg bg-muted select-none [-webkit-touch-callout:none]",
        options.disabled
          ? "pointer-events-none opacity-50"
          : "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
      <motion.div
        className="absolute inset-y-0 left-0 bg-primary/15"
        style={{ width: left }}
      />

      <div className="pointer-events-none absolute inset-x-[3px] inset-y-0">
        {ticks.map((t) => {
          const tp = ((t - min) / (max - min)) * 100;
          return (
            <span
              key={t}
              className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25"
              style={{ left: `${tp}%` }}
            />
          );
        })}
      </div>

      <motion.div
        {...sliderProps}
        animate={reduce ? undefined : { scaleY: dragging ? 1.35 : 1 }}
        transition={SPRING_BOUNCY}
        className="absolute top-1/2 h-5 w-1.5 rounded-sm bg-primary shadow-sm ring-primary/30 outline-none ring-inset focus-visible:ring-4"
        style={{ left, x: thumbX, y: "-50%" }}
      />
    </div>
  );
}

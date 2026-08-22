"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

function hsvToHex(h: number, s: number, v: number): string {
  s /= 100;
  v /= 100;
  const chroma = v * s;
  const hueSection = (((h % 360) + 360) % 360) / 60;
  const secondLargest = chroma * (1 - Math.abs((hueSection % 2) - 1));
  const match = v - chroma;
  const [red, green, blue] =
    hueSection < 1
      ? [chroma, secondLargest, 0]
      : hueSection < 2
        ? [secondLargest, chroma, 0]
        : hueSection < 3
          ? [0, chroma, secondLargest]
          : hueSection < 4
            ? [0, secondLargest, chroma]
            : hueSection < 5
              ? [secondLargest, 0, chroma]
              : [chroma, 0, secondLargest];
  const channel = (color: number) =>
    Math.round((color + match) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

function parseHex(hex: string) {
  const value = hex.replace("#", "").trim();
  const expanded =
    value.length === 3 || value.length === 4
      ? [...value].map((part) => part + part).join("")
      : value;

  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(expanded)) return null;

  return {
    red: Number.parseInt(expanded.slice(0, 2), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    blue: Number.parseInt(expanded.slice(4, 6), 16),
    alpha:
      expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) : 255,
  };
}

function hexToHsv(hex: string) {
  const color = parseHex(hex) ?? { red: 0, green: 0, blue: 0, alpha: 255 };
  const red = color.red / 255;
  const green = color.green / 255;
  const blue = color.blue / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  if (delta === 0) return { hue: 0, sat: 0, value: max * 100 };

  const hue =
    max === red
      ? 60 * (((green - blue) / delta) % 6)
      : max === green
        ? 60 * ((blue - red) / delta + 2)
        : 60 * ((red - green) / delta + 4);

  return {
    hue: (hue + 360) % 360,
    sat: (delta / max) * 100,
    value: max * 100,
  };
}

function hexToAlpha(hex: string) {
  return ((parseHex(hex)?.alpha ?? 255) / 255) * 100;
}

function normalizeHex(hex?: string) {
  if (!hex) return null;
  const color = parseHex(hex);
  if (!color) return null;
  const channel = (value: number) => value.toString(16).padStart(2, "0");
  const rgb = `#${channel(color.red)}${channel(color.green)}${channel(color.blue)}`;
  return color.alpha < 255 ? `${rgb}${channel(color.alpha)}` : rgb;
}

const CHECKERBOARD_BACKGROUND =
  "conic-gradient(#d1d5db 25%, white 0 50%, #d1d5db 0 75%, white 0)";

function colorOverCheckerboard(color: string) {
  return {
    backgroundImage: `linear-gradient(${color}, ${color}), ${CHECKERBOARD_BACKGROUND}`,
    backgroundSize: "100% 100%, 8px 8px",
  };
}

export function SimpleColorPicker({
  onPick,
  initialHex,
  actionLabel = "Add",
  disabled = false,
  onChange,
  showAction = true,
  compact = false,
  showAlpha = false,
  thickRanges = false,
  tallPicker = false,
}: {
  onPick: (color: string) => void;
  initialHex?: string;
  actionLabel?: string;
  disabled?: boolean;
  onChange?: (color: string) => void;
  showAction?: boolean;
  compact?: boolean;
  showAlpha?: boolean;
  thickRanges?: boolean;
  tallPicker?: boolean;
}) {
  const initial = initialHex ? hexToHsv(initialHex) : undefined;
  const [hue, setHue] = useState(initial?.hue ?? 200);
  const [sat, setSat] = useState(initial?.sat ?? 100);
  const [value, setValue] = useState(initial?.value ?? 100);
  const [alpha, setAlpha] = useState(
    initialHex && showAlpha ? hexToAlpha(initialHex) : 100,
  );
  const lastEmittedHexRef = useRef<string | null>(null);
  const rangeHeightClass = thickRanges ? "h-8" : compact ? "h-6" : "h-4";
  const rangeThumbClass = thickRanges
    ? "h-9 w-4 border-[3px]"
    : compact
      ? "h-8 w-4 border-[3px]"
      : "h-6 w-3 border-2";

  const externalHex = normalizeHex(initialHex);
  const opaqueHex = hsvToHex(hue, sat, value);
  const opaqueColor = parseHex(opaqueHex)!;
  const alphaGradient = `linear-gradient(to right, rgba(${opaqueColor.red}, ${opaqueColor.green}, ${opaqueColor.blue}, 0), rgba(${opaqueColor.red}, ${opaqueColor.green}, ${opaqueColor.blue}, 1))`;
  const currentHex =
    showAlpha && alpha < 100
      ? `${opaqueHex}${Math.round((alpha / 100) * 255)
          .toString(16)
          .padStart(2, "0")}`
      : opaqueHex;

  useLayoutEffect(() => {
    // RGB values can shift by one channel when they are reconstructed from
    // picker coordinates. Only an exact parent echo should be ignored.
    if (!externalHex || externalHex === lastEmittedHexRef.current) return;
    const color = hexToHsv(externalHex);
    setHue(color.hue);
    setSat(color.sat);
    setValue(color.value);
    if (showAlpha) setAlpha(hexToAlpha(externalHex));
  }, [externalHex, showAlpha]);

  useEffect(() => {
    lastEmittedHexRef.current = currentHex;
    onChange?.(currentHex);
  }, [currentHex, onChange]);

  const containerRef = useRef<HTMLDivElement>(null);
  const alphaTrackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!(isDragging && containerRef.current)) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(
        0,
        Math.min(1, (event.clientX - rect.left) / rect.width),
      );
      const y = Math.max(
        0,
        Math.min(1, (event.clientY - rect.top) / rect.height),
      );
      setSat(x * 100);
      setValue(100 - y * 100);
    },
    [isDragging],
  );

  useEffect(() => {
    if (!isDragging) return;
    const handleUp = () => setIsDragging(false);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [isDragging, handlePointerMove]);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className={`relative w-full cursor-crosshair rounded-[min(var(--radius-md),10px)] ${tallPicker ? "h-32" : compact ? "h-24" : "h-36"}`}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hue}, 100%, 50%)`,
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          setIsDragging(true);
          const rect = containerRef.current!.getBoundingClientRect();
          const x = Math.max(
            0,
            Math.min(1, (e.clientX - rect.left) / rect.width),
          );
          const y = Math.max(
            0,
            Math.min(1, (e.clientY - rect.top) / rect.height),
          );
          setSat(x * 100);
          setValue(100 - y * 100);
        }}
      >
        <div
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
          style={{
            left: `${sat}%`,
            top: `${100 - value}%`,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        {!compact ? (
          <div
            className="size-6 shrink-0 rounded-[min(var(--radius-md),10px)]"
            style={colorOverCheckerboard(currentHex)}
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div
            className={`relative w-full cursor-pointer rounded-[min(var(--radius-md),10px)] ${rangeHeightClass}`}
            style={{
              background:
                "linear-gradient(90deg,#FF0000,#FFFF00,#00FF00,#00FFFF,#0000FF,#FF00FF,#FF0000)",
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              const el = e.currentTarget;
              const rect = el.getBoundingClientRect();
              const x = (e.clientX - rect.left) / rect.width;
              setHue(Math.round(Math.max(0, Math.min(360, x * 360))));
              const handleMove = (ev: PointerEvent) => {
                const r = el.getBoundingClientRect();
                const x2 = (ev.clientX - r.left) / r.width;
                setHue(Math.round(Math.max(0, Math.min(360, x2 * 360))));
              };
              const handleUp = () => {
                window.removeEventListener("pointermove", handleMove);
                window.removeEventListener("pointerup", handleUp);
              };
              window.addEventListener("pointermove", handleMove);
              window.addEventListener("pointerup", handleUp);
            }}
          >
            <div
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm border-white shadow-sm ${rangeThumbClass}`}
              style={{
                left: `${(hue / 360) * 100}%`,
                backgroundColor: `hsl(${hue}, 100%, 50%)`,
              }}
            />
          </div>
          {showAlpha ? (
            <div
              ref={alphaTrackRef}
              role="slider"
              tabIndex={0}
              aria-label="Color opacity"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(alpha)}
              className={`relative w-full cursor-pointer overflow-visible rounded-[min(var(--radius-md),10px)] ${rangeHeightClass}`}
              style={{
                backgroundImage: `${alphaGradient}, ${CHECKERBOARD_BACKGROUND}`,
                backgroundSize: "100% 100%, 8px 8px",
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                const track = alphaTrackRef.current;
                if (!track) return;
                const update = (clientX: number) => {
                  const rect = track.getBoundingClientRect();
                  setAlpha(
                    Math.round(
                      Math.max(
                        0,
                        Math.min(1, (clientX - rect.left) / rect.width),
                      ) * 100,
                    ),
                  );
                };
                update(event.clientX);
                const handleMove = (moveEvent: PointerEvent) =>
                  update(moveEvent.clientX);
                const handleUp = () => {
                  window.removeEventListener("pointermove", handleMove);
                  window.removeEventListener("pointerup", handleUp);
                };
                window.addEventListener("pointermove", handleMove);
                window.addEventListener("pointerup", handleUp);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                  event.preventDefault();
                  setAlpha((value) => Math.max(0, value - 1));
                }
                if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setAlpha((value) => Math.min(100, value + 1));
                }
              }}
            >
              <div
                className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm border-white shadow-sm ${rangeThumbClass}`}
                style={{
                  left: `${alpha}%`,
                  backgroundColor: opaqueHex,
                }}
              />
            </div>
          ) : null}
        </div>
        {showAction ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(currentHex)}
            className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

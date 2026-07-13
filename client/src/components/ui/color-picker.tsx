"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function SimpleColorPicker({
  onPick,
}: {
  onPick: (color: string) => void;
}) {
  const [hue, setHue] = useState(200);
  const [sat, setSat] = useState(100);
  const [lig, setLig] = useState(50);

  const currentHex = hslToHex(hue, sat, lig);

  const containerRef = useRef<HTMLDivElement>(null);
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
      setLig(100 - y * 100);
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
        className="relative h-36 w-full cursor-crosshair rounded-[min(var(--radius-md),10px)]"
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
          setLig(100 - y * 100);
        }}
      >
        <div
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
          style={{
            left: `${sat}%`,
            top: `${100 - lig}%`,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <div
          className="size-6 shrink-0 rounded-[min(var(--radius-md),10px)]"
          style={{ backgroundColor: currentHex }}
        />
        <div
          className="relative h-4 flex-1 cursor-pointer rounded-[min(var(--radius-md),10px)]"
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
            className="absolute top-1/2 h-6 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-white shadow-sm"
            style={{
              left: `${(hue / 360) * 100}%`,
              backgroundColor: `hsl(${hue}, 100%, 50%)`,
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => onPick(currentHex)}
          className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          Add
        </button>
      </div>
    </div>
  );
}

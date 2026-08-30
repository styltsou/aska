import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type NoteSaveStatusState = "saved" | "saving" | "deleting" | "error" | "empty";

export function NoteSaveStatus({
  state,
  updatedAt,
  className,
}: {
  state: NoteSaveStatusState;
  updatedAt?: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (state !== "saved" || !updatedAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [state, updatedAt]);

  if (state === "empty") return null;

  const label = getNoteSaveStatusLabel(state, updatedAt, now);
  if (!label) return null;

  return (
    <span
      className={cn(
        "inline-block shrink-0 overflow-hidden px-2 text-right text-xs whitespace-nowrap text-muted-foreground/60",
        state === "error" && "text-destructive",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function getNoteSaveStatusLabel(
  state: NoteSaveStatusState,
  updatedAt: string | undefined,
  now: number,
): string | undefined {
  if (state === "saving") return "Saving…";
  if (state === "deleting") return "Deleting…";
  if (state === "error") return "Save failed";
  if (!updatedAt) return undefined;
  return `Edited ${formatRelativeTime(updatedAt, now)}`;
}

function formatRelativeTime(iso: string, now: number): string {
  const elapsedMs = now - new Date(iso).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 60_000) return "just now";

  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year:
      new Date(iso).getFullYear() === new Date(now).getFullYear()
        ? undefined
        : "numeric",
  }).format(new Date(iso));
}

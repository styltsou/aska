import { useEffect, useState } from "react";

import { formatNoteHeaderEditTime } from "@/lib/note-date-format";
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
  now = Date.now(),
): string | undefined {
  if (state === "saving") return "Saving…";
  if (state === "deleting") return "Deleting…";
  if (state === "error") return "Save failed";
  if (!updatedAt) return undefined;
  const headerTime = formatNoteHeaderEditTime(updatedAt, now);
  return headerTime ? `Edited ${headerTime}` : undefined;
}

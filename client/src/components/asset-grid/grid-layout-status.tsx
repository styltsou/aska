export function GridLayoutStatus({ pending }: { pending: boolean }) {
  return (
    <div
      role="status"
      className="pointer-events-none sticky top-3 z-30 flex h-0 shrink-0 items-start justify-center"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs whitespace-nowrap text-muted-foreground shadow-sm">
          <span
            aria-hidden="true"
            className="size-3 animate-spin rounded-full border border-current border-t-transparent motion-reduce:animate-none"
          />
          Updating layout…
        </span>
      ) : null}
    </div>
  );
}

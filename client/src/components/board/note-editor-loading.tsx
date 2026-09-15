import "./note-editor-loading.css";

export function NoteEditorLoading() {
  return (
    <p
      className="inline-flex items-baseline gap-[0.1em] py-14 text-sm font-medium"
      role="status"
    >
      <span className="animate-[note-editor-loading-shimmer_1.8s_linear_infinite] bg-[linear-gradient(100deg,var(--muted-foreground)_0%,color-mix(in_oklch,var(--muted-foreground)_86%,var(--foreground))_45%,var(--muted-foreground)_90%)] [background-size:220%_100%] bg-clip-text text-transparent motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-muted-foreground">
        Opening note
      </span>
      <span className="text-muted-foreground" aria-hidden="true">
        …
      </span>
    </p>
  );
}

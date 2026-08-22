export function NoteEditorLoading() {
  return (
    <p className="note-editor-loading py-14 text-sm" role="status">
      <span className="note-editor-loading-label">Opening note</span>
      <span className="note-editor-loading-dots" aria-hidden="true">
        …
      </span>
    </p>
  );
}

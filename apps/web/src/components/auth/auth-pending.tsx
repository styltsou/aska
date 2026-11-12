/** Full-page spinner shown while an auth route's guard resolves. */
export function AuthPending() {
  return (
    <div
      aria-label="Loading"
      className="flex min-h-svh items-center justify-center bg-background px-6"
      role="status"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
    </div>
  );
}

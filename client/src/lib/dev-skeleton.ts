export function shouldShowSkeletonPreview(search: string) {
  return (
    import.meta.env.DEV &&
    new URLSearchParams(search).get("skeleton") === "1"
  );
}

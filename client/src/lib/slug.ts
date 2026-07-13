const acronymLabels: Record<string, string> = {
  ui: "UI",
};

export function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map(
      (word) =>
        acronymLabels[word] ?? word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

export function slugFromTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

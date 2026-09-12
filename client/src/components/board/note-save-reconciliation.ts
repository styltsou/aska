export type NoteSaveSnapshot = {
  content: string;
  title: string;
  revision: number;
};

export function isSameSaveSnapshot(
  left: NoteSaveSnapshot | undefined,
  right: NoteSaveSnapshot | undefined,
) {
  return Boolean(
    left &&
    right &&
    left.revision === right.revision &&
    left.content === right.content &&
    left.title === right.title,
  );
}

export function resolveNoteSaveCompletion(
  submitted: NoteSaveSnapshot,
  latest: NoteSaveSnapshot,
):
  | { status: "acknowledged" }
  | { status: "reconcile"; snapshot: NoteSaveSnapshot } {
  return isSameSaveSnapshot(submitted, latest)
    ? { status: "acknowledged" }
    : { status: "reconcile", snapshot: latest };
}

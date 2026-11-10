export function createArrowPreviewSessionTracker() {
  const revisions = new Map<string, number>();

  return {
    begin(arrowId: string) {
      const revision = (revisions.get(arrowId) ?? 0) + 1;
      revisions.set(arrowId, revision);
      return revision;
    },
    owns(arrowId: string, revision: number) {
      return revisions.get(arrowId) === revision;
    },
  };
}

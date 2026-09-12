import { describe, expect, it } from "vitest";

import {
  isSameSaveSnapshot,
  resolveNoteSaveCompletion,
  type NoteSaveSnapshot,
} from "./note-save-reconciliation";

function snapshot(
  content: string,
  revision: number,
  title = "",
): NoteSaveSnapshot {
  return { content, revision, title };
}

describe("note save reconciliation", () => {
  it("acknowledges a response only when it matches the latest edit revision", () => {
    const submitted = snapshot("/", 1);

    expect(isSameSaveSnapshot(submitted, snapshot("/", 1))).toBe(true);
    expect(resolveNoteSaveCompletion(submitted, snapshot("/", 1))).toEqual({
      status: "acknowledged",
    });
  });

  it("queues an explicit empty body when a trigger is deleted during saving", () => {
    const result = resolveNoteSaveCompletion(snapshot("@", 4), snapshot("", 5));

    expect(result).toEqual({
      status: "reconcile",
      snapshot: snapshot("", 5),
    });
  });

  it("keeps a newer title edit even when the body matches the submitted save", () => {
    expect(
      resolveNoteSaveCompletion(
        snapshot("Body", 8, "Old title"),
        snapshot("Body", 9, "New title"),
      ),
    ).toEqual({
      status: "reconcile",
      snapshot: snapshot("Body", 9, "New title"),
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  advanceOnboardingTourState,
  INITIAL_ONBOARDING_TOUR_STATE,
} from "./onboarding-tour.service";

describe("account-level onboarding tour", () => {
  it("advances for the original collection and note across workspaces", () => {
    const collection = advanceOnboardingTourState(
      INITIAL_ONBOARDING_TOUR_STATE,
      {
        type: "collection-created",
        workspaceSlug: "first-workspace",
        collectionSlug: "ideas",
      },
    );
    expect(collection.step).toBe("note");
    expect(
      advanceOnboardingTourState(collection, {
        type: "note-created",
        workspaceSlug: "second-workspace",
        collectionSlug: "ideas",
        noteId: "note-1",
      }),
    ).toEqual(collection);
    const note = advanceOnboardingTourState(collection, {
      type: "note-created",
      workspaceSlug: "first-workspace",
      collectionSlug: "ideas",
      noteId: "note-1",
    });
    expect(note.step).toBe("move");
    expect(
      advanceOnboardingTourState(note, {
        type: "note-moved",
        workspaceSlug: "first-workspace",
        collectionSlug: "ideas",
        noteId: "note-2",
      }),
    ).toEqual(note);
    expect(
      advanceOnboardingTourState(note, {
        type: "note-moved",
        workspaceSlug: "first-workspace",
        collectionSlug: "ideas",
        noteId: "note-1",
      }).status,
    ).toBe("completed");
  });

  it("does not reopen skipped or ineligible tours without an explicit restart", () => {
    const skipped = advanceOnboardingTourState(INITIAL_ONBOARDING_TOUR_STATE, {
      type: "skip",
    });
    expect(skipped.status).toBe("skipped");
    expect(
      advanceOnboardingTourState(skipped, {
        type: "collection-created",
        workspaceSlug: "another-workspace",
        collectionSlug: "new-board",
      }),
    ).toEqual(skipped);
    expect(
      advanceOnboardingTourState(
        { ...skipped, status: "ineligible" },
        { type: "restart" },
      ),
    ).toEqual(INITIAL_ONBOARDING_TOUR_STATE);
  });
});

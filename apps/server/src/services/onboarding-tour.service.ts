import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { userOnboardingTour } from "@/db/schema";

export const GETTING_STARTED_TOUR_KEY = "getting-started-v1";

export type OnboardingTourState = {
  status: "active" | "skipped" | "completed" | "ineligible";
  step: "collection" | "note" | "move" | null;
  workspaceSlug: string | null;
  collectionSlug: string | null;
  noteId: string | null;
};

export type OnboardingTourEvent =
  | {
      type: "collection-created";
      workspaceSlug: string;
      collectionSlug: string;
    }
  | {
      type: "note-created";
      workspaceSlug: string;
      collectionSlug: string;
      noteId: string;
    }
  | {
      type: "note-moved";
      workspaceSlug: string;
      collectionSlug: string;
      noteId: string;
    }
  | { type: "skip" }
  | { type: "restart" };

export const INITIAL_ONBOARDING_TOUR_STATE: OnboardingTourState = {
  status: "active",
  step: "collection",
  workspaceSlug: null,
  collectionSlug: null,
  noteId: null,
};

export function advanceOnboardingTourState(
  state: OnboardingTourState,
  event: OnboardingTourEvent,
): OnboardingTourState {
  if (event.type === "restart") return INITIAL_ONBOARDING_TOUR_STATE;
  if (state.status !== "active") return state;
  if (event.type === "skip") return { ...state, status: "skipped" };
  if (state.step === "collection" && event.type === "collection-created") {
    return {
      status: "active",
      step: "note",
      workspaceSlug: event.workspaceSlug,
      collectionSlug: event.collectionSlug,
      noteId: null,
    };
  }
  if (
    state.step === "note" &&
    event.type === "note-created" &&
    state.workspaceSlug === event.workspaceSlug &&
    state.collectionSlug === event.collectionSlug
  ) {
    return { ...state, step: "move", noteId: event.noteId };
  }
  if (
    state.step === "move" &&
    event.type === "note-moved" &&
    state.workspaceSlug === event.workspaceSlug &&
    state.collectionSlug === event.collectionSlug &&
    state.noteId === event.noteId
  ) {
    return { ...state, status: "completed", step: null };
  }
  return state;
}

function toState(
  row: typeof userOnboardingTour.$inferSelect,
): OnboardingTourState {
  return {
    status: row.status as OnboardingTourState["status"],
    step: row.step as OnboardingTourState["step"],
    workspaceSlug: row.workspaceSlug,
    collectionSlug: row.collectionSlug,
    noteId: row.noteId,
  };
}

export async function getOnboardingTour(
  userId: string,
): Promise<OnboardingTourState> {
  await db
    .insert(userOnboardingTour)
    .values({
      userId,
      tourKey: GETTING_STARTED_TOUR_KEY,
      ...INITIAL_ONBOARDING_TOUR_STATE,
    })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(userOnboardingTour)
    .where(
      and(
        eq(userOnboardingTour.userId, userId),
        eq(userOnboardingTour.tourKey, GETTING_STARTED_TOUR_KEY),
      ),
    );
  if (!row) throw new Error("Onboarding tour record was not created");
  return toState(row);
}

export async function recordOnboardingTourEvent(
  userId: string,
  event: OnboardingTourEvent,
): Promise<OnboardingTourState> {
  const state = await getOnboardingTour(userId);
  const next = advanceOnboardingTourState(state, event);
  if (next === state) return state;
  const matchesNullable = (
    column:
      | typeof userOnboardingTour.step
      | typeof userOnboardingTour.workspaceSlug,
    value: string | null,
  ) => (value === null ? isNull(column) : eq(column, value));
  const [row] = await db
    .update(userOnboardingTour)
    .set({ ...next, updatedAt: new Date() })
    .where(
      and(
        eq(userOnboardingTour.userId, userId),
        eq(userOnboardingTour.tourKey, GETTING_STARTED_TOUR_KEY),
        eq(userOnboardingTour.status, state.status),
        matchesNullable(userOnboardingTour.step, state.step),
        matchesNullable(userOnboardingTour.workspaceSlug, state.workspaceSlug),
        matchesNullable(
          userOnboardingTour.collectionSlug,
          state.collectionSlug,
        ),
        matchesNullable(userOnboardingTour.noteId, state.noteId),
      ),
    )
    .returning();
  return row ? toState(row) : getOnboardingTour(userId);
}

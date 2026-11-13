import { apiGet, apiPost } from "@/lib/api";

export type OnboardingTourState = {
  status: "active" | "skipped" | "completed" | "ineligible";
  step: "collection" | "note" | "move" | null;
  workspaceSlug: string | null;
  collectionSlug: string | null;
  noteId: string | null;
};

export type OnboardingTourAction =
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

export const ONBOARDING_TOUR_EVENT = "mnemee:onboarding-tour-action";
export const ONBOARDING_TOUR_RESTART_EVENT = "mnemee:onboarding-tour-restart";

export function getOnboardingTour() {
  return apiGet<OnboardingTourState>("/api/v1/me/onboarding-tour");
}

export function recordOnboardingTourAction(action: OnboardingTourAction) {
  return apiPost<OnboardingTourState>(
    "/api/v1/me/onboarding-tour/events",
    action,
  );
}

export function restartOnboardingTour() {
  window.dispatchEvent(new Event(ONBOARDING_TOUR_RESTART_EVENT));
}

export function emitOnboardingTourAction(action: OnboardingTourAction) {
  window.dispatchEvent(
    new CustomEvent(ONBOARDING_TOUR_EVENT, { detail: action }),
  );
}

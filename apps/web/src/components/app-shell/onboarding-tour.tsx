import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { makeBoardKey } from "@/components/canvas";
import { useTransientStore } from "@/store";
import { cn } from "@/lib/utils";
import { OnboardingCursor, useOnboardingTarget } from "./onboarding-cursor";
import {
  getOnboardingTour,
  ONBOARDING_TOUR_EVENT,
  ONBOARDING_TOUR_RESTART_EVENT,
  recordOnboardingTourAction,
  type OnboardingTourAction,
  type OnboardingTourState,
} from "@/lib/onboarding-tour";

export function OnboardingTour({
  userId,
  workspaceSlug,
  pathname,
}: {
  userId: string;
  workspaceSlug: string;
  pathname: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["onboarding-tour", userId] as const;
  const { data: tour } = useQuery({
    queryKey,
    queryFn: getOnboardingTour,
    retry: 1,
  });
  const setOnboardingRailBoardKey = useTransientStore(
    (state) => state.setOnboardingRailBoardKey,
  );
  const [failedAction, setFailedAction] = useState<OnboardingTourAction | null>(
    null,
  );
  const { mutate, isPending } = useMutation({
    mutationFn: recordOnboardingTourAction,
    scope: { id: `onboarding-tour:${userId}` },
    onSuccess: async (next, action) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<OnboardingTourState>(queryKey, next);
      setFailedAction(null);
      if (action.type === "note-moved" && next.status === "completed") {
        toast.success("Your first board is ready");
      }
    },
    onError: (_error, action) => {
      setFailedAction(action);
      toast.error("Could not save tour progress. Please retry.");
    },
  });

  useEffect(() => {
    function onAction(event: Event) {
      if (tour && tour.status !== "active") return;
      mutate((event as CustomEvent<OnboardingTourAction>).detail);
    }
    function onRestart() {
      mutate({ type: "restart" });
    }
    window.addEventListener(ONBOARDING_TOUR_EVENT, onAction);
    window.addEventListener(ONBOARDING_TOUR_RESTART_EVENT, onRestart);
    return () => {
      window.removeEventListener(ONBOARDING_TOUR_EVENT, onAction);
      window.removeEventListener(ONBOARDING_TOUR_RESTART_EVENT, onRestart);
    };
  }, [mutate, tour]);

  const railBoardKey =
    tour?.status === "active" &&
    (tour.step === "note" || tour.step === "move") &&
    tour.workspaceSlug === workspaceSlug &&
    tour.collectionSlug
      ? makeBoardKey(workspaceSlug, tour.collectionSlug, undefined)
      : undefined;
  useEffect(() => {
    setOnboardingRailBoardKey(railBoardKey);
    return () => setOnboardingRailBoardKey(undefined);
  }, [railBoardKey, setOnboardingRailBoardKey]);

  const active = tour?.status === "active" && Boolean(tour.step);
  const targetWorkspaceSlug = tour?.workspaceSlug ?? workspaceSlug;
  const collectionPath = tour?.collectionSlug
    ? `/${targetWorkspaceSlug}/collections/${tour.collectionSlug}`
    : null;
  const isOnTargetPage =
    tour?.step === "collection"
      ? pathname === `/${workspaceSlug}`
      : pathname === collectionPath;
  const targetSelector =
    active && isOnTargetPage
      ? tour.step === "collection"
        ? '[data-onboarding-action="create-collection"]'
        : tour.step === "note"
          ? '[data-onboarding-action="create-note"]'
          : tour.noteId
            ? `[data-canvas-asset-id="${CSS.escape(tour.noteId)}"]`
            : null
      : null;
  const target = useOnboardingTarget(targetSelector, active && isOnTargetPage);

  if (!active || !tour?.step) return null;

  const stepNumber =
    tour.step === "collection" ? 1 : tour.step === "note" ? 2 : 3;

  return (
    <>
      {target ? (
        <OnboardingCursor
          key={`${tour.step}:${targetSelector}`}
          target={target}
          gesture={tour.step === "move" ? "drag" : "click"}
        />
      ) : null}
      <section
        aria-label="Getting started"
        className={cn(
          "fixed right-4 left-4 z-[60] rounded-xl border border-foreground/25 bg-card p-4 shadow-2xl ring-1 ring-foreground/10 md:right-auto md:left-[calc(var(--sidebar-width)+1.5rem)] md:w-[21rem] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2",
          tour.step === "collection" ? "bottom-4" : "bottom-20 md:bottom-4",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Getting started · {stepNumber} of 3
            </p>
            <h2 className="mt-1 text-base font-semibold">
              {tour.step === "collection"
                ? "Make a space for your ideas"
                : tour.step === "note"
                  ? "Add your first note"
                  : "Make the board yours"}
            </h2>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Skip getting started"
            disabled={isPending}
            onClick={() => mutate({ type: "skip" })}
          >
            <XIcon />
          </Button>
        </div>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          {tour.step === "collection"
            ? "Create a collection for your first board. Give it any name you like."
            : tour.step === "note"
              ? "Write down an idea, a project name, or anything you want to remember."
              : "Close the note, then drag its card to a new spot on the canvas. Switch to canvas view if needed."}
        </p>
        {failedAction ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-destructive">
            <span>Progress could not be saved.</span>
            <button
              type="button"
              className="font-medium underline"
              disabled={isPending}
              onClick={() => mutate(failedAction)}
            >
              Retry
            </button>
          </div>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-3">
          {isOnTargetPage ? (
            <span aria-live="polite" className="text-xs text-muted-foreground">
              {!target
                ? tour.step === "move"
                  ? "Open canvas view to find your note"
                  : "Finding the next control…"
                : tour.step === "collection"
                  ? "Click the highlighted collection button"
                  : tour.step === "note"
                    ? "Click the highlighted note button"
                    : "Drag the highlighted note"}
            </span>
          ) : tour.step === "collection" ? (
            <Link
              to="/$workspaceSlug"
              params={{ workspaceSlug }}
              className="text-sm font-medium underline underline-offset-4"
            >
              Go to collections
            </Link>
          ) : (
            <Link
              to="/$workspaceSlug/collections/$"
              params={{
                workspaceSlug: targetWorkspaceSlug,
                _splat: tour.collectionSlug!,
              }}
              className="text-sm font-medium underline underline-offset-4"
            >
              Go to your collection
            </Link>
          )}
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            disabled={isPending}
            onClick={() => mutate({ type: "skip" })}
          >
            Skip tour
          </button>
        </div>
      </section>
    </>
  );
}

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MousePointer2Icon, XIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CreateCollectionDialog } from "./create-collection-dialog";
import { CreateNoteDialog } from "./create-note-dialog";
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
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const reduceMotion = useReducedMotion();
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

  useEffect(() => {
    if (
      tour?.status !== "active" ||
      tour.step !== "move" ||
      !tour.noteId ||
      tour.workspaceSlug !== workspaceSlug
    )
      return;
    const markNote = () => {
      const card = document.querySelector<HTMLElement>(
        `[data-asset-card-id="${CSS.escape(tour.noteId!)}"]`,
      );
      card?.setAttribute("data-onboarding-target", "");
      return card;
    };
    let card = markNote();
    const observer = new MutationObserver(() => {
      if (card?.isConnected) return;
      card = markNote();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      card?.removeAttribute("data-onboarding-target");
    };
  }, [tour, workspaceSlug]);

  if (tour?.status !== "active" || !tour.step) return null;

  const stepNumber =
    tour.step === "collection" ? 1 : tour.step === "note" ? 2 : 3;
  const targetWorkspaceSlug = tour.workspaceSlug ?? workspaceSlug;
  const collectionPath = tour.collectionSlug
    ? `/${targetWorkspaceSlug}/collections/${tour.collectionSlug}`
    : null;
  const isOnTargetPage =
    tour.step === "collection"
      ? pathname === `/${workspaceSlug}`
      : pathname === collectionPath;

  return (
    <>
      {tour.step !== "collection" &&
      tour.collectionSlug &&
      targetWorkspaceSlug === workspaceSlug ? (
        <CreateNoteDialog
          workspaceSlug={workspaceSlug}
          collectionPath={tour.collectionSlug}
          open={noteEditorOpen}
          onOpenChange={setNoteEditorOpen}
        />
      ) : null}
      <section
        aria-label="Getting started"
        className="fixed right-4 bottom-4 z-40 w-[min(21rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 shadow-xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2"
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
              : "Close the note, then drag its card to a new spot on the canvas."}
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
            tour.step === "collection" ? (
              <CreateCollectionDialog workspaceSlug={workspaceSlug}>
                <Button size="sm" disabled={isPending}>
                  Create collection
                </Button>
              </CreateCollectionDialog>
            ) : tour.step === "note" ? (
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => setNoteEditorOpen(true)}
              >
                Write a note
              </Button>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <motion.span
                  aria-hidden="true"
                  className="inline-flex"
                  animate={reduceMotion ? { x: 0 } : { x: [0, 18, 0] }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 2.2, ease: "easeInOut", repeat: Infinity }
                  }
                >
                  <MousePointer2Icon className="size-3.5" />
                </motion.span>
                Drag the note to continue
              </span>
            )
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

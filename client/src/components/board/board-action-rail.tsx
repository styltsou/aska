import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  FileTextIcon,
  FolderPlusIcon,
  ImageIcon,
  PaletteIcon,
  UploadIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { getPlatformShift } from "@/lib/platform";
import {
  FLOATING_GLASS_BACKDROP_CLASS,
  GLASS_FRAME_CLASS,
  GLASS_ISLAND_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";
import { useBoardInsertionPlacement } from "@/components/canvas";
import {
  getPexelsBrowserScope,
  usePersistedStore,
  useSessionStore,
} from "@/store";
import { CreateFolderDialog } from "@/components/app-shell/create-folder-dialog";
import { CreateNoteDialog } from "@/components/app-shell/create-note-dialog";
import { ColorEditorDialog } from "@/components/app-shell/color-editor-dialog";
import { UploadImagesDialog } from "@/components/app-shell/upload-images-dialog";

const RAIL_BUTTON_CLASS =
  "rounded-lg text-foreground transition-[background,color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-muted/80";

const RAIL_TRANSITION = {
  duration: 0.12,
  ease: [0.16, 1, 0.3, 1],
} as const;

function RailShortcut({ keys }: { keys: string }) {
  return (
    <KbdGroup className="gap-0.5">
      <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">{getPlatformShift()}</Kbd>
      <span>+</span>
      <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">{keys}</Kbd>
    </KbdGroup>
  );
}

export function BoardActionRail({
  workspaceSlug,
  collectionPath,
}: {
  workspaceSlug: string;
  collectionPath: string;
}) {
  const placement = useBoardInsertionPlacement(workspaceSlug, collectionPath);
  const openPexelsBrowser = useSessionStore(
    (state) => state.setPexelsBrowserOpen,
  );
  const pexelsScope = getPexelsBrowserScope(
    workspaceSlug,
    collectionPath.split("/")[0],
  );
  const pexelsBrowserOpen = useSessionStore(
    (state) => state.pexelsBrowserByScope[pexelsScope]?.open ?? false,
  );
  const isRailVisible = usePersistedStore(
    (state) => state.workspaceBoardActionRails?.[workspaceSlug] ?? true,
  );
  const setWorkspaceBoardActionRail = usePersistedStore(
    (state) => state.setWorkspaceBoardActionRail,
  );
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : RAIL_TRANSITION;

  return (
    <AnimatePresence initial={false} mode="wait">
      {isRailVisible ? (
        <motion.div
          key="actions-dock"
          initial={
            reduceMotion
              ? false
              : { opacity: 0, x: -28, scale: 0.78, rotate: -3 }
          }
          animate={{ opacity: 1, x: 0, scale: 1, rotate: 0 }}
          exit={
            reduceMotion
              ? undefined
              : { opacity: 0, x: -20, scale: 0.86, rotate: -1 }
          }
          transition={transition}
          className="absolute top-1/2 left-3 z-20 hidden origin-left lg:block"
        >
          <div
            className={cn(
              "relative -translate-y-1/2",
              FLOATING_GLASS_BACKDROP_CLASS,
            )}
          >
            <div
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg p-1",
                GLASS_FRAME_CLASS,
              )}
            >
              <div className={GLASS_ISLAND_CLASS}>
                <ButtonGroup orientation="vertical">
                  <Tooltip>
                    <UploadImagesDialog
                      workspaceSlug={workspaceSlug}
                      collectionPath={collectionPath}
                      restoreOpen
                      placement={placement}
                    >
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label="Upload images"
                            className={RAIL_BUTTON_CLASS}
                          >
                            <UploadIcon />
                          </Button>
                        }
                      />
                    </UploadImagesDialog>
                    <TooltipContent side="right">
                      <span>Upload images</span>
                      <RailShortcut keys="U" />
                    </TooltipContent>
                  </Tooltip>
                  <ButtonGroupSeparator
                    orientation="horizontal"
                    className="bg-border/70"
                  />
                  <Tooltip>
                    <CreateNoteDialog
                      workspaceSlug={workspaceSlug}
                      collectionPath={collectionPath}
                      restoreOpen
                      placement={placement}
                    >
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label="New note"
                            className={RAIL_BUTTON_CLASS}
                          >
                            <FileTextIcon />
                          </Button>
                        }
                      />
                    </CreateNoteDialog>
                    <TooltipContent side="right">
                      <span>New note</span>
                      <RailShortcut keys="N" />
                    </TooltipContent>
                  </Tooltip>
                  <ButtonGroupSeparator
                    orientation="horizontal"
                    className="bg-border/70"
                  />
                  <Tooltip>
                    <ColorEditorDialog
                      workspaceSlug={workspaceSlug}
                      collectionPath={collectionPath}
                      placement={placement}
                    >
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label="New color"
                            className={RAIL_BUTTON_CLASS}
                          >
                            <PaletteIcon />
                          </Button>
                        }
                      />
                    </ColorEditorDialog>
                    <TooltipContent side="right">New color</TooltipContent>
                  </Tooltip>
                  <ButtonGroupSeparator
                    orientation="horizontal"
                    className="bg-border/70"
                  />
                  <Tooltip>
                    <CreateFolderDialog
                      workspaceSlug={workspaceSlug}
                      collectionPath={collectionPath}
                      placement={placement}
                    >
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label="New folder"
                            className={RAIL_BUTTON_CLASS}
                          >
                            <FolderPlusIcon />
                          </Button>
                        }
                      />
                    </CreateFolderDialog>
                    <TooltipContent side="right">
                      <span>New folder</span>
                      <RailShortcut keys="D" />
                    </TooltipContent>
                  </Tooltip>
                </ButtonGroup>
              </div>
              <div className={GLASS_ISLAND_CLASS}>
                <ButtonGroup orientation="vertical">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={
                            pexelsBrowserOpen
                              ? "Close Pexels photos"
                              : "Browse Pexels photos"
                          }
                          aria-expanded={pexelsBrowserOpen}
                          aria-pressed={pexelsBrowserOpen}
                          data-active={pexelsBrowserOpen || undefined}
                          className={cn(
                            RAIL_BUTTON_CLASS,
                            pexelsBrowserOpen &&
                              "bg-sidebar-active text-sidebar-accent-foreground",
                          )}
                          onClick={() =>
                            openPexelsBrowser(pexelsScope, !pexelsBrowserOpen)
                          }
                        >
                          <ImageIcon />
                        </Button>
                      }
                    />
                    <TooltipContent side="right">
                      {pexelsBrowserOpen
                        ? "Close Pexels photos"
                        : "Browse Pexels photos"}
                    </TooltipContent>
                  </Tooltip>
                </ButtonGroup>
              </div>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <div className={GLASS_ISLAND_CLASS}>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Hide actions dock"
                        className={RAIL_BUTTON_CLASS}
                        onClick={() =>
                          setWorkspaceBoardActionRail(workspaceSlug, false)
                        }
                      >
                        <ChevronLeftIcon />
                      </Button>
                    </div>
                  }
                />
                <TooltipContent side="right">Hide actions dock</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="actions-dock-trigger"
          initial={reduceMotion ? false : { opacity: 0, x: -18, scaleX: 0.55 }}
          animate={{ opacity: 1, x: 0, scaleX: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -12, scaleX: 0.75 }}
          transition={transition}
          className="absolute top-1/2 left-0 z-20 hidden origin-left lg:block"
        >
          <div className="-translate-y-1/2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Show actions dock"
                    className={cn(
                      "h-12 w-4 rounded-l-none rounded-r-lg border border-l-0 border-border/80 text-muted-foreground transition-[background,color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-muted/80 hover:text-foreground",
                      GLASS_FRAME_CLASS,
                    )}
                    onClick={() =>
                      setWorkspaceBoardActionRail(workspaceSlug, true)
                    }
                  >
                    <ChevronRightIcon />
                  </Button>
                }
              />
              <TooltipContent side="right">Show actions dock</TooltipContent>
            </Tooltip>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

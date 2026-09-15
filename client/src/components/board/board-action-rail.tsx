import {
  ArrowUpRightIcon,
  FileTextIcon,
  FolderPlusIcon,
  ImageIcon,
  PaletteIcon,
  UploadIcon,
  TypeIcon,
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
import { makeBoardKey, useBoardInsertionPlacement } from "@/components/canvas";
import {
  getPexelsBrowserScope,
  usePersistedStore,
  useSessionStore,
  useTransientStore,
} from "@/store";
import { CreateFolderDialog } from "@/components/app-shell/create-folder-dialog";
import { CreateNoteDialog } from "@/components/app-shell/create-note-dialog";
import { ColorEditorDialog } from "@/components/app-shell/color-editor-dialog";
import { UploadImagesDialog } from "@/components/app-shell/upload-images-dialog";

const RAIL_BUTTON_CLASS =
  "rounded-[calc(var(--radius-md)-1px)] text-foreground transition-[background,color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-muted/80";

const RAIL_FRAME_TRANSITION = {
  duration: 0.12,
  ease: [0, 0, 0.2, 1] as const,
};

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
  const [collectionSlug = "", ...folderSegments] = collectionPath.split("/");
  const boardKey = makeBoardKey(
    workspaceSlug,
    collectionSlug,
    folderSegments.join("/") || undefined,
  );
  const activeTool = useTransientStore(
    (state) => state.canvasTools[boardKey] ?? "select",
  );
  const setCanvasTool = useTransientStore((state) => state.setCanvasTool);
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
    (state) => state.workspaceBoardActionRails?.[workspaceSlug] ?? false,
  );
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? { duration: 0 } : RAIL_FRAME_TRANSITION;

  return (
    <div className="absolute inset-x-0 bottom-3 z-20 hidden items-end justify-center lg:flex">
      <AnimatePresence initial={false}>
        {isRailVisible ? (
          <motion.div
            key="actions-dock"
            initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 14, scale: 0.98 }}
            transition={transition}
            style={{ transformOrigin: "bottom center" }}
            className="pointer-events-auto relative w-fit"
          >
            <div
              className={cn("relative w-fit", FLOATING_GLASS_BACKDROP_CLASS)}
            >
              <motion.div
                layout="size"
                transition={transition}
                className={cn(
                  "relative z-10 flex items-center rounded-lg p-1",
                  GLASS_FRAME_CLASS,
                )}
              >
                <div className={GLASS_ISLAND_CLASS}>
                  <ButtonGroup>
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
                              size="icon-lg"
                              variant="ghost"
                              aria-label="Upload images"
                              className={RAIL_BUTTON_CLASS}
                            >
                              <UploadIcon />
                            </Button>
                          }
                        />
                      </UploadImagesDialog>
                      <TooltipContent side="top">
                        <span>Upload images</span>
                        <RailShortcut keys="U" />
                      </TooltipContent>
                    </Tooltip>
                    <ButtonGroupSeparator />
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
                              size="icon-lg"
                              variant="ghost"
                              aria-label="New note"
                              className={RAIL_BUTTON_CLASS}
                            >
                              <FileTextIcon />
                            </Button>
                          }
                        />
                      </CreateNoteDialog>
                      <TooltipContent side="top">
                        <span>New note</span>
                        <RailShortcut keys="N" />
                      </TooltipContent>
                    </Tooltip>
                    <ButtonGroupSeparator />
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
                              size="icon-lg"
                              variant="ghost"
                              aria-label="New color"
                              className={RAIL_BUTTON_CLASS}
                            >
                              <PaletteIcon />
                            </Button>
                          }
                        />
                      </ColorEditorDialog>
                      <TooltipContent side="top">New color</TooltipContent>
                    </Tooltip>
                    <ButtonGroupSeparator />
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
                              size="icon-lg"
                              variant="ghost"
                              aria-label="New folder"
                              className={RAIL_BUTTON_CLASS}
                            >
                              <FolderPlusIcon />
                            </Button>
                          }
                        />
                      </CreateFolderDialog>
                      <TooltipContent side="top">
                        <span>New folder</span>
                        <RailShortcut keys="D" />
                      </TooltipContent>
                    </Tooltip>
                  </ButtonGroup>
                </div>
                <div className={cn(GLASS_ISLAND_CLASS, "ml-1")}>
                  <ButtonGroup>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            size="icon-lg"
                            variant="ghost"
                            aria-label="Text tool"
                            aria-pressed={activeTool === "text"}
                            data-active={activeTool === "text" || undefined}
                            className={cn(
                              RAIL_BUTTON_CLASS,
                              activeTool === "text" &&
                                "bg-sidebar-active text-sidebar-accent-foreground",
                            )}
                            onClick={() =>
                              setCanvasTool(
                                boardKey,
                                activeTool === "text" ? "select" : "text",
                              )
                            }
                          >
                            <TypeIcon />
                          </Button>
                        }
                      />
                      <TooltipContent side="top">
                        <span>Text tool</span>
                        <RailShortcut keys="T" />
                      </TooltipContent>
                    </Tooltip>
                    <ButtonGroupSeparator />
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            size="icon-lg"
                            variant="ghost"
                            aria-label="Arrow tool"
                            aria-pressed={activeTool === "arrow"}
                            data-active={activeTool === "arrow" || undefined}
                            className={cn(
                              RAIL_BUTTON_CLASS,
                              activeTool === "arrow" &&
                                "bg-sidebar-active text-sidebar-accent-foreground",
                            )}
                            onClick={() =>
                              setCanvasTool(
                                boardKey,
                                activeTool === "arrow" ? "select" : "arrow",
                              )
                            }
                          >
                            <ArrowUpRightIcon />
                          </Button>
                        }
                      />
                      <TooltipContent side="top">Arrow tool</TooltipContent>
                    </Tooltip>
                  </ButtonGroup>
                </div>
                <div className={cn(GLASS_ISLAND_CLASS, "ml-1")}>
                  <ButtonGroup>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            size="icon-lg"
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
                      <TooltipContent side="top">
                        {pexelsBrowserOpen
                          ? "Close Pexels photos"
                          : "Browse Pexels photos"}
                      </TooltipContent>
                    </Tooltip>
                  </ButtonGroup>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

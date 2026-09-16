import {
  ChevronDownIcon,
  LayoutGridIcon,
  LockIcon,
  MinusIcon,
  PanelsTopLeftIcon,
  PlusIcon,
  ScanIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import type { BoardView } from "@/store/slices/board-slice";
import { usePersistedStore } from "@/store";
import { formatPlatformShortcut } from "@/lib/platform";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCanvasActions } from "@/components/canvas/canvas-actions-context";

const ZOOM_PRESETS = [25, 50, 75, 100, 110, 125, 150, 175, 200] as const;

export function CollectionViewMenu({
  boardKey,
  value,
  workspaceSlug,
  onChange,
}: {
  boardKey: string;
  value: BoardView;
  workspaceSlug: string;
  onChange: (view: BoardView) => void;
}) {
  const isCanvasLocked = usePersistedStore(
    (state) => state.boardLocks[boardKey] ?? false,
  );
  const setCanvasLock = usePersistedStore((state) => state.setBoardLock);
  const areAlignmentGuidesEnabled = usePersistedStore(
    (state) => state.workspaceAlignmentGuides[workspaceSlug] ?? true,
  );
  const setWorkspaceAlignmentGuides = usePersistedStore(
    (state) => state.setWorkspaceAlignmentGuides,
  );
  const isBoardActionRailVisible = usePersistedStore(
    (state) => state.workspaceBoardActionRails?.[workspaceSlug] ?? false,
  );
  const setWorkspaceBoardActionRail = usePersistedStore(
    (state) => state.setWorkspaceBoardActionRail,
  );
  const zoom = usePersistedStore(
    (state) => state.boardViewports[boardKey]?.zoom ?? 1.1,
  );
  const canvasActions = useCanvasActions();
  const viewShortcut = formatPlatformShortcut("⇧+V");
  const zoomPercentage = Math.round(zoom * 100);

  return (
    <DropdownMenu>
      <div className="mr-1 flex items-center gap-1">
        <AnimatePresence initial={false}>
          {isCanvasLocked ? (
            <motion.span
              key="canvas-lock-indicator"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex h-7 min-w-7"
            >
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      role="status"
                      aria-label="Canvas is locked"
                      className="inline-flex size-full items-center justify-center rounded-md bg-muted px-1.5 text-muted-foreground"
                    />
                  }
                >
                  <LockIcon className="size-3.5" aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>Canvas is locked</TooltipContent>
              </Tooltip>
            </motion.span>
          ) : null}
        </AnimatePresence>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="View options"
            />
          }
        >
          <PanelsTopLeftIcon className="sm:hidden" />
          <span className="max-sm:sr-only">View</span>
          <ChevronDownIcon className="max-sm:hidden" />
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent align="end" className="w-max min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Layout</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(nextValue) => onChange(nextValue as BoardView)}
          >
            <DropdownMenuRadioItem value="canvas" className="pr-1.5">
              <PanelsTopLeftIcon />
              Canvas
              {value === "grid" ? (
                <DropdownMenuShortcut>{viewShortcut}</DropdownMenuShortcut>
              ) : null}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="grid" className="pr-1.5">
              <LayoutGridIcon />
              Grid
              {value === "canvas" ? (
                <DropdownMenuShortcut>{viewShortcut}</DropdownMenuShortcut>
              ) : null}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        {value === "canvas" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Zoom</DropdownMenuLabel>
              <div className="pb-1">
                <ButtonGroup
                  orientation="horizontal"
                  aria-label="Zoom controls"
                  className="mx-1 w-auto rounded-md"
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="!border-border/70 bg-transparent text-foreground shadow-none hover:bg-foreground/10 active:bg-foreground/15"
                    aria-label="Zoom out"
                    onClick={() => canvasActions.current?.zoomOut()}
                  >
                    <MinusIcon />
                  </Button>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger
                      openOnHover={false}
                      showChevron={false}
                      className="min-w-0 flex-1 justify-center !border-border/70 bg-transparent px-2 text-xs font-medium text-foreground tabular-nums shadow-none hover:bg-background/70 focus:bg-transparent focus:text-foreground focus-visible:bg-background/70 data-popup-open:bg-background/70 data-popup-open:text-foreground data-open:bg-background/70 data-open:text-foreground"
                      render={
                        <Button type="button" variant="outline" size="sm" />
                      }
                    >
                      {zoomPercentage}%
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent
                      side="bottom"
                      align="center"
                      sideOffset={6}
                      className="min-w-24"
                    >
                      <DropdownMenuRadioGroup
                        value={String(zoomPercentage)}
                        onValueChange={(nextZoom) =>
                          canvasActions.current?.setZoom(Number(nextZoom) / 100)
                        }
                      >
                        {ZOOM_PRESETS.map((preset) => (
                          <DropdownMenuRadioItem
                            key={preset}
                            value={String(preset)}
                            closeOnClick={false}
                            className="justify-center pr-7 tabular-nums"
                          >
                            {preset}%
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="!border-border/70 bg-transparent text-foreground shadow-none hover:bg-foreground/10 active:bg-foreground/15"
                    aria-label="Zoom in"
                    onClick={() => canvasActions.current?.zoomIn()}
                  >
                    <PlusIcon />
                  </Button>
                </ButtonGroup>
              </div>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Canvas</DropdownMenuLabel>
              <DropdownMenuItem
                closeOnClick={false}
                onClick={() => canvasActions.current?.fitView()}
              >
                <ScanIcon />
                Fit in view
                <DropdownMenuShortcut>1</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuCheckboxItem
                checked={isBoardActionRailVisible}
                onCheckedChange={(visible) =>
                  setWorkspaceBoardActionRail(workspaceSlug, visible === true)
                }
              >
                Actions dock
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={isCanvasLocked}
                onCheckedChange={(locked) =>
                  setCanvasLock(boardKey, locked === true)
                }
              >
                Lock canvas
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={areAlignmentGuidesEnabled}
                onCheckedChange={(enabled) =>
                  setWorkspaceAlignmentGuides(workspaceSlug, enabled === true)
                }
              >
                Alignment guides
              </DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

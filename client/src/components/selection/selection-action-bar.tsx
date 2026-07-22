import { useState } from "react";
import {
  FolderInputIcon,
  HeartIcon,
  LayoutGridIcon,
  MoreHorizontalIcon,
  PanelsTopLeftIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FLOATING_GLASS_BACKDROP_CLASS,
  GLASS_FRAME_CLASS,
  GLASS_SURFACE_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";

type SelectionActionBarProps = {
  count: number;
  surface: "inbox" | "canvas";
  onClear: () => void;
  onDelete?: () => void;
  onArrange?: () => void;
  onCompact?: () => void;
  onMakeRow?: () => void;
  onMakeColumn?: () => void;
  className?: string;
};

const BUTTON_GROUP_SURFACE_CLASS = cn(
  "relative z-10 rounded-md",
  GLASS_SURFACE_CLASS,
);

export function SelectionActionBar({
  count,
  surface,
  onClear,
  onDelete,
  onArrange,
  onCompact,
  onMakeRow,
  onMakeColumn,
  className,
}: SelectionActionBarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const restingState = { opacity: 1, scale: 1, y: 0 };
  const hiddenState = { opacity: 0, scale: 0.9, y: -8 };

  return (
    <>
      <AnimatePresence>
        {count >= 1 ? (
          <motion.div
            key="selection-bar"
            initial={hiddenState}
            animate={restingState}
            exit={hiddenState}
            role="toolbar"
            aria-label="Selection actions"
            className="flex w-fit flex-col items-center gap-1"
            transition={{
              duration: 0.1,
              ease: [0, 0, 0.2, 1],
            }}
          >
            <div
              className={cn("relative w-fit", FLOATING_GLASS_BACKDROP_CLASS)}
            >
              <div
                className={cn(
                  "relative z-10 rounded-lg p-1",
                  GLASS_FRAME_CLASS,
                  className,
                )}
              >
                <div className="flex items-center">
                  <div className={BUTTON_GROUP_SURFACE_CLASS}>
                    <ButtonGroup>
                      <PlaceholderAction
                        label={
                          surface === "inbox" ? "Move to collection" : "Move"
                        }
                      >
                        <FolderInputIcon />
                      </PlaceholderAction>
                      <ButtonGroupSeparator className="bg-border/70" />
                      <PlaceholderAction label="Favorite">
                        <HeartIcon />
                      </PlaceholderAction>
                      <ButtonGroupSeparator className="bg-border/70" />
                      {onDelete ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                aria-label="Delete selected"
                                onClick={() => setDeleteDialogOpen(true)}
                              />
                            }
                          >
                            <Trash2Icon />
                          </TooltipTrigger>
                          <TooltipContent>Delete selected</TooltipContent>
                        </Tooltip>
                      ) : (
                        <PlaceholderAction label="Delete">
                          <Trash2Icon />
                        </PlaceholderAction>
                      )}
                    </ButtonGroup>
                  </div>
                  <AnimatePresence initial={false}>
                    {surface === "canvas" && count >= 2 ? (
                      <motion.div
                        key="layout-actions"
                        initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                        animate={{ opacity: 1, width: "auto", marginLeft: 6 }}
                        exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                        transition={{ duration: 0.1, ease: [0, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <div className={BUTTON_GROUP_SURFACE_CLASS}>
                          <ButtonGroup>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    aria-label="Arrange in grid"
                                    onClick={onArrange}
                                  />
                                }
                              >
                                <LayoutGridIcon />
                              </TooltipTrigger>
                              <TooltipContent>Arrange in grid</TooltipContent>
                            </Tooltip>
                            <ButtonGroupSeparator
                              orientation="vertical"
                              className="bg-border/70"
                            />
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    aria-label="Compact into columns"
                                    onClick={onCompact}
                                  />
                                }
                              >
                                <PanelsTopLeftIcon />
                              </TooltipTrigger>
                              <TooltipContent>
                                Compact into columns
                              </TooltipContent>
                            </Tooltip>
                            <ButtonGroupSeparator
                              orientation="vertical"
                              className="bg-border/70"
                            />
                            <LayoutActionsMenu
                              onMakeRow={onMakeRow}
                              onMakeColumn={onMakeColumn}
                            />
                          </ButtonGroup>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  <div className={cn(BUTTON_GROUP_SURFACE_CLASS, "ml-1.5")}>
                    <ButtonGroup>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Clear selection"
                              onClick={onClear}
                            />
                          }
                        >
                          <XIcon />
                        </TooltipTrigger>
                        <TooltipContent>Clear selection</TooltipContent>
                      </Tooltip>
                    </ButtonGroup>
                  </div>
                </div>
                <div className="flex items-center justify-between px-0 pt-1.5 pr-[3px] pb-0.5 text-[10px] leading-4 text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">Esc</Kbd>
                    <span>Close</span>
                  </span>
                  <span>{count} selected</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {onDelete ? (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent size="sm">
            <AlertDialogBody>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {count} items?</AlertDialogTitle>
                <AlertDialogDescription>
                  {surface === "canvas"
                    ? "Folders and their contents will be permanently deleted."
                    : "This action cannot be undone."}
                </AlertDialogDescription>
              </AlertDialogHeader>
            </AlertDialogBody>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={(event) => {
                  event.preventDefault();
                  setDeleteDialogOpen(false);
                  onDelete();
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}

function LayoutActionsMenu({
  onMakeRow,
  onMakeColumn,
}: Pick<SelectionActionBarProps, "onMakeRow" | "onMakeColumn">) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            aria-label="More layout actions"
          >
            <MoreHorizontalIcon />
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        side="bottom"
        className="w-48 border border-border/50 bg-background/70 shadow-xl"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onMakeRow}>
            Arrange in row
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onMakeColumn}>
            Arrange in column
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PlaceholderAction({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button type="button" variant="ghost" aria-label={label} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

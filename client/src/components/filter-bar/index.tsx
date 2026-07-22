import { KEYBINDINGS } from "@/lib/keybindings";
import { useEventListener } from "@/hooks/use-event-listener";
import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";
import { Fragment, useState, type ComponentType, type ReactNode } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  ImageIcon,
  LoaderCircleIcon,
  PlusIcon,
  TagIcon,
  XIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { Separator } from "@/components/ui/separator";
import { SimpleColorPicker } from "@/components/ui/color-picker";
import {
  FLOATING_GLASS_BACKDROP_CLASS,
  GLASS_FRAME_CLASS,
  GLASS_SURFACE_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";
import { useActiveModalLayer } from "@/hooks/use-active-modal-layer";
import { usePersistedStore } from "@/store";
import {
  DEFAULT_FILTER_BAR_STATE,
  FILTER_TYPES,
  MAX_COLOR_FILTERS,
  type AssetFilterType,
} from "@/store/slices/filter-bar-slice";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";

const EXTRA_COLORS = [
  { value: "#dc2626", label: "Strong Red" },
  { value: "#ea580c", label: "Deep Orange" },
  { value: "#d97706", label: "Amber" },
  { value: "#ca8a04", label: "Olive" },
  { value: "#65a30d", label: "Lime" },
  { value: "#059669", label: "Emerald" },
  { value: "#0d9488", label: "Teal" },
  { value: "#0891b2", label: "Cyan" },
  { value: "#2563eb", label: "Royal Blue" },
  { value: "#7c3aed", label: "Violet" },
  { value: "#db2777", label: "Hot Pink" },
  { value: "#be185d", label: "Deep Pink" },
];

const FILTER_COLORS = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#a855f7", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#64748b", label: "Slate" },
];

type FilterSearchStatus = {
  resultCount?: number;
  isSearching: boolean;
  focusedResultIndex?: number | null;
  onPrevious?: () => void;
  onNext?: () => void;
};

const FILTER_ISLAND_CLASS = cn("relative z-10 rounded-md", GLASS_SURFACE_CLASS);
const FILTER_ISLAND_TRANSITION = {
  duration: 0.1,
  ease: [0, 0, 0.2, 1] as const,
};
const FILTER_FRAME_TRANSITION = {
  duration: 0.16,
  ease: [0, 0, 0.2, 1] as const,
};

function AnimatedFilterIsland({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, width: 0, marginLeft: 0 }}
      animate={{ opacity: 1, width: "auto", marginLeft: 6 }}
      exit={{ opacity: 0, width: 0, marginLeft: 0 }}
      transition={FILTER_ISLAND_TRANSITION}
      className="overflow-hidden"
    >
      <div className={FILTER_ISLAND_CLASS}>{children}</div>
    </motion.div>
  );
}

function FilterControlIsland({
  controlKey,
  children,
}: {
  controlKey: string;
  children: ReactNode;
}) {
  return (
    <div className="ml-1.5">
      <div className={FILTER_ISLAND_CLASS}>
        <motion.div
          key={controlKey}
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={FILTER_ISLAND_TRANSITION}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

export function FilterBar({
  scope,
  searchStatus,
}: {
  scope: string;
  searchStatus?: FilterSearchStatus;
}) {
  const filterBar = usePersistedStore(
    (state) => state.filterBars[scope] ?? DEFAULT_FILTER_BAR_STATE,
  );
  const { open, selectedColors, selectedAssetTypes = [] } = filterBar;
  const filterType = FILTER_TYPES.includes(filterBar.filterType)
    ? filterBar.filterType
    : "Color";
  const toggle = usePersistedStore((s) => s.toggleFilterBar);
  const toggleColor = usePersistedStore((s) => s.toggleColor);
  const clearColors = usePersistedStore((s) => s.clearColors);
  const toggleAssetType = usePersistedStore((s) => s.toggleAssetType);
  const clearAssetTypes = usePersistedStore((s) => s.clearAssetTypes);
  const setFilterType = usePersistedStore((s) => s.setFilterType);
  const hasActiveModal = useActiveModalLayer();
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const canAddColor = selectedColors.length < MAX_COLOR_FILTERS;
  const hasSearchableFilter =
    (filterType === "Color" && selectedColors.length > 0) ||
    (filterType === "Type" && selectedAssetTypes.length > 0);
  const showSearchStatus =
    hasSearchableFilter &&
    searchStatus !== undefined &&
    (searchStatus.isSearching || searchStatus.resultCount !== undefined);
  const hasActiveFilter =
    (filterType === "Color" && selectedColors.length > 0) ||
    (filterType === "Type" && selectedAssetTypes.length > 0);

  function clearActiveFilter() {
    switch (filterType) {
      case "Color":
        clearColors(scope);
        break;
      case "Type":
        clearAssetTypes(scope);
        break;
    }
  }

  useIsomorphicLayoutEffect(() => {
    setPortalTarget(
      document.querySelector<HTMLElement>('[data-slot="sidebar-inset"]'),
    );
  }, []);

  useEventListener("keydown", (event) => {
    if (event.repeat || hasActiveModal) return;

    if (event.shiftKey && event.code === KEYBINDINGS.FILTER_BAR_TOGGLE.code) {
      event.preventDefault();
      toggle(scope);
    }
  });

  if (!portalTarget) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 8 }}
          transition={FILTER_ISLAND_TRANSITION}
          className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center"
        >
          <div className="pointer-events-auto relative w-fit">
            <div
              className={cn("relative w-fit", FLOATING_GLASS_BACKDROP_CLASS)}
            >
              <motion.div
                layout="size"
                transition={FILTER_FRAME_TRANSITION}
                className={cn(
                  "relative z-10 flex items-center rounded-lg p-1",
                  GLASS_FRAME_CLASS,
                )}
              >
                <div className={FILTER_ISLAND_CLASS}>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="group flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-foreground transition-colors duration-75 hover:bg-foreground/5 focus-visible:outline-none data-popup-open:bg-foreground/5">
                      <span>{filterType}</span>
                      <ChevronDownIcon className="size-3.5 text-foreground transition-colors duration-75" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="center"
                      side="top"
                      sideOffset={16}
                      className="border border-border/50 bg-background/60 shadow-2xl"
                    >
                      {FILTER_TYPES.map((type) => (
                        <DropdownMenuItem
                          key={type}
                          onClick={() => setFilterType(scope, type)}
                          className="gap-2 px-3 py-1.5 text-sm"
                        >
                          <span className="flex-1">{type}</span>
                          {type === filterType && (
                            <CheckIcon className="size-3.5" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <FilterControlIsland controlKey={filterType}>
                  {filterType === "Color" ? (
                    <ButtonGroup>
                      <Popover>
                        <PopoverTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground transition-all duration-100 hover:bg-foreground/5 hover:text-foreground active:scale-95 data-popup-open:bg-foreground/5 data-popup-open:text-foreground"
                              aria-label="Pick a custom color"
                            />
                          }
                        >
                          <PlusIcon className="size-3.5" />
                        </PopoverTrigger>
                        <PopoverContent
                          side="top"
                          align="start"
                          sideOffset={16}
                          className="w-64 border border-border/50 bg-background/60 shadow-2xl backdrop-blur-2xl backdrop-saturate-150"
                        >
                          <div className="flex flex-col gap-3">
                            <SimpleColorPicker
                              onPick={(color) => toggleColor(scope, color)}
                            />
                            <Separator orientation="horizontal" />
                            <div className="flex flex-wrap gap-1.5">
                              {EXTRA_COLORS.map(({ value, label }) => {
                                const active = selectedColors.includes(value);
                                return (
                                  <button
                                    key={value}
                                    type="button"
                                    aria-label={label}
                                    aria-pressed={active}
                                    data-active={active || undefined}
                                    onClick={() => toggleColor(scope, value)}
                                    disabled={!active && !canAddColor}
                                    className={cn(
                                      "size-5 rounded-[min(var(--radius-md),8px)] shadow-[inset_0_0_0_1.5px_rgba(0,0,0,0.25)] transition-all duration-100 hover:scale-105 data-active:scale-90 data-active:hover:scale-95",
                                      active &&
                                        "ring-offset-background shadow-[inset_0_0_0_1.5px_rgba(0,0,0,0.45)] ring-2 ring-white/60 ring-offset-1",
                                    )}
                                    style={{ backgroundColor: value }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <ButtonGroupSeparator className="bg-border/60 data-vertical:my-0" />
                      <div className="flex h-8 items-center gap-2 px-2">
                        {FILTER_COLORS.map(({ value, label }) => {
                          const active = selectedColors.includes(value);
                          return (
                            <button
                              key={value}
                              type="button"
                              aria-label={label}
                              aria-pressed={active}
                              data-active={active || undefined}
                              onClick={() => toggleColor(scope, value)}
                              disabled={!active && !canAddColor}
                              className={cn(
                                "size-6 rounded-[min(var(--radius-md),10px)] shadow-[inset_0_0_0_1.5px_rgba(0,0,0,0.25)] transition-all duration-100 hover:scale-105 data-active:scale-90 data-active:hover:scale-95",
                                active &&
                                  "ring-offset-background shadow-[inset_0_0_0_1.5px_rgba(0,0,0,0.45)] ring-2 ring-white/60 ring-offset-2",
                              )}
                              style={{ backgroundColor: value }}
                            />
                          );
                        })}
                      </div>
                    </ButtonGroup>
                  ) : filterType === "Tags" ? (
                    <TagsFilterControl />
                  ) : (
                    <AssetTypeFilterControl
                      selectedTypes={selectedAssetTypes}
                      onToggle={(type) => toggleAssetType(scope, type)}
                    />
                  )}
                </FilterControlIsland>

                <AnimatePresence initial={false}>
                  {showSearchStatus ? (
                    <AnimatedFilterIsland key="filter-search-status">
                      <FilterSearchStatusIsland status={searchStatus} />
                    </AnimatedFilterIsland>
                  ) : null}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {hasActiveFilter ? (
                    <AnimatedFilterIsland key="clear-filter">
                      <button
                        type="button"
                        onClick={clearActiveFilter}
                        aria-label="Clear all filters"
                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-all duration-100 hover:bg-foreground/5 hover:text-foreground active:scale-95"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </AnimatedFilterIsland>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalTarget,
  );
}

function FilterSearchStatusIsland({ status }: { status: FilterSearchStatus }) {
  const hasResults = (status.resultCount ?? 0) > 0;
  const supportsNavigation =
    status.onPrevious !== undefined && status.onNext !== undefined;
  const currentResult =
    status.focusedResultIndex === null ||
    status.focusedResultIndex === undefined
      ? undefined
      : status.focusedResultIndex + 1;

  return (
    <div
      className={cn(
        "flex h-8 min-w-24 items-center gap-1.5 px-2.5 text-xs text-muted-foreground",
        !hasResults && !status.isSearching && "justify-center",
      )}
      aria-live="polite"
    >
      {status.isSearching ? (
        <LoaderCircleIcon
          className="size-3 animate-spin"
          aria-label="Searching"
        />
      ) : null}
      <span className="min-w-0 truncate text-nowrap tabular-nums">
        {status.resultCount === undefined
          ? status.isSearching
            ? "Searching…"
            : ""
          : status.resultCount === 0
            ? "No matches"
            : currentResult
              ? `${currentResult} of ${status.resultCount}`
              : `${status.resultCount} matches`}
      </span>
      {supportsNavigation && hasResults ? (
        <>
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-[min(var(--radius-md),10px)] transition-colors hover:bg-foreground/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
            aria-label="Previous match"
            onClick={() => status.onPrevious?.()}
            disabled={status.resultCount === 1}
          >
            <ChevronLeftIcon className="size-3.5" />
          </button>
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-[min(var(--radius-md),10px)] transition-colors hover:bg-foreground/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
            aria-label="Next match"
            onClick={() => status.onNext?.()}
            disabled={status.resultCount === 1}
          >
            <ChevronRightIcon className="size-3.5" />
          </button>
        </>
      ) : null}
    </div>
  );
}

function TagsFilterControl() {
  return (
    <div className="flex h-8 items-center gap-1.5 px-3 text-xs text-muted-foreground">
      <TagIcon className="size-3.5 shrink-0" />
      <span>No tags yet</span>
    </div>
  );
}

const ASSET_TYPE_OPTIONS: Array<{
  type: AssetFilterType;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { type: "image", label: "Images", icon: ImageIcon },
  { type: "note", label: "Notes", icon: FileTextIcon },
  { type: "folder", label: "Folders", icon: FolderIcon },
];

function AssetTypeFilterControl({
  selectedTypes,
  onToggle,
}: {
  selectedTypes: AssetFilterType[];
  onToggle: (type: AssetFilterType) => void;
}) {
  return (
    <ButtonGroup>
      {ASSET_TYPE_OPTIONS.map(({ type, label, icon: Icon }, index) => {
        const active = selectedTypes.includes(type);

        return (
          <Fragment key={type}>
            {index > 0 ? (
              <ButtonGroupSeparator className="bg-border/70" />
            ) : null}
            <Button
              type="button"
              variant="ghost"
              aria-pressed={active}
              onClick={() => onToggle(type)}
              className={cn(
                "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                active && "bg-foreground/8 text-foreground",
              )}
            >
              <Icon />
              {label}
            </Button>
          </Fragment>
        );
      })}
    </ButtonGroup>
  );
}

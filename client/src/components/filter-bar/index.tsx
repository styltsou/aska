import { KEYBINDINGS } from "@/lib/keybindings";
import { useEventListener } from "@/hooks/use-event-listener";
import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronDownIcon, PlusIcon, XIcon } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { SimpleColorPicker } from "@/components/ui/color-picker";
import { cn } from "@/lib/utils";
import { useActiveModalLayer } from "@/hooks/use-active-modal-layer";
import { useStore } from "@/store";

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

const FILTER_TYPES = ["Color", "Status", "Type", "Date"] as const;

export function FilterBar() {
  const open = useStore((s) => s.filterBarOpen);
  const toggle = useStore((s) => s.toggleFilterBar);
  const setOpen = useStore((s) => s.setFilterBarOpen);
  const selectedColors = useStore((s) => s.selectedColors);
  const toggleColor = useStore((s) => s.toggleColor);
  const clearColors = useStore((s) => s.clearColors);
  const filterType = useStore((s) => s.filterType);
  const setFilterType = useStore((s) => s.setFilterType);
  const hasActiveModal = useActiveModalLayer();

  useEventListener("keydown", (event) => {
    if (event.repeat || hasActiveModal) return;

    if (event.shiftKey && event.code === KEYBINDINGS.FILTER_BAR_TOGGLE.code) {
      event.preventDefault();
      toggle();
    }

    if (event.key === "Escape" && open) {
      setOpen(false);
    }
  });

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: 64, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 64, opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.05, ease: [0, 0, 0.2, 1] }}
          className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center"
        >
          <motion.div
            layout
            transition={{ duration: 0.05, ease: [0, 0, 0.2, 1] }}
            className="pointer-events-auto relative flex items-stretch rounded-lg border border-border/50 bg-background/60 shadow-2xl ring-1 ring-foreground/10 before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:backdrop-blur-2xl before:backdrop-saturate-150"
          >
            <DropdownMenu>
              <DropdownMenuTrigger className="group flex items-stretch rounded-l-lg p-0.5 focus-visible:outline-none">
                <div className="flex items-center gap-1.5 rounded-l-[calc(var(--radius-lg)-2px)] px-2.5 transition-colors duration-75 group-hover:bg-foreground/5 group-data-popup-open:bg-foreground/5">
                  <span className="text-sm font-medium text-muted-foreground transition-colors duration-75 group-hover:text-foreground group-data-popup-open:text-foreground">
                    {filterType}
                  </span>
                  <ChevronDownIcon className="size-3.5 text-muted-foreground/50 transition-colors duration-75 group-hover:text-foreground group-data-popup-open:text-foreground" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" sideOffset={8}>
                {FILTER_TYPES.map((type) => (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => setFilterType(type)}
                    className="gap-2 px-3 py-1.5 text-sm"
                  >
                    <span className="flex-1">{type}</span>
                    {type === filterType && <CheckIcon className="size-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="shrink-0 bg-border" />

            <div className="flex items-center gap-3 py-2 pr-3 pl-3">
              <Popover>
                <PopoverTrigger
                  className="flex size-6 items-center justify-center rounded-[min(var(--radius-md),10px)] border border-dashed border-foreground/15 text-muted-foreground transition-all duration-100 hover:border-foreground/30 hover:bg-foreground/5 hover:text-foreground active:scale-95 data-popup-open:border-foreground/30 data-popup-open:bg-foreground/5 data-popup-open:text-foreground"
                  aria-label="Pick a custom color"
                >
                  <PlusIcon className="size-3.5" />
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="start"
                  sideOffset={16}
                  className="w-64"
                >
                  <div className="flex flex-col gap-3">
                    <SimpleColorPicker onPick={toggleColor} />
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
                            onClick={() => toggleColor(value)}
                            className={cn(
                              "size-5 rounded-[min(var(--radius-md),8px)] shadow-[inset_0_0_0_1.5px_rgba(0,0,0,0.25)] transition-all duration-100 hover:scale-105 data-active:scale-90 data-active:hover:scale-95",
                              active &&
                                "ring-offset-popover shadow-[inset_0_0_0_1.5px_rgba(0,0,0,0.45)] ring-2 ring-white/60 ring-offset-1",
                            )}
                            style={{ backgroundColor: value }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <div className="h-5 w-px bg-border/50" />
              {FILTER_COLORS.map(({ value, label }) => {
                const active = selectedColors.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={label}
                    aria-pressed={active}
                    data-active={active || undefined}
                    onClick={() => toggleColor(value)}
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

            {selectedColors.length > 0 && (
              <div className="flex items-center rounded-r-lg py-2 pr-3">
                <button
                  type="button"
                  onClick={clearColors}
                  aria-label="Clear all filters"
                  className="flex size-7 items-center justify-center rounded-[min(var(--radius-md),12px)] text-muted-foreground transition-all duration-100 hover:bg-foreground/5 hover:text-foreground active:scale-95"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

import { Fragment, useCallback, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import {
  useCreateColor,
  useCreateInboxColor,
  useUpdateColor,
  type BoardInsertionPlacement,
} from "@/api/collection";
import { Button } from "@/components/ui/button";
import { SimpleColorPicker } from "@/components/ui/color-picker";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  colorAtPosition,
  gradientToCss,
  sortGradientStops,
  type GradientStop,
  type GradientType,
} from "@/lib/color-gradient";
import { GLASS_FRAME_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import type { ColorAsset } from "@/types/asset";

type EditorMode = "solid" | "gradient";

const DEFAULT_HEX = "#00a8ff";
const DEFAULT_GRADIENT_END = "#7c3aed";
const DEFAULT_GRADIENT_ANGLE = 135;
const MAX_STOPS = 12;
const CHECKERBOARD_BACKGROUND =
  "conic-gradient(#d1d5db 25%, white 0 50%, #d1d5db 0 75%, white 0)";
const CHECKERBOARD_BACKGROUND_SIZE = "100% 100%, 8px 8px";

function withCheckerboardBackground(backgroundImage: string) {
  return {
    backgroundImage: `${backgroundImage}, ${CHECKERBOARD_BACKGROUND}`,
    backgroundSize: CHECKERBOARD_BACKGROUND_SIZE,
  };
}

const createStopId = () => `gradient-stop-${uuidv4()}`;

const PRESETS: Array<{
  name: string;
  stops: Array<{ color: string; position: number }>;
}> = [
  {
    name: "Lagoon",
    stops: [
      { color: "#168aad", position: 0 },
      { color: "#76c893", position: 55 },
      { color: "#f9e45b", position: 100 },
    ],
  },
  {
    name: "Nightfall",
    stops: [
      { color: "#020024", position: 0 },
      { color: "#0047ff", position: 100 },
    ],
  },
  {
    name: "Heat",
    stops: [
      { color: "#ff3d71", position: 0 },
      { color: "#ffb800", position: 100 },
    ],
  },
  {
    name: "Bloom",
    stops: [
      { color: "#5433ff", position: 0 },
      { color: "#e85dff", position: 50 },
      { color: "#ff6b9d", position: 100 },
    ],
  },
  {
    name: "Mist",
    stops: [
      { color: "#f4d7ff", position: 0 },
      { color: "#a9c9ff", position: 100 },
    ],
  },
];

function initialStops(color?: ColorAsset): GradientStop[] {
  const persisted = color?.gradient?.stops;
  const stops =
    persisted && persisted.length >= 2
      ? persisted
      : [
          {
            color: color?.gradient?.from ?? color?.hex ?? DEFAULT_HEX,
            position: 0,
          },
          { color: color?.gradient?.to ?? DEFAULT_GRADIENT_END, position: 100 },
        ];

  return stops.map((stop, index) => ({
    ...stop,
    id: `initial-gradient-stop-${index}`,
  }));
}

function safeColorInput(color: string) {
  return /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)
    ? color
    : "#000000";
}

export function ColorEditorDialog({
  workspaceSlug,
  collectionPath,
  target = "collection",
  color,
  children,
  open: controlledOpen,
  onOpenChange,
  placement,
}: {
  workspaceSlug: string;
  collectionPath?: string;
  target?: "collection" | "inbox";
  color?: ColorAsset;
  children?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: BoardInsertionPlacement;
}) {
  const [collectionSlug = "", ...folderSegments] = (collectionPath ?? "")
    .split("/")
    .filter(Boolean);
  const parentFolderPath = folderSegments.join("/") || undefined;
  const createColor = useCreateColor(workspaceSlug, collectionSlug);
  const createInboxColor = useCreateInboxColor(workspaceSlug);
  const updateColor = useUpdateColor(workspaceSlug);
  const [internalOpen, setInternalOpen] = useState(false);
  const [draftHex, setDraftHex] = useState(color?.hex ?? DEFAULT_HEX);
  const [mode, setMode] = useState<EditorMode>(
    color?.gradient ? "gradient" : "solid",
  );
  const [gradientStops, setGradientStops] = useState<GradientStop[]>(() =>
    initialStops(color),
  );
  const [gradientType, setGradientType] = useState<GradientType>(
    color?.gradient?.type ?? "linear",
  );
  const [gradientAngle, setGradientAngle] = useState(
    color?.gradient?.angle ?? DEFAULT_GRADIENT_ANGLE,
  );
  const [activeStopId, setActiveStopId] = useState("initial-gradient-stop-0");
  const [openStopId, setOpenStopId] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const lastAddedStopRef = useRef<{ position: number; time: number } | null>(
    null,
  );
  const open = controlledOpen ?? internalOpen;
  const isEditing = color !== undefined;
  const isPending = isEditing
    ? updateColor.isPending
    : target === "inbox"
      ? createInboxColor.isPending
      : createColor.isPending;
  const isGradient = mode === "gradient";
  const sortedStops = sortGradientStops(gradientStops);
  const gradientCss = gradientToCss(gradientStops, gradientType, gradientAngle);
  const gradientTrackCss = gradientToCss(gradientStops, "linear", 90);
  const knobIndicatorRadians = ((gradientAngle - 90) * Math.PI) / 180;
  const knobIndicatorPosition = {
    left: `${50 + Math.cos(knobIndicatorRadians) * 24}%`,
    top: `${50 + Math.sin(knobIndicatorRadians) * 24}%`,
  };

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange?.(nextOpen);
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
  }

  function updateStop(id: string, update: Partial<GradientStop>) {
    setGradientStops((stops) =>
      stops.map((stop) => (stop.id === id ? { ...stop, ...update } : stop)),
    );
  }

  const updateActiveStopColor = useCallback(
    (colorValue: string) => {
      setGradientStops((stops) => {
        let changed = false;
        const next = stops.map((stop) => {
          if (stop.id !== activeStopId || stop.color === colorValue)
            return stop;
          changed = true;
          return { ...stop, color: colorValue };
        });
        return changed ? next : stops;
      });
    },
    [activeStopId],
  );

  function positionFromPointer(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.round(
      Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * 100,
    );
  }

  function addStop(event: React.PointerEvent<HTMLDivElement>) {
    if (gradientStops.length >= MAX_STOPS) return;
    const position = positionFromPointer(event.clientX);
    const now = performance.now();
    const lastAddedStop = lastAddedStopRef.current;
    if (
      lastAddedStop &&
      now - lastAddedStop.time < 150 &&
      Math.abs(lastAddedStop.position - position) <= 1
    ) {
      return;
    }
    lastAddedStopRef.current = { position, time: now };
    const stop: GradientStop = {
      id: createStopId(),
      color: colorAtPosition(gradientStops, position),
      position,
    };
    setGradientStops((stops) => [...stops, stop]);
    setActiveStopId(stop.id);
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    const stops = preset.stops.map((stop) => ({ ...stop, id: createStopId() }));
    setGradientStops(stops);
    setActiveStopId(stops[0]!.id);
  }

  async function handleSave() {
    const firstStop = sortedStops[0]!;
    const lastStop = sortedStops.at(-1)!;
    const gradient = isGradient
      ? {
          from: firstStop.color,
          to: lastStop.color,
          angle: gradientAngle,
          type: gradientType,
          stops: sortedStops.map(({ color, position }) => ({
            color,
            position,
          })),
        }
      : null;
    const hex = isGradient ? firstStop.color : draftHex;

    try {
      if (color) {
        await updateColor.mutateAsync({ assetId: color.id, hex, gradient });
        toast.success("Color updated.");
      } else if (target === "inbox") {
        await createInboxColor.mutateAsync({
          hex,
          ...(gradient ? { gradient } : {}),
        });
        toast.success("Color added to Inbox.");
      } else {
        await createColor.mutateAsync({
          hex,
          ...(gradient ? { gradient } : {}),
          parentFolderPath,
          placement,
        });
        toast.success("Color added.");
      }
      handleOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save color.",
      );
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} fast>
      {children ? <DrawerTrigger render={children} /> : null}
      <DrawerContent
        className={cn(
          GLASS_FRAME_CLASS,
          "transition-[width,transform,height,opacity,filter] md:[--translate-x:-50%] md:data-[swipe-axis=y]:inset-x-auto md:data-[swipe-axis=y]:left-1/2",
          isGradient
            ? "md:data-[swipe-axis=y]:w-[min(calc(100%-2rem),68rem)]"
            : "md:data-[swipe-axis=y]:w-[min(calc(100%-2rem),44rem)]",
        )}
      >
        <DrawerHeader className="w-full !p-0 text-left">
          <div className="flex w-full items-center justify-between gap-4 p-3">
            <DrawerTitle className="font-sans text-sm leading-5 font-medium">
              {isEditing ? "Edit color" : "New color"}
            </DrawerTitle>
            <Tabs
              value={mode}
              onValueChange={(value) => setMode(value as EditorMode)}
              variant="segment"
              className="shrink-0"
            >
              <TabsList aria-label="Color type">
                <TabsTrigger value="solid" className="px-3 py-1.5 capitalize">
                  Solid
                </TabsTrigger>
                <TabsTrigger
                  value="gradient"
                  className="px-3 py-1.5 capitalize"
                >
                  Gradient
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-x-clip overflow-y-auto rounded-t-xl border-t border-border bg-background/85 backdrop-blur-sm">
          <div className="w-full">
            {isGradient ? (
              <div className="space-y-4 p-3">
                <div className="grid items-start justify-center gap-8 md:grid-cols-[24rem_minmax(0,1fr)]">
                  <div className="flex min-w-0 flex-col gap-3 md:order-last">
                    <div className="flex items-center justify-between gap-2">
                      <Tabs
                        value={gradientType}
                        onValueChange={(value) =>
                          setGradientType(value as GradientType)
                        }
                        variant="segment"
                        className="text-sm"
                        transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <TabsList aria-label="Gradient type">
                          <TabsTrigger
                            value="linear"
                            className="px-2.5 py-1 capitalize"
                          >
                            Linear
                          </TabsTrigger>
                          <TabsTrigger
                            value="radial"
                            className="px-2.5 py-1 capitalize"
                          >
                            Radial
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={gradientType === "radial"}
                          className="relative size-8 shrink-0 touch-none rounded-full border-2 border-primary bg-background disabled:cursor-not-allowed disabled:opacity-50"
                          onPointerDown={(event) => {
                            const knob = event.currentTarget;
                            knob.setPointerCapture(event.pointerId);
                            const updateAngle = (
                              clientX: number,
                              clientY: number,
                            ) => {
                              const rect = knob.getBoundingClientRect();
                              const angle =
                                (Math.atan2(
                                  clientY - (rect.top + rect.height / 2),
                                  clientX - (rect.left + rect.width / 2),
                                ) *
                                  180) /
                                Math.PI;
                              setGradientAngle(Math.round((angle + 450) % 360));
                            };
                            updateAngle(event.clientX, event.clientY);
                          }}
                          onPointerMove={(event) => {
                            if (
                              !event.currentTarget.hasPointerCapture(
                                event.pointerId,
                              )
                            )
                              return;
                            const rect =
                              event.currentTarget.getBoundingClientRect();
                            const angle =
                              (Math.atan2(
                                event.clientY - (rect.top + rect.height / 2),
                                event.clientX - (rect.left + rect.width / 2),
                              ) *
                                180) /
                              Math.PI;
                            setGradientAngle(Math.round((angle + 450) % 360));
                          }}
                          onPointerUp={(event) =>
                            event.currentTarget.releasePointerCapture(
                              event.pointerId,
                            )
                          }
                          aria-label="Adjust gradient angle"
                        >
                          <span
                            className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
                            style={knobIndicatorPosition}
                          />
                        </button>
                        <Input
                          className="w-16 text-center font-mono disabled:cursor-not-allowed disabled:opacity-50"
                          type="number"
                          min="0"
                          max="360"
                          value={gradientAngle}
                          disabled={gradientType === "radial"}
                          onChange={(event) =>
                            setGradientAngle(
                              Math.max(
                                0,
                                Math.min(360, Number(event.target.value)),
                              ),
                            )
                          }
                          aria-label="Gradient angle"
                        />
                      </div>
                    </div>
                    <div className="order-3 grid h-44 w-full grid-cols-[minmax(0,1fr)_4.5rem] gap-3">
                      <div
                        className="min-h-0 rounded-xl border border-border shadow-inner"
                        style={withCheckerboardBackground(gradientCss)}
                        aria-label="Gradient preview"
                      />
                      <div className="order-last grid auto-rows-fr gap-1.5">
                        {PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            className="min-h-0 w-full rounded-md border border-border shadow-sm transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            style={{
                              background: gradientToCss(
                                preset.stops,
                                "linear",
                                90,
                              ),
                            }}
                            onClick={() => applyPreset(preset)}
                            aria-label={`Use ${preset.name} gradient`}
                            title={preset.name}
                          />
                        ))}
                      </div>
                    </div>
                    <div
                      ref={trackRef}
                      className="relative order-2 mb-8 h-8 cursor-copy rounded-md border border-border"
                      style={{ background: gradientTrackCss }}
                      onPointerDown={addStop}
                    >
                      {sortedStops.map((stop) => (
                        <Fragment key={stop.id}>
                          <button
                            type="button"
                            aria-label={`Stop at ${stop.position}%`}
                            className={cn(
                              "absolute top-1/2 z-10 h-9 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-sm border-[3px] border-white shadow-[0_0_0_1px_rgb(0_0_0_/_0.45)]",
                              activeStopId === stop.id && "ring-2 ring-ring",
                            )}
                            style={{
                              left: `${stop.position}%`,
                              background: stop.color,
                            }}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              setActiveStopId(stop.id);
                              event.currentTarget.setPointerCapture(
                                event.pointerId,
                              );
                            }}
                            onPointerMove={(event) => {
                              if (
                                !event.currentTarget.hasPointerCapture(
                                  event.pointerId,
                                )
                              )
                                return;
                              updateStop(stop.id, {
                                position: positionFromPointer(event.clientX),
                              });
                            }}
                            onPointerUp={(event) =>
                              event.currentTarget.releasePointerCapture(
                                event.pointerId,
                              )
                            }
                          />
                          <span
                            className="pointer-events-none absolute top-[calc(50%+1.375rem)] rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground tabular-nums shadow-sm"
                            style={{
                              ...(stop.position <= 1
                                ? { left: 0, transform: "translateX(0)" }
                                : stop.position >= 99
                                  ? { right: 0, transform: "translateX(0)" }
                                  : {
                                      left: `${stop.position}%`,
                                      transform: "translateX(-50%)",
                                    }),
                            }}
                          >
                            {Math.round(stop.position)}
                          </span>
                        </Fragment>
                      ))}
                    </div>
                  </div>

                  <section
                    className="space-y-2 md:order-first"
                    aria-label="Gradient stops"
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      {sortedStops.map((stop) => (
                        <motion.div
                          key={stop.id}
                          layout="position"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{
                            duration: 0.1,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="space-y-2"
                        >
                          <div
                            className={cn(
                              "flex items-center gap-2 rounded-lg p-2 transition-colors duration-100",
                              activeStopId === stop.id
                                ? "bg-muted"
                                : "hover:bg-muted/60",
                            )}
                          >
                            <Popover
                              open={openStopId === stop.id}
                              onOpenChange={(nextOpen) =>
                                setOpenStopId(nextOpen ? stop.id : null)
                              }
                            >
                              <PopoverTrigger
                                render={
                                  <button
                                    type="button"
                                    className="size-8 shrink-0 cursor-pointer rounded-md border border-black/10"
                                    style={withCheckerboardBackground(
                                      `linear-gradient(${stop.color}, ${stop.color})`,
                                    )}
                                    onClick={() => setActiveStopId(stop.id)}
                                    aria-label={`Edit color for stop at ${stop.position}%`}
                                  />
                                }
                              />
                              <PopoverContent
                                side="left"
                                align="start"
                                className="w-72"
                              >
                                <SimpleColorPicker
                                  key={stop.id}
                                  initialHex={safeColorInput(stop.color)}
                                  onPick={() => undefined}
                                  onChange={updateActiveStopColor}
                                  showAction={false}
                                  disabled={isPending}
                                  compact
                                  showAlpha
                                />
                              </PopoverContent>
                            </Popover>
                            <Input
                              className="min-w-0 flex-1 font-mono"
                              value={stop.color}
                              onFocus={() => setActiveStopId(stop.id)}
                              onChange={(event) =>
                                updateStop(stop.id, {
                                  color: event.target.value,
                                })
                              }
                              aria-label={`Hex color for stop at ${stop.position}%`}
                            />
                            <Input
                              className="w-16 text-center font-mono"
                              type="number"
                              min="0"
                              max="100"
                              value={stop.position}
                              onFocus={() => setActiveStopId(stop.id)}
                              onChange={(event) =>
                                updateStop(stop.id, {
                                  position: Math.max(
                                    0,
                                    Math.min(100, Number(event.target.value)),
                                  ),
                                })
                              }
                              aria-label="Stop position"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="group/stop-remove cursor-pointer text-muted-foreground hover:!text-primary disabled:cursor-not-allowed"
                              disabled={gradientStops.length <= 2}
                              onClick={() => {
                                const remaining = gradientStops.filter(
                                  (candidate) => candidate.id !== stop.id,
                                );
                                setGradientStops(remaining);
                                if (activeStopId === stop.id)
                                  setActiveStopId(remaining[0]!.id);
                              }}
                              aria-label="Remove stop"
                            >
                              <XIcon className="transition-colors duration-100 group-hover/stop-remove:text-primary" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </section>
                </div>
              </div>
            ) : (
              <div className="grid w-full gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_10.5rem]">
                <SimpleColorPicker
                  initialHex={draftHex}
                  onPick={() => undefined}
                  onChange={setDraftHex}
                  showAction={false}
                  disabled={isPending}
                  compact
                  showAlpha
                  thickRanges
                  tallPicker
                />
                <div className="grid h-full grid-rows-[minmax(0,1fr)_auto] gap-3 self-stretch">
                  <div
                    className="aspect-square w-full self-start rounded-xl border border-border shadow-inner"
                    style={withCheckerboardBackground(
                      `linear-gradient(${draftHex}, ${draftHex})`,
                    )}
                  />
                  <Input
                    className="w-full"
                    value={draftHex}
                    disabled={isPending}
                    onChange={(event) => setDraftHex(event.target.value)}
                    aria-label="Solid hex color"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DrawerFooter className="w-full bg-background !p-0">
          <div className="flex w-full flex-col gap-2 p-3 sm:flex-row sm:justify-between">
            <DrawerClose render={<Button variant="outline">Cancel</Button>} />
            <Button disabled={isPending} onClick={() => void handleSave()}>
              {isEditing ? "Save" : "Create color"}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

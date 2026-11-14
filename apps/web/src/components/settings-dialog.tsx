import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/components/theme-provider";
import { AccountSettings } from "@/components/auth/account-settings";
import { Button } from "@/components/ui/button";
import { BellIcon, PaletteIcon, UserRoundIcon, XIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SETTINGS_REQUEST_EVENT, closeSettings } from "@/lib/settings-dialog";
import { useWorkspaceOverlayNavigation } from "@/components/app-shell/use-workspace-overlay-navigation";
import {
  CANVAS_PATTERNS,
  CANVAS_PATTERN_PREVIEWS,
  useCanvasPattern,
  type CanvasPattern,
} from "@/components/canvas/canvas-pattern";

const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

type ThemeValue = (typeof THEMES)[number]["value"];

const SETTINGS_SECTIONS = [
  { value: "appearance", label: "Appearance", icon: PaletteIcon },
  { value: "account", label: "Account", icon: UserRoundIcon },
  { value: "notifications", label: "Notifications", icon: BellIcon },
] as const;

type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["value"];

function nextOptionIndex(
  key: string,
  current: number,
  count: number,
  orientation: "horizontal" | "vertical",
) {
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === (orientation === "horizontal" ? "ArrowRight" : "ArrowDown")) {
    return (current + 1) % count;
  }
  if (key === (orientation === "horizontal" ? "ArrowLeft" : "ArrowUp")) {
    return (current - 1 + count) % count;
  }
  return null;
}

function ThemePreviewScene({ dark }: { dark: boolean }) {
  const background = dark ? "#171717" : "#ffffff";
  const sidebar = dark ? "#242424" : "#f9f9f9";
  const card = dark ? "#292929" : "#ffffff";
  const border = dark ? "#3d3d3d" : "#e7e7e7";
  const foreground = dark ? "#f4f4f4" : "#252525";
  const muted = dark ? "#858585" : "#a3a3a3";

  return (
    <>
      <rect width="240" height="140" fill={background} />
      <rect width="240" height="20" fill={sidebar} />
      <path d="M0 20H240M58 20V140" stroke={border} />
      <rect x="0" y="20" width="58" height="120" fill={sidebar} />
      <path d="M58 20V140" stroke={border} />
      <circle cx="12" cy="10" r="2" fill={muted} />
      <circle cx="19" cy="10" r="2" fill={muted} opacity=".6" />
      <circle cx="26" cy="10" r="2" fill={muted} opacity=".35" />
      <text
        x="68"
        y="13"
        fill={foreground}
        fontSize="7"
        fontWeight="600"
        fontFamily="Inter, sans-serif"
      >
        mnemee
      </text>
      <rect
        x="8"
        y="33"
        width="42"
        height="10"
        rx="2"
        fill={dark ? "#383838" : "#eaeaea"}
      />
      <rect
        x="13"
        y="37"
        width="22"
        height="2"
        rx="1"
        fill={foreground}
        opacity=".7"
      />
      <rect x="13" y="53" width="27" height="2" rx="1" fill={muted} />
      <rect x="13" y="65" width="19" height="2" rx="1" fill={muted} />
      <rect x="13" y="77" width="24" height="2" rx="1" fill={muted} />
      <text
        x="76"
        y="45"
        fill={foreground}
        fontSize="13"
        fontWeight="600"
        fontFamily="Inter, sans-serif"
      >
        Ideas
      </text>
      <rect
        x="76"
        y="58"
        width="69"
        height="62"
        rx="4"
        fill={card}
        stroke={border}
      />
      <rect
        x="85"
        y="68"
        width="35"
        height="3"
        rx="1.5"
        fill={foreground}
        opacity=".8"
      />
      <rect x="85" y="78" width="48" height="2" rx="1" fill={muted} />
      <rect x="85" y="85" width="39" height="2" rx="1" fill={muted} />
      <rect
        x="85"
        y="101"
        width="22"
        height="10"
        rx="2"
        fill={dark ? "#454545" : "#eeeeee"}
      />
      <rect
        x="153"
        y="70"
        width="68"
        height="51"
        rx="4"
        fill={card}
        stroke={border}
      />
      <rect
        x="162"
        y="79"
        width="26"
        height="3"
        rx="1.5"
        fill={foreground}
        opacity=".8"
      />
      <rect x="162" y="90" width="47" height="2" rx="1" fill={muted} />
      <rect x="162" y="97" width="35" height="2" rx="1" fill={muted} />
    </>
  );
}

function ThemePreview({ theme }: { theme: ThemeValue }) {
  return (
    <svg
      aria-hidden="true"
      className="block size-full rounded-[3px]"
      viewBox="0 0 240 140"
      preserveAspectRatio="xMidYMid slice"
    >
      <ThemePreviewScene dark={theme === "dark"} />
      {theme === "system" && (
        <>
          <defs>
            <clipPath id="settings-system-preview-dark">
              <rect x="120" width="120" height="140" />
            </clipPath>
          </defs>
          <g clipPath="url(#settings-system-preview-dark)">
            <ThemePreviewScene dark />
          </g>
          <path d="M120 0V140" stroke="#a3a3a3" strokeOpacity=".55" />
        </>
      )}
    </svg>
  );
}

function CanvasPatternPreview({ pattern }: { pattern: CanvasPattern }) {
  const style = pattern === "none" ? null : CANVAS_PATTERN_PREVIEWS[pattern];
  const patternId = `settings-canvas-${pattern}`;
  const gap = style?.gap ?? 1;
  const radius = style?.radius ?? 1;
  const size = style?.size ?? 1;
  const lineWidth = style?.lineWidth ?? 1;

  return (
    <svg
      aria-hidden="true"
      className="block size-full rounded-[3px] text-foreground"
      viewBox="0 0 64 48"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="64" height="48" fill="var(--background)" />
      {style && (
        <>
          <defs>
            <pattern
              id={patternId}
              width={gap}
              height={gap}
              patternUnits="userSpaceOnUse"
            >
              {pattern === "dots" ? (
                <circle
                  cx={gap / 2}
                  cy={gap / 2}
                  r={radius}
                  fill="currentColor"
                  opacity={style.opacity}
                />
              ) : pattern === "lines" ? (
                <path
                  d={`M${gap / 2} 0V${gap}M0 ${gap / 2}H${gap}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={lineWidth}
                  opacity={style.opacity}
                />
              ) : (
                <path
                  d={`M${gap / 2} ${(gap - size) / 2}v${size}M${
                    (gap - size) / 2
                  } ${gap / 2}h${size}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={lineWidth}
                  opacity={style.opacity}
                />
              )}
            </pattern>
          </defs>
          <rect width="64" height="48" fill={`url(#${patternId})`} />
        </>
      )}
    </svg>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const { pattern, setPattern } = useCanvasPattern();
  const activeTheme: ThemeValue = theme === "system" ? "system" : theme;

  return (
    <section aria-labelledby="appearance-heading">
      <h2
        id="appearance-heading"
        className="text-xl font-semibold tracking-tight text-foreground"
      >
        Appearance
      </h2>
      <div className="mt-9">
        <h3 className="text-[13px] font-medium text-muted-foreground">
          Visual style
        </h3>
        <div className="mt-4 flex min-h-20 items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-4 py-2.5 sm:px-5">
          <span className="shrink-0 text-sm font-medium">Mode</span>
          <div
            aria-label="Mode"
            className="flex flex-wrap items-center justify-end gap-2"
            role="radiogroup"
          >
            {THEMES.map(({ value, label }, index) => (
              <Tooltip key={value}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={label}
                      aria-checked={activeTheme === value}
                      role="radio"
                      tabIndex={activeTheme === value ? 0 : -1}
                      className={cn(
                        "size-12 shrink-0 overflow-hidden rounded-md border bg-background p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:h-12 md:w-16",
                        activeTheme === value
                          ? "border-foreground ring-1 ring-foreground"
                          : "border-border hover:border-foreground/50",
                      )}
                      onClick={() => setTheme(value)}
                      onKeyDown={(event) => {
                        const next = nextOptionIndex(
                          event.key,
                          index,
                          THEMES.length,
                          "horizontal",
                        );
                        if (next === null) return;
                        event.preventDefault();
                        setTheme(THEMES[next].value);
                        event.currentTarget
                          .closest('[role="radiogroup"]')
                          ?.querySelectorAll<HTMLButtonElement>(
                            '[role="radio"]',
                          )
                          [next]?.focus();
                      }}
                    />
                  }
                >
                  <ThemePreview theme={value} />
                </TooltipTrigger>
                <TooltipContent side="top">{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-9">
        <h3 className="text-[13px] font-medium text-muted-foreground">
          Canvas
        </h3>
        <div className="mt-4 flex min-h-20 items-center justify-between gap-3 rounded-lg border border-border/70 bg-card px-4 py-2.5 sm:px-5">
          <span className="shrink-0 text-sm font-medium">Pattern</span>
          <div
            aria-label="Canvas pattern"
            className="flex flex-wrap items-center justify-end gap-2"
            role="radiogroup"
          >
            {CANVAS_PATTERNS.map(({ value, label }, index) => (
              <Tooltip key={value}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={label}
                      aria-checked={pattern === value}
                      role="radio"
                      tabIndex={pattern === value ? 0 : -1}
                      className={cn(
                        "size-12 shrink-0 overflow-hidden rounded-md border bg-background p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:h-12 md:w-16",
                        pattern === value
                          ? "border-foreground ring-1 ring-foreground"
                          : "border-border hover:border-foreground/50",
                      )}
                      onClick={() => setPattern(value)}
                      onKeyDown={(event) => {
                        const next = nextOptionIndex(
                          event.key,
                          index,
                          CANVAS_PATTERNS.length,
                          "horizontal",
                        );
                        if (next === null) return;
                        event.preventDefault();
                        setPattern(CANVAS_PATTERNS[next].value);
                        event.currentTarget
                          .closest('[role="radiogroup"]')
                          ?.querySelectorAll<HTMLButtonElement>(
                            '[role="radio"]',
                          )
                          [next]?.focus();
                      }}
                    />
                  }
                >
                  <CanvasPatternPreview pattern={value} />
                </TooltipTrigger>
                <TooltipContent side="top">{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SettingsDialog() {
  const navigateOverlay = useWorkspaceOverlayNavigation();
  const location = useRouterState({ select: (state) => state.location });
  const open = (location.search as { settings?: boolean }).settings === true;
  const [section, setSection] = useState<SettingsSection>(() =>
    new URLSearchParams(window.location.search).has("googleLinkError")
      ? "account"
      : "appearance",
  );
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function onRequest(event: Event) {
      const requestedOpen = (event as CustomEvent<boolean>).detail;
      if (requestedOpen) {
        const active = document.activeElement;
        previousFocusRef.current =
          active instanceof HTMLElement ? active : null;
      }
      void navigateOverlay(
        location.pathname,
        {
          settings: requestedOpen || undefined,
        },
        true,
      );
    }
    window.addEventListener(SETTINGS_REQUEST_EVENT, onRequest);
    return () => {
      window.removeEventListener(SETTINGS_REQUEST_EVENT, onRequest);
    };
  }, [location.pathname, navigateOverlay]);

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) closeSettings();
      }}
    >
      <DialogContent
        className="top-0 left-0 h-dvh max-w-none translate-x-0 rounded-none bg-background md:top-1/2 md:left-1/2 md:h-[min(680px,85dvh)] md:max-w-[min(900px,calc(100vw-3rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:bg-popover/80"
        initialFocus={titleRef}
        finalFocus={() => {
          // Only return focus to a real, still-mounted opener (e.g. the user
          // menu trigger). Otherwise leave focus alone instead of jumping to
          // an unrelated control.
          const previous = previousFocusRef.current;
          previousFocusRef.current = null;
          return (
            !!previous &&
            previous !== document.body &&
            previous.isConnected &&
            previous
          );
        }}
        polishedMotion
        showCloseButton={false}
      >
        <DialogDescription className="sr-only">
          Manage your workspace appearance and account settings.
        </DialogDescription>
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background/50 text-foreground md:flex-row md:rounded-lg">
          <aside className="w-full shrink-0 md:w-48">
            <div className="flex h-full flex-col px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 md:p-4">
              <DialogTitle
                ref={titleRef}
                tabIndex={-1}
                className="px-2 py-1.5 text-sm font-semibold tracking-tight outline-none"
              >
                Settings
              </DialogTitle>
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-[max(1.125rem,env(safe-area-inset-top))] right-[max(1.125rem,env(safe-area-inset-right))] z-20 md:top-[1.125rem] md:right-[1.125rem]"
                  />
                }
              >
                <XIcon />
                <span className="sr-only">Close settings</span>
              </DialogClose>
              <div
                aria-label="Settings sections"
                aria-orientation="vertical"
                className="mt-2 space-y-0.5"
                role="tablist"
              >
                {SETTINGS_SECTIONS.map(
                  ({ value, label, icon: Icon }, index) => (
                    <button
                      key={value}
                      type="button"
                      id={`settings-tab-${value}`}
                      aria-controls="settings-panel"
                      aria-selected={section === value}
                      role="tab"
                      tabIndex={section === value ? 0 : -1}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        section === value
                          ? "bg-foreground/[0.07] text-foreground hover:bg-foreground/[0.07]"
                          : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
                      )}
                      onClick={() => setSection(value)}
                      onKeyDown={(event) => {
                        const next = nextOptionIndex(
                          event.key,
                          index,
                          SETTINGS_SECTIONS.length,
                          "vertical",
                        );
                        if (next === null) return;
                        event.preventDefault();
                        setSection(SETTINGS_SECTIONS[next].value);
                        event.currentTarget.parentElement
                          ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                          [next]?.focus();
                      }}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      {label}
                    </button>
                  ),
                )}
              </div>
            </div>
          </aside>
          <main
            id="settings-panel"
            aria-labelledby={`settings-tab-${section}`}
            role="tabpanel"
            tabIndex={-1}
            className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-t-lg border-t border-foreground/10 bg-background px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring md:rounded-l-xl md:rounded-tr-none md:border-t-0 md:border-l md:px-7 md:py-5"
          >
            {section === "appearance" ? (
              <AppearanceSection />
            ) : section === "account" ? (
              <AccountSettings />
            ) : (
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {
                  SETTINGS_SECTIONS.find((item) => item.value === section)
                    ?.label
                }
              </h2>
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}

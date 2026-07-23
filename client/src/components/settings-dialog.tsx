import { useEffect, useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { MonitorIcon, MoonIcon, SettingsIcon, SunIcon } from "lucide-react";
import { motion } from "motion/react";
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@/components/ui/item";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import {
  isSettingsOpen,
  closeSettings,
  openSettings,
} from "@/lib/settings-dialog";
import { useEventListener } from "@/hooks/use-event-listener";
import { KEYBINDINGS } from "@/lib/keybindings";

const THEMES = [
  { value: "system", icon: MonitorIcon },
  { value: "light", icon: SunIcon },
  { value: "dark", icon: MoonIcon },
] as const;

type ThemeValue = (typeof THEMES)[number]["value"];

function themeTabClassName(isActive: boolean) {
  return cn(
    "relative isolate px-1.5",
    isActive
      ? "text-foreground hover:bg-transparent hover:text-foreground"
      : "text-muted-foreground transition-colors duration-[50ms] hover:bg-foreground/[0.05] hover:text-foreground active:bg-foreground/[0.08] dark:hover:bg-foreground/[0.1] dark:active:bg-foreground/[0.14]",
  );
}

function GeneralSection() {
  const { theme, setTheme } = useTheme();
  const activeTheme: ThemeValue = theme === "system" ? "system" : theme;

  return (
    <Item className="px-0">
      <ItemContent>
        <ItemTitle>Theme</ItemTitle>
        <ItemDescription>
          Switch between light, dark, and system theme
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <div
          aria-label="Theme"
          className="grid w-fit grid-cols-3 gap-0.5 rounded-md border border-border/60 bg-muted p-0.5 shadow-[0_1px_1px_rgb(0_0_0_/_0.02)] ring-1 ring-foreground/[0.025] backdrop-blur-sm"
          role="tablist"
        >
          {THEMES.map(({ value, icon: Icon }) => (
            <Button
              key={value}
              aria-selected={activeTheme === value}
              className={themeTabClassName(activeTheme === value)}
              role="tab"
              size="xs"
              type="button"
              variant="ghost"
              onClick={() => setTheme(value)}
            >
              {activeTheme === value ? (
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 z-0 rounded-[calc(var(--radius-md)-2px)] bg-background/85 shadow-[0_1px_1px_rgb(0_0_0_/_0.04)] ring-1 ring-foreground/[0.06]"
                  layoutId="theme-active"
                  transition={{
                    duration: 0.12,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                />
              ) : null}
              <span className="relative z-10 flex items-center">
                <Icon />
              </span>
            </Button>
          ))}
        </div>
      </ItemActions>
    </Item>
  );
}

export function SettingsDialog() {
  const [open, setOpen] = useState(isSettingsOpen);

  useEventListener("keydown", (event) => {
    if (event.repeat || open) return;
    const isShortcut =
      (event.ctrlKey || event.metaKey) &&
      event.key === KEYBINDINGS.SETTINGS_OPEN.key;
    if (!isShortcut) return;
    event.preventDefault();
    openSettings();
  });

  useEffect(() => {
    function onUrlChange() {
      setOpen(isSettingsOpen());
    }
    window.addEventListener("popstate", onUrlChange);
    window.addEventListener("settings-changed", onUrlChange);
    return () => {
      window.removeEventListener("popstate", onUrlChange);
      window.removeEventListener("settings-changed", onUrlChange);
    };
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) closeSettings();
      }}
    >
      <DialogContent
        className="md:max-w-[700px] lg:max-w-[800px]"
        showCloseButton
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your settings here.
        </DialogDescription>
        <DialogBody className="overflow-hidden p-0">
          <div className="flex max-h-[560px]">
            <nav className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-border/50 bg-card p-3">
              <button
                type="button"
                className="flex items-center gap-2 rounded-md bg-foreground/10 px-2.5 py-1.5 text-left text-sm font-medium text-foreground transition-colors"
              >
                <SettingsIcon className="size-4 shrink-0" />
                General
              </button>
            </nav>
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex h-12 shrink-0 items-center px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbPage>Settings</BreadcrumbPage>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>General</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </header>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <GeneralSection />
              </div>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

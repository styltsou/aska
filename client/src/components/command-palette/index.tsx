import {
  ArrowDownIcon,
  ArrowUpIcon,
  FileTextIcon,
  FolderPlusIcon,
  FolderOpenIcon,
  ImagePlusIcon,
  InboxIcon,
  MoonIcon,
  PanelLeftIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { DialogBody } from "@/components/ui/dialog";
import { CreateFolderDialog } from "@/components/app-shell/create-folder-dialog";
import { CreateNoteDialog } from "@/components/app-shell/create-note-dialog";
import { UploadImagesDialog } from "@/components/app-shell/upload-images-dialog";
import {
  collectionsQueryOptions,
  inboxContentsQueryOptions,
} from "@/api/collection";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useTheme } from "@/components/theme-provider";
import { useSidebar } from "@/components/ui/sidebar";
import { useActiveModalLayer } from "@/hooks/use-active-modal-layer";
import { useEventListener } from "@/hooks/use-event-listener";
import { KEYBINDINGS } from "@/lib/keybindings";
import { formatPlatformShortcut } from "@/lib/platform";
import { openSettings } from "@/lib/settings-dialog";
import { usePersistedStore } from "@/store";
import { useBoardInsertionPlacement } from "@/components/canvas";

type CommandId =
  | "new-note"
  | "new-folder"
  | "upload-images"
  | "open-inbox"
  | "browse-collections"
  | "toggle-filter-bar"
  | "toggle-sidebar"
  | "open-settings"
  | "change-theme";

const COMMAND_GROUPS = [
  {
    heading: "Create",
    items: [
      {
        id: "new-note",
        label: "New note",
        icon: FileTextIcon,
        shortcut: "⇧+N",
      },
      {
        id: "new-folder",
        label: "New folder",
        icon: FolderPlusIcon,
        shortcut: "⇧+D",
      },
      {
        id: "upload-images",
        label: "Upload images",
        icon: ImagePlusIcon,
        shortcut: "⇧+U",
      },
    ],
  },
  {
    heading: "Navigate",
    items: [
      {
        id: "open-inbox",
        label: "Open Inbox",
        icon: InboxIcon,
        shortcut: "⇧+I",
      },
      {
        id: "browse-collections",
        label: "Browse collections",
        icon: FolderOpenIcon,
        shortcut: "⇧+C",
      },
      {
        id: "open-settings",
        label: "Open settings",
        icon: SettingsIcon,
        shortcut: "⌘+,",
      },
    ],
  },
  {
    heading: "View",
    items: [
      {
        id: "toggle-filter-bar",
        label: "Toggle filter bar",
        icon: SlidersHorizontalIcon,
        shortcut: "⇧+F",
      },
      {
        id: "toggle-sidebar",
        label: "Toggle sidebar",
        icon: PanelLeftIcon,
        shortcut: "⌘+B",
      },
      {
        id: "change-theme",
        label: "Change theme",
        icon: MoonIcon,
        shortcut: undefined,
      },
    ],
  },
] as const satisfies ReadonlyArray<{
  heading: string;
  items: ReadonlyArray<{
    id: CommandId;
    label: string;
    icon: typeof FolderOpenIcon;
    shortcut?: string;
  }>;
}>;

const COMMAND_ID_BY_LABEL: ReadonlyMap<string, CommandId> = new Map(
  COMMAND_GROUPS.flatMap((group) =>
    group.items.map((item) => [item.label, item.id] as const),
  ),
);

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [activeCommandId, setActiveCommandId] = useState<CommandId>();
  const [createNoteOpen, setCreateNoteOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [uploadImagesOpen, setUploadImagesOpen] = useState(false);
  const hasActiveModalLayer = useActiveModalLayer();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { theme, setTheme } = useTheme();
  const { toggleSidebar } = useSidebar();
  const toggleFilterBar = usePersistedStore((state) => state.toggleFilterBar);
  const [workspaceSlug, view, ...viewPath] = pathname
    .split("/")
    .filter(Boolean);
  const collectionPath = view === "collections" ? viewPath.join("/") : "";
  const filterScope =
    view === "inbox"
      ? `inbox:${workspaceSlug}`
      : collectionPath
        ? `collection:${workspaceSlug}/${collectionPath}`
        : undefined;
  const canCreateNote = view === "inbox" || Boolean(collectionPath);
  const canCreateFolder = Boolean(collectionPath);
  const placement = useBoardInsertionPlacement(workspaceSlug, collectionPath);

  useEffect(() => {
    if (!open || !workspaceSlug) {
      return;
    }

    if (activeCommandId === "open-inbox") {
      void queryClient.prefetchQuery(inboxContentsQueryOptions(workspaceSlug));
    }

    if (activeCommandId === "browse-collections") {
      void queryClient.prefetchQuery(collectionsQueryOptions(workspaceSlug));
    }
  }, [activeCommandId, open, queryClient, workspaceSlug]);

  useEventListener("keydown", (event) => {
    if (event.repeat) {
      return;
    }

    if (hasActiveModalLayer && !open) {
      return;
    }

    const isPaletteToggle =
      event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      event.key.toLowerCase() === KEYBINDINGS.COMMAND_PALETTE_TOGGLE.key;

    if (isPaletteToggle) {
      event.preventDefault();
      setOpen((current) => !current);
      return;
    }

    if (open) {
      return;
    }

    if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      switch (event.code) {
        case "KeyN":
          if (!canCreateNote) return;
          event.preventDefault();
          runCommand("new-note");
          return;
        case "KeyD":
          if (!canCreateFolder) return;
          event.preventDefault();
          runCommand("new-folder");
          return;
        case "KeyU":
          if (!canCreateFolder) return;
          event.preventDefault();
          runCommand("upload-images");
          return;
        case "KeyI":
          if (!workspaceSlug) return;
          event.preventDefault();
          runCommand("open-inbox");
          return;
        case "KeyC":
          if (!workspaceSlug) return;
          event.preventDefault();
          runCommand("browse-collections");
          return;
      }
    }
  });

  function runCommand(commandId: CommandId) {
    switch (commandId) {
      case "new-note":
        if (!canCreateNote) return;
        setOpen(false);
        setCreateNoteOpen(true);
        return;
      case "new-folder":
        if (!canCreateFolder) return;
        setOpen(false);
        setCreateFolderOpen(true);
        return;
      case "upload-images":
        if (!canCreateFolder) return;
        setOpen(false);
        setUploadImagesOpen(true);
        return;
      case "toggle-filter-bar":
        if (!filterScope) return;
        setOpen(false);
        toggleFilterBar(filterScope);
        return;
      case "toggle-sidebar":
        setOpen(false);
        toggleSidebar();
        return;
      case "change-theme":
        setOpen(false);
        setTheme(
          theme === "dark"
            ? "light"
            : theme === "light"
              ? "dark"
              : document.documentElement.classList.contains("dark")
                ? "light"
                : "dark",
        );
        return;
      case "open-settings":
        setOpen(false);
        openSettings();
        return;
      case "open-inbox":
        if (!workspaceSlug) return;
        setOpen(false);
        void navigate({
          to: "/$workspaceSlug/inbox",
          params: { workspaceSlug },
          search: { note: undefined, image: undefined },
        });
        return;
      case "browse-collections":
        if (!workspaceSlug) return;
        setOpen(false);
        void navigate({
          to: "/$workspaceSlug",
          params: { workspaceSlug },
        });
        return;
      default:
        return;
    }
  }

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command Palette"
        description="Search app commands and destinations."
        overlayClassName="transition-none"
        className="top-[18vh] max-w-lg transition-none"
      >
        <DialogBody className="overflow-hidden p-1.5">
          <Command
            onValueChange={(value) => {
              setActiveCommandId(COMMAND_ID_BY_LABEL.get(value));
            }}
          >
            <CommandInput placeholder="Type a command or search..." />
            <CommandList className="max-h-80">
              <CommandEmpty>No commands found.</CommandEmpty>
              {COMMAND_GROUPS.map((group, index) => (
                <div key={group.heading}>
                  {index > 0 ? <CommandSeparator /> : null}
                  <CommandGroup heading={group.heading}>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const label =
                        item.id === "change-theme"
                          ? theme === "dark"
                            ? "Switch to light mode"
                            : "Switch to dark mode"
                          : item.label;
                      const isDisabled =
                        (item.id === "toggle-filter-bar" && !filterScope) ||
                        (item.id === "new-note" && !canCreateNote) ||
                        ((item.id === "new-folder" ||
                          item.id === "upload-images") &&
                          !canCreateFolder);

                      return (
                        <CommandItem
                          key={item.id}
                          value={item.label}
                          disabled={isDisabled}
                          onSelect={() => runCommand(item.id)}
                        >
                          <Icon className="size-4 text-muted-foreground" />
                          <span>{label}</span>
                          {item.shortcut ? (
                            <CommandShortcut>
                              {formatPlatformShortcut(item.shortcut)}
                            </CommandShortcut>
                          ) : null}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </div>
              ))}
            </CommandList>
          </Command>
        </DialogBody>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 px-0 pt-[7px] pr-[2px] pb-0.5 text-[10px] leading-4 text-muted-foreground">
          <span className="mr-auto inline-flex items-center gap-1">
            <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">Esc</Kbd>
            <span>Close</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <KbdGroup className="gap-0.5">
              <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">
                <ArrowUpIcon />
              </Kbd>
              <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">
                <ArrowDownIcon />
              </Kbd>
            </KbdGroup>
            <span>Navigate</span>
          </span>
          <span className="ml-3 inline-flex items-center gap-1">
            <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">Enter</Kbd>
            <span>Select</span>
          </span>
        </div>
      </CommandDialog>
      <CreateNoteDialog
        workspaceSlug={workspaceSlug ?? ""}
        collectionPath={collectionPath}
        target={view === "inbox" ? "inbox" : "collection"}
        open={createNoteOpen}
        onOpenChange={setCreateNoteOpen}
        placement={placement}
      />
      <CreateFolderDialog
        workspaceSlug={workspaceSlug ?? ""}
        collectionPath={collectionPath}
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        placement={placement}
      />
      <UploadImagesDialog
        workspaceSlug={workspaceSlug ?? ""}
        collectionPath={collectionPath}
        open={uploadImagesOpen}
        onOpenChange={setUploadImagesOpen}
        placement={placement}
      />
    </>
  );
}

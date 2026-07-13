import {
  ArchiveIcon,
  FileTextIcon,
  FolderPlusIcon,
  ImagePlusIcon,
  InboxIcon,
  MoonIcon,
  PanelLeftIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { useState } from "react";

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
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useActiveModalLayer } from "@/hooks/use-active-modal-layer";
import { useEventListener } from "@/hooks/use-event-listener";
import { KEYBINDINGS } from "@/lib/keybindings";

const COMMAND_GROUPS = [
  {
    heading: "Create",
    items: [
      { label: "New note", icon: FileTextIcon, shortcut: "N" },
      { label: "New folder", icon: FolderPlusIcon, shortcut: "F" },
      { label: "Upload images", icon: ImagePlusIcon, shortcut: "U" },
    ],
  },
  {
    heading: "Navigate",
    items: [
      { label: "Search all assets", icon: SearchIcon, shortcut: "/" },
      { label: "Open Inbox", icon: InboxIcon, shortcut: "I" },
      { label: "Browse collections", icon: ArchiveIcon, shortcut: "C" },
    ],
  },
  {
    heading: "View",
    items: [
      {
        label: "Toggle filter bar",
        icon: SlidersHorizontalIcon,
        shortcut: "⇧F",
      },
      { label: "Toggle sidebar", icon: PanelLeftIcon, shortcut: "⌘B" },
      { label: "Toggle theme", icon: MoonIcon, shortcut: "D" },
    ],
  },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const hasActiveModalLayer = useActiveModalLayer();

  useEventListener("keydown", (event) => {
    if (event.repeat) {
      return;
    }

    const isShortcut =
      event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      event.key.toLowerCase() === KEYBINDINGS.COMMAND_PALETTE_TOGGLE.key;

    if (!isShortcut) {
      return;
    }

    if (hasActiveModalLayer && !open) {
      return;
    }

    event.preventDefault();
    setOpen((current) => !current);
  });

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search app commands and destinations."
      className="top-[18vh] max-w-lg duration-50"
    >
      <Command>
        <div className="flex items-center justify-between gap-3 px-3 pt-3 pb-2">
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            Command Palette
          </span>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>{KEYBINDINGS.COMMAND_PALETTE_TOGGLE.label}</Kbd>
          </KbdGroup>
        </div>
        <CommandInput
          className="px-2"
          placeholder="Type a command or search..."
        />
        <CommandList className="max-h-80">
          <CommandEmpty>No commands found.</CommandEmpty>
          {COMMAND_GROUPS.map((group, index) => (
            <div key={group.heading}>
              {index > 0 ? <CommandSeparator /> : null}
              <CommandGroup heading={group.heading}>
                {group.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <CommandItem key={item.label} value={item.label}>
                      <Icon className="size-4 text-muted-foreground" />
                      <span>{item.label}</span>
                      <CommandShortcut>{item.shortcut}</CommandShortcut>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

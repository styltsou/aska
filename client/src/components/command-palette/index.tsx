import {
  AlignCenterHorizontalIcon,
  ArrowDownIcon,
  ArrowUpRightIcon,
  ArrowUpIcon,
  FileTextIcon,
  FolderPlusIcon,
  FolderOpenIcon,
  ImagePlusIcon,
  ImageIcon,
  InboxIcon,
  LayoutGridIcon,
  MoonIcon,
  CornerDownLeftIcon,
  ExternalLinkIcon,
  NotebookPenIcon,
  PanelLeftIcon,
  PanelsTopLeftIcon,
  PaletteIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  SquarePlusIcon,
  PipetteIcon,
  SearchIcon,
  TypeIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
import { ColorEditorDialog } from "@/components/app-shell/color-editor-dialog";
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
import {
  KEYBINDINGS,
  isEditableTarget,
  matchesKeybinding,
} from "@/lib/keybindings";
import { formatPlatformShortcut } from "@/lib/platform";
import { openSettings } from "@/lib/settings-dialog";
import {
  useSessionStore,
  usePersistedStore,
  useTransientStore,
  getPexelsBrowserScope,
  getCollectionViewScope,
} from "@/store";
import { makeBoardKey, useBoardInsertionPlacement } from "@/components/canvas";
import {
  useWorkspaceSearch,
  type WorkspaceSearchResult,
} from "@/api/workspace-search";
import { useWorkspaceAssetView } from "@/components/app-shell/workspace-asset-view";
import { useWorkspacePeek } from "@/components/app-shell/workspace-peek";
import { fetchPeekableAsset } from "@/api/collection/fetchers";
import { collectionNodeToAsset } from "@/lib/asset-transform";
import { getUserFacingApiErrorMessage } from "@/lib/api";
import { getRecentWorkspaceAssetIds } from "@/lib/workspace-recent-assets";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { toast } from "sonner";

type PaletteMode = "search" | "commands";

type CommandId =
  | "new-note"
  | "new-color"
  | "canvas-text-tool"
  | "canvas-arrow-tool"
  | "new-folder"
  | "upload-images"
  | "open-scratchpad"
  | "open-inbox"
  | "browse-collections"
  | "open-pexels-browser"
  | "toggle-filter-bar"
  | "toggle-sidebar"
  | "toggle-collection-view"
  | "toggle-alignment-guides"
  | "toggle-board-action-rail"
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
        id: "new-color",
        label: "New color",
        icon: PaletteIcon,
        shortcut: "⇧+C",
      },
      {
        id: "canvas-text-tool",
        label: "Text tool",
        icon: TypeIcon,
        shortcut: "⇧+T",
      },
      {
        id: "canvas-arrow-tool",
        label: "Arrow tool",
        icon: ArrowUpRightIcon,
        shortcut: "⇧+A",
      },
      {
        id: "open-scratchpad",
        label: "Open scratchpad",
        icon: NotebookPenIcon,
        shortcut: "⇧+P",
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
        shortcut: undefined,
      },
      {
        id: "browse-collections",
        label: "Browse collections",
        icon: FolderOpenIcon,
        shortcut: undefined,
      },
      {
        id: "open-pexels-browser",
        label: "Browse Pexels photos",
        icon: ImageIcon,
        shortcut: undefined,
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
        id: "toggle-collection-view",
        label: "Toggle canvas / grid view",
        icon: PanelLeftIcon,
        shortcut: "⇧+V",
      },
      {
        id: "toggle-alignment-guides",
        label: "Alignment guides",
        icon: AlignCenterHorizontalIcon,
        shortcut: undefined,
      },
      {
        id: "toggle-board-action-rail",
        label: "Toggle actions dock",
        icon: SquarePlusIcon,
        shortcut: undefined,
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
  const [mode, setMode] = useState<PaletteMode>("search");
  const [query, setQuery] = useState("");
  const [activeSearchResultId, setActiveSearchResultId] = useState<string>();
  const [activeCommandId, setActiveCommandId] = useState<CommandId>();
  const [createNoteOpen, setCreateNoteOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [uploadImagesOpen, setUploadImagesOpen] = useState(false);
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const hasActiveModalLayer = useActiveModalLayer();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openAsset } = useWorkspaceAssetView();
  const { peekNote, peekColor } = useWorkspacePeek();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { theme, setTheme } = useTheme();
  const { open: isSidebarOpen, toggleSidebar } = useSidebar();
  const toggleFilterBar = useSessionStore((state) => state.toggleFilterBar);
  const setCollectionView = useSessionStore((state) => state.setCollectionView);
  const setWorkspaceAlignmentGuides = usePersistedStore(
    (state) => state.setWorkspaceAlignmentGuides,
  );
  const [workspaceSlug, view, ...viewPath] = pathname
    .split("/")
    .filter(Boolean);
  const isBoardActionRailVisible = usePersistedStore((state) =>
    workspaceSlug
      ? (state.workspaceBoardActionRails?.[workspaceSlug] ?? false)
      : false,
  );
  const setWorkspaceBoardActionRail = usePersistedStore(
    (state) => state.setWorkspaceBoardActionRail,
  );
  const openScratchpad = useTransientStore((state) => state.openScratchpad);
  const setCanvasTool = useTransientStore((state) => state.setCanvasTool);
  const openPexelsBrowser = useSessionStore(
    (state) => state.setPexelsBrowserOpen,
  );
  const collectionPath = view === "collections" ? viewPath.join("/") : "";
  const collectionViewScope =
    view === "collections" && workspaceSlug && viewPath[0]
      ? getCollectionViewScope(workspaceSlug, viewPath[0])
      : undefined;
  const collectionView = useSessionStore((state) =>
    collectionViewScope
      ? (state.collectionViews[collectionViewScope] ?? "canvas")
      : undefined,
  );
  const pexelsScope =
    view === "collections" && viewPath.length > 0
      ? getPexelsBrowserScope(workspaceSlug, viewPath[0])
      : undefined;
  const filterScope =
    view === "inbox"
      ? `inbox:${workspaceSlug}`
      : collectionPath
        ? `collection:${workspaceSlug}/${collectionPath}`
        : undefined;
  const isFilterBarOpen = useSessionStore((state) =>
    filterScope ? (state.filterBars[filterScope]?.open ?? false) : false,
  );
  const canCreateNote = view === "inbox" || Boolean(collectionPath);
  const canCreateFolder = Boolean(collectionPath);
  const canCreateColor = canCreateNote;
  const canToggleCollectionView = Boolean(collectionViewScope);
  const boardKey =
    workspaceSlug && view === "collections" && viewPath[0]
      ? makeBoardKey(
          workspaceSlug,
          viewPath[0],
          viewPath.slice(1).join("/") || undefined,
        )
      : undefined;
  const areAlignmentGuidesEnabled = usePersistedStore((state) =>
    workspaceSlug
      ? (state.workspaceAlignmentGuides[workspaceSlug] ?? true)
      : false,
  );
  const canToggleAlignmentGuides =
    collectionView === "canvas" && Boolean(boardKey);
  const canToggleBoardActionRail =
    collectionView === "canvas" && Boolean(boardKey);
  const placement = useBoardInsertionPlacement(workspaceSlug, collectionPath);
  const recentAssetIds = workspaceSlug
    ? getRecentWorkspaceAssetIds(workspaceSlug)
    : [];
  const workspaceSearch = useWorkspaceSearch(
    workspaceSlug,
    query,
    open && mode === "search",
    recentAssetIds,
  );
  const searchResults =
    workspaceSearch.data?.query === query.trim()
      ? workspaceSearch.data.results
      : [];

  function changeMode(nextMode: PaletteMode) {
    setMode(nextMode);
    setQuery("");
    setActiveCommandId(undefined);
    setActiveSearchResultId(undefined);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setMode("search");
      setQuery("");
      setActiveSearchResultId(undefined);
      setActiveCommandId(undefined);
    }
  }

  function runSearchResult(result: WorkspaceSearchResult) {
    handleOpenChange(false);
    if (result.action.type === "open-asset") {
      openAsset(result.id);
      return;
    }
    if (result.action.type === "external") {
      window.open(result.action.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (result.location.type === "inbox") {
      void navigate({
        to: "/$workspaceSlug/inbox",
        params: { workspaceSlug },
        search: {},
      });
      return;
    }
    void navigate({
      to: "/$workspaceSlug/collections/$",
      params: {
        workspaceSlug,
        _splat: [result.location.collectionSlug, result.location.folderPath]
          .filter(Boolean)
          .join("/"),
      },
      search: {},
    });
  }

  async function peekSearchResult(result: WorkspaceSearchResult) {
    if (result.type !== "note" && result.type !== "color") {
      runSearchResult(result);
      return;
    }
    handleOpenChange(false);
    try {
      const response = await fetchPeekableAsset(workspaceSlug, result.id);
      const asset = collectionNodeToAsset(response.asset);
      if (asset.type === "note") {
        peekNote(asset, response.location);
        return;
      }
      if (asset.type === "color") {
        peekColor(
          asset,
          response.location.type === "inbox"
            ? { type: "inbox" }
            : {
                type: "collection",
                collectionSlug: response.location.collectionSlug,
                folderPath: response.location.folderPath,
                includeDescendants: false,
              },
        );
      }
    } catch (error) {
      toast.error(
        getUserFacingApiErrorMessage(error, "Could not peek this asset."),
      );
    }
  }

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

    const paletteToggle = KEYBINDINGS.find(
      (kb) => kb.command === "toggle-command-palette",
    );
    if (paletteToggle && matchesKeybinding(event, paletteToggle)) {
      event.preventDefault();
      if (open) handleOpenChange(false);
      else setOpen(true);
      return;
    }

    if (open) {
      return;
    }

    for (const kb of KEYBINDINGS) {
      if (kb.command === "toggle-command-palette") continue;
      if (!matchesKeybinding(event, kb)) continue;
      if (kb.shiftKey && isEditableTarget(event)) {
        return;
      }
      event.preventDefault();
      runCommand(kb.command as CommandId);
      return;
    }
  });

  function runCommand(commandId: CommandId) {
    switch (commandId) {
      case "new-note":
        if (!canCreateNote) return;
        handleOpenChange(false);
        setCreateNoteOpen(true);
        return;
      case "new-color":
        if (!canCreateColor) return;
        handleOpenChange(false);
        setColorEditorOpen(true);
        return;
      case "canvas-text-tool":
      case "canvas-arrow-tool":
        if (!boardKey || collectionView !== "canvas") return;
        handleOpenChange(false);
        setCanvasTool(
          boardKey,
          commandId === "canvas-text-tool" ? "text" : "arrow",
        );
        return;
      case "new-folder":
        if (!canCreateFolder) return;
        handleOpenChange(false);
        setCreateFolderOpen(true);
        return;
      case "upload-images":
        if (!canCreateFolder) return;
        handleOpenChange(false);
        setUploadImagesOpen(true);
        return;
      case "open-scratchpad":
        if (!workspaceSlug) return;
        handleOpenChange(false);
        openScratchpad();
        return;
      case "toggle-filter-bar":
        if (!filterScope) return;
        handleOpenChange(false);
        toggleFilterBar(filterScope);
        return;
      case "toggle-sidebar":
        handleOpenChange(false);
        toggleSidebar();
        return;
      case "toggle-collection-view":
        if (!collectionViewScope || !collectionView) return;
        handleOpenChange(false);
        setCollectionView(
          collectionViewScope,
          collectionView === "canvas" ? "grid" : "canvas",
        );
        return;
      case "toggle-alignment-guides":
        if (!boardKey || !workspaceSlug) return;
        handleOpenChange(false);
        setWorkspaceAlignmentGuides(workspaceSlug, !areAlignmentGuidesEnabled);
        return;
      case "toggle-board-action-rail":
        if (!boardKey || !workspaceSlug) return;
        handleOpenChange(false);
        setWorkspaceBoardActionRail(workspaceSlug, !isBoardActionRailVisible);
        return;
      case "change-theme":
        handleOpenChange(false);
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
        handleOpenChange(false);
        openSettings();
        return;
      case "open-inbox":
        if (!workspaceSlug) return;
        handleOpenChange(false);
        void navigate({
          to: "/$workspaceSlug/inbox",
          params: { workspaceSlug },
          search: {},
        });
        return;
      case "browse-collections":
        if (!workspaceSlug) return;
        handleOpenChange(false);
        void navigate({
          to: "/$workspaceSlug",
          params: { workspaceSlug },
        });
        return;
      case "open-pexels-browser":
        if (!canCreateFolder || !pexelsScope) return;
        handleOpenChange(false);
        openPexelsBrowser(pexelsScope, true);
        return;
      default:
        return;
    }
  }

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={mode === "search" ? "Search workspace" : "Command Palette"}
        description={
          mode === "search"
            ? "Search assets, folders, and collections."
            : "Search app commands and destinations."
        }
        className="top-[18vh] max-w-xl transition-[opacity,transform] duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
      >
        <DialogBody className="overflow-hidden p-0">
          <div className="p-1.5">
            <Command
              shouldFilter={mode === "commands"}
              onKeyDown={(event) => {
                if (event.key === "Tab") {
                  event.preventDefault();
                  changeMode(mode === "search" ? "commands" : "search");
                  return;
                }
                if (
                  event.key === "Backspace" &&
                  mode === "commands" &&
                  query.length === 0
                ) {
                  event.preventDefault();
                  changeMode("search");
                  return;
                }
                if (
                  event.key === "Enter" &&
                  event.shiftKey &&
                  mode === "search"
                ) {
                  const result = searchResults.find(
                    (candidate) => candidate.id === activeSearchResultId,
                  );
                  if (result?.type === "note" || result?.type === "color") {
                    event.preventDefault();
                    event.stopPropagation();
                    void peekSearchResult(result);
                  }
                }
              }}
              onValueChange={(value) => {
                if (mode === "commands") {
                  setActiveCommandId(COMMAND_ID_BY_LABEL.get(value));
                  return;
                }
                setActiveSearchResultId(
                  searchResults.find(
                    (result) => searchResultValue(result) === value,
                  )?.id,
                );
              }}
            >
              <CommandInput
                value={query}
                onValueChange={setQuery}
                maxLength={120}
                startAddon={
                  <CommandInputLeadingContent
                    mode={mode}
                    isSearching={workspaceSearch.isSearching}
                  />
                }
                startAddonClassName={mode === "commands" ? "w-[70px]" : "w-7"}
                placeholder={
                  mode === "search"
                    ? "Search notes, images, links, colors…"
                    : "Search actions…"
                }
              />
              <CommandList className="max-h-96">
                {mode === "search" ? (
                  <WorkspaceSearchResults
                    query={query}
                    results={searchResults}
                    isLoading={
                      workspaceSearch.isLoading || workspaceSearch.isSearching
                    }
                    isError={workspaceSearch.isError}
                    onSelect={runSearchResult}
                  />
                ) : (
                  <>
                    <CommandEmpty>No commands found.</CommandEmpty>
                    {COMMAND_GROUPS.map((group) => ({
                      heading: group.heading,
                      items: group.items.filter(
                        (item) =>
                          (item.id !== "toggle-filter-bar" ||
                            Boolean(filterScope)) &&
                          (item.id !== "new-note" || canCreateNote) &&
                          (item.id !== "new-color" || canCreateColor) &&
                          (item.id !== "new-folder" || canCreateFolder) &&
                          (item.id !== "upload-images" || canCreateFolder) &&
                          (item.id !== "toggle-collection-view" ||
                            canToggleCollectionView) &&
                          (item.id !== "toggle-alignment-guides" ||
                            canToggleAlignmentGuides) &&
                          (item.id !== "toggle-board-action-rail" ||
                            canToggleBoardActionRail) &&
                          (item.id !== "canvas-text-tool" ||
                            canToggleAlignmentGuides) &&
                          (item.id !== "canvas-arrow-tool" ||
                            canToggleAlignmentGuides) &&
                          (item.id !== "open-pexels-browser" ||
                            canCreateFolder),
                      ),
                    }))
                      .filter((group) => group.items.length > 0)
                      .map((group, index) => (
                        <div key={group.heading}>
                          {index > 0 ? <CommandSeparator /> : null}
                          <CommandGroup heading={group.heading}>
                            {group.items.map((item) => {
                              const Icon =
                                item.id === "toggle-collection-view"
                                  ? collectionView === "canvas"
                                    ? LayoutGridIcon
                                    : PanelsTopLeftIcon
                                  : item.icon;
                              const label =
                                item.id === "change-theme"
                                  ? theme === "dark"
                                    ? "Switch to light mode"
                                    : "Switch to dark mode"
                                  : item.id === "toggle-collection-view"
                                    ? collectionView === "canvas"
                                      ? "Switch to grid view"
                                      : "Switch to canvas view"
                                    : item.id === "toggle-board-action-rail"
                                      ? isBoardActionRailVisible
                                        ? "Hide actions dock"
                                        : "Show actions dock"
                                      : item.id === "toggle-alignment-guides"
                                        ? areAlignmentGuidesEnabled
                                          ? "Hide alignment guides"
                                          : "Show alignment guides"
                                        : item.id === "toggle-filter-bar"
                                          ? isFilterBarOpen
                                            ? "Hide filter bar"
                                            : "Show filter bar"
                                          : item.id === "toggle-sidebar"
                                            ? isSidebarOpen
                                              ? "Hide sidebar"
                                              : "Show sidebar"
                                            : item.label;

                              return (
                                <CommandItem
                                  key={item.id}
                                  value={item.label}
                                  onSelect={() => runCommand(item.id)}
                                >
                                  <Icon className="size-4" />
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
                  </>
                )}
              </CommandList>
            </Command>
          </div>
        </DialogBody>
        <div className="relative z-0 flex flex-wrap items-center gap-x-3 gap-y-1 p-1.5 text-[10px] leading-4 text-muted-foreground sm:pr-[18px] sm:pl-[10px]">
          {mode === "search" ? (
            <span className="inline-flex items-center gap-1">
              <Kbd variant="solid" className="h-4 min-w-fit px-1 text-[10px]">
                Tab
              </Kbd>
              <span>for actions</span>
            </span>
          ) : query.length === 0 ? (
            <span className="inline-flex items-center gap-1">
              <Kbd variant="solid" className="h-4 min-w-fit px-1 text-[10px]">
                Tab
              </Kbd>
              <span>or</span>
              <Kbd variant="solid" className="h-4 min-w-fit px-1 text-[10px]">
                ⌫
              </Kbd>
              <span>to search</span>
            </span>
          ) : null}
          {mode === "search" ? (
            <span className="inline-flex items-center gap-1">
              <Kbd variant="solid" className="h-4 min-w-fit px-1 text-[10px]">
                ⇧ ↵
              </Kbd>
              <span>to peek notes or colors</span>
            </span>
          ) : null}
          <span className="ml-auto inline-flex items-center gap-1">
            <KbdGroup className="gap-0.5">
              <Kbd variant="solid" className="h-4 min-w-4 px-0.5 text-[10px]">
                <ArrowUpIcon />
              </Kbd>
              <Kbd variant="solid" className="h-4 min-w-4 px-0.5 text-[10px]">
                <ArrowDownIcon />
              </Kbd>
            </KbdGroup>
            <span>to navigate</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd variant="solid" className="h-4 min-w-4 px-0.5 text-[10px]">
              <CornerDownLeftIcon />
            </Kbd>
            <span>to select</span>
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
      <ColorEditorDialog
        workspaceSlug={workspaceSlug ?? ""}
        collectionPath={collectionPath}
        target={view === "inbox" ? "inbox" : "collection"}
        open={colorEditorOpen}
        onOpenChange={setColorEditorOpen}
        placement={placement}
      />
    </>
  );
}

function ActionsModePill() {
  return (
    <span
      aria-label="Actions mode. Press Backspace with an empty query to search your workspace."
      className="inline-flex h-6 shrink-0 items-center rounded-md border border-border/70 bg-muted/70 px-2 text-xs font-medium text-foreground shadow-xs"
    >
      Actions
    </span>
  );
}

function CommandInputLeadingContent({
  mode,
  isSearching,
}: {
  mode: PaletteMode;
  isSearching: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.06, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <AnimatePresence initial={false} mode="wait">
      {mode === "commands" ? (
        <motion.span
          key="actions"
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -2 }}
          initial={{ opacity: 0, x: -2 }}
          transition={transition}
        >
          <ActionsModePill />
        </motion.span>
      ) : (
        <span
          key="search"
          className="flex size-3.5 items-center justify-center"
        >
          <WorkspaceSearchInputIndicator isSearching={isSearching} />
        </span>
      )}
    </AnimatePresence>
  );
}

function WorkspaceSearchInputIndicator({
  isSearching,
}: {
  isSearching: boolean;
}) {
  return isSearching ? (
    <span
      aria-label="Searching workspace"
      className="block size-3.5 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground/80"
    />
  ) : (
    <SearchIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
  );
}

function WorkspaceSearchResults({
  query,
  results,
  isLoading,
  isError,
  onSelect,
}: {
  query: string;
  results: WorkspaceSearchResult[];
  isLoading: boolean;
  isError: boolean;
  onSelect: (result: WorkspaceSearchResult) => void;
}) {
  if (isLoading && results.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-sm text-muted-foreground">
        Searching your workspace…
      </p>
    );
  }

  if (isError) {
    return (
      <p className="px-3 py-8 text-center text-sm text-muted-foreground">
        Could not search this workspace. Try again.
      </p>
    );
  }

  if (results.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-sm text-muted-foreground">
        {query.trim()
          ? "No assets, folders, or collections match."
          : "Your recent workspace items will appear here."}
      </p>
    );
  }

  return (
    <CommandGroup heading={query.trim() ? "Results" : "Recent"}>
      {results.map((result) => (
        <CommandItem
          key={`${result.type}:${result.id}`}
          value={searchResultValue(result)}
          className="items-center gap-3 py-2"
          onSelect={() => onSelect(result)}
        >
          <SearchResultPreview result={result} />
          <span className="mr-1.5 min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {result.label}
            </span>
            {result.snippet ? (
              <span className="block truncate text-xs text-muted-foreground">
                {result.snippet}
              </span>
            ) : null}
          </span>
          <span
            data-slot="command-shortcut"
            className="ml-auto max-w-28 shrink-0 truncate text-right text-[11px] text-muted-foreground/75"
          >
            {result.locationLabel}
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

function SearchResultPreview({ result }: { result: WorkspaceSearchResult }) {
  if (result.type === "color" && result.preview?.hex) {
    return (
      <span
        aria-hidden="true"
        className="size-8 shrink-0 rounded-md ring-1 ring-foreground/10"
        style={{ background: result.preview.hex }}
      />
    );
  }

  if (result.type === "image" && result.preview?.url) {
    return (
      <span
        aria-hidden="true"
        className="relative size-8 shrink-0 overflow-hidden rounded-md"
      >
        <ProgressiveImage
          src={result.preview.url}
          blurDataURL={result.preview.blurDataURL}
          className="absolute inset-0 size-full rounded-[inherit] object-cover"
        />
      </span>
    );
  }

  if (result.type === "image" && result.preview?.blurDataURL) {
    return (
      <span
        aria-hidden="true"
        className="relative size-8 shrink-0 overflow-hidden rounded-md bg-muted"
      >
        <img
          src={result.preview.blurDataURL}
          alt=""
          className="absolute -inset-px size-[calc(100%+2px)] max-w-none scale-[1.06] object-cover blur-[0.75px]"
        />
      </span>
    );
  }

  if (result.type === "link" && result.preview?.faviconUrl) {
    return (
      <LinkSearchResultPreview
        src={result.preview.faviconUrl}
        bare={/youtube/i.test(result.preview.hostname ?? "")}
      />
    );
  }

  const Icon =
    result.type === "note"
      ? FileTextIcon
      : result.type === "image"
        ? ImageIcon
        : result.type === "link"
          ? ExternalLinkIcon
          : result.type === "color"
            ? PipetteIcon
            : result.type === "collection"
              ? PanelsTopLeftIcon
              : FolderOpenIcon;

  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
      <Icon className="size-4" />
    </span>
  );
}

function LinkSearchResultPreview({
  src,
  bare = false,
}: {
  src: string;
  bare?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
        <ExternalLinkIcon className="size-4" />
      </span>
    );
  }

  return (
    <span
      className={
        bare
          ? "flex size-8 shrink-0 items-center justify-center"
          : "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-background shadow-sm"
      }
    >
      <img
        src={src}
        alt=""
        className={bare ? "size-8 object-contain" : "size-full object-contain"}
        onError={() => setFailed(true)}
      />
    </span>
  );
}

function searchResultValue(result: WorkspaceSearchResult) {
  return [result.id, result.label, result.snippet, result.locationLabel]
    .filter(Boolean)
    .join(" ");
}

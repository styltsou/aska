import { useEffect } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { AppHeader } from "@/components/app-shell/app-header";
import { GlobalScratchpad } from "@/components/app-shell/global-scratchpad";
import { CommandPalette } from "@/components/command-palette";
import { SettingsDialog } from "@/components/settings-dialog";
import { PexelsBrowserPanel } from "@/components/board/pexels-browser-panel";
import { useRouterState } from "@tanstack/react-router";
import { pruneExpiredUploadImagesDrafts } from "@/lib/upload-images-draft";
import { cn } from "@/lib/utils";
import { getSidebarCollectionLocation } from "./sidebar-collection-navigation";
import { getPexelsBrowserScope, useSessionStore } from "@/store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const isBoardView = useRouterState({
    select: (state) => {
      const segments = state.location.pathname.split("/").filter(Boolean);
      return segments[1] === "collections" && segments.length >= 3;
    },
  });
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { workspaceSlug, collectionSlug, folderPath } =
    getSidebarCollectionLocation(pathname);
  const pexelsBrowserOpen = useSessionStore((state) =>
    collectionSlug
      ? (state.pexelsBrowserByScope[
          getPexelsBrowserScope(workspaceSlug, collectionSlug)
        ]?.open ?? false)
      : false,
  );

  useEffect(() => {
    void pruneExpiredUploadImagesDrafts().catch(() => undefined);
  }, []);

  return (
    <DragDropProvider>
      <SidebarProvider>
        <AppSidebar />
        <GlobalScratchpad />
        <SettingsDialog />
        <CommandPalette />
        <SidebarInset
          className={cn(
            "min-h-0 md:mb-2",
            isBoardView && "h-[calc(100svh-0.5rem)] overflow-hidden",
            isBoardView && pexelsBrowserOpen ? "md:mr-0" : "md:mr-2",
          )}
        >
          <AppHeader />
          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col",
              isBoardView
                ? "min-h-0 overflow-hidden rounded-xl bg-card"
                : "gap-4 rounded-xl bg-card p-3 shadow-sm",
            )}
          >
            {children}
          </div>
        </SidebarInset>
        {collectionSlug ? (
          <PexelsBrowserPanel
            open={pexelsBrowserOpen}
            workspaceSlug={workspaceSlug}
            collectionSlug={collectionSlug}
            parentFolderPath={folderPath}
          />
        ) : null}
      </SidebarProvider>
    </DragDropProvider>
  );
}

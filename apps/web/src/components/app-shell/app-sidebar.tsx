import { NavMain } from "@/components/app-shell/nav-main";
import { SidebarSearchTrigger } from "@/components/app-shell/sidebar-search-trigger";
import { NavProjects } from "@/components/app-shell/nav-projects";
import { NavUser } from "@/components/app-shell/nav-user";
import { WorkspaceSwitcher } from "@/components/app-shell/workspace-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
  useSidebarPeek,
} from "@/components/ui/sidebar";
import { Link, useRouterState } from "@tanstack/react-router";
import { FolderOpenIcon, InboxIcon, StarIcon } from "lucide-react";
import type { AuthState } from "@/lib/auth-flow";
import { useWorkspace } from "@/api/workspace";
import { useMarkInboxSeen } from "@/api/collection";
import { getSidebarCollectionLocation } from "@/components/app-shell/sidebar-collection-navigation";
import { parseWorkspaceAssetPath } from "@/lib/workspace-asset-url";
import { mergeWorkspaceOverlaySearch } from "@/lib/workspace-overlay-search";
import type { WorkspaceRouteSearch } from "@/routes/$workspaceSlug/route";
import { useEffect, useMemo, useRef, useState } from "react";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { state, isMobile } = useSidebar();
  const { peeking, cancelClose, scheduleClose, closePeek } = useSidebarPeek();
  const showPeek = peeking && state === "collapsed" && !isMobile;
  const peekRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const handlePeekMenuOpenChange = (open: boolean) => {
    setMenuOpen(open);
    if (open) cancelClose();
    else if (!peekRef.current?.matches(":hover")) scheduleClose();
  };
  useEffect(() => {
    if (state === "expanded" || isMobile) closePeek();
  }, [state, isMobile, closePeek]);
  const authState = useRouterState({
    select: (state) =>
      state.matches.find((match) => match.routeId === "/$workspaceSlug")
        ?.context as AuthState | undefined,
  });
  const pathname = useRouterState({
    select: (state) =>
      parseWorkspaceAssetPath(state.location.pathname).boardPathname,
  });
  const workspaceSearch = useRouterState({
    select: (state) => state.location.search as WorkspaceRouteSearch,
  });
  const boardSearch = useMemo(
    () =>
      mergeWorkspaceOverlaySearch(workspaceSearch, {
        asset: undefined,
        view: undefined,
      }),
    [workspaceSearch],
  );

  const { workspaceSlug, collectionSlug: activeCollectionSlug } =
    getSidebarCollectionLocation(pathname);
  const { data: workspaceData, isLoading: isWorkspaceLoading } =
    useWorkspace(workspaceSlug);
  const { mutate: markInboxSeen } = useMarkInboxSeen(workspaceSlug);
  const collections = workspaceData?.collections ?? [];
  const isCollectionsRoot = pathname === `/${workspaceSlug}`;
  const isInbox = pathname === `/${workspaceSlug}/inbox`;
  const navMain = [
    {
      title: "Collections",
      icon: <FolderOpenIcon />,
      isActive: isCollectionsRoot,
      link: (
        <Link
          to="/$workspaceSlug"
          params={{ workspaceSlug }}
          search={boardSearch}
          activeOptions={{ exact: true }}
        />
      ),
    },
    {
      title: "Favorites",
      icon: <StarIcon />,
      disabled: true,
    },
    {
      title: "Inbox",
      icon: <InboxIcon />,
      count: workspaceData?.inbox.unreadCount,
      isActive: isInbox,
      link: (
        <Link
          to="/$workspaceSlug/inbox"
          params={{ workspaceSlug }}
          search={boardSearch}
          activeOptions={{ exact: true }}
          onClick={(event) => {
            if (
              event.button === 0 &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.shiftKey &&
              !event.altKey
            ) {
              markInboxSeen();
            }
          }}
        />
      ),
    },
  ];

  const navCollections = collections.map((collection) => ({
    name: collection.name,
    count: collection.assetCount,
    isActive: activeCollectionSlug === collection.slug,
    link: (
      <Link
        to="/$workspaceSlug/collections/$"
        params={{
          workspaceSlug,
          _splat: collection.slug,
        }}
        search={boardSearch}
        activeOptions={{ exact: false }}
      />
    ),
  }));

  const navigation = (includeExtras: boolean) => (
    <SidebarContent className="overflow-visible">
      <div className="shrink-0">
        {includeExtras ? <SidebarSearchTrigger /> : null}
        <NavMain items={navMain} />
      </div>
      <NavProjects
        collections={navCollections}
        isLoading={isWorkspaceLoading}
      />
    </SidebarContent>
  );

  return (
    <>
      <Sidebar variant="inset" className="pt-0 pb-0" {...props}>
        <SidebarHeader>
          <WorkspaceSwitcher />
        </SidebarHeader>
        {navigation(true)}
        <SidebarFooter className="shrink-0">
          {authState?.session?.user ? (
            <NavUser user={authState.session.user} />
          ) : (
            <SidebarUserSkeleton />
          )}
        </SidebarFooter>
      </Sidebar>
      <aside
        ref={peekRef}
        aria-label="Sidebar preview"
        aria-hidden={!showPeek}
        inert={!showPeek}
        data-slot="sidebar-peek"
        data-open={showPeek ? "" : undefined}
        className="pointer-events-none fixed top-13 bottom-3 left-3 z-30 hidden w-64 -translate-x-1 flex-col overflow-hidden rounded-xl border border-sidebar-border bg-sidebar text-sidebar-foreground opacity-0 shadow-xl transition-[opacity,transform] duration-150 ease-(--sidebar-ease) motion-reduce:transform-none motion-reduce:transition-opacity md:flex data-open:pointer-events-auto data-open:translate-x-0 data-open:opacity-100 data-open:duration-200"
        onPointerEnter={cancelClose}
        onPointerLeave={() => {
          if (!menuOpen) scheduleClose();
        }}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a[href]")) closePeek();
        }}
      >
        <SidebarHeader>
          <WorkspaceSwitcher onMenuOpenChange={handlePeekMenuOpenChange} />
        </SidebarHeader>
        {navigation(false)}
        <SidebarFooter className="shrink-0">
          {authState?.session?.user ? (
            <NavUser
              user={authState.session.user}
              onMenuOpenChange={handlePeekMenuOpenChange}
            />
          ) : (
            <SidebarUserSkeleton />
          )}
        </SidebarFooter>
      </aside>
    </>
  );
}

function SidebarUserSkeleton() {
  return (
    <div className="flex items-center gap-2 p-2">
      <Skeleton className="size-8 rounded-full" />
      <div className="grid flex-1 gap-1">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="ml-auto size-4" />
    </div>
  );
}

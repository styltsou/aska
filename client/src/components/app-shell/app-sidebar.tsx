import { NavMain } from "@/components/app-shell/nav-main";
import { SidebarSearchTrigger } from "@/components/app-shell/sidebar-search-trigger";
import { NavProjects } from "@/components/app-shell/nav-projects";
import { NavSecondary } from "@/components/app-shell/nav-secondary";
import { NavUser } from "@/components/app-shell/nav-user";
import { WorkspaceSwitcher } from "@/components/app-shell/workspace-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  FolderOpenIcon,
  InboxIcon,
  LifeBuoyIcon,
  SendIcon,
  SettingsIcon,
  StarIcon,
} from "lucide-react";
import type { AuthState } from "@/lib/auth-flow";
import { useWorkspace } from "@/api/workspace";
import { useMarkInboxSeen } from "@/api/collection";
import { getSidebarCollectionLocation } from "@/components/app-shell/sidebar-collection-navigation";
import { openSettings } from "@/lib/settings-dialog";
import { parseWorkspaceAssetPath } from "@/lib/workspace-asset-url";
import { mergeWorkspaceOverlaySearch } from "@/lib/workspace-overlay-search";
import type { WorkspaceRouteSearch } from "@/routes/$workspaceSlug/route";
import { useMemo, type ReactNode } from "react";

export function AppSidebar({
  compact = false,
  ...props
}: React.ComponentProps<typeof Sidebar> & { compact?: boolean }) {
  const { isMobile } = useSidebar();
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

  const navSecondary = [
    { title: "Support", icon: <LifeBuoyIcon />, disabled: true },
    { title: "Feedback", icon: <SendIcon />, disabled: true },
    {
      title: "Settings",
      icon: <SettingsIcon />,
      onClick: openSettings,
    },
  ];
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

  return (
    <>
      <Sidebar
        variant={compact ? "canvas" : "inset"}
        className="pt-0 pb-0"
        {...props}
      >
        <SidebarHeader>
          <WorkspaceSwitcher />
        </SidebarHeader>
        <SidebarContent>
          <SidebarSearchTrigger />
          <NavMain items={navMain} />
          <NavProjects
            collections={navCollections}
            isLoading={isWorkspaceLoading}
          />
          <NavSecondary items={navSecondary} className="mt-auto" />
        </SidebarContent>
        <SidebarFooter>
          {authState?.session?.user ? (
            <NavUser user={authState.session.user} />
          ) : (
            <SidebarUserSkeleton />
          )}
        </SidebarFooter>
      </Sidebar>
      <AnimatePresence initial={false}>
        {compact && !isMobile ? (
          <CanvasFloatingSidebar
            workspace={<WorkspaceSwitcher />}
            library={
              <div className="flex flex-col gap-1 p-2">
                <SidebarSearchTrigger />
                <NavMain items={navMain} />
              </div>
            }
            collections={
              <div className="max-h-[42svh] overflow-y-auto p-2">
                <NavProjects
                  collections={navCollections}
                  isLoading={isWorkspaceLoading}
                />
              </div>
            }
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function CanvasFloatingSidebar({
  workspace,
  library,
  collections,
}: {
  workspace: ReactNode;
  library: ReactNode;
  collections: ReactNode;
}) {
  const { open } = useSidebar();
  const reduceMotion = useReducedMotion();

  return (
    <motion.aside
      aria-label="Workspace navigation"
      aria-hidden={!open}
      inert={!open}
      className="fixed top-14 left-3 z-30 hidden w-56 max-w-[calc(100vw-1.5rem)] flex-col gap-2 text-sidebar-foreground md:flex"
      initial={reduceMotion ? false : { opacity: 0, x: -8, y: -4, scale: 0.98 }}
      animate={
        open
          ? { opacity: 1, x: 0, y: 0, scale: 1 }
          : { opacity: 0, x: -5, y: -2, scale: 0.99 }
      }
      exit={
        reduceMotion ? undefined : { opacity: 0, x: -5, y: -2, scale: 0.99 }
      }
      transition={{
        duration: reduceMotion ? 0 : open ? 0.25 : 0.15,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <FloatingSidebarIsland index={0} reduceMotion={reduceMotion}>
        {workspace}
      </FloatingSidebarIsland>
      <FloatingSidebarIsland index={1} reduceMotion={reduceMotion}>
        {library}
      </FloatingSidebarIsland>
      <FloatingSidebarIsland index={2} reduceMotion={reduceMotion}>
        {collections}
      </FloatingSidebarIsland>
    </motion.aside>
  );
}

function FloatingSidebarIsland({
  children,
  index,
  reduceMotion,
}: {
  children: ReactNode;
  index: number;
  reduceMotion: boolean | null;
}) {
  return (
    <motion.section
      className="overflow-hidden rounded-lg bg-sidebar shadow-sm ring-1 shadow-foreground/5 ring-sidebar-border [&_[data-sidebar=group]]:p-0"
      initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: reduceMotion ? 0 : 0.25,
        delay: reduceMotion ? 0 : index * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.section>
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

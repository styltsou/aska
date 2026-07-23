import { NavMain } from "@/components/app-shell/nav-main";
import { NavContext } from "@/components/app-shell/nav-context";
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
} from "@/components/ui/sidebar";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  FolderOpenIcon,
  InboxIcon,
  LifeBuoyIcon,
  SendIcon,
  SettingsIcon,
  StarIcon,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useWorkspace } from "@/api/workspace";
import { useCollectionContents, useMarkInboxSeen } from "@/api/collection";
import {
  getSidebarCollectionLocation,
  makeChildFolderPath,
} from "@/components/app-shell/sidebar-collection-navigation";
import { openSettings } from "@/lib/settings-dialog";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { data: session, isPending } = useSession();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const navSecondary = [
    { title: "Support", icon: <LifeBuoyIcon />, disabled: true },
    { title: "Feedback", icon: <SendIcon />, disabled: true },
    {
      title: "Settings",
      icon: <SettingsIcon />,
      onClick: openSettings,
    },
  ];
  const {
    workspaceSlug,
    collectionSlug: activeCollectionSlug,
    folderSegments: activeFolderSegments,
    folderPath: activeFolderPath,
  } = getSidebarCollectionLocation(pathname);
  const { data: workspaceData, isLoading: isWorkspaceLoading } =
    useWorkspace(workspaceSlug);
  const { mutate: markInboxSeen } = useMarkInboxSeen(workspaceSlug);
  const collections = workspaceData?.collections ?? [];
  const isCollectionsRoot = pathname === `/${workspaceSlug}`;
  const isInbox = pathname === `/${workspaceSlug}/inbox`;
  const {
    data: currentCollectionContents,
    isLoading: areCurrentFoldersLoading,
  } = useCollectionContents(
    workspaceSlug,
    activeCollectionSlug ?? "",
    activeFolderPath || undefined,
    { enabled: !!activeCollectionSlug },
  );

  const navMain = [
    {
      title: "Collections",
      icon: <FolderOpenIcon />,
      isActive: isCollectionsRoot,
      link: (
        <Link
          to="/$workspaceSlug"
          params={{ workspaceSlug }}
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
          search={{ note: undefined, image: undefined }}
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
        search={{ note: undefined, image: undefined }}
        activeOptions={{ exact: false }}
      />
    ),
  }));

  const navContext = activeCollectionSlug
    ? (currentCollectionContents?.nodes ?? [])
        .filter((node) => node.type === "folder")
        .map((folder) => ({
          title: folder.name,
          count: folder.count,
          link: (
            <Link
              to="/$workspaceSlug/collections/$"
              params={{
                workspaceSlug,
                _splat: makeChildFolderPath(
                  activeCollectionSlug,
                  activeFolderSegments,
                  folder.slug,
                ),
              }}
              search={{ note: undefined, image: undefined }}
              activeOptions={{ exact: true }}
            />
          ),
        }))
    : [];

  return (
    <Sidebar variant="inset" className="pt-0 pb-0" {...props}>
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavProjects
          collections={navCollections}
          isLoading={isWorkspaceLoading}
        />
        {activeCollectionSlug &&
        (areCurrentFoldersLoading || navContext.length > 0) ? (
          <NavContext items={navContext} isLoading={areCurrentFoldersLoading} />
        ) : null}
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        {isPending ? (
          <div className="flex items-center gap-2 p-2">
            <Skeleton className="size-8 rounded-full" />
            <div className="grid flex-1 gap-1">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="ml-auto size-4" />
          </div>
        ) : session?.user ? (
          <NavUser user={session.user} />
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}

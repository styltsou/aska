import { NavMain } from "@/components/app-shell/nav-main";
import { NavContext } from "@/components/app-shell/nav-context";
import { NavProjects } from "@/components/app-shell/nav-projects";
import { NavSecondary } from "@/components/app-shell/nav-secondary";
import { NavUser } from "@/components/app-shell/nav-user";
import { WorkspaceSwitcher } from "@/components/app-shell/workspace-switcher";
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
import { useCollectionContents, useInboxContents } from "@/api/collection";

const data = {
  navSecondary: [
    { title: "Support", icon: <LifeBuoyIcon />, disabled: true },
    { title: "Feedback", icon: <SendIcon />, disabled: true },
    { title: "Settings", icon: <SettingsIcon />, disabled: true },
  ],
};

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const workspaceSlug = pathname.split("/")[1] || "personal";
  const { data: workspaceData, isLoading: isWorkspaceLoading } =
    useWorkspace(workspaceSlug);
  const collections = workspaceData?.collections ?? [];
  const { data: inboxData } = useInboxContents(workspaceSlug);
  const collectionPath = pathname.match(/^\/[^/]+\/collections\/(.+)/)?.[1];
  const [activeCollectionSlug, ...activeFolderSegments] =
    collectionPath?.split("/") ?? [];
  const activeFolderPath = activeFolderSegments.join("/");
  const activeCollection = collections.find(
    (collection) => collection.slug === activeCollectionSlug,
  );
  const isCollectionsRoot = pathname === `/${workspaceSlug}`;
  const isInbox = pathname === `/${workspaceSlug}/inbox`;
  const { data: rootCollectionContents } = useCollectionContents(
    workspaceSlug,
    activeCollectionSlug ?? "",
    undefined,
    { enabled: !!activeCollection && !activeFolderPath },
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
      count: inboxData?.nodes.length,
      isActive: isInbox,
      link: (
        <Link
          to="/$workspaceSlug/inbox"
          params={{ workspaceSlug }}
          search={{ note: undefined, image: undefined }}
          activeOptions={{ exact: true }}
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

  const navContext =
    activeCollection && !activeFolderPath
      ? (rootCollectionContents?.nodes ?? [])
          .filter((node) => node.type === "folder")
          .map((folder) => {
            return {
              title: folder.name,
              count: folder.count,
              link: (
                <Link
                  to="/$workspaceSlug/collections/$"
                  params={{
                    workspaceSlug,
                    _splat: `${activeCollection.slug}/${folder.slug}`,
                  }}
                  search={{ note: undefined, image: undefined }}
                  activeOptions={{ exact: true }}
                />
              ),
            };
          })
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
        {navContext.length > 0 ? <NavContext items={navContext} /> : null}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        {session?.user ? <NavUser user={session.user} /> : null}
      </SidebarFooter>
    </Sidebar>
  );
}

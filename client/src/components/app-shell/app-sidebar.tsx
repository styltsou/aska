import { NavMain } from "@/components/app-shell/nav-main";
import { NavContext } from "@/components/app-shell/nav-context";
import { NavProjects } from "@/components/app-shell/nav-projects";
import { NavSecondary } from "@/components/app-shell/nav-secondary";
import { NavUser } from "@/components/app-shell/nav-user";
import { WorkspaceSwitcher } from "@/components/app-shell/workspace-switcher";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { collectionFolders } from "@/data/collection-folders";
import { collections } from "@/data/collections";
import { slugFromTitle } from "@/lib/slug";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ClockIcon,
  FolderOpenIcon,
  InboxIcon,
  LifeBuoyIcon,
  SendIcon,
  SettingsIcon,
  StarIcon,
} from "lucide-react";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navSecondary: [
    { title: "Support", icon: <LifeBuoyIcon />, disabled: true },
    { title: "Feedback", icon: <SendIcon />, disabled: true },
    { title: "Settings", icon: <SettingsIcon />, disabled: true },
  ],
};

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const workspaceSlug = pathname.split("/")[1] || "personal";
  const collectionPath = pathname.match(/^\/[^/]+\/collections\/(.+)/)?.[1];
  const [activeCollectionSlug, ...activeFolderSegments] = collectionPath?.split("/") ?? [];
  const activeFolderPath = activeFolderSegments.join("/");
  const activeCollection = collections.find(
    (collection) => collection.slug === activeCollectionSlug,
  );
  const isCollectionsRoot = pathname === `/${workspaceSlug}`;

  const navMain = [
    {
      title: "Collections",
      icon: <FolderOpenIcon />,
      isActive: isCollectionsRoot,
      link: (
        <Link to="/$workspaceSlug" params={{ workspaceSlug }} activeOptions={{ exact: true }} />
      ),
    },
    {
      title: "Recent",
      icon: <ClockIcon />,
      disabled: true,
    },
    {
      title: "Favorites",
      icon: <StarIcon />,
      disabled: true,
    },
    {
      title: "Inbox",
      icon: <InboxIcon />,
      disabled: true,
    },
  ];

  const navCollections = collections.map((collection) => ({
    name: collection.name,
    count: collection.count,
    isActive: activeCollectionSlug === collection.slug,
    link: (
      <Link
        to="/$workspaceSlug/collections/$"
        params={{
          workspaceSlug,
          _splat: collection.slug,
        }}
        activeOptions={{ exact: false }}
      />
    ),
  }));

  const navContext = activeCollection && !activeFolderPath
    ? collectionFolders.map((folder) => {
        const folderSlug = slugFromTitle(folder.name);

        return {
          title: folder.name,
          count: folder.count,
          link: (
            <Link
              to="/$workspaceSlug/collections/$"
              params={{
                workspaceSlug,
                _splat: `${activeCollection.slug}/${folderSlug}`,
              }}
              activeOptions={{ exact: true }}
            />
          ),
        };
      })
    : [];

  return (
    <Sidebar variant="inset" className="pt-0" {...props}>
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavProjects collections={navCollections} />
        {navContext.length > 0 ? <NavContext items={navContext} /> : null}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}

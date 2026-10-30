import { Skeleton } from "@/components/ui/skeleton";
import "./nav-projects.css";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface NavCollection {
  name: string;
  count: number;
  link: React.ReactElement;
  isActive?: boolean;
}

interface NavProjectsProps {
  collections: NavCollection[];
  isLoading?: boolean;
}

export function NavProjects({ collections, isLoading }: NavProjectsProps) {
  if (isLoading) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Collections</SidebarGroupLabel>
        <SidebarMenu className="gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <SidebarMenuItem key={i}>
              <div className="flex h-8 items-center gap-2 px-2">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-3 w-6" />
              </div>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  if (collections.length === 0) return null;

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Collections</SidebarGroupLabel>
      <SidebarMenu className="gap-1">
        {collections.map((item) => (
          <CollectionItem key={item.name} item={item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function CollectionItem({ item }: { item: NavCollection }) {
  function measureOverflow(event: React.SyntheticEvent<HTMLElement>) {
    const row = event.currentTarget;
    const viewport = row.querySelector<HTMLElement>(
      ".collection-name-viewport",
    );
    const name = row.querySelector<HTMLElement>(".collection-name-text");
    if (!viewport || !name) return;

    const distance = Math.max(0, name.offsetWidth - viewport.clientWidth + 8);
    const overflowing = distance > 0;
    row.style.setProperty("--collection-name-distance", `${distance}px`);
    row.style.setProperty(
      "--collection-name-duration",
      `${Math.max(0.6, distance / 50)}s`,
    );
    row.toggleAttribute("data-name-overflow", overflowing);
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        data-active={item.isActive}
        render={item.link}
        onMouseEnter={measureOverflow}
        onFocus={measureOverflow}
        title={item.name}
      >
        <span className="collection-name-viewport min-w-0 flex-1 overflow-hidden">
          <span className="collection-name-text block w-max whitespace-nowrap">
            {item.name}
          </span>
        </span>
        <span className="shrink-0 text-xs text-sidebar-foreground/40">
          {item.count}
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

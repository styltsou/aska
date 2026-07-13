import { Skeleton } from "@/components/ui/skeleton";
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
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton data-active={item.isActive} render={item.link}>
              <span>{item.name}</span>
              <span className="ml-auto text-xs text-sidebar-foreground/40">
                {item.count}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

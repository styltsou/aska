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

export function NavProjects({ collections }: { collections: NavCollection[] }) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Collections</SidebarGroupLabel>
      <SidebarMenu className="gap-1">
        {collections.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton data-active={item.isActive} render={item.link}>
              <span>{item.name}</span>
              <span className="ml-auto text-xs text-sidebar-foreground/40">{item.count}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

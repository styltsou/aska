import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface NavContextItem {
  title: string;
  count?: number;
  link: React.ReactElement;
}

export function NavContext({ items }: { items: NavContextItem[] }) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Folders</SidebarGroupLabel>
      <SidebarMenu className="gap-1">
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton render={item.link} size="sm">
              <span>{item.title}</span>
              {typeof item.count === "number" ? (
                <span className="ml-auto text-xs text-sidebar-foreground/40">
                  {item.count}
                </span>
              ) : null}
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

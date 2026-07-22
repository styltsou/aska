import { Skeleton } from "@/components/ui/skeleton";
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

interface NavContextProps {
  items: NavContextItem[];
  isLoading?: boolean;
}

export function NavContext({ items, isLoading }: NavContextProps) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Folders</SidebarGroupLabel>
      <SidebarMenu className="gap-1">
        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <SidebarMenuItem key={index}>
                <div className="flex h-7 items-center gap-2 px-2">
                  <Skeleton className="h-3.5 flex-1" />
                  <Skeleton className="h-3 w-5" />
                </div>
              </SidebarMenuItem>
            ))
          : items.map((item) => (
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

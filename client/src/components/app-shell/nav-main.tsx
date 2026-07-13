import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface NavMainItem {
  title: string;
  icon: React.ReactNode;
  link?: React.ReactElement;
  isActive?: boolean;
  disabled?: boolean;
  count?: number;
}

export function NavMain({
  items,
  label = "Library",
}: {
  items: NavMainItem[];
  label?: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu className="gap-1">
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              tooltip={item.title}
              data-active={item.isActive}
              disabled={item.disabled}
              render={item.link}
            >
              {item.icon}
              <span>{item.title}</span>
              {item.count !== undefined && item.count > 0 ? (
                <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 py-0.5 text-[11px] leading-none font-medium text-background tabular-nums">
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

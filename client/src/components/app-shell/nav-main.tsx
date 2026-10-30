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
                <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-md border border-(--control-primary-edge) bg-linear-to-b from-(--control-primary-top) to-(--control-primary-bottom) px-1.5 py-0.5 text-[11px] leading-none font-semibold text-(--control-primary-foreground) tabular-nums shadow-[inset_0_1px_0_rgb(255_255_255_/_0.12),0_1px_2px_rgb(0_0_0_/_0.12)] [--control-primary-bottom:#171717] [--control-primary-edge:#0e0e0e] [--control-primary-foreground:#fafafa] [--control-primary-top:#373737] dark:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.10),0_1px_2px_rgb(0_0_0_/_0.20)] dark:[--control-primary-bottom:#e5e5e5] dark:[--control-primary-edge:#c9c9c9] dark:[--control-primary-foreground:#171717] dark:[--control-primary-top:#ffffff]">
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

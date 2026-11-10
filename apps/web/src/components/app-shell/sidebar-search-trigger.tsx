import { SearchIcon } from "lucide-react";
import { SidebarGroup } from "@/components/ui/sidebar";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { getPlatformModifier } from "@/lib/platform";

export function SidebarSearchTrigger() {
  function handleClick() {
    const isMac = navigator.platform.toLowerCase().includes("mac");
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        metaKey: isMac,
        ctrlKey: !isMac,
        bubbles: true,
      }),
    );
  }

  return (
    <SidebarGroup>
      <button
        type="button"
        onClick={handleClick}
        className="flex h-8 w-full items-center gap-2 overflow-hidden rounded-md bg-background px-2 text-left text-sm text-muted-foreground shadow-[0_0_0_1px_var(--sidebar-border)] outline-hidden transition-colors group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:bg-transparent! group-data-[collapsible=icon]:p-2! group-data-[collapsible=icon]:shadow-none! hover:bg-sidebar-hover hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-active active:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0"
      >
        <SearchIcon className="shrink-0" />
        <span className="flex-1 truncate group-data-[collapsible=icon]:hidden">
          Search
        </span>
        <KbdGroup className="ml-auto group-data-[collapsible=icon]:hidden">
          <Kbd>{getPlatformModifier()}</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </button>
    </SidebarGroup>
  );
}

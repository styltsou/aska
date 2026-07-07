import { useState } from "react";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const workspaces = [
  { name: "Personal", plan: "Pro", initial: "P" },
  { name: "Design Studio", plan: "Team", initial: "D" },
  { name: "Client Work", plan: "Free", initial: "C" },
];

export function WorkspaceSwitcher() {
  const [active, setActive] = useState(workspaces[0]);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(triggerProps) => (
              <div
                {...triggerProps}
                className="flex h-12 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-sm outline-none transition-colors duration-150 hover:bg-sidebar-hover hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-open:bg-sidebar-active data-open:text-sidebar-accent-foreground"
              >
                <Avatar
                  size="sm"
                  className="rounded-md after:rounded-md"
                >
                  <AvatarFallback className="rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
                    {active.initial}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{active.name}</span>
                  <span className="truncate text-xs text-sidebar-foreground/50">{active.plan}</span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4 text-sidebar-foreground/50" />
              </div>
            )}
          />
          <DropdownMenuContent
            className="w-80 rounded-lg"
            align="end"
            side="bottom"
            sideOffset={4}
            style={{ backdropFilter: "blur(4px) saturate(1.5)" }}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Workspaces
              </DropdownMenuLabel>
              {workspaces.map((w) => (
                <DropdownMenuItem
                  key={w.name}
                  className="cursor-pointer gap-2 transition-colors duration-150"
                  onClick={() => setActive(w)}
                >
                  <Avatar
                    size="sm"
                    className="rounded-md after:rounded-md"
                  >
                    <AvatarFallback className="rounded-md bg-sidebar-primary !text-sidebar-primary-foreground text-xs font-semibold">
                      {w.initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{w.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{w.plan}</span>
                  </div>
                  {w.name === active.name && <CheckIcon className="size-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer gap-2 transition-colors duration-150">
              <PlusIcon className="size-4" />
              <span>New workspace</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

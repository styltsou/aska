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
import { Skeleton } from "@/components/ui/skeleton";
import { CreateWorkspaceDialog } from "@/components/app-shell/create-workspace-dialog";
import { authClient } from "@/lib/auth-client";
import { setActiveWorkspace } from "@/lib/auth-flow";
import { useNavigate, useRouterState } from "@tanstack/react-router";

function workspaceInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

export function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const workspaceSlug = pathname.split("/")[1] || "";
  const { data, isPending } = authClient.useListOrganizations();
  const workspaces = data ?? [];
  const active =
    workspaces.find((workspace) => workspace.slug === workspaceSlug) ??
    workspaces[0];
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(triggerProps) => (
              <div
                {...triggerProps}
                className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-sm transition-colors duration-150 outline-none hover:bg-sidebar-hover hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring aria-expanded:bg-sidebar-active aria-expanded:text-sidebar-accent-foreground"
              >
                <Avatar size="sm" className="rounded-md after:rounded-md">
                  <AvatarFallback className="rounded-md bg-foreground text-xs font-semibold text-background">
                    {active ? workspaceInitial(active.name) : ""}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  {isPending ? (
                    <Skeleton className="h-4 w-20" />
                  ) : (
                    <span className="truncate font-medium">
                      {active?.name ?? "Workspace"}
                    </span>
                  )}
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </div>
            )}
          />
          <DropdownMenuContent
            className="w-80 rounded-lg"
            align="end"
            side="right"
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
                  className="cursor-pointer gap-2 py-1.5 transition-colors duration-150"
                  onClick={async () => {
                    await setActiveWorkspace(w);
                    void navigate({
                      to: "/$workspaceSlug",
                      params: { workspaceSlug: w.slug },
                    });
                  }}
                >
                  <Avatar
                    size="sm"
                    className="rounded-md after:rounded-md data-[size=sm]:size-5"
                  >
                    <AvatarFallback className="rounded-md bg-foreground text-[10px] font-semibold text-background group-focus/dropdown-menu-item:text-background!">
                      {workspaceInitial(w.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{w.name}</span>
                  </div>
                  {w.id === active?.id && <CheckIcon className="size-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer gap-2 py-1.5 transition-colors duration-150"
              onClick={() => setIsCreateOpen(true)}
            >
              <div className="flex size-5 items-center justify-center">
                <PlusIcon className="size-4" />
              </div>
              <span>New workspace</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
          <CreateWorkspaceDialog
            open={isCreateOpen}
            onOpenChange={setIsCreateOpen}
          />
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

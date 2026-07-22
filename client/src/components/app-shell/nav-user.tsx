"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  ChevronsUpDownIcon,
  SparklesIcon,
  BadgeCheckIcon,
  CreditCardIcon,
  LogOutIcon,
} from "lucide-react";
import { signOut, type AuthUser } from "@/lib/auth-client";
import { clearAuthStateCache } from "@/lib/auth-flow";
import { useRouter } from "@tanstack/react-router";

export function NavUser({ user }: { user: AuthUser }) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const avatarUrl = user.image ?? undefined;
  const fallback =
    user.name?.charAt(0).toUpperCase() ?? user.email.charAt(0).toUpperCase();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  className="aria-expanded:bg-sidebar-active aria-expanded:text-sidebar-accent-foreground"
                />
              }
            >
              <Avatar>
                <AvatarImage src={avatarUrl} alt={user.name} />
                <AvatarFallback>{fallback}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "top"}
              align="end"
              sideOffset={8}
              style={{ backdropFilter: "blur(4px) saturate(1.5)" }}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar>
                      <AvatarImage src={avatarUrl} alt={user.name} />
                      <AvatarFallback>{fallback}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user.name}</span>
                      <span className="truncate text-xs">{user.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem className="cursor-pointer hover:bg-primary! hover:text-primary-foreground! hover:**:text-primary-foreground! focus:bg-primary! focus:text-primary-foreground! focus:**:text-primary-foreground! data-highlighted:bg-primary! data-highlighted:text-primary-foreground! data-highlighted:**:text-primary-foreground!">
                  <SparklesIcon />
                  Upgrade to Pro
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem className="cursor-pointer">
                  <BadgeCheckIcon />
                  Account
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <CreditCardIcon />
                  Billing
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-red-600! hover:bg-red-500/20! hover:**:text-red-600! focus:bg-red-500/20! focus:**:text-red-600! data-highlighted:bg-red-500/20! data-highlighted:**:text-red-600! dark:text-red-400! dark:hover:bg-red-500/30! dark:hover:**:text-red-400! dark:focus:bg-red-500/30! dark:focus:**:text-red-400! dark:data-highlighted:bg-red-500/30! dark:data-highlighted:**:text-red-400!"
                onClick={() => setShowLogoutConfirm(true)}
              >
                <LogOutIcon />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent size="sm">
          <AlertDialogBody>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to sign out?
              </AlertDialogDescription>
            </AlertDialogHeader>
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                await signOut();
                clearAuthStateCache();
                await router.invalidate();
                void router.navigate({ to: "/login", replace: true });
              }}
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

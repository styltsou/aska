"use client";

import { useState } from "react";
import { UserAvatar } from "@/components/user-avatar";
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
  CompassIcon,
  LifeBuoyIcon,
  LoaderCircleIcon,
  LogOutIcon,
  SendIcon,
  SettingsIcon,
} from "lucide-react";
import { authClient, signOut, type AuthUser } from "@/lib/auth-client";
import { clearAuthStateCache } from "@/lib/auth-flow";
import { clearMediaSession } from "@/lib/media-session";
import { openSettings } from "@/lib/settings-dialog";
import { restartOnboardingTour } from "@/lib/onboarding-tour";
import { useRouter } from "@tanstack/react-router";

export function NavUser({
  user: routeUser,
  onMenuOpenChange,
}: {
  user: AuthUser;
  onMenuOpenChange?: (open: boolean) => void;
}) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  // The route's session is cached for a while; the live session reflects an
  // avatar change as soon as it is saved.
  const { data: liveSession } = authClient.useSession();
  const user = liveSession?.user ?? routeUser;
  const displayName = user.name || user.email;
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu onOpenChange={onMenuOpenChange}>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  className="aria-expanded:bg-sidebar-active aria-expanded:text-sidebar-accent-foreground"
                />
              }
            >
              <UserAvatar user={user} name={displayName} />
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
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <UserAvatar user={user} name={displayName} />
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user.name}</span>
                      <span className="truncate text-xs">{user.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={openSettings}
                >
                  <SettingsIcon />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <LifeBuoyIcon />
                  Support
                </DropdownMenuItem>
                <DropdownMenuItem onClick={restartOnboardingTour}>
                  <CompassIcon />
                  Take the tour
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <SendIcon />
                  Feedback
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-red-600! hover:bg-red-500/20! hover:**:text-red-600! focus:bg-red-500/20! focus:**:text-red-600! data-highlighted:bg-red-500/20! data-highlighted:**:text-red-600! dark:text-red-400! dark:hover:bg-red-500/30! dark:hover:**:text-red-400! dark:focus:bg-red-500/30! dark:focus:**:text-red-400! dark:data-highlighted:bg-red-500/30! dark:data-highlighted:**:text-red-400!"
                onClick={() => setShowLogoutConfirm(true)}
              >
                <LogOutIcon />
                Sign out
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
            <AlertDialogCancel disabled={isSigningOut}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isSigningOut}
              onClick={async () => {
                if (isSigningOut) return;
                setIsSigningOut(true);
                try {
                  try {
                    await clearMediaSession();
                  } finally {
                    await signOut();
                  }
                  clearAuthStateCache();
                  await router.invalidate();
                  await router.navigate({ to: "/login", replace: true });
                } finally {
                  setIsSigningOut(false);
                }
              }}
            >
              {isSigningOut ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <LogOutIcon />
              )}
              <span>{isSigningOut ? "Signing out" : "Sign out"}</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

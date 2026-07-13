import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { AppHeader } from "@/components/app-shell/app-header";
import { GlobalScratchpad } from "@/components/app-shell/global-scratchpad";
import { CommandPalette } from "@/components/command-palette";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <GlobalScratchpad />
      <CommandPalette />
      <SidebarInset>
        <AppHeader />
        <div className="flex min-w-0 flex-1 flex-col gap-4 rounded-tl-xl bg-card p-3 shadow-sm">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

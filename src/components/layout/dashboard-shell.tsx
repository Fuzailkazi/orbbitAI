import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./sidebar";
import { Topbar } from "./topbar";

export interface ShellViewer {
  kind: "user" | "guest";
  /** Email for signed-in users, "Guest" for the demo session. */
  label: string;
}

interface DashboardShellProps {
  children: React.ReactNode;
  /** Sidebar footer slot — the layout streams the viewer (cookies + auth) into it inside Suspense. */
  viewerFooter: React.ReactNode;
  openRouterConfigured: boolean;
}

export function DashboardShell({ children, viewerFooter, openRouterConfigured }: DashboardShellProps) {
  return (
    <SidebarProvider className="h-svh !min-h-0 overflow-hidden">
      <AppSidebar footer={viewerFooter} />
      <SidebarInset className="flex min-w-0 flex-col overflow-hidden">
        <Topbar openRouterConfigured={openRouterConfigured} />
        {/* SidebarInset already renders <main>; this is the scroll container. */}
        <div data-slot="dashboard-scroll" className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

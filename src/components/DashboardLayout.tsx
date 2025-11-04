import { Sidebar } from "./Sidebar";
import { NotificationBell } from "./NotificationBell";
import { ClusterSelector } from "./ClusterSelector";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "./ui/button";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed left-0 top-0 bottom-0 z-50 transition-transform duration-300 lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar with cluster selector and notifications */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex justify-between items-center px-4 sm:px-6 lg:px-8 py-3 gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <ClusterSelector />
            </div>
            <NotificationBell />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
};

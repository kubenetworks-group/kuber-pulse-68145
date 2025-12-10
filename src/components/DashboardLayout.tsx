import { Sidebar } from "./Sidebar";
import { NotificationBell } from "./NotificationBell";
import { ClusterSelector } from "./ClusterSelector";
import { Footer } from "./Footer";
import { DocsAssistantChat } from "./DocsAssistantChat";
import { TrialBanner } from "./TrialBanner";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Menu, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "./ui/button";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  
  // Hide cluster selector on settings and admin pages
  const hideClusterSelector = ['/settings', '/admin'].includes(location.pathname);

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
        fixed left-0 top-0 bottom-0 z-50 transition-all duration-300 lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
      `}>
        <Sidebar collapsed={sidebarCollapsed} />
      </div>

      {/* Main content */}
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        {/* Trial banner */}
        <TrialBanner />
        
        {/* Top bar with cluster selector and notifications */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex justify-between items-center px-4 sm:px-6 lg:px-8 py-3 gap-2">
            <div className="flex items-center gap-2">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              {/* Desktop collapse button */}
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:flex"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                {sidebarCollapsed ? (
                  <PanelLeft className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" />
                )}
              </Button>
              {!hideClusterSelector && <ClusterSelector />}
            </div>
            <NotificationBell />
          </div>
        </div>
        <div className="flex-1">
          {children}
        </div>
        <Footer />
      </div>
      
      {/* Global Docs Assistant */}
      <DocsAssistantChat />
    </div>
  );
};

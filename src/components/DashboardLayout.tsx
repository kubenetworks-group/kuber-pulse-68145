import { Sidebar } from "./Sidebar";
import { NotificationBell } from "./NotificationBell";
import { ClusterSelector } from "./ClusterSelector";
import { Footer } from "./Footer";
import { DocsAssistantChat } from "./DocsAssistantChat";
import { TrialBanner } from "./TrialBanner";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Menu, PanelLeftClose, PanelLeft, X } from "lucide-react";
import { Button } from "./ui/button";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  // Mobile: closed by default, Desktop: open by default
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  // Ensure sidebar is closed on mobile when component mounts or screen resizes
  useEffect(() => {
    const handleResize = () => {
      // Close mobile sidebar on small screens
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    };

    // Close on mount if mobile
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
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
        fixed left-0 top-0 bottom-0 z-50 transition-all duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
      `}>
        {/* Mobile close button */}
        {sidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 z-50 lg:hidden bg-background/50 hover:bg-background/80"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        )}
        <Sidebar collapsed={sidebarCollapsed} onNavigate={() => setSidebarOpen(false)} />
        
        {/* Desktop collapse button - positioned on the edge */}
        <Button
          variant="outline"
          size="icon"
          className="hidden lg:flex absolute top-1/2 -translate-y-1/2 -right-3 h-6 w-6 rounded-full border-border bg-background shadow-md hover:bg-accent z-50"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Main content */}
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        {/* Trial banner */}
        <TrialBanner />
        
        {/* Top bar with cluster selector and notifications */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex justify-between items-center px-3 sm:px-4 lg:px-8 py-2 sm:py-3 gap-2">
            <div className="flex items-center gap-2">
              {/* Mobile menu button - always visible on small screens */}
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden flex-shrink-0 h-10 w-10 border-border"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              {!hideClusterSelector && <ClusterSelector />}
            </div>
            <NotificationBell />
          </div>
        </div>
        <div className="flex-1 p-3 sm:p-4 lg:p-6">
          {children}
        </div>
        <Footer />
      </div>
      
      {/* Global Docs Assistant */}
      <DocsAssistantChat />
    </div>
  );
};
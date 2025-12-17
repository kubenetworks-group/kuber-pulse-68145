import { Sidebar } from "./Sidebar";
import { NotificationBell } from "./NotificationBell";
import { ClusterSelector } from "./ClusterSelector";
import { Footer } from "./Footer";
import { DocsAssistantChat } from "./DocsAssistantChat";
import { TrialBanner } from "./TrialBanner";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "./ui/button";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  // Mobile: closed by default, Desktop: open by default
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1024);
  const location = useLocation();

  // Ensure sidebar is closed on mobile and collapsed on medium screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
        setSidebarCollapsed(true);
      }
    };

    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Hide cluster selector on settings and admin pages
  const hideClusterSelector = ['/settings', '/admin'].includes(location.pathname);

  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-64';
  const mainMargin = sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64';

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
        fixed left-0 top-0 bottom-0 z-50 transition-all duration-300 ${sidebarWidth}
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
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
        <Sidebar 
          collapsed={sidebarCollapsed} 
          onNavigate={() => setSidebarOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onCollapse={() => setSidebarCollapsed(true)}
        />
      </div>

      {/* Main content */}
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${mainMargin}`}>
        {/* Trial banner */}
        <TrialBanner />
        
        {/* Top bar with cluster selector and notifications */}
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex justify-between items-center px-3 sm:px-4 lg:px-8 py-2 sm:py-3 gap-2">
            <div className="flex items-center gap-2">
              {/* Mobile menu button */}
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

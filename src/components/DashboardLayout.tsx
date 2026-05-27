import { Sidebar } from "./Sidebar";
import { NotificationBell } from "./NotificationBell";
import { ClusterSelector } from "./ClusterSelector";
import { DocsAssistantChat } from "./DocsAssistantChat";
import { TrialBanner } from "./TrialBanner";
import { AgentUpdateButton } from "./AgentUpdateButton";
import { UserProfileDropdown } from "./UserProfileDropdown";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Menu, ChevronLeft } from "lucide-react";
import { Button } from "./ui/button";
import { useAuditLog } from "@/hooks/useAuditLog";

const pageNameMap: Record<string, string> = {
  '/': 'Dashboard',
  '/clusters': 'Clusters',
  '/ai-monitor': 'Monitor IA',
  '/costs': 'Custos',
  '/storage': 'Armazenamento',
  '/agents': 'Agentes',
  '/settings': 'Configurações',
  '/admin': 'Admin',
  '/pricing': 'Preços',
};

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1024);
  const [navScrolled, setNavScrolled] = useState(false);
  const location = useLocation();
  const { logPageAccess } = useAuditLog();
  const lastLoggedPath = useRef<string | null>(null);

  // Spotlight cursor effect
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
    const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
    el.style.setProperty('--mx', `${x}%`);
    el.style.setProperty('--my', `${y}%`);
  }, []);

  // Frosted nav scroll state
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Log page access when route changes
  useEffect(() => {
    const pageName = pageNameMap[location.pathname];
    if (pageName && lastLoggedPath.current !== location.pathname) {
      lastLoggedPath.current = location.pathname;
      logPageAccess(location.pathname, pageName);
    }
  }, [location.pathname, logPageAccess]);

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

  // Desktop: collapsed = icon-only (w-16), expanded = full (w-64)
  // Mobile: sidebar always overlays as full-width (w-64); desktop width follows collapsed state
  const desktopSidebarWidth = sidebarCollapsed ? 'lg:w-16' : 'lg:w-64';
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
        fixed left-0 top-0 bottom-0 z-50 transition-all duration-300
        w-64 ${desktopSidebarWidth}
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar
          collapsed={sidebarOpen ? false : sidebarCollapsed}
          onNavigate={() => setSidebarOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onCollapse={() => setSidebarCollapsed(true)}
        />
        <button
          className="lg:hidden absolute top-1/2 -translate-y-1/2 -right-8 z-50 flex items-center justify-center w-8 h-14 rounded-r-xl shadow-lg transition-all duration-200 active:scale-95"
          style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderLeft: "none" }}
          onClick={() => setSidebarOpen(false)}
          aria-label="Fechar menu"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Main content */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ${mainMargin}`}
        onMouseMove={handleMouseMove}
        style={{ position: 'relative' }}
      >
        {/* Spotlight radial */}
        <div className="kdo-spot pointer-events-none" aria-hidden="true" />

        <TrialBanner />

        {/* Top bar — frosted nav */}
        <div className={`sticky top-0 z-30 kdo-nav-frosted${navScrolled ? ' scrolled' : ''}`}>
          <div className="flex items-center px-3 sm:px-4 lg:px-8 py-2 sm:py-3 gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden flex-shrink-0 h-9 w-9 border-border"
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
              {!hideClusterSelector && <ClusterSelector />}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <AgentUpdateButton />
              <NotificationBell />
              <UserProfileDropdown />
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 p-3 sm:p-4 lg:p-6 rise">
          {children}
        </div>
      </div>

      <DocsAssistantChat />
    </div>
  );
};

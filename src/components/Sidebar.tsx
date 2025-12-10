import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTranslation } from "react-i18next";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import kodoLogo from "@/assets/kodo-logo.png";
import {
  Server,
  Settings,
  LogOut,
  LayoutDashboard,
  Bot,
  HardDrive,
  
  Crown,
  Shield,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  collapsed?: boolean;
}

export const Sidebar = ({ collapsed = false }: SidebarProps) => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const { isAdmin } = useAdminCheck();

  const navigation = [
    { name: t('common.dashboard'), href: "/", icon: LayoutDashboard },
    { name: t('common.storage'), href: "/storage", icon: HardDrive },
    { name: t('common.aiMonitor'), href: "/ai-monitor", icon: Bot },
    { name: t('common.clusters'), href: "/clusters", icon: Server },
    { name: t('common.agents'), href: "/agents", icon: Bot },
    
    { name: "Planos", href: "/pricing", icon: Crown },
    { name: t('common.settings'), href: "/settings", icon: Settings },
    ...(isAdmin ? [{ name: "Admin", href: "/admin", icon: Shield }] : []),
  ];

  return (
    <div className={`fixed left-0 top-0 bottom-0 bg-card/80 backdrop-blur-xl border-r border-border flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className={`border-b border-border ${collapsed ? 'p-3' : 'p-6'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <img 
            src={kodoLogo} 
            alt="Kodo Logo" 
            className={`object-contain ${collapsed ? 'w-10 h-10' : 'w-12 h-12'}`}
          />
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Kodo
              </h1>
              <p className="text-xs text-muted-foreground">AI-Powered Platform</p>
            </div>
          )}
        </div>
      </div>

      <nav className={`flex-1 space-y-1 ${collapsed ? 'p-2' : 'p-4'}`}>
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          
          const button = (
            <Button
              variant={isActive ? "secondary" : "ghost"}
              className={`w-full transition-all ${
                collapsed ? 'justify-center px-2' : 'justify-start gap-3'
              } ${isActive ? "shadow-sm" : "hover:translate-x-1"}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && item.name}
            </Button>
          );

          return (
            <Link key={item.name} to={item.href}>
              {collapsed ? (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    {button}
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              ) : (
                button
              )}
            </Link>
          );
        })}
      </nav>

      <div className={`border-t border-border space-y-2 ${collapsed ? 'p-2' : 'p-4'}`}>
        {!collapsed && (
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs text-muted-foreground">{t('settings.theme')}</span>
            <ThemeToggle />
          </div>
        )}
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="flex justify-center mb-2">
                <ThemeToggle />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t('settings.theme')}
            </TooltipContent>
          </Tooltip>
        ) : null}
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-center px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={signOut}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t('common.signOut')}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={signOut}
          >
            <LogOut className="w-4 h-4" />
            {t('common.signOut')}
          </Button>
        )}
      </div>
    </div>
  );
};

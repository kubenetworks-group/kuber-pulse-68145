import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTranslation } from "react-i18next";
import kodoLogo from "@/assets/kodo-logo.png";
import {
  Server,
  DollarSign,
  Settings,
  LogOut,
  LayoutDashboard,
  Bot,
  HardDrive,
  BookOpen,
} from "lucide-react";

export const Sidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { t } = useTranslation();

  const navigation = [
    { name: t('common.dashboard'), href: "/", icon: LayoutDashboard },
    { name: t('common.costs'), href: "/costs", icon: DollarSign },
    { name: t('common.storage'), href: "/storage", icon: HardDrive },
    { name: t('common.aiMonitor'), href: "/ai-monitor", icon: Bot },
    { name: t('common.clusters'), href: "/clusters", icon: Server },
    { name: t('common.agents'), href: "/agents", icon: Bot },
    { name: "Documentação", href: "/documentation", icon: BookOpen },
    { name: t('common.settings'), href: "/settings", icon: Settings },
  ];

  return (
    <div className="fixed left-0 top-0 bottom-0 w-64 bg-card/80 backdrop-blur-xl border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <img 
            src={kodoLogo} 
            alt="Kodo Logo" 
            className="w-12 h-12 object-contain"
          />
          <div>
            <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Kodo
            </h1>
            <p className="text-xs text-muted-foreground">AI-Powered Platform</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link key={item.name} to={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={`w-full justify-start gap-3 transition-all ${
                  isActive ? "shadow-sm" : "hover:translate-x-1"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </Button>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border space-y-2">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-xs text-muted-foreground">{t('settings.theme')}</span>
          <ThemeToggle />
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4" />
          {t('common.signOut')}
        </Button>
      </div>
    </div>
  );
};

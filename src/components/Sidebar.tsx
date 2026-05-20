import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTranslation } from "react-i18next";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useSubscription } from "@/contexts/SubscriptionContext";
import kodoLogo from "@/assets/kodo-logo.png";
import {
  Server,
  Settings,
  LogOut,
  LayoutDashboard,
  Bot,
  Shield,
  PanelLeft,
  PanelLeftClose,
  Sparkles,
  AlertTriangle,
  Archive,
  Code2,
  Layers,
  Box,
  Network,
  Globe2,
  ChevronDown,
  Database,
  Briefcase,
  Clock,
  ShieldCheck,
  HardDrive,
  Disc,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  onCollapse?: () => void;
}

const K8S_WORKLOADS = [
  { name: "Pods",          href: "/kubernetes/pods",             icon: Box },
  { name: "Deployments",   href: "/kubernetes/deployments",      icon: Layers },
  { name: "Daemon Sets",   href: "/kubernetes/daemonsets",       icon: Server },
  { name: "Stateful Sets", href: "/kubernetes/statefulsets",     icon: Database },
  { name: "Jobs",          href: "/kubernetes/jobs",             icon: Briefcase },
  { name: "Cron Jobs",     href: "/kubernetes/cronjobs",         icon: Clock },
];

const K8S_NETWORK = [
  { name: "Services",          href: "/kubernetes/services",         icon: Network },
  { name: "Ingresses",         href: "/kubernetes/ingress",          icon: Globe2 },
  { name: "Network Policies",  href: "/kubernetes/networkpolicies",  icon: ShieldCheck },
];

const K8S_STORAGE = [
  { name: "PV Claims",  href: "/kubernetes/pvcs",    icon: HardDrive },
  { name: "Volumes",    href: "/kubernetes/volumes",  icon: Disc },
];

interface K8sGroupProps {
  label: string;
  items: { name: string; href: string; icon: React.ElementType }[];
  collapsed: boolean;
  onNavigate?: () => void;
  onCollapse?: () => void;
}

const K8sSubGroup = ({ label, items, collapsed, onNavigate, onCollapse }: K8sGroupProps) => {
  const location = useLocation();
  const isGroupActive = items.some((i) => location.pathname === i.href);
  const [open, setOpen] = useState(isGroupActive);

  if (collapsed) return null;

  const handleClick = () => {
    onNavigate?.();
    if (window.innerWidth >= 1024) onCollapse?.();
  };

  return (
    <div className="space-y-0.5">
      <Button
        variant="ghost"
        className="w-full justify-start gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground h-7 px-2 hover:bg-transparent hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        {label}
      </Button>
      {open && (
        <div className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link key={item.href} to={item.href} onClick={handleClick}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={`w-full justify-start gap-3 transition-all text-sm pl-5 ${isActive ? "shadow-sm" : "hover:translate-x-1"}`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const Sidebar = ({ collapsed = false, onNavigate, onToggleCollapse, onCollapse }: SidebarProps) => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const { isAdmin } = useAdminCheck();
  const { currentPlan, isTrialActive } = useSubscription();

  const isKubernetesActive = location.pathname.startsWith("/kubernetes");
  const [k8sOpen, setK8sOpen] = useState(isKubernetesActive);

  const isPro = currentPlan === 'pro' && !isTrialActive;

  const navigationBefore = [
    { name: t('common.dashboard'), href: "/dashboard", icon: LayoutDashboard },
    { name: "Painel de Risco",     href: "/risk",       icon: AlertTriangle },
  ];

  const navigationAfter = [
    { name: t('common.aiMonitor'), href: "/ai-monitor", icon: Bot },
    ...(isPro ? [{ name: "FinOps", href: "/ai-savings", icon: Sparkles }] : []),
    { name: "Plataforma Dev",      href: "/developer",  icon: Code2 },
    { name: t('common.clusters'),  href: "/clusters",   icon: Server },
    { name: t('common.agents'),    href: "/agents",     icon: Bot },
    { name: "Backup & Migração",   href: "/migration",  icon: Archive },
    { name: t('common.settings'),  href: "/settings",   icon: Settings },
    ...(isAdmin ? [{ name: "Admin", href: "/admin",     icon: Shield }] : []),
  ];

  const handleClick = () => {
    onNavigate?.();
    if (window.innerWidth >= 1024 && !collapsed) onCollapse?.();
  };

  const renderNavItem = (item: { name: string; href: string; icon: React.ElementType }) => {
    const isActive = location.pathname === item.href;
    const Icon = item.icon;
    return (
      <div key={item.href}>
        <Link to={item.href} onClick={handleClick}>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="w-full justify-center px-2 transition-all"
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{item.name}</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant={isActive ? "secondary" : "ghost"}
              className={`w-full justify-start gap-3 transition-all ${isActive ? "shadow-sm" : "hover:translate-x-1"}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.name}
            </Button>
          )}
        </Link>
      </div>
    );
  };

  return (
    <div className={`h-full bg-card/80 backdrop-blur-xl border-r border-border flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
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

      <nav className={`flex-1 space-y-1 overflow-y-auto ${collapsed ? 'p-2' : 'p-4'}`}>
        {navigationBefore.map(renderNavItem)}

        {/* Kubernetes group */}
        {collapsed ? (
          <Tooltip key="k8s-group" delayDuration={0}>
            <TooltipTrigger asChild>
              <Link to="/kubernetes/pods" onClick={handleClick}>
                <Button
                  variant={isKubernetesActive ? "secondary" : "ghost"}
                  className="w-full justify-center px-2 transition-all"
                >
                  <Layers className="w-4 h-4 flex-shrink-0" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Kubernetes</TooltipContent>
          </Tooltip>
        ) : (
          <div className="space-y-0.5">
            <Button
              variant={isKubernetesActive ? "secondary" : "ghost"}
              className="w-full justify-start gap-3 transition-all"
              onClick={() => setK8sOpen((v) => !v)}
            >
              <Layers className="w-4 h-4 flex-shrink-0" />
              Kubernetes
              <ChevronDown className={`ml-auto w-3 h-3 transition-transform duration-200 ${k8sOpen ? "rotate-180" : ""}`} />
            </Button>
            {k8sOpen && (
              <div className="ml-3 pl-3 border-l border-border/50 space-y-2 py-1">
                <K8sSubGroup label="Workloads" items={K8S_WORKLOADS} collapsed={collapsed} onNavigate={onNavigate} onCollapse={onCollapse} />
                <K8sSubGroup label="Network"   items={K8S_NETWORK}   collapsed={collapsed} onNavigate={onNavigate} onCollapse={onCollapse} />
                <K8sSubGroup label="Storage"   items={K8S_STORAGE}   collapsed={collapsed} onNavigate={onNavigate} onCollapse={onCollapse} />
              </div>
            )}
          </div>
        )}

        {navigationAfter.map(renderNavItem)}
      </nav>

      <div className={`border-t border-border space-y-2 ${collapsed ? 'p-2' : 'p-4'}`}>
        {onToggleCollapse && (
          <div className="hidden lg:block">
            {collapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-center px-2"
                    onClick={onToggleCollapse}
                  >
                    <PanelLeft className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Expandir menu</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3"
                onClick={onToggleCollapse}
              >
                <PanelLeftClose className="w-4 h-4" />
                Recolher menu
              </Button>
            )}
          </div>
        )}

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
            <TooltipContent side="right">{t('settings.theme')}</TooltipContent>
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
            <TooltipContent side="right">{t('common.signOut')}</TooltipContent>
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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X } from "lucide-react";
import { SecurityThreat } from "@/hooks/useSecurityThreats";

export interface RiskFilters {
  severity: string;
  status: string;
  namespace: string;
  period: string;
}

interface RiskPanelFiltersProps {
  filters: RiskFilters;
  onFiltersChange: (filters: RiskFilters) => void;
  namespaces: string[];
  showStatusFilter?: boolean;
}

const SEVERITY_OPTIONS = [
  { value: "all", label: "Todas Severidades" },
  { value: "critical", label: "Crítico" },
  { value: "high", label: "Alto" },
  { value: "medium", label: "Médio" },
  { value: "low", label: "Baixo" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Todos Status" },
  { value: "active", label: "Ativo" },
  { value: "investigating", label: "Investigando" },
  { value: "resolved", label: "Resolvido" },
  { value: "false_positive", label: "Falso Positivo" },
];

const PERIOD_OPTIONS = [
  { value: "all", label: "Todo Período" },
  { value: "24h", label: "Últimas 24h" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
];

export const RiskPanelFilters = ({
  filters,
  onFiltersChange,
  namespaces,
  showStatusFilter = true,
}: RiskPanelFiltersProps) => {
  const updateFilter = (key: keyof RiskFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      severity: "all",
      status: "all",
      namespace: "all",
      period: "all",
    });
  };

  const activeFiltersCount = Object.values(filters).filter(
    (v) => v !== "all"
  ).length;

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-card/50 rounded-lg border border-border/50">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Filtros</span>
        {activeFiltersCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {activeFiltersCount}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 flex-1">
        {/* Severity Filter */}
        <Select
          value={filters.severity}
          onValueChange={(value) => updateFilter("severity", value)}
        >
          <SelectTrigger className="w-[160px] h-9 bg-background">
            <SelectValue placeholder="Severidade" />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border z-50">
            {SEVERITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  {option.value !== "all" && (
                    <div
                      className={`w-2 h-2 rounded-full ${
                        option.value === "critical"
                          ? "bg-red-500"
                          : option.value === "high"
                          ? "bg-orange-500"
                          : option.value === "medium"
                          ? "bg-yellow-500"
                          : "bg-blue-500"
                      }`}
                    />
                  )}
                  {option.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        {showStatusFilter && (
          <Select
            value={filters.status}
            onValueChange={(value) => updateFilter("status", value)}
          >
            <SelectTrigger className="w-[160px] h-9 bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border z-50">
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Namespace Filter */}
        <Select
          value={filters.namespace}
          onValueChange={(value) => updateFilter("namespace", value)}
        >
          <SelectTrigger className="w-[160px] h-9 bg-background">
            <SelectValue placeholder="Namespace" />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border z-50">
            <SelectItem value="all">Todos Namespaces</SelectItem>
            {namespaces.map((ns) => (
              <SelectItem key={ns} value={ns}>
                {ns}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Period Filter */}
        <Select
          value={filters.period}
          onValueChange={(value) => updateFilter("period", value)}
        >
          <SelectTrigger className="w-[160px] h-9 bg-background">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border z-50">
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear Filters */}
      {activeFiltersCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-9 px-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
};

// Helper function to filter threats based on filters
export const filterThreats = (
  items: SecurityThreat[],
  filters: RiskFilters
): SecurityThreat[] => {
  return items.filter((item) => {
    // Severity filter
    if (filters.severity !== "all" && item.severity !== filters.severity) {
      return false;
    }

    // Status filter
    if (filters.status !== "all" && item.status !== filters.status) {
      return false;
    }

    // Namespace filter
    if (filters.namespace !== "all") {
      // Check affected_resources array
      const resources = item.affected_resources;
      let hasNamespace = false;
      
      if (Array.isArray(resources)) {
        hasNamespace = resources.some((r: any) => 
          r.namespace === filters.namespace || 
          (r.namespaces && r.namespaces.includes(filters.namespace))
        );
      }
      
      // Also check legacy namespace field
      if (!hasNamespace && item.namespace === filters.namespace) {
        hasNamespace = true;
      }
      
      if (!hasNamespace) {
        return false;
      }
    }

    // Period filter
    if (filters.period !== "all") {
      const createdAt = new Date(item.created_at);
      const now = new Date();
      const diffMs = now.getTime() - createdAt.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffDays = diffHours / 24;

      if (filters.period === "24h" && diffHours > 24) return false;
      if (filters.period === "7d" && diffDays > 7) return false;
      if (filters.period === "30d" && diffDays > 30) return false;
    }

    return true;
  });
};

// Extract unique namespaces from threats
export const extractNamespaces = (items: SecurityThreat[]): string[] => {
  const namespaceSet = new Set<string>();
  
  items.forEach((item) => {
    // Check affected_resources array
    const resources = item.affected_resources;
    if (Array.isArray(resources)) {
      resources.forEach((r: any) => {
        if (r.namespace) {
          namespaceSet.add(r.namespace);
        }
        if (r.namespaces && Array.isArray(r.namespaces)) {
          r.namespaces.forEach((ns: string) => namespaceSet.add(ns));
        }
      });
    }
    
    // Also check legacy namespace field
    if (item.namespace) {
      namespaceSet.add(item.namespace);
    }
  });

  return Array.from(namespaceSet).sort();
};

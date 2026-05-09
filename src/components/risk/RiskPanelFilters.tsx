import { useState, useRef, useEffect } from "react";
import { Filter, X, ChevronDown, Check } from "lucide-react";
import { SecurityThreat } from "@/hooks/useSecurityThreats";
import { cn } from "@/lib/utils";

// ─── Status colors only ───────────────────────────────────────────────────────

const SEVERITY_DOTS: Record<string, string> = {
  critical: "#FF2D2D",
  high:     "#FF7A00",
  medium:   "#F5C518",
  low:      "#00E5A0",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiskFilters {
  severity:  string;
  status:    string;
  namespace: string;
  period:    string;
}

interface RiskPanelFiltersProps {
  filters:          RiskFilters;
  onFiltersChange:  (filters: RiskFilters) => void;
  namespaces:       string[];
  showStatusFilter?: boolean;
}

// ─── Option sets ──────────────────────────────────────────────────────────────

const SEVERITY_OPTIONS = [
  { value: "all",      label: "Todas severidades", dot: null },
  { value: "critical", label: "Crítico",            dot: "critical" },
  { value: "high",     label: "Alto",               dot: "high" },
  { value: "medium",   label: "Médio",              dot: "medium" },
  { value: "low",      label: "Baixo",              dot: "low" },
];

const STATUS_OPTIONS = [
  { value: "all",            label: "Todos status"   },
  { value: "active",         label: "Ativo"          },
  { value: "investigating",  label: "Investigando"   },
  { value: "resolved",       label: "Resolvido"      },
  { value: "false_positive", label: "Falso positivo" },
];

const PERIOD_OPTIONS = [
  { value: "all", label: "Todo período"    },
  { value: "24h", label: "Últimas 24h"    },
  { value: "7d",  label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias"},
];

// ─── Custom compact select ────────────────────────────────────────────────────

interface SelectOption { value: string; label: string; dot?: string | null }

function CompactSelect({ value, options, placeholder, onChange }: {
  value:       string;
  options:     SelectOption[];
  placeholder: string;
  onChange:    (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);
  const isActive = value !== "all";
  const dotColor = selected?.dot ? SEVERITY_DOTS[selected.dot] : null;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative select-none">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs",
          "border transition-all duration-150 cursor-pointer outline-none",
          isActive
            ? "border-primary/40 bg-primary/5 text-foreground"
            : "border-border bg-muted text-muted-foreground hover:border-border/80 hover:text-foreground"
        )}
      >
        {dotColor && (
          <span className="rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: dotColor }} />
        )}
        <span>{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("w-3 h-3 ml-0.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className={cn(
          "absolute z-50 mt-1 min-w-full bg-popover border border-border rounded-lg overflow-hidden",
          "shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        )}>
          {options.map(opt => (
            <DropdownItem
              key={opt.value}
              option={opt}
              selected={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DropdownItem({ option, selected, onClick }: {
  option: SelectOption; selected: boolean; onClick: () => void;
}) {
  const dotColor = option.dot ? SEVERITY_DOTS[option.dot] : null;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left",
        "transition-colors duration-100 cursor-pointer outline-none border-none",
        selected ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {option.dot !== undefined && (
        <span className="w-3.5 flex items-center justify-center flex-shrink-0">
          {dotColor && <span className="rounded-full" style={{ width: 6, height: 6, background: dotColor }} />}
        </span>
      )}
      <span className="flex-1">{option.label}</span>
      {selected && <Check className="w-2.5 h-2.5 flex-shrink-0" style={{ color: "#00E5A0" }} />}
    </button>
  );
}

// ─── RiskPanelFilters ─────────────────────────────────────────────────────────

export const RiskPanelFilters = ({
  filters, onFiltersChange, namespaces, showStatusFilter = true,
}: RiskPanelFiltersProps) => {
  const update  = (key: keyof RiskFilters, v: string) => onFiltersChange({ ...filters, [key]: v });
  const clear   = () => onFiltersChange({ severity: "all", status: "all", namespace: "all", period: "all" });
  const active  = Object.values(filters).filter(v => v !== "all").length;

  const nsOptions: SelectOption[] = [
    { value: "all", label: "Todos namespaces" },
    ...namespaces.map(ns => ({ value: ns, label: ns })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border">
      {/* Label */}
      <div className="flex items-center gap-1.5 mr-1 text-muted-foreground">
        <Filter className="w-3.5 h-3.5" />
        <span className="text-xs">Filtros</span>
        {active > 0 && (
          <span
            className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold"
            style={{ background: "rgba(0,229,160,0.12)", color: "#00E5A0", border: "1px solid rgba(0,229,160,0.25)" }}
          >
            {active}
          </span>
        )}
      </div>

      <CompactSelect value={filters.severity} options={SEVERITY_OPTIONS} placeholder="Severidade" onChange={v => update("severity", v)} />
      {showStatusFilter && (
        <CompactSelect value={filters.status}   options={STATUS_OPTIONS}   placeholder="Status"     onChange={v => update("status",   v)} />
      )}
      <CompactSelect value={filters.namespace} options={nsOptions}         placeholder="Namespace"  onChange={v => update("namespace",v)} />
      <CompactSelect value={filters.period}    options={PERIOD_OPTIONS}    placeholder="Período"    onChange={v => update("period",   v)} />

      {active > 0 && (
        <button
          onClick={clear}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer outline-none transition-colors px-1"
        >
          <X className="w-3 h-3" />Limpar
        </button>
      )}
    </div>
  );
};

// ─── Filter + namespace helpers ───────────────────────────────────────────────

export const filterThreats = (items: SecurityThreat[], filters: RiskFilters): SecurityThreat[] =>
  items.filter(item => {
    if (filters.severity  !== "all" && item.severity !== filters.severity) return false;
    if (filters.status    !== "all" && item.status   !== filters.status)   return false;

    if (filters.namespace !== "all") {
      const res = item.affected_resources;
      let has = Array.isArray(res) && res.some((r: any) =>
        r.namespace === filters.namespace ||
        (r.namespaces && r.namespaces.includes(filters.namespace))
      );
      if (!has && item.namespace === filters.namespace) has = true;
      if (!has) return false;
    }

    if (filters.period !== "all") {
      const h = (Date.now() - new Date(item.created_at).getTime()) / 3_600_000;
      if (filters.period === "24h" && h > 24)      return false;
      if (filters.period === "7d"  && h > 24 * 7)  return false;
      if (filters.period === "30d" && h > 24 * 30) return false;
    }

    return true;
  });

export const extractNamespaces = (items: SecurityThreat[]): string[] => {
  const set = new Set<string>();
  items.forEach(item => {
    const res = item.affected_resources;
    if (Array.isArray(res)) {
      res.forEach((r: any) => {
        if (r.namespace)  set.add(r.namespace);
        if (r.namespaces) r.namespaces.forEach((ns: string) => set.add(ns));
      });
    }
    if (item.namespace) set.add(item.namespace);
  });
  return Array.from(set).sort();
};

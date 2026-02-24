import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, Plus, Trash2, Edit, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  metric_type: string;
  condition: string;
  threshold: number;
  severity: string;
  target_type: string;
  target_namespace: string | null;
  target_name: string | null;
  enabled: boolean;
  cooldown_minutes: number;
}

const METRIC_TYPES = [
  { value: "cpu_usage", label: "CPU Usage (%)" },
  { value: "memory_usage", label: "Memory Usage (%)" },
  { value: "pod_restarts", label: "Pod Restarts" },
  { value: "pod_status_failed", label: "Pod Failed" },
  { value: "pod_crashloop", label: "CrashLoopBackOff" },
  { value: "disk_usage", label: "Disk Usage (%)" },
  { value: "oom_killed", label: "OOMKilled" },
  { value: "node_not_ready", label: "Node Not Ready" },
];

const CONDITIONS = [
  { value: "greater_than", label: ">" },
  { value: "less_than", label: "<" },
  { value: "equals", label: "=" },
  { value: "not_equals", label: "≠" },
];

const SEVERITIES = [
  { value: "info", label: "Info", color: "bg-blue-500/10 text-blue-500" },
  { value: "warning", label: "Warning", color: "bg-yellow-500/10 text-yellow-500" },
  { value: "high", label: "High", color: "bg-orange-500/10 text-orange-500" },
  { value: "critical", label: "Critical", color: "bg-red-500/10 text-red-500" },
];

export const AlertRulesManager = () => {
  const { selectedClusterId } = useCluster();
  const { user } = useAuth();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    metric_type: "cpu_usage",
    condition: "greater_than",
    threshold: 80,
    severity: "warning",
    target_type: "cluster",
    target_namespace: "",
    target_name: "",
    cooldown_minutes: 15,
  });

  const fetchRules = async () => {
    if (!selectedClusterId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("alert_rules")
      .select("*")
      .eq("cluster_id", selectedClusterId)
      .order("created_at", { ascending: false });
    if (!error && data) setRules(data);
    setLoading(false);
  };

  useEffect(() => { fetchRules(); }, [selectedClusterId]);

  const handleSave = async () => {
    if (!selectedClusterId || !user) return;
    const payload = {
      cluster_id: selectedClusterId,
      user_id: user.id,
      name: form.name,
      description: form.description || null,
      metric_type: form.metric_type,
      condition: form.condition,
      threshold: form.threshold,
      severity: form.severity,
      target_type: form.target_type,
      target_namespace: form.target_namespace || null,
      target_name: form.target_name || null,
      cooldown_minutes: form.cooldown_minutes,
    };

    if (editingRule) {
      const { error } = await supabase.from("alert_rules").update(payload).eq("id", editingRule.id);
      if (error) { toast.error("Erro ao atualizar regra"); return; }
      toast.success("Regra atualizada");
    } else {
      const { error } = await supabase.from("alert_rules").insert(payload);
      if (error) { toast.error("Erro ao criar regra"); return; }
      toast.success("Regra criada");
    }
    setDialogOpen(false);
    setEditingRule(null);
    resetForm();
    fetchRules();
  };

  const resetForm = () => setForm({
    name: "", description: "", metric_type: "cpu_usage", condition: "greater_than",
    threshold: 80, severity: "warning", target_type: "cluster",
    target_namespace: "", target_name: "", cooldown_minutes: 15,
  });

  const handleEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      description: rule.description || "",
      metric_type: rule.metric_type,
      condition: rule.condition,
      threshold: rule.threshold,
      severity: rule.severity,
      target_type: rule.target_type,
      target_namespace: rule.target_namespace || "",
      target_name: rule.target_name || "",
      cooldown_minutes: rule.cooldown_minutes,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("alert_rules").delete().eq("id", id);
    if (error) { toast.error("Erro ao deletar"); return; }
    toast.success("Regra removida");
    fetchRules();
  };

  const toggleEnabled = async (id: string, enabled: boolean) => {
    await supabase.from("alert_rules").update({ enabled }).eq("id", id);
    fetchRules();
  };

  const severityBadge = (sev: string) => {
    const s = SEVERITIES.find(s => s.value === sev);
    return <Badge className={`${s?.color || ""} border-0 text-xs`}>{s?.label || sev}</Badge>;
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-orange-400" />
            Regras de Alerta
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingRule(null); resetForm(); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Nova Regra
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingRule ? "Editar Regra" : "Nova Regra de Alerta"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: CPU alta no namespace prod" />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição opcional" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Métrica</Label>
                    <Select value={form.metric_type} onValueChange={(v) => setForm(f => ({ ...f, metric_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {METRIC_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Condição</Label>
                    <Select value={form.condition} onValueChange={(v) => setForm(f => ({ ...f, condition: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Threshold</Label>
                    <Input type="number" value={form.threshold} onChange={(e) => setForm(f => ({ ...f, threshold: Number(e.target.value) }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Severidade</Label>
                    <Select value={form.severity} onValueChange={(v) => setForm(f => ({ ...f, severity: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Cooldown (min)</Label>
                    <Input type="number" value={form.cooldown_minutes} onChange={(e) => setForm(f => ({ ...f, cooldown_minutes: Number(e.target.value) }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Namespace (opcional)</Label>
                    <Input value={form.target_namespace} onChange={(e) => setForm(f => ({ ...f, target_namespace: e.target.value }))} placeholder="Todos" />
                  </div>
                  <div>
                    <Label>Pod/Resource (opcional)</Label>
                    <Input value={form.target_name} onChange={(e) => setForm(f => ({ ...f, target_name: e.target.value }))} placeholder="Todos" />
                  </div>
                </div>
                <Button onClick={handleSave} className="w-full" disabled={!form.name}>
                  {editingRule ? "Atualizar" : "Criar Regra"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-32 flex items-center justify-center">
            <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : rules.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
            <AlertTriangle className="w-8 h-8 opacity-40" />
            <p>Nenhuma regra de alerta configurada</p>
            <p className="text-xs">Crie regras para monitorar métricas do cluster</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Switch checked={rule.enabled} onCheckedChange={(v) => toggleEnabled(rule.id, v)} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${!rule.enabled ? "text-muted-foreground line-through" : ""}`}>
                        {rule.name}
                      </span>
                      {severityBadge(rule.severity)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {METRIC_TYPES.find(m => m.value === rule.metric_type)?.label}
                      {" "}{CONDITIONS.find(c => c.value === rule.condition)?.label}
                      {" "}{rule.threshold}
                      {rule.target_namespace && ` • ns: ${rule.target_namespace}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(rule)}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(rule.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Webhook, Plus, Trash2, ExternalLink, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  webhook_type: string;
  enabled: boolean;
  severity_filter: string[];
  last_triggered_at: string | null;
  last_error: string | null;
}

const WEBHOOK_TYPES = [
  { value: "generic", label: "Generic (JSON)" },
  { value: "slack", label: "Slack" },
  { value: "discord", label: "Discord" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "pagerduty", label: "PagerDuty" },
];

export const WebhookConfigManager = () => {
  const { selectedClusterId } = useCluster();
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", webhook_type: "generic" });

  const fetchWebhooks = async () => {
    if (!selectedClusterId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("webhook_configs")
      .select("*")
      .eq("cluster_id", selectedClusterId)
      .order("created_at", { ascending: false });
    if (!error && data) setWebhooks(data);
    setLoading(false);
  };

  useEffect(() => { fetchWebhooks(); }, [selectedClusterId]);

  const handleCreate = async () => {
    if (!selectedClusterId || !user || !form.name || !form.url) return;
    const { error } = await supabase.from("webhook_configs").insert({
      cluster_id: selectedClusterId,
      user_id: user.id,
      name: form.name,
      url: form.url,
      webhook_type: form.webhook_type,
    });
    if (error) { toast.error("Erro ao criar webhook"); return; }
    toast.success("Webhook configurado");
    setDialogOpen(false);
    setForm({ name: "", url: "", webhook_type: "generic" });
    fetchWebhooks();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("webhook_configs").delete().eq("id", id);
    toast.success("Webhook removido");
    fetchWebhooks();
  };

  const toggleEnabled = async (id: string, enabled: boolean) => {
    await supabase.from("webhook_configs").update({ enabled }).eq("id", id);
    fetchWebhooks();
  };

  const testWebhook = async (webhook: WebhookConfig) => {
    toast.info("Enviando teste...");
    try {
      const { error } = await supabase.functions.invoke("send-alert-webhook", {
        body: {
          webhook_id: webhook.id,
          test: true,
          alert: {
            title: "Alerta de Teste - Kodo",
            message: "Este é um alerta de teste do Kodo Alert Manager",
            severity: "info",
            source: "test",
          },
        },
      });
      if (error) throw error;
      toast.success("Teste enviado com sucesso!");
    } catch {
      toast.error("Falha ao enviar teste");
    }
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Webhook className="w-4 h-4 text-purple-400" />
            Webhooks
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Webhook</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Slack #alertas" />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.webhook_type} onValueChange={(v) => setForm(f => ({ ...f, webhook_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WEBHOOK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>URL do Webhook</Label>
                  <Input value={form.url} onChange={(e) => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://hooks.slack.com/..." />
                </div>
                <Button onClick={handleCreate} className="w-full" disabled={!form.name || !form.url}>
                  Criar Webhook
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-24 flex items-center justify-center">
            <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : webhooks.length === 0 ? (
          <div className="h-24 flex flex-col items-center justify-center text-muted-foreground text-sm gap-1">
            <Webhook className="w-6 h-6 opacity-40" />
            <p>Nenhum webhook configurado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {webhooks.map((wh) => (
              <div key={wh.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Switch checked={wh.enabled} onCheckedChange={(v) => toggleEnabled(wh.id, v)} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{wh.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {WEBHOOK_TYPES.find(t => t.value === wh.webhook_type)?.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{wh.url}</p>
                    {wh.last_error && (
                      <p className="text-[10px] text-red-400 flex items-center gap-1 mt-0.5">
                        <AlertCircle className="w-3 h-3" /> {wh.last_error}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => testWebhook(wh)} title="Testar">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(wh.id)}>
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

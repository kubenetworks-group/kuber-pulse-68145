import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Eye, Code2, Settings2, Copy, Download, CheckCircle2,
  Loader2, AlertTriangle, KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AccessRole = "viewer" | "developer" | "operator";

const ROLES: { value: AccessRole; icon: React.ElementType; label: string; color: string; bg: string; description: string }[] = [
  {
    value: "viewer",
    icon: Eye,
    label: "Somente Leitura",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    description: "Visualiza pods, logs, deployments e serviços. Sem escrita.",
  },
  {
    value: "developer",
    icon: Code2,
    label: "Desenvolvedor",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    description: "Leitura + exec em containers + create/update/delete de workloads.",
  },
  {
    value: "operator",
    icon: Settings2,
    label: "Operador",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    description: "Acesso completo ao cluster (exceto nodes e configuração do cluster).",
  },
];

const EXPIRY_OPTIONS = [
  { value: "none", label: "Sem expiração" },
  { value: "7",   label: "7 dias" },
  { value: "30",  label: "30 dias" },
  { value: "90",  label: "90 dias" },
];

function expiryToDate(days: string): string | null {
  if (!days || days === "none") return null;
  const d = new Date();
  d.setDate(d.getDate() + parseInt(days));
  return d.toISOString();
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  namespaces?: string[];
}

export function CreateAccessDrawer({ open, onClose, onCreated, namespaces = [] }: Props) {
  const { selectedClusterId } = useCluster();

  const [step, setStep] = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [generatedScript, setGeneratedScript] = useState("");
  const [copied, setCopied] = useState(false);

  const [name, setName]     = useState("");
  const [email, setEmail]   = useState("");
  const [role, setRole]     = useState<AccessRole>("viewer");
  const [ns, setNs]         = useState("__all__");
  const [expiry, setExpiry] = useState("none");
  const [notes, setNotes]   = useState("");

  function resetForm() {
    setStep("form");
    setGeneratedScript("");
    setCopied(false);
    setName(""); setEmail(""); setRole("viewer");
    setNs("__all__"); setExpiry("none"); setNotes("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    if (!selectedClusterId) {
      toast({ title: "Nenhum cluster selecionado", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await supabase.functions.invoke("create-cluster-access", {
        body: {
          cluster_id: selectedClusterId,
          grantee_name: name.trim(),
          grantee_email: email.trim() || null,
          access_role: role,
          namespace: ns === "__all__" ? null : ns,
          notes: notes.trim() || null,
          expires_at: expiryToDate(expiry),
        },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      setGeneratedScript(res.data.setup_script);
      setStep("success");
      onCreated();
    } catch (err) {
      toast({ title: "Erro ao criar acesso", description: err instanceof Error ? err.message : "Erro desconhecido", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(generatedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copiado para a área de transferência" });
  }

  function handleDownload() {
    const blob = new Blob([generatedScript], { type: "text/x-sh" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kodo-${name.toLowerCase().replace(/\s+/g, "-")}-setup.sh`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Download iniciado" });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />
                Criar novo acesso
              </DialogTitle>
              <DialogDescription>
                Gera um kubeconfig restrito para um colaborador. O acesso pode ser revogado a qualquer momento.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="grantee-name">
                  Nome do colaborador <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="grantee-name"
                  placeholder="Ex: João Dev"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="grantee-email">
                  E-mail <span className="text-xs text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="grantee-email"
                  type="email"
                  placeholder="joao@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label>Tipo de acesso <span className="text-destructive">*</span></Label>
                <div className="grid grid-cols-1 gap-2">
                  {ROLES.map((r) => {
                    const Icon = r.icon;
                    const selected = role === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:border-border hover:bg-muted/30",
                        )}
                      >
                        <div className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5", r.bg)}>
                          <Icon className={cn("w-4 h-4", r.color)} />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{r.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{r.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Namespace */}
              <div className="space-y-1.5">
                <Label>Namespace</Label>
                <Select value={ns} onValueChange={setNs}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os namespaces</SelectItem>
                    {namespaces.map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  "Todos os namespaces" cria um ClusterRole. Namespace específico cria um Role com escopo limitado.
                </p>
              </div>

              {/* Expiry */}
              <div className="space-y-1.5">
                <Label>Expiração</Label>
                <Select value={expiry} onValueChange={setExpiry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem expiração" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="access-notes">
                  Observações <span className="text-xs text-muted-foreground">(opcional)</span>
                </Label>
                <Textarea
                  id="access-notes"
                  placeholder="Ex: Acesso temporário para debug do serviço de pagamento"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreate}
                  disabled={loading || !name.trim()}
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando...</>
                    : <><KeyRound className="w-4 h-4 mr-2" />Gerar Acesso</>}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="w-5 h-5" />
                Script de acesso gerado!
              </DialogTitle>
              <DialogDescription>
                Execute o script abaixo em uma máquina com acesso admin ao cluster para criar o kubeconfig de <strong>{name}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Baixe o script e execute com <code className="font-mono bg-black/20 px-1 rounded">bash kodo-{name.toLowerCase().replace(/\s+/g, "-")}-setup.sh</code>. O kubeconfig será impresso no terminal.</span>
              </div>

              <pre className="text-[10px] font-mono bg-muted rounded-lg p-3 overflow-x-auto overflow-y-auto max-h-56 border border-border/50 text-muted-foreground leading-relaxed whitespace-pre">
                {generatedScript}
              </pre>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleCopy}>
                  {copied
                    ? <><CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />Copiado!</>
                    : <><Copy className="w-4 h-4 mr-2" />Copiar script</>}
                </Button>
                <Button className="flex-1" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />Baixar .sh
                </Button>
              </div>

              <Button variant="outline" className="w-full" onClick={handleClose}>
                Fechar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

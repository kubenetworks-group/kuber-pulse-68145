import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Loader2 } from "lucide-react";

interface CreateSnapshotButtonProps {
  onConfirm: (name: string, description?: string) => Promise<void>;
  loading?: boolean;
}

export function CreateSnapshotButton({ onConfirm, loading }: CreateSnapshotButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(name.trim(), description.trim() || undefined);
      setOpen(false);
      setName("");
      setDescription("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={loading}>
        <Camera className="w-4 h-4 mr-2" />
        Criar Snapshot
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Snapshot do Cluster</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="snapshot-name">Nome *</Label>
              <Input
                id="snapshot-name"
                placeholder="Ex: pre-migration-v1"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="snapshot-desc">Descrição (opcional)</Label>
              <Textarea
                id="snapshot-desc"
                placeholder="Descreva o propósito deste snapshot..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O agente coletará todos os manifests do cluster (Deployments, Services, ConfigMaps, PVCs, etc.)
              e armazenará com segurança no Supabase Storage.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Iniciar Snapshot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

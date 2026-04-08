import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SessionExpiredDialogProps {
  open: boolean;
  onRenewed: () => void;
  onSignOut: () => void;
}

export const SessionExpiredDialog = ({ open, onRenewed, onSignOut }: SessionExpiredDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleRenew = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        setFailed(true);
      } else {
        onRenewed();
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-amber-500" />
            Sessão expirada
          </DialogTitle>
          <DialogDescription>
            {failed
              ? "Não foi possível renovar a sessão automaticamente. Por favor, faça login novamente para continuar."
              : "Sua sessão expirou por inatividade. Clique em Renovar Sessão para continuar de onde parou, sem precisar fazer login novamente."}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          {failed ? (
            <>
              <Button variant="ghost" onClick={onSignOut}>
                Cancelar
              </Button>
              <Button onClick={onSignOut} className="gap-2">
                <LogIn className="h-4 w-4" />
                Fazer Login
              </Button>
            </>
          ) : (
            <Button onClick={handleRenew} disabled={loading} className="w-full gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {loading ? "Renovando..." : "Renovar Sessão"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

import { useState, useEffect } from "react";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import kodoLogo from "@/assets/kodo-logo.png";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Shield, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import { AnimatedParticles } from "@/components/AnimatedParticles";
import { PasswordInput } from "@/components/PasswordInput";

const passwordSchema = z.string()
  .min(8, "A senha deve ter no mínimo 8 caracteres")
  .regex(/[A-Z]/, "A senha deve conter ao menos uma letra maiúscula")
  .regex(/[a-z]/, "A senha deve conter ao menos uma letra minúscula")
  .regex(/[0-9]/, "A senha deve conter ao menos um número");

type PageState = "waiting" | "ready" | "expired" | "done";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pageState, setPageState] = useState<PageState>("waiting");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ password: "", confirmPassword: "" });

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the page loads with a valid recovery token
    // in the URL hash. The listener must be registered before Supabase processes the hash.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPageState("ready");
      }
    });

    // Fallback: if no PASSWORD_RECOVERY fires within 4s, the link is invalid/expired
    const timeout = setTimeout(() => {
      setPageState((current) => current === "waiting" ? "expired" : current);
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const getPasswordStrength = (password: string) => {
    const checks = [
      password.length >= 8,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /[0-9]/.test(password),
    ];
    return checks.filter(Boolean).length;
  };

  const strength = getPasswordStrength(form.password);

  const strengthLabel = ["", "Muito fraca", "Fraca", "Boa", "Forte"][strength] ?? "";
  const strengthColor =
    strength <= 1 ? "bg-red-500" :
    strength === 2 ? "bg-orange-400" :
    strength === 3 ? "bg-yellow-400" :
    "bg-green-500";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = passwordSchema.safeParse(form.password);
    if (!validation.success) {
      toast({
        title: "Senha inválida",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "A confirmação de senha não é igual à nova senha.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: form.password });
      if (error) throw error;

      setPageState("done");
      toast({ title: "Senha atualizada!", description: "Redirecionando para o dashboard..." });
      setTimeout(() => navigate("/dashboard"), 2500);
    } catch (err: any) {
      toast({
        title: "Erro ao atualizar senha",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-background flex items-center justify-center p-4 overflow-hidden">
      <SEO
        title="Redefinir Senha — Kodo"
        description="Redefina sua senha do Kodo de forma segura."
        path="/reset-password"
      />
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      <AnimatedParticles />
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />

      <div className="w-full max-w-md space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="text-center space-y-4">
          <div className="inline-flex relative group">
            <div className="absolute inset-0 bg-gradient-primary rounded-full blur-2xl opacity-50 group-hover:opacity-75 transition-opacity" />
            <img src={kodoLogo} alt="Kodo Logo" className="w-20 h-20 object-contain relative z-10 drop-shadow-2xl" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
              Redefinir Senha
            </h1>
            <p className="text-sm text-muted-foreground">
              Escolha uma nova senha segura para sua conta
            </p>
          </div>
        </div>

        <Card className="p-6 bg-card/50 backdrop-blur-2xl border-border/50 shadow-2xl hover:shadow-primary/10 transition-all duration-500">
          {pageState === "waiting" && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <Shield className="w-14 h-14 text-primary animate-pulse" />
              <div>
                <p className="text-base font-medium">Verificando link de recuperação...</p>
                <p className="text-sm text-muted-foreground mt-1">Aguarde um momento.</p>
              </div>
            </div>
          )}

          {pageState === "expired" && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <AlertTriangle className="w-14 h-14 text-destructive" />
              <div className="space-y-2">
                <p className="text-base font-semibold">Link inválido ou expirado</p>
                <p className="text-sm text-muted-foreground">
                  O link de recuperação pode ter expirado ou já foi utilizado.
                </p>
              </div>
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => navigate("/auth")}
              >
                Solicitar novo link
              </Button>
            </div>
          )}

          {pageState === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-5 pt-1">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-foreground font-medium">
                  Nova Senha
                </Label>
                <PasswordInput
                  id="new-password"
                  value={form.password}
                  onChange={(value) => setForm({ ...form, password: value })}
                  required
                />
                {form.password.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                            strength >= level ? strengthColor : "bg-border"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">{strengthLabel}</span>
                      {" — mín. 8 chars, maiúscula, minúscula e número"}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-foreground font-medium">
                  Confirmar Nova Senha
                </Label>
                <PasswordInput
                  id="confirm-password"
                  value={form.confirmPassword}
                  onChange={(value) => setForm({ ...form, confirmPassword: value })}
                  required
                />
                {form.confirmPassword.length > 0 && form.password !== form.confirmPassword && (
                  <p className="text-xs text-destructive">As senhas não conferem</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:opacity-90 transition-all shadow-lg hover:shadow-primary/50"
                disabled={loading || strength < 4 || form.password !== form.confirmPassword}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                    Salvando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    Salvar nova senha
                  </span>
                )}
              </Button>
            </form>
          )}

          {pageState === "done" && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              <div>
                <p className="text-lg font-semibold">Senha atualizada com sucesso!</p>
                <p className="text-sm text-muted-foreground mt-1">Redirecionando para o dashboard...</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;

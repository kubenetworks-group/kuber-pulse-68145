import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { z } from "zod";
import {
  Loader2, Building2, User, CheckCircle2, ArrowRight,
  Shield, Smartphone, KeyRound, AtSign, Lock, ChevronRight,
} from "lucide-react";
import kodoLogo from "@/assets/kodo-logo.png";
import { PasswordInput } from "@/components/PasswordInput";
import { Link } from "react-router-dom";

const TERMS_VERSION = "v1.2";
const POLICY_VERSION = "v1.2";

const passwordSchema = z.string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[A-Z]/, "Ao menos uma letra maiúscula")
  .regex(/[a-z]/, "Ao menos uma letra minúscula")
  .regex(/[0-9]/, "Ao menos um número");

const usernameSchema = z.string()
  .min(3, "Mínimo 3 caracteres")
  .max(20, "Máximo 20 caracteres")
  .regex(/^[a-zA-Z0-9_]+$/, "Apenas letras, números e _");

const getPasswordStrength = (p: string) =>
  [p.length >= 8, /[A-Z]/.test(p), /[a-z]/.test(p), /[0-9]/.test(p)].filter(Boolean).length;

type Step = "profile" | "mfa";

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("profile");
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [usernameError, setUsernameError] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    username: "",
    company: "",
    password: "",
    confirmPassword: "",
  });

  // Pre-fill name from invite metadata
  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setForm((f) => ({ ...f, full_name: user.user_metadata.full_name }));
    }
  }, [user]);

  const strength = getPasswordStrength(form.password);
  const strengthLabel = ["", "Muito fraca", "Fraca", "Boa", "Forte"][strength] ?? "";
  const strengthColor =
    strength <= 1 ? "bg-red-500" :
    strength === 2 ? "bg-orange-400" :
    strength === 3 ? "bg-yellow-400" :
    "bg-green-500";

  const validateUsername = (v: string) => {
    if (!v) { setUsernameError(""); return true; }
    const r = usernameSchema.safeParse(v);
    setUsernameError(r.success ? "" : r.error.errors[0].message);
    return r.success;
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!termsAccepted) { toast.error("Você precisa aceitar os termos para continuar."); return; }
    if (!form.full_name.trim()) { toast.error("Informe seu nome completo."); return; }
    if (!validateUsername(form.username)) return;

    const pwValidation = passwordSchema.safeParse(form.password);
    if (!pwValidation.success) { toast.error(pwValidation.error.errors[0].message); return; }
    if (form.password !== form.confirmPassword) { toast.error("As senhas não conferem."); return; }

    setLoading(true);
    try {
      // 1. Set password
      const { error: pwError } = await supabase.auth.updateUser({ password: form.password });
      if (pwError) throw pwError;

      // 2. Save profile
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user!.id,
        full_name: form.full_name.trim(),
        username: form.username.trim() || null,
        company: form.company.trim() || null,
        updated_at: new Date().toISOString(),
      });
      if (profileError) throw profileError;

      // 3. Record consent
      await supabase.from("user_consents").upsert({
        user_id: user!.id,
        terms_accepted: true,
        privacy_policy_accepted: true,
        marketing_consent: false,
        terms_version: TERMS_VERSION,
        policy_version: POLICY_VERSION,
        consent_date: new Date().toISOString(),
        user_agent: navigator.userAgent,
      });

      setStep("mfa");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const finishOnboarding = (goToMFA = false) => {
    localStorage.setItem(`onboarding_completed_${user?.id}`, "true");
    if (goToMFA) {
      navigate("/settings?tab=security", { replace: true });
    } else {
      navigate("/welcome", { replace: true });
    }
  };

  const progress = step === "profile" ? 50 : 100;

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 overflow-hidden">
      {/* Background glows */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-[#0891b2]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-[#4f46e5]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Header */}
        <div className="text-center mb-8 space-y-4">
          <img src={kodoLogo} alt="Kodo" className="w-14 h-14 mx-auto drop-shadow-xl" />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              {step === "profile" ? "Configure sua conta" : "Proteja sua conta"}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {step === "profile"
                ? "Passo 1 de 2 — Perfil e senha"
                : "Passo 2 de 2 — Autenticação em dois fatores"}
            </p>
          </div>
          <Progress value={progress} className="h-1.5 max-w-xs mx-auto [&>div]:bg-gradient-to-r [&>div]:from-[#0891b2] [&>div]:to-[#4f46e5]" />
        </div>

        {/* ── Step 1: Profile + Password ── */}
        {step === "profile" && (
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-8 shadow-2xl">
            <form onSubmit={handleProfileSubmit} className="space-y-5">

              {/* Full name */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm font-medium flex items-center gap-2">
                  <User className="w-3.5 h-3.5" /> Nome completo *
                </Label>
                <Input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="João Silva"
                  className="bg-[#0f172a] border-[#334155] text-white placeholder:text-slate-500 focus:border-[#0891b2] h-11"
                />
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm font-medium flex items-center gap-2">
                  <AtSign className="w-3.5 h-3.5" /> Username
                </Label>
                <Input
                  value={form.username}
                  onChange={(e) => { setForm((f) => ({ ...f, username: e.target.value })); validateUsername(e.target.value); }}
                  placeholder="joao_silva"
                  className={`bg-[#0f172a] border-[#334155] text-white placeholder:text-slate-500 focus:border-[#0891b2] h-11 ${usernameError ? "border-red-500" : ""}`}
                />
                {usernameError && <p className="text-xs text-red-400">{usernameError}</p>}
              </div>

              {/* Company */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm font-medium flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5" /> Empresa
                </Label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="KubeNetworks Ltda."
                  className="bg-[#0f172a] border-[#334155] text-white placeholder:text-slate-500 focus:border-[#0891b2] h-11"
                />
              </div>

              {/* Divider */}
              <div className="border-t border-[#334155] pt-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                  <Lock className="w-3 h-3" /> Defina sua senha
                </p>

                {/* New password */}
                <div className="space-y-1.5 mb-4">
                  <Label className="text-slate-300 text-sm font-medium">Nova Senha *</Label>
                  <PasswordInput
                    id="onboarding-password"
                    value={form.password}
                    onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                    required
                  />
                  {form.password.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((l) => (
                          <div key={l} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${strength >= l ? strengthColor : "bg-[#334155]"}`} />
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">
                        <span className="font-medium text-slate-400">{strengthLabel}</span>
                        {" — mín. 8 chars, maiúscula, minúscula e número"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm font-medium">Confirmar Senha *</Label>
                  <PasswordInput
                    id="onboarding-confirm"
                    value={form.confirmPassword}
                    onChange={(v) => setForm((f) => ({ ...f, confirmPassword: v }))}
                    required
                  />
                  {form.confirmPassword.length > 0 && form.password !== form.confirmPassword && (
                    <p className="text-xs text-red-400">As senhas não conferem</p>
                  )}
                </div>
              </div>

              {/* Terms */}
              <div className="border-t border-[#334155] pt-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-[#0891b2] flex-shrink-0"
                  />
                  <span className="text-sm text-slate-400 leading-snug group-hover:text-slate-300 transition-colors">
                    Li e aceito os{" "}
                    <Link to="/terms" target="_blank" className="text-[#0891b2] hover:text-[#38bdf8] underline underline-offset-2">
                      Termos de Serviço
                    </Link>{" "}e a{" "}
                    <Link to="/privacy" target="_blank" className="text-[#0891b2] hover:text-[#38bdf8] underline underline-offset-2">
                      Política de Privacidade
                    </Link>{" "}do Kodo. *
                  </span>
                </label>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading || !termsAccepted || strength < 4 || form.password !== form.confirmPassword || !!usernameError}
                className="w-full h-12 text-base font-bold mt-1 gap-2"
                style={{ background: "linear-gradient(135deg, #0891b2, #4f46e5)" }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <><CheckCircle2 className="w-5 h-5" /> Salvar e continuar</>
                )}
              </Button>
            </form>
          </div>
        )}

        {/* ── Step 2: MFA Recommendation ── */}
        {step === "mfa" && (
          <div className="space-y-4">
            {/* Main recommendation card */}
            <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-8 shadow-2xl">
              <div className="text-center mb-6">
                <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-[#0891b2]/20 to-[#4f46e5]/20 border border-[#0891b2]/30 mb-4">
                  <Shield className="w-10 h-10 text-[#0891b2]" />
                </div>
                <h2 className="text-xl font-black text-white">Recomendamos o MFA</h2>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                  A autenticação em dois fatores protege sua conta mesmo se sua senha for comprometida.
                </p>
              </div>

              {/* Benefits */}
              <div className="space-y-3 mb-6">
                {[
                  { icon: "🔐", title: "Acesso só com seu celular", desc: "Mesmo com a senha, ninguém entra sem o código do app" },
                  { icon: "⚡", title: "Google Authenticator", desc: "App gratuito, funciona offline, sem SMS" },
                  { icon: "🛡️", title: "Padrão enterprise", desc: "Exigido em clusters de produção por compliance" },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3 bg-[#0f172a] rounded-xl p-4 border border-[#334155]">
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{item.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* App stores hint */}
              <div className="flex items-center gap-3 bg-[#0f172a] rounded-xl p-4 border border-[#334155] mb-6">
                <Smartphone className="w-5 h-5 text-[#0891b2] flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">Instale o Google Authenticator antes de configurar</p>
                  <p className="text-xs text-slate-600">Disponível na App Store e Google Play</p>
                </div>
              </div>

              {/* CTA buttons */}
              <div className="space-y-3">
                <Button
                  className="w-full h-12 font-bold gap-2 text-base"
                  style={{ background: "linear-gradient(135deg, #0891b2, #4f46e5)" }}
                  onClick={() => finishOnboarding(true)}
                >
                  <KeyRound className="w-5 h-5" />
                  Ativar MFA agora
                </Button>

                <Button
                  variant="ghost"
                  className="w-full h-11 text-slate-400 hover:text-slate-200 hover:bg-[#334155] gap-2"
                  onClick={() => finishOnboarding(false)}
                >
                  Configurar depois
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Skip note */}
            <p className="text-center text-xs text-slate-600">
              Você pode ativar o MFA a qualquer momento em{" "}
              <button
                className="text-[#0891b2] hover:underline"
                onClick={() => finishOnboarding(false)}
              >
                Configurações → Segurança
              </button>
            </p>
          </div>
        )}

        <p className="text-center text-xs text-slate-700 mt-6">
          Kodo · KubeNetworks · São Paulo, SP — Brasil
        </p>
      </div>
    </div>
  );
}

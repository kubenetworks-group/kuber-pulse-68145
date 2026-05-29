import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Building2, User, Phone, Briefcase, CheckCircle2 } from "lucide-react";
import kodoLogo from "@/assets/kodo-logo.png";

const TERMS_VERSION = "v1.2";
const POLICY_VERSION = "v1.2";

export default function RegisterProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: user?.user_metadata?.full_name ?? "",
    company: "",
    role: "",
    whatsapp_phone: "",
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast.error("Você precisa aceitar os termos para continuar.");
      return;
    }
    if (!form.full_name.trim()) {
      toast.error("Informe seu nome completo.");
      return;
    }

    setLoading(true);
    try {
      // 1. Upsert profile
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user!.id,
          full_name: form.full_name.trim(),
          company: form.company.trim() || null,
          whatsapp_phone: form.whatsapp_phone.trim() || null,
          updated_at: new Date().toISOString(),
        });

      if (profileError) throw profileError;

      // 2. Record consent
      const { error: consentError } = await supabase
        .from("user_consents")
        .upsert({
          user_id: user!.id,
          terms_accepted: true,
          privacy_policy_accepted: true,
          marketing_consent: marketingConsent,
          terms_version: TERMS_VERSION,
          policy_version: POLICY_VERSION,
          consent_date: new Date().toISOString(),
          ip_address: null,
          user_agent: navigator.userAgent,
        });

      if (consentError) throw consentError;

      toast.success("Cadastro concluído! Bem-vindo ao Kodo.");
      navigate("/clusters", { replace: true });
    } catch (err: any) {
      toast.error("Erro ao salvar cadastro. Tente novamente.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      {/* Background glows */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-[#0891b2]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-[#4f46e5]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={kodoLogo} alt="Kodo" className="w-14 h-14 mx-auto mb-3 drop-shadow-xl" />
          <h1 className="text-2xl font-black tracking-tight text-white">
            Complete seu cadastro
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Preencha seus dados para acessar a plataforma
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Full name */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm font-medium flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> Nome completo *
              </Label>
              <Input
                required
                value={form.full_name}
                onChange={set("full_name")}
                placeholder="João Silva"
                className="bg-[#0f172a] border-[#334155] text-white placeholder:text-slate-500 focus:border-[#0891b2] h-11"
              />
            </div>

            {/* Company */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm font-medium flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5" /> Empresa
              </Label>
              <Input
                value={form.company}
                onChange={set("company")}
                placeholder="KubeNetworks Ltda."
                className="bg-[#0f172a] border-[#334155] text-white placeholder:text-slate-500 focus:border-[#0891b2] h-11"
              />
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm font-medium flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5" /> Cargo
              </Label>
              <Input
                value={form.role}
                onChange={set("role")}
                placeholder="DevOps Engineer, CTO, SRE..."
                className="bg-[#0f172a] border-[#334155] text-white placeholder:text-slate-500 focus:border-[#0891b2] h-11"
              />
            </div>

            {/* WhatsApp */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm font-medium flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" /> WhatsApp (opcional)
              </Label>
              <Input
                value={form.whatsapp_phone}
                onChange={set("whatsapp_phone")}
                placeholder="+55 11 99999-9999"
                className="bg-[#0f172a] border-[#334155] text-white placeholder:text-slate-500 focus:border-[#0891b2] h-11"
              />
            </div>

            {/* Divider */}
            <div className="border-t border-[#334155] pt-5 space-y-3">

              {/* Terms */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-0.5 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#0891b2]"
                  />
                </div>
                <span className="text-sm text-slate-400 leading-snug group-hover:text-slate-300 transition-colors">
                  Eu li e aceito os{" "}
                  <a
                    href="/terms"
                    target="_blank"
                    className="text-[#0891b2] hover:text-[#38bdf8] underline underline-offset-2"
                  >
                    Termos de Serviço
                  </a>{" "}
                  e a{" "}
                  <a
                    href="/privacy"
                    target="_blank"
                    className="text-[#0891b2] hover:text-[#38bdf8] underline underline-offset-2"
                  >
                    Política de Privacidade
                  </a>{" "}
                  do Kodo. *
                </span>
              </label>

              {/* Marketing */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-0.5 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#0891b2]"
                  />
                </div>
                <span className="text-sm text-slate-400 leading-snug group-hover:text-slate-300 transition-colors">
                  Aceito receber novidades, atualizações e conteúdos da KubeNetworks por email.
                </span>
              </label>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading || !termsAccepted}
              className="w-full h-12 text-base font-bold mt-2"
              style={{
                background: termsAccepted
                  ? "linear-gradient(135deg, #0891b2, #4f46e5)"
                  : undefined,
                opacity: termsAccepted ? 1 : 0.5,
              }}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Acessar o Kodo
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Kodo · KubeNetworks · São Paulo, SP — Brasil
        </p>
      </div>
    </div>
  );
}

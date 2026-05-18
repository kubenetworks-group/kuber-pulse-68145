import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";
import kodoLogo from "@/assets/kodo-logo.png";
import { Check, Shield, Zap, DollarSign } from "lucide-react";

export default function Diagnostico() {
  const variant = (new URLSearchParams(window.location.search).get('variant') as 'a' | 'b' | 'c') ?? 'a';

  return (
    <>
      <SEO
        title="Diagnóstico Kubernetes com IA — Análise gratuita do seu cluster | Kodo"
        description="Receba uma análise gratuita do seu cluster Kubernetes: potencial de economia FinOps, riscos de segurança e recomendações de auto-healing. Sem instalar nada."
        path="/diagnostico"
      />

      <div className="min-h-screen bg-white" style={{ fontFamily: "'Nunito Sans', -apple-system, sans-serif" }}>

        {/* Header mínimo */}
        <header className="px-6 py-5 border-b border-slate-100">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={kodoLogo} alt="Kodo" className="w-7 h-7" />
              <span className="font-bold text-slate-900 text-lg tracking-tight">Kodo</span>
            </Link>
            <Link to="/auth" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
              Já tenho conta →
            </Link>
          </div>
        </header>

        <main className="px-6 py-16">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">

              {/* Left — copy */}
              <div className="space-y-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-4"
                    style={{ color: '#0891b2', fontFamily: "'JetBrains Mono', monospace" }}>
                    Diagnóstico gratuito
                  </p>
                  <h1 className="text-4xl font-black leading-tight text-slate-900 tracking-tight mb-4"
                    style={{ fontFamily: "'Nunito', sans-serif", fontSize: 'clamp(1.9rem, 3.5vw, 2.75rem)' }}>
                    Descubra quanto seu cluster está custando além do necessário
                  </h1>
                  <p className="text-slate-500 leading-relaxed text-base">
                    Nossa equipe analisa seu ambiente Kubernetes e envia um relatório com potencial de economia e riscos de segurança — sem instalar nada, sem compromisso.
                  </p>
                </div>

                {/* O que você recebe */}
                <div className="space-y-4">
                  {[
                    {
                      icon: <DollarSign className="w-4 h-4" style={{ color: '#f59e0b' }} />,
                      title: 'Análise de custo',
                      desc: 'Recursos subutilizados e estimativa de economia mensal',
                    },
                    {
                      icon: <Shield className="w-4 h-4" style={{ color: '#ec4899' }} />,
                      title: 'Mapa de segurança',
                      desc: 'RBAC, Network Policies e Pod Security Standards',
                    },
                    {
                      icon: <Zap className="w-4 h-4" style={{ color: '#0891b2' }} />,
                      title: 'Recomendações de healing',
                      desc: 'Padrões de falha mais comuns no seu tipo de cluster',
                    },
                  ].map(({ icon, title, desc }) => (
                    <div key={title} className="flex items-start gap-4">
                      <div className="mt-0.5 w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                        {icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{title}</p>
                        <p className="text-sm text-slate-500">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Trust */}
                <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2 border-t border-slate-100">
                  {[
                    'Sem compromisso',
                    'Sem cartão de crédito',
                    'Resposta em até 24h',
                    'Sem instalar nada',
                  ].map((t) => (
                    <span key={t} className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Check className="w-3 h-3 text-emerald-500" />
                      {t}
                    </span>
                  ))}
                </div>

                {/* Social proof */}
                <div className="rounded-xl border border-slate-200 p-5 bg-slate-50">
                  <div className="flex items-center gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-amber-400 text-sm">★</span>
                    ))}
                    <span className="text-xs text-slate-500 ml-1">4.8 · 150+ avaliações</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed italic">
                    "Reduzimos 38% dos custos em 3 semanas. O diagnóstico mostrou exatamente onde estávamos desperdiçando."
                  </p>
                  <p className="text-xs text-slate-400 mt-2">— Head of Infrastructure, Fintech BR</p>
                </div>
              </div>

              {/* Right — form */}
              <div className="lg:sticky lg:top-8">
                <div className="rounded-2xl border border-slate-200 p-8 shadow-sm" style={{ background: '#f8fafc' }}>
                  <h2 className="text-lg font-bold text-slate-900 mb-1"
                    style={{ fontFamily: "'Nunito', sans-serif" }}>
                    Receba sua análise gratuita
                  </h2>
                  <p className="text-sm text-slate-500 mb-6">Preencha abaixo — nossa equipe entra em contato em até 24h.</p>
                  <LeadCaptureForm variant={variant} />
                </div>
              </div>

            </div>
          </div>
        </main>

        {/* Footer mínimo */}
        <footer className="px-6 py-8 border-t border-slate-100 mt-8">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-400">© 2025 KubeNetworks. Todos os direitos reservados.</p>
            <div className="flex gap-4">
              <Link to="/privacy" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Privacidade</Link>
              <Link to="/terms" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Termos</Link>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}

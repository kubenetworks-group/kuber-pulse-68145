import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Footer } from "@/components/Footer";
import kodoLogo from "@/assets/kodo-logo.png";
import { ArrowRight, Clock, Calendar } from "lucide-react";

const POSTS = [
  {
    slug: "/blog/kubernetes-ia",
    title: "Kubernetes com IA: como a inteligência artificial transforma a gestão de clusters",
    description: "Entenda como machine learning e IA estão revolucionando o gerenciamento de clusters Kubernetes — do monitoramento preditivo ao auto-healing e FinOps automático.",
    date: "18 mai 2026",
    readTime: "8 min",
    tag: "Kubernetes IA",
  },
  {
    slug: "/blog/auto-healing-kubernetes",
    title: "Auto-Healing Kubernetes: o que é, como funciona e como implementar",
    description: "Guia completo sobre auto-healing em clusters Kubernetes. Como IA detecta e corrige falhas automaticamente em menos de 30 segundos, sem intervenção manual.",
    date: "18 mai 2026",
    readTime: "7 min",
    tag: "Auto-Healing",
  },
  {
    slug: "/blog/finops-kubernetes",
    title: "FinOps Kubernetes: como reduzir custos de infraestrutura cloud em até 40%",
    description: "Guia prático de FinOps para Kubernetes. Aprenda a identificar desperdícios e reduzir custos de AWS EKS, GKE e AKS com inteligência artificial.",
    date: "18 mai 2026",
    readTime: "9 min",
    tag: "FinOps",
  },
];

export default function BlogIndex() {
  return (
    <>
      <SEO
        title="Blog Kodo — Kubernetes, IA, FinOps e DevOps"
        description="Artigos técnicos sobre gestão de clusters Kubernetes com IA, auto-healing, FinOps, segurança e observabilidade. Para DevOps engineers e SREs."
        path="/blog"
      />

      <div className="min-h-screen bg-white" style={{ fontFamily: "'Nunito Sans', -apple-system, sans-serif" }}>
        {/* Header */}
        <header className="px-6 py-5 border-b border-slate-100">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={kodoLogo} alt="Kodo" className="w-7 h-7" />
              <span className="font-bold text-slate-900 text-lg tracking-tight">Kodo</span>
            </Link>
            <nav className="flex items-center gap-6">
              <Link to="/" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Home</Link>
              <Link to="/diagnostico" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Diagnóstico grátis</Link>
              <Link to="/auth?tab=signup" className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #0891b2, #4f46e5)' }}>
                Começar grátis
              </Link>
            </nav>
          </div>
        </header>

        <main className="px-6 py-16">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-12">
              <p className="text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ color: '#0891b2', fontFamily: "'JetBrains Mono', monospace" }}>
                Blog
              </p>
              <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight"
                style={{ fontFamily: "'Nunito', sans-serif" }}>
                Kubernetes, IA e DevOps
              </h1>
              <p className="text-slate-500 text-lg max-w-xl">
                Artigos técnicos sobre gestão de clusters Kubernetes com inteligência artificial,
                auto-healing, FinOps e segurança.
              </p>
            </div>

            {/* Posts grid */}
            <div className="space-y-6">
              {POSTS.map((post) => (
                <Link key={post.slug} to={post.slug}
                  className="group block rounded-2xl border border-slate-200 p-7 hover:border-slate-300 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <span className="inline-block text-xs font-semibold uppercase tracking-widest mb-3 px-2.5 py-1 rounded-full bg-cyan-50 border border-cyan-100"
                        style={{ color: '#0891b2', fontFamily: "'JetBrains Mono', monospace" }}>
                        {post.tag}
                      </span>
                      <h2 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-cyan-700 transition-colors leading-tight"
                        style={{ fontFamily: "'Nunito', sans-serif" }}>
                        {post.title}
                      </h2>
                      <p className="text-slate-500 leading-relaxed text-sm mb-4">{post.description}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />{post.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />{post.readTime} de leitura
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-cyan-500 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

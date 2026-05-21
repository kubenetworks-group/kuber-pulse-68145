import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Footer } from "@/components/Footer";
import kodoLogo from "@/assets/kodo-logo.png";
import { ArrowLeft, ArrowRight, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BlogLayoutProps {
  title: string;
  description: string;
  date: string;
  readTime: string;
  dateISO: string;
  slug: string;
  children: React.ReactNode;
}

export function BlogLayout({ title, description, date, readTime, dateISO, slug, children }: BlogLayoutProps) {
  const BASE_URL = "https://kodo.kubenetworks.com.br";
  const url = `${BASE_URL}${slug}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": title,
    "description": description,
    "datePublished": dateISO,
    "dateModified": dateISO,
    "url": url,
    "author": {
      "@type": "Organization",
      "name": "Kodo — KubeNetworks",
      "url": BASE_URL
    },
    "publisher": {
      "@type": "Organization",
      "name": "Kodo",
      "url": BASE_URL,
      "logo": {
        "@type": "ImageObject",
        "url": `${BASE_URL}/kodo-logo.png`
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": url
    },
    "inLanguage": "pt-BR",
    "about": {
      "@type": "Thing",
      "name": "Kubernetes"
    }
  };

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
      </Helmet>
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Nunito Sans', -apple-system, sans-serif" }}>
      {/* Header */}
      <header className="px-6 py-5 border-b border-slate-100 sticky top-0 bg-white/90 backdrop-blur z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={kodoLogo} alt="Kodo" className="w-7 h-7" />
            <span className="font-bold text-slate-900 text-lg tracking-tight">Kodo</span>
          </Link>
          <Link to="/blog" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Blog
          </Link>
        </div>
      </header>

      <main className="px-6 py-16">
        <div className="max-w-3xl mx-auto">
          {/* Article header */}
          <div className="mb-12">
            <Link to="/blog" className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest mb-6 hover:opacity-70 transition-opacity"
              style={{ color: '#0891b2', fontFamily: "'JetBrains Mono', monospace" }}>
              Blog · Kubernetes
            </Link>
            <h1 className="text-4xl font-black leading-tight text-slate-900 mb-4 tracking-tight"
              style={{ fontFamily: "'Nunito', sans-serif", fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
              {title}
            </h1>
            <p className="text-lg text-slate-500 leading-relaxed mb-6">{description}</p>
            <div className="flex items-center gap-5 text-sm text-slate-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {date}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {readTime}
              </span>
            </div>
          </div>

          {/* Article content */}
          <div className="prose-kodo">
            {children}
          </div>

          {/* CTA */}
          <div className="mt-16 rounded-2xl p-8 text-center border border-slate-200"
            style={{ background: 'linear-gradient(135deg, #f0fdff 0%, #eef2ff 100%)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: '#0891b2', fontFamily: "'JetBrains Mono', monospace" }}>
              Demo gratuita
            </p>
            <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight"
              style={{ fontFamily: "'Nunito', sans-serif" }}>
              Experimente o Kodo no seu cluster
            </h2>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              Setup em 5 minutos. Veja auto-healing, FinOps e segurança em tempo real no seu cluster.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/diagnostico">
                <Button className="text-white px-6"
                  style={{ background: 'linear-gradient(135deg, #0891b2, #4f46e5)' }}>
                  Solicite a demo gratuitamente
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/diagnostico">
                <Button variant="outline" className="px-6 border-slate-200 text-slate-600">
                  Receber diagnóstico gratuito
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
    </>
  );
}

// Componentes de tipografia para os artigos
export const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-2xl font-black text-slate-900 mt-12 mb-4 tracking-tight"
    style={{ fontFamily: "'Nunito', sans-serif" }}>
    {children}
  </h2>
);

export const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-lg font-bold text-slate-800 mt-8 mb-3"
    style={{ fontFamily: "'Nunito', sans-serif" }}>
    {children}
  </h3>
);

export const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-slate-600 leading-relaxed mb-5 text-base">{children}</p>
);

export const UL = ({ children }: { children: React.ReactNode }) => (
  <ul className="space-y-2 mb-6 ml-4">{children}</ul>
);

export const LI = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start gap-2.5 text-slate-600 text-base leading-relaxed">
    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
    <span>{children}</span>
  </li>
);

export const Highlight = ({ children }: { children: React.ReactNode }) => (
  <div className="my-8 rounded-xl border-l-4 border-cyan-400 bg-cyan-50 px-6 py-5">
    <p className="text-slate-700 leading-relaxed">{children}</p>
  </div>
);

export const Stat = ({ value, label }: { value: string; label: string }) => (
  <div className="text-center p-5 rounded-xl border border-slate-200 bg-slate-50">
    <div className="text-3xl font-black text-slate-900 mb-1"
      style={{ fontFamily: "'Nunito', sans-serif", background: 'linear-gradient(120deg, #0891b2, #4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
      {value}
    </div>
    <div className="text-sm text-slate-500">{label}</div>
  </div>
);

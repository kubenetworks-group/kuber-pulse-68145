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
    <div className="min-h-screen" style={{ background: '#F0F4FA', fontFamily: "'Aileron', system-ui, sans-serif" }}>
      {/* Header */}
      <header className="px-6 py-5 border-b sticky top-0 z-10"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderColor: 'rgba(0,0,0,0.08)' }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={kodoLogo} alt="Kodo" className="w-7 h-7" />
            <span className="font-bold text-lg tracking-tight" style={{ color: '#1A1A1A' }}>Kodo</span>
          </Link>
          <Link to="/blog" className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: '#6B6B6B' }}>
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
              style={{ color: '#0F3CA5', fontFamily: "'DM Mono', monospace" }}>
              Blog · Kubernetes
            </Link>
            <h1 className="font-black leading-tight mb-4 tracking-tight"
              style={{ color: '#1A1A1A', fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)' }}>
              {title}
            </h1>
            <p className="text-lg leading-relaxed mb-6" style={{ color: '#6B6B6B' }}>{description}</p>
            <div className="flex items-center gap-5 text-sm" style={{ color: '#9B9B9B' }}>
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
          <div className="mt-16 rounded-2xl p-8 text-center"
            style={{ background: '#0F3CA5' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'rgba(255,255,255,0.65)', fontFamily: "'DM Mono', monospace" }}>
              Demo gratuita
            </p>
            <h2 className="text-2xl font-black mb-3 tracking-tight" style={{ color: '#fff' }}>
              Experimente o Kodo no seu cluster
            </h2>
            <p className="mb-6 max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.72)' }}>
              Setup em 5 minutos. Veja auto-healing, FinOps e segurança em tempo real no seu cluster.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/diagnostico">
                <Button className="px-6 font-semibold"
                  style={{ background: '#fff', color: '#0F3CA5' }}>
                  Solicite a demo gratuitamente
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/diagnostico">
                <Button variant="outline" className="px-6"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', background: 'rgba(255,255,255,0.10)' }}>
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
  <h2 className="text-2xl font-black mt-12 mb-4 tracking-tight" style={{ color: '#1A1A1A' }}>
    {children}
  </h2>
);

export const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-lg font-bold mt-8 mb-3" style={{ color: '#1A1A1A' }}>
    {children}
  </h3>
);

export const P = ({ children }: { children: React.ReactNode }) => (
  <p className="leading-relaxed mb-5 text-base" style={{ color: '#6B6B6B' }}>{children}</p>
);

export const UL = ({ children }: { children: React.ReactNode }) => (
  <ul className="space-y-2 mb-6 ml-4">{children}</ul>
);

export const LI = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start gap-2.5 text-base leading-relaxed" style={{ color: '#6B6B6B' }}>
    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#0F3CA5' }} />
    <span>{children}</span>
  </li>
);

export const Highlight = ({ children }: { children: React.ReactNode }) => (
  <div className="my-8 rounded-xl px-6 py-5" style={{ borderLeft: '4px solid #0F3CA5', background: '#E6EEF8' }}>
    <p className="leading-relaxed" style={{ color: '#1C2F45' }}>{children}</p>
  </div>
);

export const Stat = ({ value, label }: { value: string; label: string }) => (
  <div className="text-center p-5 rounded-xl" style={{ border: '0.5px solid rgba(0,0,0,0.10)', background: '#fff' }}>
    <div className="text-3xl font-black mb-1" style={{ color: '#0F3CA5' }}>
      {value}
    </div>
    <div className="text-sm" style={{ color: '#6B6B6B' }}>{label}</div>
  </div>
);

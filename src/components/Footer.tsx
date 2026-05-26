import { Link } from "react-router-dom";
import { Github, Twitter, Linkedin, Mail, MapPin, Phone } from "lucide-react";
import kodoLogo from "@/assets/kodo-logo.png";

const NAV_LINKS = [
  { label: "Início",        href: "/" },
  { label: "Recursos",      href: "/#recursos" },
  { label: "Como Funciona", href: "/#como-funciona" },
  { label: "FAQ",           href: "/#faq" },
];

const PRODUCT_LINKS = [
  { label: "Monitor com IA",  href: "/#recursos" },
  { label: "Auto-Healing",    href: "/#recursos" },
  { label: "Segurança",       href: "/#recursos" },
  { label: "FinOps",          href: "/#recursos" },
  { label: "Observabilidade", href: "/#recursos" },
];

const SOCIALS = [
  { icon: Github,   href: "https://github.com/kubenetworks-group", label: "GitHub" },
  { icon: Twitter,  href: "#", label: "Twitter" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
];

export const Footer = () => {
  return (
    <footer style={{ background: "linear-gradient(160deg, #0c1a3a 0%, #0d2151 60%, #0a1628 100%)" }}>
      {/* Top grid */}
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">

        {/* Col 1 — Brand */}
        <div className="space-y-5">
          <Link to="/" className="flex items-center gap-3">
            <img src={kodoLogo} alt="Kodo" className="w-8 h-8 object-contain" />
            <span className="text-white text-xl font-bold tracking-tight" style={{ fontFamily: "'Aileron', system-ui, sans-serif" }}>
              Kodo
            </span>
          </Link>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
            Plataforma Kubernetes com IA para monitorar, proteger e otimizar seus clusters automaticamente.
          </p>
          <div className="flex items-center gap-3 pt-1">
            {SOCIALS.map(({ icon: Icon, href, label }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}>
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>

        {/* Col 2 — Links Rápidos */}
        <div>
          <h4 className="text-white font-semibold text-sm mb-5 uppercase tracking-widest"
            style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px" }}>
            Links Rápidos
          </h4>
          <ul className="space-y-3">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={label}>
                <Link to={href}
                  className="text-sm transition-colors duration-200"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 3 — Produto */}
        <div>
          <h4 className="text-white font-semibold text-sm mb-5 uppercase tracking-widest"
            style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px" }}>
            Produto
          </h4>
          <ul className="space-y-3">
            {PRODUCT_LINKS.map(({ label, href }) => (
              <li key={label}>
                <Link to={href}
                  className="text-sm transition-colors duration-200"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 4 — Contato */}
        <div>
          <h4 className="text-white font-semibold text-sm mb-5 uppercase tracking-widest"
            style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px" }}>
            Contato
          </h4>
          <ul className="space-y-4">
            {[
              { icon: Mail,    text: "suporte@kubenetworks.com.br" },
              { icon: Phone,   text: "+55 11 98891-7172" },
              { icon: MapPin,  text: "São Paulo, SP — Brasil" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#22d3ee" }} />
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Divider */}
      <div className="max-w-7xl mx-auto px-6">
        <div style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />
      </div>

      {/* Bottom bar */}
      <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace" }}>
          © 2025 KubeNetworks. Todos os direitos reservados.
        </p>
        <div className="flex items-center gap-4">
          {["Privacidade", "Termos"].map(l => (
            <a key={l} href="#"
              className="text-xs transition-colors duration-200"
              style={{ color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}>
              {l}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
};

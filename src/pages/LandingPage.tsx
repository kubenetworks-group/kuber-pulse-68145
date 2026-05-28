import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";
import kodoLogo from "@/assets/kodo-logo.png";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  Shield, Zap, Brain, DollarSign, Activity, Wrench, ArrowRight, Check,
  Server, AlertTriangle, CheckCircle2, Menu, X, Upload,
} from "lucide-react";

/* ─── CSS ────────────────────────────────────────────────────────── */
const STYLES = `
  .klp { font-family: 'Aileron', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .klp-mono { font-family: 'DM Mono', monospace; }

  /* Hero layout */
  .kdo-hero {
    position: relative; overflow: hidden;
    background: transparent;
    min-height: 760px;
    padding-top: 96px; padding-bottom: 96px;
    padding-left: 64px; padding-right: 64px;
  }
  @media (max-width: 1024px) { .kdo-hero { padding-left: 32px; padding-right: 32px; } }
  @media (max-width: 640px)  { .kdo-hero { padding-left: 20px; padding-right: 20px; padding-top: 72px; padding-bottom: 72px; } }
  .kdo-hero-bg { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
  .kdo-hero-grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(to right, rgba(15,60,165,.06) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(15,60,165,.06) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 90%);
    -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 90%);
  }
  .kdo-hero-inner { position: relative; z-index: 2; width: 100%; max-width: 1440px; margin: 0 auto; }
  .kdo-spot {
    position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(circle 420px at var(--mx, 50%) var(--my, 40%), rgba(15,60,165,.10), transparent 70%);
    mix-blend-mode: multiply;
  }

  /* Typography helpers */
  .kdo-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 10px; font-weight: 600; letter-spacing: 0.14em;
    text-transform: uppercase; color: #0F3CA5;
  }
  .kdo-eyebrow::before { content: ""; width: 18px; height: 1px; background: #0F3CA5; }
  .kdo-h2 {
    font-family: 'Aileron', system-ui, sans-serif; font-weight: 900;
    font-size: clamp(36px, 4.2vw, 56px); letter-spacing: -0.03em;
    line-height: 1.02; color: #1A1A1A; margin: 18px 0 0 0;
    text-wrap: balance;
  }
  .kdo-sub {
    margin: 18px 0 0 0; font-size: 17px; line-height: 1.55;
    color: #6B6B6B; max-width: 620px;
  }
  .hl {
    background-image: linear-gradient(transparent 65%, rgba(15,60,165,.18) 65%);
    padding: 0 .08em;
  }

  /* Rise animation */
  @keyframes rise {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .rise  { animation: rise .8s cubic-bezier(.25,.46,.45,.94) both; }
  .d1    { animation-delay: .08s; }
  .d2    { animation-delay: .16s; }
  .d3    { animation-delay: .24s; }
  .d4    { animation-delay: .32s; }

  /* Float */
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-6px); }
  }

  /* Pulse ring (healing) */
  @keyframes pulse-ring {
    0%   { transform: scale(.6); opacity: .7; }
    100% { transform: scale(3.4); opacity: 0; }
  }

  /* Flow line */
  @keyframes line-flow { to { stroke-dashoffset: -16; } }
  .kdo-flow-line {
    stroke: rgba(15,60,165,.18); stroke-width: 1; fill: none;
    stroke-dasharray: 4 6; animation: line-flow 2.4s linear infinite;
  }

  /* Bar pulse (FinOps chart) */
  @keyframes bar {
    0%, 100% { transform: scaleY(.6); }
    50%      { transform: scaleY(1); }
  }

  /* Slide in (feed items) */
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .slide-in { animation: slideIn .35s cubic-bezier(.25,.46,.45,.94) both; }

  /* Live dot */
  @keyframes live-pulse {
    0%   { box-shadow: 0 0 0 0 rgba(22,163,74,.55); }
    100% { box-shadow: 0 0 0 10px rgba(22,163,74,0); }
  }
  .live-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 999px; background: #16A34A;
    animation: live-pulse 1.6s ease-out infinite;
  }

  /* 3D stage transitions */
  .kdo-stage { perspective: 1400px; perspective-origin: 50% 50%; position: relative; }
  .kdo-stage-inner { transform-style: preserve-3d; will-change: transform, opacity; backface-visibility: hidden; }
  @keyframes slide3dInFwd {
    0%   { opacity: 0; transform: translate3d(38%, 0, -260px) rotateY(28deg); }
    60%  { opacity: 1; }
    100% { opacity: 1; transform: translate3d(0, 0, 0) rotateY(0deg); }
  }
  @keyframes slide3dInBack {
    0%   { opacity: 0; transform: translate3d(-38%, 0, -260px) rotateY(-28deg); }
    60%  { opacity: 1; }
    100% { opacity: 1; transform: translate3d(0, 0, 0) rotateY(0deg); }
  }
  .kdo-slide-fwd  { animation: slide3dInFwd  640ms cubic-bezier(.2,.7,.2,1) both; }
  .kdo-slide-back { animation: slide3dInBack 640ms cubic-bezier(.2,.7,.2,1) both; }

  /* Marquee (integrations) */
  @keyframes kdo-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  .kdo-marquee { display: flex; gap: 48px; animation: kdo-scroll 28s linear infinite; align-items: center; white-space: nowrap; }
  .kdo-marquee:hover { animation-play-state: paused; }

  /* Ticker (integrations fallback) */
  @keyframes klp-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  .klp-ticker-wrap { overflow: hidden; }
  .klp-ticker-track { display: flex; width: max-content; animation: klp-ticker 28s linear infinite; }

  /* Orb animations (hero background) */
  @keyframes klp-orb-a {
    0%,100% { transform: translate(0,0) scale(1); }
    33% { transform: translate(60px,-40px) scale(1.1); }
    66% { transform: translate(-30px,50px) scale(0.95); }
  }
  @keyframes klp-orb-b {
    0%,100% { transform: translate(0,0) scale(1); }
    33% { transform: translate(-50px,30px) scale(1.05); }
    66% { transform: translate(40px,-50px) scale(1.1); }
  }
  @keyframes klp-orb-c {
    0%,100% { transform: translate(0,0); }
    50% { transform: translate(30px,35px) scale(1.08); }
  }

  /* Gradient shimmer text */
  @keyframes klp-shimmer { to { background-position: -200% center; } }
  .klp-grad-cyan {
    background: linear-gradient(120deg, #0F3CA5 0%, #577DB2 60%, #0F3CA5 120%);
    background-size: 200% auto;
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    animation: klp-shimmer 4s linear infinite;
  }

  /* Morphing word animations */
  @keyframes klp-word-in {
    from { opacity: 0; transform: translateY(18px) skewY(1deg); filter: blur(4px); }
    to { opacity: 1; transform: translateY(0) skewY(0); filter: blur(0); }
  }
  @keyframes klp-word-out {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-14px); }
  }
  .klp-word-in  { animation: klp-word-in  0.55s cubic-bezier(0.16,1,0.3,1) forwards; }
  .klp-word-out { animation: klp-word-out 0.3s ease-in forwards; }

  /* Rising particles */
  @keyframes klp-rise {
    0%   { transform: translateY(0) translateX(0);    opacity: 0; }
    8%   { opacity: var(--p-op); }
    92%  { opacity: var(--p-op); }
    100% { transform: translateY(-100vh) translateX(12px); opacity: 0; }
  }

  /* Scroll progress */
  .klp-progress {
    position: fixed; top: 0; left: 0; height: 2px; z-index: 9999;
    background: linear-gradient(90deg, #0F3CA5, #577DB2, #0F3CA5);
    background-size: 200% auto;
    animation: klp-shimmer 2s linear infinite;
    transition: width 0.1s linear;
    transform-origin: left;
    pointer-events: none;
  }

  /* Reveal on scroll */
  .klp-reveal {
    opacity: 0; transform: translateY(32px);
    transition: opacity 0.9s cubic-bezier(0.16,1,0.3,1), transform 0.9s cubic-bezier(0.16,1,0.3,1);
  }
  .klp-reveal.klp-in { opacity: 1; transform: translateY(0); }
  .klp-d1 { transition-delay: 0.07s; } .klp-d2 { transition-delay: 0.14s; }
  .klp-d3 { transition-delay: 0.21s; } .klp-d4 { transition-delay: 0.28s; }

  /* FAQ (details/summary styling) */
  .kdo-faq-item { border-bottom: 1px solid rgba(0,0,0,.07); padding: 22px 0; }
  .kdo-faq-summary {
    list-style: none; cursor: pointer; display: flex;
    align-items: center; justify-content: space-between; gap: 24px;
    font-size: 18px; font-weight: 600; color: #1A1A1A; letter-spacing: -0.01em;
  }
  .kdo-faq-summary::-webkit-details-marker { display: none; }
  .kdo-faq-plus {
    width: 28px; height: 28px; border-radius: 999px;
    background: #E6EEF8; color: #0F3CA5;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 700; transition: transform 240ms ease;
    flex-shrink: 0;
  }
  details[open] .kdo-faq-plus { transform: rotate(45deg); }
  .kdo-faq-answer { margin-top: 14px; color: #6B6B6B; font-size: 15px; line-height: 1.65; max-width: 760px; }
`;

/* ─── Primitive helpers ──────────────────────────────────────────── */
function Pill({
  tone = 'info',
  children,
  style,
}: {
  tone?: 'ok' | 'warn' | 'err' | 'info' | 'ink' | 'neutral';
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const palette = {
    ok:      { bg: '#DCFCE7', fg: '#14532D', dot: '#16A34A' },
    warn:    { bg: '#FEF9C3', fg: '#713F12', dot: '#CA8A04' },
    err:     { bg: '#FEE2E2', fg: '#7F1D1D', dot: '#DC2626' },
    info:    { bg: '#E6EEF8', fg: '#0F3CA5', dot: '#0F3CA5' },
    ink:     { bg: '#1A1A1A', fg: '#fff',    dot: '#fff'    },
    neutral: { bg: '#F0F4FA', fg: '#1A1A1A', dot: '#9B9B9B' },
  }[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 24, padding: '0 10px', borderRadius: 999,
      fontWeight: 600, fontSize: 11,
      background: palette.bg, color: palette.fg,
      ...style,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: palette.dot, flexShrink: 0 }} />
      {children}
    </span>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="kdo-eyebrow">{children}</span>;
}

/* ─── Hero Particles (rising dots — old background effect) ──────── */
function HeroParticles() {
  const particles = useMemo(() => Array.from({ length: 45 }, (_, i) => ({
    id: i,
    size: 2 + (i * 7919 % 4),
    left: (i * 2311 % 1000) / 10,
    duration: 18 + (i * 1733 % 20),
    delay: -(i * 1031 % 15),
    opacity: 0.18 + (i * 937 % 40) / 100,
  })), []);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {particles.map((p) => (
        <div key={p.id} style={{
          position: 'absolute',
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: '#0F3CA5',
          left: `${p.left}%`,
          top: '100%',
          boxShadow: `0 0 ${p.size + 2}px rgba(15,60,165,0.5)`,
          ['--p-op' as string]: p.opacity,
          animation: `klp-rise ${p.duration}s linear ${p.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

/* ─── HeroShowcase tab content ───────────────────────────────────── */
function ShowcaseOverview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { l: 'PODS',    v: '248',   t: '#1A1A1A' },
          { l: 'NODES',   v: '14',    t: '#1A1A1A' },
          { l: 'CPU',     v: '62%',   t: '#0F3CA5' },
          { l: 'CUSTO/D', v: 'R$ 41', t: '#16A34A' },
        ].map(s => (
          <div key={s.l} style={{ background: '#F0F4FA', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: '#6B6B6B' }}>{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.t, letterSpacing: '-0.02em', marginTop: 4 }}>{s.v}</div>
          </div>
        ))}
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>Tráfego · 24h</span>
          <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: '#6B6B6B' }}>12.4k req/s · p95 142ms</span>
        </div>
        <svg viewBox="0 0 320 100" style={{ width: '100%', height: 100 }}>
          <defs>
            <linearGradient id="hg2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0F3CA5" stopOpacity=".25" />
              <stop offset="100%" stopColor="#0F3CA5" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 78 L20 72 40 76 60 60 80 65 100 50 120 56 140 38 160 44 180 28 200 36 220 22 240 32 260 18 280 26 300 14 320 22 L320 100 0 100 Z" fill="url(#hg2)" />
          <path d="M0 78 L20 72 40 76 60 60 80 65 100 50 120 56 140 38 160 44 180 28 200 36 220 22 240 32 260 18 280 26 300 14 320 22"
            stroke="#0F3CA5" strokeWidth="2" fill="none" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { n: 'api-gateway',   ns: 'default',   s: 'ok'   },
          { n: 'payments-svc',  ns: 'billing',   s: 'ok'   },
          { n: 'analytics-job', ns: 'analytics', s: 'warn' },
          { n: 'auth-svc',      ns: 'identity',  s: 'ok'   },
        ].map(p => (
          <div key={p.n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#F0F4FA', borderRadius: 10 }}>
            <Server style={{ width: 14, height: 14, color: '#0F3CA5', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'DM Mono', fontSize: 11, color: '#1A1A1A', fontWeight: 500 }}>{p.n}</div>
              <div style={{ fontSize: 10, color: '#6B6B6B' }}>{p.ns}</div>
            </div>
            <Pill tone={p.s as 'ok' | 'warn'}>{p.s === 'ok' ? 'Saudável' : 'Atenção'}</Pill>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShowcaseHealing() {
  const events = [
    { t: '14:23:08', m: 'pod payments-7d4b reiniciado · 2.1s', tag: 'ok'   },
    { t: '14:21:54', m: 'OOMKill detectado · cap aumentado +256Mi',  tag: 'info' },
    { t: '14:18:30', m: 'liveness probe falhou · iniciando heal',  tag: 'warn' },
    { t: '14:14:02', m: 'rollout analytics-job concluído',           tag: 'ok'   },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: '#DCFCE7', border: '1px solid rgba(22,163,74,.20)', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 36, height: 36, borderRadius: 999, background: '#16A34A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Wrench style={{ width: 18, height: 18, color: '#fff' }} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#14532D' }}>3 incidentes curados sem você</div>
          <div style={{ fontSize: 12, color: '#14532D', opacity: .8 }}>Heal médio 2.4s · sem páginas durante o turno</div>
        </div>
        <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: '#14532D' }}>✓ today</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B6B6B' }}>
        Timeline · prod-us-east-1
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {events.map((e, i) => (
          <div key={i} className="slide-in" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
            background: '#fff', border: '1px solid rgba(0,0,0,.06)', borderRadius: 10,
            animationDelay: `${i * 80}ms`,
          }}>
            <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: '#6B6B6B', width: 64 }}>{e.t}</span>
            <Pill tone={e.tag as 'ok' | 'warn' | 'info'}>{e.tag.toUpperCase()}</Pill>
            <span style={{ fontSize: 12, color: '#1A1A1A', flex: 1 }}>{e.m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShowcaseFinops() {
  const rows = [
    { ns: 'analytics-eks',  c: 'R$ 2.820', d: '+18%',  t: 'warn'    },
    { ns: 'prod-us-east-1', c: 'R$ 1.240', d: '−12%',  t: 'ok'      },
    { ns: 'staging-eks',    c: 'R$ 380',   d: '+2%',   t: 'neutral'  },
    { ns: 'data-pipelines', c: 'R$ 690',   d: '−34%',  t: 'ok'       },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B6B6B' }}>Custo do mês · todos os clusters</div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', color: '#1A1A1A', marginTop: 4, lineHeight: 1 }}>R$ 5.130</div>
        </div>
        <Pill tone="ok">−34% vs. previsto</Pill>
      </div>
      <svg viewBox="0 0 320 90" style={{ width: '100%', height: 90 }}>
        {Array.from({ length: 20 }).map((_, i) => {
          const h = 18 + (Math.sin(i * 0.7) * 14 + Math.cos(i * 1.1) * 12 + i * 1.4);
          return <rect key={i} x={i * 16 + 2} y={90 - h} width="12" height={h} rx="2"
            fill={i > 14 ? '#0F3CA5' : 'rgba(15,60,165,.35)'}
            style={{ transformOrigin: `${i * 16 + 8}px 90px`, animation: `bar ${1.6 + (i % 4) * .2}s ease-in-out infinite`, animationDelay: `${i * 60}ms` }} />;
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(r => (
          <div key={r.ns} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#F0F4FA', borderRadius: 10 }}>
            <DollarSign style={{ width: 14, height: 14, color: '#0F3CA5', flexShrink: 0 }} />
            <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: '#1A1A1A', flex: 1 }}>{r.ns}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{r.c}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: r.t === 'ok' ? '#14532D' : r.t === 'warn' ? '#713F12' : '#6B6B6B', minWidth: 48, textAlign: 'right' }}>{r.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── HeroShowcase (floating white card with 3 tabs) ─────────────── */
function HeroShowcase() {
  const [tab, setTab] = useState(0);
  const [dir, setDir] = useState(1);

  useEffect(() => {
    const t = setInterval(() => {
      setDir(1);
      setTab(x => (x + 1) % 3);
    }, 5200);
    return () => clearInterval(t);
  }, []);

  const setTabManual = (i: number) => {
    setDir(i > tab ? 1 : -1);
    setTab(i);
  };

  const tabs = ['Visão geral', 'Auto-healing', 'FinOps'];
  const panels = [<ShowcaseOverview />, <ShowcaseHealing />, <ShowcaseFinops />];

  return (
    <div style={{
      position: 'relative', background: '#fff', borderRadius: 22,
      border: '1px solid rgba(0,0,0,.08)',
      boxShadow: '0 32px 80px rgba(15,60,165,.18), 0 8px 16px rgba(0,0,0,.05)',
      overflow: 'hidden',
      animation: 'float 6s ease-in-out infinite',
    }}>
      {/* Browser chrome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,.06)', background: '#FAFBFE' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map(c => <span key={c} style={{ width: 11, height: 11, borderRadius: 99, background: c }} />)}
        </div>
        <div style={{ flex: 1, height: 24, borderRadius: 6, background: '#fff', border: '1px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', fontFamily: 'DM Mono', fontSize: 11, color: '#6B6B6B' }}>
          <Server style={{ width: 11, height: 11, color: '#0F3CA5', flexShrink: 0 }} />
          app.kodo.io/<span style={{ color: '#1A1A1A' }}>clusters/prod-us-east-1</span>
        </div>
        <Pill tone="ok">Online</Pill>
      </div>

      {/* Tab strip */}
      <div style={{ display: 'flex', gap: 0, padding: '0 16px', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setTabManual(i)} style={{
            padding: '14px 14px', background: 'transparent', border: 'none',
            borderBottom: `2px solid ${tab === i ? '#0F3CA5' : 'transparent'}`,
            fontWeight: 600, fontSize: 13, color: tab === i ? '#1A1A1A' : '#6B6B6B',
            cursor: 'pointer', marginBottom: -1, transition: 'color 200ms', fontFamily: 'Aileron, sans-serif',
          }}>{t}</button>
        ))}
      </div>

      {/* 3D slide stage */}
      <div className="kdo-stage" style={{ padding: 22, minHeight: 360 }}>
        <div className={`kdo-stage-inner ${dir === 1 ? 'kdo-slide-fwd' : 'kdo-slide-back'}`} key={`${tab}-${dir}`}>
          {panels[tab]}
        </div>
      </div>
    </div>
  );
}

/* ─── Feature mini visuals (for the dark right-panel) ────────────── */
function HealMini() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[
        { t: '14:23:08', m: 'pod payments-7d4b reiniciado · 2.1s',  tag: 'OK'   },
        { t: '14:21:54', m: 'OOMKill detectado · cap +256Mi',        tag: 'INFO' },
        { t: '14:18:30', m: 'liveness falhou · iniciando heal',      tag: 'WARN' },
      ].map((e, i) => (
        <div key={i} className="slide-in" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '10px 12px',
          animationDelay: `${i * 120}ms`,
        }}>
          <span style={{ fontFamily: 'DM Mono', fontSize: 10, color: 'rgba(255,255,255,.5)', width: 60 }}>{e.t}</span>
          <span style={{ fontFamily: 'DM Mono', fontSize: 10, fontWeight: 600,
            color: e.tag === 'OK' ? '#86EFAC' : e.tag === 'WARN' ? '#FCD34D' : '#93C5FD',
            background: 'rgba(255,255,255,.06)', padding: '2px 6px', borderRadius: 4 }}>{e.tag}</span>
          <span style={{ fontSize: 12, color: '#fff', flex: 1, fontFamily: 'DM Mono' }}>{e.m}</span>
        </div>
      ))}
    </div>
  );
}

function FinMini() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }}>
        {Array.from({ length: 18 }).map((_, i) => {
          const h = 30 + Math.sin(i * .8) * 18 + i * 1.4;
          return (
            <span key={i} style={{
              flex: 1, height: `${h}%`, borderRadius: 4,
              background: i > 12 ? '#0F3CA5' : 'rgba(255,255,255,.18)',
              transformOrigin: 'bottom',
              animation: `bar ${1.4 + (i % 4) * .2}s ease-in-out infinite`,
              animationDelay: `${i * 60}ms`,
              display: 'block',
            }} />
          );
        })}
      </div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[['analytics-eks', 'R$ 2.820', '+18%'], ['prod-us-east-1', 'R$ 1.240', '−12%']].map(([n, v, d]) => (
          <div key={n} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: 10 }}>
            <div style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'rgba(255,255,255,.7)' }}>{n}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{v}</span>
              <span style={{ fontSize: 11, color: d.startsWith('−') ? '#86EFAC' : '#FCD34D' }}>{d}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecMini() {
  const rows = [
    { name: 'nginx:1.21.6',   sev: 'CRITICAL', n: 3, c: '#FCA5A5' },
    { name: 'redis:6.2',       sev: 'HIGH',     n: 1, c: '#FCD34D' },
    { name: 'node:18-alpine',  sev: 'CLEAN',    n: 0, c: '#86EFAC' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'rgba(255,255,255,.6)' }}>Scan · prod-us-east-1</span>
        <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'rgba(255,255,255,.6)' }}>há 4 min</span>
      </div>
      {rows.map(r => (
        <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '10px 12px' }}>
          <Shield style={{ width: 14, height: 14, color: r.c, flexShrink: 0 }} />
          <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: '#fff', flex: 1 }}>{r.name}</span>
          <span style={{ fontFamily: 'DM Mono', fontSize: 10, color: r.c, fontWeight: 700 }}>{r.sev}</span>
          <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'rgba(255,255,255,.6)', width: 20, textAlign: 'right' }}>{r.n}</span>
        </div>
      ))}
      <div style={{ padding: '10px 12px', background: 'rgba(22,163,74,.18)', border: '1px solid rgba(22,163,74,.35)', borderRadius: 10, fontSize: 12, color: '#86EFAC', fontFamily: 'DM Mono' }}>
        ✓ 4 imagens corrigidas automaticamente via PR
      </div>
    </div>
  );
}

function ObsMini() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <svg viewBox="0 0 320 100" style={{ width: '100%', height: 90 }}>
        <path d="M0 70 L40 64 80 70 120 50 160 56 200 36 240 44 280 26 320 32" stroke="#FCD34D" strokeWidth="1.5" fill="none" />
        <path d="M0 80 L40 76 80 78 120 70 160 68 200 60 240 58 280 50 320 48" stroke="#0F3CA5" strokeWidth="1.5" fill="none" />
        <path d="M0 90 L40 88 80 90 120 86 160 84 200 80 240 78 280 76 320 72" stroke="#86EFAC" strokeWidth="1.5" fill="none" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 11, fontFamily: 'DM Mono', color: 'rgba(255,255,255,.7)' }}>
        <span><span style={{ color: '#FCD34D' }}>●</span> p95 142ms</span>
        <span><span style={{ color: '#0F3CA5' }}>●</span> p50 38ms</span>
        <span><span style={{ color: '#86EFAC' }}>●</span> req/s 12.4k</span>
      </div>
      <div style={{ marginTop: 4, fontFamily: 'DM Mono', fontSize: 11, color: 'rgba(255,255,255,.85)', background: '#000', padding: 12, borderRadius: 8, lineHeight: 1.7 }}>
        <div style={{ color: '#6B7DAA' }}>$ kubectl top pods -n payments</div>
        <div style={{ color: '#fff' }}>NAME             CPU    MEM</div>
        <div style={{ color: '#fff' }}>api-gw-7d4b      <span style={{ color: '#86EFAC' }}>12m</span>   84Mi</div>
        <div style={{ color: '#fff' }}>worker-q9        <span style={{ color: '#FCD34D' }}>340m</span>  512Mi</div>
      </div>
    </div>
  );
}

/* ─── Feature Demo (dark right-panel) ───────────────────────────── */
function FeatureDemo({ pillar }: { pillar: typeof PILLARS[0] }) {
  const miniMap: Record<string, React.ReactNode> = {
    heal: <HealMini />, fin: <FinMini />, sec: <SecMini />, obs: <ObsMini />,
  };
  return (
    <div style={{
      background: '#0B1733', color: '#fff', borderRadius: 20,
      padding: 28, display: 'flex', flexDirection: 'column', gap: 18,
      border: '1px solid rgba(255,255,255,.08)', minHeight: 460,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pill tone="info" style={{ background: 'rgba(255,255,255,.10)', color: '#fff' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', animation: 'live-pulse 1.6s ease-out infinite' }} />
          LIVE · {pillar.label}
        </Pill>
        <span style={{ fontFamily: 'DM Mono', fontSize: 11, opacity: .6 }}>prod-us-east-1</span>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: .55 }}>{pillar.label}</div>
        <h3 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 1.1, color: '#fff' }}>{pillar.h}</h3>
        <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,.7)' }}>{pillar.sub}</p>
      </div>

      <div style={{ flex: 1, position: 'relative', marginTop: 6 }}>
        {miniMap[pillar.id]}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 16 }}>
        <div>
          <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff' }}>{pillar.stat}</div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', marginTop: 4 }}>{pillar.statL}</div>
        </div>
        <Link to="/auth">
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 18px',
            background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.18)',
            borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Aileron, sans-serif', transition: 'all 200ms ease',
          }}>
            Ver docs <ArrowRight style={{ width: 15, height: 15 }} />
          </button>
        </Link>
      </div>
    </div>
  );
}

/* ─── Data ───────────────────────────────────────────────────────── */
const MORPH_WORDS = ['monitora.', 'se cura.', 'economiza.', 'protege.'];

const PILLARS = [
  {
    id: 'heal', icon: Wrench, label: 'Auto-healing',
    h: 'Clusters se curam sozinhos.',
    sub: 'O agente IA identifica falhas — OOMKills, pods em CrashLoop, probes falhando — e aplica a correção antes do alerta sair.',
    stat: '2.4s', statL: 'Heal médio',
  },
  {
    id: 'fin', icon: DollarSign, label: 'FinOps',
    h: 'Custo claro. Decisões rápidas.',
    sub: 'Veja o gasto por namespace, time e workload. Recomendações de right-sizing aplicáveis em um clique.',
    stat: '−34%', statL: 'Redução média',
  },
  {
    id: 'sec', icon: Shield, label: 'Segurança',
    h: 'CVE, RBAC e secrets vigiados.',
    sub: 'Scan contínuo de imagens, políticas Kyverno/OPA prontas e alertas para drift de permissões em namespaces críticos.',
    stat: '14k+', statL: 'CVEs cobertos',
  },
  {
    id: 'obs', icon: Activity, label: 'Observabilidade',
    h: 'Métricas, logs e traces no mesmo lugar.',
    sub: 'Compatível com Prometheus, OpenTelemetry e Loki — sem precisar reescrever a stack que você já tem.',
    stat: '99.8%', statL: 'Uptime SLO',
  },
];

const HOW_STEPS = [
  { n: '01', t: 'Conecte seu cluster',          sub: 'Um único helm install. Multi-cloud, on-prem ou híbrido — o agente Kodo descobre nodes, pods e namespaces em 30 segundos.',                                              tag: 'helm install kodo/agent'  },
  { n: '02', t: 'O agente IA aprende a baseline', sub: 'Nas primeiras 48h, o Kodo observa tráfego, custo e padrões de incidente. Sem regras escritas à mão — você só ajusta o que faz sentido.',                              tag: 'baseline · 48h'           },
  { n: '03', t: 'Auto-healing começa a agir',    sub: 'OOMKills, probes em falha e drifts de config são corrigidos sozinhos. Você é notificado com o "antes/depois", nunca acordado às 3am.',                                 tag: 'heal médio 2.4s'          },
  { n: '04', t: 'FinOps vira rotina',             sub: 'Recomendações de right-sizing aparecem semanalmente, com PR pronto para abrir. Pague pelo que usa, prove pra finance.',                                               tag: '−34% custo médio'         },
];

const TOOLS = [
  'Prometheus', 'OpenTelemetry', 'Grafana', 'Helm', 'Slack',
  'PagerDuty', 'Datadog', 'New Relic', 'GitHub Actions', 'ArgoCD',
  'Nginx', 'Elastic', 'Redis', 'Terraform', 'Cloudflare',
];

const FAQS = [
  { q: 'O Kodo substitui Prometheus, Grafana ou Datadog?',     a: 'Não. O Kodo se conecta às ferramentas que você já usa. Lemos métricas de Prometheus/OpenTelemetry, deploys de Argo/Flux e alertas via Slack/PagerDuty. Pense no Kodo como uma camada de inteligência por cima da sua stack — não um substituto.' },
  { q: 'O que o agente IA realmente faz?',                     a: 'Detecta padrões de incidente (OOMKill, CrashLoopBackOff, liveness/readiness em falha, drift de config), correlaciona com tráfego e custo, e aplica correções pré-aprovadas pelo seu time. Você define o nível de autonomia.' },
  { q: 'Funciona em cluster on-premises?',                     a: 'Sim — o agente é stateless e roda em qualquer cluster K8s ≥ 1.24. Para ambientes air-gapped, o plano Enterprise inclui uma versão do control-plane self-hosted que conversa via mTLS, sem precisar de internet de saída.' },
  { q: 'Quais dados o Kodo guarda? E LGPD?',                   a: 'Metadados de cluster (nomes de pods, namespaces, métricas agregadas) e logs de incidentes. Nunca conteúdo de aplicação. Estamos em conformidade com LGPD e SOC2 Type II. DPA disponível para times Pro e Enterprise.' },
  { q: 'Posso desligar o auto-healing?',                       a: 'Sim, a qualquer momento, por cluster ou por namespace. O modo padrão é "sugerir e abrir PR" — você só liga aplicação direta quando confiar nas runbooks. Reverter um heal é um clique.' },
  { q: 'Quanto tempo leva para configurar?',                   a: 'Menos de 5 minutos. Basta instalar nosso agente usando kubectl ou Helm e conectar ao painel.' },
];

/* ─── Hooks ─────────────────────────────────────────────────────── */
const useInView = (threshold = 0.12) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
};

/* ─── Main Component ─────────────────────────────────────────────── */
export default function LandingPage() {
  const abVariant = (new URLSearchParams(window.location.search).get('variant') as 'a' | 'b' | 'c') ?? 'a';

  const [menuOpen,      setMenuOpen]      = useState(false);
  const [scrolled,      setScrolled]      = useState(false);
  const [scrollPct,     setScrollPct]     = useState(0);
  const [activePillar,  setActivePillar]  = useState(0);
  const [morphIdx,      setMorphIdx]      = useState(0);
  const [morphState,    setMorphState]    = useState<'in' | 'out'>('in');

  const heroRef = useRef<HTMLElement>(null);
  const orbARef = useRef<HTMLDivElement>(null);
  const orbBRef = useRef<HTMLDivElement>(null);
  const { ref: stepsRef,  inView: stepsIn  } = useInView();
  const { ref: featRef,   inView: featIn   } = useInView();
  const { ref: ctaRef,    inView: ctaIn    } = useInView();

  // Inject CSS
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'kodo-lp-css';
    style.textContent = STYLES;
    document.head.appendChild(style);
    return () => { document.getElementById('kodo-lp-css')?.remove(); };
  }, []);

  // Scroll handler
  useEffect(() => {
    const onScroll = () => {
      const y    = window.scrollY;
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(y > 24);
      setScrollPct(docH > 0 ? (y / docH) * 100 : 0);
      if (orbARef.current) orbARef.current.style.transform = `translateY(${y * 0.25}px)`;
      if (orbBRef.current) orbBRef.current.style.transform = `translateY(${y * -0.15}px)`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Morphing word
  useEffect(() => {
    const t = setInterval(() => {
      setMorphState('out');
      setTimeout(() => {
        setMorphIdx(i => (i + 1) % MORPH_WORDS.length);
        setMorphState('in');
      }, 320);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  // Hero cursor spotlight
  useEffect(() => {
    const el = heroRef.current; if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div className="klp" style={{ background: '#ffffff', color: '#1A1A1A', overflowX: 'hidden' }}>
      {/* Fixed animated orbs — appear through all sections */}
      <div style={{ position: 'fixed', inset: 0, zIndex: -10, overflow: 'hidden', pointerEvents: 'none' }}>
        <div ref={orbARef} style={{
          position: 'absolute', width: 700, height: 700, borderRadius: '50%',
          opacity: 0.07, filter: 'blur(140px)', top: -150, left: '5%',
          background: 'radial-gradient(circle, #0F3CA5, transparent 70%)',
          animation: 'klp-orb-a 20s ease-in-out infinite',
        }} />
        <div ref={orbBRef} style={{
          position: 'absolute', width: 500, height: 500, borderRadius: '50%',
          opacity: 0.06, filter: 'blur(120px)', top: '20%', right: 0,
          background: 'radial-gradient(circle, #283D63, transparent 70%)',
          animation: 'klp-orb-b 25s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          opacity: 0.05, filter: 'blur(100px)', bottom: '5%', left: '25%',
          background: 'radial-gradient(circle, #0F3CA5, transparent 70%)',
          animation: 'klp-orb-c 18s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.018,
          backgroundImage: 'linear-gradient(rgba(0,0,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }} />
      </div>

      <SEO
        title="Kodo — Kubernetes sob controle. Sem ruído."
        description="Monitore, corrija e otimize seus clusters K8s com um agente de IA dedicado. Auto-healing, FinOps e segurança — em uma plataforma que fala a língua do operador."
        path="/"
      />

      {/* ── Scroll progress ── */}
      <div className="klp-progress" style={{ width: `${scrollPct}%` }} />

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 transition-all duration-300"
        style={scrolled
          ? { background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(15,60,165,.1)' }
          : { background: 'transparent' }}>
        <nav style={{ maxWidth: 1440, margin: '0 auto', padding: '0 64px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={kodoLogo} alt="Kodo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            <span style={{ fontFamily: 'Aileron, sans-serif', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#1A1A1A' }}>Kodo</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center" style={{ gap: 36 }}>
            {[{ label: 'Produto', href: '#produto' }, { label: 'Como Funciona', href: '#como' }, { label: 'Integrações', href: '#integracoes' }, { label: 'Preços', href: '/plans' }, { label: 'FAQ', href: '#faq' }]
              .map(({ label, href }) =>
                href.startsWith('/') ? (
                  <Link key={label} to={href} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6B6B6B', fontWeight: 500 }} className="hover:text-slate-900 transition-colors">
                    {label}
                  </Link>
                ) : (
                  <a key={label} href={href} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6B6B6B', fontWeight: 500 }} className="hover:text-slate-900 transition-colors">
                    {label}
                  </a>
                )
              )}
          </div>

          <div className="hidden md:flex items-center" style={{ gap: 10 }}>
            <Link to="/auth">
              <button style={{ height: 38, padding: '0 18px', background: '#fff', border: '1px solid rgba(0,0,0,.14)', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#1A1A1A', cursor: 'pointer', fontFamily: 'Aileron, sans-serif' }}>
                Entrar
              </button>
            </Link>
            <Link to="/diagnostico">
              <button style={{ height: 38, padding: '0 18px', background: '#0F3CA5', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'Aileron, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
                Solicitar demo <ArrowRight style={{ width: 14, height: 14 }} />
              </button>
            </Link>
          </div>

          {/* Mobile burger */}
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1A1A1A' }}>
            {menuOpen ? <X style={{ width: 22, height: 22 }} /> : <Menu style={{ width: 22, height: 22 }} />}
          </button>
        </nav>

        {menuOpen && (
          <div style={{ borderTop: '1px solid rgba(0,0,0,.08)', padding: '20px 24px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {['Produto', 'Como Funciona', 'Preços', 'FAQ'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`}
                style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6B6B6B' }}
                onClick={() => setMenuOpen(false)}>{item}</a>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
              <Link to="/auth" onClick={() => setMenuOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">Entrar</Button>
              </Link>
              <Link to="/diagnostico" onClick={() => setMenuOpen(false)}>
                <Button size="sm" className="w-full text-white" style={{ background: '#0F3CA5' }}>Solicitar demo</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ══════════════════ HERO ══════════════════ */}
        <section id="produto" ref={heroRef as React.RefObject<HTMLElement>} className="kdo-hero">
          <HeroParticles />
          <div className="kdo-spot" />

          <div className="kdo-hero-inner" style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 64, alignItems: 'center' }}>
            {/* Left */}
            <div>
              <div className="rise">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 32, padding: '0 14px', borderRadius: 999, background: 'rgba(255,255,255,.7)', border: '1px solid rgba(15,60,165,.18)', color: '#0F3CA5', fontSize: 12, fontWeight: 600, backdropFilter: 'blur(6px)' }}>
                  <span className="live-dot" />
                  Agora com agente SRE em IA
                  <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: '#6B6B6B' }}>v2.0</span>
                </span>
              </div>

              <h1 className="rise d1" style={{ margin: '24px 0 0', fontFamily: 'Aileron, sans-serif', fontWeight: 900, fontSize: 'clamp(2.6rem, 4.5vw, 4.5rem)', lineHeight: 1.05, letterSpacing: '-0.035em', color: '#1A1A1A' }}>
                Kubernetes que
                <br />
                <span style={{ overflow: 'hidden', display: 'inline-block', verticalAlign: 'bottom' }}>
                  <span
                    key={`${morphIdx}-${morphState}`}
                    className={`inline-block klp-grad-cyan ${morphState === 'in' ? 'klp-word-in' : 'klp-word-out'}`}
                  >
                    {MORPH_WORDS[morphIdx]}
                  </span>
                </span>
                <br />
                <span style={{ color: '#1a1a1a' }}>sozinho.</span>
              </h1>

              <p className="rise d2" style={{ margin: '24px 0 0', maxWidth: 540, fontSize: 18, lineHeight: 1.55, color: '#1A1A1A' }}>
                Monitore, corrija e otimize seus clusters K8s com um agente de IA dedicado.
                Auto-healing, FinOps e segurança — em uma plataforma que fala a língua do operador.
              </p>

              <div className="rise d3" style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link to="/diagnostico">
                  <button
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 48, padding: '0 22px', background: '#0F3CA5', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Aileron, sans-serif', boxShadow: '0 1px 2px rgba(15,60,165,.18)' }}
                    onClick={() => (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.('event', 'hero_cta_click', { ab_variant: abVariant })}>
                    Começar grátis <ArrowRight style={{ width: 15, height: 15 }} />
                  </button>
                </Link>
                <Link to="/diagnostico">
                  <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 48, padding: '0 22px', background: '#fff', color: '#1A1A1A', border: '1px solid rgba(0,0,0,.14)', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Aileron, sans-serif' }}>
                    <Upload style={{ width: 15, height: 15 }} /> Ver demo de 2 min
                  </button>
                </Link>
              </div>

              {/* Social proof */}
              <div className="rise d4" style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex' }}>
                  {[
                    { label: 'K8', bg: '#E6EEF8', fg: '#0F3CA5' },
                    { label: 'D',  bg: '#1A1A1A', fg: '#FFFFFF' },
                    { label: 'C',  bg: '#577DB2', fg: '#FFFFFF' },
                    { label: '+',  bg: '#fff',    fg: '#0F3CA5' },
                  ].map((a, i) => (
                    <span key={i} style={{
                      width: 36, height: 36, borderRadius: '50%', background: a.bg, color: a.fg,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Aileron, sans-serif', fontWeight: 800, fontSize: 11,
                      border: i === 3 ? '2px solid #0F3CA5' : '2px solid #fff',
                      marginLeft: i === 0 ? 0 : -10,
                    }}>
                      {a.label}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: '#0F3CA5', fontSize: 14, letterSpacing: 1 }}>★★★★★ <span style={{ color: '#1A1A1A', fontWeight: 600 }}>4.9</span></span>
                  <span style={{ fontSize: 13, color: '#6B6B6B' }}>+500 times de engenharia · G2 High Performer</span>
                </div>
              </div>
            </div>

            {/* Right — showcase card */}
            <div>
              <HeroShowcase />
            </div>
          </div>

          {/* Stats strip */}
          <div className="kdo-hero-inner" style={{ marginTop: 72 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 0,
              borderTop: '1px solid #E8EDF5',
              borderBottom: '1px solid #E8EDF5',
              padding: '32px 0',
            }}>
              {[
                { value: '5 min',   label: 'para instalar o agente',    sub: 'um único helm install' },
                { value: '30s',     label: 'tempo médio de resposta',   sub: 'auto-healing ativo' },
                { value: '40%',     label: 'redução de custo de infra', sub: 'média entre clientes' },
                { value: '99.9%',   label: 'uptime médio dos clusters', sub: 'com SLA garantido' },
              ].map((s, i) => (
                <div key={i} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                  padding: '0 24px',
                  borderRight: i < 3 ? '1px solid #E8EDF5' : 'none',
                }}>
                  <span style={{ fontFamily: 'Aileron, sans-serif', fontWeight: 900, fontSize: 36, color: '#0F3CA5', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {s.value}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginTop: 8 }}>{s.label}</span>
                  <span style={{ fontSize: 12, color: '#6B6B6B', marginTop: 2 }}>{s.sub}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Logo strip — TODO: implementar com logos reais dos clientes
          <div className="kdo-hero-inner" style={{ marginTop: 88 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6B6B6B', marginBottom: 18, textAlign: 'center' }}>
              Times que confiam no Kodo
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: 32, opacity: .85, flexWrap: 'wrap' }}>
              {['NUBANK', 'ITAÚ', 'XP', 'MOVILE', 'iFOOD', 'PICPAY', 'MERCADO LIVRE', 'C6 BANK'].map(n => (
                <span key={n} style={{ fontFamily: 'Aileron, sans-serif', fontWeight: 900, fontSize: 18, letterSpacing: '0.06em', color: '#6B6B6B' }}>{n}</span>
              ))}
            </div>
          </div>
          */}
        </section>

        {/* ══════════════════ FEATURES ══════════════════ */}
        <section id="features" style={{ background: '#fff', padding: '120px 64px' }}>
          <div style={{ maxWidth: 1440, margin: '0 auto' }}>
            <Eyebrow>Os quatro pilares</Eyebrow>
            <h2 className="kdo-h2">Tudo que um time de SRE precisa.<br /><span style={{ color: '#6B6B6B' }}>Nada do que não precisa.</span></h2>
            <p className="kdo-sub">Quatro produtos integrados, uma única conta. Você ativa o que faz sentido para o seu cluster e desliga o resto.</p>

            <div ref={featRef} style={{ marginTop: 48, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'stretch' }}>
              {/* Tab list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PILLARS.map((p, i) => {
                  const isActive = activePillar === i;
                  return (
                    <button key={p.id} onClick={() => setActivePillar(i)} style={{
                      textAlign: 'left', background: isActive ? '#0F3CA5' : '#fff',
                      color: isActive ? '#fff' : '#1A1A1A',
                      border: `1px solid ${isActive ? '#0F3CA5' : 'rgba(0,0,0,.08)'}`,
                      borderRadius: 16, padding: '20px 22px', cursor: 'pointer',
                      transition: 'all 200ms cubic-bezier(.2,.7,.2,1)',
                      display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 16, alignItems: 'center',
                    }}>
                      <span style={{ width: 40, height: 40, borderRadius: 12, background: isActive ? 'rgba(255,255,255,.12)' : '#E6EEF8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <p.icon style={{ width: 20, height: 20, color: isActive ? '#fff' : '#0F3CA5' }} />
                      </span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: isActive ? .85 : .6 }}>{p.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2 }}>{p.h}</div>
                      </div>
                      <ArrowRight style={{ width: 18, height: 18, color: isActive ? '#fff' : '#6B6B6B' }} />
                    </button>
                  );
                })}
              </div>

              {/* Active demo panel */}
              <FeatureDemo pillar={PILLARS[activePillar]} />
            </div>
          </div>
        </section>

        {/* ══════════════════ HOW IT WORKS ══════════════════ */}
        <section id="como" style={{ background: '#F0F4FA', padding: '120px 64px', position: 'relative' }}>
          <div style={{ maxWidth: 1440, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 64, alignItems: 'start' }}>
              {/* Sticky left */}
              <div style={{ position: 'sticky', top: 100 }}>
                <Eyebrow>Como funciona</Eyebrow>
                <h2 className="kdo-h2">Do zero ao auto-healing.<br /><span style={{ color: '#0F3CA5' }}>Em menos de uma tarde.</span></h2>
                <p className="kdo-sub">Sem ETL, sem reescrita de stack. O agente Kodo se instala como qualquer Helm chart e começa a entregar valor antes do café esfriar.</p>
                <div style={{ marginTop: 28, display: 'flex', gap: 12 }}>
                  <Link to="/diagnostico">
                    <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 48, padding: '0 22px', background: '#0F3CA5', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Aileron, sans-serif' }}>
                      Ver guia de instalação <ArrowRight style={{ width: 15, height: 15 }} />
                    </button>
                  </Link>
                </div>
              </div>

              {/* Steps */}
              <div ref={stepsRef}>
                {HOW_STEPS.map((s, i) => (
                  <div key={s.n} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 24, paddingBottom: 32, position: 'relative' }}>
                    {i < HOW_STEPS.length - 1 && (
                      <span style={{ position: 'absolute', top: 56, bottom: 0, left: 31, width: 1, background: 'rgba(15,60,165,.18)' }} />
                    )}
                    <div className={`klp-reveal klp-d${i + 1} ${stepsIn ? 'klp-in' : ''}`} style={{ width: 64, height: 64, borderRadius: 18, background: '#fff', border: '1px solid rgba(0,0,0,.08)', boxShadow: '0 1px 2px rgba(15,60,165,.05)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Aileron, sans-serif', fontWeight: 900, fontSize: 22, color: '#0F3CA5', letterSpacing: '-0.02em' }}>
                      {s.n}
                    </div>
                    <div className={`klp-reveal klp-d${i + 1} ${stepsIn ? 'klp-in' : ''}`} style={{ paddingTop: 6 }}>
                      <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.025em', color: '#1A1A1A' }}>{s.t}</h3>
                      <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.6, color: '#6B6B6B', maxWidth: 540 }}>{s.sub}</p>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '6px 10px', background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 8, fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#1A1A1A' }}>
                        <span style={{ width: 6, height: 6, borderRadius: 99, background: '#0F3CA5' }} />
                        {s.tag}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════ INTEGRATIONS ══════════════════ */}
        <section id="integracoes" style={{ background: '#fff', padding: '120px 64px' }}>
          <div style={{ maxWidth: 1440, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'end' }}>
              <div>
                <Eyebrow>Integrações</Eyebrow>
                <h2 className="kdo-h2">Funciona com o que você já tem.</h2>
              </div>
              <p className="kdo-sub" style={{ margin: 0 }}>
                Suporte first-class para os três grandes clouds e dezenas de ferramentas do ecossistema CNCF.
                Se já existe um operator Kubernetes, o Kodo provavelmente já fala com ele.
              </p>
            </div>

            {/* Cloud cards */}
            <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { id: 'aws',   name: 'Amazon EKS', sub: 'us-east-1 · sa-east-1 · multi-AZ',    abbr: 'AWS'   },
                { id: 'gcp',   name: 'Google GKE', sub: 'Autopilot · Standard · multi-region', abbr: 'GCP'   },
                { id: 'azure', name: 'Azure AKS',  sub: 'BR-South · East-US · híbrido',         abbr: 'AZ'    },
              ].map((c) => (
                <div key={c.id} style={{
                  background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 18, padding: 24,
                  display: 'flex', flexDirection: 'column', gap: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: '#E6EEF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Aileron, sans-serif', fontWeight: 900, fontSize: 14, color: '#0F3CA5' }}>
                      {c.abbr}
                    </div>
                    <Pill tone="ok">Certificado</Pill>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em', color: '#1A1A1A' }}>{c.name}</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#6B6B6B', marginTop: 4 }}>{c.sub}</div>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid rgba(0,0,0,.06)' }}>
                    <span style={{ fontSize: 12, color: '#6B6B6B' }}>Conectar em ~30s</span>
                    <ArrowRight style={{ width: 16, height: 16, color: '#0F3CA5' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Tools marquee */}
            <div style={{ marginTop: 32, background: '#F0F4FA', borderRadius: 24, padding: 32, border: '1px solid rgba(0,0,0,.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 32, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#0F3CA5' }}>+ 60 ferramentas</div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em', marginTop: 4, color: '#1A1A1A' }}>Ecossistema CNCF nativo</div>
                  <div style={{ fontSize: 14, color: '#6B6B6B', marginTop: 6, maxWidth: 280 }}>Métricas, alertas, deploys, segurança — tudo bidirecional, sem proxies.</div>
                </div>
                <div style={{ overflow: 'hidden', maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}>
                  <div className="kdo-marquee">
                    {[...TOOLS, ...TOOLS].map((t, i) => (
                      <span key={i} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 10,
                        height: 44, padding: '0 18px 0 14px', background: '#fff', borderRadius: 999,
                        border: '1px solid rgba(0,0,0,.08)', fontFamily: 'Aileron, sans-serif',
                        fontWeight: 700, fontSize: 14, color: '#1A1A1A', letterSpacing: '-0.01em',
                      }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0F3CA5', flexShrink: 0 }} />
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════ LEAD CAPTURE ══════════════════ */}
        <section style={{ background: '#F0F4FA', padding: '120px 64px', borderTop: '1px solid rgba(0,0,0,.06)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <Eyebrow>Diagnóstico gratuito</Eyebrow>
                <h2 style={{ fontFamily: 'Aileron, sans-serif', fontWeight: 900, fontSize: 'clamp(28px, 3vw, 42px)', letterSpacing: '-0.025em', lineHeight: 1.05, color: '#1A1A1A', margin: 0 }}>
                  Descubra quanto você pode economizar no seu cluster
                </h2>
                <p style={{ fontSize: 16, lineHeight: 1.55, color: '#6B6B6B', margin: 0 }}>
                  Informe seu email e nossa equipe envia uma análise personalizada com potencial de economia e riscos de segurança — sem instalar nada.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {['Análise de custo e recursos subutilizados', 'Mapa de riscos de segurança (RBAC, Pod Security)', 'Estimativa de economia mensal'].map(item => (
                    <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ marginTop: 2, width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(22,163,74,.08)', border: '1px solid rgba(22,163,74,.2)' }}>
                        <Check style={{ width: 12, height: 12, color: '#16A34A' }} />
                      </div>
                      <span style={{ fontSize: 14, color: '#1A1A1A' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: 22, padding: 32, border: '1px solid rgba(0,0,0,.08)', boxShadow: '0 1px 2px rgba(15,60,165,.05)' }}>
                <LeadCaptureForm variant={abVariant} />
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════ FAQ ══════════════════ */}
        <section id="faq" style={{ background: '#fff', padding: '120px 64px' }}>
          <div style={{ maxWidth: 1440, margin: '0 auto' }}>
            <div className="kdo-faq" style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 80, alignItems: 'start' }}>
              <div style={{ position: 'sticky', top: 100 }}>
                <Eyebrow>FAQ</Eyebrow>
                <h2 className="kdo-h2">Perguntas que você ia fazer mesmo.</h2>
                <p className="kdo-sub">Se não respondemos aqui, mande um e-mail — geralmente um engenheiro responde no mesmo dia.</p>
                <div style={{ marginTop: 24 }}>
                  <a href="mailto:contato@kubenetworks.com.br">
                    <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 18px', background: '#fff', border: '1px solid rgba(0,0,0,.14)', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#1A1A1A', cursor: 'pointer', fontFamily: 'Aileron, sans-serif' }}>
                      contato@kubenetworks.com.br
                    </button>
                  </a>
                </div>
              </div>
              <div>
                {FAQS.map((item, i) => (
                  <details key={i} open={i === 0}>
                    <summary className="kdo-faq-summary">
                      {item.q}
                      <span className="kdo-faq-plus">+</span>
                    </summary>
                    <div className="kdo-faq-answer">{item.a}</div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════ FINAL CTA ══════════════════ */}
        <section style={{ background: '#F0F4FA', padding: '40px 64px 120px' }}>
          <div ref={ctaRef} style={{ maxWidth: 1440, margin: '0 auto' }}>
            <div className={`klp-reveal ${ctaIn ? 'klp-in' : ''}`} style={{
              background: '#1A1A1A', color: '#fff', borderRadius: 28,
              padding: '72px 64px', position: 'relative', overflow: 'hidden',
            }}>
              {/* Grid decoration */}
              <svg style={{ position: 'absolute', inset: 0, opacity: .12, pointerEvents: 'none' }} width="100%" height="100%">
                <defs>
                  <pattern id="grid2" width="48" height="48" patternUnits="userSpaceOnUse">
                    <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#fff" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid2)" />
              </svg>

              <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 48, alignItems: 'center' }}>
                <div>
                  <Pill tone="info" style={{ background: 'rgba(255,255,255,.10)', color: '#fff' }}>
                    <span className="live-dot" />
                    Onboarding em ~30 minutos
                  </Pill>
                  <h2 style={{ margin: '20px 0 0', fontFamily: 'Aileron, sans-serif', fontWeight: 900, fontSize: 'clamp(40px, 4.4vw, 64px)', letterSpacing: '-0.035em', lineHeight: 1, color: '#fff' }}>
                    Comece a curar seus clusters <span style={{ color: '#86A8FF' }}>hoje à tarde.</span>
                  </h2>
                  <p style={{ marginTop: 18, fontSize: 17, lineHeight: 1.5, color: 'rgba(255,255,255,.7)', maxWidth: 520 }}>
                    14 dias do plano Pro, sem cartão. Se o auto-healing não economizar mais que o preço do plano no primeiro mês, devolvemos.
                  </p>
                  <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Link to="/auth">
                      <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 48, padding: '0 22px', background: '#fff', color: '#0F3CA5', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Aileron, sans-serif' }}>
                        Começar grátis <ArrowRight style={{ width: 15, height: 15 }} />
                      </button>
                    </Link>
                    <Link to="/diagnostico">
                      <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 48, padding: '0 22px', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.25)', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Aileron, sans-serif' }}>
                        <Upload style={{ width: 15, height: 15 }} /> Agendar demo
                      </button>
                    </Link>
                  </div>
                </div>

                {/* Helm code snippet */}
                <div style={{ background: '#0B1733', borderRadius: 16, padding: 20, border: '1px solid rgba(255,255,255,.08)', fontFamily: 'DM Mono, monospace', fontSize: 13, lineHeight: 1.8 }}>
                  <div style={{ color: '#6B7DAA', marginBottom: 6 }}># instalar o agente Kodo</div>
                  <div style={{ color: '#fff' }}>$ helm repo add kodo <span style={{ color: '#86A8FF' }}>https://charts.kodo.dev</span></div>
                  <div style={{ color: '#fff' }}>$ helm install kodo-agent kodo/agent \</div>
                  <div style={{ color: '#fff' }}>&nbsp;&nbsp;--namespace kodo --create-namespace</div>
                  <div style={{ color: '#6B7DAA', marginTop: 14 }}># 1 min depois...</div>
                  <div style={{ color: '#86EFAC' }}>✓ agente conectado · 14 nodes · 248 pods</div>
                  <div style={{ color: '#86EFAC' }}>✓ baseline iniciada · ETA 48h</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

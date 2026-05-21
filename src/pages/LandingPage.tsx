import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";
import kodoLogo from "@/assets/kodo-logo.png";
import { useEffect, useState, useRef } from "react";
import {
  Shield, Zap, Brain, DollarSign, Activity, Wrench, ArrowRight, Check,
  Server, LineChart, BellRing, Upload, Settings, Cpu, AlertTriangle,
  CheckCircle2, Menu, X, Terminal,
} from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

/* ─── CSS Injection ─────────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Nunito+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap');

  .klp { font-family: 'Nunito Sans', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
  .klp-syne { font-family: 'Nunito', sans-serif; letter-spacing: -0.02em; }
  .klp-mono { font-family: 'JetBrains Mono', monospace; }

  .klp-grad-cyan {
    background: linear-gradient(120deg, #22d3ee 0%, #818cf8 60%, #22d3ee 120%);
    background-size: 200% auto;
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    animation: klp-shimmer 4s linear infinite;
  }
  .klp-grad-emerald {
    background: linear-gradient(120deg, #34d399, #22d3ee);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }

  @keyframes klp-shimmer { to { background-position: -200% center; } }
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
  @keyframes klp-word-in {
    from { opacity: 0; transform: translateY(18px) skewY(1deg); filter: blur(4px); }
    to { opacity: 1; transform: translateY(0) skewY(0); filter: blur(0); }
  }
  @keyframes klp-word-out {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-14px); }
  }
  @keyframes klp-fade-up {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes klp-ticker {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }
  @keyframes klp-bar-in {
    from { transform: scaleY(0); }
    to { transform: scaleY(1); }
  }
  @keyframes klp-pulse-ring {
    0% { transform: scale(1); opacity: 0.6; }
    100% { transform: scale(2.8); opacity: 0; }
  }
  @keyframes klp-blink {
    0%,100% { opacity: 1; } 50% { opacity: 0; }
  }
  @keyframes klp-float {
    0%,100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  @keyframes klp-stat-pop {
    0%   { opacity: 0; transform: translateY(16px) scale(0.88); }
    65%  { transform: translateY(-2px) scale(1.03); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes klp-scan {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(500%); }
  }
  @keyframes klp-grid-breathe {
    0%, 100% { opacity: 0.5; }
    50%       { opacity: 1; }
  }
  @keyframes klp-ring-out {
    0%   { transform: scale(0.6); opacity: 0.5; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  @keyframes klp-flow-dot {
    0%   { left: -8px;   opacity: 0; }
    8%   { opacity: 1; }
    92%  { opacity: 1; }
    100% { left: calc(100% + 8px); opacity: 0; }
  }
  @keyframes klp-flow-dot-v {
    0%   { top: -8px;   opacity: 0; }
    8%   { opacity: 1; }
    92%  { opacity: 1; }
    100% { top: calc(100% + 8px); opacity: 0; }
  }

  .klp-word-in { animation: klp-word-in 0.55s cubic-bezier(0.16,1,0.3,1) forwards; }
  .klp-word-out { animation: klp-word-out 0.3s ease-in forwards; }
  .klp-bar { transform-origin: bottom; animation: klp-bar-in 0.9s cubic-bezier(0.34,1.56,0.64,1) both; }
  .klp-float { animation: klp-float 4s ease-in-out infinite; }
  .klp-blink { animation: klp-blink 1s step-end infinite; }

  .klp-reveal {
    opacity: 0;
    transform: translateY(32px);
    clip-path: inset(30px 0 0 0);
    transition: opacity 0.9s cubic-bezier(0.16,1,0.3,1), transform 0.9s cubic-bezier(0.16,1,0.3,1), clip-path 0.9s cubic-bezier(0.16,1,0.3,1);
  }
  .klp-reveal.klp-in { opacity: 1; transform: translateY(0); clip-path: inset(0px 0 0 0); }
  .klp-d1 { transition-delay: 0.07s; }
  .klp-d2 { transition-delay: 0.14s; }
  .klp-d3 { transition-delay: 0.21s; }
  .klp-d4 { transition-delay: 0.28s; }
  .klp-d5 { transition-delay: 0.35s; }
  .klp-d6 { transition-delay: 0.42s; }

  .klp-ticker-wrap { overflow: hidden; }
  .klp-ticker-track { display: flex; width: max-content; animation: klp-ticker 28s linear infinite; }
  .klp-ticker-track:hover { animation-play-state: paused; }

  .klp-card {
    position: relative; overflow: hidden;
    transition: border-color 0.35s ease, transform 0.35s ease, box-shadow 0.35s ease;
  }
  .klp-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(8,145,178,0.08); }
  .klp-card::after {
    content: ''; position: absolute; inset: 0; border-radius: inherit;
    background: radial-gradient(400px circle at var(--mx,50%) var(--my,50%), rgba(8,145,178,0.06), transparent 70%);
    opacity: 0; transition: opacity 0.4s ease; pointer-events: none;
  }
  .klp-card:hover::after { opacity: 1; }

  .klp-pulse::before {
    content: ''; position: absolute; inset: -3px; border-radius: 50%;
    background: inherit; animation: klp-pulse-ring 2.5s ease-out infinite;
  }

  .klp-dash-tilt { transition: transform 0.15s ease-out; }

  /* ── Scroll progress bar ── */
  .klp-progress {
    position: fixed; top: 0; left: 0; height: 2px; z-index: 9999;
    background: linear-gradient(90deg, #0891b2, #6366f1, #0891b2);
    background-size: 200% auto;
    animation: klp-shimmer 2s linear infinite;
    transition: width 0.1s linear;
    transform-origin: left;
    pointer-events: none;
  }

  /* ── Section dots ── */
  .klp-dots {
    position: fixed; right: 20px; top: 50%; transform: translateY(-50%);
    z-index: 100; display: flex; flex-direction: column; gap: 10px;
    pointer-events: none;
  }
  @media (max-width: 1023px) { .klp-dots { display: none; } }
  .klp-dot {
    width: 6px; height: 6px; border-radius: 9999px;
    background: #cbd5e1; transition: all 0.4s cubic-bezier(0.16,1,0.3,1);
    pointer-events: auto; cursor: pointer;
  }
  .klp-dot.klp-dot-active {
    background: #0891b2;
    height: 24px;
    box-shadow: 0 0 8px rgba(8,145,178,0.5);
  }


  .klp-section-num {
    position: absolute; font-family: 'Nunito', sans-serif; font-weight: 800;
    font-size: clamp(80px, 15vw, 160px); color: rgba(0,0,0,0.025);
    line-height: 1; pointer-events: none; user-select: none;
    top: -0.2em; left: -0.1em;
  }
`;

/* ─── StickyVisual (unused — kept for reference) ───────────────── */
const _StickyVisual_unused = ({ idx, accent }: { idx: number; accent: string }) => {
  const visuals = [
    /* 0 — Monitor com IA */
    <div className="w-full h-full flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <span className="klp-mono text-xs text-slate-400 uppercase tracking-widest">Anomalias · prod-cluster</span>
        <span className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca' }}>
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse inline-block" />2 alertas ativos
        </span>
      </div>
      <div className="flex-1 flex items-end gap-1 pb-2">
        {[28,32,35,29,38,34,31,36,33,37,82,95,88,74,42,36,31,35,30,28,32].map((h,i)=>(
          <div key={i} className="flex-1 rounded-t" style={{ height:`${h}%`,
            background: h>60 ? 'linear-gradient(to top,#ef4444,#fca5a5)' : `linear-gradient(to top,${accent},${accent}44)` }} />
        ))}
      </div>
      <div className="space-y-2">
        {[{msg:'CPU spike — api-gateway · 94%',c:'#ef4444',sev:'Alta'},{msg:'Latência elevada — redis-v2 · 320ms',c:'#f59e0b',sev:'Média'}].map(({msg,c,sev})=>(
          <div key={msg} className="flex items-center gap-3 px-4 py-3 rounded-xl border"
            style={{ background:`${c}08`, borderColor:`${c}25` }}>
            <AlertTriangle className="w-4 h-4 shrink-0" style={{color:c}} />
            <span className="text-sm text-slate-700 flex-1">{msg}</span>
            <span className="klp-mono text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background:`${c}15`, color:c }}>{sev}</span>
          </div>
        ))}
      </div>
    </div>,
    /* 1 — Auto-Healing */
    <div className="w-full h-full flex flex-col p-8">
      <div className="flex items-center justify-between mb-8">
        <span className="klp-mono text-xs text-slate-400 uppercase tracking-widest">Recovery Timeline</span>
        <span className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0' }}>
          <CheckCircle2 className="w-3.5 h-3.5" />Resolvido em 12s
        </span>
      </div>
      <div className="flex-1 relative pl-8">
        <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-100" />
        {[
          {t:'14:31:02',e:'CrashLoopBackOff detectado — api-v2',c:'#ef4444'},
          {t:'14:31:04',e:'IA classificou padrão de falha recorrente',c:'#f59e0b'},
          {t:'14:31:06',e:'Logs capturados automaticamente (200 linhas)',c:accent},
          {t:'14:31:09',e:'Reinicialização automática aplicada',c:accent},
          {t:'14:31:14',e:'Pod healthy — uptime restaurado ✓',c:'#16a34a'},
        ].map(({t,e,c},i)=>(
          <div key={i} className="flex items-start gap-4 mb-6 last:mb-0">
            <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1 -ml-[18px] ring-4 ring-white" style={{background:c}} />
            <div>
              <p className="klp-mono text-[10px] text-slate-400 mb-1">{t}</p>
              <p className="text-sm text-slate-700">{e}</p>
            </div>
          </div>
        ))}
      </div>
    </div>,
    /* 2 — Segurança */
    <div className="w-full h-full flex flex-col p-8">
      <div className="flex items-center justify-between mb-6">
        <span className="klp-mono text-xs text-slate-400 uppercase tracking-widest">Security Scan · prod-cluster</span>
        <span className="klp-mono text-xs px-3 py-1.5 rounded-full"
          style={{ background:`${accent}12`, color:accent, border:`1px solid ${accent}30` }}>4 findings</span>
      </div>
      <div className="flex-1 space-y-3">
        {[
          {sev:'CRITICAL',msg:'Container rodando como root',c:'#ef4444'},
          {sev:'HIGH',msg:'RBAC excessivo — cluster-admin binding',c:accent},
          {sev:'MEDIUM',msg:'Network Policy ausente em default namespace',c:'#f59e0b'},
          {sev:'LOW',msg:'Secret exposto em variável de ambiente',c:'#94a3b8'},
        ].map(({sev,msg,c})=>(
          <div key={sev} className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-slate-100 bg-white">
            <span className="klp-mono text-[9px] font-bold px-2.5 py-1 rounded shrink-0"
              style={{ background:`${c}12`, color:c }}>{sev}</span>
            <span className="text-sm text-slate-600 flex-1">{msg}</span>
            <Zap className="w-4 h-4 shrink-0" style={{color:accent}} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-4 px-4 py-3 rounded-xl"
        style={{ background:`${accent}08`, border:`1px solid ${accent}20` }}>
        <Shield className="w-5 h-5 shrink-0" style={{color:accent}} />
        <span className="text-sm text-slate-600">Auto-fix disponível para todos os findings críticos</span>
      </div>
    </div>,
    /* 3 — FinOps */
    <div className="w-full h-full flex flex-col p-8">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="klp-mono text-xs text-slate-400 uppercase tracking-widest mb-1">Economia mensal</p>
          <p className="klp-syne font-900 text-slate-900" style={{ fontSize:'2.8rem', lineHeight:1 }}>R$4.2k</p>
        </div>
        <div className="text-right">
          <p className="klp-mono text-xs text-slate-400">de economia com IA</p>
          <p className="klp-syne font-800 text-2xl" style={{color:accent}}>–33%</p>
        </div>
      </div>
      <div className="flex-1 space-y-5">
        {[{label:'Custo sem Kodo',v:100,amt:'R$12.800',c:'#f87171'},{label:'Custo com Kodo',v:67,amt:'R$8.600',c:accent}].map(({label,v,amt,c})=>(
          <div key={label}>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">{label}</span>
              <span className="klp-syne font-700 text-slate-800">{amt}</span>
            </div>
            <div className="h-4 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full" style={{width:`${v}%`,background:c}} />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 mt-6">
        {[{l:'Idle cut',v:'-38%'},{l:'Right-size',v:'+22%'},{l:'Waste',v:'-61%'}].map(({l,v})=>(
          <div key={l} className="text-center py-4 rounded-xl bg-white border border-slate-100">
            <p className="klp-syne font-900 text-xl" style={{color:accent}}>{v}</p>
            <p className="klp-mono text-[9px] text-slate-400 mt-1 uppercase">{l}</p>
          </div>
        ))}
      </div>
    </div>,
    /* 4 — Observabilidade */
    <div className="w-full h-full flex flex-col p-8">
      <div className="flex items-center justify-between mb-6">
        <span className="klp-mono text-xs text-slate-400 uppercase tracking-widest">Métricas · tempo real</span>
        <span className="flex items-center gap-2 klp-mono text-xs" style={{color:accent}}>
          <span className="w-2 h-2 rounded-full animate-pulse inline-block" style={{background:accent}} />Live
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 flex-1">
        {[{l:'CPU',v:68,u:'%',c:accent},{l:'Memória',v:54,u:'%',c:'#818cf8'},{l:'Network',v:32,u:'MB/s',c:'#34d399'},{l:'Storage',v:71,u:'%',c:'#fb923c'}].map(({l,v,u,c})=>(
          <div key={l} className="bg-white border border-slate-100 rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex justify-between items-baseline mb-3">
              <span className="klp-mono text-xs text-slate-400 uppercase">{l}</span>
              <span className="klp-syne font-900 text-2xl" style={{color:c}}>{v}<span className="text-sm">{u}</span></span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full" style={{width:`${v}%`,background:c}} />
            </div>
          </div>
        ))}
      </div>
    </div>,
    /* 5 — Multi-Cluster */
    <div className="w-full h-full flex flex-col p-8 gap-4">
      <span className="klp-mono text-xs text-slate-400 uppercase tracking-widest">Clusters Gerenciados</span>
      {[
        {name:'prod-eks-us-east',cloud:'AWS EKS',nodes:12,pods:148,cpu:68,mem:54,ok:true},
        {name:'prod-gke-europe',cloud:'Google GKE',nodes:8,pods:92,cpu:45,mem:61,ok:true},
        {name:'staging-aks',cloud:'Azure AKS',nodes:4,pods:51,cpu:82,mem:73,ok:false},
      ].map(({name,cloud,nodes,pods,cpu,mem,ok})=>(
        <div key={name} className="flex-1 bg-white border border-slate-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{background:ok?'#34d399':'#fb923c',boxShadow:ok?'0 0 8px #34d39966':'0 0 8px #fb923c66'}} />
              <span className="klp-syne font-700 text-slate-900">{name}</span>
            </div>
            <span className="klp-mono text-[10px] text-slate-400 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100">{cloud}</span>
          </div>
          <div className="flex gap-3 mb-4">
            {[{l:'Nodes',v:nodes},{l:'Pods',v:pods}].map(({l,v})=>(
              <div key={l} className="px-4 py-2 rounded-lg bg-slate-50 border border-slate-100 text-center">
                <p className="klp-syne font-800 text-slate-800">{v}</p>
                <p className="klp-mono text-[9px] text-slate-400 uppercase">{l}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {[{l:'CPU',v:cpu,c:cpu>75?'#fb923c':accent},{l:'MEM',v:mem,c:'#818cf8'}].map(({l,v,c})=>(
              <div key={l} className="flex items-center gap-3">
                <span className="klp-mono text-[10px] text-slate-400 w-8">{l}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{width:`${v}%`,background:c}} />
                </div>
                <span className="klp-mono text-[10px] w-8 text-right" style={{color:c}}>{v}%</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>,
  ];
  return <div className="w-full h-full">{visuals[idx] ?? null}</div>;
};

/* ─── FeaturesGrid ──────────────────────────────────────────────── */
const FeaturesGrid = ({ onRef }: { onRef?: (el: HTMLElement | null) => void }) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.08 });
    if (gridRef.current) obs.observe(gridRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={(el) => onRef?.(el)}
      id="recursos"
      className="py-24 px-6"
      style={{ background: '#f8fafc' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <p className="klp-mono text-[11px] uppercase tracking-[0.2em] mb-5" style={{ color: '#0891b2' }}>Recursos</p>
          <h2 className="klp-syne font-800 leading-tight text-slate-900" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
            Tudo que você precisa,{' '}
            <span className="klp-grad-cyan">integrado</span>
          </h2>
        </div>
        <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div key={f.title}
              className={`klp-card rounded-2xl p-8 border border-slate-200 bg-white klp-reveal klp-d${Math.min(i + 1, 6)} ${visible ? 'klp-in' : ''}`}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                style={{ background: `${f.accent}12`, border: `1.5px solid ${f.accent}25` }}>
                <f.icon className="w-6 h-6" style={{ color: f.accent }} />
              </div>
              <h3 className="klp-syne font-700 text-slate-900 text-xl mb-3">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold group cursor-pointer"
                style={{ color: f.accent }}>
                <span>Saiba mais</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};


/* ─── Hooks ─────────────────────────────────────────────────────── */

const useCounter = (end: number, duration = 2000, decimals = 0) => {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStarted(true); }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!started) return;
    let start: number;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min((now - start) / duration, 1);
      setCount(parseFloat(((1 - Math.pow(1 - p, 3)) * end).toFixed(decimals)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [started, end, duration, decimals]);
  return { count, ref };
};

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

/* ─── UsageBar ──────────────────────────────────────────────────── */
const UsageBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div>
    <div className="flex justify-between items-center mb-1">
      <span className="klp-mono text-[9px] text-white/30 uppercase tracking-widest">{label}</span>
      <span className="klp-mono text-[10px]" style={{ color }}>{value}%</span>
    </div>
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div className="h-full rounded-full klp-bar" style={{ width: `${value}%`, background: color, animationDuration: '0.8s' }} />
    </div>
  </div>
);

/* ─── ClusterMockCard ───────────────────────────────────────────── */
const ClusterMockCard = ({
  name, env, status, nodes, pods, cpu, mem, delay = 0
}: { name: string; env: string; status: 'healthy'|'warning'; nodes: number; pods: number; cpu: number; mem: number; delay?: number }) => {
  const isHealthy = status === 'healthy';
  return (
    <div className="rounded-xl border p-3 space-y-2.5"
      style={{
        background: 'rgba(255,255,255,0.025)',
        borderColor: isHealthy ? 'rgba(52,211,153,0.18)' : 'rgba(251,191,36,0.18)',
        animation: `klp-fade-up 0.5s ease ${delay}s both`,
      }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: isHealthy ? '#34d399' : '#fbbf24', boxShadow: isHealthy ? '0 0 6px #34d399' : '0 0 6px #fbbf24' }} />
          <span className="klp-syne text-[11px] font-700 text-white/90 tracking-tight">{name}</span>
        </div>
        <span className="klp-mono text-[8px] px-1.5 py-0.5 rounded border"
          style={{
            color: isHealthy ? '#34d399' : '#fbbf24',
            borderColor: isHealthy ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)',
            background: isHealthy ? 'rgba(52,211,153,0.06)' : 'rgba(251,191,36,0.06)',
          }}>
          {isHealthy ? 'Saudável' : 'Atenção'}
        </span>
      </div>
      {/* Stats row */}
      <div className="flex gap-2">
        {[{ l: 'Nodes', v: nodes }, { l: 'Pods', v: `${pods}/${pods}` }, { l: 'Env', v: env }].map(s => (
          <div key={s.l} className="flex-1 rounded-lg px-2 py-1.5 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="klp-mono text-[7px] text-white/25 uppercase tracking-widest mb-0.5">{s.l}</p>
            <p className="klp-syne text-[10px] font-600 text-white/70">{s.v}</p>
          </div>
        ))}
      </div>
      {/* Bars */}
      <div className="space-y-1.5">
        <UsageBar label="CPU" value={cpu} color={cpu > 80 ? '#fb923c' : '#22d3ee'} />
        <UsageBar label="Memória" value={mem} color={mem > 80 ? '#f472b6' : '#818cf8'} />
      </div>
    </div>
  );
};

/* ─── LiveDashboard ─────────────────────────────────────────────── */
const LiveDashboard = () => {
  const events = [
    { type: "heal", msg: "Auto-heal: api-gateway reiniciado",      time: "agora",  ns: "production" },
    { type: "ok",   msg: "Anomalia de custo resolvida · R$320",     time: "2m",     ns: "finops" },
    { type: "warn", msg: "Memória elevada — redis-v3 · 84%",        time: "7m",     ns: "staging" },
    { type: "ok",   msg: "Security scan concluído · 0 críticos",    time: "12m",    ns: "security" },
  ];
  const sideItems = [
    { icon: Server,       label: 'Clusters',  active: true  },
    { icon: Activity,     label: 'Monitor',   active: false },
    { icon: Shield,       label: 'Security',  active: false },
    { icon: DollarSign,   label: 'FinOps',    active: false },
  ];
  return (
    <div className="relative w-full klp-float" style={{ animationDuration: '6s' }}>
      <div className="absolute inset-0 -z-10 blur-[70px] opacity-40 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 60% 40%, rgba(34,211,238,0.2), rgba(99,102,241,0.15), transparent 70%)' }} />
      <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60"
        style={{ background: 'rgba(8,12,20,0.97)', backdropFilter: 'blur(24px)' }}>

        {/* Window chrome */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]"
          style={{ background: 'rgba(255,255,255,0.015)' }}>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#febc2e' }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
          </div>
          <div className="flex-1 flex justify-center">
            <span className="klp-mono text-[10px] text-white/20 border border-white/[0.06] px-3 py-1 rounded-md"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              app.kodo.io/clusters
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative w-1.5 h-1.5 rounded-full bg-emerald-400 klp-pulse" />
            <span className="klp-mono text-[10px] text-emerald-400/80">LIVE</span>
          </div>
        </div>

        {/* App layout: sidebar + content */}
        <div className="flex" style={{ minHeight: '380px' }}>

          {/* Sidebar */}
          <div className="flex flex-col items-center py-4 gap-1 border-r border-white/[0.04]"
            style={{ width: '48px', background: 'rgba(255,255,255,0.01)' }}>
            {sideItems.map(({ icon: Icon, label, active }) => (
              <div key={label} title={label}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all"
                style={{
                  background: active ? 'rgba(34,211,238,0.12)' : 'transparent',
                  color: active ? '#22d3ee' : 'rgba(255,255,255,0.2)',
                }}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 p-3 space-y-3 overflow-hidden">

            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="klp-syne text-[11px] font-700 text-white/80">Clusters</p>
                <p className="klp-mono text-[8px] text-white/25">3 clusters · 2 online</p>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-white/[0.06]"
                style={{ background: 'rgba(52,211,153,0.06)' }}>
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                <span className="klp-mono text-[8px] text-emerald-400">Todos saudáveis</span>
              </div>
            </div>

            {/* Cluster cards */}
            <div className="space-y-2">
              <ClusterMockCard name="prod-cluster" env="Produção" status="healthy"
                nodes={3} pods={48} cpu={68} mem={54} delay={0.1} />
              <ClusterMockCard name="staging-eks" env="Staging" status="warning"
                nodes={2} pods={31} cpu={82} mem={71} delay={0.2} />
            </div>

            {/* Events */}
            <div className="rounded-xl border border-white/[0.05] overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.01)' }}>
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
                <span className="klp-mono text-[8px] text-white/25 uppercase tracking-widest">Eventos Recentes</span>
                <BellRing className="w-2.5 h-2.5 text-white/20" />
              </div>
              <div className="divide-y divide-white/[0.03]">
                {events.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5"
                    style={{ animation: `klp-fade-up 0.35s ease ${i * 0.07 + 0.4}s both` }}>
                    {e.type === 'ok'   && <CheckCircle2 className="w-2.5 h-2.5 shrink-0 text-emerald-400" />}
                    {e.type === 'heal' && <Zap className="w-2.5 h-2.5 shrink-0 text-cyan-400" />}
                    {e.type === 'warn' && <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-amber-400" />}
                    <span className="text-[9px] text-white/40 flex-1 truncate">{e.msg}</span>
                    <span className="klp-mono text-[8px] px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.2)' }}>
                      {e.ns}
                    </span>
                    <span className="klp-mono text-[8px] text-white/15 shrink-0">{e.time}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Data ──────────────────────────────────────────────────────── */
const MORPH_WORDS = ["monitora.", "se cura.", "economiza.", "protege."];

const FEATURES = [
  { icon: Brain,     title: "Monitor com IA",    desc: "ML detecta anomalias e previne incidentes antes que afetem seus usuários.",                         accent: '#22d3ee' },
  { icon: Wrench,    title: "Auto-Healing",       desc: "Correções automáticas aplicadas imediatamente — zero intervenção manual necessária.",               accent: '#34d399' },
  { icon: Shield,    title: "Segurança",          desc: "Análise completa de RBAC, Network Policies e Pod Security. Vulnerabilidades identificadas.",         accent: '#f472b6' },
  { icon: DollarSign,title: "FinOps",             desc: "Controle de custos multi-cloud com insights detalhados. Economize até 40% na infraestrutura.",      accent: '#fbbf24' },
  { icon: Activity,  title: "Observabilidade",    desc: "Métricas em tempo real de CPU, memória, storage e rede com dashboards personalizados.",              accent: '#818cf8' },
  { icon: Server,    title: "Multi-Cluster",      desc: "AWS EKS, GKE, AKS e on-premises em uma única interface unificada e inteligente.",                    accent: '#fb923c' },
];

const STEPS = [
  { n: "01", icon: Upload,    title: "Conecte",      desc: "Instale o agente em menos de 5 minutos via kubectl ou Helm." },
  { n: "02", icon: Settings,  title: "Configure",    desc: "Defina políticas de auto-healing e thresholds personalizados." },
  { n: "03", icon: LineChart, title: "Monitore",     desc: "Dashboards interativos com métricas e anomalias ao vivo." },
  { n: "04", icon: BellRing,  title: "Receba Insights", desc: "Notificações inteligentes antes que problemas impactem usuários." },
];

const INTEGRATIONS = [
  "AWS EKS", "Google GKE", "Azure AKS", "DigitalOcean", "Rancher", "OpenShift",
  "Helm", "ArgoCD", "Prometheus", "Grafana", "Terraform", "Cilium",
];

const FAQS = [
  { q: "O que é o Kodo?",                  a: "Kodo é uma plataforma de gestão Kubernetes com IA: auto-healing automático, segurança, FinOps e observabilidade em tempo real." },
  { q: "Como funciona o auto-healing?",    a: "A IA detecta anomalias e aplica correções automaticamente — reiniciando pods, escalando deployments ou ajustando recursos sem intervenção." },
  { q: "Funciona com qualquer cloud?",     a: "Sim. Kodo é multi-cloud: AWS EKS, Google GKE, Azure AKS, DigitalOcean Kubernetes e clusters on-premises." },
  { q: "Quanto tempo leva para configurar?", a: "Menos de 5 minutos. Basta instalar nosso agente usando kubectl ou Helm e conectar ao painel." },
  { q: "O Kodo é seguro?",                 a: "Segurança é nossa prioridade. Coletamos apenas metadados e métricas de performance — nunca dados de aplicação ou secrets." },
  { q: "Como faço uma demonstração?",      a: "Entre em contato conosco para agendar uma demonstração personalizada com nossa equipe técnica." },
];

/* ─── Component ─────────────────────────────────────────────────── */
export default function LandingPage() {
  const abVariant = (new URLSearchParams(window.location.search).get('variant') as 'a' | 'b' | 'c') ?? 'a';

  const [menuOpen,      setMenuOpen]      = useState(false);
  const [scrolled,      setScrolled]      = useState(false);
  const [morphIdx,      setMorphIdx]      = useState(0);
  const [morphState,    setMorphState]    = useState<'in' | 'out'>('in');
  const [scrollPct,     setScrollPct]     = useState(0);
  const [activeSection, setActiveSection] = useState(0);

  const heroRef         = useRef<HTMLElement>(null);
  const dashRef         = useRef<HTMLDivElement>(null);
  const heroParallaxRef = useRef<HTMLDivElement>(null);
  const dashParallaxRef = useRef<HTMLDivElement>(null);
  const mainRef         = useRef<HTMLElement>(null);
  const orbARef         = useRef<HTMLDivElement>(null);
  const orbBRef         = useRef<HTMLDivElement>(null);
  const sectionEls      = useRef<HTMLElement[]>([]);

  const s1 = useCounter(99.9, 2200, 1);
  const s2 = useCounter(40,   1900);
  const s3 = useCounter(5,    1500);
  const s4 = useCounter(500,  2000);

  const { ref: featRef,  inView: featIn  } = useInView();
  const { ref: stepsRef, inView: stepsIn } = useInView();
  const { ref: statsRef, inView: statsIn } = useInView();
  const { ref: ctaRef,   inView: ctaIn   } = useInView();
  const { ref: faqRef,   inView: faqIn   } = useInView();

  // Inject fonts + keyframes
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'kodo-lp-css';
    style.textContent = STYLES;
    document.head.appendChild(style);
    return () => { document.getElementById('kodo-lp-css')?.remove(); };
  }, []);

  // Unified scroll handler: navbar state + progress + velocity skew + parallax orbs + section tracking
  useEffect(() => {
    let prevY    = window.scrollY;
    let skew     = 0;
    let decayRaf = 0;

    const DOT_SECTIONS = sectionEls.current;

    const onScroll = () => {
      const y    = window.scrollY;
      const docH = document.documentElement.scrollHeight - window.innerHeight;

      // Navbar
      setScrolled(y > 24);

      // Progress bar
      setScrollPct(docH > 0 ? (y / docH) * 100 : 0);

      prevY = y;

      // Parallax — fundo (orbs)
      if (orbARef.current) orbARef.current.style.transform = `translateY(${y * 0.25}px)`;
      if (orbBRef.current) orbBRef.current.style.transform = `translateY(${y * -0.15}px)`;

      // Parallax — hero (gated à altura do hero)
      if (y < window.innerHeight * 1.5) {
        if (heroParallaxRef.current) heroParallaxRef.current.style.transform = `translateY(${y * 0.14}px)`;
        if (dashParallaxRef.current) dashParallaxRef.current.style.transform = `translateY(${y * 0.07}px)`;
      }

      // Active section dot
      let cur = 0;
      DOT_SECTIONS.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.45) cur = i;
      });
      setActiveSection(cur);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(decayRaf); };
  }, []);

  // Hero dashboard 3D tilt
  useEffect(() => {
    const hero = heroRef.current;
    const dash = dashRef.current;
    if (!hero || !dash) return;
    const move = (e: MouseEvent) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width  - 0.5;
      const y = (e.clientY - r.top)  / r.height - 0.5;
      dash.style.transform = `perspective(1200px) rotateY(${x * 8}deg) rotateX(${-y * 5}deg)`;
    };
    const leave = () => {
      dash.style.transition = 'transform 0.7s cubic-bezier(0.16,1,0.3,1)';
      dash.style.transform = '';
      setTimeout(() => { dash.style.transition = ''; }, 700);
    };
    hero.addEventListener('mousemove', move);
    hero.addEventListener('mouseleave', leave);
    return () => { hero.removeEventListener('mousemove', move); hero.removeEventListener('mouseleave', leave); };
  }, []);

  // Feature card mouse glow
  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>('.klp-card');
    const handler = (e: MouseEvent) => {
      const t = e.currentTarget as HTMLElement;
      const r = t.getBoundingClientRect();
      t.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      t.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    };
    cards.forEach(c => c.addEventListener('mousemove', handler as EventListener));
    return () => cards.forEach(c => c.removeEventListener('mousemove', handler as EventListener));
  }, [featIn]);

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

  return (
    <div className="klp min-h-screen overflow-x-hidden" style={{ background: '#ffffff', color: '#0f172a' }}>
      <SEO
        title="Kodo — Plataforma de Gestão Kubernetes com IA | Auto-Healing e FinOps"
        description="Gerencie clusters Kubernetes com inteligência artificial. Auto-healing em 30s, FinOps com economia de 40%, segurança contínua. AWS EKS, GKE e AKS. Setup em 5 minutos."
        path="/"
      />

      {/* ── Animated Background ── */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div ref={orbARef} className="absolute w-[700px] h-[700px] rounded-full opacity-[0.07] blur-[140px] top-[-150px] left-[5%]"
          style={{ background: 'radial-gradient(circle, #0891b2, transparent 70%)', animation: 'klp-orb-a 20s ease-in-out infinite' }} />
        <div ref={orbBRef} className="absolute w-[500px] h-[500px] rounded-full opacity-[0.06] blur-[120px] top-[20%] right-[0%]"
          style={{ background: 'radial-gradient(circle, #4f46e5, transparent 70%)', animation: 'klp-orb-b 25s ease-in-out infinite' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[100px] bottom-[5%] left-[25%]"
          style={{ background: 'radial-gradient(circle, #0891b2, transparent 70%)', animation: 'klp-orb-c 18s ease-in-out infinite' }} />
        {/* Fine grid */}
        <div className="absolute inset-0 opacity-[0.018]"
          style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,1) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
      </div>

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 transition-all duration-300"
        style={ scrolled
          ? { background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.07)' }
          : { background: 'transparent' } }>
        <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <img src={kodoLogo} alt="Kodo" className="w-8 h-8 object-contain" />
            <span className="klp-syne text-xl font-700 tracking-tight text-slate-900">Kodo</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {[{ label: 'Recursos', href: '#recursos' }, { label: 'Como Funciona', href: '#como-funciona' }, { label: 'FAQ', href: '#faq' }]
              .map(({ label, href }) => (
              <a key={label} href={href}
                className="klp-mono text-xs uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors duration-200">
                {label}
              </a>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 klp-mono text-xs uppercase tracking-wider">
                Entrar
              </Button>
            </Link>
            <Link to="/diagnostico">
              <Button size="sm"
                className="text-sm px-5 font-medium text-white transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #0891b2, #4f46e5)', boxShadow: '0 4px 20px rgba(8,145,178,0.25)' }}>
                Solicitar demo
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
          <button className="md:hidden p-2 text-slate-500 hover:text-slate-900" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>
        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 px-6 py-5 space-y-4 bg-white">
            {['Recursos', 'Como Funciona', 'FAQ'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`}
                className="block klp-mono text-xs uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
                onClick={() => setMenuOpen(false)}>
                {item}
              </a>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <Link to="/auth" onClick={() => setMenuOpen(false)}>
                <Button variant="outline" size="sm" className="w-full border-slate-200 text-slate-600">Entrar</Button>
              </Link>
              <Link to="/diagnostico" onClick={() => setMenuOpen(false)}>
                <Button size="sm" className="w-full text-white" style={{ background: 'linear-gradient(135deg, #0891b2, #4f46e5)' }}>
                  Solicitar demo
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Scroll progress line ── */}
      <div className="klp-progress" style={{ width: `${scrollPct}%` }} />

      {/* ── Section dots nav ── */}
      <nav className="klp-dots" aria-label="Seções">
        {['Hero', 'Recursos', 'Como funciona', 'FAQ'].map((label, i) => (
          <button
            key={i}
            aria-label={label}
            className={`klp-dot ${activeSection === i ? 'klp-dot-active' : ''}`}
            onClick={() => sectionEls.current[i]?.scrollIntoView({ behavior: 'smooth' })}
          />
        ))}
      </nav>

      <main ref={mainRef}>
        {/* ══════════════════ HERO ══════════════════ */}
        <section ref={(el) => { if (el) { (heroRef as any).current = el; sectionEls.current[0] = el; } }}
          className="relative min-h-[92vh] flex items-center px-6 pt-16 pb-24">
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[46fr_54fr] gap-12 items-center">

            {/* Left */}
            <div ref={heroParallaxRef}>
            <div className="space-y-8 min-w-0" style={{ animation: 'klp-fade-up 0.9s cubic-bezier(0.16,1,0.3,1) both' }}>
              {/* Label */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full border"
                style={{ background: 'rgba(8,145,178,0.06)', borderColor: 'rgba(8,145,178,0.2)' }}>
                <div className="relative w-1.5 h-1.5 rounded-full klp-pulse" style={{ background: '#0891b2' }} />
                <span className="klp-mono text-[11px] uppercase tracking-widest" style={{ color: '#0891b2' }}>Plataforma Cloud-Native · IA</span>
              </div>

              {/* Headline */}
              <div>
                <h1 className="klp-syne leading-[1.05] text-slate-900"
                  style={{ fontSize: 'clamp(2.6rem, 4.5vw, 4.5rem)', fontWeight: 900 }}>
                  Kubernetes que
                  <br />
                  <span className="overflow-hidden inline-block" style={{ verticalAlign: 'bottom', maxWidth: '100%' }}>
                    <span key={`${morphIdx}-${morphState}`}
                      className={`inline-block klp-grad-cyan ${morphState === 'in' ? 'klp-word-in' : 'klp-word-out'}`}>
                      {MORPH_WORDS[morphIdx]}
                    </span>
                  </span>
                  <br />
                  <span className="text-slate-900">sozinho.</span>
                </h1>
              </div>

              <p className="text-slate-500 leading-relaxed max-w-md" style={{ fontSize: '1.05rem' }}>
                Plataforma cloud-native com IA que monitora, protege e otimiza seus clusters — com auto-healing e FinOps integrados.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/diagnostico">
                  <Button size="lg"
                    className="text-base px-8 py-6 font-medium rounded-xl text-white transition-all hover:-translate-y-0.5 group"
                    style={{ background: 'linear-gradient(135deg, #0891b2 0%, #4f46e5 100%)', boxShadow: '0 8px 32px rgba(8,145,178,0.3)' }}
                    onClick={() => (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.('event', 'hero_cta_click', { ab_variant: abVariant })}>
                    Solicite a demo gratuitamente
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <a href="#como-funciona">
                  <Button size="lg" variant="ghost"
                    className="text-base px-8 py-6 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl gap-2">
                    <Terminal className="w-4 h-4" />
                    Ver demo
                  </Button>
                </a>
              </div>

              {/* Proof */}
              <div className="flex flex-wrap items-center gap-5 pt-2">
                {['Setup em 5 min', 'Multi-cloud', 'Suporte dedicado'].map(t => (
                  <span key={t} className="flex items-center gap-1.5 text-sm text-slate-400">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    {t}
                  </span>
                ))}
              </div>
            </div>
            </div>{/* /heroParallaxRef */}

            {/* Right — Dashboard */}
            <div ref={dashParallaxRef}>
              <div ref={dashRef} className="klp-dash-tilt"
                style={{ animation: 'klp-fade-up 1.1s cubic-bezier(0.16,1,0.3,1) 0.15s both' }}>
                <LiveDashboard />
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════ INTEGRATION BAR ══════════════════ */}
        <div className="py-8 border-y border-slate-100" style={{ background: '#f8fafc' }}>
          <p className="klp-mono text-[10px] uppercase tracking-[0.2em] text-slate-400 text-center mb-5">
            Integra com as principais plataformas
          </p>
          <div className="klp-ticker-wrap">
            <div className="klp-ticker-track">
              {[...INTEGRATIONS, ...INTEGRATIONS].map((name, i) => (
                <div key={i} className="flex items-center gap-3 mx-6 shrink-0">
                  <span className="text-sm text-slate-400 hover:text-slate-600 transition-colors whitespace-nowrap cursor-default">
                    {name}
                  </span>
                  <span className="text-slate-200">·</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════ STATS ══════════════════ */}
        <section className="relative overflow-hidden py-20 px-6" style={{ background: '#06090f' }}>

          {/* ── Tech grid ── */}
          <div className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
              animation: 'klp-grid-breathe 5s ease-in-out infinite',
            }} />

          {/* ── Scan line ── */}
          <div className="absolute inset-y-0 w-32 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(8,145,178,0.12), transparent)',
              animation: 'klp-scan 5s linear infinite',
            }} />

          {/* ── Ambient glows ── */}
          <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none blur-[100px] opacity-10"
            style={{ background: '#0891b2' }} />
          <div className="absolute top-1/2 right-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none blur-[100px] opacity-10"
            style={{ background: '#6366f1' }} />

          <div ref={statsRef}
            className="relative max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 divide-x"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {[
              { ...s1, suffix: '%',    label: 'Uptime garantido',    color: '#22d3ee', delay: 0    },
              { ...s2, suffix: '%',    label: 'Economia média',       color: '#34d399', delay: 0.1  },
              { ...s3, suffix: ' min', label: 'Setup rápido',         color: '#818cf8', delay: 0.2  },
              { ...s4, suffix: '+',    label: 'Clusters gerenciados', color: '#fbbf24', delay: 0.3  },
            ].map(({ count, ref: cRef, suffix, label, color, delay }, i) => (
              <div key={label} ref={cRef}
                className="relative flex flex-col items-center justify-center py-10 px-6 gap-3">

                {/* Pulsing ring behind number */}
                {statsIn && (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-28 h-28 rounded-full"
                        style={{
                          border: `1px solid ${color}30`,
                          animation: `klp-ring-out 3s ease-out ${delay}s infinite`,
                        }} />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-28 h-28 rounded-full"
                        style={{
                          border: `1px solid ${color}20`,
                          animation: `klp-ring-out 3s ease-out ${delay + 1.5}s infinite`,
                        }} />
                    </div>
                  </>
                )}

                {/* Number */}
                <div className="klp-syne tabular-nums leading-none relative z-10"
                  style={{
                    fontSize: 'clamp(2.6rem, 4.5vw, 4.2rem)',
                    fontWeight: 700,
                    color,
                    letterSpacing: '-0.03em',
                    textShadow: `0 0 40px ${color}50`,
                    animation: statsIn ? `klp-stat-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) ${delay}s both` : 'none',
                  }}>
                  {count}{suffix}
                </div>

                {/* Label */}
                <div className="klp-mono text-[10px] uppercase tracking-[0.18em] text-center leading-snug relative z-10"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════ FEATURES — sticky scroll ══════════════════ */}
        <FeaturesGrid onRef={(el) => { if (el) sectionEls.current[1] = el as HTMLElement; }} />

        {/* ══════════════════ HOW IT WORKS ══════════════════ */}
        <section id="como-funciona" ref={(el) => { if (el) sectionEls.current[2] = el; }}
          className="py-24 px-6" style={{ background: '#ffffff' }}>
          <div className="max-w-6xl mx-auto">

            {/* Header */}
            <div className="text-center mb-20">
              <p className="klp-mono text-[11px] uppercase tracking-[0.2em] mb-4" style={{ color: '#0891b2' }}>Como funciona</p>
              <h2 className="klp-syne leading-tight text-slate-900" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800 }}>
                Do cluster ao auto-healing em{' '}
                <span className="klp-grad-cyan">tempo real</span>
              </h2>
              <p className="mt-4 text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
                O Kodo Agent roda dentro do seu cluster Kubernetes e envia métricas para a plataforma, que age automaticamente — sem depender de acesso externo.
              </p>
            </div>

            {/* Flow diagram */}
            <div ref={stepsRef} className="relative">

              {/* ── Desktop: horizontal flow ── */}
              <div className="hidden lg:flex items-center justify-between gap-0">

                {[
                  {
                    icon: Server,
                    label: 'Cluster Kubernetes',
                    color: '#0891b2',
                    bg: 'rgba(8,145,178,0.06)',
                    border: 'rgba(8,145,178,0.2)',
                    tags: ['Pods', 'Nodes', 'Deployments'],
                    desc: 'AWS EKS, GKE, AKS ou on-premise. Qualquer distribuição K8s.',
                    delay: 0,
                  },
                  {
                    icon: Upload,
                    label: 'Kodo Agent',
                    color: '#818cf8',
                    bg: 'rgba(129,140,248,0.06)',
                    border: 'rgba(129,140,248,0.2)',
                    tags: ['kubectl apply', 'Helm chart'],
                    desc: 'Pod leve instalado em minutos. Coleta métricas via Kubernetes API.',
                    delay: 0.15,
                  },
                  {
                    icon: Brain,
                    label: 'IA & Análise',
                    color: '#34d399',
                    bg: 'rgba(52,211,153,0.06)',
                    border: 'rgba(52,211,153,0.2)',
                    tags: ['ML', 'RBAC scan', 'FinOps'],
                    desc: 'Modelos de ML detectam anomalias, ameaças e desperdícios de custo.',
                    delay: 0.3,
                  },
                  {
                    icon: Zap,
                    label: 'Ações Automáticas',
                    color: '#fbbf24',
                    bg: 'rgba(251,191,36,0.06)',
                    border: 'rgba(251,191,36,0.2)',
                    tags: ['Auto-Heal', 'Alertas', 'Relatórios'],
                    desc: 'Correções aplicadas diretamente no cluster via comandos seguros.',
                    delay: 0.45,
                  },
                ].map((node, i, arr) => (
                  <div key={node.label} className="flex items-center flex-1 min-w-0">

                    {/* Node card */}
                    <div className={`klp-reveal klp-d${i + 1} ${stepsIn ? 'klp-in' : ''} flex-1`}>
                      <div className="rounded-2xl p-6 border flex flex-col gap-3 h-full"
                        style={{ background: node.bg, borderColor: node.border }}>
                        {/* Icon + number */}
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: `${node.color}15`, border: `1px solid ${node.color}30` }}>
                            <node.icon className="w-5 h-5" style={{ color: node.color }} />
                          </div>
                          <span className="klp-mono text-[10px] font-600"
                            style={{ color: `${node.color}80` }}>
                            {String(i + 1).padStart(2, '0')}
                          </span>
                        </div>
                        {/* Label */}
                        <h3 className="klp-syne text-slate-900 font-700 text-sm leading-snug">{node.label}</h3>
                        {/* Desc */}
                        <p className="text-xs text-slate-500 leading-relaxed">{node.desc}</p>
                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                          {node.tags.map(t => (
                            <span key={t} className="klp-mono text-[9px] px-2 py-0.5 rounded-full"
                              style={{ background: `${node.color}12`, color: node.color, border: `1px solid ${node.color}20` }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Connector arrow (not after last) */}
                    {i < arr.length - 1 && (
                      <div className="relative flex-shrink-0 mx-2" style={{ width: '48px', height: '2px' }}>
                        {/* Dashed line */}
                        <div className="absolute inset-0 rounded-full"
                          style={{ background: 'repeating-linear-gradient(90deg, rgba(99,102,241,0.3) 0, rgba(99,102,241,0.3) 4px, transparent 4px, transparent 10px)' }} />
                        {/* Moving dot */}
                        {stepsIn && (
                          <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                            style={{
                              background: '#6366f1',
                              boxShadow: '0 0 8px #6366f1',
                              animation: `klp-flow-dot 2s ease-in-out ${i * 0.5}s infinite`,
                            }} />
                        )}
                        {/* Arrow head */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-0.5"
                          style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '6px solid rgba(99,102,241,0.4)' }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* ── Mobile: vertical flow ── */}
              <div className="flex lg:hidden flex-col gap-0">
                {[
                  { icon: Server,  label: 'Cluster Kubernetes', color: '#0891b2', desc: 'AWS EKS, GKE, AKS ou on-premise.' },
                  { icon: Upload,  label: 'Kodo Agent',          color: '#818cf8', desc: 'Pod leve instalado em minutos via kubectl.' },
                  { icon: Brain,   label: 'IA & Análise',        color: '#34d399', desc: 'ML detecta anomalias, ameaças e custos.' },
                  { icon: Zap,     label: 'Ações Automáticas',   color: '#fbbf24', desc: 'Auto-heal e alertas aplicados no cluster.' },
                ].map((node, i, arr) => (
                  <div key={node.label} className="flex flex-col items-center">
                    <div className={`w-full rounded-2xl p-5 border klp-reveal klp-d${i+1} ${stepsIn ? 'klp-in' : ''}`}
                      style={{ background: `${node.color}06`, borderColor: `${node.color}20` }}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${node.color}15` }}>
                          <node.icon className="w-4 h-4" style={{ color: node.color }} />
                        </div>
                        <div>
                          <p className="klp-syne font-700 text-sm text-slate-900">{node.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{node.desc}</p>
                        </div>
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="relative w-px my-1" style={{ height: '32px', background: 'rgba(99,102,241,0.2)' }}>
                        {stepsIn && (
                          <div className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
                            style={{ background: '#6366f1', animation: `klp-flow-dot-v 2s ease-in-out ${i * 0.5}s infinite` }} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Bottom detail bar */}
              <div className={`mt-12 rounded-2xl border border-slate-100 bg-slate-50 px-8 py-5 flex flex-wrap justify-center gap-8 klp-reveal klp-d5 ${stepsIn ? 'klp-in' : ''}`}>
                {[
                  { icon: CheckCircle2, text: 'Sem acesso externo ao cluster', color: '#34d399' },
                  { icon: Zap,          text: 'Healing em menos de 30 segundos', color: '#fbbf24' },
                  { icon: Shield,       text: 'Dados nunca saem do seu ambiente', color: '#818cf8' },
                  { icon: Activity,     text: 'Métricas com resolução de 15s',    color: '#0891b2' },
                ].map(({ icon: Icon, text, color }) => (
                  <div key={text} className="flex items-center gap-2">
                    <Icon className="w-4 h-4 shrink-0" style={{ color }} />
                    <span className="text-xs text-slate-600">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="text-center mt-14">
              <Link to="/auth">
                <Button size="lg"
                  className="text-base px-8 py-6 rounded-xl font-medium text-white transition-all hover:-translate-y-0.5 group"
                  style={{ background: 'linear-gradient(135deg, #0891b2, #4f46e5)', boxShadow: '0 8px 32px rgba(8,145,178,0.25)' }}>
                  Começar agora
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ══════════════════ FAQ ══════════════════ */}
        <section id="faq" ref={(el) => { if (el) sectionEls.current[3] = el; }}
          className="py-24 px-6" style={{ background: '#f8fafc' }}>
          <div className="max-w-3xl mx-auto">
            <div ref={faqRef} className={`klp-reveal ${faqIn ? 'klp-in' : ''}`}>
              <p className="klp-mono text-[11px] uppercase tracking-[0.2em] mb-5" style={{ color: '#0891b2' }}>FAQ</p>
              <h2 className="klp-syne font-800 leading-tight mb-12 text-slate-900" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
                Perguntas{' '}
                <span style={{ background: 'linear-gradient(120deg, #4f46e5, #0891b2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  frequentes
                </span>
              </h2>
              <Accordion type="single" collapsible className="space-y-2">
                {FAQS.map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}
                    className="rounded-xl border border-slate-200 px-6 bg-white data-[state=open]:border-slate-300 transition-all">
                    <AccordionTrigger className="text-left hover:no-underline py-5 text-sm font-medium text-slate-700 hover:text-slate-900 klp-syne">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-500 pb-5 leading-relaxed">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* ══════════════════ LEAD CAPTURE ══════════════════ */}
        <section className="py-24 px-6 bg-white border-t border-slate-100">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

              {/* Left — copy */}
              <div className="space-y-6">
                <p className="klp-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: '#0891b2' }}>
                  Diagnóstico gratuito
                </p>
                <h2 className="klp-syne font-extrabold leading-tight text-slate-900"
                  style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
                  Descubra quanto você pode economizar no seu cluster
                </h2>
                <p className="text-slate-500 leading-relaxed">
                  Informe seu email e nossa equipe envia uma análise personalizada com potencial de economia e riscos de segurança — sem instalar nada.
                </p>
                <div className="space-y-3">
                  {[
                    'Análise de custo e recursos subutilizados',
                    'Mapa de riscos de segurança (RBAC, Pod Security)',
                    'Estimativa de economia mensal',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-emerald-500" />
                      </div>
                      <span className="text-sm text-slate-600">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — form */}
              <div className="rounded-2xl p-8 border border-slate-200" style={{ background: '#f8fafc' }}>
                <LeadCaptureForm variant={abVariant} />
              </div>

            </div>
          </div>
        </section>

        {/* ══════════════════ FINAL CTA ══════════════════ */}
        <section className="py-24 px-6 bg-white">
          <div className="max-w-5xl mx-auto">
            <div ref={ctaRef}
              className={`relative rounded-3xl overflow-hidden p-16 text-center klp-reveal ${ctaIn ? 'klp-in' : ''}`}
              style={{ background: 'linear-gradient(135deg, #0891b2 0%, #4f46e5 100%)' }}>
              {/* Subtle grid */}
              <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
                style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
              {/* Glow */}
              <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full blur-[100px] opacity-30 pointer-events-none bg-white" />
              <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full blur-[100px] opacity-20 pointer-events-none bg-white" />

              <div className="relative z-10 space-y-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl border border-white/20 mb-2"
                  style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <h2 className="klp-syne font-800 leading-tight text-white" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>
                  Pronto para transformar
                  <br />sua operação?
                </h2>
                <p className="text-white/75 max-w-md mx-auto leading-relaxed">
                  Junte-se a centenas de empresas que já automatizaram sua gestão Kubernetes com IA.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                  <Link to="/diagnostico">
                    <Button size="lg"
                      className="text-base px-10 py-6 rounded-xl font-medium bg-white text-slate-900 hover:bg-white/90 transition-all hover:-translate-y-0.5 group">
                      Solicitar demo
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  <Link to="/auth">
                    <Button size="lg" variant="ghost"
                      className="text-base px-8 py-6 text-white/80 hover:text-white hover:bg-white/10 rounded-xl border border-white/20">
                      Fazer login
                    </Button>
                  </Link>
                </div>
                <p className="klp-mono text-[11px] text-white/40 uppercase tracking-widest pt-2">
                  Setup em 5 min · Multi-cloud · Suporte dedicado
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

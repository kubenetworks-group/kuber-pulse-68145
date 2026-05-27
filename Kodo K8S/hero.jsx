/* Hero — full-bleed animated background + product showcase */

/* Small inline glyphs for the social-proof row — Docker / K8s / container */
function SocialProofGlyph({ kind, color = '#0F3CA5' }) {
  if (kind === 'plus') {
    return <span style={{ fontWeight: 700, fontSize: 12, color }}>+18</span>;
  }
  if (kind === 'k8s') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2 L12 9 M21 7 L14.6 10.5 M21 17 L14.6 13.5 M12 22 L12 15 M3 17 L9.4 13.5 M3 7 L9.4 10.5" />
      </svg>
    );
  }
  if (kind === 'docker') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3"  y="11" width="4" height="4" rx=".5" />
        <rect x="8"  y="11" width="4" height="4" rx=".5" />
        <rect x="13" y="11" width="4" height="4" rx=".5" />
        <rect x="8"  y="6"  width="4" height="4" rx=".5" />
        <path d="M2 16 C 4 19, 18 19, 21 16 L 21 15 L 2 15 Z" fill={color} stroke="none" />
      </svg>
    );
  }
  // 'container' — isometric box
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
      <path d="M12 3 L21 7.5 L12 12 L3 7.5 Z" />
      <path d="M3 7.5 L3 16.5 L12 21 L12 12" />
      <path d="M21 7.5 L21 16.5 L12 21" />
    </svg>
  );
}

/* Container glyph — small isometric box that reads as a K8s container/pod */
function ContainerGlyph({ x, y, scale = 1, tone = 'idle', delay = 0 }) {
  // tone: idle | active | healing
  const fill = tone === 'healing' ? '#16A34A' : tone === 'active' ? '#0F3CA5' : '#FFFFFF';
  const stroke = tone === 'idle' ? 'rgba(15,60,165,.55)' : 'transparent';
  const accent = tone === 'idle' ? '#0F3CA5' : '#FFFFFF';
  const s = 22 * scale;
  return (
    <g transform={`translate(${x - s} ${y - s}) scale(${scale})`}
       style={{ animation: `float 6s ease-in-out infinite`, animationDelay: `${delay}s`, transformOrigin: `${s}px ${s}px` }}>
      {/* Top face */}
      <path d={`M22 4 L40 13 L22 22 L4 13 Z`} fill={fill} stroke={stroke} strokeWidth="1.2" />
      {/* Left face */}
      <path d={`M4 13 L22 22 L22 40 L4 31 Z`} fill={fill} stroke={stroke} strokeWidth="1.2" opacity={tone === 'idle' ? .92 : 1} />
      {/* Right face */}
      <path d={`M40 13 L22 22 L22 40 L40 31 Z`} fill={fill} stroke={stroke} strokeWidth="1.2" opacity={tone === 'idle' ? .78 : .85} />
      {/* Ridges on top */}
      <path d={`M13 8 L31 17 M22 4 L22 22`} stroke={accent} strokeWidth="0.8" opacity=".4" fill="none" />
      {/* Center dot — pod identifier */}
      <circle cx="22" cy="22" r="1.6" fill={accent} opacity=".8" />
    </g>
  );
}

function HeroTopology() {
  // Container positions across a 1600x900 canvas. Hand-placed to feel
  // organic, not gridded — small clusters with logical gravity.
  const W = 1600, H = 900;
  const containers = [
    // left cluster
    { id: 'l1', x: 160,  y: 180, s: 1.05 },
    { id: 'l2', x: 280,  y: 240, s: 0.85 },
    { id: 'l3', x: 200,  y: 360, s: 0.95 },
    { id: 'l4', x: 130,  y: 480, s: 0.78 },
    { id: 'l5', x: 300,  y: 540, s: 1.0  },
    // middle cluster
    { id: 'm1', x: 540,  y: 200, s: 1.1  },
    { id: 'm2', x: 680,  y: 320, s: 0.95 },
    { id: 'm3', x: 820,  y: 200, s: 0.88 },
    { id: 'm4', x: 760,  y: 520, s: 1.0  },
    { id: 'm5', x: 620,  y: 620, s: 0.82 },
    // right cluster (under the showcase card — placed at edges)
    { id: 'r1', x: 1140, y: 160, s: 0.95 },
    { id: 'r2', x: 1280, y: 280, s: 1.05 },
    { id: 'r3', x: 1440, y: 200, s: 0.85 },
    { id: 'r4', x: 1380, y: 480, s: 0.90 },
    { id: 'r5', x: 1240, y: 620, s: 1.0  },
    { id: 'r6', x: 1490, y: 540, s: 0.78 },
    // bottom band
    { id: 'b1', x: 420,  y: 760, s: 0.85 },
    { id: 'b2', x: 940,  y: 760, s: 0.95 },
  ];

  // Build links: each container connects to its k=2 nearest neighbors,
  // dedup, filter long edges so the graph reads cleanly.
  const links = React.useMemo(() => {
    const edges = new Set();
    const k = 2;
    containers.forEach(a => {
      const sorted = containers
        .filter(b => b.id !== a.id)
        .map(b => ({ b, d: Math.hypot(a.x - b.x, a.y - b.y) }))
        .sort((p, q) => p.d - q.d)
        .slice(0, k);
      sorted.forEach(({ b, d }) => {
        if (d > 360) return;
        const key = [a.id, b.id].sort().join('-');
        if (!edges.has(key)) edges.add(key);
      });
    });
    return [...edges].map(k => {
      const [aId, bId] = k.split('-');
      const a = containers.find(c => c.id === aId);
      const b = containers.find(c => c.id === bId);
      return { a, b, len: Math.hypot(a.x - b.x, a.y - b.y) };
    });
  }, []);

  // Rotating "active" container — represents the current request flowing through
  const [active, setActive] = React.useState(containers[0].id);
  React.useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % containers.length;
      setActive(containers[i].id);
    }, 1100);
    return () => clearInterval(t);
  }, []);

  // Healing pulses — emit one at a random container every 2.4s
  const [pulse, setPulse] = React.useState({ x: 0, y: 0, id: 0 });
  React.useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      const c = containers[Math.floor(Math.random() * containers.length)];
      n++;
      setPulse({ x: c.x, y: c.y, id: n });
    }, 2400);
    return () => clearInterval(t);
  }, []);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ display: 'block' }}>
      <defs>
        <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0F3CA5" stopOpacity=".18" />
          <stop offset="100%" stopColor="#0F3CA5" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="linkGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0F3CA5" stopOpacity="0" />
          <stop offset="50%" stopColor="#0F3CA5" stopOpacity=".55" />
          <stop offset="100%" stopColor="#0F3CA5" stopOpacity="0" />
        </linearGradient>
        {/* Packet — tiny isometric container, centered on (0,0) */}
        <symbol id="pktContainer" viewBox="-9 -9 18 18">
          <g>
            {/* drop shadow */}
            <ellipse cx="0" cy="6" rx="6" ry="1.4" fill="rgba(15,60,165,.18)" />
            {/* top face */}
            <path d="M0 -7 L7 -3 L0 1 L-7 -3 Z" fill="#0F3CA5" />
            {/* left face */}
            <path d="M-7 -3 L0 1 L0 7 L-7 3 Z" fill="#0A2D7E" />
            {/* right face */}
            <path d="M7 -3 L0 1 L0 7 L7 3 Z" fill="#1E4FB8" />
            {/* top highlight ridges */}
            <path d="M-3.5 -5 L3.5 -1 M0 -7 L0 1" stroke="#fff" strokeWidth=".5" opacity=".55" fill="none" />
          </g>
        </symbol>
      </defs>

      {/* Soft glow under each container */}
      {containers.map(c => (
        <circle key={`g${c.id}`} cx={c.x} cy={c.y} r={70 * c.s} fill="url(#hubGlow)" />
      ))}

      {/* Links: dashed flow lines + a traveling container on each */}
      <g>
        {links.map(({ a, b, len }, i) => {
          const dur = 3 + (i % 5) * 0.6; // 3..6s
          return (
            <g key={i}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="rgba(15,60,165,.18)" strokeWidth="1"
                strokeDasharray="2 8"
                style={{ animation: `line-flow ${dur}s linear infinite`, animationDelay: `${i * 0.15}s` }}
              />
              {/* Traveling container packet */}
              <use href="#pktContainer" width="18" height="18" x="-9" y="-9">
                <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`${(i * 0.3) % dur}s`}
                  rotate="0"
                  path={`M${a.x} ${a.y} L${b.x} ${b.y}`} />
              </use>
            </g>
          );
        })}
      </g>

      {/* Containers */}
      {containers.map((c, i) => {
        const tone = c.id === active ? 'active' : 'idle';
        return (
          <ContainerGlyph
            key={c.id}
            x={c.x} y={c.y} scale={c.s}
            tone={tone}
            delay={(i % 7) * 0.4}
          />
        );
      })}

      {/* Healing pulse — bright green ring on a random container */}
      {pulse.id > 0 && (
        <g key={pulse.id}>
          <circle cx={pulse.x} cy={pulse.y} r="14" fill="none" stroke="#16A34A" strokeWidth="2"
            style={{ transformOrigin: `${pulse.x}px ${pulse.y}px`, animation: 'pulse-ring 1.8s ease-out forwards' }}
          />
          <circle cx={pulse.x} cy={pulse.y} r="6" fill="#16A34A"
            style={{ transformOrigin: `${pulse.x}px ${pulse.y}px`, animation: 'pulse-ring 1.8s ease-out forwards' }}
          />
        </g>
      )}
    </svg>
  );
}

function Hero() {
  const heroRef = React.useRef(null);
  React.useEffect(() => {
    const el = heroRef.current; if (!el) return;
    const onMove = e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <section id="produto" ref={heroRef} className="kdo-hero" style={{ paddingLeft: 'var(--d-section-px)', paddingRight: 'var(--d-section-px)' }}>
      <div className="kdo-hero-bg">
        <div className="kdo-hero-grid" />
        <HeroTopology />
        <div className="kdo-spot" />
      </div>

      <div className="kdo-hero-inner kdo-inner" style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 64, alignItems: 'center' }}>
        <div>
          <div className="rise">
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 10, height: 32,
              padding: '0 14px', borderRadius: 999, background: 'rgba(255,255,255,.7)',
              border: '1px solid rgba(15,60,165,.18)', color: '#0F3CA5',
              fontSize: 12, fontWeight: 600, backdropFilter: 'blur(6px)',
            }}>
              <span className="live-dot" />
              Agora com agente SRE em IA
              <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: '#6B6B6B' }}>v2.0</span>
            </span>
          </div>

          <h1 className="rise d1" style={{
            margin: '24px 0 0', fontFamily: 'Aileron', fontWeight: 900,
            fontSize: 'var(--d-h1)', lineHeight: 0.95, letterSpacing: '-0.04em',
            color: '#1A1A1A', textWrap: 'balance',
          }}>
            Kubernetes <br/>
            <span className="hl">sob controle.</span><br/>
            <span style={{ color: '#0F3CA5' }}>Sem ruído.</span>
          </h1>

          <p className="rise d2" style={{
            margin: '24px 0 0', maxWidth: 540, fontSize: 18, lineHeight: 1.55, color: '#1A1A1A',
          }}>
            Monitore, corrija e otimize seus clusters K8s com um agente de IA dedicado.
            Auto-healing, FinOps e segurança — em uma plataforma que fala a língua do operador.
          </p>

          <div className="rise d3" style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Btn variant="indigo" size="lg" iconRight="arrow">Começar grátis</Btn>
            <Btn variant="ghost" size="lg" icon="deploy">Ver demo de 2 min</Btn>
          </div>

          <div className="rise d4" style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex' }}>
              {[
                { kind: 'k8s',       bg: '#E6EEF8', fg: '#0F3CA5' },
                { kind: 'docker',    bg: '#1A1A1A', fg: '#FFFFFF' },
                { kind: 'container', bg: '#577DB2', fg: '#FFFFFF' },
                { kind: 'plus',      bg: '#fff',    fg: '#0F3CA5', border: '2px solid #0F3CA5' },
              ].map((a, i) => (
                <span key={i} style={{
                  width: 36, height: 36, borderRadius: '50%', background: a.bg, color: a.fg,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 12, border: a.border || '2px solid #F0F4FA',
                  marginLeft: i === 0 ? 0 : -10,
                }}>
                  <SocialProofGlyph kind={a.kind} color={a.fg} />
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#0F3CA5', fontSize: 14, letterSpacing: 1 }}>★★★★★ <span style={{ color: '#1A1A1A', fontWeight: 600 }}>4.9</span></span>
              <span style={{ fontSize: 13, color: '#6B6B6B' }}>+500 times de engenharia · G2 High Performer</span>
            </div>
          </div>
        </div>

        <HeroShowcase />
      </div>

      {/* Logo strip */}
      <div className="kdo-hero-inner kdo-inner" style={{ marginTop: 88 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6B6B6B', marginBottom: 18, textAlign: 'center' }}>
          Times que confiam no Kodo
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: 32, opacity: .85, flexWrap: 'wrap' }}>
          {['NUBANK','ITAÚ','XP','MOVILE','iFOOD','PICPAY','MERCADO LIVRE','C6 BANK'].map(n => (
            <span key={n} style={{ fontFamily: 'Aileron', fontWeight: 900, fontSize: 18, letterSpacing: '0.06em', color: '#6B6B6B' }}>{n}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Floating product showcase — live dashboard card with auto-cycling tabs */
function HeroShowcase() {
  const [tab, setTab] = React.useState(0);
  const [dir, setDir] = React.useState(1);   // 1 = forward, -1 = backward
  const prevRef = React.useRef(0);

  React.useEffect(() => {
    const t = setInterval(() => setTab(x => {
      setDir(1);
      prevRef.current = x;
      return (x + 1) % 3;
    }), 5200);
    return () => clearInterval(t);
  }, []);

  const setTabManual = (i) => {
    setDir(i > tab ? 1 : -1);
    prevRef.current = tab;
    setTab(i);
  };

  const tabs = ['Visão geral', 'Auto-healing', 'FinOps'];
  const panels = [<ShowcaseOverview />, <ShowcaseHealing />, <ShowcaseFinops />];

  return (
    <div style={{
      position: 'relative',
      background: '#fff', borderRadius: 22, border: '1px solid rgba(0,0,0,.08)',
      boxShadow: '0 32px 80px rgba(15,60,165,.18), 0 8px 16px rgba(0,0,0,.05)',
      overflow: 'hidden',
      animation: 'float 6s ease-in-out infinite',
    }}>
      {/* Chrome */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        borderBottom: '1px solid rgba(0,0,0,.06)', background: '#FAFBFE',
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={dot('#FF5F57')} />
          <span style={dot('#FEBC2E')} />
          <span style={dot('#28C840')} />
        </div>
        <div style={{
          flex: 1, height: 24, borderRadius: 6, background: '#fff',
          border: '1px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 10px', fontFamily: 'DM Mono', fontSize: 11, color: '#6B6B6B',
        }}>
          <Icon name="cluster" size={11} color="#0F3CA5" />
          kodo.kubenetworks.com.br/<span style={{ color: '#1A1A1A' }}>clusters/prod-us-east-1</span>
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
            cursor: 'pointer', marginBottom: -1, transition: 'color 200ms',
          }}>{t}</button>
        ))}
      </div>

      {/* 3D slide stage */}
      <div className="kdo-stage" style={{ padding: 22, minHeight: 360 }}>
        <div className="kdo-stage-inner" key={tab} data-dir={dir}>
          {panels[tab]}
        </div>
      </div>
    </div>
  );
}

function dot(color) {
  return { width: 11, height: 11, borderRadius: 99, background: color };
}

function ShowcaseOverview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { l: 'PODS', v: '248', t: '#1A1A1A' },
          { l: 'NODES', v: '14', t: '#1A1A1A' },
          { l: 'CPU', v: '62%', t: '#0F3CA5' },
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
        <svg viewBox="0 0 320 100" style={{ width: '100%', height: 110 }}>
          <defs>
            <linearGradient id="hg2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0F3CA5" stopOpacity=".25" />
              <stop offset="100%" stopColor="#0F3CA5" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 78 L20 72 40 76 60 60 80 65 100 50 120 56 140 38 160 44 180 28 200 36 220 22 240 32 260 18 280 26 300 14 320 22 L320 100 0 100 Z" fill="url(#hg2)" />
          <path d="M0 78 L20 72 40 76 60 60 80 65 100 50 120 56 140 38 160 44 180 28 200 36 220 22 240 32 260 18 280 26 300 14 320 22" stroke="#0F3CA5" strokeWidth="2" fill="none" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { n: 'api-gateway',   ns: 'default',   s: 'ok' },
          { n: 'payments-svc',  ns: 'billing',   s: 'ok' },
          { n: 'analytics-job', ns: 'analytics', s: 'warn' },
          { n: 'auth-svc',      ns: 'identity',  s: 'ok' },
        ].map(p => (
          <div key={p.n} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            background: '#F0F4FA', borderRadius: 10,
          }}>
            <Icon name="namespace" size={14} color="#0F3CA5" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'DM Mono', fontSize: 11, color: '#1A1A1A', fontWeight: 500 }}>{p.n}</div>
              <div style={{ fontSize: 10, color: '#6B6B6B' }}>{p.ns}</div>
            </div>
            <Pill tone={p.s}>{p.s === 'ok' ? 'Saudável' : 'Atenção'}</Pill>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShowcaseHealing() {
  const events = [
    { t: '14:23:08', m: 'pod payments-7d4b reiniciado · 2.1s', tag: 'ok' },
    { t: '14:21:54', m: 'OOMKill detectado · cap aumentado +256Mi', tag: 'info' },
    { t: '14:18:30', m: 'liveness probe falhou · iniciando heal', tag: 'warn' },
    { t: '14:14:02', m: 'rollout analytics-job concluído', tag: 'ok' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        background: '#DCFCE7', border: '1px solid rgba(22,163,74,.20)',
        borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{
          width: 36, height: 36, borderRadius: 999, background: '#16A34A',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name="heal" size={18} color="#fff" /></span>
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
            <Pill tone={e.tag === 'ok' ? 'ok' : e.tag === 'warn' ? 'warn' : 'info'}>{e.tag.toUpperCase()}</Pill>
            <span style={{ fontSize: 12, color: '#1A1A1A', flex: 1 }}>{e.m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShowcaseFinops() {
  const rows = [
    { ns: 'analytics-eks',  c: 'R$ 2.820', d: '+18%', t: 'warn' },
    { ns: 'prod-us-east-1', c: 'R$ 1.240', d: '−12%', t: 'ok' },
    { ns: 'staging-eks',    c: 'R$ 380',   d: '+2%',  t: 'neutral' },
    { ns: 'data-pipelines', c: 'R$ 690',   d: '−34%', t: 'ok' },
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
          return <rect key={i} x={i * 16 + 2} y={90 - h} width="12" height={h} rx="2" fill={i > 14 ? '#0F3CA5' : 'rgba(15,60,165,.35)'} style={{ transformOrigin: `${i * 16 + 8}px 90px`, animation: `bar ${1.6 + (i % 4) * .2}s ease-in-out infinite`, animationDelay: `${i * 60}ms` }} />;
        })}
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(r => (
          <div key={r.ns} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
            background: '#F0F4FA', borderRadius: 10,
          }}>
            <Icon name="finops" size={14} color="#0F3CA5" />
            <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: '#1A1A1A', flex: 1 }}>{r.ns}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{r.c}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: r.t === 'ok' ? '#14532D' : r.t === 'warn' ? '#713F12' : '#6B6B6B', minWidth: 48, textAlign: 'right' }}>{r.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Hero });

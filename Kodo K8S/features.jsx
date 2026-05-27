/* Features — 4 pilares com demo interativo */

function Features() {
  const pillars = [
    {
      id: 'heal', icon: 'heal', label: 'Auto-healing',
      h: 'Clusters se curam sozinhos.',
      sub: 'O agente IA identifica falhas — OOMKills, pods em CrashLoop, probes falhando — e aplica a correção antes do alerta sair.',
      stat: '2.4s', statL: 'Heal médio',
    },
    {
      id: 'fin', icon: 'finops', label: 'FinOps',
      h: 'Custo claro. Decisões rápidas.',
      sub: 'Veja o gasto por namespace, time e workload. Recomendações de right-sizing aplicáveis em um clique.',
      stat: '−34%', statL: 'Redução média',
    },
    {
      id: 'sec', icon: 'security', label: 'Segurança',
      h: 'CVE, RBAC e secrets vigiados.',
      sub: 'Scan contínuo de imagens, políticas Kyverno/OPA prontas e alertas para drift de permissões em namespaces críticos.',
      stat: '14k+', statL: 'CVEs cobertos',
    },
    {
      id: 'obs', icon: 'pulse', label: 'Observabilidade',
      h: 'Métricas, logs e traces no mesmo lugar.',
      sub: 'Compatível com Prometheus, OpenTelemetry e Loki — sem precisar reescrever a stack que você já tem.',
      stat: '99.8%', statL: 'Uptime SLO',
    },
  ];
  const [active, setActive] = React.useState(0);

  return (
    <section id="features" style={{ background: '#fff', padding: 'var(--d-section-y) var(--d-section-px)' }}>
      <div className="kdo-inner">
        <Eyebrow>Os quatro pilares</Eyebrow>
        <h2 className="kdo-h2">Tudo que um time de SRE precisa.<br /><span style={{ color: '#6B6B6B' }}>Nada do que não precisa.</span></h2>
        <p className="kdo-sub">Quatro produtos integrados, uma única conta. Você ativa o que faz sentido para o seu cluster e desliga o resto.</p>

        {/* Tabs */}
        <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'stretch' }}>
          {/* Tab list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pillars.map((p, i) => (
              <button key={p.id} onClick={() => setActive(i)} style={{
                textAlign: 'left', background: active === i ? '#0F3CA5' : '#fff',
                color: active === i ? '#fff' : '#1A1A1A',
                border: '1px solid ' + (active === i ? '#0F3CA5' : 'rgba(0,0,0,.08)'),
                borderRadius: 16, padding: '20px 22px', cursor: 'pointer',
                transition: 'all 200ms cubic-bezier(.2,.7,.2,1)',
                display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 16, alignItems: 'center',
              }}>
                <span style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: active === i ? 'rgba(255,255,255,.12)' : '#E6EEF8',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name={p.icon} size={20} color={active === i ? '#fff' : '#0F3CA5'} />
                </span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: active === i ? .85 : .6 }}>{p.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2 }}>{p.h}</div>
                </div>
                <Icon name="arrow" size={18} color={active === i ? '#fff' : '#6B6B6B'} />
              </button>
            ))}
          </div>

          {/* Active panel */}
          <FeatureDemo pillar={pillars[active]} />
        </div>
      </div>
    </section>
  );
}

function FeatureDemo({ pillar }) {
  return (
    <div className="kdo-card" style={{
      background: '#0B1733', color: '#fff', borderRadius: 20,
      padding: 28, display: 'flex', flexDirection: 'column', gap: 18,
      border: '1px solid rgba(255,255,255,.08)', minHeight: 460,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative dots — removed per design feedback */}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <Pill tone="info" style={{ background: 'rgba(255,255,255,.10)', color: '#fff' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 0 0 rgba(22,163,74,.55)', animation: 'live 1.6s ease-out infinite' }} />
          LIVE · {pillar.label}
        </Pill>
        <span style={{ fontFamily: 'DM Mono', fontSize: 11, opacity: .6 }}>prod-us-east-1</span>
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: .55 }}>{pillar.label}</div>
        <h3 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 1.1, color: '#fff' }}>{pillar.h}</h3>
        <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,.7)' }}>{pillar.sub}</p>
      </div>

      {/* Per-pillar mini visual */}
      <div style={{ flex: 1, position: 'relative', marginTop: 6 }}>
        {pillar.id === 'heal' && <HealMini />}
        {pillar.id === 'fin'  && <FinMini />}
        {pillar.id === 'sec'  && <SecMini />}
        {pillar.id === 'obs'  && <ObsMini />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 16, position: 'relative' }}>
        <div>
          <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: '#fff' }}>{pillar.stat}</div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', marginTop: 4 }}>{pillar.statL}</div>
        </div>
        <Btn variant="ghost" iconRight="arrow" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.18)' }}>Ver docs</Btn>
      </div>
    </div>
  );
}

function HealMini() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[
        { t: '14:23:08', m: 'pod payments-7d4b reiniciado · 2.1s', tag: 'OK' },
        { t: '14:21:54', m: 'OOMKill detectado · cap +256Mi', tag: 'INFO' },
        { t: '14:18:30', m: 'liveness falhou · iniciando heal', tag: 'WARN' },
      ].map((e, i) => (
        <div key={i} className="slide-in" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '10px 12px',
          animationDelay: `${i * 120}ms`,
        }}>
          <span style={{ fontFamily: 'DM Mono', fontSize: 10, color: 'rgba(255,255,255,.5)', width: 60 }}>{e.t}</span>
          <span style={{
            fontFamily: 'DM Mono', fontSize: 10, fontWeight: 600, color: e.tag === 'OK' ? '#86EFAC' : e.tag === 'WARN' ? '#FCD34D' : '#93C5FD',
            background: 'rgba(255,255,255,.06)', padding: '2px 6px', borderRadius: 4,
          }}>{e.tag}</span>
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
          const recent = i > 12;
          return (
            <span key={i} style={{
              flex: 1, height: `${h}%`, borderRadius: 4,
              background: recent ? '#0F3CA5' : 'rgba(255,255,255,.18)',
              transformOrigin: 'bottom',
              animation: `bar ${1.4 + (i % 4) * .2}s ease-in-out infinite`,
              animationDelay: `${i * 60}ms`,
            }} />
          );
        })}
      </div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          ['analytics-eks', 'R$ 2.820', '+18%'],
          ['prod-us-east-1', 'R$ 1.240', '−12%'],
        ].map(([n, v, d]) => (
          <div key={n} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: 10 }}>
            <div style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'rgba(255,255,255,.7)' }}>{n}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{v}</span>
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
    { name: 'nginx:1.21.6', sev: 'CRITICAL', n: 3, c: '#FCA5A5' },
    { name: 'redis:6.2', sev: 'HIGH', n: 1, c: '#FCD34D' },
    { name: 'node:18-alpine', sev: 'CLEAN', n: 0, c: '#86EFAC' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'rgba(255,255,255,.6)' }}>Scan · prod-us-east-1</span>
        <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'rgba(255,255,255,.6)' }}>há 4 min</span>
      </div>
      {rows.map(r => (
        <div key={r.name} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '10px 12px',
        }}>
          <Icon name="security" size={14} color={r.c} />
          <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: '#fff', flex: 1 }}>{r.name}</span>
          <span style={{ fontFamily: 'DM Mono', fontSize: 10, color: r.c, fontWeight: 700 }}>{r.sev}</span>
          <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'rgba(255,255,255,.6)', width: 20, textAlign: 'right' }}>{r.n}</span>
        </div>
      ))}
      <div style={{
        padding: '10px 12px', background: 'rgba(22,163,74,.18)', border: '1px solid rgba(22,163,74,.35)',
        borderRadius: 10, fontSize: 12, color: '#86EFAC', fontFamily: 'DM Mono',
      }}>
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
      <div style={{
        marginTop: 4, fontFamily: 'DM Mono', fontSize: 11, color: 'rgba(255,255,255,.85)',
        background: '#000', padding: 12, borderRadius: 8, lineHeight: 1.7,
      }}>
        <div style={{ color: '#6B7DAA' }}>$ kubectl top pods -n payments</div>
        <div>NAME             CPU    MEM</div>
        <div>api-gw-7d4b      <span style={{ color: '#86EFAC' }}>12m</span>   84Mi</div>
        <div>worker-q9        <span style={{ color: '#FCD34D' }}>340m</span>  512Mi</div>
      </div>
    </div>
  );
}

Object.assign(window, { Features });

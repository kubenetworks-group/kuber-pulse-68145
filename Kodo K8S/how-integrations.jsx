/* Como funciona + Integrações */

function HowItWorks() {
  const steps = [
    {
      n: '01', t: 'Conecte seu cluster',
      sub: 'Um único helm install. Multi-cloud, on-prem ou híbrido — o agente Kodo descobre nodes, pods e namespaces em 30 segundos.',
      tag: 'helm install kodo/agent',
    },
    {
      n: '02', t: 'O agente IA aprende a baseline',
      sub: 'Nas primeiras 48h, o Kodo observa tráfego, custo e padrões de incidente. Sem regras escritas à mão — você só ajusta o que faz sentido.',
      tag: 'baseline · 48h',
    },
    {
      n: '03', t: 'Auto-healing começa a agir',
      sub: 'OOMKills, probes em falha e drifts de config são corrigidos sozinhos. Você é notificado com o "antes/depois", nunca acordado às 3am.',
      tag: 'heal médio 2.4s',
    },
    {
      n: '04', t: 'FinOps vira rotina',
      sub: 'Recomendações de right-sizing aparecem semanalmente, com PR pronto para abrir. Pague pelo que usa, prove pra finance.',
      tag: '−34% custo médio',
    },
  ];
  return (
    <section id="como" style={{
      background: 'var(--bg)', padding: 'var(--d-section-y) var(--d-section-px)',
      position: 'relative',
    }}>
      <div className="kdo-inner">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 64, alignItems: 'start' }}>
          <div style={{ position: 'sticky', top: 100 }}>
            <Eyebrow>Como funciona</Eyebrow>
            <h2 className="kdo-h2">Do zero ao auto-healing.<br/><span style={{ color: '#0F3CA5' }}>Em menos de uma tarde.</span></h2>
            <p className="kdo-sub">Sem ETL, sem reescrita de stack. O agente Kodo se instala como qualquer Helm chart e começa a entregar valor antes do café esfriar.</p>
            <div style={{ marginTop: 28, display: 'flex', gap: 12 }}>
              <Btn variant="indigo" iconRight="arrow">Ver guia de instalação</Btn>
              <Btn variant="ghost">Falar com um SRE</Btn>
            </div>
          </div>

          <div>
            {steps.map((s, i) => (
              <div key={s.n} style={{
                display: 'grid', gridTemplateColumns: '64px 1fr', gap: 24,
                paddingBottom: 32, position: 'relative',
              }}>
                {/* Vertical line */}
                {i < steps.length - 1 && (
                  <span style={{
                    position: 'absolute', top: 56, bottom: 0, left: 31, width: 1,
                    background: 'rgba(15,60,165,.18)',
                  }} />
                )}
                {/* Step number */}
                <div style={{
                  width: 64, height: 64, borderRadius: 18, background: '#fff',
                  border: '1px solid rgba(0,0,0,.08)', boxShadow: '0 1px 2px rgba(15,60,165,.05)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Aileron', fontWeight: 900, fontSize: 22, color: '#0F3CA5', letterSpacing: '-0.02em',
                }}>{s.n}</div>
                <div style={{ paddingTop: 6 }}>
                  <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.025em', color: '#1A1A1A' }}>{s.t}</h3>
                  <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.6, color: '#6B6B6B', maxWidth: 540 }}>{s.sub}</p>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12,
                    padding: '6px 10px', background: '#fff', border: '1px solid rgba(0,0,0,.08)',
                    borderRadius: 8, fontFamily: 'DM Mono', fontSize: 12, color: '#1A1A1A',
                  }}>
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
  );
}

function Integrations() {
  const clouds = [
    { id: 'aws',   name: 'Amazon EKS', sub: 'us-east-1 · sa-east-1 · multi-AZ',     icon: 'aws' },
    { id: 'gcp',   name: 'Google GKE', sub: 'Autopilot · Standard · multi-region',   icon: 'gcp' },
    { id: 'azure', name: 'Azure AKS',  sub: 'BR-South · East-US · híbrido',          icon: 'azure' },
  ];
  const tools = [
    { name: 'Prometheus',     icon: 'prometheus' },
    { name: 'OpenTelemetry',  icon: 'opentelemetry' },
    { name: 'Grafana',        icon: 'grafana' },
    { name: 'Helm',           icon: 'helm' },
    { name: 'Slack',          icon: 'slack' },
    { name: 'PagerDuty',      icon: 'pagerduty' },
    { name: 'Datadog',        icon: 'datadog' },
    { name: 'New Relic',      icon: 'newrelic' },
    { name: 'GitHub Actions', icon: 'github' },
    { name: 'GitLab CI',      icon: 'gitlab' },
    { name: 'ArgoCD',         icon: 'argocd' },
    { name: 'Jenkins',        icon: 'jenkins' },
    { name: 'Nginx',          icon: 'nginx' },
    { name: 'Elastic',        icon: 'elastic' },
    { name: 'Redis',          icon: 'redis' },
    { name: 'Vault',          icon: 'vault' },
    { name: 'Cloudflare',     icon: 'cloudflare' },
    { name: 'Terraform',      icon: 'terraform' },
  ];
  const [selected, setSelected] = React.useState(0);

  return (
    <section id="integracoes" style={{
      background: '#fff', padding: 'var(--d-section-y) var(--d-section-px)',
    }}>
      <div className="kdo-inner">
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
          {clouds.map((c, i) => (
            <button key={c.id} onClick={() => setSelected(i)} style={{
              textAlign: 'left', cursor: 'pointer',
              background: selected === i ? '#0F3CA5' : '#fff',
              color: selected === i ? '#fff' : '#1A1A1A',
              border: '1px solid ' + (selected === i ? '#0F3CA5' : 'rgba(0,0,0,.08)'),
              borderRadius: 18, padding: 24,
              display: 'flex', flexDirection: 'column', gap: 16,
              transition: 'all 200ms cubic-bezier(.2,.7,.2,1)',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <BrandIcon name={c.icon} tile tileSize={56} monochrome={selected === i ? '#FFFFFF' : null} />
                <Pill tone={selected === i ? 'ink' : 'ok'} style={selected === i ? { background: 'rgba(255,255,255,.15)', color: '#fff' } : {}}>Certificado</Pill>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em' }}>{c.name}</div>
                <div style={{ fontFamily: 'DM Mono', fontSize: 12, opacity: .7, marginTop: 4 }}>{c.sub}</div>
              </div>
              <div style={{
                marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingTop: 16, borderTop: '1px solid ' + (selected === i ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.06)'),
              }}>
                <span style={{ fontSize: 12, opacity: .8 }}>Conectar em ~30s</span>
                <Icon name="arrow" size={16} color={selected === i ? '#fff' : '#0F3CA5'} />
              </div>
            </button>
          ))}
        </div>

        {/* Tools mesh */}
        <div style={{
          marginTop: 32, background: 'var(--bg)', borderRadius: 24,
          padding: 32, border: '1px solid rgba(0,0,0,.06)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 32, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#0F3CA5' }}>+ 60 ferramentas</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em', marginTop: 4 }}>Ecossistema CNCF nativo</div>
              <div style={{ fontSize: 14, color: '#6B6B6B', marginTop: 6, maxWidth: 280 }}>Métricas, alertas, deploys, segurança — tudo bidirecional, sem proxies.</div>
            </div>
            <div style={{ position: 'relative', overflow: 'hidden', maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}>
              <div className="kdo-marquee">
                {[...tools, ...tools].map((t, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    height: 44, padding: '0 18px 0 10px', background: '#fff', borderRadius: 999,
                    border: '1px solid rgba(0,0,0,.08)', fontFamily: 'Aileron',
                    fontWeight: 700, fontSize: 14, color: '#1A1A1A', letterSpacing: '-0.01em',
                  }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: '50%', background: '#F0F4FA',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      flex: '0 0 28px',
                    }}>
                      <BrandIcon name={t.icon} size={18} />
                    </span>
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { HowItWorks, Integrations });

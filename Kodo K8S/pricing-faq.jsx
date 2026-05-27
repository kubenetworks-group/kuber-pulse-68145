/* Pricing + FAQ + CTA */

function Pricing() {
  const [period, setPeriod] = React.useState('monthly');
  const plans = [
    {
      id: 'starter', name: 'Starter', price: { monthly: 'Grátis', annual: 'Grátis' }, period: 'sempre',
      sub: 'Para validar o Kodo num cluster pequeno.',
      feats: ['1 cluster', 'Até 3 nodes', 'Alertas básicos', 'Auto-healing essencial', 'Comunidade'],
      cta: 'Começar agora', variant: 'ghost',
    },
    {
      id: 'pro', name: 'Pro', price: { monthly: 'R$ 90', annual: 'R$ 72' }, period: 'mês / cluster',
      featured: true, sub: 'O ponto doce para times de 5 a 50 engenheiros.',
      feats: ['10 clusters', 'Auto-healing + IA SRE', 'FinOps completo', 'Scan de segurança', 'Slack + PagerDuty', 'Suporte 24/5'],
      cta: 'Assinar Pro', variant: 'indigo',
    },
    {
      id: 'ent', name: 'Enterprise', price: { monthly: 'Custom', annual: 'Custom' }, period: '',
      sub: 'Compliance, governança e SLA dedicado.',
      feats: ['Clusters ilimitados', 'SLA 99.99%', 'On-prem + air-gapped', 'CS dedicado', 'SAML / SSO / SCIM', 'Auditoria LGPD/SOC2'],
      cta: 'Falar com vendas', variant: 'ink',
    },
  ];

  return (
    <section id="precos" style={{ background: 'var(--bg)', padding: 'var(--d-section-y) var(--d-section-px)' }}>
      <div className="kdo-inner">
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
          <Eyebrow style={{ justifyContent: 'center' }}>Preços</Eyebrow>
          <h2 className="kdo-h2" style={{ textAlign: 'center' }}>Pague pelo que usar. <br/><span style={{ color: '#6B6B6B' }}>Cresça sem surpresas.</span></h2>
          <p className="kdo-sub" style={{ margin: '18px auto 0', textAlign: 'center' }}>Sem mínimo de compromisso. Sem custo por usuário. O cluster é a sua unidade — assim como na sua infra.</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
          <div className="kdo-tabs">
            <button className="kdo-tab" aria-selected={period === 'monthly'} onClick={() => setPeriod('monthly')}>Mensal</button>
            <button className="kdo-tab" aria-selected={period === 'annual'} onClick={() => setPeriod('annual')}>
              Anual <span style={{ marginLeft: 6, fontSize: 11, color: '#16A34A' }}>−20%</span>
            </button>
          </div>
        </div>

        <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {plans.map(p => (
            <div key={p.id} style={{
              position: 'relative', background: p.featured ? '#0F3CA5' : '#fff',
              color: p.featured ? '#fff' : '#1A1A1A',
              borderRadius: 22,
              border: p.featured ? '2px solid #0F3CA5' : '1px solid rgba(0,0,0,.08)',
              boxShadow: p.featured ? '0 32px 80px rgba(15,60,165,.25)' : '0 1px 2px rgba(15,60,165,.05)',
              padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 18,
              transform: p.featured ? 'translateY(-12px)' : 'none',
              minHeight: 540,
            }}>
              {p.featured && (
                <span style={{
                  position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                  height: 28, padding: '0 14px', borderRadius: 999, background: '#1A1A1A',
                  color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                  display: 'inline-flex', alignItems: 'center', textTransform: 'uppercase',
                }}>Mais popular</span>
              )}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: p.featured ? .85 : .55 }}>{p.name}</div>
                <p style={{ marginTop: 4, fontSize: 14, lineHeight: 1.4, color: p.featured ? 'rgba(255,255,255,.85)' : '#6B6B6B', maxWidth: 240 }}>{p.sub}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-0.035em', lineHeight: 1 }}>{p.price[period]}</span>
                {p.period && <span style={{ fontSize: 13, opacity: .7 }}>/ {p.period}</span>}
              </div>
              <Btn
                variant={p.variant}
                size="lg"
                iconRight="arrow"
                style={{
                  width: '100%',
                  background: p.featured ? '#fff' : undefined,
                  color: p.featured ? '#0F3CA5' : undefined,
                  borderColor: p.featured ? '#fff' : undefined,
                }}
              >{p.cta}</Btn>
              <div style={{ height: 1, background: p.featured ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.06)', margin: '4px 0' }} />
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                {p.feats.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.4 }}>
                    <Icon name="success" size={16} color={p.featured ? '#86EFAC' : '#16A34A'} style={{ marginTop: 2 }} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Comparison strip */}
        <div style={{
          marginTop: 40, background: '#fff', borderRadius: 18, padding: '20px 24px',
          border: '1px solid rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: '#E6EEF8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="grid" size={20} color="#0F3CA5" />
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#1A1A1A' }}>Time com mais de 50 engenheiros?</div>
              <div style={{ fontSize: 13, color: '#6B6B6B' }}>Onboarding dedicado, SAML/SSO e relatórios FinOps customizados.</div>
            </div>
          </div>
          <Btn variant="ink" iconRight="arrow">Agendar conversa</Btn>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const items = [
    {
      q: 'O Kodo substitui Prometheus, Grafana ou Datadog?',
      a: 'Não. O Kodo se conecta às ferramentas que você já usa. Lemos métricas de Prometheus/OpenTelemetry, deploys de Argo/Flux e alertas via Slack/PagerDuty. Pense no Kodo como uma camada de inteligência por cima da sua stack — não um substituto.',
    },
    {
      q: 'O que o agente IA realmente faz?',
      a: 'Detecta padrões de incidente (OOMKill, CrashLoopBackOff, liveness/readiness em falha, drift de config), correlaciona com tráfego e custo, e aplica correções pré-aprovadas pelo seu time. Você define o nível de autonomia: só sugerir, sugerir e abrir PR, ou aplicar direto em prod com rollback automático.',
    },
    {
      q: 'Funciona em cluster on-premises?',
      a: 'Sim — o agente é stateless e roda em qualquer cluster K8s ≥ 1.24. Para ambientes air-gapped, o plano Enterprise inclui uma versão do control-plane self-hosted que conversa via mTLS, sem precisar de internet de saída.',
    },
    {
      q: 'Quais dados o Kodo guarda? E LGPD?',
      a: 'Metadados de cluster (nomes de pods, namespaces, métricas agregadas) e logs de incidentes. Nunca conteúdo de aplicação. Estamos em conformidade com LGPD e SOC2 Type II. DPA disponível para times Pro e Enterprise.',
    },
    {
      q: 'Posso desligar o auto-healing?',
      a: 'Sim, a qualquer momento, por cluster ou por namespace. O modo padrão é "sugerir e abrir PR" — você só liga aplicação direta quando confiar nas runbooks. Reverter um heal é um clique.',
    },
    {
      q: 'Como o Kodo cobra um cluster pequeno vs um grande?',
      a: 'O preço Pro (R$ 90/mês) cobre clusters até 50 nodes. Acima disso, há tiers por faixas — sempre publicados, sem "fale com vendas" surpresa. O Starter cobre 1 cluster com até 3 nodes para sempre, sem cartão.',
    },
  ];
  return (
    <section id="faq" style={{ background: '#fff', padding: 'var(--d-section-y) var(--d-section-px)' }}>
      <div className="kdo-inner kdo-faq" style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 80, alignItems: 'start' }}>
        <div style={{ position: 'sticky', top: 100 }}>
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="kdo-h2">Perguntas que você ia fazer mesmo.</h2>
          <p className="kdo-sub">Se não respondemos aqui, mande um e-mail — geralmente um engenheiro responde no mesmo dia.</p>
          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <Btn variant="ghost" icon="auth">contato@kubenetworks.com.br</Btn>
          </div>
        </div>
        <div>
          {items.map((it, i) => (
            <details key={i} open={i === 0}>
              <summary>
                {it.q}
                <span className="plus">+</span>
              </summary>
              <div className="answer">{it.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section style={{ background: 'var(--bg)', padding: '40px var(--d-section-px) var(--d-section-y)' }}>
      <div className="kdo-inner" style={{
        background: '#1A1A1A', color: '#fff', borderRadius: 28,
        padding: '72px 64px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative grid */}
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
              <span className="live-dot" style={{ background: '#16A34A' }} />
              Onboarding em ~30 minutos
            </Pill>
            <h2 style={{
              margin: '20px 0 0', fontFamily: 'Aileron', fontWeight: 900,
              fontSize: 'clamp(40px, 4.4vw, 64px)', letterSpacing: '-0.035em',
              lineHeight: 1, color: '#fff', textWrap: 'balance',
            }}>
              Comece a curar seus clusters <span style={{ color: '#86A8FF' }}>hoje à tarde.</span>
            </h2>
            <p style={{ marginTop: 18, fontSize: 17, lineHeight: 1.5, color: 'rgba(255,255,255,.7)', maxWidth: 520 }}>
              14 dias do plano Pro, sem cartão. Se o auto-healing não economizar mais que o preço do plano no primeiro mês, devolvemos.
            </p>
            <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Btn variant="indigo" size="lg" iconRight="arrow" style={{ background: '#fff', color: '#0F3CA5' }}>Começar grátis</Btn>
              <Btn variant="ghost" size="lg" icon="deploy" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.25)' }}>Agendar demo</Btn>
            </div>
          </div>
          <div style={{
            background: '#0B1733', borderRadius: 16, padding: 20, border: '1px solid rgba(255,255,255,.08)',
            fontFamily: 'DM Mono', fontSize: 13, lineHeight: 1.8,
          }}>
            <div style={{ color: '#6B7DAA', marginBottom: 6 }}># instalar o agente Kodo</div>
            <div style={{ color: '#fff' }}>$ helm repo add kodo <span style={{ color: '#86A8FF' }}>https://charts.kodo.dev</span></div>
            <div style={{ color: '#fff' }}>$ helm install kodo-agent kodo/agent \</div>
            <div style={{ color: '#fff' }}>{'\u00A0\u00A0'}--namespace kodo --create-namespace</div>
            <div style={{ color: '#6B7DAA', marginTop: 14 }}># 1 min depois...</div>
            <div style={{ color: '#86EFAC' }}>✓ agente conectado · 14 nodes · 248 pods</div>
            <div style={{ color: '#86EFAC' }}>✓ baseline iniciada · ETA 48h</div>
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Pricing, Faq, FinalCTA });

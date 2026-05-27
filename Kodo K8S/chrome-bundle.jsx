/* Top nav + footer */

function Nav() {
  const items = ['Produto', 'Como funciona', 'Integrações', 'Preços', 'FAQ'];
  const slugs = ['produto', 'como', 'integracoes', 'precos', 'faq'];
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: scrolled ? 'rgba(240,244,250,.85)' : 'transparent',
      backdropFilter: scrolled ? 'saturate(180%) blur(12px)' : 'none',
      WebkitBackdropFilter: scrolled ? 'saturate(180%) blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(0,0,0,.06)' : '1px solid transparent',
      padding: '14px var(--d-section-px)',
      transition: 'all 200ms cubic-bezier(.2,.7,.2,1)',
    }}>
      <div style={{
        maxWidth: 1440, margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 32,
      }}>
        <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={(window.__resources && window.__resources.logoInk) || 'assets/logo/kodo-symbol.png'} alt="" style={{ width: 30, height: 30 }} />
          <span style={{ fontFamily: 'Aileron', fontWeight: 900, fontSize: 22, letterSpacing: '-0.04em', color: '#1A1A1A' }}>
            Kodo
          </span>
        </a>
        <nav style={{ justifySelf: 'center', display: 'flex', gap: 4 }}>
          {items.map((label, i) => (
            <a key={label} href={`#${slugs[i]}`} style={{
              height: 34, padding: '0 14px', borderRadius: 999,
              display: 'inline-flex', alignItems: 'center',
              fontWeight: 500, fontSize: 14, color: '#1A1A1A',
              transition: 'background 200ms',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(15,60,165,.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >{label}</a>
          ))}
        </nav>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Btn variant="plain" size="sm">Entrar</Btn>
          <Btn variant="ink" size="sm" iconRight="arrow">Começar grátis</Btn>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const cols = [
    { h: 'Produto',  links: ['Auto-healing', 'FinOps', 'Segurança', 'Observabilidade', 'IA SRE'] },
    { h: 'Recursos', links: ['Docs', 'API', 'Status', 'Changelog', 'Integrações'] },
    { h: 'Empresa',  links: ['Sobre', 'Blog', 'Carreiras', 'Imprensa', 'Contato'] },
    { h: 'Legal',    links: ['Termos', 'Privacidade', 'Segurança', 'DPA', 'LGPD'] },
  ];
  return (
    <footer style={{ background: '#1A1A1A', color: '#fff', padding: '88px var(--d-section-px) 40px' }}>
      <div style={{ maxWidth: 1440, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', gap: 48, alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={(window.__resources && window.__resources.logoWhite) || 'assets/logo/kodo-symbol-white.png'} alt="" style={{ width: 32, height: 32 }} />
              <span style={{ fontFamily: 'Aileron', fontWeight: 900, fontSize: 24, letterSpacing: '-0.04em' }}>Kodo</span>
            </div>
            <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,.65)', maxWidth: 320 }}>
              Plataforma cloud-native para times de engenharia que querem Kubernetes sem ruído.
              Auto-healing, FinOps e segurança em uma só plataforma.
            </p>
            <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
              <a href="#" style={socialBtn}><Icon name="external" size={14} color="#fff" /></a>
              <a href="#" style={socialBtn}><Icon name="cloud" size={14} color="#fff" /></a>
              <a href="#" style={socialBtn}><Icon name="auth" size={14} color="#fff" /></a>
            </div>
          </div>
          {cols.map(c => (
            <div key={c.h}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 16 }}>{c.h}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.links.map(l => <li key={l}><a href="#" style={{ color: 'rgba(255,255,255,.85)', fontSize: 14, transition: 'color 200ms' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.85)'}
                >{l}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 56, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.10)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'rgba(255,255,255,.45)', flexWrap: 'wrap', gap: 12
        }}>
          <span>© 2025 Kubenetworks · kodo.kubenetworks.com.br</span>
          <span style={{ fontFamily: 'DM Mono' }}>v2.0 · Tema Indigo Dusk · São Paulo, BR</span>
        </div>
      </div>
    </footer>
  );
}

const socialBtn = {
  width: 36, height: 36, borderRadius: 999, background: 'rgba(255,255,255,.06)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 200ms',
};

Object.assign(window, { Nav, Footer });

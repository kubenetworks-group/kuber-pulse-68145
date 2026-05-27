/* Kodo primitives — Icon, Btn, Pill */

function Icon({ name, size = 16, color, style = {} }) {
  const src = (window.__resources && window.__resources['icon_' + name]) || `assets/icons/${name}.svg`;
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size, height: size,
        backgroundColor: color || 'currentColor',
        WebkitMask: `url(${src}) center / contain no-repeat`,
        mask: `url(${src}) center / contain no-repeat`,
        flex: '0 0 auto',
        ...style,
      }}
    />
  );
}

function Btn({ variant = 'ghost', size = 'md', icon, iconRight, children, onClick, style }) {
  const btnStyles = {
    base: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontFamily: 'Aileron, sans-serif', fontWeight: 600,
      borderRadius: size === 'sm' ? 10 : 14, border: '1px solid transparent',
      cursor: 'pointer', transition: 'all 200ms cubic-bezier(.2,.7,.2,1)',
      lineHeight: 1, whiteSpace: 'nowrap',
      height: size === 'sm' ? 34 : (size === 'lg' ? 48 : 40),
      padding: size === 'sm' ? '0 14px' : (size === 'lg' ? '0 22px' : '0 18px'),
      fontSize: size === 'sm' ? 13 : (size === 'lg' ? 15 : 14),
    },
    indigo: { background: '#0F3CA5', color: '#fff', boxShadow: '0 1px 2px rgba(15,60,165,.18)' },
    ink:    { background: '#1A1A1A', color: '#fff' },
    ghost:  { background: '#fff', color: '#1A1A1A', borderColor: 'rgba(0,0,0,.14)' },
    plain:  { background: 'transparent', color: '#1A1A1A' },
  };
  const [hover, setHover] = React.useState(false);
  const hoverBg = { indigo: '#0A2D7E', ink: '#333', ghost: '#F0F4FA', plain: 'rgba(15,60,165,.06)' }[variant];
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...btnStyles.base, ...btnStyles[variant],
        background: hover ? hoverBg : btnStyles[variant].background,
        ...(style || {})
      }}
    >
      {icon && <Icon name={icon} size={15} />}
      {children}
      {iconRight && <Icon name={iconRight} size={15} />}
    </button>
  );
}

function Pill({ tone = 'info', dot = true, children, style }) {
  const palette = {
    ok:   { bg: '#DCFCE7', fg: '#14532D', dot: '#16A34A' },
    warn: { bg: '#FEF9C3', fg: '#713F12', dot: '#CA8A04' },
    err:  { bg: '#FEE2E2', fg: '#7F1D1D', dot: '#DC2626' },
    info: { bg: '#E6EEF8', fg: '#0F3CA5', dot: '#0F3CA5' },
    ink:  { bg: '#1A1A1A', fg: '#fff',    dot: '#fff' },
    neutral: { bg: '#F0F4FA', fg: '#1A1A1A', dot: '#9B9B9B' },
  }[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 24, padding: '0 10px', borderRadius: 999,
      fontWeight: 600, fontSize: 11,
      background: palette.bg, color: palette.fg,
      ...(style || {})
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: palette.dot }} />}
      {children}
    </span>
  );
}

function Eyebrow({ children, style }) {
  return (
    <span className="kdo-eyebrow" style={style}>{children}</span>
  );
}

function MonoTag({ children, style }) {
  return (
    <span style={{
      fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#6B6B6B',
      background: '#F0F4FA', padding: '3px 8px', borderRadius: 6,
      border: '1px solid rgba(0,0,0,.06)',
      ...(style || {})
    }}>{children}</span>
  );
}

Object.assign(window, { Icon, Btn, Pill, Eyebrow, MonoTag });

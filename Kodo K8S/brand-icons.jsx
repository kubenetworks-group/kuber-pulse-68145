/* Brand icons — Iconify "logos" collection.
   Each icon is fetched as an SVG from https://api.iconify.design/logos/<slug>.svg
   and rendered as a normal <img>. For "monochrome" mode (used on the selected
   cloud card) we apply a CSS filter that flattens the color to white. */

const ICON_SLUGS = {
  // Clouds
  aws:           'logos/aws',
  gcp:           'logos/google-cloud',
  azure:         'logos/microsoft-azure',

  // Observability & metrics
  prometheus:    'logos/prometheus',
  opentelemetry: 'logos/opentelemetry-icon',
  grafana:       'logos/grafana',
  datadog:       'logos/datadog',
  newrelic:      'logos/new-relic-icon',

  // Comms / alerting
  slack:         'logos/slack-icon',
  pagerduty:     'logos/pagerduty-icon',

  // CI / GitOps / IaC
  github:        'logos/github-actions',
  gitlab:        'logos/gitlab',
  argocd:        'logos/argo',
  jenkins:       'logos/jenkins',
  terraform:     'logos/terraform-icon',
  helm:          'logos/helm',
  ansible:       'logos/ansible',

  // Container / orchestration / data
  docker:        'logos/docker-icon',
  kubernetes:    'logos/kubernetes',
  nginx:         'logos/nginx',
  elastic:       'logos/elastic',
  redis:         'logos/redis',

  // Security & policy
  vault:         'logos/vault-icon',

  // Edge
  cloudflare:    'logos/cloudflare',
};

function BrandIcon({ name, size = 24, tile = false, tileSize = 56, monochrome = false, bg }) {
  const slug = ICON_SLUGS[name];
  if (!slug) return null;
  const url = `https://api.iconify.design/${slug}.svg`;

  // monochrome=true → flatten to pure white via filter. Works for any source SVG.
  const filter = monochrome
    ? 'brightness(0) invert(1)'
    : 'none';

  const img = (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      style={{ display: 'block', filter, objectFit: 'contain' }}
      onError={(e) => { e.currentTarget.style.opacity = '0'; }}
    />
  );

  if (!tile) return img;

  return (
    <span style={{
      width: tileSize, height: tileSize, borderRadius: 14,
      background: bg || (monochrome ? 'rgba(255,255,255,.15)' : '#F0F4FA'),
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flex: `0 0 ${tileSize}px`,
    }}>
      <img
        src={url}
        alt=""
        width={Math.round(tileSize * 0.58)}
        height={Math.round(tileSize * 0.58)}
        style={{ display: 'block', filter, objectFit: 'contain' }}
        onError={(e) => { e.currentTarget.style.opacity = '0'; }}
      />
    </span>
  );
}

Object.assign(window, { BrandIcon, ICON_SLUGS });

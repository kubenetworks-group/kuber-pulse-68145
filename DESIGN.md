# DESIGN.md — Kodo by KubeNetworks

## Identidade do Produto

**Kodo** é uma plataforma SaaS de gerenciamento inteligente de clusters Kubernetes com IA.
Público: engenheiros de plataforma, DevOps leads, heads de infraestrutura em empresas mid-to-large.
Tom: autoridade técnica, confiança cirúrgica, precisão. Nunca corporativo genérico.

---

## Filosofia Visual

> "Um cockpit de aviação, não um painel de TI dos anos 2000."

A interface deve transmitir **controle total com clareza absoluta**. Cada pixel tem propósito.
Inspirações: Linear, Vercel Dashboard, Raycast, Tailscale, Warp Terminal.

---

## Tema Base

**Dark-first obrigatório.**

```css
:root {
  /* Backgrounds */
  --bg-base:        #080C12;  /* fundo principal — quase preto azulado */
  --bg-surface:     #0F1520;  /* cards, painéis */
  --bg-elevated:    #161E2E;  /* modais, dropdowns */
  --bg-subtle:      #1C2436;  /* hover states, inputs */

  /* Borders */
  --border-default: rgba(255, 255, 255, 0.07);
  --border-strong:  rgba(255, 255, 255, 0.14);
  --border-accent:  rgba(0, 229, 160, 0.3);

  /* Text */
  --text-primary:   #F0F4FF;
  --text-secondary: #8892A4;
  --text-muted:     #4A5568;

  /* Brand accent — verde terminal Kodo */
  --accent:         #00E5A0;
  --accent-dim:     rgba(0, 229, 160, 0.12);
  --accent-glow:    rgba(0, 229, 160, 0.06);

  /* Status */
  --danger:         #FF4D4D;
  --danger-dim:     rgba(255, 77, 77, 0.12);
  --warning:        #F5A623;
  --warning-dim:    rgba(245, 166, 35, 0.12);
  --success:        #00E5A0;
  --success-dim:    rgba(0, 229, 160, 0.10);
  --info:           #4A9EFF;
  --info-dim:       rgba(74, 158, 255, 0.12);

  /* Severity — usado em badges de ameaça */
  --critical:       #FF2D2D;
  --critical-dim:   rgba(255, 45, 45, 0.15);
  --high:           #FF7A00;
  --high-dim:       rgba(255, 122, 0, 0.15);
  --medium:         #F5C518;
  --medium-dim:     rgba(245, 197, 24, 0.15);
  --low:            #00E5A0;
  --low-dim:        rgba(0, 229, 160, 0.12);

  /* Shadows */
  --shadow-card:    0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-elevated: 0 8px 32px rgba(0, 0, 0, 0.5);

  /* Radius */
  --radius-sm:  4px;
  --radius-md:  8px;
  --radius-lg:  12px;
  --radius-xl:  16px;
}
```

---

## Tipografia

```css
/* Display / Headings — autoridade técnica */
font-family: 'JetBrains Mono', 'Geist Mono', monospace;
/* Alternativa se Mono não carregar: 'IBM Plex Mono' */

/* Body / UI text — leitura limpa */
font-family: 'Geist', 'Inter', -apple-system, sans-serif;

/* NUNCA usar: Roboto, Arial, system-ui genérico */
```

**Escala tipográfica:**
- Page title: 20px / 500 / JetBrains Mono
- Section heading: 14px / 500 / Geist, letter-spacing: 0.08em, UPPERCASE
- Card title: 14px / 500 / Geist
- Body: 13px / 400 / Geist / line-height 1.6
- Metric value: 28px / 600 / JetBrains Mono (números grandes em painéis)
- Badge / label: 11px / 500 / Geist / letter-spacing: 0.04em
- Caption / muted: 12px / 400 / color: var(--text-muted)

---

## Componentes — Padrões Obrigatórios

### Metric Cards (KPI summaries)
- Background: `var(--bg-surface)`
- Border: `1px solid var(--border-default)`
- Border-radius: `var(--radius-lg)`
- Padding: `20px 24px`
- Label: 11px uppercase, `var(--text-muted)`, letter-spacing 0.08em
- Value: 28-32px, JetBrains Mono, `var(--text-primary)`
- Accent bar: linha de 2px na cor do status na borda superior do card
- Hover: `border-color: var(--border-strong)`, transition 150ms

### Threat / Risk Rows (listas de ameaças)
- Fundo: transparente com `border-bottom: 1px solid var(--border-default)`
- Hover: `background: var(--bg-subtle)`, transição suave
- Indicador de severidade: bolinha 8px colorida à esquerda (não texto)
- Nome do pod: `font-family: JetBrains Mono`, 13px
- Badges de severity: pill com fundo semitransparente da cor do nível
  - Crítico: `background: var(--critical-dim)`, `color: var(--critical)`
  - Alto: `background: var(--high-dim)`, `color: var(--high)`
  - Médio: `background: var(--medium-dim)`, `color: var(--medium)`
- Badge "correção disponível": `background: var(--accent-dim)`, `color: var(--accent)`, ícone de chave inglesa
- Timestamp e namespace: 12px, `var(--text-muted)`

### Score / Risk Gauge (círculo de risco)
- SVG circular progress, stroke animado
- Valor central: 32px JetBrains Mono
- Fundo do arco: `rgba(255,255,255,0.05)`
- Cor do arco: gradiente de --low → --high → --critical por faixa de valor
- Label abaixo: 11px uppercase muted

### Botão "Corrigir com IA"
- Background: `var(--accent)`, color: `#000`
- Border-radius: `var(--radius-md)`
- Font: 13px / 500 / Geist
- Ícone: estrela ou raio à esquerda
- Hover: brightness(1.1), transform: translateY(-1px)
- Sombra no hover: `0 4px 16px rgba(0, 229, 160, 0.3)`

### Tabs de navegação
- Fundo: transparente
- Ativo: `color: var(--text-primary)`, `border-bottom: 2px solid var(--accent)`
- Inativo: `color: var(--text-muted)`, sem borda
- Hover: `color: var(--text-secondary)`
- Sem background pill — apenas borda inferior

### Filtros / Selects
- Background: `var(--bg-subtle)`
- Border: `1px solid var(--border-default)`
- Border-radius: `var(--radius-md)`
- Altura: 32px
- Font: 12px Geist
- Hover: `border-color: var(--border-strong)`
- Focus: `border-color: var(--accent)`, sem box-shadow pesado

### Badges gerais
- Pill: `border-radius: 100px`, `padding: 3px 10px`
- Namespace badge: background `var(--bg-elevated)`, border `var(--border-default)`, monospace

---

## Layout e Espaçamento

- Grid principal: sidebar (220px) + main content
- Sidebar: `var(--bg-surface)`, `border-right: 1px solid var(--border-default)`
- Header da página: `padding: 24px 32px`, separado por border
- Conteúdo: `padding: 24px 32px`
- Gap entre metric cards: 12px
- Gap entre seções: 24px
- Sem rounded corners excessivos — máximo `var(--radius-lg)` em cards

---

## Efeitos e Animações

- Transições: `150ms ease` para hover states
- Entrada de dados: fade-in sutil em listas (staggered 30ms por item)
- Números: contador animado no carregamento dos KPIs
- Sem animações pesadas ou desnecessárias
- Glow no accent: `box-shadow: 0 0 20px var(--accent-glow)` — apenas em elementos de destaque crítico

---

## O que NUNCA fazer

- Sem fundo branco ou claro
- Sem gradientes roxos genéricos
- Sem Inter/Roboto como fonte de heading
- Sem cards com `border-radius` maior que 16px
- Sem sombras pesadas coloridas em tudo
- Sem ícones emoji — usar ícones SVG ou Lucide/Heroicons
- Sem tabelas com linhas zebradas alternadas em cinza claro
- Sem buttons com `border-radius: 9999px` (pill) no dashboard — apenas em badges
- Sem padding interno de cards menor que 16px

---

## Referências de Qualidade

Antes de finalizar qualquer componente, pergunte:
"Isso parece Linear? Parece Vercel? Parece Raycast?"
Se a resposta for não — refine.
# Headlines A/B/C Test — Kodo

**Data:** 2026-05-18  
**Objetivo:** Identificar qual ângulo de headline maximiza CTR no CTA primário e taxa de sign-up  
**Baseline:** Variante A (copy atual)  
**Duração sugerida:** 14 dias por teste, mínimo 500 sessões por variante  
**Ferramenta:** URL params + GA4 / PostHog (sem biblioteca A/B externa necessária)

---

## Variante A — Baseline (Copy Atual)

**Ângulo:** Funcionalidade técnica / autonomia  
**Persona-alvo:** DevOps Engineer, SRE, Platform Engineer  
**Tráfego quente:** Pessoas que já buscam "kubernetes management" ou viram conteúdo técnico

### Headline
> "Kubernetes que se cura sozinho."

### Subheadline
> "Plataforma cloud-native com IA que monitora, protege e otimiza seus clusters — com auto-healing e FinOps integrados."

### CTA Primário
> "Começar grátis"

### CTA Secundário
> "Ver demo"

### Hipótese
Funciona bem para tráfego orgânico de desenvolvedores que já sabem o que querem. Pode ter CTR baixo em cold traffic de Meta/LinkedIn por ser muito técnico.

### Métricas de sucesso
- CTR no CTA primário: baseline (referência)
- % sessão → `/auth?tab=signup`: baseline
- Bounce rate: baseline

### Pontos fracos a testar
- "se cura" pode soar abstrato para decisores não-técnicos
- Não comunica valor de negócio (ROI, custo, SLA)
- CTA "Começar grátis" sem explicar o que é "grátis"

---

## Variante B — ROI / Negócio

**Ângulo:** Retorno financeiro e eficiência operacional  
**Persona-alvo:** CTO, VP Engineering, FinOps Lead, Head of Infrastructure  
**Tráfego quente:** LinkedIn Ads para decisores, Google Ads em "reduzir custo kubernetes"

### Headline
> "Reduza 40% dos custos Kubernetes. IA faz o trabalho pesado."

### Subheadline
> "Kodo monitora, protege e otimiza seus clusters automaticamente — sem alertas manuais, sem horas de kubectl. Conecte em 5 minutos."

### CTA Primário
> "Começar grátis — sem cartão de crédito"

### CTA Secundário
> "Ver como economizamos 40%"

### Hipótese
Decisores de negócio respondem mais a números concretos (40%) do que a descrições técnicas. A clarificação "sem cartão" remove a maior barreira de conversão. Pode ter CTR mais alto em LinkedIn e Google Ads.

### Métricas de sucesso
- CTR no CTA primário: >+10% vs. Variante A
- % sessão → `/auth?tab=signup`: >+8% vs. A
- Qualidade do lead: % que conecta cluster em 24h (proxy de intenção real)

### Pontos fortes
- Número concreto (40%) gera credibilidade imediata
- "sem cartão de crédito" elimina objeção de fricção
- CTA secundário confirma a claim e convida à prova

### Risco
- Se o usuário não ver os 40% se concretizando, pode gerar churn rápido
- Precisamos ter essa prova no onboarding (caso de uso demonstrável)

---

## Variante C — Pain Point / Emocional

**Ângulo:** Dor do on-call, frustração com incidentes  
**Persona-alvo:** DevOps Engineer sênior, Engineering Manager, SRE  
**Tráfego quente:** Meta Ads (engajamento emocional), Reddit/LinkedIn para DevOps

### Headline
> "Chega de acordar com cluster caído às 3 da manhã."

### Subheadline
> "Kodo detecta e corrige falhas automaticamente antes de você ser paginado. Auto-healing em menos de 30 segundos. Você dorme, o cluster se cuida."

### CTA Primário
> "Testar grátis agora"

### CTA Secundário
> "Ver auto-healing ao vivo"

### Hipótese
Dor emocional (on-call, pager duty, noite perdida) converte muito bem em Meta Ads e conteúdo orgânico. DevOps engineers reconhecem a situação instantaneamente. Pode ter o maior CTR bruto, mas qualidade de lead menor (usuários individuais vs. decisores).

### Métricas de sucesso
- CTR no CTA primário: >+15% vs. Variante A (hipótese: maior engajamento emocional)
- % sessão → `/auth?tab=signup`: >+5% vs. A
- Qualidade do lead: monitorar se são individuais ou de empresa

### Pontos fortes
- Empatia imediata com o leitor — "ele entende minha dor"
- Especificidade ("30 segundos", "3 da manhã") aumenta credibilidade
- CTA "agora" cria urgência natural

### Risco
- Pode atrair mais devs individuais do que decisores com budget
- Tom informal pode não converter em contextos B2B formais (Fintech, Healthtech)

---

## Tabela Comparativa

| Aspecto | Variante A | Variante B | Variante C |
|---------|-----------|-----------|-----------|
| Ângulo | Técnico / funcional | ROI / negócio | Dor / emocional |
| Persona | DevOps/SRE | CTO/FinOps | DevOps on-call |
| Canal ideal | Google orgânico, SEO | LinkedIn Ads, Google Ads | Meta Ads, Reddit |
| Tom | Neutro-técnico | Profissional / direto | Empático / informal |
| Hipótese de CTR | Baseline | +10% vs. A | +15% vs. A |
| Hipótese de qualidade | Alta (intenção técnica) | Alta (decisores) | Média (mistura) |
| CTA clareza | ⚠️ "grátis" ambíguo | ✅ "sem cartão" | ✅ "agora" |

---

## Implementação Técnica

### 1. Parametrização via URL

Sem biblioteca A/B externa — usar query params:

```
https://kodo.kubenetworks.com.br/?variant=a  ← Baseline
https://kodo.kubenetworks.com.br/?variant=b  ← ROI
https://kodo.kubenetworks.com.br/?variant=c  ← Pain
```

Cada URL de anúncio aponta para sua variante. Não é aleatorização automática — é segmentação por canal/campanha, que é mais simples e auditável.

### 2. Onde alterar no código

**Arquivo:** `src/pages/LandingPage.tsx`

**Passo 1 — Extrair hero text para objeto de variantes:**

```tsx
// Próximo à linha 898, antes do componente principal
const HERO_VARIANTS = {
  a: {
    headline: ["monitora.", "se cura.", "economiza.", "protege."],
    headlinePrefix: "Kubernetes que",
    subheadline: "Plataforma cloud-native com IA que monitora, protege e otimiza seus clusters — com auto-healing e FinOps integrados.",
    ctaPrimary: "Começar grátis",
    ctaSecondary: "Ver demo",
  },
  b: {
    headline: ["40% menos custo.", "zero ops manual.", "infra inteligente.", "FinOps integrado."],
    headlinePrefix: "Kubernetes com",
    subheadline: "Kodo monitora, protege e otimiza seus clusters automaticamente — sem alertas manuais, sem horas de kubectl. Conecte em 5 minutos.",
    ctaPrimary: "Começar grátis — sem cartão de crédito",
    ctaSecondary: "Ver como economizamos 40%",
  },
  c: {
    headline: ["acordar às 3h.", "alertas manuais.", "kubectl de madrugada.", "incidentes no pager."],
    headlinePrefix: "Chega de",
    subheadline: "Kodo detecta e corrige falhas automaticamente antes de você ser paginado. Auto-healing em menos de 30 segundos. Você dorme, o cluster se cuida.",
    ctaPrimary: "Testar grátis agora",
    ctaSecondary: "Ver auto-healing ao vivo",
  },
} as const;
```

**Passo 2 — Ler o param na URL:**

```tsx
// No componente LandingPage, no início
const searchParams = new URLSearchParams(window.location.search);
const variant = (searchParams.get('variant') as 'a' | 'b' | 'c') ?? 'a';
const heroText = HERO_VARIANTS[variant] ?? HERO_VARIANTS.a;
```

**Passo 3 — Usar `heroText` no JSX do hero (L898-973):**

```tsx
// Substituir strings hardcoded por heroText.*
// Ex: headlinePrefix, headline array (para o morphing), subheadline, ctaPrimary, ctaSecondary
```

### 3. Rastreamento com GA4

**Evento ao carregar a landing:**

```tsx
// No useEffect inicial da LandingPage
useEffect(() => {
  if (window.gtag) {
    window.gtag('event', 'ab_test_view', {
      test_name: 'hero_headline_2026_q2',
      variant: variant,
    });
  }
}, [variant]);
```

**Evento ao clicar no CTA primário:**

```tsx
// No onClick do botão "Começar grátis"
window.gtag?.('event', 'cta_click', {
  test_name: 'hero_headline_2026_q2',
  variant: variant,
  cta_label: heroText.ctaPrimary,
  location: 'hero',
});
```

**Evento de conversão no sign-up (Auth.tsx):**

```tsx
// Após sign-up bem-sucedido em src/pages/Auth.tsx
const variant = new URLSearchParams(window.location.search).get('variant') ?? 'a';
window.gtag?.('event', 'sign_up', {
  method: 'email',
  test_name: 'hero_headline_2026_q2',
  variant: variant,
});
```

> **Nota:** Para preservar o variant através do redirect para `/auth`, passar como query param no `navigate`: `/auth?tab=signup&variant=${variant}`

### 4. Dashboard de resultado sugerido (GA4)

Criar custom report no GA4:
- **Dimensão:** `variant` (parâmetro do evento)
- **Métricas:** Sessions, CTA clicks (event `cta_click`), Sign-ups (event `sign_up`)
- **Derived metric:** Conversão = sign_ups / sessions por variante
- **Comparar:** após 14 dias ou 500 sessões por variante

---

## Critérios de Decisão

| Decisão | Critério |
|---------|----------|
| Variante vencedora | Conversão sign-up ≥ +5% com significância estatística (p < 0.05) |
| Empate técnico | Manter A (baseline) e testar próxima hipótese |
| Variante B vence em volume, C em qualidade | Usar B para cold traffic, C para canais de comunidade |
| Nenhuma supera A | Rever diferenciação de produto antes de mais copy |

---

## Cronograma Sugerido

| Semana | Ação |
|--------|------|
| Semana 1 | Implementar parametrização + GA4 events |
| Semana 1-2 | Rodar Variante A vs. B (LinkedIn + Google Ads) |
| Semana 3-4 | Rodar Variante A vs. C (Meta Ads) |
| Semana 5 | Analisar resultados e implementar vencedor como default |
| Semana 6+ | Testar próxima hipótese (ex: subheadline, CTA label, hero image) |

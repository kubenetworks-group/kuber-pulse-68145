# Landing Page Audit — Kodo

**Data:** 2026-05-18  
**Objetivo:** Preparar landing para tráfego pago (Meta Ads, Google Ads, LinkedIn)  
**Meta:** +5% CTR no CTA primário, +10% form submission rate

---

## 1. Current State Snapshot

### Headline
> "Kubernetes que [monitora / se cura / economiza / protege] sozinho."

- Morphing word animation (4 palavras ciclando)
- Ângulo: funcionalidade técnica, apelo ao DevOps
- **Problema:** genérico demais para audiências de negócio (CTO, FinOps)

### Subheadline
> "Plataforma cloud-native com IA que monitora, protege e otimiza seus clusters — com auto-healing e FinOps integrados."

- Comprimento: adequado (2 linhas)
- Clareza: boa para quem já conhece K8s, fraca para decisores de negócio

### CTAs (acima da dobra)
| Texto | Destino | Tipo |
|-------|---------|------|
| "Começar grátis" | `/auth?tab=signup` | Primário — gradiente |
| "Ver demo" | `#como-funciona` | Secundário — ghost |

- **CTA repetido em:** navbar, hero, seção "How it works", seção final
- **Problema:** "Começar grátis" é ambíguo — free forever ou trial limitado?

### Social Proof
| Elemento | Fonte | Credibilidade |
|----------|-------|--------------|
| 99.9% Uptime | Declarativo | Baixa — sem fonte |
| 40% Economia média | Declarativo | Baixa — sem caso real |
| 5 min Setup | Declarativo | Alta — verificável |
| 500+ Clusters gerenciados | Declarativo | Média — sem logos |
| Rating 4.8/150 reviews | Schema.org apenas | Baixa — não visível na UI |

### Trust Signals
- "Setup em 5 min" — aparece 3× na página
- "Multi-cloud" — aparece 3×
- "Suporte dedicado" — aparece 3×
- Ticker de integrações: AWS EKS, GKE, AKS, DigitalOcean, Rancher, OpenShift, Helm, ArgoCD, Prometheus, Grafana, Terraform, Cilium
- Texto de segurança (How it Works): "Sem acesso externo ao cluster", "Dados nunca saem do seu ambiente"

---

## 2. Conversion Checklist

### Above the Fold
| Item | Status | Nota |
|------|--------|------|
| Proposta de valor clara em <5s | ✅ Parcial | Técnicos entendem, decisores não |
| CTA primário visível sem scroll | ✅ | Botão cyan em destaque |
| Subheadline apoia o headline | ✅ | Complementa bem |
| Social proof visível | ⚠️ | Pills (5 min, multi-cloud) mas sem dados reais |
| Imagem/mockup relevante | ✅ | Dashboard mockup animado e convincente |
| Proposta de diferenciação clara | ⚠️ | "com IA" mas sem benchmark vs. concorrentes |

### Social Proof
| Item | Status | Nota |
|------|--------|------|
| Logos de clientes | ❌ | Ausente |
| Depoimentos com nome/cargo/empresa | ❌ | Ausente |
| Número de usuários/empresas com logo | ❌ | "500+ clusters" sem evidência |
| Case studies / resultados mensuráveis | ❌ | Ausente |
| Ratings visíveis na UI | ❌ | Existe no schema.org, não na página |
| Badges de segurança/compliance | ❌ | Ausente |

### Redução de Fricção
| Item | Status | Nota |
|------|--------|------|
| Pricing visível na landing | ❌ | Link separado em `/plans` |
| Definição clara do "grátis" | ❌ | Ambíguo no CTA |
| Formulário de lead capture leve | ❌ | Sign-up completo (nome, email, senha, confirmação) |
| OAuth / single-click signup | ✅ | Google OAuth disponível em `/auth` |
| Garantia de devolução / no-risk | ❌ | Ausente |
| Trial sem cartão de crédito | ❌ | Não comunicado na landing |

### Lead Capture
| Item | Status | Nota |
|------|--------|------|
| Email capture / waitlist | ❌ | Ausente na landing |
| Demo request form | ❌ | FAQ menciona "entre em contato" sem form |
| Newsletter opt-in | ❌ | Ausente |
| Download de recurso (PDF, checklist) | ❌ | Ausente |

### Urgência e FOMO
| Item | Status | Nota |
|------|--------|------|
| Oferta por tempo limitado | ❌ | Ausente |
| Vagas limitadas / early access | ❌ | Ausente |
| Indicador de atividade (X empresas hoje) | ❌ | Ausente |

### Mobile
| Item | Status | Nota |
|------|--------|------|
| Layout responsivo | ✅ | Mobile-first Tailwind |
| CTA visível acima da dobra no mobile | ✅ | |
| Menu hamburger | ✅ | |
| Dashboard mockup adaptado | ✅ | |
| Ticker de integrações | ✅ | Scroll automático |

### Analytics e Rastreamento
| Item | Status | Nota |
|------|--------|------|
| Google Analytics 4 | ❌ | Cookie banner existe, GA não integrado |
| Pixel Meta Ads | ❌ | Ausente |
| Pixel LinkedIn | ❌ | Ausente |
| Google Ads Conversion Tag | ❌ | Ausente |
| Eventos de conversão (CTA click, sign-up) | ❌ | Ausente |
| Hotjar / FullStory (heatmap) | ❌ | Ausente |

---

## 3. Gap Analysis — Benchmarks SaaS B2B

| Gap | Impacto Estimado | Esforço | Prioridade |
|-----|-----------------|---------|-----------|
| Sem analytics (GA4 + Meta Pixel) | Critico — tráfego pago cego | Baixo (4h) | P0 |
| CTA ambíguo ("grátis" sem definição) | CTR -15 a -25% em cold traffic | Baixo (1h) | P0 |
| Sem lead capture na landing | Perde 70-80% do tráfego frio | Médio (2 dias) | P1 |
| Sem social proof real (logos, depoimentos) | Confiança -30% para B2B | Alto (semanas) | P1 |
| Pricing oculto | Abandono por incerteza | Baixo (4h) | P1 |
| Segmentação por vertical ausente | CTR de anúncio -40% sem relevância | Alto (1 semana) | P2 |
| Sem demo em vídeo | Engajamento -50% vs. landing com vídeo | Médio (3 dias) | P2 |
| FAQ sem objeções de preço | Leads não qualificados | Baixo (2h) | P2 |
| Sem badges de segurança/compliance | Desconfiança em Fintech/Healthtech | Baixo (1h) | P3 |
| Rating 4.8 oculto no schema.org | Credibilidade perdida | Baixo (2h) | P3 |

---

## 4. Priority Matrix

### P0 — Bloqueadores para tráfego pago (fazer antes de qualquer campanha)

| Ação | Arquivo | Impacto |
|------|---------|---------|
| Integrar GA4 + Meta Pixel | `index.html` / `CookieBanner.tsx` | Mede conversões de campanha |
| Configurar eventos: CTA click, sign-up | `LandingPage.tsx` + `Auth.tsx` | Otimização de campanha |
| Clarificar CTA: "Começar grátis — sem cartão" | `LandingPage.tsx` L898 | Remove fricção imediata |
| Adicionar pricing básico na landing | Nova seção ou link proeminente | Qualifica leads antes do click |

### P1 — Alto impacto em conversão

| Ação | Arquivo | Impacto |
|------|---------|---------|
| Lead capture form (email + cargo) com isca | Nova seção em `LandingPage.tsx` | Captura tráfego frio |
| Clarificar plano gratuito no hero | `LandingPage.tsx` L898 | +10-15% sign-up |
| Adicionar FAQ sobre preço | `LandingPage.tsx` L1262 | Reduz abandono |
| Seção "Como funciona o preço" simples | `LandingPage.tsx` | Qualifica leads |

### P2 — Médio prazo

| Ação | Arquivo | Impacto |
|------|---------|---------|
| Páginas de vertical (Fintech, Healthtech, AI/ML, SaaS) | Novos arquivos em `src/pages/` | CTR de anúncio segmentado |
| A/B test nos headlines | `LandingPage.tsx` + URL params | Otimização contínua |
| Demo em vídeo (30-60s) | Nova seção no hero | Engajamento +50% |
| Testemunhos com cargo/empresa | Nova seção | Credibilidade B2B |

### P3 — Melhorias incrementais

| Ação | Arquivo | Impacto |
|------|---------|---------|
| Exibir rating 4.8★ visualmente | `LandingPage.tsx` | Credibilidade |
| Badges ISO/SOC2 (quando certificado) | Hero/footer | Fintech/Healthtech |
| Live counter "X empresas conectadas hoje" | Hero | FOMO leve |
| Exit-intent popup com isca | Novo componente | Recupera abandono |

---

## 5. Quick Wins vs. Major Initiatives

### Quick Wins — <1 dia de dev

1. **CTA clarificado:** "Começar grátis — sem cartão de crédito" (mudança de texto)
2. **Analytics:** Adicionar GA4 measurement ID e Meta Pixel no `index.html` (após consentimento)
3. **FAQ expandido:** Adicionar Q&A sobre preço e garantia
4. **Pricing teaser:** Mini-tabela ou "A partir de R$0/mês" com link para `/plans`
5. **Rating visível:** Exibir "4.8 ★ (150+ avaliações)" próximo ao hero CTA

### Major Initiatives — 3-10 dias

1. **Lead capture form:** Componente com email + cargo + isca (ebook/checklist) + integração Supabase/HubSpot
2. **Segmented landing pages:** 4 páginas de vertical com copy customizado (ver `value-props.md`)
3. **A/B testing:** Implementar variantes de headline via URL params (ver `headlines-ab-test.md`)
4. **Testimonials section:** Coletar 3-5 depoimentos reais com foto, cargo, empresa
5. **Demo vídeo:** Gravar walkthrough de 45-60s do dashboard em ação

---

## 6. Referências Técnicas

- Landing page: `src/pages/LandingPage.tsx` (hero: ~L898, features: ~L643, FAQ: ~L1262, final CTA: ~L1291)
- Auth (destino do CTA): `src/pages/Auth.tsx`
- Cookie consent: `src/components/CookieBanner.tsx`
- SEO/meta: `index.html`
- Pricing: `src/pages/Pricing.tsx`, `src/pages/PlansComparison.tsx`

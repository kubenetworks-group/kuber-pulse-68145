# Value Props por Vertical — Kodo

**Data:** 2026-05-18  
**Uso:** Embasar copy de anúncios pagos e páginas de vertical  
**Formato:** cada vertical segue o mesmo template para facilitar comparação e implementação

---

## Template

```
Persona principal: [cargo típico do decisor]
Dor principal: [problema que tira o sono]
Hero headline: [headline específico para essa vertical]
Subheadline: [elaboração em ≤2 linhas]
Value Props:
  1. [Benefício mensurável]
  2. [Benefício mensurável]
  3. [Benefício mensurável]
Objeção principal: [dúvida mais comum] → [como endereçar]
CTA primário: [texto do botão] → [destino]
URL slug: /[slug]
Palavras-chave de anúncio: [3-5 termos]
```

---

## Fintech

**Persona principal:** Head de Infraestrutura / CTO de fintech  
**Dor principal:** Indisponibilidade de clusters durante picos de transação custa R$ por segundo — e auditoria de acesso é manual

**Hero headline:**
> "Kubernetes financeiro que não cai em pico de transação."

**Subheadline:**
> Kodo detecta sobrecarga antes de virar incidente — e aplica auto-scaling em menos de 30 segundos. Compliance de RBAC auditado continuamente.

**Value Props:**
1. **Zero downtime em picos:** Auto-healing restaura pods degradados em <30s, antes de afetar transações
2. **Compliance contínuo:** Scan automático de RBAC e Network Policies com relatório auditável — sem revisar YAML manualmente
3. **Custo previsível:** FinOps multi-cloud reduz em média 40% o gasto com infra sem cortar capacidade

**Objeção principal:** "Nosso ambiente é regulado, não posso deixar uma ferramenta externa ter acesso ao cluster"  
→ **Resposta:** O agente Kodo roda dentro do seu cluster. Nunca expõe dados, secrets ou workloads para fora. Você mantém controle total.

**CTA primário:** "Ver demo de compliance K8s" → `/auth?tab=signup&vertical=fintech`  
**URL slug:** `/fintech`  
**Palavras-chave de anúncio:** "kubernetes fintech", "compliance kubernetes", "RBAC kubernetes auditoria", "alta disponibilidade kubernetes", "kubernetes pix"

---

## Healthtech

**Persona principal:** CTO / Diretor de Engenharia de healthtech  
**Dor principal:** Sistemas de saúde não podem ter downtime — e uma falha de segurança expõe dados de pacientes, criando risco LGPD e reputacional grave

**Hero headline:**
> "Kubernetes que mantém sistemas de saúde no ar — e protege dados de pacientes."

**Subheadline:**
> Auto-healing garante que aplicações críticas de saúde não caiam. Monitoramento de segurança contínuo para dados LGPD-sensitivos.

**Value Props:**
1. **Uptime para sistemas críticos:** 99.9% SLA com auto-recuperação automática — nenhum paciente sem acesso ao prontuário
2. **Segurança de dados LGPD:** Scan de Pod Security, secrets exposure e network policies — relatório de vulnerabilidades em tempo real
3. **Rastreabilidade de incidentes:** Log completo de toda ação de healing e acesso ao cluster — essencial para auditorias

**Objeção principal:** "Dados de saúde são sensíveis — não posso usar ferramentas que toquem nesses dados"  
→ **Resposta:** Kodo coleta apenas metadados de infra (CPU, memória, status de pods). Nunca lê dados de aplicação ou banco de dados. Arquitetura air-gap disponível.

**CTA primário:** "Falar com especialista em healthtech K8s" → formulário de demo  
**URL slug:** `/healthtech`  
**Palavras-chave de anúncio:** "kubernetes healthtech", "kubernetes LGPD saúde", "segurança kubernetes saúde", "alta disponibilidade healthtech", "kubernetes hospital"

---

## AI/ML

**Persona principal:** ML Engineer / Head of AI Infrastructure  
**Dor principal:** Jobs de treinamento falham no meio da execução (custo perdido), clusters GPU ficam ociosos fora do treino, e escalar infra para experimentos é lento e manual

**Hero headline:**
> "Seus jobs de ML não vão mais falhar no meio do treino."

**Subheadline:**
> Kodo detecta instabilidade de nó GPU antes de matar seu job. Auto-scaling inteligente garante recursos no momento certo — e desaloca quando o treino termina.

**Value Props:**
1. **Jobs de treino protegidos:** Detecção antecipada de falha de nó reinicia ou migra o job antes de perder horas de computação
2. **GPU cost optimization:** Kodo identifica GPUs ociosas entre jobs e desaloca automaticamente — até 40% de economia em compute
3. **Escala automática para batch:** Cluster sobe para treinos noturnos e reduz ao fim — sem intervenção manual no kubectl

**Objeção principal:** "Meu workload de ML é muito específico, não é um app web comum"  
→ **Resposta:** Kodo monitora qualquer workload Kubernetes — incluindo DaemonSets de GPU, StatefulSets de dados e Jobs de batch. Integra com Kubeflow e Argo Workflows.

**CTA primário:** "Começar grátis — conecte seu cluster GPU" → `/auth?tab=signup&vertical=aiml`  
**URL slug:** `/ai-ml`  
**Palavras-chave de anúncio:** "kubernetes GPU", "kubernetes machine learning", "kubeflow monitoramento", "kubernetes MLOps", "reduzir custo GPU cloud"

---

## SaaS

**Persona principal:** VP of Engineering / CTO de SaaS B2B  
**Dor principal:** Infraestrutura que escala com o crescimento de usuários mas não explode o burn — e incidentes em produção que destroem o NPS

**Hero headline:**
> "Escale seu SaaS sem escalar sua equipe de infra."

**Subheadline:**
> Kodo automatiza o que seu time mais odeia fazer manualmente: healing de pods, escala por demanda e revisão de custos. Você cresce, a infra acompanha sozinha.

**Value Props:**
1. **Infra que se auto-gerencia:** Auto-healing elimina 80% dos alertas manuais — seu time foca em produto, não em kubectl
2. **Custo cresce com receita, não antes:** FinOps multi-cloud garante que você só paga pelo que usa — média de 40% de redução sem reduzir performance
3. **SLA de uptime para seus clientes:** 99.9% garantido com auto-scaling preventivo — menos churn por instabilidade de produto

**Objeção principal:** "Já tenho Datadog/Grafana, não preciso de mais uma ferramenta"  
→ **Resposta:** Kodo não é só observabilidade — é ação. Onde Datadog alerta, Kodo corrige. Integra com Prometheus/Grafana e complementa seu stack atual.

**CTA primário:** "Começar grátis — setup em 5 minutos" → `/auth?tab=signup&vertical=saas`  
**URL slug:** `/saas`  
**Palavras-chave de anúncio:** "kubernetes SaaS", "auto-scaling kubernetes", "kubernetes custo", "reduzir custo kubernetes", "kubernetes managed"

---

## Tabela Comparativa de Posicionamento

| Vertical | Ângulo primário | Gatilho emocional | Métrica de prova |
|----------|----------------|-------------------|-----------------|
| Fintech | Compliance + uptime | Medo de indisponibilidade regulada | <30s healing, audit log |
| Healthtech | Segurança + uptime | Medo de exposição de dados / LGPD | 99.9% uptime, air-gap |
| AI/ML | Eficiência de custo + confiabilidade de jobs | Frustração com jobs perdidos | 40% GPU savings |
| SaaS | Autonomia + custo proporcional | Desejo de crescer sem dor ops | 80% menos alertas manuais |

---

## Próximos Passos de Implementação

1. Criar 4 páginas de vertical em `src/pages/` (ex: `LandingFintech.tsx`) usando layout de `LandingPage.tsx` como base
2. Adicionar rotas em `src/App.tsx`: `/fintech`, `/healthtech`, `/ai-ml`, `/saas`
3. Parametrizar sign-up com `?vertical=X` para segmentação no Supabase
4. Criar campanhas de anúncio com URL de destino específica por vertical
5. Configurar GA4 event `vertical_landing_view` para medir performance por segmento

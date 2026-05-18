import { SEO } from "@/components/SEO";
import { BlogLayout, H2, H3, P, UL, LI, Highlight, Stat } from "@/components/BlogLayout";

export default function FinOpsKubernetes() {
  return (
    <>
      <SEO
        title="FinOps Kubernetes: como reduzir custos de infraestrutura cloud em até 40%"
        description="Guia prático de FinOps para Kubernetes. Aprenda a identificar desperdícios, otimizar recursos e reduzir custos de AWS EKS, GKE e AKS com inteligência artificial."
        path="/blog/finops-kubernetes"
        type="article"
        publishedDate="2026-05-18"
        tags={["Kubernetes", "FinOps", "Cloud Cost", "AWS EKS", "GKE", "AKS"]}
      />
      <BlogLayout
        title="FinOps Kubernetes: como reduzir custos de infraestrutura cloud em até 40%"
        description="Guia prático de FinOps para Kubernetes. Aprenda a identificar desperdícios, otimizar recursos e reduzir custos de AWS EKS, GKE e AKS com inteligência artificial."
        date="18 de maio de 2026"
        readTime="9 min de leitura"
        dateISO="2026-05-18"
        slug="/blog/finops-kubernetes"
      >
        <P>
          A conta de cloud chegou e o número não faz sentido? Você não está sozinho. Estudos mostram que
          empresas desperdiçam em média <strong>32% do seu budget de cloud</strong> em recursos subutilizados
          ou mal configurados. Em clusters Kubernetes, esse número pode ser ainda maior — a facilidade de
          provisionar recursos no K8s frequentemente leva a over-provisioning sistemático.
        </P>
        <P>
          <strong>FinOps Kubernetes</strong> é a prática de alinhar custos de infraestrutura K8s com valor
          real entregue. Neste guia, você vai entender os principais desperdícios em clusters Kubernetes,
          como identificá-los e como automatizar a otimização com IA.
        </P>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-10">
          <Stat value="32%" label="do budget cloud desperdiçado em média" />
          <Stat value="40%" label="de economia média com FinOps K8s" />
          <Stat value="60%" label="dos containers over-provisionados" />
          <Stat value="3x" label="ROI médio de plataforma FinOps K8s" />
        </div>

        <H2>Os 5 principais desperdícios em clusters Kubernetes</H2>

        <H3>1. Over-provisioning de CPU e memória</H3>
        <P>
          O problema mais comum em clusters Kubernetes é definir <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', fontSize: '0.875em' }}>requests</code> e <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', fontSize: '0.875em' }}>limits</code> muito
          acima do uso real. Desenvolvedores tendem a provisionar com folga "para garantir", mas isso
          reserva recursos no nó que nunca são utilizados.
        </P>
        <div className="bg-slate-900 rounded-xl p-5 my-4">
          <p className="text-slate-400 text-xs mb-2 font-mono"># Exemplo de over-provisioning comum</p>
          <pre className="text-slate-100 text-sm font-mono whitespace-pre overflow-x-auto">{`resources:
  requests:
    cpu: "1000m"      # Uso real: 150m
    memory: "2Gi"     # Uso real: 400Mi
  limits:
    cpu: "2000m"
    memory: "4Gi"
# Desperdício: ~85% da CPU e ~80% da memória reservadas`}</pre>
        </div>
        <P>
          Multiplicado por dezenas de deployments, o over-provisioning infla o número de nós necessários
          — e consequentemente a conta de cloud.
        </P>

        <H3>2. Nós subutilizados</H3>
        <P>
          Nós com menos de 30-40% de utilização de CPU e memória são candidatos imediatos para consolidação.
          Em ambientes AWS EKS, GKE ou AKS, cada nó tem um custo fixo por hora independente da utilização.
          Consolidar workloads em menos nós pode reduzir a conta de EC2/Compute Engine significativamente.
        </P>

        <H3>3. Namespaces e ambientes esquecidos</H3>
        <P>
          Ambientes de desenvolvimento, staging e testes criados para um projeto específico e nunca
          destruídos. Feature branches com clusters dedicados que continuam rodando após o merge.
          Esses recursos "zumbis" podem representar 15-20% da conta total de cloud.
        </P>

        <H3>4. Instâncias erradas para o workload</H3>
        <P>
          Usar instâncias de propósito geral (m5.xlarge) para workloads compute-intensive que se
          beneficiariam de instâncias C (c5.xlarge) — mais baratas e mais rápidas para CPU-bound.
          Ou o inverso: workloads de IA/ML em instâncias sem GPU quando poderiam usar GPU spot.
        </P>

        <H3>5. Ausência de Spot/Preemptible instances</H3>
        <P>
          Workloads tolerantes a interrupção (jobs batch, builds de CI, processamento assíncrono) rodando
          em instâncias on-demand quando poderiam usar Spot (AWS) ou Preemptible (GCP) com 60-90% de
          desconto.
        </P>

        <Highlight>
          Um cluster Kubernetes típico de médio porte (~50 nós) pode economizar entre R$15.000 e R$40.000
          por mês apenas com rightsizing de recursos e uso inteligente de instâncias spot — sem nenhuma
          mudança de arquitetura.
        </Highlight>

        <H2>Como fazer FinOps Kubernetes na prática</H2>

        <H3>Passo 1: Visibilidade por namespace e workload</H3>
        <P>
          Antes de otimizar, você precisa ver. Configure métricas de custo por namespace, deployment e
          serviço. Ferramentas como Prometheus + Grafana podem mostrar utilização, mas não custo. Para
          associar utilização a custo real, você precisa de integração com a API de billing da cloud
          (AWS Cost Explorer, GCP Billing, Azure Cost Management).
        </P>

        <H3>Passo 2: Rightsizing de containers</H3>
        <P>
          Analise o uso real de CPU e memória por container nos últimos 30 dias. A regra prática é:
          defina o <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', fontSize: '0.875em' }}>request</code> no P95 do uso e o <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', fontSize: '0.875em' }}>limit</code> em 150-200% do request.
          Para workloads críticos, use o Vertical Pod Autoscaler (VPA) em modo recomendação primeiro.
        </P>
        <div className="bg-slate-900 rounded-xl p-5 my-4">
          <p className="text-slate-400 text-xs mb-2 font-mono"># Verificar uso real de recursos</p>
          <pre className="text-slate-100 text-sm font-mono whitespace-pre overflow-x-auto">{`# CPU utilization por pod
kubectl top pods --all-namespaces | sort -k4 -h

# Comparar com requests configurados
kubectl get pods -A -o json | jq '.items[] | {
  name: .metadata.name,
  cpu_request: .spec.containers[].resources.requests.cpu
}'`}</pre>
        </div>

        <H3>Passo 3: Implementar LimitRanges e ResourceQuotas</H3>
        <P>
          Evite que desenvolvedores provisionem sem limites usando <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', fontSize: '0.875em' }}>LimitRange</code> por namespace
          (força defaults saudáveis) e <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', fontSize: '0.875em' }}>ResourceQuota</code> por equipe (limita o total de
          recursos por namespace).
        </P>

        <H3>Passo 4: Escalonamento automático inteligente</H3>
        <P>
          Configure Cluster Autoscaler para escalar nós baseado em pods pendentes, e HPA para escalar
          pods baseado em métricas customizadas (não apenas CPU). Para cargas previsíveis (horário
          comercial), use KEDA ou Scheduled Scaling para escalar para baixo fora do horário de pico.
        </P>

        <H2>FinOps Kubernetes automatizado com IA</H2>
        <P>
          Fazer FinOps manualmente funciona para clusters pequenos. Para clusters em escala — dezenas
          de namespaces, centenas de deployments, múltiplos clouds — a automação com IA é necessária.
        </P>
        <P>
          Plataformas de FinOps Kubernetes com IA como o Kodo fazem isso automaticamente:
        </P>
        <UL>
          <LI><strong>Rightsizing automático</strong>: analisa uso histórico e aplica recomendações de request/limit sem intervenção</LI>
          <LI><strong>Detecção de recursos zumbis</strong>: identifica deployments, PVCs e services não usados nos últimos N dias</LI>
          <LI><strong>Recomendações de spot instances</strong>: identifica workloads candidatos a spot e estima a economia</LI>
          <LI><strong>Alertas de anomalia de custo</strong>: detecta picos de gasto incomuns antes que a conta chegue</LI>
          <LI><strong>Showback por equipe/produto</strong>: distribui custos por namespace para accountability</LI>
        </UL>

        <H2>FinOps por cloud: AWS EKS, GKE e AKS</H2>

        <H3>AWS EKS FinOps</H3>
        <P>
          No AWS EKS, os principais alvos de economia são: instâncias EC2 de nó (usar Spot ou Savings
          Plans), EBS volumes subutilizados, NAT Gateway com tráfego excessivo e Load Balancers ociosos.
          Ferramentas como AWS Cost Explorer e Karpenter (node provisioning inteligente) são essenciais.
        </P>

        <H3>Google GKE FinOps</H3>
        <P>
          No GKE, use Autopilot para workloads variáveis (você paga por pod, não por nó), Spot VMs
          para batch jobs e comprometimento de 1-3 anos (CUD) para workloads estáveis. O GKE Cost
          Optimization dashboard dá visibilidade nativa.
        </P>

        <H3>Azure AKS FinOps</H3>
        <P>
          No AKS, Spot Node Pools para workloads tolerantes a interrupção, Reserved Instances para
          cargas previsíveis e Azure Advisor para recomendações automáticas de rightsizing.
        </P>

        <H2>Conclusão: FinOps Kubernetes não é corte de custos, é eficiência</H2>
        <P>
          FinOps Kubernetes não significa diminuir performance ou capacidade. Significa pagar apenas
          pelo que você usa, quando você usa. Com as práticas certas — rightsizing, escalonamento
          inteligente, spot instances — é possível reduzir 30-40% da conta de cloud sem impactar
          nenhuma aplicação.
        </P>
        <P>
          E com IA automatizando a análise contínua, sua equipe não precisa fazer revisões mensais
          manuais. O sistema encontra e aplica as otimizações continuamente, enquanto você foca
          em construir produto.
        </P>
      </BlogLayout>
    </>
  );
}

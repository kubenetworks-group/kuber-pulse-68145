import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Shield } from "lucide-react";

const LAST_UPDATED = "31 de março de 2025";
const VERSION = "v1.2";

const sections = [
  { id: "introducao", title: "1. Introdução" },
  { id: "controlador", title: "2. Controlador de Dados" },
  { id: "dados", title: "3. Dados Coletados" },
  { id: "finalidade", title: "4. Finalidade do Tratamento" },
  { id: "base-legal", title: "5. Base Legal (LGPD)" },
  { id: "compartilhamento", title: "6. Compartilhamento de Dados" },
  { id: "direitos", title: "7. Seus Direitos (LGPD)" },
  { id: "seguranca", title: "8. Segurança dos Dados" },
  { id: "retencao", title: "9. Retenção de Dados" },
  { id: "cookies", title: "10. Cookies" },
  { id: "transferencia", title: "11. Transferência Internacional" },
  { id: "menores", title: "12. Menores de Idade" },
  { id: "alteracoes", title: "13. Alterações nesta Política" },
  { id: "dpo", title: "14. Encarregado de Dados (DPO)" },
  { id: "anpd", title: "15. Autoridade Nacional (ANPD)" },
];

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          {/* Table of contents */}
          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-3 tracking-wider">
                  Neste documento
                </p>
                <nav className="space-y-1">
                  {sections.map((s) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-0.5 hover:underline underline-offset-2"
                    >
                      {s.title}
                    </a>
                  ))}
                </nav>
                <div className="mt-4 pt-4 border-t border-border">
                  <Link to="/terms" className="flex items-center gap-1 text-sm text-primary hover:underline underline-offset-2">
                    <ExternalLink className="w-3 h-3" />
                    Termos de Uso
                  </Link>
                </div>
              </Card>
            </div>
          </aside>

          {/* Main content */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-3xl">Política de Privacidade</CardTitle>
                  <p className="text-muted-foreground mt-1">Última atualização: {LAST_UPDATED}</p>
                </div>
                <Badge variant="secondary">{VERSION}</Badge>
              </div>
              <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Shield className="w-4 h-4 text-primary shrink-0" />
                <p className="text-sm text-primary font-medium">
                  Em conformidade com a LGPD — Lei Geral de Proteção de Dados (Lei 13.709/2018)
                </p>
              </div>
            </CardHeader>

            <CardContent className="space-y-8 text-foreground">
              <section id="introducao">
                <h2 className="text-xl font-semibold mb-3">1. Introdução</h2>
                <p className="text-muted-foreground leading-relaxed">
                  O Kodo está comprometido com a proteção de seus dados pessoais e com a transparência
                  no tratamento dessas informações, em total conformidade com a Lei Geral de Proteção
                  de Dados — LGPD (Lei 13.709/2018). Esta Política descreve quais dados coletamos,
                  como os utilizamos, com quem os compartilhamos e quais são os seus direitos.
                </p>
              </section>

              <section id="controlador">
                <h2 className="text-xl font-semibold mb-3">2. Controlador de Dados</h2>
                <p className="text-muted-foreground leading-relaxed">
                  O controlador responsável pelo tratamento dos seus dados pessoais é a empresa
                  responsável pela plataforma Kodo, com sede no Brasil. Para contato sobre proteção de
                  dados, utilize o canal de suporte da plataforma ou o e-mail do nosso Encarregado de
                  Dados (DPO) — veja a seção 14.
                </p>
              </section>

              <section id="dados">
                <h2 className="text-xl font-semibold mb-3">3. Dados Coletados</h2>
                <p className="text-muted-foreground mb-4">Coletamos as seguintes categorias de dados:</p>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2 text-base">3.1 Dados de Cadastro</h3>
                    <ul className="space-y-1">
                      {["Nome completo", "Endereço de e-mail", "Senha (armazenada de forma criptografada)", "Nome da empresa (opcional)"].map((item) => (
                        <li key={item} className="flex items-center gap-2 text-muted-foreground text-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 text-base">3.2 Dados de Uso e Infraestrutura</h3>
                    <ul className="space-y-1">
                      {[
                        "Informações sobre clusters Kubernetes conectados (nome, provedor, região, status)",
                        "Métricas de uso e performance dos recursos",
                        "Logs de acesso e atividades na plataforma",
                        "Configurações, preferências e alertas definidos",
                        "Histórico de análises de IA e incidentes",
                      ].map((item) => (
                        <li key={item} className="flex items-center gap-2 text-muted-foreground text-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 text-base">3.3 Dados Técnicos e de Navegação</h3>
                    <ul className="space-y-1">
                      {[
                        "Endereço IP (coletado indiretamente por provedores de infraestrutura)",
                        "Informações do navegador (User Agent)",
                        "Cookies e identificadores de sessão",
                        "Data e hora de acesso",
                      ].map((item) => (
                        <li key={item} className="flex items-center gap-2 text-muted-foreground text-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 text-base">3.4 Dados de Consentimento</h3>
                    <ul className="space-y-1">
                      {[
                        "Registro de aceite dos Termos de Uso e desta Política",
                        "Data e hora do consentimento",
                        "Preferências de comunicações de marketing",
                      ].map((item) => (
                        <li key={item} className="flex items-center gap-2 text-muted-foreground text-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section id="finalidade">
                <h2 className="text-xl font-semibold mb-3">4. Finalidade do Tratamento</h2>
                <p className="text-muted-foreground mb-3">Utilizamos seus dados para:</p>
                <ul className="space-y-2">
                  {[
                    "Fornecer, manter e melhorar nossos serviços de monitoramento e gestão",
                    "Processar e executar suas solicitações e configurações",
                    "Enviar alertas, notificações técnicas e comunicações sobre o serviço",
                    "Melhorar e personalizar sua experiência na plataforma",
                    "Prevenir fraudes, garantir segurança e monitorar abusos",
                    "Cumprir obrigações legais, regulatórias e contratuais",
                    "Produzir análises estatísticas e métricas de uso anonimizadas",
                    "Enviar comunicações de marketing (apenas com consentimento explícito)",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-muted-foreground text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section id="base-legal">
                <h2 className="text-xl font-semibold mb-3">5. Base Legal (LGPD)</h2>
                <p className="text-muted-foreground mb-3">
                  O tratamento de seus dados é fundamentado nas seguintes hipóteses legais previstas no
                  Art. 7º da LGPD:
                </p>
                <div className="space-y-3">
                  {[
                    { label: "Consentimento (Art. 7º, I)", desc: "Para dados não essenciais, como comunicações de marketing e cookies analíticos." },
                    { label: "Execução de contrato (Art. 7º, V)", desc: "Para fornecimento do serviço contratado, autenticação e funcionalidades da plataforma." },
                    { label: "Legítimo interesse (Art. 7º, IX)", desc: "Para melhoria da plataforma, prevenção a fraudes e segurança dos sistemas." },
                    { label: "Obrigação legal (Art. 7º, II)", desc: "Quando exigido por lei, regulação ou ordem judicial brasileira." },
                  ].map(({ label, desc }) => (
                    <div key={label} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section id="compartilhamento">
                <h2 className="text-xl font-semibold mb-3">6. Compartilhamento de Dados</h2>
                <p className="text-muted-foreground mb-3">
                  Seus dados podem ser compartilhados com:
                </p>
                <ul className="space-y-2">
                  {[
                    { label: "Provedores de infraestrutura:", desc: "Para hospedagem, armazenamento e processamento de dados (ex: Supabase/PostgreSQL em nuvem)." },
                    { label: "Autoridades legais:", desc: "Quando exigido por lei, ordem judicial ou regulação aplicável." },
                    { label: "Parceiros autorizados:", desc: "Apenas com seu consentimento explícito e específico para a finalidade informada." },
                  ].map(({ label, desc }) => (
                    <li key={label} className="flex items-start gap-2 text-muted-foreground text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span><strong className="text-foreground">{label}</strong> {desc}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm font-semibold text-foreground">
                  Nunca vendemos, alugamos ou comercializamos seus dados pessoais a terceiros.
                </p>
              </section>

              <section id="direitos">
                <h2 className="text-xl font-semibold mb-3">7. Seus Direitos (LGPD — Art. 18)</h2>
                <p className="text-muted-foreground mb-4">
                  De acordo com a LGPD, você tem os seguintes direitos em relação aos seus dados:
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Confirmação", desc: "Saber se tratamos seus dados pessoais." },
                    { label: "Acesso", desc: "Obter cópia dos seus dados em formato legível." },
                    { label: "Correção", desc: "Solicitar correção de dados incompletos ou incorretos." },
                    { label: "Anonimização/Bloqueio", desc: "Solicitar anonimização ou bloqueio de dados desnecessários." },
                    { label: "Exclusão", desc: "Solicitar eliminação de dados tratados com consentimento." },
                    { label: "Portabilidade", desc: "Receber seus dados em formato estruturado e interoperável." },
                    { label: "Revogação", desc: "Revogar o consentimento dado a qualquer momento." },
                    { label: "Oposição", desc: "Opor-se ao tratamento em determinadas circunstâncias." },
                  ].map(({ label, desc }) => (
                    <div key={label} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Para exercer seus direitos, acesse{" "}
                  <Link to="/settings" className="text-primary underline underline-offset-2">
                    Configurações → Privacidade
                  </Link>{" "}
                  ou entre em contato com nosso DPO. Respondemos em até 15 dias úteis.
                </p>
              </section>

              <section id="seguranca">
                <h2 className="text-xl font-semibold mb-3">8. Segurança dos Dados</h2>
                <p className="text-muted-foreground mb-3">
                  Implementamos medidas técnicas e organizacionais para proteger seus dados:
                </p>
                <ul className="space-y-2">
                  {[
                    "Criptografia de dados em repouso e em trânsito (SSL/TLS)",
                    "Controle de acesso baseado em funções (RBAC) com múltiplos níveis",
                    "Autenticação de dois fatores (2FA/MFA) disponível para todos os usuários",
                    "Monitoramento contínuo de segurança e detecção de anomalias",
                    "Logs de auditoria para rastreamento de atividades",
                    "Backups regulares com retenção controlada",
                    "Revisões periódicas de segurança e conformidade",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-muted-foreground text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section id="retencao">
                <h2 className="text-xl font-semibold mb-3">9. Retenção de Dados</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas nesta
                  Política, respeitando os prazos legais aplicáveis. Dados de logs de auditoria são
                  retidos por até 5 anos conforme exigências legais. Após o encerramento da conta ou
                  o prazo de retenção, os dados são eliminados de forma segura ou anonimizados.
                  Dados de consentimento são mantidos pelo período legal de prova.
                </p>
              </section>

              <section id="cookies">
                <h2 className="text-xl font-semibold mb-3">10. Cookies</h2>
                <p className="text-muted-foreground mb-3">Utilizamos as seguintes categorias de cookies:</p>
                <div className="space-y-2">
                  {[
                    { label: "Essenciais", desc: "Necessários para o funcionamento da plataforma (autenticação, segurança). Não podem ser desativados.", required: true },
                    { label: "Analíticos", desc: "Nos ajudam a entender como você usa a plataforma para melhorá-la. Requerem consentimento.", required: false },
                    { label: "Marketing", desc: "Permitem personalizar comunicações e mensagens. Requerem consentimento.", required: false },
                  ].map(({ label, desc, required }) => (
                    <div key={label} className="p-3 rounded-lg bg-muted/30 border border-border/50 flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{label}</p>
                          {required && <Badge variant="secondary" className="text-xs">Obrigatório</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Você pode gerenciar suas preferências de cookies a qualquer momento através do banner
                  exibido no primeiro acesso ou nas configurações do seu navegador.
                </p>
              </section>

              <section id="transferencia">
                <h2 className="text-xl font-semibold mb-3">11. Transferência Internacional de Dados</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Seus dados podem ser transferidos e armazenados em servidores localizados fora do
                  Brasil (ex: servidores da Supabase nos EUA). Garantimos que tais transferências
                  ocorrem em conformidade com o Art. 33 da LGPD, mediante cláusulas contratuais
                  específicas e garantias adequadas de proteção de dados.
                </p>
              </section>

              <section id="menores">
                <h2 className="text-xl font-semibold mb-3">12. Menores de Idade</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Nossos serviços são destinados exclusivamente a pessoas maiores de 18 anos ou
                  legalmente emancipadas. Não coletamos intencionalmente dados de menores. Caso
                  identifiquemos dados de menores coletados sem o devido consentimento dos
                  responsáveis, procederemos à sua eliminação imediata conforme Art. 14 da LGPD.
                </p>
              </section>

              <section id="alteracoes">
                <h2 className="text-xl font-semibold mb-3">13. Alterações nesta Política</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Podemos atualizar esta Política periodicamente. Alterações significativas serão
                  comunicadas com pelo menos 15 dias de antecedência através da plataforma ou por
                  e-mail. A versão e data de atualização são exibidas no topo deste documento. A
                  continuação do uso após as alterações constitui aceitação da nova versão.
                </p>
              </section>

              <section id="dpo">
                <h2 className="text-xl font-semibold mb-3">14. Encarregado de Dados (DPO)</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Nosso Encarregado de Proteção de Dados (DPO), conforme exigido pelo Art. 41 da LGPD,
                  pode ser contatado para solicitações, dúvidas ou reclamações relacionadas ao
                  tratamento de dados pessoais. Utilize o canal de suporte da plataforma ou acesse{" "}
                  <Link to="/settings" className="text-primary underline underline-offset-2">
                    Configurações → Privacidade
                  </Link>
                  . Respondemos em até 15 dias úteis.
                </p>
              </section>

              <section id="anpd">
                <h2 className="text-xl font-semibold mb-3">15. Autoridade Nacional de Proteção de Dados</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Você tem o direito de apresentar reclamação à Autoridade Nacional de Proteção de
                  Dados (ANPD) caso considere que o tratamento dos seus dados viola a LGPD. A ANPD
                  pode ser contatada através do portal oficial do Governo Federal brasileiro
                  (gov.br/anpd).
                </p>
              </section>

              <div className="pt-4 border-t border-border flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>Versão {VERSION} — {LAST_UPDATED}</span>
                <Link to="/terms" className="ml-auto text-primary hover:underline underline-offset-2 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  Termos de Uso
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

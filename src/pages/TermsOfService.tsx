import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";

const LAST_UPDATED = "31 de março de 2025";
const VERSION = "v1.2";

const sections = [
  { id: "aceitacao", title: "1. Aceitação dos Termos" },
  { id: "servico", title: "2. Descrição do Serviço" },
  { id: "cadastro", title: "3. Cadastro e Segurança da Conta" },
  { id: "uso", title: "4. Uso Aceitável" },
  { id: "propriedade", title: "5. Propriedade Intelectual" },
  { id: "responsabilidade", title: "6. Limitação de Responsabilidade" },
  { id: "modificacoes", title: "7. Modificações dos Termos" },
  { id: "cancelamento", title: "8. Cancelamento" },
  { id: "lei", title: "9. Lei Aplicável" },
  { id: "contato", title: "10. Contato" },
];

export default function TermsOfService() {
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
                  <Link to="/privacy" className="flex items-center gap-1 text-sm text-primary hover:underline underline-offset-2">
                    <ExternalLink className="w-3 h-3" />
                    Política de Privacidade
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
                  <CardTitle className="text-3xl">Termos de Uso</CardTitle>
                  <p className="text-muted-foreground mt-1">Última atualização: {LAST_UPDATED}</p>
                </div>
                <Badge variant="secondary">{VERSION}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Leia atentamente antes de usar a plataforma Kodo. Ao acessar ou utilizar nossos
                serviços, você concorda com estes termos.
              </p>
            </CardHeader>

            <CardContent className="space-y-8 text-foreground">
              <section id="aceitacao">
                <h2 className="text-xl font-semibold mb-3">1. Aceitação dos Termos</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Ao acessar e usar o Kodo, você aceita e concorda em estar vinculado aos termos e
                  condições estabelecidos neste documento. Se você não concordar com estes termos, não
                  utilize nossos serviços. O uso continuado da plataforma após alterações nos termos
                  constitui aceitação das modificações.
                </p>
              </section>

              <section id="servico">
                <h2 className="text-xl font-semibold mb-3">2. Descrição do Serviço</h2>
                <p className="text-muted-foreground mb-3">
                  O Kodo é uma plataforma SaaS de gerenciamento e monitoramento de clusters Kubernetes
                  que oferece:
                </p>
                <ul className="space-y-2">
                  {[
                    "Monitoramento em tempo real de recursos e infraestrutura",
                    "Análise e otimização de custos de nuvem",
                    "Gerenciamento de storage e volumes persistentes",
                    "Assistente de IA para suporte técnico e diagnóstico",
                    "Sistema de alertas, notificações e auto-healing",
                    "Relatórios de segurança e conformidade",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section id="cadastro">
                <h2 className="text-xl font-semibold mb-3">3. Cadastro e Segurança da Conta</h2>
                <p className="text-muted-foreground mb-3">
                  Para usar nossos serviços, você deve:
                </p>
                <ul className="space-y-2">
                  {[
                    "Fornecer informações precisas, completas e atualizadas no cadastro",
                    "Manter a confidencialidade de suas credenciais de acesso",
                    "Notificar imediatamente sobre qualquer uso não autorizado da sua conta",
                    "Ser responsável por todas as atividades realizadas em sua conta",
                    "Ter capacidade legal para celebrar contratos (ser maior de 18 anos ou ter autorização legal)",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section id="uso">
                <h2 className="text-xl font-semibold mb-3">4. Uso Aceitável</h2>
                <p className="text-muted-foreground mb-3">
                  Você concorda em <strong>NÃO</strong> utilizar o serviço para:
                </p>
                <ul className="space-y-2">
                  {[
                    "Atividades ilegais ou que violem direitos de terceiros",
                    "Tentativas de acesso não autorizado a sistemas ou dados",
                    "Interferência com a operação da plataforma ou seus servidores",
                    "Engenharia reversa, desmontagem ou decompilação do software",
                    "Compartilhamento de credenciais de acesso com terceiros",
                    "Upload ou transmissão de malware, vírus ou código malicioso",
                    "Contornar medidas de segurança ou limites de uso do plano",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section id="propriedade">
                <h2 className="text-xl font-semibold mb-3">5. Propriedade Intelectual</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Todo o conteúdo, recursos, algoritmos, marca, interface e tecnologia do Kodo são
                  propriedade exclusiva da empresa e protegidos por leis de direitos autorais,
                  propriedade intelectual e legislação aplicável. É concedida apenas uma licença
                  limitada, não exclusiva e intransferível para uso da plataforma conforme estes Termos.
                </p>
              </section>

              <section id="responsabilidade">
                <h2 className="text-xl font-semibold mb-3">6. Limitação de Responsabilidade</h2>
                <p className="text-muted-foreground mb-3">
                  O Kodo é fornecido "como está" sem garantias expressas ou implícitas. Não nos
                  responsabilizamos por:
                </p>
                <ul className="space-y-2">
                  {[
                    "Perda de dados ou lucros decorrentes do uso ou impossibilidade de uso",
                    "Interrupções de serviço por manutenção, falhas técnicas ou terceiros",
                    "Decisões operacionais ou de negócios baseadas nas informações fornecidas",
                    "Problemas causados por integrações com serviços ou APIs de terceiros",
                    "Acessos não autorizados decorrentes de negligência do usuário",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section id="modificacoes">
                <h2 className="text-xl font-semibold mb-3">7. Modificações dos Termos</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Reservamo-nos o direito de modificar estes termos a qualquer momento. Notificaremos
                  os usuários sobre mudanças significativas através da plataforma ou por e-mail com
                  antecedência mínima de 15 dias. Alterações menores serão indicadas pela atualização
                  da data e versão no topo deste documento.
                </p>
              </section>

              <section id="cancelamento">
                <h2 className="text-xl font-semibold mb-3">8. Cancelamento</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Você pode cancelar sua conta a qualquer momento através das configurações da
                  plataforma. Reservamos o direito de suspender ou encerrar contas que violem estes
                  termos, sem aviso prévio em casos de violação grave. Ao cancelar, seus dados serão
                  mantidos pelo período legal exigido e então eliminados conforme nossa{" "}
                  <Link to="/privacy" className="text-primary underline underline-offset-2">
                    Política de Privacidade
                  </Link>
                  .
                </p>
              </section>

              <section id="lei">
                <h2 className="text-xl font-semibold mb-3">9. Lei Aplicável</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Estes termos são regidos pelas leis brasileiras, incluindo o Código de Defesa do
                  Consumidor (Lei 8.078/1990), o Marco Civil da Internet (Lei 12.965/2014) e a Lei
                  Geral de Proteção de Dados — LGPD (Lei 13.709/2018). Qualquer disputa será
                  resolvida no foro da comarca da sede da empresa no Brasil.
                </p>
              </section>

              <section id="contato">
                <h2 className="text-xl font-semibold mb-3">10. Contato</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Para questões sobre estes termos ou para exercer seus direitos, entre em contato
                  com nosso Encarregado de Dados (DPO) através do suporte da plataforma. Respondemos
                  solicitações em até 15 dias úteis, conforme previsto na LGPD.
                </p>
              </section>

              <div className="pt-4 border-t border-border flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>Versão {VERSION} — {LAST_UPDATED}</span>
                <Link to="/privacy" className="ml-auto text-primary hover:underline underline-offset-2 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  Política de Privacidade
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Termos de Uso</CardTitle>
            <p className="text-muted-foreground">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
          </CardHeader>
          <CardContent className="space-y-6 text-foreground">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Aceitação dos Termos</h2>
              <p>
                Ao acessar e usar o KuberPulse, você aceita e concorda em estar vinculado aos termos e condições 
                estabelecidos neste documento. Se você não concordar com estes termos, não utilize nossos serviços.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Descrição do Serviço</h2>
              <p>
                O KuberPulse é uma plataforma de gerenciamento e monitoramento de clusters Kubernetes que oferece:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Monitoramento em tempo real de recursos</li>
                <li>Análise de custos</li>
                <li>Gerenciamento de storage</li>
                <li>Assistente de IA para suporte técnico</li>
                <li>Sistema de alertas e notificações</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Cadastro e Segurança da Conta</h2>
              <p className="mb-2">
                Para usar nossos serviços, você deve:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Fornecer informações precisas e atualizadas</li>
                <li>Manter a confidencialidade de suas credenciais</li>
                <li>Notificar imediatamente sobre qualquer uso não autorizado</li>
                <li>Ser responsável por todas as atividades em sua conta</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Uso Aceitável</h2>
              <p className="mb-2">
                Você concorda em NÃO:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Usar o serviço para fins ilegais</li>
                <li>Tentar acessar sistemas não autorizados</li>
                <li>Interferir com a operação do serviço</li>
                <li>Fazer engenharia reversa do software</li>
                <li>Compartilhar credenciais de acesso</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Propriedade Intelectual</h2>
              <p>
                Todo o conteúdo, recursos e tecnologia do KuberPulse são propriedade exclusiva da empresa e 
                protegidos por leis de direitos autorais e propriedade intelectual.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Limitação de Responsabilidade</h2>
              <p>
                O KuberPulse é fornecido "como está" sem garantias de qualquer tipo. Não nos responsabilizamos por:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Perda de dados ou lucros</li>
                <li>Interrupções de serviço</li>
                <li>Decisões tomadas com base nas informações fornecidas</li>
                <li>Problemas causados por terceiros ou integrações externas</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Modificações dos Termos</h2>
              <p>
                Reservamo-nos o direito de modificar estes termos a qualquer momento. Notificaremos os usuários 
                sobre mudanças significativas através da plataforma ou por e-mail.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Cancelamento</h2>
              <p>
                Você pode cancelar sua conta a qualquer momento através das configurações. Reservamos o direito 
                de suspender ou encerrar contas que violem estes termos.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Lei Aplicável</h2>
              <p>
                Estes termos são regidos pelas leis brasileiras. Qualquer disputa será resolvida no foro da 
                comarca da sede da empresa.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Contato</h2>
              <p>
                Para questões sobre estes termos, entre em contato através do suporte da plataforma.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
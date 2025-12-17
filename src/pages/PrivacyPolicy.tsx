import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
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
            <CardTitle className="text-3xl">Política de Privacidade</CardTitle>
            <p className="text-muted-foreground">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
            <p className="text-sm text-muted-foreground mt-2">Em conformidade com a LGPD (Lei Geral de Proteção de Dados - Lei 13.709/2018)</p>
          </CardHeader>
          <CardContent className="space-y-6 text-foreground">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Introdução</h2>
              <p>
                O Kodo está comprometido com a proteção de seus dados pessoais e com a transparência no 
                tratamento dessas informações, em conformidade com a Lei Geral de Proteção de Dados (LGPD).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Dados Coletados</h2>
              <p className="mb-2">Coletamos as seguintes categorias de dados:</p>
              
              <h3 className="font-semibold mt-4 mb-2">2.1 Dados de Cadastro:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Nome completo</li>
                <li>E-mail</li>
                <li>Senha (criptografada)</li>
                <li>Nome da empresa (opcional)</li>
              </ul>

              <h3 className="font-semibold mt-4 mb-2">2.2 Dados de Uso:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Informações sobre clusters Kubernetes conectados</li>
                <li>Métricas de uso e performance</li>
                <li>Logs de acesso e atividades</li>
                <li>Configurações e preferências</li>
              </ul>

              <h3 className="font-semibold mt-4 mb-2">2.3 Dados Técnicos:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Endereço IP</li>
                <li>Informações do navegador (User Agent)</li>
                <li>Cookies e identificadores de sessão</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Finalidade do Tratamento</h2>
              <p className="mb-2">Utilizamos seus dados para:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Fornecer e manter nossos serviços</li>
                <li>Processar e executar suas solicitações</li>
                <li>Enviar notificações sobre o serviço</li>
                <li>Melhorar e personalizar sua experiência</li>
                <li>Prevenir fraudes e garantir segurança</li>
                <li>Cumprir obrigações legais e regulatórias</li>
                <li>Análises estatísticas e métricas de uso</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Base Legal (LGPD)</h2>
              <p className="mb-2">O tratamento de seus dados é fundamentado em:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li><strong>Consentimento:</strong> Para dados não essenciais ao serviço</li>
                <li><strong>Execução de contrato:</strong> Para fornecimento do serviço</li>
                <li><strong>Legítimo interesse:</strong> Para melhoria da plataforma e segurança</li>
                <li><strong>Obrigação legal:</strong> Quando exigido por lei</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Compartilhamento de Dados</h2>
              <p className="mb-2">
                Seus dados podem ser compartilhados com:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li><strong>Provedores de serviço:</strong> Para hospedagem e processamento (ex: Supabase)</li>
                <li><strong>Autoridades legais:</strong> Quando exigido por lei</li>
                <li><strong>Parceiros autorizados:</strong> Apenas com seu consentimento explícito</li>
              </ul>
              <p className="mt-2 font-semibold">
                Nunca vendemos seus dados pessoais a terceiros.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Seus Direitos (LGPD)</h2>
              <p className="mb-2">De acordo com a LGPD, você tem direito a:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li><strong>Confirmação:</strong> Saber se tratamos seus dados</li>
                <li><strong>Acesso:</strong> Obter cópia dos seus dados</li>
                <li><strong>Correção:</strong> Solicitar correção de dados incompletos ou incorretos</li>
                <li><strong>Anonimização/Bloqueio:</strong> Solicitar anonimização ou bloqueio de dados desnecessários</li>
                <li><strong>Exclusão:</strong> Solicitar eliminação de dados tratados com consentimento</li>
                <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
                <li><strong>Revogação:</strong> Revogar consentimento a qualquer momento</li>
                <li><strong>Oposição:</strong> Se opor ao tratamento em certas circunstâncias</li>
              </ul>
              <p className="mt-3 text-sm">
                Para exercer seus direitos, entre em contato através do suporte da plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Segurança dos Dados</h2>
              <p>
                Implementamos medidas técnicas e organizacionais adequadas para proteger seus dados contra 
                acesso não autorizado, perda, destruição ou alteração, incluindo:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Criptografia de dados sensíveis</li>
                <li>Controle de acesso baseado em funções (RBAC)</li>
                <li>Monitoramento contínuo de segurança</li>
                <li>Backups regulares</li>
                <li>Certificação SSL/TLS</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Retenção de Dados</h2>
              <p>
                Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas, exceto quando 
                um período de retenção mais longo for exigido ou permitido por lei. Após esse período, os dados 
                serão excluídos ou anonimizados.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Cookies</h2>
              <p>
                Utilizamos cookies essenciais para o funcionamento da plataforma. Você pode gerenciar 
                preferências de cookies através das configurações do seu navegador.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Transferência Internacional</h2>
              <p>
                Seus dados podem ser transferidos e armazenados em servidores localizados fora do Brasil. 
                Garantimos que tais transferências estejam em conformidade com a LGPD e outras leis aplicáveis.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Menores de Idade</h2>
              <p>
                Nossos serviços não são direcionados a menores de 18 anos. Não coletamos intencionalmente 
                dados de menores sem consentimento dos pais ou responsáveis.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Alterações nesta Política</h2>
              <p>
                Podemos atualizar esta política periodicamente. Notificaremos sobre mudanças significativas 
                através da plataforma ou por e-mail. A continuação do uso após as alterações constitui 
                aceitação da nova política.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">13. Encarregado de Dados (DPO)</h2>
              <p>
                Para questões relacionadas à proteção de dados, entre em contato com nosso Encarregado de 
                Dados através do suporte da plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">14. Autoridade Nacional</h2>
              <p>
                Você tem o direito de apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD) 
                caso considere que o tratamento de seus dados viola a LGPD.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
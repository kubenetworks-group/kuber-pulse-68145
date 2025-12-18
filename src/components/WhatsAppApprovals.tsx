import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWhatsAppApprovals, WhatsAppApproval } from "@/hooks/useWhatsAppApprovals";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Loader2,
  Crown
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

export function WhatsAppApprovals() {
  const { currentPlan } = useSubscription();
  const { approvals, pendingApprovals, loading, approveAction, rejectAction } = useWhatsAppApprovals();

  const isPro = currentPlan === 'pro';

  if (!isPro) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: WhatsAppApproval['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'approved':
        return <Badge variant="outline" className="border-blue-500 text-blue-500"><CheckCircle2 className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'executed':
        return <Badge variant="outline" className="border-green-500 text-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Executado</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="border-red-500 text-red-500"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      case 'expired':
        return <Badge variant="outline" className="border-gray-500 text-gray-500"><AlertTriangle className="h-3 w-3 mr-1" />Expirado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'restart_pod':
        return 'Reiniciar Pod';
      case 'scale_deployment':
        return 'Escalar Deployment';
      case 'update_deployment_resources':
        return 'Atualizar Recursos';
      case 'anomaly_fix':
        return 'Correção de Anomalia';
      default:
        return actionType;
    }
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Aprovações WhatsApp
                {pendingApprovals.length > 0 && (
                  <Badge variant="destructive">{pendingApprovals.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Gerencie solicitações de aprovação de auto-cura
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {approvals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma solicitação de aprovação</p>
            <p className="text-sm">
              As solicitações aparecerão aqui quando houver problemas no cluster
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {approvals.map((approval) => {
                const isPending = approval.status === 'pending' && !isExpired(approval.expires_at);
                
                return (
                  <div
                    key={approval.id}
                    className={`p-4 rounded-lg border ${
                      isPending ? 'bg-yellow-500/5 border-yellow-500/30' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getActionLabel(approval.action_type)}</span>
                          {getStatusBadge(
                            approval.status === 'pending' && isExpired(approval.expires_at) 
                              ? 'expired' 
                              : approval.status
                          )}
                        </div>
                        
                        <div className="text-sm text-muted-foreground space-y-1">
                          {approval.action_params?.pod_name && (
                            <p>Pod: <code className="text-xs bg-muted px-1 rounded">{approval.action_params.namespace}/{approval.action_params.pod_name}</code></p>
                          )}
                          {approval.action_params?.deployment_name && (
                            <p>Deployment: <code className="text-xs bg-muted px-1 rounded">{approval.action_params.namespace}/{approval.action_params.deployment_name}</code></p>
                          )}
                          <p>
                            Criado {formatDistanceToNow(new Date(approval.created_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </p>
                          {isPending && (
                            <p className="text-yellow-600">
                              Expira {formatDistanceToNow(new Date(approval.expires_at), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </p>
                          )}
                          {approval.responded_at && (
                            <p>
                              Respondido {formatDistanceToNow(new Date(approval.responded_at), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                              {approval.user_response?.includes('web') ? ' (via Web)' : ' (via WhatsApp)'}
                            </p>
                          )}
                        </div>
                      </div>

                      {isPending && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                            onClick={() => rejectAction(approval.id)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rejeitar
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => approveAction(approval.id)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

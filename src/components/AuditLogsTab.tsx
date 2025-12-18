import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  FileText, 
  Search, 
  RefreshCw, 
  Shield, 
  User, 
  Server, 
  Key, 
  Brain,
  AlertTriangle,
  Clock,
  MapPin,
  XCircle,
  Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

const actionIcons: Record<string, React.ReactNode> = {
  login: <User className="h-4 w-4" />,
  logout: <User className="h-4 w-4" />,
  signup: <User className="h-4 w-4" />,
  api_key_created: <Key className="h-4 w-4" />,
  api_key_revoked: <Key className="h-4 w-4" />,
  cluster_created: <Server className="h-4 w-4" />,
  cluster_deleted: <Server className="h-4 w-4" />,
  security_scan_requested: <Shield className="h-4 w-4" />,
  ai_analysis_requested: <Brain className="h-4 w-4" />,
  auto_heal_executed: <AlertTriangle className="h-4 w-4" />,
  page_accessed: <MapPin className="h-4 w-4" />,
  action_failed: <XCircle className="h-4 w-4" />,
};

const actionColors: Record<string, string> = {
  login: "bg-green-500/10 text-green-600 border-green-500/20",
  logout: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  signup: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  api_key_created: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  api_key_revoked: "bg-red-500/10 text-red-600 border-red-500/20",
  cluster_created: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  cluster_deleted: "bg-red-500/10 text-red-600 border-red-500/20",
  security_scan_requested: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  ai_analysis_requested: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  auto_heal_executed: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  page_accessed: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  action_failed: "bg-red-500/10 text-red-600 border-red-500/20",
};

const pageNameMap: Record<string, string> = {
  '/': 'Dashboard',
  '/clusters': 'Clusters',
  '/ai-monitor': 'Monitor IA',
  '/costs': 'Custos',
  '/storage': 'Armazenamento',
  '/agents': 'Agentes',
  '/settings': 'Configurações',
  '/admin': 'Admin',
  '/pricing': 'Preços',
};

export const AuditLogsTab = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [selectedError, setSelectedError] = useState<AuditLog | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, { email: string; name: string }>>({});

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      
      const logsData = (data as AuditLog[]) || [];
      setLogs(logsData);

      // Fetch user profiles for all unique user_ids
      const uniqueUserIds = [...new Set(logsData.map(l => l.user_id))];
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', uniqueUserIds);

        // Also fetch emails from auth admin endpoint if available
        const profileMap: Record<string, { email: string; name: string }> = {};
        profiles?.forEach(p => {
          profileMap[p.id] = {
            email: '',
            name: p.full_name || 'Usuário'
          };
        });
        setUserProfiles(profileMap);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const userName = userProfiles[log.user_id]?.name || '';
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesResource = resourceFilter === "all" || log.resource_type === resourceFilter;
    
    return matchesSearch && matchesAction && matchesResource;
  });

  const uniqueActions = [...new Set(logs.map(l => l.action))];
  const uniqueResources = [...new Set(logs.map(l => l.resource_type))];

  const hasError = (log: AuditLog) => {
    return log.action === 'action_failed' || 
           (log.details && typeof log.details === 'object' && 'error_message' in log.details);
  };

  const getErrorMessage = (log: AuditLog) => {
    if (log.details && typeof log.details === 'object') {
      return (log.details as Record<string, unknown>).error_message as string || null;
    }
    return null;
  };

  const getPagePath = (log: AuditLog) => {
    if (log.details && typeof log.details === 'object') {
      const path = (log.details as Record<string, unknown>).page_path as string;
      return path ? pageNameMap[path] || path : null;
    }
    return null;
  };

  const openErrorDialog = (log: AuditLog) => {
    setSelectedError(log);
    setErrorDialogOpen(true);
  };

  const failedLogs = logs.filter(l => hasError(l));

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Logs de Auditoria</CardTitle>
                <CardDescription>Registro de todas as ações do sistema</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por usuário, ação..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Ações</SelectItem>
                {uniqueActions.map(action => (
                  <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Recurso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Recursos</SelectItem>
                {uniqueResources.map(resource => (
                  <SelectItem key={resource} value={resource}>{resource}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-5 mb-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Total de Logs</p>
              <p className="text-2xl font-bold">{logs.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/10">
              <p className="text-xs text-muted-foreground">Logins</p>
              <p className="text-2xl font-bold">{logs.filter(l => l.action === 'login').length}</p>
            </div>
            <div className="p-3 rounded-lg bg-sky-500/10">
              <p className="text-xs text-muted-foreground">Páginas Acessadas</p>
              <p className="text-2xl font-bold">{logs.filter(l => l.action === 'page_accessed').length}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10">
              <p className="text-xs text-muted-foreground">Security Scans</p>
              <p className="text-2xl font-bold">{logs.filter(l => l.action === 'security_scan_requested').length}</p>
            </div>
            <div className="p-3 rounded-lg bg-red-500/10">
              <p className="text-xs text-muted-foreground">Falhas</p>
              <p className="text-2xl font-bold">{failedLogs.length}</p>
            </div>
          </div>

          {/* Table */}
          <ScrollArea className="h-[500px]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Página/Recurso</TableHead>
                    <TableHead>Recurso</TableHead>
                    <TableHead>Falha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum log encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => {
                      const userName = userProfiles[log.user_id]?.name || 'Usuário';
                      const pagePath = getPagePath(log);
                      const errorMsg = getErrorMessage(log);
                      const isError = hasError(log);

                      return (
                        <TableRow key={log.id} className={isError ? 'bg-red-500/5' : ''}>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs">
                                {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <div className="flex flex-col">
                                <span className="text-xs font-medium">{userName}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {log.user_id.slice(0, 8)}...
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`gap-1 ${actionColors[log.action] || 'bg-muted'}`}
                            >
                              {actionIcons[log.action] || <FileText className="h-3 w-3" />}
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {pagePath ? (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-sky-500" />
                                <span className="text-xs">{pagePath}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{log.resource_type}</Badge>
                          </TableCell>
                          <TableCell>
                            {isError ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                onClick={() => openErrorDialog(log)}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                <span className="text-xs">Ver Erro</span>
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Error Details Dialog */}
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <XCircle className="h-5 w-5" />
              Detalhes do Erro
            </DialogTitle>
            <DialogDescription>
              Informações sobre a falha registrada
            </DialogDescription>
          </DialogHeader>
          
          {selectedError && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Data/Hora</p>
                  <p className="text-sm font-medium">
                    {format(new Date(selectedError.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Usuário</p>
                  <p className="text-sm font-medium">
                    {userProfiles[selectedError.user_id]?.name || 'Usuário'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Ação Original</p>
                  <p className="text-sm font-medium">
                    {selectedError.details && typeof selectedError.details === 'object' 
                      ? (selectedError.details as Record<string, unknown>).original_action as string || selectedError.action
                      : selectedError.action}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Recurso</p>
                  <Badge variant="secondary">{selectedError.resource_type}</Badge>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">Mensagem de Erro</p>
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-600 font-mono whitespace-pre-wrap">
                    {getErrorMessage(selectedError) || 'Erro não especificado'}
                  </p>
                </div>
              </div>

              {selectedError.details && Object.keys(selectedError.details).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Detalhes Adicionais</p>
                  <pre className="p-3 rounded-lg bg-muted text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedError.details, null, 2)}
                  </pre>
                </div>
              )}

              {selectedError.user_agent && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">User Agent</p>
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {selectedError.user_agent}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

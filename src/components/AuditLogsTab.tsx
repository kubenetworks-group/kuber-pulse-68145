import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Clock
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
};

export const AuditLogsTab = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs((data as AuditLog[]) || []);
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
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesResource = resourceFilter === "all" || log.resource_type === resourceFilter;
    
    return matchesSearch && matchesAction && matchesResource;
  });

  const uniqueActions = [...new Set(logs.map(l => l.action))];
  const uniqueResources = [...new Set(logs.map(l => l.resource_type))];

  return (
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
              placeholder="Buscar logs..."
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
        <div className="grid gap-4 md:grid-cols-4 mb-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Total de Logs</p>
            <p className="text-2xl font-bold">{logs.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-green-500/10">
            <p className="text-xs text-muted-foreground">Logins</p>
            <p className="text-2xl font-bold">{logs.filter(l => l.action === 'login').length}</p>
          </div>
          <div className="p-3 rounded-lg bg-purple-500/10">
            <p className="text-xs text-muted-foreground">API Keys</p>
            <p className="text-2xl font-bold">{logs.filter(l => l.resource_type === 'api_key').length}</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10">
            <p className="text-xs text-muted-foreground">Security Scans</p>
            <p className="text-2xl font-bold">{logs.filter(l => l.action === 'security_scan_requested').length}</p>
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
                  <TableHead>Ação</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>ID do Recurso</TableHead>
                  <TableHead>User Agent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum log encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">
                            {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </span>
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
                        <Badge variant="secondary">{log.resource_type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.resource_id ? log.resource_id.slice(0, 8) + '...' : '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {log.user_agent ? log.user_agent.slice(0, 50) + '...' : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

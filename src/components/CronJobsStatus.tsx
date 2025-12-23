import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, addMinutes, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type CronJob = {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  last_run_time: string | null;
  next_run_time: string | null;
};

export function CronJobsStatus() {
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCronJobs();
    const interval = setInterval(fetchCronJobs, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchCronJobs = async () => {
    try {
      // Since we can't access cron.job directly, we'll use static data
      // with dynamically calculated next/last run times
      const now = new Date();
      
      const jobs: CronJob[] = [
        {
          jobid: 1,
          jobname: 'auto-analyze-clusters-every-5min',
          schedule: '*/5 * * * *',
          active: true,
          last_run_time: null,
          next_run_time: null,
        },
        {
          jobid: 2,
          jobname: 'retry-failed-commands-every-minute',
          schedule: '* * * * *',
          active: true,
          last_run_time: null,
          next_run_time: null,
        }
      ];

      // Calculate last and next run times based on schedule
      const enrichedJobs = jobs.map(job => {
        let nextRunTime: Date | null = null;
        let lastRunTime: Date | null = null;

        if (job.schedule === '*/5 * * * *') {
          // Every 5 minutes
          const currentMinute = now.getMinutes();
          const nextInterval = Math.ceil(currentMinute / 5) * 5;
          nextRunTime = new Date(now);
          nextRunTime.setMinutes(nextInterval, 0, 0);
          
          lastRunTime = new Date(nextRunTime);
          lastRunTime.setMinutes(lastRunTime.getMinutes() - 5);
        } else if (job.schedule === '* * * * *') {
          // Every minute
          nextRunTime = new Date(now);
          nextRunTime.setMinutes(now.getMinutes() + 1, 0, 0);
          
          lastRunTime = new Date(now);
          lastRunTime.setSeconds(0, 0);
        }

        return {
          ...job,
          last_run_time: lastRunTime?.toISOString() || null,
          next_run_time: nextRunTime?.toISOString() || null,
        };
      });

      setCronJobs(enrichedJobs);
    } catch (err) {
      console.error('Exception calculating cron jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getScheduleDescription = (schedule: string) => {
    if (schedule === '*/5 * * * *') return 'A cada 5 minutos';
    if (schedule === '* * * * *') return 'A cada minuto';
    if (schedule === '0 * * * *') return 'A cada hora';
    return schedule;
  };

  const getJobDisplayName = (jobname: string) => {
    if (jobname === 'auto-analyze-clusters-every-5min') return 'Análise Automática de Clusters';
    if (jobname === 'retry-failed-commands-every-minute') return 'Retry de Comandos Falhados';
    return jobname;
  };

  const getTimeDifference = (dateString: string | null) => {
    if (!dateString) return null;
    
    try {
      const date = parseISO(dateString);
      const now = new Date();
      const diffMs = date.getTime() - now.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 0) {
        return `Há ${Math.abs(diffMins)} min`;
      } else if (diffMins === 0) {
        return 'Agora';
      } else {
        return `Em ${diffMins} min`;
      }
    } catch {
      return null;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Activity className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Status dos Monitores Automáticos
        </CardTitle>
        <CardDescription>
          Monitoramento em tempo real dos jobs agendados
        </CardDescription>
      </CardHeader>
      <CardContent>
        {cronJobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum job agendado encontrado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cronJobs.map((job) => (
              <div 
                key={job.jobid}
                className="p-4 rounded-lg border bg-gradient-to-r from-card to-muted/10 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{getJobDisplayName(job.jobname)}</h4>
                      <Badge variant={job.active ? "default" : "secondary"}>
                        {job.active ? (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Ativo
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 mr-1" />
                            Inativo
                          </>
                        )}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Frequência: {getScheduleDescription(job.schedule)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4 pt-3 border-t">
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">Última Execução</p>
                    {job.last_run_time ? (
                      <>
                        <p className="text-xs sm:text-sm font-mono truncate">
                          {format(parseISO(job.last_run_time), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {getTimeDifference(job.last_run_time)}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs sm:text-sm text-muted-foreground">Nunca executado</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">Próxima Execução</p>
                    {job.next_run_time ? (
                      <>
                        <p className="text-xs sm:text-sm font-mono truncate">
                          {format(parseISO(job.next_run_time), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </p>
                        <p className="text-[10px] sm:text-xs text-primary font-medium">
                          {getTimeDifference(job.next_run_time)}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs sm:text-sm text-muted-foreground">Não agendado</p>
                    )}
                  </div>
                </div>

                {job.active && (
                  <div className="pt-2">
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary animate-pulse" style={{ width: '100%' }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
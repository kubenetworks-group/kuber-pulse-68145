import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldAlert, ShieldOff, X, RefreshCw, Volume2, VolumeX, ExternalLink, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCluster } from '@/contexts/ClusterContext';
import { cn } from '@/lib/utils';

interface SecurityThreat {
  id: string;
  threat_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  title: string;
  description: string | null;
  created_at: string;
  affected_resources?: any[];
}

export function SecurityThreatsFloatingAlert() {
  const { user } = useAuth();
  const { selectedClusterId } = useCluster();
  const [threats, setThreats] = useState<SecurityThreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const fetchThreats = useCallback(async () => {
    if (!user || !selectedClusterId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('security_threats')
        .select('*')
        .eq('cluster_id', selectedClusterId)
        .eq('status', 'active')
        .in('severity', ['critical', 'high'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setThreats((data as any[]) || []);
      
      // Reset dismissed state if new threats appear
      if ((data as any[])?.length > 0) {
        setIsDismissed(false);
      }
    } catch (error) {
      console.error('Error fetching threats:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedClusterId]);

  // Play alert sound for new critical threats
  const playAlertSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.2;
      
      oscillator.start();
      setTimeout(() => {
        oscillator.frequency.value = 660;
      }, 100);
      setTimeout(() => {
        oscillator.frequency.value = 880;
      }, 200);
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 300);
    } catch (e) {
      // Audio not available
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (user && selectedClusterId) {
      fetchThreats();
    }
  }, [user, selectedClusterId, fetchThreats]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !selectedClusterId) return;

    const channel = supabase
      .channel(`security-threats-floating-${selectedClusterId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'security_threats',
          filter: `cluster_id=eq.${selectedClusterId}`,
        },
        (payload) => {
          const newThreat = payload.new as SecurityThreat;
          if (newThreat.severity === 'critical' || newThreat.severity === 'high') {
            setThreats(prev => [newThreat, ...prev.slice(0, 9)]);
            setIsDismissed(false);
            setIsMinimized(false);
            playAlertSound();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'security_threats',
          filter: `cluster_id=eq.${selectedClusterId}`,
        },
        (payload) => {
          const updatedThreat = payload.new as SecurityThreat;
          if (updatedThreat.status !== 'active') {
            setThreats(prev => prev.filter(t => t.id !== updatedThreat.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedClusterId, playAlertSound]);

  const dismissThreat = async (threatId: string) => {
    try {
      await supabase
        .from('security_threats')
        .update({ 
          status: 'investigating',
          acknowledged: true,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', threatId);

      setThreats(prev => prev.filter(t => t.id !== threatId));
    } catch (error) {
      console.error('Error dismissing threat:', error);
    }
  };

  const criticalCount = threats.filter(t => t.severity === 'critical').length;
  const highCount = threats.filter(t => t.severity === 'high').length;

  // Don't show if no cluster, no threats, or dismissed
  if (!selectedClusterId || threats.length === 0 || isDismissed) {
    return null;
  }

  // Minimized floating button
  if (isMinimized) {
    return (
      <div 
        className={cn(
          "fixed bottom-4 right-4 z-50 cursor-pointer transition-all duration-300",
          criticalCount > 0 && "animate-bounce"
        )}
        onClick={() => setIsMinimized(false)}
      >
        <div className={cn(
          "flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105",
          criticalCount > 0 ? "bg-red-600" : "bg-orange-500"
        )}>
          <ShieldAlert className="h-5 w-5 text-white" />
          <span className="text-white font-semibold">
            {threats.length} Ameaça{threats.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn(
      "fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] shadow-2xl border-2 transition-all duration-300",
      criticalCount > 0 
        ? "border-red-500 bg-gradient-to-br from-red-950/90 to-background" 
        : "border-orange-500/70 bg-gradient-to-br from-orange-950/80 to-background"
    )}>
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-2">
          {criticalCount > 0 ? (
            <ShieldOff className="h-5 w-5 text-red-500 animate-pulse" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-orange-500" />
          )}
          <CardTitle className={cn(
            "text-base",
            criticalCount > 0 ? "text-red-400" : "text-orange-400"
          )}>
            {criticalCount > 0 ? '🚨 ATAQUE DETECTADO!' : '⚠️ Ameaças Ativas'}
          </CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-white/10"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Desativar som" : "Ativar som"}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-white/10"
            onClick={fetchThreats}
            title="Atualizar"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-white/10"
            onClick={() => setIsMinimized(true)}
            title="Minimizar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-3">
        <div className="flex gap-2 mb-3">
          {criticalCount > 0 && (
            <Badge className="bg-red-500 text-white animate-pulse">
              {criticalCount} Crítica{criticalCount > 1 ? 's' : ''}
            </Badge>
          )}
          {highCount > 0 && (
            <Badge className="bg-orange-500 text-white">
              {highCount} Alta{highCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <ScrollArea className="h-56">
          <div className="space-y-2">
            {threats.map((threat) => {
              const isCritical = threat.severity === 'critical';
              const namespace = threat.affected_resources?.[0]?.namespace || 'N/A';
              const pod = threat.affected_resources?.[0]?.pod || 'N/A';
              
              return (
                <div
                  key={threat.id}
                  className={cn(
                    "p-3 rounded-lg border transition-all",
                    isCritical 
                      ? "bg-red-500/20 border-red-500/50 animate-pulse" 
                      : "bg-orange-500/15 border-orange-500/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {isCritical ? (
                        <ShieldOff className="h-4 w-4 mt-0.5 shrink-0 text-red-400" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-orange-400" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-medium text-sm truncate",
                          isCritical ? "text-red-300" : "text-orange-300"
                        )}>
                          {threat.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          📍 {namespace} / {pod}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          🕐 {new Date(threat.created_at).toLocaleTimeString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 hover:bg-white/10"
                      onClick={() => dismissThreat(threat.id)}
                      title="Marcar como investigando"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 text-xs border-primary/50 hover:bg-primary/20"
            onClick={() => window.location.href = '/risk-panel'}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Painel de Riscos
          </Button>
          <Button
            variant="ghost"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsDismissed(true)}
          >
            Fechar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

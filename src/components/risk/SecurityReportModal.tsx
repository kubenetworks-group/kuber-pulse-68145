import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/contexts/ClusterContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  RefreshCw,
  Download,
  X,
  ShieldAlert,
  CheckCircle,
  Clock,
  AlertTriangle,
  Zap,
  ChevronDown,
  ChevronRight,
  Terminal,
  Lightbulb,
  Activity,
} from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bgSurface:     "#0F1520",
  bgElevated:    "#161E2E",
  bgSubtle:      "#1C2436",
  borderDefault: "rgba(255,255,255,0.07)",
  borderStrong:  "rgba(255,255,255,0.14)",
  accent:        "#00E5A0",
  accentDim:     "rgba(0,229,160,0.12)",
  textPrimary:   "#F0F4FF",
  textSecondary: "#8892A4",
  textMuted:     "#4A5568",
  critical:      "#FF2D2D",
  criticalDim:   "rgba(255,45,45,0.12)",
  high:          "#FF7A00",
  highDim:       "rgba(255,122,0,0.12)",
  medium:        "#F5C518",
  mediumDim:     "rgba(245,197,24,0.12)",
  low:           "#00E5A0",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportStats {
  total_threats: number;
  critical: number;
  high: number;
  mitigated: number;
  active: number;
  real_attacks: number;
  config_risks: number;
  commands_sent: number;
  heal_actions: number;
}

interface SecurityReport {
  generated_at: string;
  since_hours: number;
  statistics: ReportStats;
  ai_report: string;
  threats_summary: any[];
  commands_summary: any[];
}

interface SecurityReportModalProps {
  open: boolean;
  onClose: () => void;
}

// ─── Markdown renderer (lightweight) ─────────────────────────────────────────

function MarkdownBlock({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // H1
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} style={{
          fontSize: 22, fontWeight: 700, color: T.textPrimary, margin: '24px 0 12px',
          fontFamily: "'JetBrains Mono', 'Geist Mono', monospace",
          borderBottom: `1px solid ${T.borderDefault}`, paddingBottom: 8,
        }}>
          {line.slice(2)}
        </h1>
      );
    }
    // H2
    else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} style={{
          fontSize: 16, fontWeight: 600, color: T.accent, margin: '20px 0 8px',
          fontFamily: "'Geist', 'Inter', sans-serif",
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ width: 3, height: 16, background: T.accent, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
          {line.slice(3)}
        </h2>
      );
    }
    // H3
    else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} style={{
          fontSize: 13, fontWeight: 600, color: T.textPrimary, margin: '14px 0 6px',
          fontFamily: "'Geist', 'Inter', sans-serif", letterSpacing: '0.02em',
        }}>
          {line.slice(4)}
        </h3>
      );
    }
    // H4
    else if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={i} style={{
          fontSize: 12, fontWeight: 600, color: T.textSecondary, margin: '10px 0 4px',
          fontFamily: "'Geist', 'Inter', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {line.slice(5)}
        </h4>
      );
    }
    // Code block
    else if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} style={{
          background: '#0A0F1A', border: `1px solid ${T.borderDefault}`, borderRadius: 8,
          padding: '12px 16px', overflowX: 'auto', margin: '8px 0',
          fontFamily: "'JetBrains Mono', 'Geist Mono', monospace", fontSize: 12,
          color: '#A8C8FF', lineHeight: 1.6,
        }}>
          {codeLines.join('\n')}
        </pre>
      );
    }
    // Bullet list
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0', paddingLeft: 4 }}>
          <span style={{ color: T.accent, flexShrink: 0, marginTop: 2, fontSize: 12 }}>▸</span>
          <span style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6, fontFamily: "'Geist', 'Inter', sans-serif" }}>
            {renderInline(line.slice(2))}
          </span>
        </div>
      );
    }
    // Numbered list
    else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0', paddingLeft: 4 }}>
          <span style={{
            color: T.accent, flexShrink: 0, fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11, fontWeight: 600, minWidth: 18, textAlign: 'right',
          }}>
            {num}.
          </span>
          <span style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6, fontFamily: "'Geist', 'Inter', sans-serif" }}>
            {renderInline(line.replace(/^\d+\.\s/, ''))}
          </span>
        </div>
      );
    }
    // Horizontal rule
    else if (line === '---') {
      elements.push(
        <hr key={i} style={{ border: 'none', borderTop: `1px solid ${T.borderDefault}`, margin: '16px 0' }} />
      );
    }
    // Empty line
    else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 6 }} />);
    }
    // Normal paragraph
    else {
      elements.push(
        <p key={i} style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.7, margin: '2px 0', fontFamily: "'Geist', 'Inter', sans-serif" }}>
          {renderInline(line)}
        </p>
      );
    }
    i++;
  }

  return <div>{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  // Bold + code inline
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{
          background: '#0A0F1A', border: `1px solid ${T.borderDefault}`,
          borderRadius: 4, padding: '1px 5px', fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace", color: '#A8C8FF',
        }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: T.textPrimary, fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: T.bgElevated, border: `1px solid ${T.borderDefault}`,
      borderRadius: 8, padding: '12px 16px', textAlign: 'center', flex: 1, minWidth: 80,
    }}>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SecurityReportModal({ open, onClose }: SecurityReportModalProps) {
  const { selectedClusterId } = useCluster();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sinceHours, setSinceHours] = useState(24);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const generateReport = useCallback(async () => {
    if (!selectedClusterId) return;
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão não encontrada');

      const res = await fetch(
        `${(supabase as any).supabaseUrl}/functions/v1/generate-security-report`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': (supabase as any).supabaseKey,
          },
          body: JSON.stringify({ cluster_id: selectedClusterId, since_hours: sinceHours }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao gerar relatório');
      setReport(json.report);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedClusterId, sinceHours]);

  const downloadReport = () => {
    if (!report) return;
    const content = [
      `# Relatório de Segurança Kubernetes`,
      `Gerado em: ${new Date(report.generated_at).toLocaleString('pt-BR')}`,
      `Período: últimas ${report.since_hours}h`,
      '',
      `## Estatísticas`,
      `- Total de ameaças: ${report.statistics.total_threats}`,
      `- Críticas: ${report.statistics.critical}`,
      `- Altas: ${report.statistics.high}`,
      `- Mitigadas pela IA: ${report.statistics.mitigated}`,
      `- Comandos enviados: ${report.statistics.commands_sent}`,
      '',
      report.ai_report,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-report-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = report?.statistics;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-4xl w-full p-0 gap-0 overflow-hidden"
        style={{ background: T.bgSurface, border: `1px solid ${T.borderDefault}`, maxHeight: '90vh' }}
      >
        {/* Header */}
        <DialogHeader className="px-6 py-4" style={{ borderBottom: `1px solid ${T.borderDefault}` }}>
          <DialogTitle
            className="flex items-center justify-between"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            <div className="flex items-center gap-3">
              <div style={{ padding: 8, background: T.accentDim, borderRadius: 8, border: `1px solid rgba(0,229,160,0.2)` }}>
                <FileText style={{ width: 16, height: 16, color: T.accent }} />
              </div>
              <div>
                <p style={{ fontSize: 16, color: T.textPrimary, fontWeight: 600 }}>
                  Relatório de Segurança
                </p>
                <p style={{ fontSize: 11, color: T.textSecondary, fontWeight: 400, fontFamily: "'Geist', sans-serif" }}>
                  Análise completa com diagnóstico e ações da IA
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* Period selector */}
              <select
                value={sinceHours}
                onChange={(e) => setSinceHours(Number(e.target.value))}
                style={{
                  background: T.bgElevated, border: `1px solid ${T.borderDefault}`,
                  borderRadius: 6, color: T.textSecondary, fontSize: 12, padding: '4px 8px',
                  outline: 'none', cursor: 'pointer',
                }}
              >
                <option value={6}>Últimas 6h</option>
                <option value={24}>Últimas 24h</option>
                <option value={72}>Últimas 72h</option>
                <option value={168}>Última semana</option>
              </select>

              {report && (
                <button
                  onClick={downloadReport}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                    padding: '5px 10px', borderRadius: 6, background: T.bgElevated,
                    color: T.textSecondary, border: `1px solid ${T.borderDefault}`,
                    cursor: 'pointer', outline: 'none',
                  }}
                >
                  <Download style={{ width: 12, height: 12 }} />
                  .md
                </button>
              )}

              <button
                onClick={generateReport}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                  padding: '5px 12px', borderRadius: 6,
                  background: loading ? T.bgElevated : T.accent,
                  color: loading ? T.textSecondary : '#000',
                  border: `1px solid ${loading ? T.borderDefault : T.accent}`,
                  cursor: loading ? 'not-allowed' : 'pointer', outline: 'none', fontWeight: 600,
                }}
              >
                {loading ? (
                  <RefreshCw style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Zap style={{ width: 12, height: 12 }} />
                )}
                {loading ? 'Gerando...' : report ? 'Regenerar' : 'Gerar Relatório'}
              </button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          <div className="p-6 space-y-6">

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(255,45,45,0.1)', border: '1px solid rgba(255,45,45,0.25)',
                borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 8,
              }}>
                <AlertTriangle style={{ width: 14, height: 14, color: T.critical, flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, color: T.critical }}>{error}</span>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div style={{
                background: T.bgElevated, border: `1px solid ${T.borderDefault}`,
                borderRadius: 12, padding: 40, textAlign: 'center',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    border: `3px solid ${T.borderDefault}`, borderTopColor: T.accent,
                    animation: 'spin 1s linear infinite',
                  }} />
                  <div>
                    <p style={{ fontSize: 14, color: T.textPrimary, fontWeight: 500 }}>
                      A IA está analisando os eventos de segurança...
                    </p>
                    <p style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
                      Isso pode levar alguns segundos
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loading && !report && !error && (
              <div style={{
                background: T.bgElevated, border: `1px solid ${T.borderDefault}`,
                borderRadius: 12, padding: 40, textAlign: 'center',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    padding: 16, background: T.accentDim, borderRadius: 12,
                    border: `1px solid rgba(0,229,160,0.2)`,
                  }}>
                    <FileText style={{ width: 28, height: 28, color: T.accent }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, color: T.textPrimary, fontWeight: 600 }}>
                      Relatório de Segurança com IA
                    </p>
                    <p style={{ fontSize: 13, color: T.textSecondary, marginTop: 6, maxWidth: 400, lineHeight: 1.6 }}>
                      Gere um relatório completo com análise de ameaças, linha do tempo,
                      diagnóstico de troubleshooting e tudo que a IA fez para corrigir os problemas.
                    </p>
                  </div>
                  <button
                    onClick={generateReport}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                      padding: '8px 20px', borderRadius: 8, background: T.accent,
                      color: '#000', border: 'none', cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    <Zap style={{ width: 14, height: 14 }} />
                    Gerar Relatório Agora
                  </button>
                </div>
              </div>
            )}

            {/* Report content */}
            {report && !loading && (
              <div className="space-y-6">

                {/* Stats bar */}
                <div>
                  <p style={{ fontSize: 11, color: T.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Últimas {report.since_hours}h — {new Date(report.generated_at).toLocaleString('pt-BR')}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <StatCard label="Total"     value={stats!.total_threats}  color={T.textPrimary} />
                    <StatCard label="Críticas"  value={stats!.critical}       color={T.critical} />
                    <StatCard label="Altas"     value={stats!.high}           color={T.high} />
                    <StatCard label="Ataques"   value={stats!.real_attacks}   color={T.high} />
                    <StatCard label="Mitigadas" value={stats!.mitigated}      color={T.accent} />
                    <StatCard label="Ativas"    value={stats!.active}         color={stats!.active > 0 ? T.critical : T.accent} />
                    <StatCard label="Cmds IA"   value={stats!.commands_sent}  color={T.accent} />
                  </div>
                </div>

                {/* Quick status badges */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {stats!.active === 0 ? (
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                      padding: '5px 12px', borderRadius: 100,
                      background: 'rgba(0,229,160,0.1)', color: T.accent,
                      border: '1px solid rgba(0,229,160,0.25)',
                    }}>
                      <CheckCircle style={{ width: 12, height: 12 }} />
                      Nenhuma ameaça ativa
                    </span>
                  ) : (
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                      padding: '5px 12px', borderRadius: 100,
                      background: T.criticalDim, color: T.critical,
                      border: '1px solid rgba(255,45,45,0.25)',
                    }}>
                      <ShieldAlert style={{ width: 12, height: 12 }} />
                      {stats!.active} ameaça{stats!.active !== 1 ? 's' : ''} ativa{stats!.active !== 1 ? 's' : ''}
                    </span>
                  )}
                  {stats!.commands_sent > 0 && (
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                      padding: '5px 12px', borderRadius: 100,
                      background: T.accentDim, color: T.accent,
                      border: '1px solid rgba(0,229,160,0.25)',
                    }}>
                      <Zap style={{ width: 12, height: 12 }} />
                      {stats!.commands_sent} correção{stats!.commands_sent !== 1 ? 'ões' : ''} aplicada{stats!.commands_sent !== 1 ? 's' : ''} pela IA
                    </span>
                  )}
                </div>

                {/* AI Report content */}
                <div style={{
                  background: T.bgElevated, border: `1px solid ${T.borderDefault}`,
                  borderRadius: 12, padding: '24px 28px',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
                    paddingBottom: 16, borderBottom: `1px solid ${T.borderDefault}`,
                  }}>
                    <Activity style={{ width: 14, height: 14, color: T.accent }} />
                    <span style={{ fontSize: 13, color: T.accent, fontWeight: 600, fontFamily: "'Geist', sans-serif" }}>
                      Análise da IA
                    </span>
                  </div>
                  <MarkdownBlock content={report.ai_report} />
                </div>

                {/* Collapsible: Threats detail */}
                {report.threats_summary.length > 0 && (
                  <CollapsibleSection
                    id="threats"
                    icon={<ShieldAlert style={{ width: 13, height: 13 }} />}
                    title={`Detalhes das Ameaças (${report.threats_summary.length})`}
                    expanded={expandedSection === 'threats'}
                    onToggle={() => setExpandedSection(v => v === 'threats' ? null : 'threats')}
                  >
                    <div className="space-y-2">
                      {report.threats_summary.map((t, i) => (
                        <div key={i} style={{
                          background: T.bgSubtle, border: `1px solid ${T.borderDefault}`,
                          borderRadius: 8, padding: '10px 14px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{
                              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                              background: t.severity === 'critical' ? T.critical : t.severity === 'high' ? T.high : T.medium,
                            }} />
                            <span style={{ fontSize: 12, color: T.textPrimary, fontWeight: 500 }}>{t.title}</span>
                            <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
                              {t.namespace || 'cluster'}
                            </span>
                            {t.status === 'mitigated' && (
                              <span style={{ fontSize: 10, color: T.accent, background: T.accentDim, padding: '1px 8px', borderRadius: 100 }}>
                                resolvida
                              </span>
                            )}
                          </div>
                          {t.ai_recommendation && (
                            <p style={{ fontSize: 11, color: T.textMuted, marginTop: 6, lineHeight: 1.5 }}>
                              {t.ai_recommendation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Collapsible: Commands detail */}
                {report.commands_summary.length > 0 && (
                  <CollapsibleSection
                    id="commands"
                    icon={<Terminal style={{ width: 13, height: 13 }} />}
                    title={`Comandos Executados pela IA (${report.commands_summary.length})`}
                    expanded={expandedSection === 'commands'}
                    onToggle={() => setExpandedSection(v => v === 'commands' ? null : 'commands')}
                  >
                    <div className="space-y-2">
                      {report.commands_summary.map((c, i) => (
                        <div key={i} style={{
                          background: '#0A0F1A', border: `1px solid ${T.borderDefault}`,
                          borderRadius: 8, padding: '10px 14px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{
                              fontSize: 11, color: T.accent, fontFamily: "'JetBrains Mono', monospace",
                              background: T.accentDim, padding: '2px 8px', borderRadius: 4,
                            }}>
                              {c.type}
                            </span>
                            <span style={{ fontSize: 11, color: T.textMuted }}>
                              {c.status === 'completed' ? '✓ concluído' : c.status === 'failed' ? '✗ falhou' : c.status}
                            </span>
                            <span style={{ fontSize: 10, color: T.textMuted, marginLeft: 'auto' }}>
                              {new Date(c.created_at).toLocaleTimeString('pt-BR')}
                            </span>
                          </div>
                          <pre style={{
                            fontSize: 11, color: '#8892A4', lineHeight: 1.5, whiteSpace: 'pre-wrap',
                            fontFamily: "'JetBrains Mono', monospace", margin: 0,
                          }}>
                            {JSON.stringify(c.params, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                )}

              </div>
            )}
          </div>
        </ScrollArea>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

// ─── CollapsibleSection ───────────────────────────────────────────────────────

function CollapsibleSection({
  id, icon, title, expanded, onToggle, children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: T.bgElevated, border: `1px solid ${T.borderDefault}`, borderRadius: 10, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
          color: T.textSecondary, fontSize: 13, fontFamily: "'Geist', sans-serif",
        }}
      >
        <span style={{ color: T.accent }}>{icon}</span>
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>{title}</span>
        {expanded
          ? <ChevronDown style={{ width: 13, height: 13 }} />
          : <ChevronRight style={{ width: 13, height: 13 }} />
        }
      </button>
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${T.borderDefault}`, paddingTop: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
}

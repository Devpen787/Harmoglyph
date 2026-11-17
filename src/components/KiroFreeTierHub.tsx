import { useEffect, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Cpu,
  FileText,
  Loader2,
  Play,
  Server,
  Zap,
  XCircle,
} from 'lucide-react';
import { RepoAuditReport } from '../types/chimera';

interface SteeringDocItem {
  id: string;
  file: string;
  path: string;
  title: string;
  inclusion: 'always' | 'fileMatch' | 'manual' | string;
  fileMatchPattern: string | null;
  excerpt: string;
}

interface HookItem {
  id: string;
  file: string;
  path: string;
  name: string;
  event: string;
  filePattern?: string;
  enabled: boolean;
  description: string;
}

interface PowerItem {
  id: string;
  file: string;
  path: string;
  displayName: string;
  description: string;
  keywords: string;
  excerpt: string;
}

interface CrewAgentItem {
  id: string;
  role: string;
  focus: string;
  owns: string[];
}

interface McpServerSpec {
  type?: string;
  command?: string;
  args?: string[];
  url?: string;
  description?: string;
  disabled?: boolean;
}

interface WorkspacePayload {
  steeringDocs: SteeringDocItem[];
  hooks: HookItem[];
  powers: PowerItem[];
  crew: {
    name: string;
    version?: string;
    description?: string;
    agents: CrewAgentItem[];
  };
  mcpServers: Record<string, McpServerSpec>;
}

interface HookExecutionResult {
  ok: boolean;
  hookId: string;
  durationMs: number;
  summary: string;
  details: string[];
}

interface KiroFreeTierHubProps {
  onAuditUpdated?: (audit: RepoAuditReport) => void;
}

type HubTab = 'hooks' | 'steering' | 'crew-powers-mcp';

export function KiroFreeTierHub({ onAuditUpdated }: KiroFreeTierHubProps) {
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [activeTab, setActiveTab] = useState<HubTab>('hooks');
  const [runningHookId, setRunningHookId] = useState<string | null>(null);
  const [hookResults, setHookResults] = useState<Record<string, HookExecutionResult>>({});

  useEffect(() => {
    let cancelled = false;
    async function fetchWorkspace() {
      try {
        const res = await fetch('/api/kiroween/free-tier-workspace');
        if (!res.ok) return;
        const data = (await res.json()) as WorkspacePayload;
        if (!cancelled) {
          setWorkspace(data);
        }
      } catch {
        // Ignore transient network errors
      }
    }
    void fetchWorkspace();
    return () => {
      cancelled = true;
    };
  }, []);

  const executeHook = async (hookId: string) => {
    setRunningHookId(hookId);
    try {
      const res = await fetch('/api/kiroween/run-hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hookId }),
      });
      const data = await res.json();
      if (res.ok) {
        setHookResults((prev) => ({
          ...prev,
          [hookId]: {
            ok: Boolean(data.ok),
            hookId,
            durationMs: Number(data.durationMs ?? 0),
            summary: String(data.summary ?? ''),
            details: Array.isArray(data.details) ? data.details : [],
          },
        }));
        if (data.audit && onAuditUpdated) {
          onAuditUpdated(data.audit as RepoAuditReport);
        }
      }
    } catch {
      // Ignore network errors
    } finally {
      setRunningHookId(null);
    }
  };

  const executeAllHooks = async () => {
    const ids = (workspace?.hooks ?? []).map((h) => h.id);
    for (const id of ids) {
      await executeHook(id);
    }
  };

  const steeringDocs = workspace?.steeringDocs ?? [];
  const hooks = workspace?.hooks ?? [];
  const powers = workspace?.powers ?? [];
  const agents = workspace?.crew?.agents ?? [];
  const mcpEntries = Object.entries(workspace?.mcpServers ?? {});

  return (
    <section
      aria-label="Kiro Free-Tier Command Center"
      className="border border-[#1F2A40] rounded-lg bg-[#111622] p-5 flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#00E5CC] shrink-0" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-[#EDF2F9]">
              Kiro Free-Tier Command Center (Zero-Cost Local Organization)
            </h2>
          </div>
          <p className="text-xs text-[#8A99B8] mt-1">
            Maximizes every free-subscription Kiro capability: token-aware <span className="font-mono text-[#00E5CC]">always / fileMatch / manual</span> steering, executable agent hooks, 5-role Synth Crew, Kiro Powers, and zero-cost local MCP servers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'hooks', label: `Executable Hooks (${hooks.length})` },
              { id: 'steering', label: `Token-Smart Steering (${steeringDocs.length})` },
              {
                id: 'crew-powers-mcp',
                label: `Crew (${agents.length}) · Powers (${powers.length}) · MCP (${mcpEntries.length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md border text-xs font-medium cursor-pointer transition-colors ${
                activeTab === tab.id
                  ? 'border-[#00E5CC] bg-[#00E5CC]/12 text-[#00E5CC] font-semibold'
                  : 'border-[#1F2A40] bg-[#07090E] text-[#8A99B8] hover:text-[#EDF2F9]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Executable Kiro Agent Hooks */}
      {activeTab === 'hooks' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#07090E] border border-[#1F2A40] rounded-md px-3.5 py-2.5">
            <span className="text-xs text-[#8A99B8]">
              Run any <span className="font-mono text-[#00E5CC]">/.kiro/hooks/*.json</span> hook on demand to verify the 500-trial PBT suite, math-art symmetry, and repository compliance:
            </span>
            <button
              type="button"
              onClick={executeAllHooks}
              disabled={Boolean(runningHookId)}
              className="px-3.5 py-1.5 rounded bg-[#00E5CC] text-[#07090E] text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {runningHookId ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>Run All {hooks.length} Hooks</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {hooks.map((hook) => {
              const res = hookResults[hook.id];
              const isRunning = runningHookId === hook.id;
              return (
                <div
                  key={hook.id}
                  className={`border rounded-md bg-[#07090E] p-3.5 flex flex-col justify-between gap-3 ${
                    res
                      ? res.ok
                        ? 'border-[#00E5CC]/55'
                        : 'border-[#F43F5E]/60'
                      : 'border-[#1F2A40]'
                  }`}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-[#EDF2F9]">{hook.name}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[#F59E0B]/50 bg-[#F59E0B]/10 text-[#F59E0B] shrink-0">
                        {hook.event}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-[#00E5CC] truncate">{hook.path}</div>
                    {hook.filePattern && (
                      <div className="text-[11px] font-mono text-[#8A99B8]">
                        Match: <span className="text-[#EDF2F9]">{hook.filePattern}</span>
                      </div>
                    )}
                    <p className="text-[11px] text-[#8A99B8] leading-snug">{hook.description}</p>
                  </div>

                  <div className="flex flex-col gap-2 pt-2 border-t border-[#1F2A40]">
                    <div className="flex items-center justify-between gap-2">
                      {res ? (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-mono font-semibold ${
                            res.ok ? 'text-[#00E5CC]' : 'text-[#F43F5E]'
                          }`}
                        >
                          {res.ok ? (
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          <span>
                            {res.ok ? 'PASSED' : 'FAILED'} ({res.durationMs} ms)
                          </span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-[#8A99B8]">Ready to run</span>
                      )}

                      <button
                        type="button"
                        onClick={() => executeHook(hook.id)}
                        disabled={Boolean(runningHookId)}
                        className="px-2.5 py-1 rounded border border-[#00E5CC] bg-[#111622] text-[11px] font-semibold text-[#00E5CC] hover:bg-[#00E5CC]/10 flex items-center gap-1 cursor-pointer"
                      >
                        {isRunning ? (
                          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <Play className="w-3 h-3" aria-hidden="true" />
                        )}
                        <span>Run Hook</span>
                      </button>
                    </div>

                    {res && (
                      <div className="p-2 rounded bg-[#0B0F17] border border-[#1F2A40] font-mono text-[10px] text-[#EDF2F9] flex flex-col gap-1 max-h-36 overflow-y-auto">
                        <div className="text-[#00E5CC] font-semibold">{res.summary}</div>
                        {res.details.map((line, i) => (
                          <div key={`${hook.id}-line-${i}`} className="text-[#8A99B8]">
                            {line}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Token-Smart Steering Docs */}
      {activeTab === 'steering' && (
        <div className="flex flex-col gap-3">
          <div className="bg-[#07090E] border border-[#1F2A40] rounded-md p-3 text-xs text-[#8A99B8]">
            <strong className="text-[#EDF2F9]">Free-Subscription Context Optimization:</strong>{' '}
            Foundational steering (<span className="font-mono text-[#00E5CC]">product.md</span>,{' '}
            <span className="font-mono text-[#00E5CC]">tech-stack.md</span>,{' '}
            <span className="font-mono text-[#00E5CC]">structure.md</span>) uses{' '}
            <span className="font-mono text-[#00E5CC]">inclusion: always</span>; domain contracts use{' '}
            <span className="font-mono text-[#F59E0B]">inclusion: fileMatch</span> so they load only when editing engine code; and hackathon packaging uses{' '}
            <span className="font-mono text-[#38BDF8]">inclusion: manual</span> (<span className="font-mono">#kiroween-submission-guide</span>).
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {steeringDocs.map((doc) => {
              const badgeColor =
                doc.inclusion === 'always'
                  ? 'border-[#00E5CC]/50 bg-[#00E5CC]/10 text-[#00E5CC]'
                  : doc.inclusion === 'fileMatch'
                    ? 'border-[#F59E0B]/50 bg-[#F59E0B]/10 text-[#F59E0B]'
                    : 'border-[#38BDF8]/50 bg-[#38BDF8]/10 text-[#38BDF8]';
              return (
                <div
                  key={doc.id}
                  className="border border-[#1F2A40] rounded-md bg-[#07090E] p-3.5 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-[#00E5CC] shrink-0" aria-hidden="true" />
                      <span className="text-xs font-semibold text-[#EDF2F9] truncate">
                        {doc.file}
                      </span>
                    </div>
                    <span className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${badgeColor}`}>
                      {doc.inclusion}
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-[#EDF2F9]">{doc.title}</div>
                  {doc.fileMatchPattern && (
                    <div className="text-[10px] font-mono text-[#F59E0B] truncate">
                      fileMatch: {doc.fileMatchPattern}
                    </div>
                  )}
                  <pre className="text-[10px] font-mono text-[#8A99B8] whitespace-pre-wrap bg-[#0B0F17] border border-[#1F2A40] rounded p-2 max-h-28 overflow-y-auto">
                    {doc.excerpt}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: 5-Agent Crew, Kiro Powers & Zero-Cost Local MCP */}
      {activeTab === 'crew-powers-mcp' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* 5-Agent Crew */}
          <div className="border border-[#1F2A40] rounded-md bg-[#07090E] p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#EDF2F9]">
              <Bot className="w-4 h-4 text-[#00E5CC]" aria-hidden="true" />
              <span>5-Agent Synth Crew (/.kiro/agents/synth-crew.json)</span>
            </div>
            <div className="flex flex-col gap-2">
              {agents.map((ag) => (
                <div
                  key={ag.id}
                  className="p-2.5 rounded border border-[#1F2A40] bg-[#0B0F17] flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#EDF2F9]">{ag.role}</span>
                    <span className="font-mono text-[10px] text-[#00E5CC]">{ag.id}</span>
                  </div>
                  <p className="text-[11px] text-[#8A99B8] leading-snug">{ag.focus}</p>
                  <div className="text-[10px] font-mono text-[#38BDF8] truncate">
                    Owns: {ag.owns.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Kiro Powers */}
          <div className="border border-[#1F2A40] rounded-md bg-[#07090E] p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#EDF2F9]">
              <Zap className="w-4 h-4 text-[#F59E0B]" aria-hidden="true" />
              <span>Bundled Kiro Powers (/.kiro/powers/*.md)</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {powers.map((pw) => (
                <div
                  key={pw.id}
                  className="p-2.5 rounded border border-[#1F2A40] bg-[#0B0F17] flex flex-col gap-1.5"
                >
                  <div className="text-xs font-semibold text-[#EDF2F9]">{pw.displayName}</div>
                  <div className="text-[10px] font-mono text-[#00E5CC]">{pw.path}</div>
                  <p className="text-[11px] text-[#8A99B8] leading-snug">{pw.description}</p>
                  <pre className="text-[10px] font-mono text-[#8A99B8] whitespace-pre-wrap bg-[#07090E] border border-[#1F2A40] rounded p-2 max-h-28 overflow-y-auto">
                    {pw.excerpt}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          {/* Local Zero-Cost MCP Servers */}
          <div className="border border-[#1F2A40] rounded-md bg-[#07090E] p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#EDF2F9]">
              <Server className="w-4 h-4 text-[#38BDF8]" aria-hidden="true" />
              <span>Zero-Cost Local MCP Servers (/.kiro/settings/mcp.json)</span>
            </div>
            <div className="flex flex-col gap-2">
              {mcpEntries.map(([name, cfg]) => (
                <div
                  key={name}
                  className="p-2.5 rounded border border-[#1F2A40] bg-[#0B0F17] flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-[#EDF2F9]">{name}</span>
                    <span className="text-[10px] font-mono text-[#00E5CC] uppercase">
                      {cfg.type || 'stdio'} · Active
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-[#38BDF8] break-all">
                    {cfg.url || `${cfg.command ?? ''} ${(cfg.args ?? []).join(' ')}`}
                  </div>
                  {cfg.description && (
                    <p className="text-[11px] text-[#8A99B8] leading-snug">{cfg.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

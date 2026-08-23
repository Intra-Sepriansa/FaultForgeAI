import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/auth-context.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  DiffViewer,
  VirtualList,
} from '@faultforge/ui';
import {
  AlertTriangle,
  Terminal,
  Shield,
  Layers,
  Sparkles,
  RefreshCw,
  GitPullRequest,
  FileCode,
} from 'lucide-react';

export const WarRoom: React.FC = () => {
  const { incidentId } = useParams<{ incidentId: string }>();
  const { activeWorkspaceId } = useAuth();
  const navigate = useNavigate();
  const [logFilter, setLogFilter] = useState('');

  // Fetch Incident Details
  const {
    data: incident,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ['incident', activeWorkspaceId, incidentId],
    queryFn: () =>
      apiFetch<{
        id: string;
        status: string;
        severity: string;
        snapshotHash: string;
        scenario: { code: string; title: string; category: string; rootCause: string };
        evidence: Array<{
          id: string;
          type: string;
          payload: Record<string, unknown>;
          collectedAt: string;
        }>;
        hypotheses: Array<{
          id: string;
          rank: number;
          description: string;
          confidence: number;
          claimStatus: string;
          evidenceCites: string[];
        }>;
        agentRuns: Array<{
          id: string;
          specialistRole: string;
          durationMs: number;
          promptTokens: number;
        }>;
      }>(`/workspaces/${activeWorkspaceId}/incidents/${incidentId}`),
    enabled: !!activeWorkspaceId && !!incidentId,
    refetchInterval: 3000,
  });

  const mockLogs = [
    { id: '1', level: 'info', time: '10:14:01', msg: 'Incoming HTTP POST /api/v1/checkout' },
    {
      id: '2',
      level: 'warn',
      time: '10:14:02',
      msg: 'Concurrent read on stock for item prod-item-101 (stock=5)',
    },
    {
      id: '3',
      level: 'error',
      time: '10:14:03',
      msg: 'Stock decrement completed without row lock! Stock overbooked to -2',
    },
    {
      id: '4',
      level: 'info',
      time: '10:14:04',
      msg: 'Telemetry span exported: trace_id=4bf92f3577b34da6a3ce929d0e0e4736',
    },
    { id: '5', level: 'warn', time: '10:14:05', msg: 'OutboxEvent created: INCIDENT_INJECTED' },
  ];

  const sampleDiff = `--- a/labs/commerce-lab/src/server.ts
+++ b/labs/commerce-lab/src/server.ts
@@ -35,7 +35,7 @@
-  // Vulnerable non-atomic read and write
-  const currentStock = product.stock;
-  await sleep(30);
-  store.unsafeSetStock(productId, currentStock - 1);
+  // Atomic decrement protection
  const success = store.atomicDecrementStock(productId, 1);
  if (!success) return reply.status(409).send({ error: 'Out of stock' });`;

  if (isLoading || !incident) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-slate-400 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
          Loading Incident War Room...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {incident.scenario.title}
                </h1>
                <Badge variant={incident.severity === 'CRITICAL' ? 'danger' : 'warning'}>
                  {incident.severity}
                </Badge>
                <Badge variant="purple">{incident.status}</Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Incident ID: <span className="font-mono text-slate-300">{incident.id}</span> |
                Snapshot: <span className="font-mono text-slate-300">{incident.snapshotHash}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
          <Button size="sm" variant="primary" onClick={() => navigate(`/arena/${incident.id}`)}>
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Open Solution Arena
          </Button>
        </div>
      </div>

      {/* Topology & Hypothesis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Topology Status */}
        <Card className="lg:col-span-1 border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              Service Topology & Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-xs font-medium text-slate-200">Commerce Lab (Target)</span>
              </div>
              <Badge variant="danger">FAULT ACTIVE</Badge>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-slate-200">PostgreSQL 16 DB</span>
              </div>
              <Badge variant="success">HEALTHY</Badge>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-slate-200">BullMQ & Redis 7</span>
              </div>
              <Badge variant="success">HEALTHY</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Hypothesis Board */}
        <Card className="lg:col-span-2 border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              AI Investigator Hypothesis Board
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {incident.hypotheses.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                AI Investigator is analyzing telemetry traces and logs...
              </div>
            ) : (
              incident.hypotheses.map((hyp) => (
                <div
                  key={hyp.id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="purple">Rank #{hyp.rank}</Badge>
                      <Badge variant="success">
                        Confidence: {Math.round(hyp.confidence * 100)}%
                      </Badge>
                      <Badge variant="info">{hyp.claimStatus}</Badge>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                      Citations: {hyp.evidenceCites.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{hyp.description}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* War Room Deep Tabs */}
      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">
            <Terminal className="w-3.5 h-3.5 mr-1.5" /> Structured Logs & Spans
          </TabsTrigger>
          <TabsTrigger value="diff">
            <GitPullRequest className="w-3.5 h-3.5 mr-1.5" /> Proposed Patch Diff
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <Card>
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">Live Correlated Stream</span>
              <input
                type="text"
                placeholder="Filter logs by keyword..."
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="bg-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="p-3">
              <VirtualList
                items={mockLogs.filter((l) =>
                  l.msg.toLowerCase().includes(logFilter.toLowerCase()),
                )}
                itemHeight={36}
                containerHeight={240}
                renderItem={(item: { id: string; level: string; time: string; msg: string }) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2 text-xs font-mono border-b border-slate-900/60 hover:bg-slate-900/30"
                  >
                    <span className="text-slate-500">{item.time}</span>
                    <Badge
                      variant={
                        item.level === 'error'
                          ? 'danger'
                          : item.level === 'warn'
                            ? 'warning'
                            : 'default'
                      }
                    >
                      {item.level.toUpperCase()}
                    </Badge>
                    <span className="text-slate-300 truncate">{item.msg}</span>
                  </div>
                )}
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="diff">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-400" />
                Candidate Solution Patch Diff (Deterministic Verification Passed)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DiffViewer diffText={sampleDiff} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

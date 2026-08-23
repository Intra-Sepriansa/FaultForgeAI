import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/auth-context.js';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@faultforge/ui';
import { Activity, ShieldAlert, Cpu, Terminal, ArrowRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { role, activeWorkspaceId, loginMock } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedScenario, setSelectedScenario] = useState('COMMERCE_RACE_CONDITION');

  // Fetch Labs
  const { data: labsData } = useQuery({
    queryKey: ['labs'],
    queryFn: () =>
      apiFetch<{
        items: Array<{
          id: string;
          name: string;
          scenarios: Array<{
            code: string;
            title: string;
            difficulty: string;
            category: string;
            description: string;
          }>;
        }>;
      }>('/labs'),
  });

  // Fetch Incidents
  const { data: incidentsData } = useQuery({
    queryKey: ['incidents', activeWorkspaceId],
    queryFn: () =>
      activeWorkspaceId
        ? apiFetch<{
            items: Array<{
              id: string;
              status: string;
              severity: string;
              scenario: { title: string; code: string };
              createdAt: string;
            }>;
          }>(`/workspaces/${activeWorkspaceId}/incidents`)
        : Promise.resolve({ items: [] }),
    enabled: !!activeWorkspaceId,
  });

  // Mutation to inject fault
  const injectMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<{ incident: { id: string } }>(`/workspaces/${activeWorkspaceId}/incidents`, {
        method: 'POST',
        body: JSON.stringify({
          scenarioCode: selectedScenario,
          severity: 'HIGH',
        }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      navigate(`/incidents/${data.incident.id}`);
    },
  });

  const handleQuickLogin = async (targetRole: string) => {
    await loginMock(`${targetRole.toLowerCase()}@faultforge.local`, targetRole);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Zap className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">FaultForge AI</h1>
            <Badge variant="success">Online v0.1.0</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Break systems safely. Fix them with evidence. Multi-agent incident response and AI code
            evaluation.
          </p>
        </div>

        {/* User Role Switcher */}
        <div className="flex items-center gap-2 bg-slate-950/80 p-2 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 pl-2">Role:</span>
          <span className="text-xs font-semibold text-emerald-400 px-2">{role}</span>
          <Button
            size="sm"
            variant={role === 'ADMIN' ? 'primary' : 'outline'}
            onClick={() => handleQuickLogin('ADMIN')}
          >
            Admin
          </Button>
          <Button
            size="sm"
            variant={role === 'ENGINEER' ? 'primary' : 'outline'}
            onClick={() => handleQuickLogin('ENGINEER')}
          >
            Engineer
          </Button>
          <Button
            size="sm"
            variant={role === 'REVIEWER' ? 'primary' : 'outline'}
            onClick={() => handleQuickLogin('REVIEWER')}
          >
            Reviewer
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Incidents</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {incidentsData?.items.length || 0}
          </div>
        </Card>

        <Card className="border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Target Labs</span>
            <Cpu className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{labsData?.items.length || 1}</div>
        </Card>

        <Card className="border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Telemetry Engine</span>
            <Terminal className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">OpenTelemetry</div>
        </Card>

        <Card className="border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Sandbox Isolation</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">Active</div>
        </Card>
      </div>

      {/* Fault Injection Station */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Controlled Fault Injection Launchpad
          </CardTitle>
          <p className="text-xs text-slate-400">
            Select a verified lab scenario to inject realistic failures into the microservice
            environment.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {labsData?.items[0]?.scenarios.map((sc) => (
              <div
                key={sc.code}
                onClick={() => setSelectedScenario(sc.code)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedScenario === sc.code
                    ? 'border-emerald-500 bg-emerald-950/20 shadow-md ring-1 ring-emerald-500'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={sc.difficulty === 'HARD' ? 'danger' : 'warning'}>
                    {sc.difficulty}
                  </Badge>
                  <span className="text-xs text-slate-500">{sc.category}</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-100 mb-1">{sc.title}</h4>
                <p className="text-xs text-slate-400 line-clamp-2">{sc.description}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-400">
              Selected Scenario:{' '}
              <span className="font-mono text-emerald-400">{selectedScenario}</span>
            </div>
            <Button
              variant="danger"
              isLoading={injectMutation.isPending}
              onClick={() => injectMutation.mutate()}
            >
              Inject Fault & Open War Room
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

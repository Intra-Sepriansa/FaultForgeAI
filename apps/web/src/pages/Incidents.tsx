import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/auth-context.js';
import { Card, CardContent, Button, Badge } from '@faultforge/ui';
import { ArrowRight, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Incidents: React.FC = () => {
  const { activeWorkspaceId } = useAuth();
  const navigate = useNavigate();

  const { data: incidentsData, isLoading } = useQuery({
    queryKey: ['incidents', activeWorkspaceId],
    queryFn: () =>
      activeWorkspaceId
        ? apiFetch<{
            items: Array<{
              id: string;
              status: string;
              severity: string;
              createdAt: string;
              scenario: { title: string; code: string; category: string };
            }>;
          }>(`/workspaces/${activeWorkspaceId}/incidents`)
        : Promise.resolve({ items: [] }),
    enabled: !!activeWorkspaceId,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Active & Past Incidents</h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse all simulated chaos injections and agent investigation histories in this
            workspace.
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate('/')}>
          + New Incident Run
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading incidents...</div>
          ) : !incidentsData?.items.length ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No incident runs recorded yet. Launch one from the dashboard!
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {incidentsData.items.map((inc) => (
                <div
                  key={inc.id}
                  className="p-4 flex items-center justify-between hover:bg-slate-900/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-200">
                        {inc.scenario.title}
                      </span>
                      <Badge variant={inc.severity === 'CRITICAL' ? 'danger' : 'warning'}>
                        {inc.severity}
                      </Badge>
                      <Badge variant="purple">{inc.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                      <span>ID: {inc.id.substring(0, 8)}...</span>
                      <span>Category: {inc.scenario.category}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(inc.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                  >
                    Open War Room
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

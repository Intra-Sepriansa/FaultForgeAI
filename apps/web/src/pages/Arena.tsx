import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  DiffViewer,
} from '@faultforge/ui';
import { Sparkles, CheckCircle2, ArrowLeft, Award, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/auth-context.js';

export const Arena: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [selectedCandidate, setSelectedCandidate] = useState<'A' | 'B'>('B');
  const [isApproved, setIsApproved] = useState(false);

  const candidateA = {
    alias: 'Candidate-ALPHA (Blinded)',
    totalScore: 78,
    isPassingTests: true,
    hasSecFlaws: false,
    breakdown: {
      correctness: 20,
      security: 18,
      performance: 10,
      reliability: 10,
      apiDataModel: 10,
      testQuality: 5,
      clarity: 5,
    },
    rationale:
      'Implements in-memory Mutex lock wrapping the entire checkout handler. Effectively serializes requests to prevent race condition, but introduces 15ms latency bottleneck under high load.',
    diff: `--- a/labs/commerce-lab/src/server.ts
+++ b/labs/commerce-lab/src/server.ts
@@ -20,6 +20,12 @@
+  const mutex = new Mutex();
+  await mutex.acquire();
+  try {
+    const currentStock = product.stock;
+    store.unsafeSetStock(productId, currentStock - 1);
+  } finally {
+    mutex.release();
+  }`,
  };

  const candidateB = {
    alias: 'Candidate-BETA (Blinded)',
    totalScore: 96,
    isPassingTests: true,
    hasSecFlaws: false,
    breakdown: {
      correctness: 25,
      security: 20,
      performance: 15,
      reliability: 10,
      apiDataModel: 10,
      testQuality: 10,
      clarity: 5,
    },
    rationale:
      'Implements atomic database-level single-statement conditional decrement. Guaranteed zero race condition, zero lock contention overhead, and sub-1ms response time.',
    diff: `--- a/labs/commerce-lab/src/server.ts
+++ b/labs/commerce-lab/src/server.ts
@@ -25,7 +25,7 @@
-  const currentStock = product.stock;
-  store.unsafeSetStock(productId, currentStock - 1);
+  const success = store.atomicDecrementStock(productId, 1);
+  if (!success) return reply.status(409).send({ error: 'Out of stock' });`,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-emerald-400" />
              AI Solution Evaluation Arena
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Double-Blind Side-by-Side Patch Comparison & 100-Point Versioned Rubric Grader
            </p>
          </div>
        </div>

        {isApproved ? (
          <Badge variant="success" className="px-3 py-1.5 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Patch Approved for Canary Simulation
          </Badge>
        ) : (
          <Button
            variant="primary"
            onClick={() => setIsApproved(true)}
            disabled={role === 'ENGINEER'}
          >
            <ShieldCheck className="w-4 h-4 mr-1.5" />
            {role === 'ENGINEER'
              ? 'Approval Locked (Reviewer Role Required)'
              : 'Approve Winner & Deploy'}
          </Button>
        )}
      </div>

      {/* Side-by-Side Candidate Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Candidate A */}
        <Card
          className={`border transition-all cursor-pointer ${
            selectedCandidate === 'A'
              ? 'border-purple-500 bg-purple-950/10 shadow-lg ring-1 ring-purple-500'
              : 'border-slate-800'
          }`}
          onClick={() => setSelectedCandidate('A')}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                {candidateA.alias}
              </CardTitle>
              <Badge variant="purple">Score: {candidateA.totalScore} / 100</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-2">{candidateA.rationale}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="success">Deterministic Tests: PASS</Badge>
              <Badge variant="success">Security Scan: CLEAN</Badge>
            </div>
            <DiffViewer diffText={candidateA.diff} />
          </CardContent>
        </Card>

        {/* Candidate B */}
        <Card
          className={`border transition-all cursor-pointer ${
            selectedCandidate === 'B'
              ? 'border-emerald-500 bg-emerald-950/10 shadow-lg ring-1 ring-emerald-500'
              : 'border-slate-800'
          }`}
          onClick={() => setSelectedCandidate('B')}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-400" />
                {candidateB.alias} (Recommended Winner)
              </CardTitle>
              <Badge variant="success">Score: {candidateB.totalScore} / 100</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-2">{candidateB.rationale}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="success">Deterministic Tests: PASS</Badge>
              <Badge variant="success">Security Scan: CLEAN</Badge>
              <Badge variant="info">Latency: Optimal (&lt;1ms)</Badge>
            </div>
            <DiffViewer diffText={candidateB.diff} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

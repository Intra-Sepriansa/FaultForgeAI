import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, DiffViewer } from '@faultforge/ui';
import { BookOpen } from 'lucide-react';

export const ReferenceLibrary: React.FC = () => {
  const referenceCases = [
    {
      code: 'COMMERCE_RACE_CONDITION',
      title: 'Inventory Overselling via Concurrency Race Condition',
      category: 'CONCURRENCY & TRANSACTIONS',
      rootCause:
        'Time-of-check to time-of-use (TOCTOU) gap in checkout handler caused by asynchronous I/O between read query and write query.',
      solutionRationale:
        'Enforced atomic conditional decrement in single SQL statement (`UPDATE products SET stock = stock - 1 WHERE id = ? AND stock >= 1`) with optimistic verification.',
      verifiedDiff: `--- a/labs/commerce-lab/src/server.ts
+++ b/labs/commerce-lab/src/server.ts
@@ -25,7 +25,7 @@
-  const currentStock = product.stock;
-  store.unsafeSetStock(productId, currentStock - 1);
+  const success = store.atomicDecrementStock(productId, 1);
  if (!success) return reply.status(409).send({ error: 'Out of stock' });`,
      rolloutPlan:
        'Canary deploy with 5% traffic split; verify inventory balance telemetry metric.',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-emerald-400" />
          Verified Reference Solution Library
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Auditable archive of peer-reviewed root cause analyses, verified reference
          implementations, and rollout plans.
        </p>
      </div>

      <div className="space-y-6">
        {referenceCases.map((rc) => (
          <Card key={rc.code} className="border-slate-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="purple">{rc.category}</Badge>
                  <CardTitle className="text-base font-bold text-slate-100">{rc.title}</CardTitle>
                </div>
                <Badge variant="success">VERIFIED REFERENCE</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-rose-400">Root Cause Analysis:</span>
                <p className="text-xs text-slate-300 leading-relaxed">{rc.rootCause}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-emerald-400">
                  Engineering Solution Rationale:
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">{rc.solutionRationale}</p>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-sky-400">
                  Verified Implementation Diff:
                </span>
                <DiffViewer diffText={rc.verifiedDiff} />
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Rollout & Rollback Strategy: {rc.rolloutPlan}</span>
                <span className="font-mono text-emerald-400">Status: PRODUCTION GRADE</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

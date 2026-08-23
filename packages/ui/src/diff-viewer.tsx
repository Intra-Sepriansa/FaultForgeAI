import React from 'react';
import { cn } from './utils.js';

export interface DiffViewerProps {
  diffText: string;
  className?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diffText, className }) => {
  const lines = diffText.split('\n');

  return (
    <div
      className={cn(
        'rounded-lg border border-slate-800 bg-slate-950 font-mono text-xs overflow-x-auto shadow-inner',
        className,
      )}
    >
      <div className="p-3">
        {lines.map((line, index) => {
          let lineStyle = 'text-slate-400';
          let bgStyle = 'hover:bg-slate-900/40';

          if (line.startsWith('+') && !line.startsWith('+++')) {
            lineStyle = 'text-emerald-400';
            bgStyle = 'bg-emerald-950/30 hover:bg-emerald-950/50';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            lineStyle = 'text-rose-400';
            bgStyle = 'bg-rose-950/30 hover:bg-rose-950/50';
          } else if (line.startsWith('@@')) {
            lineStyle = 'text-sky-400 font-semibold';
            bgStyle = 'bg-sky-950/20';
          }

          return (
            <div
              key={index}
              className={cn(
                'flex py-0.5 px-2 rounded font-mono leading-relaxed',
                lineStyle,
                bgStyle,
              )}
            >
              <span className="w-8 select-none text-slate-600 text-right pr-3">{index + 1}</span>
              <span className="whitespace-pre flex-1">{line || ' '}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

import { describe, it, expect } from 'vitest';
import { cn } from './utils.js';

describe('UI Component Library Unit Tests', () => {
  it('cn helper merges Tailwind classes cleanly without conflicts', () => {
    const result = cn('px-2 py-1', 'bg-red-500', 'px-4');
    expect(result).toContain('px-4');
    expect(result).not.toContain('px-2');
    expect(result).toContain('bg-red-500');
  });

  it('cn helper handles conditional class names', () => {
    const isActive = true;
    const isError = false;
    const result = cn('base', isActive && 'active', isError && 'error');
    expect(result).toBe('base active');
  });
});

import { describe, expect, it } from 'vitest';
import { formatError } from './errors.js';

describe('renderer error formatting', () => {
  it('removes Electron IPC wrappers without hiding actionable details', () => {
    expect(formatError(new Error("Error invoking remote method 'espn:import': Error: ESPN returned no teams."))).toBe(
      'ESPN returned no teams.'
    );
  });

  it('uses a safe fallback and limits unexpectedly large messages', () => {
    expect(formatError('not an error')).toBe('Something went wrong.');
    expect(formatError(new Error('x'.repeat(700)))).toHaveLength(500);
  });
});

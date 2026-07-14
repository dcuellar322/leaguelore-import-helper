import { describe, expect, it } from 'vitest';
import { currentEspnSeasonYear, currentSeasonYear, defaultLeagueLoreApiBaseUrl } from './environment.js';

describe('ESPN season defaults', () => {
  it('uses the prior season before June and the current year from June onward', () => {
    expect(currentEspnSeasonYear(new Date('2027-02-10T12:00:00Z'))).toBe(2026);
    expect(currentEspnSeasonYear(new Date('2027-07-10T12:00:00Z'))).toBe(2027);
  });

  it('selects packaged and development API defaults', () => {
    expect(defaultLeagueLoreApiBaseUrl(true)).toBe('https://www.leagueloreapp.com');
    expect(defaultLeagueLoreApiBaseUrl(false)).toBe('http://localhost:15173');
    expect(currentSeasonYear()).toBe(currentEspnSeasonYear());
  });
});

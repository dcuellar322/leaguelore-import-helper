import { describe, expect, it } from 'vitest';
import { createMockImportBundle, validateImportBundle } from '@leaguelore/import-contract';
import { createDeliveryBundle, DEFAULT_INCLUDED_CATEGORIES, parseEspnLeagueInput } from './import-review.js';

describe('renderer import review helpers', () => {
  it('extracts league context from ESPN URLs and numeric IDs', () => {
    expect(parseEspnLeagueInput('123456')).toEqual({ leagueId: '123456' });
    expect(parseEspnLeagueInput('https://fantasy.espn.com/football/league?leagueId=98765&seasonId=2025')).toEqual({ leagueId: '98765', season: 2025 });
    expect(parseEspnLeagueInput('https://example.com/?leagueId=1')).toBeNull();
    expect(parseEspnLeagueInput('not a url')).toBeNull();
    expect(parseEspnLeagueInput('https://fantasy.espn.com/football/league?leagueId=98765&seasonId=invalid')).toEqual({ leagueId: '98765' });
  });

  it('creates a valid reviewed bundle without excluded categories', () => {
    const source = createMockImportBundle();
    const reviewed = createDeliveryBundle(source, { ...DEFAULT_INCLUDED_CATEGORIES, rosterEntries: false, matchups: false });
    expect(reviewed.rosterEntries).toEqual([]);
    expect(reviewed.matchups).toEqual([]);
    expect(reviewed.teams).toEqual(source.teams);
    expect(reviewed.metadata.warnings).toContain('rosterEntries excluded by the user before upload.');
    expect(() => validateImportBundle(reviewed)).not.toThrow();
  });
});

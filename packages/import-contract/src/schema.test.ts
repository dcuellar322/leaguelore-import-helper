import { describe, expect, it } from 'vitest';
import { createMockImportBundle } from './fixtures';
import { safeValidateImportBundle, validateImportBundle } from './validate';

describe('LeagueLore import contract', () => {
  it('validates the bundled mock import fixture', () => {
    const bundle = validateImportBundle(createMockImportBundle());

    expect(bundle.metadata.source).toBe('mock');
    expect(bundle.league.name).toBe('LeagueLore Demo League');
    expect(bundle.teams).toHaveLength(2);
    expect(bundle.matchups[0]?.winnerTeamExternalId).toBe('1');
  });

  it('rejects teams that point at a different league', () => {
    const bundle = createMockImportBundle({
      teams: [
        {
          externalRef: { provider: 'mock', externalId: 'rogue-team' },
          leagueExternalId: 'some-other-league',
          displayName: 'Rogue Team',
          ownerDisplayNames: []
        }
      ]
    });

    const result = safeValidateImportBundle(bundle);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain('Team rogue-team belongs to a different leagueExternalId.');
    }
  });
});

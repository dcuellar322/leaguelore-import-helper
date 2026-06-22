import { IMPORT_CONTRACT_VERSION } from './version.js';
import type { LeagueLoreImportBundle } from './schema.js';

export function createMockImportBundle(overrides: Partial<LeagueLoreImportBundle> = {}): LeagueLoreImportBundle {
  const now = new Date().toISOString();
  const leagueExternalId = 'mock-league-2026';
  const bundle: LeagueLoreImportBundle = {
    metadata: {
      contractVersion: IMPORT_CONTRACT_VERSION,
      source: 'mock',
      generatedAt: now,
      helper: {
        name: 'LeagueLore Import Helper',
        version: '0.1.0',
        platform: 'mock'
      },
      warnings: ['Mock import bundle for local development.']
    },
    league: {
      externalRef: { provider: 'mock', externalId: leagueExternalId },
      name: 'LeagueLore Demo League',
      season: 2026,
      size: 2,
      visibility: 'private',
      settings: { scoring: 'PPR' }
    },
    teams: [
      {
        externalRef: { provider: 'mock', externalId: '1' },
        leagueExternalId,
        abbreviation: 'LL',
        location: 'League',
        nickname: 'Lorekeepers',
        displayName: 'League Lorekeepers',
        ownerDisplayNames: ['Demo Commissioner']
      },
      {
        externalRef: { provider: 'mock', externalId: '2' },
        leagueExternalId,
        abbreviation: 'TD',
        location: 'Touchdown',
        nickname: 'Archivists',
        displayName: 'Touchdown Archivists',
        ownerDisplayNames: ['Demo Rival']
      }
    ],
    rosterEntries: [
      {
        teamExternalId: '1',
        lineupSlot: 'QB',
        player: {
          externalRef: { provider: 'mock', externalId: '1001' },
          fullName: 'Demo Quarterback',
          positions: ['QB'],
          proTeam: 'FA'
        }
      }
    ],
    matchups: [
      {
        externalRef: { provider: 'mock', externalId: 'mock-week-1' },
        leagueExternalId,
        season: 2026,
        scoringPeriodId: 1,
        home: { teamExternalId: '1', score: 124.4, winner: true },
        away: { teamExternalId: '2', score: 118.2, winner: false },
        winnerTeamExternalId: '1'
      }
    ],
    draftPicks: [],
    transactions: []
  };

  return { ...bundle, ...overrides };
}

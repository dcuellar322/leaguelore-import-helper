import { describe, expect, it } from 'vitest';
import { transformEspnPayload } from './transform.js';

const context = {
  leagueId: '123456',
  season: 2026,
  importSessionId: 'session-1',
  helperVersion: '0.1.0-test',
  platform: 'test'
};

describe('ESPN payload transform', () => {
  it('normalizes league, team, roster, schedule, draft, and transaction data', () => {
    const bundle = transformEspnPayload({
      id: 123456,
      scoringPeriodId: 4,
      settings: {
        name: 'Circle League',
        size: 0,
        isPublic: false,
        scoringSettings: { scoringType: 'H2H_POINTS' },
        cookieToken: 'do-not-keep'
      },
      teams: [
        {
          id: 1,
          abbrev: 'LL',
          location: 'League',
          nickname: 'Lore',
          owners: ['Commissioner'],
          logo: 'https://cdn.example.com/logo.png',
          playoffSeed: 0,
          finalStanding: '1',
          roster: {
            entries: [
              {
                lineupSlotId: 0,
                acquisitionType: 'DRAFT',
                acquisitionDate: 1767225600000,
                playerPoolEntry: {
                  injuryStatus: 'ACTIVE',
                  player: {
                    id: 1001,
                    firstName: 'Demo',
                    lastName: 'Quarterback',
                    eligibleSlots: [0, 20],
                    proTeamId: 12,
                    jersey: 9
                  }
                }
              }
            ]
          }
        },
        {
          id: 2,
          location: 'Rival',
          nickname: 'Managers',
          owners: []
        }
      ],
      schedule: [
        {
          id: 77,
          matchupPeriodId: 1,
          home: { teamId: 1, totalPoints: 120.5, winner: 'WIN' },
          away: { teamId: 2, totalPoints: 111.2, winner: 'LOSS' },
          playoffTierType: 'NONE'
        }
      ],
      draftDetail: {
        picks: [
          {
            overallPickNumber: 0,
            pickNumber: '1',
            roundId: '1',
            roundPickNumber: '1',
            teamId: 1,
            bidAmount: 12,
            player: { id: 2002, fullName: 'Drafted Player' }
          }
        ]
      },
      transactions: [
        {
          id: 'tx-1',
          type: 'FREEAGENT ADD',
          proposedDate: 1767225600,
          status: 'EXECUTED',
          items: [{ type: 'FREEAGENT ADD', toTeamId: 1, player: { id: 3003, fullName: 'Free Agent' } }]
        }
      ]
    }, context);

    expect(bundle.league).toMatchObject({
      name: 'Circle League',
      season: 2026,
      size: 2,
      scoringPeriodId: 4,
      scoringType: 'H2H_POINTS',
      visibility: 'unknown'
    });
    expect(bundle.league.settings).not.toHaveProperty('cookieToken');
    expect(bundle.teams[0]).toMatchObject({
      externalRef: { provider: 'espn', externalId: '1', rawKind: 'team' },
      displayName: 'League Lore',
      finalStanding: 1
    });
    expect(bundle.teams[0]?.playoffSeed).toBeUndefined();
    expect(bundle.rosterEntries[0]?.player.fullName).toBe('Demo Quarterback');
    expect(bundle.matchups[0]?.winnerTeamExternalId).toBe('1');
    expect(bundle.draftPicks[0]).toMatchObject({ overallPick: 1, round: 1, roundPick: 1 });
    expect(bundle.transactions[0]?.items[0]?.type).toBe('add');
  });

  it('falls back to context and warnings when ESPN returns sparse data', () => {
    const bundle = transformEspnPayload({ settings: { name: '' }, teams: [], schedule: [] }, context);

    expect(bundle.league.externalRef.externalId).toBe(context.leagueId);
    expect(bundle.league.name).toBe(`ESPN League ${context.leagueId}`);
    expect(bundle.metadata.warnings).toEqual([
      'No ESPN teams were found in the response. Check league ID, season, and ESPN access.',
      'No roster entries were found. ESPN may have returned limited data or the season may be unavailable.'
    ]);
  });

  it('handles optional ESPN shapes and transaction classifications', () => {
    const bundle = transformEspnPayload({
      name: 'Fallback Name',
      settings: {
        size: '10',
        isPublic: true,
        harmless: 'kept',
        tokenSecret: 'removed',
        omitted: undefined
      },
      teams: [
        {
          teamId: '10',
          name: 'Named Team',
          logo: 'not-a-url',
          roster: {
            entries: [
              {
                player: { playerId: '9001', fullName: 'Direct Player', injuryStatus: 'QUESTIONABLE', status: 'ACTIVE' }
              },
              {
                playerPoolEntry: { player: {} }
              }
            ]
          }
        }
      ],
      schedule: [
        {
          matchupPeriodId: '2',
          home: { teamId: '10', totalProjectedPointsLive: '88.5', winner: false },
          away: { teamId: '11', winner: true }
        },
        {
          matchupPeriodId: 0,
          home: { teamId: '10' }
        }
      ],
      draftDetail: {
        picks: [
          { roundId: 0, roundPickNumber: -1 },
          { playerPoolEntry: { player: { playerId: '7001', fullName: 'Player Only Pick' } }, keeper: true }
        ]
      },
      transactions: [
        { transactionId: 1, processDate: '1767225600000', items: [{ type: 'DROP', fromTeamId: '10' }] },
        { transactionId: 2, date: 'invalid', items: [{ type: 'TRADE', toTeamId: '10' }] },
        { transactionId: 3, items: [{ type: 'DRAFT' }] },
        { transactionId: 4, items: [{ type: 'WAIVER' }] },
        { transactionId: 5, items: [{ type: 'FREE' }] },
        { transactionId: 6, items: [{ type: 'UNKNOWN' }] },
        { items: [{ type: 'ADD' }] }
      ]
    }, context);

    expect(bundle.league).toMatchObject({
      name: 'Fallback Name',
      size: 1,
      visibility: 'public',
      settings: { harmless: 'kept' }
    });
    expect(bundle.league.settings).not.toHaveProperty('tokenSecret');
    expect(bundle.teams[0]).toMatchObject({ externalRef: { externalId: '10' }, displayName: 'Named Team' });
    expect(bundle.teams[0]?.logoUrl).toBeUndefined();
    expect(bundle.rosterEntries).toHaveLength(1);
    expect(bundle.matchups).toHaveLength(1);
    expect(bundle.matchups[0]).toMatchObject({
      externalRef: { externalId: '2026-2-10-11' },
      winnerTeamExternalId: '11',
      home: { projectedScore: 88.5 }
    });
    expect(bundle.draftPicks).toHaveLength(1);
    expect(bundle.draftPicks[0]).toMatchObject({ keeper: true, player: { fullName: 'Player Only Pick' } });
    expect(bundle.transactions.map((transaction) => transaction.items[0]?.type)).toEqual(['drop', 'trade', 'draft', 'waiver', 'free_agent', 'unknown']);
    expect(bundle.transactions[1]?.occurredAt).toBeUndefined();
  });

  it('uses ESPN settings size when no team array is present', () => {
    const bundle = transformEspnPayload({ settings: { size: '10' } }, context);

    expect(bundle.league.size).toBe(10);
  });
});

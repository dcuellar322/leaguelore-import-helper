// Sanitized fixture retaining the nested shapes used by ESPN's league views.
// IDs, names, scores, and dates are synthetic and contain no account credentials.
export const sanitizedPrivateLeaguePayload = {
  id: 24681012,
  scoringPeriodId: 3,
  members: [
    { id: '{MEMBER-ONE}', displayName: 'Commissioner Example' },
    { id: '{MEMBER-TWO}', displayName: 'Manager Example' }
  ],
  settings: {
    name: 'Sanitized Fixture League',
    size: 2,
    isPublic: false,
    scoringSettings: { scoringType: 'H2H_POINTS' }
  },
  teams: [
    {
      id: 1,
      location: 'Fixture',
      nickname: 'Foxes',
      owners: ['{MEMBER-ONE}'],
      roster: { entries: [{ lineupSlotId: 0, playerPoolEntry: { player: { id: 101, fullName: 'Fixture Quarterback', defaultPositionId: 1 } } }] }
    },
    {
      id: 2,
      location: 'Sample',
      nickname: 'Owls',
      owners: ['{MEMBER-TWO}'],
      roster: { entries: [{ lineupSlotId: 2, playerPoolEntry: { player: { id: 202, fullName: 'Sample Running Back', defaultPositionId: 2 } } }] }
    }
  ],
  schedule: [{ id: 301, matchupPeriodId: 1, winner: 'AWAY', home: { teamId: 1, totalPoints: 101.2 }, away: { teamId: 2, totalPoints: 107.8 } }],
  draftDetail: { picks: [{ overallPickNumber: 1, roundId: 1, roundPickNumber: 1, teamId: 1, playerId: 101 }] },
  transactions: [{ id: '401', type: 'FREEAGENT', status: 'EXECUTED', processDate: 1760000000000, items: [{ type: 'FREEAGENT ADD', toTeamId: 2, playerId: 202 }] }]
};

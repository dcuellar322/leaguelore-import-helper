import {
  IMPORT_CONTRACT_VERSION,
  validateImportBundle,
  type LeagueLoreImportBundle,
  type LeagueLoreDraftPick,
  type LeagueLoreImportPlayer,
  type LeagueLoreImportTeam,
  type LeagueLoreMatchup,
  type LeagueLoreRosterEntry,
  type LeagueLoreTransaction
} from '@leaguelore/import-contract';

export type TransformContext = {
  leagueId: string;
  season: number;
  importSessionId?: string;
  helperVersion: string;
  platform: string;
};

export function transformEspnPayload(payload: unknown, context: TransformContext): LeagueLoreImportBundle {
  const data = asRecord(payload);
  const leagueExternalId = String(data.id ?? context.leagueId);
  const settings = asRecord(data.settings);
  const leagueName = asString(settings.name) ?? asString(data.name) ?? `ESPN League ${leagueExternalId}`;
  const teamsRaw = asArray(data.teams);
  const scheduleRaw = asArray(data.schedule);
  const draftDetail = asRecord(data.draftDetail);
  const transactionsRaw = asArray(data.transactions);

  const teams = teamsRaw.map((team) => mapTeam(team, leagueExternalId)).filter(Boolean) as LeagueLoreImportTeam[];
  const rosterEntries = teamsRaw.flatMap((team) => mapRosterEntries(team));
  const matchups = scheduleRaw.map((matchup) => mapMatchup(matchup, leagueExternalId, context.season)).filter(Boolean) as LeagueLoreMatchup[];
  const draftPicks = asArray(draftDetail.picks).map((pick) => mapDraftPick(pick, leagueExternalId, context.season)).filter(Boolean) as LeagueLoreDraftPick[];
  const transactions = transactionsRaw.map((transaction) => mapTransaction(transaction, leagueExternalId, context.season)).filter(Boolean) as LeagueLoreTransaction[];

  const warnings: string[] = [];
  if (!teams.length) warnings.push('No ESPN teams were found in the response. Check league ID, season, and ESPN access.');
  if (!rosterEntries.length) warnings.push('No roster entries were found. ESPN may have returned limited data or the season may be unavailable.');

  const bundle: LeagueLoreImportBundle = {
    metadata: {
      contractVersion: IMPORT_CONTRACT_VERSION,
      source: 'espn',
      generatedAt: new Date().toISOString(),
      importSessionId: context.importSessionId,
      helper: {
        name: 'LeagueLore Import Helper',
        version: context.helperVersion,
        platform: context.platform
      },
      warnings
    },
    league: {
      externalRef: {
        provider: 'espn',
        externalId: leagueExternalId,
        url: `https://fantasy.espn.com/football/league?leagueId=${encodeURIComponent(leagueExternalId)}&seasonId=${context.season}`
      },
      name: leagueName,
      season: context.season,
      size: teams.length || numberOrUndefined(settings.size),
      scoringPeriodId: numberOrUndefined(data.scoringPeriodId),
      scoringType: asString(settings.scoringSettings && asRecord(settings.scoringSettings).scoringType),
      visibility: asBoolean(settings.isPublic) ? 'public' : 'unknown',
      settings: scrubUnknown(settings)
    },
    teams,
    rosterEntries,
    matchups,
    draftPicks,
    transactions
  };

  return validateImportBundle(bundle);
}

function mapTeam(input: unknown, leagueExternalId: string): LeagueLoreImportTeam | null {
  const team = asRecord(input);
  const id = asString(team.id) ?? asString(team.teamId);
  if (!id) return null;

  const location = asString(team.location);
  const nickname = asString(team.nickname);
  const displayName = [location, nickname].filter(Boolean).join(' ').trim() || asString(team.name) || `Team ${id}`;
  const owners = asArray(team.owners).map((owner) => String(owner));

  return {
    externalRef: { provider: 'espn', externalId: id, rawKind: 'team' },
    leagueExternalId,
    abbreviation: asString(team.abbrev),
    location,
    nickname,
    displayName,
    ownerDisplayNames: owners,
    logoUrl: maybeUrl(asString(team.logo)),
    playoffSeed: numberOrUndefined(team.playoffSeed),
    finalStanding: numberOrUndefined(team.finalStanding)
  };
}

function mapRosterEntries(input: unknown): LeagueLoreRosterEntry[] {
  const team = asRecord(input);
  const teamId = asString(team.id) ?? asString(team.teamId);
  if (!teamId) return [];

  return asArray(asRecord(team.roster).entries).flatMap((entry) => {
    const record = asRecord(entry);
    const playerPoolEntry = asRecord(record.playerPoolEntry);
    const player = mapPlayer(playerPoolEntry.player ?? record.player);
    if (!player) return [];
    return [{
      teamExternalId: teamId,
      player,
      lineupSlot: asString(record.lineupSlotId),
      acquisitionType: asString(record.acquisitionType),
      acquisitionDate: dateFromMaybeEpoch(record.acquisitionDate),
      injuryStatus: asString(playerPoolEntry.injuryStatus)
    }];
  });
}

function mapPlayer(input: unknown): LeagueLoreImportPlayer | null {
  const player = asRecord(input);
  const id = asString(player.id) ?? asString(player.playerId);
  if (!id) return null;

  const fallbackName = [asString(player.firstName), asString(player.lastName)].filter(Boolean).join(' ').trim();
  const fullName = asString(player.fullName) ?? (fallbackName || `Player ${id}`);

  return {
    externalRef: { provider: 'espn', externalId: id, rawKind: 'player' },
    fullName,
    firstName: asString(player.firstName),
    lastName: asString(player.lastName),
    proTeam: asString(player.proTeamId),
    positions: asArray(player.eligibleSlots).map((slot) => String(slot)),
    jersey: asString(player.jersey),
    status: asString(player.injuryStatus) ?? asString(player.status)
  };
}

function mapMatchup(input: unknown, leagueExternalId: string, season: number): LeagueLoreMatchup | null {
  const matchup = asRecord(input);
  const id = asString(matchup.id) ?? `${season}-${asString(matchup.matchupPeriodId) ?? 'unknown'}-${asString(asRecord(matchup.home).teamId) ?? 'home'}-${asString(asRecord(matchup.away).teamId) ?? 'away'}`;
  const scoringPeriodId = numberOrUndefined(matchup.matchupPeriodId) ?? numberOrUndefined(matchup.scoringPeriodId);
  if (!scoringPeriodId) return null;

  const home = mapMatchupSide(matchup.home);
  const away = mapMatchupSide(matchup.away);
  const winnerTeamExternalId = home?.winner ? home.teamExternalId : away?.winner ? away.teamExternalId : undefined;

  return {
    externalRef: { provider: 'espn', externalId: id, rawKind: 'matchup' },
    leagueExternalId,
    season,
    scoringPeriodId,
    home,
    away,
    winnerTeamExternalId,
    playoffTierType: asString(matchup.playoffTierType)
  };
}

function mapMatchupSide(input: unknown) {
  const side = asRecord(input);
  const teamExternalId = asString(side.teamId);
  if (!teamExternalId) return undefined;
  return {
    teamExternalId,
    score: numberOrUndefined(side.totalPoints),
    projectedScore: numberOrUndefined(side.totalProjectedPointsLive),
    winner: asString(side.winner) === 'WIN' || side.winner === true
  };
}

function mapDraftPick(input: unknown, leagueExternalId: string, season: number): LeagueLoreDraftPick | null {
  const pick = asRecord(input);
  const overallPick = numberOrUndefined(pick.overallPickNumber) ?? numberOrUndefined(pick.pickNumber);
  const teamExternalId = asString(pick.teamId);
  const player = mapPlayer(pick.playerPoolEntry ? asRecord(pick.playerPoolEntry).player : pick.player);

  if (!overallPick && !player) return null;

  return {
    externalRef: overallPick ? { provider: 'espn', externalId: `${leagueExternalId}-${season}-draft-${overallPick}`, rawKind: 'draftPick' } : undefined,
    leagueExternalId,
    season,
    round: numberOrUndefined(pick.roundId),
    roundPick: numberOrUndefined(pick.roundPickNumber),
    overallPick,
    teamExternalId,
    ...(player ? { player } : {}),
    keeper: asBoolean(pick.keeper),
    auctionPrice: numberOrUndefined(pick.bidAmount)
  };
}

function mapTransaction(input: unknown, leagueExternalId: string, season: number): LeagueLoreTransaction | null {
  const tx = asRecord(input);
  const id = asString(tx.id) ?? asString(tx.transactionId);
  if (!id) return null;
  return {
    externalRef: { provider: 'espn', externalId: id, rawKind: 'transaction' },
    leagueExternalId,
    season,
    occurredAt: dateFromMaybeEpoch(tx.proposedDate ?? tx.processDate ?? tx.date),
    status: asString(tx.status),
    notes: asString(tx.type),
    items: asArray(tx.items).map((item) => {
      const record = asRecord(item);
      const player = mapPlayer(record.player);
      return {
        type: normalizeTransactionType(record.type),
        teamExternalId: asString(record.toTeamId) ?? asString(record.fromTeamId),
        ...(player ? { player } : {}),
        notes: asString(record.type)
      };
    })
  };
}

function normalizeTransactionType(input: unknown): 'add' | 'drop' | 'trade' | 'draft' | 'waiver' | 'free_agent' | 'unknown' {
  const value = String(input ?? '').toLowerCase();
  if (value.includes('add')) return 'add';
  if (value.includes('drop')) return 'drop';
  if (value.includes('trade')) return 'trade';
  if (value.includes('draft')) return 'draft';
  if (value.includes('waiver')) return 'waiver';
  if (value.includes('free')) return 'free_agent';
  return 'unknown';
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
}

function asArray(input: unknown): unknown[] {
  return Array.isArray(input) ? input : [];
}

function asString(input: unknown): string | undefined {
  if (typeof input === 'string' && input.trim()) return input;
  if (typeof input === 'number' && Number.isFinite(input)) return String(input);
  return undefined;
}

function asBoolean(input: unknown): boolean | undefined {
  if (typeof input === 'boolean') return input;
  return undefined;
}

function numberOrUndefined(input: unknown): number | undefined {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string' && input.trim() && Number.isFinite(Number(input))) return Number(input);
  return undefined;
}

function dateFromMaybeEpoch(input: unknown): string | undefined {
  const value = numberOrUndefined(input);
  if (!value) return undefined;
  const ms = value > 10_000_000_000 ? value : value * 1000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function maybeUrl(input: string | undefined): string | undefined {
  if (!input) return undefined;
  try {
    return new URL(input).toString();
  } catch {
    return undefined;
  }
}

function scrubUnknown(input: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key.toLowerCase().includes('cookie') || key.toLowerCase().includes('token')) continue;
    if (value === undefined || typeof value === 'function') continue;
    result[key] = value;
  }
  return result;
}

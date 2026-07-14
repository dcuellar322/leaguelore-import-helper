import type { LeagueLoreImportBundle } from '@leaguelore/import-contract';

export type OptionalImportCategory = 'rosterEntries' | 'matchups' | 'draftPicks' | 'transactions';
export type IncludedCategories = Record<OptionalImportCategory, boolean>;

export const DEFAULT_INCLUDED_CATEGORIES: IncludedCategories = {
  rosterEntries: true,
  matchups: true,
  draftPicks: true,
  transactions: true
};

export function parseEspnLeagueInput(input: string): { leagueId: string; season?: number } | null {
  try {
    const trimmed = input.trim();
    if (/^\d{1,12}$/.test(trimmed)) return { leagueId: trimmed };
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' || !(parsed.hostname === 'fantasy.espn.com' || parsed.hostname.endsWith('.fantasy.espn.com'))) return null;
    const leagueId = parsed.searchParams.get('leagueId') ?? '';
    if (!/^\d{1,12}$/.test(leagueId)) return null;
    const rawSeason = parsed.searchParams.get('seasonId') ?? parsed.searchParams.get('season');
    const season = rawSeason ? Number(rawSeason) : undefined;
    return { leagueId, ...(season && Number.isInteger(season) && season >= 2000 && season <= 2100 ? { season } : {}) };
  } catch {
    return null;
  }
}

export function createDeliveryBundle(bundle: LeagueLoreImportBundle, included: IncludedCategories): LeagueLoreImportBundle {
  const excluded = (Object.entries(included) as Array<[OptionalImportCategory, boolean]>).filter(([, value]) => !value).map(([key]) => key);
  return {
    ...bundle,
    metadata: {
      ...bundle.metadata,
      warnings: [...bundle.metadata.warnings, ...excluded.map((category) => `${category} excluded by the user before upload.`)]
    },
    rosterEntries: included.rosterEntries ? bundle.rosterEntries : [],
    matchups: included.matchups ? bundle.matchups : [],
    draftPicks: included.draftPicks ? bundle.draftPicks : [],
    transactions: included.transactions ? bundle.transactions : []
  };
}

const ESPN_LEAGUE_ID_PATTERN = /^\d{1,12}$/;

export type EspnLeagueInput = {
  leagueId: string;
  season?: number;
};

export function parseEspnLeagueInput(input: string): EspnLeagueInput | null {
  const trimmed = input.trim();
  if (ESPN_LEAGUE_ID_PATTERN.test(trimmed)) return { leagueId: trimmed };

  try {
    const parsed = new URL(trimmed);
    const isEspnFantasyHost = parsed.hostname === 'fantasy.espn.com' || parsed.hostname.endsWith('.fantasy.espn.com');
    if (parsed.protocol !== 'https:' || !isEspnFantasyHost) return null;

    const leagueId = parsed.searchParams.get('leagueId') ?? '';
    if (!ESPN_LEAGUE_ID_PATTERN.test(leagueId)) return null;

    const rawSeason = parsed.searchParams.get('seasonId') ?? parsed.searchParams.get('season');
    if (!rawSeason) return { leagueId };

    const season = Number(rawSeason);
    if (!Number.isInteger(season) || season < 2000 || season > 2100) return null;
    return { leagueId, season };
  } catch {
    return null;
  }
}

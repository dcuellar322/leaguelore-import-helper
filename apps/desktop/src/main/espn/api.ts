import { buildEspnCookieHeader } from './cookies.js';

export type EspnFetchParams = {
  leagueId: string;
  season: number;
};

const DEFAULT_VIEWS = [
  'mSettings',
  'mTeam',
  'mRoster',
  'mMatchup',
  'mMatchupScore',
  'mStatus',
  'mDraftDetail',
  'mTransactions2'
];

export async function fetchEspnLeaguePayload(params: EspnFetchParams): Promise<unknown> {
  const cookieHeader = await buildEspnCookieHeader();
  const url = new URL(
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${params.season}/segments/0/leagues/${encodeURIComponent(params.leagueId)}`
  );

  for (const view of DEFAULT_VIEWS) {
    url.searchParams.append('view', view);
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      cookie: cookieHeader,
      'user-agent': 'LeagueLore Import Helper/0.1.0'
    },
    signal: AbortSignal.timeout(30_000)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`ESPN request failed with ${response.status}. ${body.slice(0, 300)}`);
  }

  return response.json();
}

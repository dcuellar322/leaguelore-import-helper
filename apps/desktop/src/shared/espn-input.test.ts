import { describe, expect, it } from 'vitest';
import { parseEspnLeagueInput } from './espn-input.js';

describe('ESPN league input parsing', () => {
  it('accepts numeric league IDs and complete ESPN fantasy URLs', () => {
    expect(parseEspnLeagueInput(' 123456 ')).toEqual({ leagueId: '123456' });
    expect(parseEspnLeagueInput('https://fantasy.espn.com/football/league?leagueId=98765&seasonId=2025')).toEqual({
      leagueId: '98765',
      season: 2025
    });
    expect(parseEspnLeagueInput('https://games.fantasy.espn.com/football/league?leagueId=98765&season=2024')).toEqual({
      leagueId: '98765',
      season: 2024
    });
  });

  it('rejects untrusted hosts, invalid IDs, and invalid seasons', () => {
    expect(parseEspnLeagueInput('https://example.com/?leagueId=1')).toBeNull();
    expect(parseEspnLeagueInput('https://fantasy.espn.com.evil.example/?leagueId=1')).toBeNull();
    expect(parseEspnLeagueInput('https://fantasy.espn.com/football/league?leagueId=abc')).toBeNull();
    expect(parseEspnLeagueInput('https://fantasy.espn.com/football/league?leagueId=98765&seasonId=invalid')).toBeNull();
    expect(parseEspnLeagueInput('not a url')).toBeNull();
  });
});

export const LEAGUELORE_DEV_API_BASE_URL = 'http://localhost:15173';
export const LEAGUELORE_PRODUCTION_API_BASE_URL = 'https://www.leagueloreapp.com';

export function defaultLeagueLoreApiBaseUrl(isPackaged: boolean): string {
  return isPackaged ? LEAGUELORE_PRODUCTION_API_BASE_URL : LEAGUELORE_DEV_API_BASE_URL;
}

export function currentSeasonYear(): number {
  return new Date().getFullYear();
}

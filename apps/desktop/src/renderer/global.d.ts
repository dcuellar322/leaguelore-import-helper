import type { LeagueLoreBridge } from '../shared/ipc';

declare global {
  interface Window {
    leagueLore: LeagueLoreBridge;
  }
}

export {};

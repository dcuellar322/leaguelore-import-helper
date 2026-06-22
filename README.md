# LeagueLore Import Helper

LeagueLore Import Helper is an open source desktop app for importing ESPN fantasy football league data into LeagueLore without asking users to paste ESPN cookies into a web form.

The app opens ESPN in an isolated Electron session, lets the user sign in directly with ESPN, fetches fantasy league data locally, converts it into a validated LeagueLore import bundle, and uploads only the reviewed fantasy data to LeagueLore.

This project is not affiliated with, endorsed by, or sponsored by ESPN.

## Features

- Sign in to ESPN inside a dedicated helper app session.
- Keep ESPN passwords and raw session cookies local to the helper.
- Validate import data against a shared TypeScript/Zod contract.
- Export the generated JSON bundle before uploading.
- Upload a validated bundle to a LeagueLore preview endpoint.
- Clear the helper's ESPN session from inside the app.

## Privacy and Security

- The helper does not read Chrome, Safari, Firefox, or system browser cookie stores.
- The helper does not upload raw ESPN cookies to LeagueLore.
- ESPN cookies are used locally only to request fantasy data from ESPN.
- Import bundles can include league, team, roster, matchup, draft, and transaction data returned by ESPN.

See [docs/PRIVACY.md](docs/PRIVACY.md) and [docs/SECURITY.md](docs/SECURITY.md) for more detail.

## Requirements

- Node.js 22.13 or newer
- npm 10 or newer

## Development

Install dependencies:

```bash
npm install
```

Run the desktop app in development:

```bash
npm run dev
```

The helper points to `http://localhost:15173` in local development and `https://www.leagueloreapp.com` in packaged production builds. The API URL and import token are runtime session details, so they are not edited in the app UI.

Run type checks:

```bash
npm run typecheck
```

Run tests:

```bash
npm test
```

Run tests with the coverage gate:

```bash
npm run test:coverage
```

Build the app:

```bash
npm run build
```

Create a local packaged app directory:

```bash
npm run package
```

Build distributable installers:

```bash
npm run make
```

macOS and Windows release builds should be signed before public distribution.

## Launching From LeagueLore

LeagueLore can prefill an import session by opening the app with the registered custom protocol:

```text
leaguelore-import://session?apiBase=https%3A%2F%2Fwww.leagueloreapp.com&token=<import-token>&leagueId=<espn-league-id>&season=2025
```

Supported query parameters:

- `token`: short-lived LeagueLore import token
- `leagueId`: numeric ESPN league ID
- `season`: optional ESPN season start year, for example `2025`
- `apiBase`: optional LeagueLore API base URL

LeagueLore should include `season` whenever the import flow has a season start year. If `season` is omitted, the helper uses the current ESPN season for the local ESPN request.

## Repository Layout

```text
apps/desktop/             Electron, Vite, and React desktop app
packages/import-contract/ Shared TypeScript/Zod import contract
docs/                     Privacy, security, and release notes
scripts/                  Maintenance scripts
```

## Import Contract

The shared `@leaguelore/import-contract` package defines the normalized import bundle schema. ESPN response shapes can change, so ESPN-specific parsing should stay inside `apps/desktop/src/main/espn/transform.ts` while the shared contract remains stable or is intentionally versioned.

## Security Reports

Please do not open public issues for vulnerabilities. Report security concerns privately to the project maintainer.

## License

MIT. See [LICENSE](LICENSE).

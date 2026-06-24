# Security Model

The LeagueLore Import Helper is intentionally designed to avoid the most concerning version of this workflow: reading the user's existing browser cookies.

## What the helper does

- Opens ESPN in an isolated Electron session controlled by this app.
- Lets the user sign in directly with ESPN.
- Reads only the cookies created inside the helper's own ESPN session.
- Uses those cookies locally to request ESPN fantasy data.
- Converts ESPN responses to the shared LeagueLore import contract.
- Uploads only the normalized import bundle to LeagueLore.

## What the helper does not do

- It does not read Chrome, Safari, Firefox, Edge, Keychain, Credential Manager, or system browser storage.
- It does not upload raw ESPN cookies to LeagueLore.
- It does not log cookie values.
- It does not persist short-lived LeagueLore import tokens to the settings file.
- It does not persist ESPN session cookies after the user clicks **Clear ESPN Session**.
- It does not bypass ESPN authentication.

## Electron hardening

The app follows the main Electron security recommendations:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`
- deny permission requests by default
- restricted external navigation
- runtime validation on IPC inputs
- restricted LeagueLore API upload destinations
- restrictive Content Security Policy for the renderer
- Electron fuses configured for packaged builds

## Logging policy

Do not log:

- ESPN cookie values
- LeagueLore import tokens
- full request headers
- raw ESPN response payloads unless behind an explicit developer-only flag

## Data uploaded to LeagueLore

The app uploads a `LeagueLoreImportBundle` JSON document. It includes league, team, roster, matchup, draft, and transaction data. It should never include ESPN session cookies or passwords.

## Recommended release posture

Before sending to non-technical beta users, treat these items as release blockers:

1. Publish the helper source publicly.
2. Sign and notarize macOS builds.
3. Sign Windows builds.
4. Publish SHA-256 checksums with each GitHub release.
5. Keep an easy-to-read privacy page linked from LeagueLore's import screen.

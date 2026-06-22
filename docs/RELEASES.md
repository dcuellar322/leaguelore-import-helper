# Release Guide

## Local package

```bash
npm install
npm run typecheck
npm run make
```

Artifacts will be generated under `apps/desktop/dist/`.

## macOS signing and notarization

Set these secrets in GitHub Actions or your local environment:

```bash
APPLE_ID=
APPLE_ID_PASSWORD=
APPLE_TEAM_ID=
CSC_LINK=
CSC_KEY_PASSWORD=
```

`CSC_LINK` should point to a base64-encoded certificate or secure file URL supported by your release tooling.

## Windows signing

Set these secrets:

```bash
WINDOWS_CERTIFICATE_FILE=
WINDOWS_CERTIFICATE_PASSWORD=
```

Unsigned builds are acceptable for local development, but public releases should be signed because Windows SmartScreen and macOS Gatekeeper warnings can appear.

## Checksums

After building:

```bash
find apps/desktop/dist -maxdepth 5 -type f -print0 | xargs -0 shasum -a 256 > SHA256SUMS.txt
```

Attach `SHA256SUMS.txt` to GitHub Releases.

## Suggested release naming

```text
LeagueLore Import Helper v0.1.0

Assets:
- LeagueLoreImportHelper-darwin-arm64.dmg
- LeagueLoreImportHelper-darwin-x64.dmg
- LeagueLoreImportHelper-win32-x64.exe
- LeagueLoreImportHelper-linux-x64.AppImage or .deb
- SHA256SUMS.txt
```

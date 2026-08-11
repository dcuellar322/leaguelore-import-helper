# Release Guide

## Local package

```bash
npm install
npm run test:coverage
npm run typecheck
npm run make
```

Artifacts will be generated under `apps/desktop/dist/`.

Before non-technical beta users receive builds, macOS artifacts must be signed and notarized, and
each GitHub release must include SHA-256 checksums. Windows artifacts are temporarily released
unsigned. Their filenames must end in `-UNSIGNED.exe`, the release must carry a prominent
SmartScreen warning, and `WINDOWS-UNSIGNED-NOTICE.txt` must be published beside the installer.

## macOS signing and notarization

Set these GitHub Actions secrets:

```bash
MACOS_CSC_LINK=
MACOS_CSC_KEY_PASSWORD=
APPLE_API_KEY_BASE64=
APPLE_API_KEY_ID=
APPLE_API_ISSUER=
```

`MACOS_CSC_LINK` should contain a base64-encoded Developer ID Application certificate or secure file URL supported by Electron Builder. The release job maps it to `CSC_LINK`. `APPLE_API_KEY_BASE64` is the base64-encoded contents of the App Store Connect `.p8` private key; the workflow materializes it as a permission-restricted temporary file for notarization.

## Windows unsigned release policy

The current Windows installer is intentionally unsigned. No Windows signing secrets are required.
The release workflow disables certificate auto-discovery, verifies that both the packaged app and
installer report `NotSigned`, and publishes the installer with an `-UNSIGNED.exe` suffix.

Windows Defender SmartScreen will show an unknown-publisher warning. Some managed computers may
block the installer entirely. Only distribute the installer through the official GitHub release,
publish its SHA-256 checksum, and keep [WINDOWS-UNSIGNED-NOTICE.txt](WINDOWS-UNSIGNED-NOTICE.txt)
attached to the release.

Users can calculate the installer digest in PowerShell and compare it with the matching line in
`SHA256SUMS.txt`:

```powershell
Get-FileHash .\LeagueLoreImportHelper-0.1.0-win-x64-UNSIGNED.exe -Algorithm SHA256
```

The intended future upgrade is an OV Authenticode certificate. At that point, restore
`WINDOWS_CSC_LINK` and `WINDOWS_CSC_KEY_PASSWORD`, remove the unsigned-only environment and checks,
drop the `-UNSIGNED` artifact suffix and release warning, and require `Get-AuthenticodeSignature`
to report `Valid` for both the packaged application and installer.

## Checksums

After building:

```bash
cd apps/desktop/dist
find . -maxdepth 1 -type f ! -name SHA256SUMS.txt -print0 | sort -z | xargs -0 shasum -a 256 > SHA256SUMS.txt
```

The release workflow combines all native artifacts, generates `SHA256SUMS.txt`, and creates the GitHub Release. It also checks that the tag, root package, desktop package, contract package, and source contract versions match.

## Suggested release naming

```text
LeagueLore Import Helper v0.1.0

Assets:
- LeagueLoreImportHelper-0.1.0-mac-arm64.dmg
- LeagueLoreImportHelper-0.1.0-mac-x64.dmg
- LeagueLoreImportHelper-0.1.0-win-x64-UNSIGNED.exe
- WINDOWS-UNSIGNED-NOTICE.txt
- LeagueLoreImportHelper-0.1.0-linux-x64.AppImage, .deb, or .zip
- SHA256SUMS.txt
```

## Release verification

Before announcing a release:

1. Install each native artifact on a clean supported OS.
2. Launch with a `leaguelore-import://start` link containing the canonical portal
   API base and confirm league, season, session ID, and token handoff.
3. Complete a sanitized end-to-end preview against the production API.
4. Verify macOS notarization with `xcrun stapler validate`. Confirm the current Windows app and
   installer return `NotSigned` from `Get-AuthenticodeSignature` and retain their explicit unsigned
   labeling; once OV signing is adopted, require `Valid` instead.
5. Confirm the packaged fuse report disables Node injection/inspection and enforces encrypted cookies and ASAR integrity.

The manually dispatched **Production upload smoke test** workflow requires approval through the `production-smoke` GitHub environment plus a newly issued one-time `LEAGUELORE_SMOKE_TOKEN` and `LEAGUELORE_SMOKE_SESSION_ID`. It uploads a sanitized minimal ESPN-shaped bundle, prints only the HTTP status, and rejects continuation URLs outside LeagueLore. Run it before promoting a public release; the preview it creates can then be deleted through the normal LeagueLore flow.

The production API and continuation origin is `https://portal.leagueloreapp.com`. A release is
blocked if a packaged deep link, upload, or continuation targets the marketing hostname, apex
hostname, localhost, or an unrelated origin.

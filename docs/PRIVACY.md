# Privacy Statement

Effective July 14, 2026

LeagueLore Import Helper is a local desktop tool that helps you import ESPN fantasy football league data into LeagueLore.

## What you sign into

You sign in directly with ESPN inside the helper. Your ESPN password is entered into ESPN's website, not LeagueLore.

## What stays local

Your ESPN session cookies stay on your computer inside the helper's isolated ESPN session. LeagueLore does not receive raw ESPN cookies from the helper.

The ESPN session is not shared with your normal browser profile. Packaged builds enable Electron's operating-system-backed cookie encryption, and closing the helper ends its non-persistent ESPN session.

Short-lived LeagueLore import tokens are used for upload authorization and are not saved to the helper settings file.
Packaged builds send reviewed bundles only to `https://portal.leagueloreapp.com`.

## What can be sent to LeagueLore

Only the fantasy-football import bundle you review is sent to LeagueLore. That bundle can include league name, season, team names, owner display IDs/names as ESPN returns them, rosters, matchups, draft picks, and transaction history.

League and team records are required. Before uploading, you can exclude rosters, matchups, draft picks, or transactions. The exact reviewed JSON remains available for inspection and local export.

After upload, LeagueLore stores and processes the reviewed bundle under the LeagueLore service's privacy and deletion policies. The helper itself does not retain a copy unless you choose **Save JSON locally**.

## Clearing data

Use **Clear ESPN Session** inside the helper to remove ESPN cookies and local ESPN session storage from the helper.

## Diagnostics and updates

The helper keeps a rotating local diagnostic log containing event names, result codes, and aggregate counts. It excludes cookies, tokens, headers, passwords, secrets, and raw payloads. The log is not uploaded automatically; you choose whether to save and share it with support.

The packaged helper may contact GitHub's public releases API to check whether a newer signed version is available. It does not send ESPN or LeagueLore account data during that check.

## Questions and security reports

Use the private reporting route in [SECURITY.md](SECURITY.md). Never send ESPN cookies, LeagueLore import tokens, or raw account payloads in a support or security report.

# Icons

`icon.svg` is included as the source icon. Before a signed production release, generate the platform-specific files expected by Electron Builder:

- `icon.icns` for macOS
- `icon.ico` for Windows
- `icon.png` for Linux

Suggested tools:

```bash
npx electron-icon-maker --input=assets/icon.svg --output=assets/generated
```

Then update the `build` block in `apps/desktop/package.json` if needed.

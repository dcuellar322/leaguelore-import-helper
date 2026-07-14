# Icons

`icon.svg` is the editable source icon and `league-lore-mark.png` is the 1024px packaging source. Electron Builder is configured to derive the platform-specific application icons from the PNG during each native build:

- `icon.icns` for macOS
- `icon.ico` for Windows
- `icon.png` for Linux

The release workflow builds each platform natively and fails if an installer is not produced.

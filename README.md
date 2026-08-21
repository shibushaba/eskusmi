# eskusmi

**Interrupt, without interrupting.**

A tiny local attention network for people working around you. Devices on the same LAN discover each other and can send a calm visual ping — even when someone is deep in focus with headphones on.

Runs on **Windows**, **macOS**, and **Linux**.

## What’s in this repo

| Path | Purpose |
| --- | --- |
| `/` | Desktop app (Tauri 2 + React) |
| `/website` | Marketing landing page (Vite + React) |
| `/branding` | Source artwork / app icon |

## Versioning

Keep these in sync when you cut a release:

- `package.json` → `version`
- `src-tauri/Cargo.toml` → `version`
- `src-tauri/tauri.conf.json` → `version`
- `website/package.json` → `version`
- `website/src/lib/version.ts` → `APP_VERSION`

Current version: **0.1.0**

## Desktop app

### Prerequisites

- Node.js 18+
- Rust (stable)

**Windows:** WebView2 + MSVC Build Tools  

**macOS:** Xcode Command Line Tools  

**Linux (Debian/Ubuntu):**

```bash
sudo apt update
sudo apt install -y \
  build-essential curl wget file libxdo-dev libssl-dev \
  libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf
```

### Develop

```bash
npm install
npm run tauri dev
```

### Build (no installer)

```bash
npm run build
npx tauri build --no-bundle
```

Binary lands under `src-tauri/target/release/` (`eskusmi.exe` on Windows, `eskusmi` elsewhere).

### Platform installers

```bash
npm run build:windows   # NSIS → *.exe
npm run build:macos     # .app + .dmg
npm run build:linux     # .deb + AppImage
```

### First launch & autostart

1. App launches after install (or via `tauri dev`)  
2. Name setup (if no profile yet)  
3. On **first successful launch**, eskusmi enables **Launch at login** once  
4. Later launches: start quietly as the floating icon (Available), tray stays alive  
5. Toggle **Launch at login** in the panel anytime  

Profile store (via Tauri plugin-store), roughly:

- Windows: `%APPDATA%\com.eskusmi.desktop\`  
- macOS: `~/Library/Application Support/com.eskusmi.desktop/`  
- Linux: `~/.local/share/com.eskusmi.desktop/`

### Tray

- Status → Available / Focus / Away / Busy  
- Open eskusmi  
- Quit eskusmi  

Close/hide keeps the process in the tray. **Quit eskusmi** exits.

### Network

- UDP discovery: `38555`  
- TCP: ephemeral (advertised in presence)  
- Trusts the local network (no crypto) — private LAN only  

## Landing page (`/website`)

```bash
npm run website:dev
npm run website:build
```

The CTA picks a download for the visitor’s OS from GitHub Releases:

| OS | Asset |
| --- | --- |
| Windows | `eskusmi-setup.exe` |
| macOS | `eskusmi.dmg` |
| Linux | `eskusmi.AppImage` |

Override with `VITE_DOWNLOAD_URL` if needed (`website/.env.example`).

## Releases (GitHub Actions)

```bash
git tag v0.1.2
git push origin v0.1.2
```

Workflow: `.github/workflows/release.yml`

Builds and uploads Windows, macOS, and Linux artifacts to the GitHub Release for that tag.

### Windows Smart App Control / SmartScreen

The NSIS installer is currently **unsigned**. Windows Smart App Control (and SmartScreen) will block downloads from the internet until the binary is Authenticode-signed with a trusted code-signing certificate (OV/EV or Azure Trusted Signing).

To ship signed Windows builds:

1. Buy a code-signing cert (or set up [Azure Trusted Signing](https://learn.microsoft.com/en-us/azure/trusted-signing/))
2. Export a `.pfx` and add GitHub secrets:
   - `WINDOWS_CERTIFICATE` — base64 of the `.pfx` (`certutil -encode cert.pfx out.txt`)
   - `WINDOWS_CERTIFICATE_PASSWORD` — export password
3. Set in `src-tauri/tauri.conf.json` → `bundle.windows`:

```json
"certificateThumbprint": "YOUR_THUMBPRINT",
"digestAlgorithm": "sha256",
"timestampUrl": "http://timestamp.digicert.com"
```

4. Tag a new release so CI rebuilds with signing enabled

Until then, local `npm run build:windows` installs work fine (no browser Mark-of-the-Web).

## Two-computer LAN test

1. Install/run on Computer A and B with different names  
2. Same Wi-Fi / LAN  
3. Each should list the other under **Nearby**  
4. Ping → attention → **Got it** → acknowledgement  
5. Reboot both — eskusmi should launch at login and rediscover  

## Trust note

**eskusmi trusts the local network.** Do not use it on untrusted networks.

## Stack

- Tauri 2 + Rust (`tray-icon`, autostart, store)  
- React + TypeScript + Vite + Tailwind v4 + Motion  
- Bundles: NSIS (Windows), DMG (macOS), deb + AppImage (Linux)  

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
3. On **first successful launch**, eskusmi enables **start at login** on Windows, macOS, and Linux
4. Later launches: start quietly as the floating icon (Available), tray stays alive
5. Toggle **Start at login** in the panel anytime (Windows registry · macOS Login Items · Linux autostart)

Profile store (via Tauri plugin-store), roughly:

- Windows: `%APPDATA%\com.eskusmi.desktop\`  
- macOS: `~/Library/Application Support/com.eskusmi.desktop/`  
- Linux: `~/.local/share/com.eskusmi.desktop/`

### Tray

- Status → Available / Focus / Away / Busy  
- Open eskusmi  
- Quit eskusmi  

Close/hide keeps the process in the tray. **Quit eskusmi** exits.

### Upgrading (replace an older install)

Re-running the latest installer **removes the previous version first**, then installs the new build:

- **Windows:** NSIS quits eskusmi and runs a silent uninstall before copying files. The copy-install script does the same before launching setup.
- **macOS:** copy-install quits eskusmi, deletes `/Applications/eskusmi.app`, then copies the new app from the DMG.
- **Linux:** copy-install quits eskusmi, replaces `~/Applications/eskusmi.AppImage`, then launches the new file.

Your profile and settings are kept (stored outside the install folder).

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

### Windows SmartScreen / code signing

**Preferred free path:** [SignPath Foundation](https://signpath.org/) (open-source Authenticode).

1. Apply with repo `https://github.com/shibushaba/eskusmi`
2. After approval, set `SIGNPATH_API_TOKEN` (secret) + `SIGNPATH_ORGANIZATION_ID` (variable)
3. Tag a release — CI signs `eskusmi-setup.exe`

Full steps + policy text: [`docs/WINDOWS_SIGNING.md`](docs/WINDOWS_SIGNING.md).

**Until signing is live:** More info → **Run anyway**.

#### Code signing policy

Free code signing provided by SignPath.io, certificate by SignPath Foundation.

- Committers/reviewers: [repository collaborators](https://github.com/shibushaba/eskusmi/settings/access)
- Approvers: [repository owners](https://github.com/shibushaba/eskusmi/settings/access)

## Two-computer LAN test

1. Install/run on Computer A and B with different names  
2. Same Wi-Fi / LAN  
3. Each should list the other under **Nearby**  
4. Ping → attention → **Got it** → acknowledgement  
5. Reboot both — eskusmi should launch at login and rediscover  

## Stack

- Tauri 2 + Rust (`tray-icon`, autostart, store)  
- React + TypeScript + Vite + Tailwind v4 + Motion  
- Bundles: NSIS (Windows), DMG (macOS), deb + AppImage (Linux)  

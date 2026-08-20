# eskusmi

**Interrupt, without interrupting.**

A tiny local attention network for people working around you. Devices on the same LAN discover each other and can send a calm visual ping — even when someone is deep in focus with headphones on.

## What’s in this repo

| Path | Purpose |
| --- | --- |
| `/` | Windows desktop app (Tauri 2 + React) |
| `/website` | Marketing landing page (Vite + React) |
| `/branding` | Source artwork / app icon |
| `/dist-app` | Optional local copy of a built `.exe` |

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
- Windows: WebView2 + MSVC Build Tools

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

Binary: `src-tauri/target/release/eskusmi.exe`

### Build Windows installer (NSIS)

```bash
npm run build
npx tauri build --bundles nsis
```

Installer: `src-tauri/target/release/bundle/nsis/*-setup.exe`

### First launch & autostart

1. Installer finishes → app launches  
2. Name setup (if no profile yet)  
3. On **first successful launch**, eskusmi enables **Start with Windows** once and stores that the preference was configured  
4. Later launches: start quietly as the orb (Available), tray stays alive  
5. User can turn **Start with Windows** off/on in the panel — that choice is respected

Profile store: `%APPDATA%\com.eskusmi.desktop\eskusmi-profile.json`

### Tray

- Status → Available / Focus / Away / Busy  
- Open eskusmi  
- Quit eskusmi  

Close/hide keeps the process in the tray. **Quit eskusmi** exits.

### Network

- UDP discovery: `38555`  
- TCP: ephemeral (advertised in presence)  
- Trusts the local network (no crypto) — Private LAN only  

## Landing page (`/website`)

```bash
cd website
npm install
npm run dev      # local preview
npm run build    # static dist/ for Vercel or any static host
npm run preview
```

From repo root:

```bash
npm run website:dev
npm run website:build
```

### Download URL

The CTA downloads the Windows installer from:

`VITE_DOWNLOAD_URL`

Default (this repository):

`https://github.com/shibushaba/eskusmi/releases/latest/download/eskusmi-setup.exe`

Override with `website/.env` (see `website/.env.example`). On Vercel, set the same env var in the project settings. Root directory for Vercel: `website`.

> Until the first GitHub Release exists, that URL will 404. Publish a `v*` tag to create it.

## Releases (GitHub Actions)

Tag-based only (not every commit):

```bash
git tag v0.1.0
git push origin v0.1.0
```

Workflow: `.github/workflows/release-windows.yml`

1. Builds the NSIS installer on `windows-latest`  
2. Creates a GitHub Release for the tag  
3. Uploads `eskusmi-setup.exe` (stable name for the landing page)

## Install / uninstall (Windows)

1. Download `eskusmi-setup.exe`  
2. Run the installer  
3. eskusmi appears as the floating orb + tray icon  
4. Uninstall via Windows **Apps → Installed apps** (or the Start Menu shortcut folder)

User profile data under `%APPDATA%\com.eskusmi.desktop\` may remain after uninstall.

## Two-computer LAN test

1. Install/run on Computer A and B with different names  
2. Same Wi-Fi / LAN  
3. Each should list the other under **People nearby**  
4. Ping → attention → **Got it** → acknowledgement  
5. Reboot both — eskusmi should start with Windows and rediscover

## Architecture (desktop)

```
React UI  <── commands/events ──>  Tauri/Rust network layer
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                   UDP discovery              TCP messaging
                   (presence)                 (ping / ack)
```

Networking protocol is unchanged from the verified LAN MVP.

## Trust note

**eskusmi trusts the local network.** Do not use it on untrusted networks.

## Stack

- Tauri 2 + Rust (`tray-icon`, autostart, store)  
- React + TypeScript + Vite + Tailwind v4 + Motion  
- NSIS installer for Windows distribution  

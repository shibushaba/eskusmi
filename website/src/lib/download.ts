/** GitHub Releases artifacts from the multi-OS release workflow. */
export const ESKUSMI_PREFERRED_TAG = "v0.1.8";
/** @deprecated use ESKUSMI_PREFERRED_TAG — kept for older imports */
export const ESKUSMI_RELEASE_TAG = ESKUSMI_PREFERRED_TAG;

const RELEASES_API =
  "https://api.github.com/repos/shibushaba/eskusmi/releases?per_page=30";

export type DownloadPlatform =
  | "windows"
  | "macos"
  | "linux"
  | "ios"
  | "android"
  | "unknown";

type NavUAData = {
  platform?: string;
  mobile?: boolean;
  getHighEntropyValues?: (
    hints: string[],
  ) => Promise<{ platform?: string; architecture?: string }>;
};

type GhAsset = { name?: string; browser_download_url?: string };
type GhRelease = { tag_name?: string; draft?: boolean; assets?: GhAsset[] };

const ASSET_BY_PLATFORM: Record<
  "windows" | "macos" | "linux" | "unknown",
  string
> = {
  windows: "eskusmi-setup.exe",
  macos: "eskusmi.dmg",
  linux: "eskusmi.AppImage",
  unknown: "eskusmi-setup.exe",
};

function readUaData(): NavUAData | undefined {
  return (navigator as Navigator & { userAgentData?: NavUAData }).userAgentData;
}

/**
 * Detect the visitor's device so the CTA can fetch the matching installer.
 * Prefers User-Agent Client Hints when available.
 */
export function detectDownloadPlatform(): DownloadPlatform {
  const ua = navigator.userAgent;
  const uaData = readUaData();
  const platformHint = (uaData?.platform ?? "").toLowerCase();
  const platformLegacy = (navigator.platform ?? "").toLowerCase();

  if (
    /iphone|ipad|ipod/i.test(ua) ||
    (platformLegacy === "macintel" && navigator.maxTouchPoints > 1)
  ) {
    return "ios";
  }
  if (/android/i.test(ua)) {
    return "android";
  }

  if (platformHint.includes("win") || /Windows/i.test(ua)) {
    return "windows";
  }
  if (
    platformHint.includes("mac") ||
    /Mac OS X|Macintosh/i.test(ua) ||
    platformLegacy.startsWith("mac")
  ) {
    return "macos";
  }
  if (
    platformHint.includes("linux") ||
    (/Linux|X11/i.test(ua) && !/Android/i.test(ua))
  ) {
    return "linux";
  }

  return "unknown";
}

function envUrl(name: string): string | undefined {
  const value = import.meta.env[name];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function fallbackUrl(
  platform: "windows" | "macos" | "linux" | "unknown",
): string {
  const asset = ASSET_BY_PLATFORM[platform];
  return `https://github.com/shibushaba/eskusmi/releases/latest/download/${asset}`;
}

/**
 * Resolve installer URL from published releases.
 * Prefers ESKUSMI_PREFERRED_TAG, else newest published asset (avoids mid-build 404s).
 */
export async function resolveDownloadUrl(
  platform: DownloadPlatform = detectDownloadPlatform(),
): Promise<{ url: string; tag: string } | null> {
  if (platform === "ios" || platform === "android") {
    return null;
  }

  const envOverride =
    platform === "windows"
      ? envUrl("VITE_DOWNLOAD_URL_WINDOWS")
      : platform === "macos"
        ? envUrl("VITE_DOWNLOAD_URL_MACOS")
        : platform === "linux"
          ? envUrl("VITE_DOWNLOAD_URL_LINUX")
          : envUrl("VITE_DOWNLOAD_URL") ?? envUrl("VITE_DOWNLOAD_URL_WINDOWS");
  if (envOverride) {
    return { url: envOverride, tag: ESKUSMI_PREFERRED_TAG };
  }

  try {
    const res = await fetch(`${RELEASES_API}&t=${Date.now()}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`release fetch ${res.status}`);
    }
    const releases = ((await res.json()) as GhRelease[]).filter((r) => !r.draft);
    const assetName = ASSET_BY_PLATFORM[platform];

    const preferred = releases.find((r) => r.tag_name === ESKUSMI_PREFERRED_TAG);
    const preferredHit = preferred?.assets?.find((a) => a.name === assetName);
    if (preferredHit?.browser_download_url && preferred?.tag_name) {
      return {
        url: preferredHit.browser_download_url,
        tag: preferred.tag_name,
      };
    }

    for (const release of releases) {
      const hit = release.assets?.find((a) => a.name === assetName);
      if (hit?.browser_download_url && release.tag_name) {
        return { url: hit.browser_download_url, tag: release.tag_name };
      }
    }
  } catch {
    // fall through to latest shortcut
  }

  return { url: fallbackUrl(platform), tag: "latest" };
}

/**
 * Sync helper for places that still need an immediate URL.
 * Prefer `resolveDownloadUrl` in UI so mid-build tags don't 404.
 */
export function getDownloadUrl(
  platform: DownloadPlatform = detectDownloadPlatform(),
): string | null {
  if (platform === "ios" || platform === "android") {
    return null;
  }

  if (platform === "windows") {
    return envUrl("VITE_DOWNLOAD_URL_WINDOWS") ?? fallbackUrl("windows");
  }
  if (platform === "macos") {
    return envUrl("VITE_DOWNLOAD_URL_MACOS") ?? fallbackUrl("macos");
  }
  if (platform === "linux") {
    return envUrl("VITE_DOWNLOAD_URL_LINUX") ?? fallbackUrl("linux");
  }

  return (
    envUrl("VITE_DOWNLOAD_URL") ??
    envUrl("VITE_DOWNLOAD_URL_WINDOWS") ??
    fallbackUrl("unknown")
  );
}

export function isDesktopPlatform(
  platform: DownloadPlatform,
): platform is "windows" | "macos" | "linux" | "unknown" {
  return (
    platform === "windows" ||
    platform === "macos" ||
    platform === "linux" ||
    platform === "unknown"
  );
}

export function downloadLabel(platform: DownloadPlatform): string {
  switch (platform) {
    case "macos":
      return "Download for macOS";
    case "linux":
      return "Download for Linux";
    case "windows":
      return "Download for Windows";
    case "ios":
    case "android":
      return "Desktop app only";
    default:
      return "Download eskusmi";
  }
}

export function platformCaption(
  platform: DownloadPlatform,
  tag: string = ESKUSMI_PREFERRED_TAG,
): string {
  switch (platform) {
    case "macos":
      return `${tag} · macOS build`;
    case "linux":
      return `${tag} · Linux build`;
    case "windows":
      return `${tag} · Windows installer`;
    case "ios":
    case "android":
      return "eskusmi is a desktop app — open this page on your computer";
    default:
      return `${tag} · Windows · macOS · Linux`;
  }
}

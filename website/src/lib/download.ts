/** GitHub Releases artifacts from the multi-OS release workflow. */
export const ESKUSMI_RELEASE_TAG = "v0.1.3";

const RELEASE_BASE = `https://github.com/shibushaba/eskusmi/releases/download/${ESKUSMI_RELEASE_TAG}`;

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

const DEFAULT_BY_PLATFORM: Record<
  "windows" | "macos" | "linux" | "unknown",
  string
> = {
  windows: `${RELEASE_BASE}/eskusmi-setup.exe`,
  macos: `${RELEASE_BASE}/eskusmi.dmg`,
  linux: `${RELEASE_BASE}/eskusmi.AppImage`,
  unknown: `${RELEASE_BASE}/eskusmi-setup.exe`,
};

function envUrl(name: string): string | undefined {
  const value = import.meta.env[name];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolve the installer URL for a platform.
 * Order: platform-specific env → auto default for that OS.
 * `VITE_DOWNLOAD_URL` only applies when detecting fails (`unknown`),
 * so a Windows-only env var cannot force every visitor onto .exe.
 */
export function getDownloadUrl(
  platform: DownloadPlatform = detectDownloadPlatform(),
): string | null {
  if (platform === "ios" || platform === "android") {
    return null;
  }

  if (platform === "windows") {
    return (
      envUrl("VITE_DOWNLOAD_URL_WINDOWS") ?? DEFAULT_BY_PLATFORM.windows
    );
  }
  if (platform === "macos") {
    return envUrl("VITE_DOWNLOAD_URL_MACOS") ?? DEFAULT_BY_PLATFORM.macos;
  }
  if (platform === "linux") {
    return envUrl("VITE_DOWNLOAD_URL_LINUX") ?? DEFAULT_BY_PLATFORM.linux;
  }

  return (
    envUrl("VITE_DOWNLOAD_URL") ??
    envUrl("VITE_DOWNLOAD_URL_WINDOWS") ??
    DEFAULT_BY_PLATFORM.unknown
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

export function platformCaption(platform: DownloadPlatform): string {
  switch (platform) {
    case "macos":
      return `${ESKUSMI_RELEASE_TAG} · macOS build`;
    case "linux":
      return `${ESKUSMI_RELEASE_TAG} · Linux build`;
    case "windows":
      return `${ESKUSMI_RELEASE_TAG} · Windows installer`;
    case "ios":
    case "android":
      return "eskusmi is a desktop app — open this page on your computer";
    default:
      return `${ESKUSMI_RELEASE_TAG} · Windows · macOS · Linux`;
  }
}

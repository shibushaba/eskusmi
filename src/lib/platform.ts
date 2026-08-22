/** Detect the host OS for UI chrome that differs per platform. */
export type HostPlatform = "windows" | "macos" | "linux" | "unknown";

export function detectHostPlatform(): HostPlatform {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) {
    return "windows";
  }
  if (/Mac OS X|Macintosh/i.test(ua)) {
    return "macos";
  }
  if (/Linux|X11/i.test(ua) && !/Android/i.test(ua)) {
    return "linux";
  }
  return "unknown";
}

/** Apply `data-platform` on <html> so CSS can adapt corners / fill. */
export function applyHostPlatformClass(): HostPlatform {
  const platform = detectHostPlatform();
  document.documentElement.dataset.platform = platform;
  return platform;
}

/** Panel copy for the launch-at-login toggle (Windows / macOS / Linux). */
export function autostartCopy(platform: HostPlatform): {
  label: string;
  hint: string;
} {
  switch (platform) {
    case "windows":
      return {
        label: "Start at login",
        hint: "Starts with Windows when you sign in",
      };
    case "macos":
      return {
        label: "Open at login",
        hint: "Adds eskusmi to Login Items",
      };
    case "linux":
      return {
        label: "Start at login",
        hint: "Adds a desktop autostart entry",
      };
    default:
      return {
        label: "Launch at login",
        hint: "Starts automatically when you sign in",
      };
  }
}

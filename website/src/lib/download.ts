/** Public GitHub Releases artifact for this repository (renamed by CI). */
const DEFAULT_DOWNLOAD_URL =
  "https://github.com/shibushaba/eskusmi/releases/latest/download/eskusmi-setup.exe";

export function getDownloadUrl(): string | null {
  const configured = import.meta.env.VITE_DOWNLOAD_URL;
  if (typeof configured === "string") {
    const trimmed = configured.trim();
    if (trimmed.length === 0) {
      // Explicit empty override — treat as not configured (dev guard).
      if (import.meta.env.DEV) {
        return null;
      }
      return DEFAULT_DOWNLOAD_URL;
    }
    return trimmed;
  }

  return DEFAULT_DOWNLOAD_URL;
}

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  detectDownloadPlatform,
  downloadLabel,
  isDesktopPlatform,
  platformCaption,
  resolveDownloadUrl,
} from "../lib/download";

export function DownloadButton() {
  const reduceMotion = useReducedMotion();
  const platform = useMemo(() => detectDownloadPlatform(), []);
  const [url, setUrl] = useState<string | null>(null);
  const [tag, setTag] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<"idle" | "downloading" | "missing">(
    "idle",
  );

  useEffect(() => {
    let cancelled = false;
    void resolveDownloadUrl(platform).then((resolved) => {
      if (cancelled) return;
      setUrl(resolved?.url ?? null);
      setTag(resolved?.tag);
    });
    return () => {
      cancelled = true;
    };
  }, [platform]);

  const canDownload = isDesktopPlatform(platform) && Boolean(url);

  function handleClick() {
    if (!canDownload || !url) {
      setStatus("missing");
      return;
    }

    setStatus("downloading");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.rel = "noopener";
    // Let the browser navigate to the asset (works cross-origin for GitHub Releases).
    anchor.target = "_blank";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      setStatus("idle");
    }, 1600);
  }

  const label =
    status === "downloading"
      ? "Downloading…"
      : status === "missing" && !canDownload
        ? downloadLabel(platform)
        : status === "missing"
          ? "Download unavailable"
          : downloadLabel(platform);

  return (
    <div className="flex flex-col items-center">
      <motion.button
        type="button"
        className="esk-download"
        disabled={status === "downloading" || !canDownload}
        aria-label={downloadLabel(platform)}
        whileHover={
          reduceMotion || status === "downloading" || !canDownload
            ? undefined
            : { y: -1 }
        }
        whileTap={
          reduceMotion || status === "downloading" || !canDownload
            ? undefined
            : { scale: 0.97 }
        }
        transition={{ type: "spring", stiffness: 520, damping: 32, mass: 0.35 }}
        onClick={handleClick}
      >
        {label}
      </motion.button>
      <p className="mt-3 max-w-xs text-[0.68rem] leading-relaxed tracking-wide text-[color:var(--color-esk-text-muted)]">
        {platformCaption(platform, tag)}
      </p>
    </div>
  );
}

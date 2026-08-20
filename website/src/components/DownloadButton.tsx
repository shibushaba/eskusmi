import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { getDownloadUrl } from "../lib/download";

export function DownloadButton() {
  const reduceMotion = useReducedMotion();
  const url = getDownloadUrl();
  const [status, setStatus] = useState<"idle" | "downloading" | "missing">(
    "idle",
  );

  function handleClick() {
    if (!url) {
      setStatus("missing");
      return;
    }

    setStatus("downloading");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.rel = "noopener";
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      setStatus("idle");
    }, 1600);
  }

  const label =
    status === "downloading"
      ? "Downloading eskusmi…"
      : status === "missing"
        ? "Download URL not configured"
        : "Download eskusmi";

  return (
    <motion.button
      type="button"
      className="esk-download"
      disabled={status === "downloading"}
      aria-label="Download eskusmi for Windows"
      whileHover={reduceMotion || status === "downloading" ? undefined : { y: -1 }}
      whileTap={reduceMotion || status === "downloading" ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 520, damping: 32, mass: 0.35 }}
      onClick={handleClick}
    >
      {label}
    </motion.button>
  );
}

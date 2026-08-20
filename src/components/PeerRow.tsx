import { motion, useReducedMotion } from "motion/react";
import { cn } from "../lib/cn";
import { EASE, MOTION } from "../lib/motion";
import { statusLabel } from "../lib/status";
import type { Peer } from "../types/peer";
import type { PeerPingState } from "../hooks/usePing";
import { FocusGlyph, StatusDot } from "./common/PanelChrome";

type PeerRowProps = {
  peer: Peer;
  pingState: PeerPingState | null;
  onPing: (peerId: string) => void;
};

export function PeerRow({ peer, pingState, onPing }: PeerRowProps) {
  const reduceMotion = useReducedMotion();
  const secondary = pingState?.message ?? statusLabel(peer.status);

  return (
    <motion.button
      type="button"
      aria-label={`Ping ${peer.name}`}
      onClick={() => onPing(peer.id)}
      whileHover={reduceMotion ? undefined : { x: 2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      transition={{ duration: MOTION.micro, ease: EASE.out }}
      className={cn(
        "esk-focus-ring group flex w-full items-center gap-3 rounded-[var(--esk-radius-md)] px-2.5 py-2.5 text-left",
        "transition-colors duration-[var(--esk-dur-fast)]",
        "hover:bg-[color:var(--color-esk-surface-hover)]",
        "active:bg-[color:var(--color-esk-surface-active)]",
      )}
    >
      <span
        aria-hidden="true"
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-esk-border)] bg-white/[0.04] text-[0.78rem] font-light leading-none text-[color:var(--color-esk-text)]"
      >
        {peer.name.trim().slice(0, 1).toLowerCase() || "·"}
        <span className="absolute -right-px -bottom-px rounded-full bg-[color:var(--color-esk-surface)] p-[2px]">
          <StatusDot status={peer.status} />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8rem] font-medium tracking-wide text-[color:var(--color-esk-text)]">
          {peer.name}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[0.62rem] tracking-wide text-[color:var(--color-esk-text-muted)]">
          {secondary}
          {!pingState && peer.status === "focus" ? (
            <FocusGlyph className="text-[color:var(--color-esk-text-muted)]" />
          ) : null}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="translate-x-[-2px] text-[0.72rem] text-[color:var(--color-esk-text-muted)] opacity-0 transition-all duration-[var(--esk-dur-fast)] group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
      >
        →
      </span>
    </motion.button>
  );
}

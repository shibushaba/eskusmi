import { motion, useReducedMotion } from "motion/react";
import { cn } from "../lib/cn";
import { EASE, MOTION, SPRING } from "../lib/motion";
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
  const pinging = Boolean(pingState);

  return (
    <motion.button
      type="button"
      aria-label={`Ping ${peer.name}`}
      onClick={() => onPing(peer.id)}
      layout={!reduceMotion}
      whileHover={reduceMotion ? undefined : { x: 2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      animate={
        pinging && !reduceMotion
          ? { backgroundColor: "rgba(255,255,255,0.06)" }
          : { backgroundColor: "rgba(255,255,255,0)" }
      }
      transition={{ duration: MOTION.fast, ease: EASE.out }}
      className={cn(
        "esk-focus-ring group relative flex w-full items-center gap-3 overflow-hidden rounded-[var(--esk-radius-md)] px-2.5 py-2.5 text-left",
        "transition-colors duration-[var(--esk-dur-fast)]",
        "hover:bg-[color:var(--color-esk-surface-hover)]",
        "active:bg-[color:var(--color-esk-surface-active)]",
        pinging && "esk-peer-pinging",
      )}
    >
      {pinging && !reduceMotion ? (
        <motion.span
          aria-hidden="true"
          className="esk-peer-ping-wave pointer-events-none absolute inset-y-0 left-0 w-full"
          initial={{ x: "-40%", opacity: 0 }}
          animate={{ x: "120%", opacity: [0, 0.55, 0] }}
          transition={{ duration: 0.85, ease: EASE.out }}
        />
      ) : null}

      <motion.span
        aria-hidden="true"
        animate={
          pinging && !reduceMotion
            ? { scale: [1, 1.08, 1] }
            : { scale: 1 }
        }
        transition={
          pinging && !reduceMotion
            ? { ...SPRING.snappy, times: [0, 0.35, 1] }
            : { duration: MOTION.fast }
        }
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-esk-border)] bg-white/[0.04] text-[0.78rem] font-light leading-none text-[color:var(--color-esk-text)]"
      >
        {peer.name.trim().slice(0, 1).toLowerCase() || "·"}
        <span className="absolute -right-px -bottom-px rounded-full bg-[color:var(--color-esk-surface)] p-[2px]">
          <StatusDot status={peer.status} />
        </span>
      </motion.span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8rem] font-medium tracking-wide text-[color:var(--color-esk-text)]">
          {peer.name}
        </span>
        <motion.span
          key={secondary}
          initial={reduceMotion || !pinging ? false : { opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.fast, ease: EASE.out }}
          className="mt-0.5 flex items-center gap-1.5 text-[0.62rem] tracking-wide text-[color:var(--color-esk-text-muted)]"
        >
          {secondary}
          {!pingState && peer.status === "focus" ? (
            <FocusGlyph className="text-[color:var(--color-esk-text-muted)]" />
          ) : null}
        </motion.span>
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

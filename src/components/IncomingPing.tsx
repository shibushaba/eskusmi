import { motion, useReducedMotion } from "motion/react";
import { cn } from "../lib/cn";
import { EASE, MOTION } from "../lib/motion";
import type { IncomingPing } from "../types/ping";
import { PanelHeader } from "./common/PanelChrome";

type IncomingPingOverlayProps = {
  ping: IncomingPing;
  queued: IncomingPing[];
  onAcknowledge: (pingId: string) => void;
};

export function IncomingPingOverlay({
  ping,
  queued,
  onAcknowledge,
}: IncomingPingOverlayProps) {
  const reduceMotion = useReducedMotion();
  const queuedCount = queued.length;
  const others = queued.slice(1);
  const enter = reduceMotion
    ? { duration: 0 }
    : { duration: MOTION.smooth, ease: EASE.enter };

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={enter}
      className={cn(
        "esk-panel esk-attention-surface flex h-full w-full flex-col overflow-hidden",
      )}
    >
      <PanelHeader />

      <div className="flex flex-1 flex-col px-6 pb-5 pt-5">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: MOTION.standard, delay: 0.06, ease: EASE.enter }
            }
            className="text-[1.1rem] font-medium tracking-wide text-[color:var(--color-esk-text)]"
          >
            {ping.senderName}
          </motion.p>
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: MOTION.standard, delay: 0.1, ease: EASE.enter }
            }
            className="mt-2 text-[0.78rem] tracking-wide text-[color:var(--color-esk-text-secondary)]"
          >
            wants your attention
          </motion.p>

          {queuedCount > 1 ? (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: MOTION.fast, delay: 0.14 }
              }
              className="mt-4 w-full"
            >
              <p className="text-[0.64rem] tracking-wide text-[color:var(--color-esk-text-muted)]">
                {queuedCount} people want your attention
              </p>
              <ul className="mt-2 space-y-1">
                {others.map((item) => (
                  <li
                    key={item.id}
                    className="text-[0.68rem] tracking-wide text-[color:var(--color-esk-text-muted)]"
                  >
                    {item.senderName}
                  </li>
                ))}
              </ul>
            </motion.div>
          ) : null}
        </div>

        <motion.button
          type="button"
          aria-label="Got it"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: MOTION.standard, delay: 0.14, ease: EASE.enter }
          }
          whileHover={reduceMotion ? undefined : { scale: 1.015 }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          onClick={() => onAcknowledge(ping.id)}
          className={cn(
            "esk-focus-ring mx-auto h-10 min-w-[9rem] rounded-[var(--esk-radius-md)]",
            "border border-[color:var(--color-esk-border-strong)] bg-white/[0.05]",
            "px-5 text-[0.78rem] font-medium tracking-[0.08em] text-[color:var(--color-esk-text)]",
            "transition-colors duration-[var(--esk-dur-fast)] hover:bg-white/[0.08]",
          )}
        >
          Got it
        </motion.button>
      </div>
    </motion.section>
  );
}

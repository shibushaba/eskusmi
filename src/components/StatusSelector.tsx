import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../lib/cn";
import { EASE, MOTION } from "../lib/motion";
import { statusHint, statusLabel } from "../lib/status";
import type { PresenceStatus } from "../types/user";
import { PRESENCE_STATUSES } from "../types/user";
import { FocusGlyph, StatusDot } from "./common/PanelChrome";

type StatusSelectorProps = {
  status: PresenceStatus;
  onChange: (status: PresenceStatus) => void;
};

export function StatusSelector({ status, onChange }: StatusSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change status"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "esk-focus-ring flex h-9 w-full items-center justify-between rounded-[var(--esk-radius-md)] px-3",
          "border border-[color:var(--color-esk-border)] bg-black/20",
          "text-left transition-colors duration-[var(--esk-dur-fast)]",
          "hover:border-[color:var(--color-esk-border-strong)] hover:bg-[color:var(--color-esk-surface-hover)]",
        )}
      >
        <span className="flex items-center gap-2">
          <StatusDot status={status} />
          <span className="text-[0.72rem] tracking-wide text-[color:var(--color-esk-text)]">
            {statusLabel(status)}
          </span>
          {status === "focus" ? (
            <FocusGlyph className="text-[color:var(--color-esk-text-muted)]" />
          ) : null}
        </span>
        <span className="text-[0.7rem] text-[color:var(--color-esk-text-muted)]">
          {open ? "˄" : "˅"}
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="listbox"
            aria-label="Presence status"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: MOTION.fast, ease: EASE.out }}
            className={cn(
              "absolute inset-x-0 bottom-[calc(100%+8px)] z-20 overflow-hidden",
              "rounded-[var(--esk-radius-md)] border border-[color:var(--color-esk-border)]",
              "bg-[color:var(--color-esk-surface-elevated)]",
            )}
          >
            {PRESENCE_STATUSES.map((option) => {
              const selected = option === status;
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={cn(
                    "esk-focus-ring flex w-full items-start gap-2.5 px-3 py-2.5 text-left",
                    "transition-colors duration-[var(--esk-dur-micro)]",
                    selected
                      ? "bg-[color:var(--color-esk-surface-active)]"
                      : "hover:bg-[color:var(--color-esk-surface-hover)]",
                  )}
                >
                  <StatusDot status={option} className="mt-1" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[0.74rem] font-medium tracking-wide text-[color:var(--color-esk-text)]">
                      {statusLabel(option)}
                      {option === "focus" ? (
                        <FocusGlyph className="text-[color:var(--color-esk-text-muted)]" />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[0.62rem] leading-snug text-[color:var(--color-esk-text-muted)]">
                      {statusHint(option)}
                    </span>
                  </span>
                  {selected ? (
                    <span
                      aria-hidden="true"
                      className="mt-0.5 text-[0.65rem] text-[color:var(--color-esk-text-secondary)]"
                    >
                      ●
                    </span>
                  ) : null}
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export { FocusGlyph, StatusDot } from "./common/PanelChrome";

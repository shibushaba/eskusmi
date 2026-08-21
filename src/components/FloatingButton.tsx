import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import appIcon from "../assets/app-icon.png";
import { cn } from "../lib/cn";
import { FAB_SLOT, startWindowDrag, syncWindowToMode } from "../lib/window";
import type { PresenceStatus } from "../types/user";

const DRAG_THRESHOLD_PX = 4;
/** Ignore the click that often fires right after a native window drag. */
const CLICK_SUPPRESS_MS = 450;

type FloatingButtonProps = {
  status: PresenceStatus;
  attentionHint?: boolean;
  label?: string;
  onActivate: () => void;
};

export function FloatingButton({
  status,
  attentionHint = false,
  label = "Open eskusmi",
  onActivate,
}: FloatingButtonProps) {
  const reduceMotion = useReducedMotion();
  const dragState = useRef({
    tracking: false,
    dragged: false,
    startX: 0,
    startY: 0,
  });
  const suppressClickUntil = useRef(0);

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    dragState.current = {
      tracking: true,
      dragged: false,
      startX: event.screenX,
      startY: event.screenY,
    };

    const onMove = (moveEvent: PointerEvent) => {
      if (!dragState.current.tracking || dragState.current.dragged) {
        return;
      }

      const dx = Math.abs(moveEvent.screenX - dragState.current.startX);
      const dy = Math.abs(moveEvent.screenY - dragState.current.startY);

      if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
        dragState.current.dragged = true;
        suppressClickUntil.current = Date.now() + CLICK_SUPPRESS_MS;
        void startWindowDrag();
      }
    };

    const onUp = () => {
      const wasDrag = dragState.current.dragged;
      dragState.current.tracking = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);

      if (wasDrag) {
        suppressClickUntil.current = Date.now() + CLICK_SUPPRESS_MS;
        // Windows can snap/resize transparent HWNDs mid-drag — pin back to orb size.
        void syncWindowToMode("collapsed");
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function handleClick() {
    if (dragState.current.dragged || Date.now() < suppressClickUntil.current) {
      return;
    }
    onActivate();
  }

  return (
    <motion.button
      type="button"
      aria-label={label}
      data-status={status}
      data-attention={attentionHint || undefined}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      initial={false}
      animate={{ opacity: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.15 }}
      style={{ width: FAB_SLOT.width, height: FAB_SLOT.height }}
      className={cn(
        "eskusmi-orb eskusmi-orb--brand",
        `eskusmi-orb--${status}`,
        attentionHint && "eskusmi-orb--attention",
        "shrink-0 p-0 outline-none",
      )}
    >
      <img
        src={appIcon}
        alt=""
        width={FAB_SLOT.width}
        height={FAB_SLOT.height}
        draggable={false}
        decoding="async"
        className="eskusmi-orb__icon"
      />
    </motion.button>
  );
}

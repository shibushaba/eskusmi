import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "../lib/cn";
import { startWindowDrag } from "../lib/window";
import type { PresenceStatus } from "../types/user";

const DRAG_THRESHOLD_PX = 5;

type FloatingButtonProps = {
  status: PresenceStatus;
  attentionHint?: boolean;
  onExpand: () => void;
};

export function FloatingButton({
  status,
  attentionHint = false,
  onExpand,
}: FloatingButtonProps) {
  const reduceMotion = useReducedMotion();
  const dragState = useRef({
    tracking: false,
    dragged: false,
    startX: 0,
    startY: 0,
  });

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
        void startWindowDrag();
      }
    };

    const onUp = () => {
      dragState.current.tracking = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleClick() {
    if (dragState.current.dragged) {
      return;
    }
    onExpand();
  }

  return (
    <motion.button
      type="button"
      aria-label="Open eskusmi"
      data-status={status}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      whileHover={reduceMotion ? undefined : { scale: 1.04 }}
      whileTap={reduceMotion ? undefined : { scale: 0.95 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 520, damping: 28, mass: 0.35 }
      }
      className={cn(
        "eskusmi-orb",
        `eskusmi-orb--${status}`,
        attentionHint && "eskusmi-orb--attention",
        "relative flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full",
        "text-[color:var(--color-esk-text)] outline-none",
      )}
    >
      <span className="eskusmi-orb__mark text-[1.2rem] font-light leading-none tracking-tight">
        e
      </span>
      <span
        aria-hidden="true"
        className="eskusmi-orb__pulse absolute inset-[-2px] rounded-full"
      />
    </motion.button>
  );
}

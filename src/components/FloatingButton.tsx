import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import appIcon from "../assets/app-icon.png";
import { cn } from "../lib/cn";
import { startWindowDrag } from "../lib/window";
import type { PresenceStatus } from "../types/user";

const DRAG_THRESHOLD_PX = 5;

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
    onActivate();
  }

  return (
    <button
      type="button"
      aria-label={label}
      data-status={status}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      className={cn(
        "eskusmi-orb eskusmi-orb--brand",
        `eskusmi-orb--${status}`,
        attentionHint && "eskusmi-orb--attention",
        "relative h-full w-full max-h-full max-w-full shrink-0",
        "outline-none",
      )}
    >
      <img
        src={appIcon}
        alt=""
        draggable={false}
        className="eskusmi-orb__icon"
      />
    </button>
  );
}

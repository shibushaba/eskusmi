import { cn } from "../lib/cn";
import { statusHint, statusLabel } from "../lib/status";
import type { PresenceStatus } from "../types/user";
import { PRESENCE_STATUSES } from "../types/user";
import { FocusGlyph, StatusDot } from "./common/PanelChrome";

const CHIP_LABEL: Record<PresenceStatus, string> = {
  available: "Avail",
  focus: "Focus",
  away: "Away",
  busy: "Busy",
};

type StatusSelectorProps = {
  status: PresenceStatus;
  onChange: (status: PresenceStatus) => void;
};

export function StatusSelector({ status, onChange }: StatusSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Presence status"
      className="esk-status-seg"
    >
      {PRESENCE_STATUSES.map((option) => {
        const selected = option === status;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${statusLabel(option)}. ${statusHint(option)}`}
            title={statusHint(option)}
            onClick={() => onChange(option)}
            className={cn(
              "esk-focus-ring esk-status-chip",
              selected && "esk-status-chip--on",
            )}
          >
            <span className="flex h-3.5 items-center justify-center gap-0.5">
              <StatusDot status={option} />
              {option === "focus" ? (
                <FocusGlyph className="text-[color:var(--color-esk-text-muted)]" />
              ) : null}
            </span>
            <span className="esk-status-chip__label">{CHIP_LABEL[option]}</span>
          </button>
        );
      })}
    </div>
  );
}

export { FocusGlyph, StatusDot } from "./common/PanelChrome";

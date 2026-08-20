import type { PresenceStatus } from "../types/user";
import { PRESENCE_STATUSES, STATUS_HINT, STATUS_LABEL } from "../types/user";

export function isPresenceStatus(value: string): value is PresenceStatus {
  return (PRESENCE_STATUSES as readonly string[]).includes(value);
}

export function statusLabel(status: PresenceStatus): string {
  return STATUS_LABEL[status];
}

export function statusHint(status: PresenceStatus): string {
  return STATUS_HINT[status];
}

export function statusDotClass(status: PresenceStatus): string {
  switch (status) {
    case "available":
      return "esk-status-dot esk-status-dot--available";
    case "focus":
      return "esk-status-dot esk-status-dot--focus";
    case "away":
      return "esk-status-dot esk-status-dot--away";
    case "busy":
      return "esk-status-dot esk-status-dot--busy";
  }
}

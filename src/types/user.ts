export type PresenceStatus = "available" | "focus" | "away" | "busy";

export interface UserProfile {
  id: string;
  name: string;
  status: PresenceStatus;
}

export const PRESENCE_STATUSES: PresenceStatus[] = [
  "available",
  "focus",
  "away",
  "busy",
];

export const STATUS_LABEL: Record<PresenceStatus, string> = {
  available: "Available",
  focus: "Focus",
  away: "Away",
  busy: "Busy",
};

export const STATUS_HINT: Record<PresenceStatus, string> = {
  available: "Ready for interruptions.",
  focus: "Deep work — still reachable.",
  away: "Temporarily away.",
  busy: "Occupied. Ping only if needed.",
};

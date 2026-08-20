import type { PresenceStatus } from "./user";
import { isPresenceStatus } from "../lib/status";

export interface Peer {
  id: string;
  name: string;
  status: PresenceStatus;
  ip: string;
  port: number;
  lastSeen: number;
}

export { isPresenceStatus };

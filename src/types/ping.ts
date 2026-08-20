export interface IncomingPing {
  id: string;
  senderId: string;
  senderName: string;
  timestamp: number;
}

export type PingResultStatus = "sent" | "waiting" | "acknowledged" | "failed";

export interface PingResult {
  peerId: string;
  pingId: string;
  status: PingResultStatus;
  message: string;
}

export const PING_EXPIRE_MS = 60_000;

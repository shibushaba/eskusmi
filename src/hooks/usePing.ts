import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";
import { acknowledgePing, listIncomingPings, pingPeer } from "../lib/network";
import type { IncomingPing, PingResult } from "../types/ping";

export type PeerPingState = {
  peerId: string;
  status: PingResult["status"] | "sent";
  message: string;
};

export function usePing() {
  const [incoming, setIncoming] = useState<IncomingPing[]>([]);
  const [pingFeedback, setPingFeedback] = useState<string | null>(null);
  const [peerPingState, setPeerPingState] = useState<PeerPingState | null>(
    null,
  );

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let active = true;
    const unlisteners: Array<() => void> = [];

    const boot = async () => {
      try {
        const existing = await listIncomingPings();
        if (active) {
          setIncoming(existing);
        }
      } catch (error) {
        console.error("[eskusmi] failed to load incoming pings", error);
      }

      unlisteners.push(
        await listen<IncomingPing[]>("incoming-pings", (event) => {
          setIncoming(event.payload);
        }),
      );
      unlisteners.push(
        await listen<IncomingPing>("incoming-ping", (event) => {
          setIncoming((current) => {
            if (current.some((item) => item.id === event.payload.id)) {
              return current;
            }
            return [...current, event.payload];
          });
        }),
      );
      unlisteners.push(
        await listen<PingResult>("ping-result", (event) => {
          const message =
            event.payload.status === "acknowledged"
              ? "Acknowledged"
              : event.payload.status === "waiting"
                ? "Waiting..."
                : event.payload.message;
          setPingFeedback(message);
          setPeerPingState({
            peerId: event.payload.peerId,
            status: event.payload.status,
            message,
          });
        }),
      );
    };

    void boot();

    return () => {
      active = false;
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, []);

  useEffect(() => {
    if (!pingFeedback) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPingFeedback(null);
      setPeerPingState(null);
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [pingFeedback]);

  const sendPing = useCallback(async (peerId: string) => {
    setPingFeedback("Ping sent");
    setPeerPingState({ peerId, status: "sent", message: "Ping sent" });
    try {
      await pingPeer(peerId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Couldn't reach them";
      setPingFeedback(message);
      setPeerPingState({ peerId, status: "failed", message });
    }
  }, []);

  const acknowledge = useCallback(async (pingId: string) => {
    await acknowledgePing(pingId);
  }, []);

  return {
    incoming,
    activeIncoming: incoming[0] ?? null,
    queuedCount: incoming.length,
    pingFeedback,
    peerPingState,
    sendPing,
    acknowledge,
  };
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";
import {
  getNetworkStatus,
  listPeers,
  startNetwork,
  updateNetworkPresence,
} from "../lib/network";
import type { Peer } from "../types/peer";
import { isPresenceStatus } from "../types/peer";
import type { UserProfile } from "../types/user";
import type { NetworkServiceState, NetworkStatus } from "../types/network";

function normalizePeer(raw: Peer): Peer | null {
  if (!raw?.id || !raw.name || !isPresenceStatus(raw.status)) {
    return null;
  }

  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    ip: raw.ip,
    port: raw.port,
    lastSeen: raw.lastSeen,
  };
}

export function usePeers(profile: UserProfile | null) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [networkReady, setNetworkReady] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    state: "starting",
    detail: null,
    tcpPort: null,
  });

  const upsertPeer = useCallback((peer: Peer) => {
    setPeers((current) => {
      const index = current.findIndex((item) => item.id === peer.id);
      if (index === -1) {
        return [...current, peer];
      }
      const next = [...current];
      next[index] = peer;
      return next;
    });
  }, []);

  const removePeer = useCallback((peerId: string) => {
    setPeers((current) => current.filter((peer) => peer.id !== peerId));
  }, []);

  useEffect(() => {
    if (!profile || !isTauri()) {
      return;
    }

    let cancelled = false;

    const boot = async () => {
      setNetworkStatus({ state: "starting", detail: null, tcpPort: null });
      try {
        const status = await startNetwork(profile);
        if (cancelled) {
          return;
        }
        if (status) {
          setNetworkStatus(status);
        }
        setNetworkReady(
          status?.state === "online" || status?.state === "degraded",
        );
        const existing = await listPeers();
        if (!cancelled) {
          setPeers(
            existing
              .map(normalizePeer)
              .filter((peer): peer is Peer => peer !== null),
          );
        }
      } catch (error) {
        console.error("[eskusmi] network start failed", error);
        if (!cancelled) {
          setNetworkStatus({
            state: "offline",
            detail: "Network unavailable",
            tcpPort: null,
          });
          setNetworkReady(false);
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile || !networkReady || !isTauri()) {
      return;
    }

    void updateNetworkPresence(profile.name, profile.status).catch((error) => {
      console.error("[eskusmi] presence update failed", error);
    });
  }, [profile?.name, profile?.status, networkReady]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    const unlisteners: Array<() => void> = [];

    const bind = async () => {
      try {
        const current = await getNetworkStatus();
        if (current) {
          setNetworkStatus(current);
        }
      } catch {
        // ignore
      }

      unlisteners.push(
        await listen<NetworkStatus>("network-status", (event) => {
          setNetworkStatus(event.payload);
          const state = event.payload.state as NetworkServiceState;
          setNetworkReady(state === "online" || state === "degraded");
        }),
      );
      unlisteners.push(
        await listen<Peer>("peer-discovered", (event) => {
          const peer = normalizePeer(event.payload);
          if (peer) {
            upsertPeer(peer);
          }
        }),
      );
      unlisteners.push(
        await listen<Peer>("peer-updated", (event) => {
          const peer = normalizePeer(event.payload);
          if (peer) {
            upsertPeer(peer);
          }
        }),
      );
      unlisteners.push(
        await listen<Peer>("peer-removed", (event) => {
          removePeer(event.payload.id);
        }),
      );
    };

    void bind();

    return () => {
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [upsertPeer, removePeer]);

  const sortedPeers = useMemo(() => {
    const rank = (status: string) => {
      switch (status) {
        case "available":
          return 0;
        case "focus":
          return 1;
        case "busy":
          return 2;
        case "away":
          return 3;
        default:
          return 4;
      }
    };

    return [...peers].sort((a, b) => {
      const byStatus = rank(a.status) - rank(b.status);
      if (byStatus !== 0) {
        return byStatus;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [peers]);

  return {
    peers: sortedPeers,
    networkReady,
    networkStatus,
  };
}

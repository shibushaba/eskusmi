import { invoke, isTauri } from "@tauri-apps/api/core";
import type { UserProfile } from "../types/user";
import type { Peer } from "../types/peer";
import type { IncomingPing } from "../types/ping";
import type { NetworkStatus } from "../types/network";

export async function startNetwork(
  profile: UserProfile,
): Promise<NetworkStatus | null> {
  if (!isTauri()) {
    return null;
  }

  return invoke<NetworkStatus>("start_network", {
    profile: {
      id: profile.id,
      name: profile.name,
      status: profile.status,
    },
  });
}

export async function getNetworkStatus(): Promise<NetworkStatus | null> {
  if (!isTauri()) {
    return null;
  }

  return invoke<NetworkStatus>("get_network_status");
}

export async function updateNetworkPresence(
  name: string,
  status: string,
): Promise<void> {
  if (!isTauri()) {
    return;
  }

  await invoke("update_presence", { name, status });
}

export async function listPeers(): Promise<Peer[]> {
  if (!isTauri()) {
    return [];
  }

  return invoke<Peer[]>("list_peers");
}

export async function pingPeer(peerId: string): Promise<void> {
  if (!isTauri()) {
    return;
  }

  await invoke("ping_peer", { peerId });
}

export async function acknowledgePing(pingId: string): Promise<void> {
  if (!isTauri()) {
    return;
  }

  await invoke("acknowledge_ping", { pingId });
}

export async function listIncomingPings(): Promise<IncomingPing[]> {
  if (!isTauri()) {
    return [];
  }

  return invoke<IncomingPing[]>("list_incoming_pings");
}

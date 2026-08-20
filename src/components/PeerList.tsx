import type { Peer } from "../types/peer";
import type { NetworkStatus } from "../types/network";
import type { PeerPingState } from "../hooks/usePing";
import { PeerRow } from "./PeerRow";

type PeerListProps = {
  peers: Peer[];
  networkStatus: NetworkStatus;
  peerPingState: PeerPingState | null;
  onPing: (peerId: string) => void;
};

export function PeerList({
  peers,
  networkStatus,
  peerPingState,
  onPing,
}: PeerListProps) {
  if (networkStatus.state === "offline" || networkStatus.state === "starting") {
    return (
      <div className="px-1 py-2">
        <p className="esk-label mb-2">People nearby</p>
        <p className="text-[0.78rem] font-medium tracking-wide text-[color:var(--color-esk-text)]">
          {networkStatus.state === "starting"
            ? "Starting network..."
            : "Network unavailable"}
        </p>
        <p className="esk-meta mt-1.5 leading-relaxed">
          {networkStatus.state === "starting" ? (
            <span className="esk-searching">eskusmi is getting ready.</span>
          ) : (
            "Your profile still works. Discovery could not start."
          )}
        </p>
      </div>
    );
  }

  if (networkStatus.state === "degraded" && peers.length === 0) {
    return (
      <div className="px-1 py-2">
        <p className="esk-label mb-2">People nearby</p>
        <p className="text-[0.78rem] font-medium tracking-wide text-[color:var(--color-esk-text)]">
          Looking for the network...
        </p>
        <p className="esk-meta mt-1.5 leading-relaxed">
          Discovery is limited. Your profile still works.
        </p>
      </div>
    );
  }

  if (peers.length === 0) {
    return (
      <div className="px-1 py-2">
        <p className="esk-label mb-2">People nearby</p>
        <p className="text-[0.78rem] font-medium tracking-wide text-[color:var(--color-esk-text)]">
          No one else is nearby.
        </p>
        <p className="esk-meta mt-1.5 leading-relaxed">
          <span className="esk-searching">
            eskusmi is looking for people on this network.
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="esk-label mb-2 px-1">People nearby</p>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5 esk-scroll">
        {peers.map((peer) => (
          <PeerRow
            key={peer.id}
            peer={peer}
            pingState={
              peerPingState?.peerId === peer.id ? peerPingState : null
            }
            onPing={onPing}
          />
        ))}
      </div>
    </div>
  );
}

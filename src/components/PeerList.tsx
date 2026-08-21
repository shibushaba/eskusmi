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

function NearbyEmpty({
  title,
  detail,
  searching = false,
}: {
  title: string;
  detail: string;
  searching?: boolean;
}) {
  return (
    <div className="flex h-full min-h-[7.5rem] flex-col">
      <p className="esk-label px-0.5">Nearby</p>
      <div className="flex flex-1 flex-col items-center justify-center px-3 text-center">
        <span
          aria-hidden="true"
          className={searching ? "esk-radar" : "esk-radar esk-radar--still"}
        >
          <span className="esk-radar__ring" />
          <span className="esk-radar__ring esk-radar__ring--delay" />
          <span className="esk-radar__core" />
        </span>
        <p className="mt-3 text-[0.78rem] font-medium tracking-wide text-[color:var(--color-esk-text)]">
          {title}
        </p>
        <p className="esk-meta mt-1.5 max-w-[16rem] leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}

export function PeerList({
  peers,
  networkStatus,
  peerPingState,
  onPing,
}: PeerListProps) {
  if (networkStatus.state === "offline" || networkStatus.state === "starting") {
    return (
      <NearbyEmpty
        searching={networkStatus.state === "starting"}
        title={
          networkStatus.state === "starting"
            ? "Starting up"
            : "Network unavailable"
        }
        detail={
          networkStatus.state === "starting"
            ? "Getting ready to look around."
            : "Your profile still works. Discovery could not start."
        }
      />
    );
  }

  if (networkStatus.state === "degraded" && peers.length === 0) {
    return (
      <NearbyEmpty
        searching
        title="Looking for the network"
        detail="Discovery is limited. Your profile still works."
      />
    );
  }

  if (peers.length === 0) {
    return (
      <NearbyEmpty
        searching
        title="Nobody else yet"
        detail="Listening on this network."
      />
    );
  }

  return (
    <div className="esk-peer-list flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <p className="esk-label mb-2 shrink-0 px-0.5">Nearby</p>
      <div className="esk-peer-list__scroll esk-scroll min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
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

import { useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import { ExpandedPanel } from "./components/ExpandedPanel";
import { FloatingButton } from "./components/FloatingButton";
import { IncomingPingOverlay } from "./components/IncomingPing";
import { ProfileSetup } from "./components/ProfileSetup";
import { useAutostart } from "./hooks/useAutostart";
import { usePeers } from "./hooks/usePeers";
import { usePing } from "./hooks/usePing";
import { useUserProfile } from "./hooks/useUserProfile";
import { useWidgetState } from "./hooks/useWidgetState";
import { placeNearBottomRight, syncWindowToMode } from "./lib/window";

function App() {
  const { profile, isLoading, saveProfile, updateName, updateStatus } =
    useUserProfile();
  const {
    expanded,
    panelVisible,
    attentionActive,
    expand,
    collapse,
    showAttention,
    hideAttention,
  } = useWidgetState();
  const { peers, networkStatus } = usePeers(profile);
  const {
    incoming,
    activeIncoming,
    pingFeedback,
    peerPingState,
    sendPing,
    acknowledge,
  } = usePing();
  const { autostartEnabled, setAutostart } = useAutostart();
  const setupSizedRef = useRef(false);
  const attentionShownRef = useRef(false);

  useEffect(() => {
    void placeNearBottomRight();
    if (!isTauri()) {
      return;
    }
    const win = getCurrentWindow();
    // Belt-and-suspenders: kill Windows shadow that paints a gray square.
    // Do NOT set an opaque backgroundColor on Windows — alpha is ignored there.
    void win.setShadow(false).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (isLoading || profile) {
      setupSizedRef.current = false;
      return;
    }

    if (setupSizedRef.current) {
      return;
    }

    setupSizedRef.current = true;
    void (async () => {
      await syncWindowToMode("setup");
      await placeNearBottomRight();
    })();
  }, [isLoading, profile]);

  useEffect(() => {
    if (!activeIncoming) {
      if (attentionShownRef.current || attentionActive) {
        attentionShownRef.current = false;
        void hideAttention();
      }
      return;
    }

    if (!attentionActive) {
      attentionShownRef.current = true;
      void showAttention();
    }
  }, [activeIncoming, attentionActive, hideAttention, showAttention]);

  async function handleSetupContinue(name: string) {
    await saveProfile(name);
    await syncWindowToMode("collapsed");
    await placeNearBottomRight();
  }

  if (isLoading) {
    return <main className="h-full w-full bg-transparent" />;
  }

  if (!profile) {
    return (
      <main className="relative h-full w-full overflow-hidden bg-transparent">
        <div className="h-full w-full">
          <ProfileSetup visible onContinue={handleSetupContinue} />
        </div>
      </main>
    );
  }

  if (attentionActive && activeIncoming) {
    return (
      <main className="relative h-full w-full overflow-hidden bg-transparent">
        <div className="h-full w-full">
          <IncomingPingOverlay
            ping={activeIncoming}
            queued={incoming}
            onAcknowledge={(pingId) => {
              void acknowledge(pingId);
            }}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-full w-full overflow-hidden bg-transparent">
      {expanded ? (
        <ExpandedPanel
          visible={panelVisible}
          profile={profile}
          peers={peers}
          networkStatus={networkStatus}
          pingFeedback={pingFeedback}
          peerPingState={peerPingState}
          autostartEnabled={autostartEnabled}
          onCollapse={() => void collapse()}
          onUpdateName={updateName}
          onUpdateStatus={updateStatus}
          onPingPeer={(peerId) => {
            void sendPing(peerId);
          }}
          onToggleAutostart={setAutostart}
        />
      ) : (
        <div className="h-full w-full bg-transparent">
          <FloatingButton
            status={profile.status}
            onActivate={() => void expand()}
          />
        </div>
      )}
    </main>
  );
}

export default App;

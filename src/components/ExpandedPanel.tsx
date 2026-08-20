import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../lib/cn";
import { EASE, MOTION } from "../lib/motion";
import { statusHint, statusLabel } from "../lib/status";
import type { PresenceStatus, UserProfile } from "../types/user";
import type { Peer } from "../types/peer";
import type { NetworkStatus } from "../types/network";
import type { PeerPingState } from "../hooks/usePing";
import {
  CloseIcon,
  FocusGlyph,
  IconButton,
  PanelHeader,
  StatusDot,
} from "./common/PanelChrome";
import { PeerList } from "./PeerList";
import { StatusSelector } from "./StatusSelector";

type ExpandedPanelProps = {
  visible: boolean;
  profile: UserProfile;
  peers: Peer[];
  networkStatus: NetworkStatus;
  pingFeedback: string | null;
  peerPingState: PeerPingState | null;
  autostartEnabled: boolean;
  onCollapse: () => void;
  onUpdateName: (name: string) => Promise<void>;
  onUpdateStatus: (status: PresenceStatus) => Promise<void>;
  onPingPeer: (peerId: string) => void;
  onToggleAutostart: (enabled: boolean) => Promise<void>;
};

export function ExpandedPanel({
  visible,
  profile,
  peers,
  networkStatus,
  pingFeedback,
  peerPingState,
  autostartEnabled,
  onCollapse,
  onUpdateName,
  onUpdateStatus,
  onPingPeer,
  onToggleAutostart,
}: ExpandedPanelProps) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);

  useEffect(() => {
    setDraftName(profile.name);
    setEditing(false);
  }, [profile.name]);

  async function handleSaveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draftName.trim().slice(0, 64);
    if (!trimmed) {
      setDraftName(profile.name);
      setEditing(false);
      return;
    }
    await onUpdateName(trimmed);
    setEditing(false);
  }

  return (
    <motion.section
      aria-hidden={!visible}
      initial={false}
      animate={
        visible
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 8, scale: 0.96 }
      }
      transition={{
        duration: visible ? MOTION.smooth : MOTION.fast,
        ease: visible ? EASE.enter : EASE.exit,
      }}
      className={cn(
        "esk-panel flex h-full w-full flex-col overflow-hidden",
        visible ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <motion.div
        initial={false}
        animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
        transition={{
          duration: MOTION.fast,
          delay: visible ? 0.02 : 0,
          ease: EASE.out,
        }}
      >
        <PanelHeader
          trailing={
            <IconButton label="Close eskusmi panel" onClick={onCollapse}>
              <CloseIcon />
            </IconButton>
          }
        />
      </motion.div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3.5">
        <motion.div
          initial={false}
          animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={{
            duration: MOTION.standard,
            delay: visible ? 0.04 : 0,
            ease: EASE.out,
          }}
        >
          <p className="esk-label">Your presence</p>

          <div className="mt-2.5 flex items-start justify-between gap-3">
            <AnimatePresence mode="wait" initial={false}>
              {editing ? (
                <motion.form
                  key="edit"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -2 }}
                  transition={{ duration: MOTION.fast, ease: EASE.out }}
                  onSubmit={(event) => void handleSaveName(event)}
                  className="min-w-0 flex-1"
                >
                  <input
                    autoFocus
                    value={draftName}
                    maxLength={64}
                    spellCheck={false}
                    aria-label="Display name"
                    onChange={(event) => setDraftName(event.target.value)}
                    onBlur={() => {
                      void (async () => {
                        const trimmed = draftName.trim().slice(0, 64);
                        if (!trimmed) {
                          setDraftName(profile.name);
                          setEditing(false);
                          return;
                        }
                        await onUpdateName(trimmed);
                        setEditing(false);
                      })();
                    }}
                    className={cn(
                      "esk-focus-ring h-8 w-full rounded-[var(--esk-radius-sm)]",
                      "border border-[color:var(--color-esk-border-strong)] bg-black/25 px-2",
                      "text-[0.9rem] font-medium tracking-wide text-[color:var(--color-esk-text)]",
                    )}
                  />
                </motion.form>
              ) : (
                <motion.div
                  key="view"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -2 }}
                  transition={{ duration: MOTION.fast, ease: EASE.out }}
                  className="min-w-0 flex-1"
                >
                  <p className="esk-name truncate">{profile.name}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="esk-focus-ring shrink-0 text-[0.66rem] tracking-wide text-[color:var(--color-esk-text-muted)] transition-colors hover:text-[color:var(--color-esk-text)]"
              >
                Edit
              </button>
            ) : null}
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <StatusDot status={profile.status} />
            <span className="text-[0.74rem] tracking-wide text-[color:var(--color-esk-text)]">
              {statusLabel(profile.status)}
            </span>
            {profile.status === "focus" ? (
              <FocusGlyph className="text-[color:var(--color-esk-text-muted)]" />
            ) : null}
          </div>

          <p className="esk-meta mt-1.5 leading-relaxed">
            {statusHint(profile.status)}
          </p>
        </motion.div>

        <motion.div
          className="mt-4 min-h-0 flex-1"
          initial={false}
          animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{
            duration: MOTION.standard,
            delay: visible ? 0.07 : 0,
            ease: EASE.out,
          }}
        >
          <PeerList
            peers={peers}
            networkStatus={networkStatus}
            peerPingState={peerPingState}
            onPing={onPingPeer}
          />
        </motion.div>

        {pingFeedback ? (
          <p
            className="esk-meta mt-2"
            role="status"
            aria-live="polite"
          >
            {pingFeedback}
          </p>
        ) : null}

        <motion.div
          className="mt-3"
          initial={false}
          animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={{
            duration: MOTION.fast,
            delay: visible ? 0.09 : 0,
            ease: EASE.out,
          }}
        >
          <StatusSelector
            status={profile.status}
            onChange={(next) => {
              void onUpdateStatus(next);
            }}
          />
        </motion.div>

        <motion.label
          className="mt-3 flex cursor-pointer items-center justify-between gap-3 px-0.5"
          initial={false}
          animate={visible ? { opacity: 1 } : { opacity: 0 }}
          transition={{
            duration: MOTION.fast,
            delay: visible ? 0.1 : 0,
            ease: EASE.out,
          }}
        >
          <span className="esk-meta">Start with Windows</span>
          <button
            type="button"
            role="switch"
            aria-checked={autostartEnabled}
            aria-label="Start eskusmi with Windows"
            data-on={autostartEnabled}
            onClick={() => {
              void onToggleAutostart(!autostartEnabled);
            }}
            className="esk-focus-ring esk-switch"
          >
            <span className="esk-switch__thumb" />
          </button>
        </motion.label>
      </div>
    </motion.section>
  );
}

import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";
import {
  clearProfile,
  createUserProfile,
  loadProfile,
  saveProfile,
} from "../lib/storage";
import type { PresenceStatus, UserProfile } from "../types/user";
import { isPresenceStatus } from "../types/peer";

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const existing = await loadProfile();
        if (!cancelled) {
          setProfile(existing);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: UserProfile) => {
    setProfile(next);
    await saveProfile(next);
  }, []);

  const saveNewProfile = useCallback(
    async (name: string) => {
      const trimmed = name.trim().slice(0, 64);
      if (!trimmed) {
        return;
      }

      await persist(createUserProfile(trimmed));
    },
    [persist],
  );

  const updateName = useCallback(
    async (name: string) => {
      if (!profile) {
        return;
      }

      const trimmed = name.trim().slice(0, 64);
      if (!trimmed || trimmed === profile.name) {
        return;
      }

      await persist({ ...profile, name: trimmed });
    },
    [persist, profile],
  );

  const updateStatus = useCallback(
    async (status: PresenceStatus) => {
      if (!profile || profile.status === status) {
        return;
      }

      await persist({ ...profile, status });
    },
    [persist, profile],
  );

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let unlisten: (() => void) | undefined;

    const bind = async () => {
      unlisten = await listen<{ status: string }>("presence-changed", (event) => {
        const next = event.payload.status;
        if (!isPresenceStatus(next)) {
          return;
        }
        setProfile((current) => {
          if (!current || current.status === next) {
            return current;
          }
          const updated = { ...current, status: next };
          void saveProfile(updated);
          return updated;
        });
      });
    };

    void bind();

    return () => {
      unlisten?.();
    };
  }, []);

  const resetProfile = useCallback(async () => {
    await clearProfile();
    setProfile(null);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    (
      window as Window & {
        __eskusmiResetProfile?: () => Promise<void>;
      }
    ).__eskusmiResetProfile = resetProfile;

    return () => {
      delete (
        window as Window & {
          __eskusmiResetProfile?: () => Promise<void>;
        }
      ).__eskusmiResetProfile;
    };
  }, [resetProfile]);

  return {
    profile,
    isLoading,
    saveProfile: saveNewProfile,
    updateName,
    updateStatus,
    resetProfile,
  };
}

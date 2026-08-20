import { isTauri } from "@tauri-apps/api/core";
import { load, type Store } from "@tauri-apps/plugin-store";
import type { PresenceStatus, UserProfile } from "../types/user";
import { PRESENCE_STATUSES } from "../types/user";

const STORE_FILE = "eskusmi-profile.json";
const PROFILE_KEY = "profile";
const AUTOSTART_KEY = "autostartEnabled";
const AUTOSTART_CONFIGURED_KEY = "autostartConfigured";

const memoryFallback = new Map<string, unknown>();

let storePromise: Promise<Store> | null = null;

async function getStore(): Promise<Store | null> {
  if (!isTauri()) {
    return null;
  }

  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: true });
  }

  return storePromise;
}

function isPresenceStatus(value: unknown): value is PresenceStatus {
  return (
    typeof value === "string" &&
    (PRESENCE_STATUSES as readonly string[]).includes(value)
  );
}

function isUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<UserProfile>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.name === "string" &&
    candidate.name.trim().length > 0 &&
    isPresenceStatus(candidate.status)
  );
}

export function createUserProfile(name: string): UserProfile {
  return {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 64),
    status: "available",
  };
}

/**
 * On each launch, start as Available.
 * Focus/Busy/Away are session-intent states and should not survive a reboot.
 * Invalid legacy ids are replaced with a fresh UUID so protocol validation accepts us.
 */
export async function loadProfile(): Promise<UserProfile | null> {
  const store = await getStore();

  const normalize = (value: UserProfile): UserProfile => {
    const id =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value.id,
      )
        ? value.id
        : crypto.randomUUID();

    return {
      id,
      name: value.name.trim().slice(0, 64),
      status: "available",
    };
  };

  if (!store) {
    const cached = memoryFallback.get(PROFILE_KEY);
    return isUserProfile(cached) ? normalize(cached) : null;
  }

  const value = await store.get(PROFILE_KEY);
  if (!isUserProfile(value)) {
    return null;
  }

  const next = normalize(value);

  if (
    value.status !== "available" ||
    value.name !== next.name ||
    value.id !== next.id
  ) {
    await store.set(PROFILE_KEY, next);
    await store.save();
  }

  return next;
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  const next: UserProfile = {
    id: profile.id,
    name: profile.name.trim().slice(0, 64),
    status: profile.status,
  };

  const store = await getStore();
  if (!store) {
    memoryFallback.set(PROFILE_KEY, next);
    return;
  }

  await store.set(PROFILE_KEY, next);
  await store.save();
}

export async function clearProfile(): Promise<void> {
  memoryFallback.delete(PROFILE_KEY);

  const store = await getStore();
  if (!store) {
    return;
  }

  await store.delete(PROFILE_KEY);
  await store.save();
}

export async function loadAutostartPreference(): Promise<boolean> {
  const store = await getStore();
  if (!store) {
    const cached = memoryFallback.get(AUTOSTART_KEY);
    return typeof cached === "boolean" ? cached : true;
  }

  const value = await store.get(AUTOSTART_KEY);
  return typeof value === "boolean" ? value : true;
}

export async function saveAutostartPreference(enabled: boolean): Promise<void> {
  const store = await getStore();
  if (!store) {
    memoryFallback.set(AUTOSTART_KEY, enabled);
    memoryFallback.set(AUTOSTART_CONFIGURED_KEY, true);
    return;
  }

  await store.set(AUTOSTART_KEY, enabled);
  await store.set(AUTOSTART_CONFIGURED_KEY, true);
  await store.save();
}

/** True once first-run (or a user toggle) has written an explicit preference. */
export async function loadAutostartConfigured(): Promise<boolean> {
  const store = await getStore();
  if (!store) {
    return memoryFallback.get(AUTOSTART_CONFIGURED_KEY) === true;
  }

  return (await store.get(AUTOSTART_CONFIGURED_KEY)) === true;
}

export async function markAutostartConfigured(): Promise<void> {
  const store = await getStore();
  if (!store) {
    memoryFallback.set(AUTOSTART_CONFIGURED_KEY, true);
    return;
  }

  await store.set(AUTOSTART_CONFIGURED_KEY, true);
  await store.save();
}

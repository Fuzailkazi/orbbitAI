"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "orbbit_favorite_models";
const EMPTY: string[] = [];

// ---------------------------------------------------------------------------
// localStorage-backed external store. Every component using the hook shares one
// snapshot, so toggling a favorite on one card updates all of them (and other tabs).
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: string[] = EMPTY;
/** Used only when localStorage rejects writes (private mode / quota). */
let memoryRaw: string | null = null;

function readRaw(): string | null {
  if (memoryRaw !== null) return memoryRaw;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): string[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): string[] {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parse(raw);
  }
  return cachedValue;
}

function getServerSnapshot(): string[] {
  return EMPTY;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function writeFavorites(next: string[]) {
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
    memoryRaw = null;
  } catch {
    // Storage unavailable — keep the value in memory for this session.
    memoryRaw = raw;
  }
  emit();
}

function subscribeNoop() {
  return () => {};
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // false during SSR / hydration, true once running on the client.
  const isLoaded = useSyncExternalStore(subscribeNoop, () => true, () => false);

  function toggleFavorite(modelId: string) {
    const current = getSnapshot();
    const next = current.includes(modelId)
      ? current.filter((id) => id !== modelId)
      : [...current, modelId];
    writeFavorites(next);
  }

  function isFavorite(modelId: string) {
    return favorites.includes(modelId);
  }

  return { favorites, toggleFavorite, isFavorite, isLoaded };
}

/**
 * Guarded access to `localStorage`. Storage can be missing (server render, tests),
 * blocked (private mode, site settings) or full, and every one of those throws or
 * returns null here instead of breaking the page. Callers must treat a stored
 * value as a convenience that may not be there.
 */

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The browser's localStorage, or null when it is unavailable. */
export function getBrowserStorage(): KeyValueStorage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    // Accessing the property itself can throw when storage is blocked.
    return null;
  }
}

export function safeGetItem(
  key: string,
  storage: KeyValueStorage | null = getBrowserStorage(),
): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** Returns whether the value was written. */
export function safeSetItem(
  key: string,
  value: string,
  storage: KeyValueStorage | null = getBrowserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

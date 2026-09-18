import { generateUuid } from "./uuid";

/**
 * This installation's identity.
 *
 * Sync metadata written from the frontend needs a stable device id. It used to
 * be a single constant UUID shared by every install, which made every user's
 * records claim to come from the same device. The id is now generated once per
 * installation and kept locally; if storage is unavailable the value is still a
 * valid, unique UUID, just not persisted.
 */

const STORAGE_KEY = "luma_device_id";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let cached: string | null = null;

export function getDeviceId(): string {
  if (cached) return cached;

  if (typeof localStorage !== "undefined") {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing && UUID_V4.test(existing)) {
        cached = existing;
        return cached;
      }
      cached = generateUuid();
      localStorage.setItem(STORAGE_KEY, cached);
      return cached;
    } catch {
      // Storage unavailable (private mode, quota, test double): keep the id in
      // memory for this session only.
    }
  }

  cached = generateUuid();
  return cached;
}

/** Test hook: forget the memoised id so a fresh one is resolved. */
export function resetDeviceIdCache(): void {
  cached = null;
}

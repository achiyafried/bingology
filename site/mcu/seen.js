// MCU seen marks and view preferences in localStorage. Every access may throw (private mode, blocked storage).
const SEEN = "bingology:mcu-seen";

/** {ids, ok}: ok is false when storage can't be used (marks then live only as long as the page). */
export function loadSeen(storage) {
  try {
    if (!storage) return { ids: new Set(), ok: false };
    const raw = storage.getItem(SEEN);
    let list = [];
    try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
    return { ids: new Set(Array.isArray(list) ? list.filter(x => typeof x === "string") : []), ok: true };
  } catch { return { ids: new Set(), ok: false }; }
}

/** Saves the marks (unknown ids included). False when storage can't be used. */
export function saveSeen(storage, ids) {
  try { storage.setItem(SEEN, JSON.stringify([...ids])); return true; } catch { return false; }
}

export function loadPref(storage, key, allowed, fallback) {
  try { const v = storage.getItem(key); return allowed.includes(v) ? v : fallback; } catch { return fallback; }
}

export function savePref(storage, key, value) {
  try { storage.setItem(key, value); } catch { /* a preference that doesn't stick is fine */ }
}

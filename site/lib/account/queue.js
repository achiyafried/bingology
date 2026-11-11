// Offline write queue: pure, storage injected. One pending row per tmdbId (the later wins).
export const QUEUE_KEY = "bingology:queue";
const MAX_ATTEMPTS = 3;

function read(storage) {
  try {
    const q = JSON.parse(storage.getItem(QUEUE_KEY));
    return Array.isArray(q) ? q.filter(x => x && x.row) : [];
  } catch { return []; }
}
function write(storage, q) {
  try { storage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* storage unavailable */ }
}

/** attempts = failures already suffered (e.g. 1 for a direct write that just failed). */
export function enqueue(storage, tmdbId, row, attempts = 0) {
  const q = read(storage).filter(x => x.tmdbId !== tmdbId);
  q.push({ tmdbId, row, attempts });
  write(storage, q);
}

export function dequeue(storage, tmdbId) {
  write(storage, read(storage).filter(x => x.tmdbId !== tmdbId));
}

export function pending(storage) {
  return read(storage).map(x => x.row);
}

/** Replays rows in order through send(row). Failed rows stay (attempts+1); the 3rd failure drops them. */
export async function flush(storage, send) {
  const q = read(storage);
  const keep = [];
  const out = { sent: 0, failed: 0, gaveUp: [] };
  for (const item of q) {
    try { await send(item.row); out.sent++; }
    catch {
      out.failed++;
      const attempts = (item.attempts || 0) + 1;
      if (attempts >= MAX_ATTEMPTS) out.gaveUp.push(item.tmdbId);
      else keep.push({ ...item, attempts });
    }
  }
  // Rows enqueued while we were sending must survive.
  const fresh = read(storage).filter(x => {
    const o = q.find(y => y.tmdbId === x.tmdbId);
    return !o || JSON.stringify(o.row) !== JSON.stringify(x.row);
  });
  write(storage, [...keep.filter(k => !fresh.some(f => f.tmdbId === k.tmdbId)), ...fresh]);
  return out;
}

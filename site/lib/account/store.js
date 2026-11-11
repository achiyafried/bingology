import { getClient } from "./client.js";
import { currentUser } from "./auth.js";
import { enqueue, dequeue, pending, flush } from "./queue.js";
import { seenToEntries, MIGRATED_KEY } from "../migrate.js";

const COLS = "tmdb_id,status,season,episode,rating,note,finished_on,title,poster,updated_at";
const SLUG_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
const ls = () => { try { return localStorage; } catch { return null; } };
let mine = new Map();
let mineFor = null; // user id the map was loaded for

function newSlug(n = 16) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, x => SLUG_CHARS[x % SLUG_CHARS.length]).join("");
}

async function upsert(row) {
  const c = await getClient();
  const { error } = await c.from("entries").upsert(row, { onConflict: "user_id,tmdb_id" });
  if (error) throw error;
}

const POSTER_RE = /^https:\/\/image\.tmdb\.org\/t\/p\/[a-z0-9]+\/[A-Za-z0-9_.-]+$/;
let flushing = null;

/**
 * Replays queued writes (updated_at is server-set, so rows never carry it). One flush at a time.
 * When rows are given up after repeated failures, their optimistic entries are dropped from the
 * local map and window fires a "bingology:write-failed" CustomEvent with detail { ids: tmdbId[] }.
 */
export function flushQueue() {
  if (flushing) return flushing;
  flushing = (async () => {
    const st = ls();
    const user = st && pending(st).length ? await currentUser() : null;
    if (!user) return { sent: 0, failed: 0, gaveUp: [] }; // signed out: keep rows, don't burn attempts
    const r = await flush(st, upsert, user.id); // rows queued by another account are dropped
    if (r.gaveUp.length) {
      for (const id of r.gaveUp) mine.delete(id);
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("bingology:write-failed", { detail: { ids: r.gaveUp } }));
    }
    return r;
  })().finally(() => { flushing = null; });
  return flushing;
}

export async function loadMine() {
  const user = await currentUser();
  if (!user) throw new Error("not signed in");
  const c = await getClient();
  // RLS also exposes circle-mates' rows; keep only our own.
  const { data, error } = await c.from("entries").select(COLS).eq("user_id", user.id);
  if (error) throw error;
  mine = new Map((data || []).map(e => [e.tmdb_id, e]));
  mineFor = user.id;
  return new Map(mine);
}

/** Like loadMine, but reuses the map already loaded for this user (it tracks every saveEntry/removeEntry). */
export async function myEntries() {
  const user = await currentUser();
  if (!user) throw new Error("not signed in");
  return mineFor === user.id ? new Map(mine) : loadMine();
}

/** Deletes my row for a series ("not seen after all"); a queued write for it is dropped first. */
export async function removeEntry(tmdbId) {
  const user = await currentUser();
  if (!user) throw new Error("not signed in");
  const st = ls();
  if (st) dequeue(st, tmdbId);
  const prev = mine.get(tmdbId);
  mine.delete(tmdbId);
  const c = await getClient();
  const { error } = await c.from("entries").delete().eq("user_id", user.id).eq("tmdb_id", tmdbId);
  if (error) { if (prev) mine.set(tmdbId, prev); throw error; }
}

/** Optimistic: local map updates at once; the write goes to the server, or the queue on failure. */
export async function saveEntry(tmdbId, patch) {
  const user = await currentUser();
  if (!user) throw new Error("not signed in");
  const prev = mine.get(tmdbId) || {};
  const row = { ...prev, ...patch, user_id: user.id, tmdb_id: tmdbId };
  delete row.updated_at;
  const title = row.title == null ? "" : String(row.title).slice(0, 200);
  if (!title) throw new Error("saveEntry needs a title (pass it from the series object)");
  if (row.poster === undefined) throw new Error("saveEntry needs a poster (use null if none)");
  row.title = title;
  row.poster = typeof row.poster === "string" && POSTER_RE.test(row.poster) ? row.poster : null;
  mine.set(tmdbId, { ...row, updated_at: new Date().toISOString() });
  const st = ls();
  try { await upsert(row); if (st) dequeue(st, tmdbId); }
  catch { if (st) enqueue(st, tmdbId, row, 1); } // the direct attempt counts as the first failure
  return mine.get(tmdbId);
}

/** Once per user: uploads local "seen" marks as status 'seen' rows. */
export async function migrateLocal(storage, S) {
  const user = await currentUser();
  if (!user) return 0;
  try { if (storage.getItem(MIGRATED_KEY) === user.id) return 0; } catch { /* treat as not migrated */ }
  const existing = new Set((await loadMine()).keys());
  const rows = seenToEntries(storage, S, existing).map(r => ({ ...r, user_id: user.id }));
  if (rows.length) {
    const c = await getClient();
    const { error } = await c.from("entries").upsert(rows, { onConflict: "user_id,tmdb_id" });
    if (error) throw error;
  }
  try { storage.setItem(MIGRATED_KEY, user.id); } catch { /* ignore */ }
  return rows.length;
}

/** on: creates a slug (or keeps the existing one); off: clears it. Returns slug|null. */
export async function setShare(on) {
  const user = await currentUser();
  if (!user) throw new Error("not signed in");
  const c = await getClient();
  let slug = null;
  if (on) {
    const got = await c.from("profiles").select("share_slug").eq("id", user.id).maybeSingle();
    if (got.error) throw got.error;
    slug = (got.data && got.data.share_slug) || newSlug();
  }
  const { error } = await c.from("profiles").update({ share_slug: slug }).eq("id", user.id);
  if (error) throw error;
  return slug;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { flushQueue().catch(() => {}); });
  flushQueue().catch(() => {});
}

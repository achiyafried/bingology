import { getClient } from "./client.js";
import { currentUser } from "./auth.js";
import { enqueue, pending, flush } from "./queue.js";
import { seenToEntries, MIGRATED_KEY } from "../migrate.js";

const COLS = "tmdb_id,status,season,episode,rating,note,finished_on,title,poster,updated_at";
const SLUG_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
const ls = () => { try { return localStorage; } catch { return null; } };
let mine = new Map();

function newSlug(n = 16) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, x => SLUG_CHARS[x % SLUG_CHARS.length]).join("");
}

async function upsert(row) {
  const c = await getClient();
  const { error } = await c.from("entries").upsert(row, { onConflict: "user_id,tmdb_id" });
  if (error) throw error;
}

/** Replays queued writes. updated_at is server-set, so rows never carry it. */
export async function flushQueue() {
  const st = ls();
  if (!st || !pending(st).length || !(await currentUser())) return { sent: 0, failed: 0, gaveUp: [] }; // signed out: keep rows, don't burn attempts
  return flush(st, upsert);
}

export async function loadMine() {
  const c = await getClient();
  const { data, error } = await c.from("entries").select(COLS);
  if (error) throw error;
  mine = new Map((data || []).map(e => [e.tmdb_id, e]));
  return new Map(mine);
}

/** Optimistic: local map updates at once; the write goes to the server, or the queue on failure. */
export async function saveEntry(tmdbId, patch) {
  const user = await currentUser();
  if (!user) throw new Error("not signed in");
  const prev = mine.get(tmdbId) || {};
  const row = { ...prev, ...patch, user_id: user.id, tmdb_id: tmdbId };
  delete row.updated_at;
  mine.set(tmdbId, { ...row, updated_at: new Date().toISOString() });
  try { await upsert(row); }
  catch { const st = ls(); if (st) enqueue(st, tmdbId, row); }
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

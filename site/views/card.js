// Signed-in additions to the series card (my status, my rating, what the circle did), and the
// write-through for the site's "seen" marks. Loaded by app.js with import() only when a session exists.
import { esc } from "../lib/esc.js";

export const STATUSES = [["want", "רוצה"], ["watching", "רואה"], ["seen", "ראיתי"], ["dropped", "נטשתי"]];
const DONE = new Set(["seen", "dropped"]);

/* ───────── pure rendering ───────── */

function chip(f) {
  const n = `<bdi>${esc(f.name)}</bdi>`;
  if (f.status === "seen") return f.rating ? `<span class="fr">${n} ${+f.rating}</span>` : `<span class="fr">${n} · נצפתה</span>`;
  const what = { want: "רוצה לראות", watching: "רואה עכשיו", dropped: "· ננטשה" }[f.status];
  return what ? `<span class="fr w">${n} ${what}</span>` : "";
}

/** state: {entry: {status, rating} | null, friends: [{name, status, rating}], err} */
export function cardHTML(state) {
  const st = state || {};
  if (st.err) return `<p class="lbl acct-err">לא הצלחנו להתחבר לחשבון. נסו שוב בעוד רגע</p>`;
  const cur = st.entry && st.entry.status;
  const status = STATUSES.map(([v, t]) => `<button data-a="cst" data-v="${v}" aria-pressed="${cur === v}">${t}</button>`).join("");
  const r = st.entry && st.entry.rating;
  const rate = cur === "seen"
    ? `<div class="lbl" id="acct-rl">הציון שלי</div><div class="rate10" role="group" aria-labelledby="acct-rl">${Array.from({ length: 10 }, (_, k) => `<button data-a="crate" data-v="${k + 1}" aria-pressed="${r === k + 1}">${k + 1}</button>`).join("")}</div>`
    : "";
  const fr = (st.friends || []).map(chip).filter(Boolean);
  const friends = fr.length ? `<div class="lbl">במעגל</div><div class="friends">${fr.join("")}</div>` : "";
  return `<div class="lbl" id="acct-sl">מה אני עם הסדרה</div><div class="status" role="group" aria-labelledby="acct-sl">${status}</div>${rate}${friends}`;
}

/* ───────── account (browser only) ───────── */

let mods = null;
const cache = new Map();             // tmdbId -> {entry, friends}: paint at once on re-open

const loadMods = () => mods || (mods = Promise.all([import("../lib/account/auth.js"), import("../lib/account/store.js"), import("../lib/account/circle.js")])
  .then(([auth, store, circle]) => ({ auth, store, circle }))
  .catch(e => { mods = null; throw e; }));

/** My entries (store.js's map, loaded once per user). Null when signed out. */
async function mine() {
  const { auth, store } = await loadMods();
  return (await auth.currentUser()) ? store.myEntries() : null;
}

/** Adds the indexes of series I've seen or dropped (on the account) to `seen`. Returns how many were added. */
export async function syncSeen(S, seen) {
  const m = await mine();
  if (!m) return 0;
  let n = 0;
  S.forEach((s, i) => { const e = m.get(s.tmdbId); if (e && DONE.has(e.status) && !seen.has(i)) { seen.add(i); n++; } });
  return n;
}

/**
 * The site's own "seen" toggles, when signed in. On: status 'seen' (unless already seen or dropped).
 * Off: deletes the row only when it is a plain 'seen' mark without a rating or note, so a slip never loses them.
 */
export async function writeSeen(s, on) {
  const m = await mine();
  if (!m) return;
  const { store } = await loadMods();
  const e = m.get(s.tmdbId);
  if (on) {
    if (e && DONE.has(e.status)) return;
    await store.saveEntry(s.tmdbId, { status: "seen", title: s.n, poster: s.poster ?? null });
  } else if (e && e.status === "seen" && !e.rating && !e.note) {
    await store.removeEntry(s.tmdbId);
  }
  cache.delete(s.tmdbId);
}

/** ctx: {s (series), toast(msg), onSeen(on)} — renders into root (a fresh element on every dialog paint). */
export async function mountCard(root, ctx) {
  const id = ctx.s.tmdbId;
  const paint = st => { if (root.isConnected) root.innerHTML = cardHTML(st); };
  if (cache.has(id)) paint(cache.get(id));
  root.addEventListener("click", ev => onClick(ev, root, ctx, paint));
  try {
    const { circle } = await loadMods();
    const [m, friends] = await Promise.all([mine(), circle.friendsOn(id)]);
    if (!m) { root.innerHTML = ""; return; }
    const st = { entry: m.get(id) || null, friends };
    cache.set(id, st);
    paint(st);
  } catch (e) {
    if (!cache.has(id)) paint({ err: true });
  }
}

async function onClick(ev, root, ctx, paint) {
  const el = ev.target.closest("[data-a]");
  if (!el || !root.contains(el)) return;
  const a = el.dataset.a, v = el.dataset.v, s = ctx.s, id = s.tmdbId;
  const st = cache.get(id);
  if (!st || (a !== "cst" && a !== "crate")) return;
  const prev = st.entry;
  let patch;
  if (a === "cst") { if (prev && prev.status === v) return; patch = { status: v }; }
  else { const n = +v; patch = { status: "seen", rating: prev && prev.rating === n ? null : n }; }
  st.entry = { ...prev, ...patch };
  paint(st);
  const f = root.querySelector(`[data-a="${a}"][data-v="${v}"]`); if (f) f.focus();
  try {
    const { store } = await loadMods();
    const row = await store.saveEntry(id, { title: s.n, poster: s.poster ?? null, ...patch });
    st.entry = row;
    if (ctx.onSeen) ctx.onSeen(DONE.has(row.status));
  } catch (e) {
    st.entry = prev;
    paint(st);
    if (ctx.toast) ctx.toast("השינוי לא נשמר");
  }
}

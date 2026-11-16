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

/** The local "seen" toggle (app.js's dseen), for when the account can't be used. */
const localToggle = seen => `<div class="acct-local"><button class="btn primary" data-a="dseen">${seen ? "עוד לא ראיתי" : "סימון כנצפתה"}</button></div>`;

/**
 * state: {entry: {status, rating} | null, friends: [{name, status, rating}], seen (local mark),
 *   err (account unreachable), local (no session after all)}
 */
export function cardHTML(state) {
  const st = state || {};
  if (st.local) return localToggle(st.seen);
  if (st.err) return `<p class="lbl acct-err">לא הצלחנו להתחבר לחשבון. נסו שוב בעוד רגע</p>${localToggle(st.seen)}`;
  const cur = st.entry && st.entry.status;
  const status = STATUSES.map(([v, t]) => `<button data-a="cst" data-v="${v}" aria-pressed="${cur === v}">${t}</button>`).join("");
  const r = st.entry && st.entry.rating;
  const rate = cur === "seen"
    ? `<div class="lbl" id="acct-rl">הציון שלי</div><div class="rate10" role="group" aria-labelledby="acct-rl">${Array.from({ length: 10 }, (_, k) => `<button data-a="crate" data-v="${k + 1}" aria-pressed="${r === k + 1}">${k + 1}</button>`).join("")}</div>`
    : "";
  const fr = (st.friends || []).map(chip).filter(Boolean);
  const friends = fr.length ? `<div class="lbl">במעגל</div><div class="friends">${fr.join("")}</div>` : "";
  // "Not for me" (private 'nope'): offered only with no row or a want row; on a nope row it undoes.
  const nope = !cur || cur === "want" || cur === "nope"
    ? `<div class="acct-nope"><button class="linkbtn" data-a="cnope">${cur === "nope" ? "החזרה להמלצות" : "לא בשבילי"}</button></div>` : "";
  return `<div class="lbl" id="acct-sl">מה אני עם הסדרה</div><div class="status" role="group" aria-labelledby="acct-sl">${status}</div>${rate}${nope}${friends}`;
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
 * Off: deletes the row only when it is a plain 'seen' mark without a rating, note or finish date, so a slip never loses them.
 */
export async function writeSeen(s, on) {
  const m = await mine();
  if (!m) return;
  const { store } = await loadMods();
  const e = m.get(s.tmdbId);
  if (on) {
    if (e && DONE.has(e.status)) return;
    await store.saveEntry(s.tmdbId, { status: "seen", title: s.n, poster: s.poster ?? null });
  } else if (e && e.status === "seen" && !e.rating && !e.note && !e.finished_on) {
    await store.removeEntry(s.tmdbId);
  }
  cache.delete(s.tmdbId);
}

/** Adds the indexes of series marked "not for me" (status 'nope' on the account) to `nope`. Returns how many were added. */
export async function syncNope(S, nope) {
  const m = await mine();
  if (!m) return 0;
  let n = 0;
  S.forEach((s, i) => { const e = m.get(s.tmdbId); if (e && e.status === "nope" && !nope.has(i)) { nope.add(i); n++; } });
  return n;
}

/** The write behind writeNope, without dropping the card cache. Returns my row afterwards (null when deleted). */
async function nopeWrite(s, on, prevStatus) {
  const m = await mine();
  if (!m) return null;
  const { store } = await loadMods();
  const e = m.get(s.tmdbId);
  if (on) {
    if (e && e.status !== "want") return e;
    return store.saveEntry(s.tmdbId, { status: "nope", title: s.n, poster: s.poster ?? null });
  }
  if (prevStatus === "want") return store.saveEntry(s.tmdbId, { status: "want", title: s.n, poster: s.poster ?? null });
  if (e && e.status === "nope") await store.removeEntry(s.tmdbId);
  return e && e.status !== "nope" ? e : null;
}

/**
 * "Not for me", when signed in. On: status 'nope', only when there is no row or the row is 'want'.
 * Off: back to 'want' when prevStatus is 'want'; otherwise the row is deleted (only if it is 'nope').
 */
export async function writeNope(s, on, prevStatus = null) {
  const row = await nopeWrite(s, on, prevStatus);
  cache.delete(s.tmdbId);
  return row;
}

/** ctx: {s (series), seen (local mark), toast(msg), onSeen(on), onNope(on)} — renders into root (a fresh element on every dialog paint). */
export async function mountCard(root, ctx) {
  const id = ctx.s.tmdbId;
  const paint = st => { if (root.isConnected) root.innerHTML = cardHTML(st); };
  if (cache.has(id)) paint(cache.get(id));
  root.addEventListener("click", ev => onClick(ev, root, ctx, paint));
  try {
    const { circle } = await loadMods();
    const [m, friends] = await Promise.all([mine(), circle.friendsOn(id)]);
    if (!m) { paint({ local: true, seen: ctx.seen }); return; }
    const st = { entry: m.get(id) || null, friends };
    cache.set(id, st);
    paint(st);
  } catch (e) {
    if (!cache.has(id)) paint({ err: true, seen: ctx.seen });
  }
}

async function onClick(ev, root, ctx, paint) {
  const el = ev.target.closest("[data-a]");
  if (!el || !root.contains(el)) return;
  const a = el.dataset.a, v = el.dataset.v, s = ctx.s, id = s.tmdbId;
  const st = cache.get(id);
  if (!st) return;
  if (a === "cnope") return onNopeClick(root, ctx, paint, st);
  if (a !== "cst" && a !== "crate") return;
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
    if (prev && prev.status === "nope" && ctx.onNope) ctx.onNope(false);
  } catch (e) {
    st.entry = prev;
    paint(st);
    if (ctx.toast) ctx.toast("השינוי לא נשמר");
  }
}

/** "לא בשבילי" / "החזרה להמלצות". Undo restores 'want' when this card marked a want row; otherwise deletes. */
async function onNopeClick(root, ctx, paint, st) {
  const s = ctx.s, prev = st.entry;
  const on = !(prev && prev.status === "nope");
  if (on && prev && prev.status !== "want") return;
  const back = on ? null : st.nopeFrom || null;
  if (on) st.nopeFrom = prev ? prev.status : null;
  st.entry = on ? { ...prev, status: "nope" } : back === "want" ? { ...prev, status: "want" } : null;
  const focus = () => { const f = root.querySelector('[data-a="cnope"]'); if (f) f.focus(); };
  paint(st);
  focus();
  try {
    st.entry = await nopeWrite(s, on, back);
    if (!on) st.nopeFrom = null;
    paint(st);
    focus();
    if (ctx.onNope) ctx.onNope(on);
  } catch (e) {
    st.entry = prev;
    paint(st);
    if (ctx.toast) ctx.toast("השינוי לא נשמר");
  }
}

// The "שלי" tab: profile, lists, sign-in and the read-only share view.
// Loaded by app.js with import() only. Account modules are imported on demand inside mountMine,
// so a broken CDN or Supabase outage shows one box here and nothing else on the site changes.
import { esc, safeImg } from "../lib/esc.js";
import { nextEpisode, progress } from "../lib/progress.js";

export const ACCOUNT_DOWN = "לא הצלחנו להתחבר לחשבון. נסו שוב בעוד רגע";
const PACE = 2;

/* ───────── pure rendering ───────── */

const rowsOf = entries => (!entries ? [] : Array.isArray(entries) ? entries : [...entries.values()]);
const indexById = S => new Map((S || []).map((s, i) => [s.tmdbId, i]));
const initial = name => esc((String(name || "").trim()[0] || "?").toUpperCase());

function evenings(n) {
  if (!n) return "";
  return n === 1 ? "עוד ערב אחד" : `עוד ${n} ערבים`;
}

/** Poster + title. A button that opens the series card when the series is in today's data. */
function head(e, s, i, sub, ro) {
  const title = s ? s.n : e.title || "";
  const src = safeImg(s ? s.poster : null) || safeImg(e.poster);
  const img = src ? `<img src="${src}" alt="" loading="lazy">` : `<span class="noimg" aria-hidden="true"></span>`;
  const inner = `${img}<span class="i"><b><bdi>${esc(title)}</bdi></b>${sub}</span>`;
  return s && !ro ? `<button class="it-main" data-a="detail" data-i="${i}">${inner}</button>` : `<div class="it-main">${inner}</div>`;
}

function watchingRow(e, s, i, st, ro) {
  const ser = s || {};
  const has = e.season != null && e.episode != null;
  const pos = { season: e.season || 1, episode: e.episode || 0 };
  const pr = progress(pos, ser, st.pace || PACE);
  if (!ro && st.prompt === e.tmdb_id) {
    const nums = Array.from({ length: 10 }, (_, k) => `<button class="chip" data-a="rate" data-id="${e.tmdb_id}" data-v="${k + 1}">${k + 1}</button>`).join("");
    return `<div class="it ask">${head(e, s, i, `<small>סיימת? תנו ציון</small>`, ro)}
      <div class="rateq" role="group" aria-label="ציון מ-1 עד 10">${nums}</div>
      <div class="rateq-x"><button class="linkbtn" data-a="rate" data-id="${e.tmdb_id}" data-v="0">סיימתי, בלי ציון</button><button class="linkbtn" data-a="rate-cancel">עוד לא</button></div></div>`;
  }
  const where = has ? [`עונה ${e.season} · פרק ${e.episode}`, evenings(pr.eveningsLeft)].filter(Boolean).join(" · ") : "עוד לא התחלתי";
  const bar = has && pr.pct != null ? `<span class="bar" aria-hidden="true"><i style="width:${Math.min(100, pr.pct)}%"></i></span>` : "";
  const plus = ro ? "" : `<button class="plus" data-a="plus" data-id="${e.tmdb_id}" aria-label="פרק אחד קדימה: ${esc(s ? s.n : e.title)}">+1 פרק</button>`;
  return `<div class="it">${head(e, s, i, `<small>${where}</small>${bar}`, ro)}${plus}</div>`;
}

function wantRow(e, s, i, st, ro) {
  const bs = s ? (st.scores && st.scores.get(e.tmdb_id)) ?? s.bs : null;
  const score = bs != null ? `<span class="bscore">בינג׳ ${Math.round(bs)}</span>` : "";
  return `<div class="it">${head(e, s, i, "", ro)}${score}</div>`;
}

function seenRow(e, s, i, st, ro) {
  const dropped = e.status === "dropped";
  const bits = [];
  if (dropped) bits.push(e.season ? `נטשתי בעונה ${e.season}` : "נטשתי");
  else if (e.finished_on) bits.push(String(e.finished_on).slice(0, 4));
  if (e.note) bits.push(`״${esc(e.note)}״`);
  const sub = bits.length ? `<small>${bits.join(" · ")}</small>` : "";
  const r = dropped ? null : e.rating;
  const score = r ? `<span class="score" aria-label="ציון ${r}">${r}</span>` : `<span class="score none" aria-label="בלי ציון">—</span>`;
  return `<div class="it">${head(e, s, i, sub, ro)}${score}</div>`;
}

const ratingOf = e => (e.status === "dropped" ? 0 : e.rating || 0);
const newer = (a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
// By date: newest finished_on first; unknown dates (e.g. migrated marks) last.
const byDate = (a, b) => !a.finished_on !== !b.finished_on ? (a.finished_on ? -1 : 1) : String(b.finished_on || "").localeCompare(String(a.finished_on || "")) || newer(a, b);
function seenSort(rows, by) {
  return rows.slice().sort(by === "date" ? byDate : (a, b) => ratingOf(b) - ratingOf(a) || newer(a, b));
}

function listsHTML(rows, S, st, ro) {
  const idx = indexById(S);
  const pick = status => rows.filter(e => (Array.isArray(status) ? status.includes(e.status) : e.status === status));
  const row = fn => e => { const i = idx.get(e.tmdb_id); return fn(e, i === undefined ? null : S[i], i, st, ro); };
  const watching = pick("watching"), want = pick("want"), seen = seenSort(pick(["seen", "dropped"]), st.seenSort);
  const stats = [["ראיתי", pick("seen").length], ["רוצה לראות", want.length], ["עכשיו", watching.length]];
  const sec = (h, list, fn, extra = "") => list.length ? `<div class="sh"><h3>${h}</h3>${extra}</div><div class="card">${list.map(row(fn)).join("")}</div>` : "";
  const sortBtn = ro || seen.length < 2 ? "" : `<button class="linkbtn" data-a="seensort">${st.seenSort === "date" ? "לפי תאריך ▾" : "לפי ציון ▾"}</button>`;
  const body = sec("רואה עכשיו", watching, watchingRow) + sec("רוצה לראות", want, wantRow) + sec("ראיתי", seen, seenRow, sortBtn);
  return `<div class="stats">${stats.map(([t, n]) => `<div class="stat"><strong>${n}</strong><span>${t}</span></div>`).join("")}</div>`
    + (body || `<div class="empty"><p>${ro ? "עוד אין כאן סדרות." : "עוד אין כאן סדרות. סמנו \"כבר ראיתי\" ברשימה, או פתחו סדרה והוסיפו אותה."}</p></div>`);
}

function signinHTML(st) {
  const n = st.localSeen || 0;
  const move = n > 1 ? `<p class="fine">${n} סימוני "ראיתי" מהמכשיר הזה יעברו לחשבון.</p>`
    : n === 1 ? `<p class="fine">סימון "ראיתי" אחד מהמכשיר הזה יעבור לחשבון.</p>` : "";
  const mail = st.emailOpen
    ? `<form class="mail" data-f="signin-email"><input class="search" type="email" id="mine-email" required autocomplete="email" dir="ltr" placeholder="name@example.com" aria-label="כתובת מייל" value="${esc(st.email || "")}"><button class="btn ghost block" type="submit" data-a="signin-email">שלחו לי קישור כניסה</button></form>`
    : `<button class="btn ghost block" data-a="signin-email-open">כניסה בקישור למייל</button>`;
  const msg = st.msg ? `<p class="fine" role="status">${esc(st.msg)}</p>` : "";
  return `<section class="mine"><div class="signin">
    <h2 data-focus tabindex="-1">הבינג׳ים שלך, בכל מכשיר</h2>
    <p>שומרים מה ראיתם ומה נתתם, ורואים מה החברים בוחרים.</p>
    <button class="btn primary block" data-a="signin-google">כניסה עם Google</button>
    ${mail}${msg}${move}
  </div></section>`;
}

function nameStepHTML(st, name) {
  const first = st.created && !st.naming;
  return `<form class="namestep" data-f="name">
    <label for="mine-name">${first ? "איך לקרוא לך? כך יראו אותך החברים במעגל." : "השם שלך"}</label>
    <input class="search" id="mine-name" type="text" required minlength="1" maxlength="40" autocomplete="nickname" value="${esc(name)}">
    <button class="btn primary" type="submit" data-a="name-save">שמירה</button>
    ${first ? "" : `<button class="linkbtn" type="button" data-a="rename-cancel">ביטול</button>`}
  </form>`;
}

export function unavailableHTML() {
  return `<div class="empty"><p>${ACCOUNT_DOWN}</p><button class="btn primary" data-a="mretry">נסו שוב</button></div>`;
}

/** state: {user, profile, created, naming, entries, S, scores, circle, feed, pick, localSeen, pace, prompt, seenSort, emailOpen, msg, loading, error} */
export function mineHTML(state) {
  const st = state || {};
  if (st.error) return unavailableHTML();
  if (st.loading) return `<div class="empty loading" role="status"><p>טוענים את הבינג׳ים שלך…</p></div>`;
  if (!st.user) return signinHTML(st);
  const name = (st.profile && st.profile.name) || st.user.name || "";
  const slug = st.profile && st.profile.share_slug;
  const circle = st.circle && st.circle.members && st.circle.members.length
    ? `<small>במעגל עם ${st.circle.members.filter(m => m.id !== st.user.id).map(m => esc(m.name)).join(", ")}</small>` : "";
  const share = slug
    ? `<div class="shared"><span>הקישור לשיתוף פעיל</span><button class="linkbtn" data-a="share" data-v="copy">העתקה</button><button class="linkbtn" data-a="share" data-v="off">כיבוי</button></div>`
    : "";
  return `<section class="mine">
    <div class="me"><span class="av" aria-hidden="true">${initial(name)}</span>
      <div class="who"><h2 data-focus tabindex="-1">הבינג׳ים של ${esc(name)}</h2>${circle}${st.created || st.naming ? "" : `<button class="linkbtn rename" data-a="rename">שינוי שם</button>`}</div>
      ${slug ? "" : `<button class="btn ghost" data-a="share" data-v="on">שיתוף</button>`}</div>
    ${st.created || st.naming ? nameStepHTML(st, name) : ""}
    ${share}
    ${listsHTML(rowsOf(st.entries), st.S, st, false)}
    <div class="foot"><button class="linkbtn" data-a="signout">יציאה מהחשבון</button></div>
  </section>`;
}

/** Read-only view for #u=<slug>: no buttons, no circle. */
export function sharedHTML(data, S) {
  if (!data) return `<div class="empty"><h2 data-focus tabindex="-1">הקישור לא פעיל</h2><p>אולי הבעלים כיבו את השיתוף, או שהקישור לא הועתק עד הסוף.</p></div>`;
  return `<section class="mine shared-view">
    <div class="me"><span class="av" aria-hidden="true">${initial(data.name)}</span>
      <div class="who"><h2 data-focus tabindex="-1">הבינג׳ים של ${esc(data.name)}</h2><small>תצוגה לקריאה בלבד</small></div></div>
    ${listsHTML(rowsOf(data.entries), S, { pace: PACE }, true)}
  </section>`;
}

/* ───────── mounting and actions (browser only) ───────── */

let V = { loading: true };       // view state for mineHTML
let ROOT = null, CTX = null, mod = null, authSub = false, seq = 0, needFocus = false;
let knownUid; // undefined until the first load resolves the session; then the user id or null

const loadMods = async () => mod || (mod = await Promise.all([import("../lib/account/auth.js"), import("../lib/account/store.js")])
  .then(([auth, store]) => ({ auth, store }))
  .catch(e => { mod = null; throw e; }));

function paint() {
  if (!ROOT || !ROOT.isConnected) return;
  ROOT.innerHTML = CTX.share ? (V.sharedErr ? unavailableHTML() : V.shared === undefined ? mineHTML({ loading: true }) : sharedHTML(V.shared, CTX.S))
    : mineHTML({ ...V, S: CTX.S, pace: CTX.pace || PACE, localSeen: CTX.localSeen ? CTX.localSeen() : 0 });
  // First content paint after a mount: move focus to the tab's heading (the loading box has none).
  const h = needFocus && ROOT.querySelector("[data-focus]");
  if (h) { needFocus = false; h.focus({ preventScroll: true }); }
}

async function loadShared() {
  const my = ++seq;
  try {
    const { getClient } = await import("../lib/account/client.js");
    const c = await getClient();
    const { data, error } = await c.rpc("shared_profile", { slug: CTX.share });
    if (error) throw error;
    if (my === seq) { V.shared = data || null; V.sharedErr = false; }
  } catch (e) { if (my === seq) V.sharedErr = true; }
  paint();
}

async function load() {
  const my = ++seq;
  try {
    const { auth, store } = await loadMods();
    if (!authSub) {
      authSub = true;
      // Remount only on a real user change. The initial callback can arrive while load() is still running.
      auth.onAuth(u => {
        const id = u ? u.id : null;
        if (knownUid === undefined || id === knownUid) return;
        knownUid = id;
        if (ROOT && ROOT.isConnected && !CTX.share) { V = { loading: true }; needFocus = true; paint(); load(); }
      }).catch(() => { authSub = false; });
    }
    const user = await auth.currentUser();
    knownUid = user ? user.id : null;
    if (!user) { if (my === seq) V = { user: null, emailOpen: V.emailOpen, email: V.email, msg: V.msg }; return paint(); }
    const fallback = user.name || (user.email || "").split("@")[0];
    const { profile, created } = await auth.ensureProfile(fallback);
    if (CTX.storage) { try { await store.migrateLocal(CTX.storage, CTX.S); } catch (e) { /* retried on the next load */ } }
    const entries = await store.loadMine();
    if (my !== seq) return;
    // created stays true until the name is saved, so a remount keeps showing the name step.
    V = { user, profile, entries, created: created || (V.created && V.user && V.user.id === user.id), naming: V.naming, prompt: V.prompt, seenSort: V.seenSort };
  } catch (e) {
    if (my !== seq) return;
    V = { error: true };
  }
  paint();
}

const seriesOf = id => { const S = CTX.S || []; return S.find(s => s.tmdbId === id) || null; };
const meta = (id, e) => { const s = seriesOf(id); return { title: s ? s.n : e && e.title, poster: s ? s.poster ?? null : (e && e.poster) ?? null }; };

async function save(id, patch) {
  const { store } = await loadMods();
  const prev = V.entries.get(id);
  V.entries.set(id, { ...prev, ...patch, tmdb_id: id }); // optimistic
  paint();
  try { V.entries.set(id, await store.saveEntry(id, { ...meta(id, prev), ...patch })); }
  catch (e) { if (prev) V.entries.set(id, prev); else V.entries.delete(id); if (CTX.toast) CTX.toast("השינוי לא נשמר"); }
  paint();
}

function shareUrl(slug) { return location.origin + location.pathname + "#u=" + slug; }
async function copyShare(slug) {
  const url = shareUrl(slug);
  const ok = CTX.copy ? await CTX.copy(url) : false;
  if (CTX.toast) CTX.toast(ok ? "הקישור לשיתוף הועתק. מי שיפתח אותו יראה את הרשימות שלך, בלי אפשרות לשנות." : "זה הקישור לשיתוף. העתיקו אותו ושלחו למי שתרצו.", url);
}

async function onClick(ev) {
  const el = ev.target.closest("[data-a]"); if (!el || !ROOT.contains(el)) return;
  const a = el.dataset.a, v = el.dataset.v, id = el.dataset.id !== undefined ? +el.dataset.id : null;
  try {
    switch (a) {
      case "mretry": V = { loading: true }; paint(); CTX.share ? loadShared() : load(); break;
      case "signin-google": { const { auth } = await loadMods(); await auth.signInGoogle(); break; }
      case "signin-email-open": V.emailOpen = true; paint(); { const f = ROOT.querySelector("#mine-email"); if (f) f.focus(); } break;
      case "signout": { const { auth } = await loadMods(); await auth.signOut(); knownUid = null; V = { user: null }; paint(); break; }
      case "rename": V.naming = true; paint(); { const f = ROOT.querySelector("#mine-name"); if (f) { f.focus(); f.select(); } } break;
      case "rename-cancel": V.naming = false; paint(); break;
      case "seensort": V.seenSort = V.seenSort === "date" ? "rating" : "date"; paint(); break;
      case "plus": {
        const e = V.entries.get(id); if (!e) break;
        const n = nextEpisode({ season: e.season || 1, episode: e.episode || 0 }, seriesOf(id) || {});
        if (n.last) { V.prompt = id; paint(); break; }
        await save(id, { status: "watching", season: n.season, episode: n.episode });
        break;
      }
      case "rate": V.prompt = null; await save(id, { status: "seen", rating: +v || null }); break;
      case "rate-cancel": V.prompt = null; paint(); break;
      case "share": {
        const { store } = await loadMods();
        if (v === "copy") { await copyShare(V.profile.share_slug); break; }
        const slug = await store.setShare(v === "on");
        V.profile = { ...V.profile, share_slug: slug };
        paint();
        if (slug) await copyShare(slug);
        else if (CTX.toast) CTX.toast("הקישור לשיתוף כובה. מי שקיבל אותו כבר לא יראה את הרשימות.");
        break;
      }
    }
  } catch (e) {
    if (CTX.toast) CTX.toast(ACCOUNT_DOWN);
  }
}

async function saveName(f) {
  const name = (f.querySelector("#mine-name").value || "").trim().slice(0, 40);
  if (!name) return;
  try {
    const { auth } = await loadMods();
    V.profile = await auth.setName(name);
    V.created = false; V.naming = false;
    paint();
  } catch (e) { if (CTX.toast) CTX.toast(ACCOUNT_DOWN); }
}

async function onSubmit(ev) {
  if (ev.target.closest("[data-f=name]")) { ev.preventDefault(); return saveName(ev.target.closest("[data-f=name]")); }
  const f = ev.target.closest("[data-f=signin-email]"); if (!f) return;
  ev.preventDefault();
  const email = (f.querySelector("#mine-email").value || "").trim();
  if (!email) return;
  V.email = email;
  try {
    const { auth } = await loadMods();
    await auth.signInEmail(email);
    V.msg = `שלחנו קישור כניסה ל-${email}. פתחו אותו במכשיר הזה.`;
    V.emailOpen = false;
  } catch (e) { V.msg = ACCOUNT_DOWN; }
  paint();
}

if (typeof window !== "undefined") {
  // store.js dropped the failed rows from its map; reload so the lists match the server.
  window.addEventListener("bingology:write-failed", () => { if (ROOT && ROOT.isConnected && !CTX.share && V.user) load(); });
}

/**
 * ctx: {S, storage, pace, share (slug|null), localSeen() -> number, toast(msg, url?), copy(text) -> Promise<bool>}
 * Paints cached state at once (app.js re-renders the whole page often), then refreshes.
 */
export async function mountMine(root, ctx) {
  const modeChanged = !CTX || !!CTX.share !== !!ctx.share || (ctx.share && CTX.share !== ctx.share);
  ROOT = root; CTX = ctx;
  if (modeChanged) V = { loading: true };
  needFocus = true;
  root.addEventListener("click", onClick);
  root.addEventListener("submit", onSubmit);
  paint();
  await (ctx.share ? loadShared() : load());
}

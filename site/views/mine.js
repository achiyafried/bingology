// The "שלי" tab: profile, lists, sign-in and the read-only share view.
// Loaded by app.js with import() only. Account modules are imported on demand inside mountMine,
// so a broken CDN or Supabase outage shows one box here and nothing else on the site changes.
import { esc, safeImg } from "../lib/esc.js";
import { nextEpisode, progress } from "../lib/progress.js";
import { pickPartner, jointPick } from "../lib/jointpick.js";

export const ACCOUNT_DOWN = "לא הצלחנו להתחבר לחשבון. נסו שוב בעוד רגע";
export const BAD_INVITE = "הקישור לא תקין או שפג תוקפו";
const PACE = 2;
const FEED_N = 20;
const BUSY = new Set(["seen", "watching", "dropped"]);

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
    ${st.joinWait ? `<p class="fine">אחרי הכניסה נצרף אתכם למעגל שהוזמנתם אליו.</p>` : ""}
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

/* ── the circle ── */

/** "א", "א וב", "א, ב וג" (items already escaped). */
const andList = xs => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " ו" + xs[xs.length - 1];

/** Relative time in Hebrew, for the feed. */
export function ago(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const m = Math.max(0, Math.floor((now - t) / 60e3)), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (m < 1) return "עכשיו";
  if (m < 60) return m === 1 ? "לפני דקה" : `לפני ${m} דקות`;
  if (h < 24) return h === 1 ? "לפני שעה" : h === 2 ? "לפני שעתיים" : `לפני ${h} שעות`;
  if (d < 2) return "אתמול";
  if (d === 2) return "לפני יומיים";
  if (d < 7) return `לפני ${d} ימים`;
  return new Date(t).toLocaleDateString("he-IL", { day: "numeric", month: "long" });
}

const faceOf = (members, uid) => {
  const k = members.findIndex(m => m.id === uid);
  const m = members[k];
  return `<span class="face f${(Math.max(0, k) % 4) + 1}" aria-hidden="true">${initial(m ? m.name : "?")}</span>`;
};

function feedLine(ev, who, t) {
  const n = ev.rating ? +ev.rating : null;
  switch (ev.kind) {
    case "rated": return `${who}: ציון ${n} ל-${t}`;
    case "finished": return `${who}: סיום של ${t}${n ? ` · ${n}` : ""}`;
    case "started": return `${who}: התחלה של ${t}`;
    case "wanted": return `${who}: רוצה לראות את ${t}`;
    case "dropped": return `${who}: נטישה של ${t}${ev.season ? ` בעונה ${+ev.season}` : ""}`;
    default: return "";
  }
}

/** The 20 newest events; a 'rated' that came with the same 'finished' write is folded into it. */
function feedHTML(st, members) {
  const idx = indexById(st.S);
  const evs = (st.feed || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || (b.id || 0) - (a.id || 0)).slice(0, FEED_N);
  const twin = r => evs.some(f => f.kind === "finished" && f.user_id === r.user_id && f.tmdb_id === r.tmdb_id && f.rating === r.rating
    && Math.abs(Date.parse(f.created_at) - Date.parse(r.created_at)) < 60e3);
  const rows = evs.filter(e => !(e.kind === "rated" && twin(e))).map(e => {
    const m = members.find(x => x.id === e.user_id);
    const i = idx.get(e.tmdb_id);
    const title = i !== undefined ? st.S[i].n : (st.titles && st.titles.get(e.tmdb_id)) || "סדרה";
    const line = feedLine(e, `<bdi>${esc(m ? m.name : "")}</bdi>`, `<bdi>${esc(title)}</bdi>`);
    return line ? `<div class="it fe">${faceOf(members, e.user_id)}<div class="i"><b>${line}</b><small>${ago(e.created_at, st.now)}</small></div></div>` : "";
  }).join("");
  return rows ? `<div class="sh"><h3>מה קורה במעגל</h3></div><div class="card feed">${rows}</div>` : "";
}

function jointHTML(st, members) {
  const p = st.pick; if (!p) return "";
  const idx = indexById(st.S), i = idx.get(p.tmdbId);
  if (i === undefined) return "";
  const s = st.S[i];
  const me = members.find(m => m.id === st.user.id), them = members.find(m => m.id === p.partner);
  const pair = `<bdi>${esc(me ? me.name : "")}</bdi> ו<bdi>${esc(them ? them.name : "")}</bdi>`;
  const k = p.mode === "fallback" ? `אף אחד במעגל עוד לא ראה · הצעה ל${pair}` : `בינג׳ משותף · ${pair}`;
  const why = p.mode === "fallback" ? "" : p.mode === "yes" ? `<p><bdi>${esc(them ? them.name : "")}</bdi> כבר רואה. מצטרפים?</p>` : `<p>אף אחד מכם לא ראה · שניכם רוצים</p>`;
  const ev = progress({ season: 1, episode: 0 }, s, st.pace || PACE).eveningsLeft;
  const facts = [ev ? (ev === 1 ? "ערב אחד" : `${ev} ערבים`) : "", s.bs != null ? `בינג׳ ${Math.round(s.bs)}` : ""].filter(Boolean).join(" · ");
  const src = safeImg(s.poster);
  return `<div class="joint"><div class="k">${k}</div>
    <div class="t">${src ? `<img src="${src}" alt="" loading="lazy">` : ""}<div><h3><button class="ttl" data-a="detail" data-i="${i}"><bdi>${esc(s.n)}</bdi></button></h3>${why}${facts ? `<p>${facts}</p>` : ""}</div></div>
    <div class="row2"><button class="btn primary" data-a="pick-yes" data-id="${s.tmdbId}">יאללה</button><button class="btn ghost" data-a="pick-skip" data-id="${s.tmdbId}">הצעה אחרת</button></div></div>`;
}

function circleHTML(st) {
  if (st.circleErr) return `<div class="sh"><h3>המעגל</h3></div><div class="empty"><p>${ACCOUNT_DOWN}</p><button class="btn ghost" data-a="mretry">נסו שוב</button></div>`;
  if (st.circle === undefined) return "";
  if (!st.circle) {
    const form = st.joinOpen ? `<form class="joinf" data-f="join"><label for="mine-join">הדביקו את קישור ההזמנה שקיבלתם</label>
      <input class="search" id="mine-join" type="text" dir="ltr" required autocomplete="off" placeholder="https://…#join=…">
      <button class="btn primary" type="submit">הצטרפות</button></form>` : "";
    return `<div class="sh"><h3>המעגל</h3></div><div class="card circle0">
      <p>מעגל הוא כמה חברים שרואים מה כל אחד ראה ורוצה לראות, ומקבלים הצעה לבינג׳ משותף.</p>
      <div class="row2"><button class="btn primary" data-a="circle-create">פתחו מעגל</button><button class="btn ghost" data-a="circle-have" aria-expanded="${!!st.joinOpen}">יש לי קישור הזמנה</button></div>${form}</div>`;
  }
  const members = st.circle.members || [];
  const faces = `<div class="faces">${members.map(m => `<span class="face f${(members.indexOf(m) % 4) + 1}" title="${esc(m.name)}">${initial(m.name)}</span>`).join("")}</div>`;
  const alone = members.filter(m => m.id !== st.user.id).length === 0;
  return `<div class="sh"><h3>המעגל</h3>${faces}</div>
    ${alone ? `<div class="card circle0"><p>עוד אין אף אחד במעגל. שלחו לחברים קישור הזמנה.</p></div>` : jointHTML(st, members)}
    ${feedHTML(st, members)}
    <div class="invite"><button class="btn ghost block" data-a="circle-invite">הזמנת חבר למעגל</button><button class="linkbtn" data-a="circle-leave">עזיבת המעגל</button></div>`;
}

function confirmHTML(c) {
  const names = andList((c.names || []).map(n => `<bdi>${esc(n)}</bdi>`));
  const where = names ? `אתם כבר במעגל עם ${names}.` : "אתם כבר במעגל אחר.";
  const [q, yes, no] = c.kind === "join" ? [`${where} לעבור?`, "לעבור", "להישאר"]
    : c.kind === "create" ? [`${where} לפתוח מעגל חדש?`, "לפתוח מעגל חדש", "ביטול"]
    : ["לעזוב את המעגל? החברים יפסיקו לראות את הרשימות שלך, ואת שלהם כבר לא תראו.", "לעזוב", "ביטול"];
  return `<div class="confirm" role="group" aria-labelledby="mine-cq"><p id="mine-cq">${q}</p>
    <div class="row2"><button class="btn primary" data-a="confirm-yes">${yes}</button><button class="btn ghost" data-a="confirm-no">${no}</button></div></div>`;
}

function noticeHTML(msg) {
  return `<div class="confirm notice" role="status"><p>${esc(msg)}</p><button class="linkbtn" data-a="notice-x">סגירה</button></div>`;
}

export function unavailableHTML() {
  return `<div class="empty"><p>${ACCOUNT_DOWN}</p><button class="btn primary" data-a="mretry">נסו שוב</button></div>`;
}

/**
 * state: {user, profile, created, naming, entries, S, scores, localSeen, pace, prompt, seenSort, emailOpen, msg, loading, error,
 *   circle: undefined (loading) | null (none) | {id, invite_code, members}, feed: Event[], pick: {tmdbId, mode, partner} | null,
 *   titles: Map<tmdbId, title>, confirm: {kind: 'join'|'create'|'leave', names}, notice, joinOpen, joinWait, circleErr, now}
 */
export function mineHTML(state) {
  const st = state || {};
  if (st.error) return unavailableHTML();
  if (st.loading) return `<div class="empty loading" role="status"><p>טוענים את הבינג׳ים שלך…</p></div>`;
  if (!st.user) return signinHTML(st);
  const name = (st.profile && st.profile.name) || st.user.name || "";
  const slug = st.profile && st.profile.share_slug;
  const others = st.circle && st.circle.members ? st.circle.members.filter(m => m.id !== st.user.id) : [];
  const circle = others.length ? `<small>במעגל עם ${andList(others.map(m => `<bdi>${esc(m.name)}</bdi>`))}</small>` : "";
  const share = slug
    ? `<div class="shared"><span>הקישור לשיתוף פעיל</span><button class="linkbtn" data-a="share" data-v="copy">העתקה</button><button class="linkbtn" data-a="share" data-v="off">כיבוי</button></div>`
    : "";
  return `<section class="mine">
    <div class="me"><span class="av" aria-hidden="true">${initial(name)}</span>
      <div class="who"><h2 data-focus tabindex="-1">הבינג׳ים של ${esc(name)}</h2>${circle}${st.created || st.naming ? "" : `<button class="linkbtn rename" data-a="rename">שינוי שם</button>`}</div>
      ${slug ? "" : `<button class="btn ghost" data-a="share" data-v="on">שיתוף</button>`}</div>
    ${st.created || st.naming ? nameStepHTML(st, name) : ""}
    ${st.confirm ? confirmHTML(st.confirm) : st.notice ? noticeHTML(st.notice) : ""}
    ${share}
    ${listsHTML(rowsOf(st.entries), st.S, st, false)}
    ${circleHTML(st)}
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
let wantTop = false; // focus the confirm/notice box on each paint until the user acts
let knownUid; // undefined until the first load resolves the session; then the user id or null

const loadMods = async () => mod || (mod = await Promise.all([import("../lib/account/auth.js"), import("../lib/account/store.js"), import("../lib/account/circle.js")])
  .then(([auth, store, circle]) => ({ auth, store, circle }))
  .catch(e => { mod = null; throw e; }));

function paint() {
  if (!ROOT || !ROOT.isConnected) return;
  ROOT.innerHTML = CTX.share ? (V.sharedErr ? unavailableHTML() : V.shared === undefined ? mineHTML({ loading: true }) : sharedHTML(V.shared, CTX.S))
    : mineHTML({ ...V, S: CTX.S, pace: CTX.pace || PACE, localSeen: CTX.localSeen ? CTX.localSeen() : 0, joinWait: !V.user && !!pendingJoin(), now: Date.now() });
  // First content paint after a mount: move focus to the tab's heading (the loading box has none).
  const h = needFocus && ROOT.querySelector("[data-focus]");
  if (h) { needFocus = false; h.focus({ preventScroll: true }); }
  placeTop();
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
    const same = V.user && V.user.id === user.id;
    const fallback = user.name || (user.email || "").split("@")[0];
    const { profile, created } = await auth.ensureProfile(fallback);
    if (CTX.storage) { try { await store.migrateLocal(CTX.storage, CTX.S); } catch (e) { /* retried on the next load */ } }
    const entries = await store.loadMine();
    if (my !== seq) return;
    // created stays true until the name is saved, so a remount keeps showing the name step.
    const keep = same ? { naming: V.naming, prompt: V.prompt, seenSort: V.seenSort, confirm: V.confirm, notice: V.notice, joinOpen: V.joinOpen,
      circle: V.circle, cs: V.cs, feed: V.feed, titles: V.titles, pick: V.pick, skipLocal: V.skipLocal } : {};
    V = { ...keep, user, profile, entries, created: created || (V.created && same) };
  } catch (e) {
    if (my !== seq) return;
    V = { error: true };
    return paint();
  }
  paint();
  const code = pendingJoin();
  if (code) await doJoin(code, false);
  await refreshCircle();
}

/* ── circle: invite links, loading, joint pick ── */

const JOIN_KEY = "bingology:join";
export const JOIN_TTL = 7 * 86400e3; // a pending invite older than this is dropped
const ls = () => { try { return localStorage; } catch (e) { return null; } };
/** The stored invite code ({code, at} JSON) if it is younger than JOIN_TTL; otherwise null. */
export function readJoin(raw, now = Date.now()) {
  try {
    const j = JSON.parse(raw);
    return j && typeof j.code === "string" && j.code && Number.isFinite(j.at) && now - j.at < JOIN_TTL ? j.code : null;
  } catch (e) { return null; }
}
function pendingJoin() {
  try {
    const s = ls(), raw = s && s.getItem(JOIN_KEY);
    if (!raw) return null;
    const code = readJoin(raw);
    if (!code) s.removeItem(JOIN_KEY); // expired or malformed
    return code;
  } catch (e) { return null; }
}
function setJoin(code) { try { const s = ls(); if (s) code ? s.setItem(JOIN_KEY, JSON.stringify({ code, at: Date.now() })) : s.removeItem(JOIN_KEY); } catch (e) { /* storage unavailable */ } }
/** The code from a pasted invite link (…#join=<code>) or a bare code; null when it is neither. */
function codeFrom(text) {
  const t = String(text || "").trim();
  const m = /#join=([^&\s#]+)/.exec(t) || /^([A-Za-z0-9]{4,64})$/.exec(t);
  if (!m) return null;
  try { return decodeURIComponent(m[1]).slice(0, 64); } catch (e) { return null; }
}

async function refreshCircle() {
  if (!V.user) return;
  const uid = V.user.id;
  try {
    const { circle } = await loadMods();
    const cs = await circle.loadCircle();
    if (!V.user || V.user.id !== uid) return;
    const titles = new Map();
    for (const rows of cs.rows.values()) for (const [id, e] of rows) if (e.title) titles.set(id, e.title);
    Object.assign(V, { cs, circle: cs.circle ? { ...cs.circle, members: cs.members } : null, feed: cs.feed, titles, circleErr: false });
    computePick();
  } catch (e) {
    if (V.user && V.user.id === uid) V.circleErr = true;
  }
  paint();
}

/**
 * The partner already said "יאללה" and is still watching it: offer that first, until I answer it
 * (I haven't voted on it, skipped it, or started / seen / dropped it). Returns a tmdbId or null.
 */
export function partnerYes({ votes, lists, me, partner, skipped, has }) {
  const mine = lists.get(me) || new Map(), theirs = lists.get(partner) || new Map();
  const v = votes.find(v => v.vote === "yes" && v.user_id === partner && theirs.get(v.tmdb_id) === "watching"
    && !skipped.has(v.tmdb_id) && !BUSY.has(mine.get(v.tmdb_id)) && has(v.tmdb_id)
    && !votes.some(w => w.user_id === me && w.tmdb_id === v.tmdb_id));
  return v ? v.tmdb_id : null;
}

/** Me + the member I share the most "want" with; votes from either of us steer the pick. */
function computePick() {
  const cs = V.cs, me = V.user && V.user.id;
  V.pick = null;
  if (!cs || !cs.circle || !me) return;
  const lists = new Map(cs.lists);
  lists.set(me, new Map([...V.entries.values()].map(e => [e.tmdb_id, e.status])));
  const partner = pickPartner(me, lists);
  if (!partner) return;
  const skipped = new Set(V.skipLocal || []);
  for (const v of cs.votes) if (v.vote === "skip" && (v.user_id === me || v.user_id === partner)) skipped.add(v.tmdb_id);
  const yes = partnerYes({ votes: cs.votes, lists, me, partner, skipped, has: id => !!seriesOf(id) });
  if (yes !== null) { V.pick = { tmdbId: yes, mode: "yes", partner }; return; }
  const S = CTX.S || [];
  const p = jointPick(S, S.map(s => ({ score: s.bs })), lists, [me, partner], skipped);
  V.pick = p ? { ...p, partner } : null;
}

async function doJoin(code, force) {
  const { circle } = await loadMods();
  let r;
  try { r = await circle.joinCircle(code, force); }
  catch (e) { V.notice = ACCOUNT_DOWN; return paint(); } // keep the code: retried on the next load
  setJoin(null);
  V.confirm = null; V.joinOpen = false;
  if (r && r.error === "in_other_circle") V.confirm = { kind: "join", code, names: r.circle_names || [] };
  else if (r && r.ok) { V.notice = r.noop ? "אתם כבר במעגל הזה." : "הצטרפתם למעגל!"; V.skipLocal = new Set(); }
  else V.notice = BAD_INVITE;
  paint();
  focusTop();
}

async function doCreate() {
  const { circle } = await loadMods();
  await circle.createCircle();
  V.confirm = null; V.skipLocal = new Set();
  V.notice = "המעגל נפתח. עכשיו שלחו לחברים קישור הזמנה.";
  await refreshCircle();
}

async function invite() {
  const { circle } = await loadMods();
  const url = circle.inviteUrl(V.circle.invite_code);
  if (navigator.share) {
    try { await navigator.share({ title: "Bingology", text: "בואו למעגל שלי ב-Bingology", url }); return; }
    catch (e) { if (e && e.name === "AbortError") return; }
  }
  const ok = CTX.copy ? await CTX.copy(url) : false;
  if (CTX.toast) CTX.toast(ok ? "קישור ההזמנה הועתק. שלחו אותו למי שתרצו במעגל." : "זה קישור ההזמנה. העתיקו אותו ושלחו לחברים.", url);
}

/** Move focus to the confirm / notice box at the top (now and after the next repaints), so keyboard and screen-reader users meet it. */
function focusTop() { wantTop = true; placeTop(); }
function placeTop() {
  const b = wantTop && ROOT && ROOT.querySelector(".confirm button");
  if (!b) return;
  b.focus({ preventScroll: true });
  b.closest(".confirm").scrollIntoView({ block: "nearest" });
}

const seriesOf = id => { const S = CTX.S || []; return S.find(s => s.tmdbId === id) || null; };
const meta = (id, e) => { const s = seriesOf(id); return { title: s ? s.n : e && e.title, poster: s ? s.poster ?? null : (e && e.poster) ?? null }; };

async function save(id, patch) {
  const { store } = await loadMods();
  const prev = V.entries.get(id);
  V.entries.set(id, { ...prev, ...patch, tmdb_id: id }); // optimistic
  paint();
  try {
    const row = await store.saveEntry(id, { ...meta(id, prev), ...patch });
    V.entries.set(id, row);
    if (CTX.onSeen) CTX.onSeen(id, row.status === "seen" || row.status === "dropped");
  }
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
  wantTop = false;
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
      case "circle-have": V.joinOpen = !V.joinOpen; paint(); { const f = ROOT.querySelector("#mine-join"); if (f) f.focus(); } break;
      case "circle-create": {
        const { circle } = await loadMods();
        const cs = await circle.loadCircle(); // fresh: another device may have joined a circle meanwhile
        if (cs.circle) { V.confirm = { kind: "create", names: cs.members.filter(m => m.id !== V.user.id).map(m => m.name) }; paint(); focusTop(); }
        else await doCreate();
        break;
      }
      case "circle-leave": V.confirm = { kind: "leave" }; paint(); focusTop(); break;
      case "circle-invite": await invite(); break;
      case "confirm-no": if (V.confirm && V.confirm.kind === "join") setJoin(null); V.confirm = null; paint(); break;
      case "confirm-yes": {
        const c = V.confirm; if (!c) break;
        if (c.kind === "join") { await doJoin(c.code, true); await refreshCircle(); }
        else if (c.kind === "create") await doCreate();
        else {
          const { circle } = await loadMods();
          await circle.leaveCircle();
          V.confirm = null; V.pick = null; V.skipLocal = new Set();
          V.notice = "עזבתם את המעגל. החברים כבר לא רואים את הרשימות שלך.";
          await refreshCircle();
        }
        break;
      }
      case "notice-x": V.notice = null; paint(); break;
      case "pick-skip": {
        (V.skipLocal = V.skipLocal || new Set()).add(id);
        computePick(); paint();
        const { circle } = await loadMods();
        circle.vote(id, "skip").catch(() => { if (CTX.toast) CTX.toast("השינוי לא נשמר"); });
        break;
      }
      case "pick-yes": {
        // RLS lets me write only my own row: the partner gets it on their own "יאללה".
        const { circle } = await loadMods();
        await circle.vote(id, "yes");
        if (V.cs) V.cs.votes.push({ tmdb_id: id, user_id: V.user.id, vote: "yes" });
        await save(id, { status: "watching", season: 1, episode: 1 });
        computePick(); paint();
        if (CTX.toast && (V.entries.get(id) || {}).status === "watching") CTX.toast("נוסף ל\"רואה עכשיו\". בהצלחה!");
        break;
      }
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
  const jf = ev.target.closest("[data-f=join]");
  if (jf) {
    ev.preventDefault();
    const code = codeFrom(jf.querySelector("#mine-join").value);
    if (!code) { V.notice = BAD_INVITE; paint(); return focusTop(); }
    try { await doJoin(code, false); await refreshCircle(); } catch (e) { if (CTX.toast) CTX.toast(ACCOUNT_DOWN); }
    return;
  }
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
 * ctx: {S, storage, pace, share (slug|null), join (invite code from #join=|null), localSeen() -> number,
 *   toast(msg, url?), copy(text) -> Promise<bool>, onSeen(tmdbId, seenOrDropped)}
 * Paints cached state at once (app.js re-renders the whole page often), then refreshes.
 */
export async function mountMine(root, ctx) {
  if (ctx.join) { setJoin(String(ctx.join).slice(0, 64)); history.replaceState(null, "", location.pathname + location.search); }
  const modeChanged = !CTX || !!CTX.share !== !!ctx.share || (ctx.share && CTX.share !== ctx.share);
  ROOT = root; CTX = ctx;
  if (modeChanged) V = { loading: true };
  needFocus = true;
  root.addEventListener("click", onClick);
  root.addEventListener("submit", onSubmit);
  paint();
  await (ctx.share ? loadShared() : load());
}

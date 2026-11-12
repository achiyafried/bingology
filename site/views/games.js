// The "משחקים" area (#games). Loaded by app.js with import() only, when the games tab opens.
// Rendering lives here; game rules are in site/lib/games/ (pure, no DOM).
import { esc, safeImg } from "../lib/esc.js";
import { searchSeries } from "../lib/search.js";
import { hebKey, latKey, keyMatch } from "../lib/phonetic.js";
import { GAMES, loadGamesDay } from "../lib/games/day.js";
import { loadDay, saveDay, loadPractice, savePractice, markComplete, streak as streakOf, prune, saveTotal } from "../lib/games/store.js";
import { shareText } from "../lib/games/share.js";
import * as guess from "../lib/games/guess.js";
import * as odd from "../lib/games/odd.js";
import * as chain from "../lib/games/chain.js";
import * as groups from "../lib/games/groups.js";
import * as blur from "../lib/games/blur.js";

const LOGIC = { guess, odd, chain, groups, blur };
// A stored state of the wrong shape (old or edited by hand) starts the game over instead of breaking it.
const SHAPE = {
  guess: s => Array.isArray(s.guesses),
  odd: s => Array.isArray(s.picks),
  chain: s => Array.isArray(s.path) && s.path.length > 0 && Array.isArray(s.via) && Number.isInteger(s.steps) && (s.hinted === undefined || typeof s.hinted === "boolean"),
  groups: s => Array.isArray(s.solved) && Array.isArray(s.tried) && Number.isInteger(s.mistakes),
  blur: s => Array.isArray(s.guesses),
};
const GUESS_MAX = 6, BLUR_MAX = 5, SUG = 8;

const valid = (id, s) => !!s && typeof s === "object" && typeof s.done === "boolean" && SHAPE[id](s);
const stateOf = (id, puzzle, states) => (valid(id, states[id]) ? states[id] : LOGIC[id].init(puzzle));
const available = day => GAMES.filter(g => day.games && day.games[g.id]);
const allDone = (day, states) => available(day).length > 0 && available(day).every(g => stateOf(g.id, day.games[g.id], states).done);
const dm = date => { const [, m, d] = date.split("-").map(Number); return `${d}.${m}`; };
const labelOf = (id, day, states) => LOGIC[id].result(stateOf(id, day.games[id], states), day.games[id]).label;
const results = (day, states) => available(day).filter(g => stateOf(g.id, day.games[g.id], states).done).map(g => ({ id: g.id, label: labelOf(g.id, day, states) }));

function initials(n) {
  const parts = String(n || "").split(" ").filter(Boolean);
  if (!parts.length) return "";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** A series card: poster when it passes safeImg, otherwise the name alone. `attrs` makes it a button. */
function seriesCard(c, attrs, cls) {
  const img = safeImg(c && c.poster);
  const inner = `${img ? `<img src="${img}" alt="" loading="lazy">` : ""}<span><bdi>${esc(c && c.name)}</bdi></span>`;
  const k = `g-s${img ? "" : " noimg"}${cls ? " " + cls : ""}`;
  return attrs ? `<button type="button" ${attrs} class="${k}">${inner}</button>` : `<div class="${k}">${inner}</div>`;
}
function actorBadge(a) {
  const img = safeImg(a && a.photo);
  return `<span class="g-av" aria-hidden="true">${esc(initials(a && a.name))}${img ? `<img src="${img}" alt="" loading="lazy">` : ""}</span>`;
}
const seriesBtn = (id, has) => (has && has(id) ? `<button type="button" class="btn ghost" data-gs="${esc(id)}">לפרטי הסדרה</button>` : "");
const actorBtn = (name, has) => (has && has(name) ? `<button type="button" class="btn ghost" data-ga="${esc(name)}">לפרטי השחקן</button>` : "");
const input = (label, ph) => `<div class="g-input"><input id="gq" class="search" type="search" dir="auto" placeholder="${ph}" aria-label="${label}" autocomplete="off" aria-controls="gsug"><div id="gsug" class="g-sug" aria-live="polite"></div></div>`;

/** Suggestions under the guess input: [{ v, label }]. */
export function sugHTML(list) {
  return list.map(o => `<button type="button" class="g-opt" data-gpick="${esc(o.v)}"><bdi>${esc(o.label)}</bdi></button>`).join("");
}

/* hub and summary */
/** The hub: date and streak, then the summary once every available game is done, then one card per available game. */
export function hubHTML(day, states, streak, opts = {}) {
  const head = `<div class="g-head"><h2 data-focus tabindex="-1">${opts.practice ? "תרגול" : "המשחקים של היום"}</h2><span class="g-date">${dm(day.date)}${!opts.practice && streak > 0 ? ` · רצף ${streak} 🔥` : ""}</span></div>`
    + (opts.practice ? `<p class="note g-pnote">המשחקים של אתמול. התוצאות לא נספרות ברצף.</p>` : "");
  const cards = available(day).map(g => {
    const raw = states[g.id], s = valid(g.id, raw) ? raw : null;
    const st = !s ? "לשחק" : !s.done ? "בתהליך" : `סיים · <bdi>${esc(labelOf(g.id, day, states))}</bdi>`;
    return `<button type="button" class="g-card${s && s.done ? " done" : s ? " on" : ""}" data-g="${g.id}"><span class="g-ic" aria-hidden="true">${g.icon}</span><span class="g-nm">${g.name}</span><span class="g-st">${st}</span></button>`;
  }).join("");
  return `${head}${allDone(day, states) ? summaryHTML(day, states, streak, opts) : ""}<div class="g-cards">${cards}</div>`;
}

export function summaryHTML(day, states, streak, opts = {}) {
  const text = shareText({ date: day.date, streak: opts.practice ? 0 : streak, results: results(day, states) });
  return `<div class="g-sum"><h3>${opts.practice ? "סיימתם את התרגול" : "סיימתם להיום"}</h3>
  ${!opts.practice && streak > 0 ? `<p class="g-streak">רצף ${streak} 🔥</p>` : ""}
  <pre class="g-share" dir="auto">${esc(text)}</pre>
  ${opts.practice ? "" : `<button type="button" class="btn primary block" data-gshare>שיתוף</button>`}</div>`;
}

/** One-line "how to play" under the game's title. */
export function howHTML(id, p) {
  const name = k => `<bdi>${esc(p && p.series && p.series[String(k)] && p.series[String(k)].name)}</bdi>`;
  const text = {
    guess: () => "נחשו את הסדרה. כל טעות חושפת רמז נוסף. יש 6 ניסיונות.",
    odd: () => "בכל סיבוב: שלוש מהסדרות הן של השחקן/ית, אחת מתחזה. מצאו אותה.",
    chain: () => `המטרה: להגיע מ-${name(p.from)} ל-${name(p.to)}. בכל צעד בוחרים שחקן/ית מהסדרה שאתם בה, ועוברים לסדרה אחרת שהוא/היא שיחקו בה.`,
    groups: () => "שבצו את 16 הסדרות לארבע הקבוצות שלמעלה. בחרו 4 ולחצו שליחה. מותר לטעות 4 פעמים.",
    blur: () => "מי השחקן/ית? כל טעות מחדדת את התמונה וחושפת רמז. יש 5 ניסיונות.",
  }[id];
  return text ? `<p class="g-how">${text()}</p>` : "";
}

/* game screens: (puzzle, state, extra) → HTML */
export function guessHTML(p, s, x = {}) {
  const nameOf = x.nameOf || (id => "#" + id);
  const r = guess.result(s, p);
  const clues = p.clues.slice(0, guess.revealed(s)).map((c, i) => {
    const img = c.kind === "poster" && safeImg(c.img);
    const body = c.kind === "poster" ? (img ? `<img class="g-clueimg" src="${img}" alt="פוסטר מטושטש" style="filter: blur(${s.done ? 0 : 12}px)">` : "<span>הפוסטר לא זמין</span>") : `<span>${esc(c.text)}</span>`;
    return `<li><b>רמז ${i + 1}</b>${body}</li>`;
  }).join("");
  const tried = s.guesses.map(id => `<li class="${String(id) === String(p.answer.id) ? "ok" : "no"}"><bdi>${esc(nameOf(id))}</bdi></li>`).join("");
  const end = s.done ? `<div class="g-end"><p class="g-res">${r.win ? `ניחשתם ב-${r.score} ניסיונות` : "לא הפעם. התשובה:"}</p>${seriesCard(p.answer)}${seriesBtn(p.answer.id, x.hasSeries)}</div>` : "";
  return `<p class="g-count">${s.guesses.length}/${GUESS_MAX} ניחושים</p>
  <ol class="g-clues">${clues}</ol>
  ${tried ? `<ul class="g-tried" aria-label="ניחושים">${tried}</ul>` : ""}
  ${s.done ? end : input("ניחוש סדרה", "שם הסדרה, באנגלית או בעברית")}`;
}

export function oddHTML(p, s, x = {}) {
  const last = p.rounds.length - 1;
  const shown = x.reveal != null ? x.reveal : s.done ? null : odd.round(s);
  if (shown == null) {
    const r = odd.result(s, p);
    const rows = p.rounds.map((rd, i) => {
      const hit = s.picks[i] === rd.odd;
      return `<li class="${hit ? "ok" : "no"}">${actorBadge(rd.actor)}<span class="g-rinfo"><b><bdi>${esc(rd.actor.name)}</bdi></b><small>המתחזה: <bdi>${esc(rd.series[rd.odd] && rd.series[rd.odd].name)}</bdi> ${hit ? "✓" : "✗"}</small></span>${actorBtn(rd.actor.name, x.hasActor)}</li>`;
    }).join("");
    return `<div class="g-end"><p class="g-res">${r.score} מתוך ${p.rounds.length} נכונות</p><ul class="g-rounds">${rows}</ul></div>`;
  }
  const rd = p.rounds[shown], picked = x.reveal != null ? s.picks[shown] : null;
  const cards = rd.series.map((c, i) => seriesCard(c, `data-gi="${i}"${picked != null ? " disabled" : ""}`,
    picked == null ? "" : i === rd.odd ? "is-odd" : i === picked ? "is-wrong" : "")).join("");
  const after = picked == null ? "" : `<p class="g-res" role="status">${picked === rd.odd ? "נכון!" : "לא הפעם. המתחזה מסומנת."}</p><button type="button" class="btn primary block" data-gnext>${shown >= last ? "לתוצאה" : "לסיבוב הבא"}</button>`;
  return `<p class="g-count">סיבוב ${shown + 1} מתוך ${p.rounds.length}</p>
  <div class="g-actor">${actorBadge(rd.actor)}<b><bdi>${esc(rd.actor.name)}</bdi></b></div>
  <p class="g-ask">באיזו סדרה לא שיחק/ה?</p>
  <div class="g-four">${cards}</div>${after}`;
}

/** Shortest route in the puzzle's subgraph: [{ id, via }] from `start` (default p.from) to `to` (via = actor into that series), or null. */
export function chainRoute(p, start = p.from) {
  const ids = Object.keys(p.series), from = String(start), to = String(p.to);
  if (!p.series[from]) return null;
  const prev = new Map([[from, null]]), q = [from];
  while (q.length && !prev.has(to)) {
    const c = q.shift();
    for (const a of p.series[c].cast) for (const o of ids) {
      if (!prev.has(o) && p.series[o].cast.includes(a)) { prev.set(o, { from: c, via: a }); q.push(o); }
    }
  }
  if (!prev.has(to)) return null;
  const out = [];
  for (let k = to; k != null; k = prev.get(k) && prev.get(k).from) out.unshift({ id: k, via: prev.get(k) ? prev.get(k).via : null });
  return out;
}
const others = (p, cur, actor) => Object.keys(p.series).filter(k => k !== String(cur) && p.series[k].cast.includes(actor));
const routeHTML = (p, path, via) => `<ol class="g-path">${path.map((id, i) => `${i ? `<li class="g-via">דרך <bdi>${esc(via[i - 1])}</bdi></li>` : ""}<li class="g-node${String(id) === String(p.to) ? " end" : ""}"><bdi>${esc(p.series[String(id)] && p.series[String(id)].name)}</bdi></li>`).join("")}</ol>`;

export function chainHTML(p, s, x = {}) {
  const ser = id => ({ id, ...p.series[String(id)] });
  const cur = s.path[s.path.length - 1], r = chain.result(s, p);
  const end = (label, id) => `<div class="g-pt"><span class="g-lbl">${label}</span>${seriesCard(ser(id))}</div>`;
  const head = `<div class="g-ends">${end("התחלה", p.from)}<span class="g-arrow" aria-hidden="true">←</span>${end("יעד", p.to)}</div>
  <p class="g-count">נשארו ${p.limit - s.steps} צעדים · אפשר ב-${p.shortest}</p>${routeHTML(p, s.path, s.via)}`;
  if (s.done) {
    const best = r.label === "מושלם" ? null : chainRoute(p);
    return `${head}<div class="g-end"><p class="g-res">${r.win ? (r.label === "מושלם" ? "מושלם! המסלול הקצר ביותר" : "הגעתם!") : "נתקעתם הפעם"}</p>
    ${best ? `<p class="g-ask">מסלול קצר:</p>${routeHTML(p, best.map(b => b.id), best.slice(1).map(b => b.via))}` : ""}${seriesBtn(p.to, x.hasSeries)}</div>`;
  }
  const back = `<button type="button" class="btn ghost" data-gback${!x.actor && s.path.length < 2 ? " disabled" : ""}>${x.actor ? "ביטול" : "צעד אחורה"}</button>`;
  // A hint is shown for the series it was asked in (x.hint): the next hop of a shortest route from there.
  const shown = s.hinted && x.hint != null && String(x.hint) === String(cur);
  const next = shown ? (chainRoute(p, cur) || [])[1] : null;
  if (x.actor) {
    const list = others(p, cur, x.actor).map(k => seriesCard(ser(k), `data-gto="${esc(k)}"`, next && next.via === x.actor && next.id === k ? "is-hint" : "")).join("");
    return `${head}<p class="g-ask">לאיזו סדרה של <bdi>${esc(x.actor)}</bdi>?</p><div class="g-four">${list}</div><div class="g-acts">${back}</div>`;
  }
  const names = p.series[String(cur)] ? p.series[String(cur)].cast : [];
  const go = names.filter(a => others(p, cur, a).length);
  const cast = [...go, ...names.filter(a => !go.includes(a))].map(a =>
    `<button type="button" class="chip${next && next.via === a ? " is-hint" : ""}" data-gact="${esc(a)}"${go.includes(a) ? "" : " disabled"}>${next && next.via === a ? `<span class="sr">רמז: </span>` : ""}<bdi>${esc(a)}</bdi></button>`).join("");
  const hint = `<button type="button" class="btn ghost" data-ghint${shown ? " disabled" : ""}>רמז</button>`;
  return `${head}<p class="g-ask">בחרו שחקן/ית מ-<bdi>${esc(p.series[String(cur)] && p.series[String(cur)].name)}</bdi></p><div class="chips g-cast">${cast}</div><div class="g-acts">${back}${hint}</div>`;
}

const FEEDBACK = { "one-away": "שלוש מתוך ארבע!", wrong: "לא נכון", repeat: "את הרביעייה הזו כבר ניסיתם" };
export function groupsHTML(p, s, x = {}) {
  const sel = new Set((x.sel || []).map(String));
  const byId = new Map(p.items.map(i => [String(i.id), i]));
  const order = s.done ? [...s.solved, ...p.groups.map((g, i) => i).filter(i => !s.solved.includes(i))] : s.solved;
  const solvedIds = new Set(s.solved.flatMap(i => p.groups[i].ids.map(String)));
  const grp = order.map(i => {
    const g = p.groups[i];
    const names = g.ids.map(id => { const it = byId.get(String(id)); const n = `<bdi>${esc(it ? it.name : id)}</bdi>`; return s.done && x.hasSeries && x.hasSeries(id) ? `<button type="button" class="nm" data-gs="${esc(id)}">${n}</button>` : n; }).join(", ");
    return `<div class="g-grp lv${Math.min(4, Math.max(1, g.level | 0))}${s.solved.includes(i) ? "" : " missed"}"><b>${esc(g.label)}</b><span>${names}</span></div>`;
  }).join("");
  const r = groups.result(s, p), left = 4 - s.mistakes;
  if (s.done) return `${grp}<div class="g-end"><p class="g-res">${r.win ? (s.mistakes ? `פתרתם עם ${r.label}` : "פתרתם בלי טעויות!") : "נגמרו הטעויות. הנה הקבוצות:"}</p></div>`;
  const labels = p.groups.map((g, i) => s.solved.includes(i)
    ? `<li class="lv${Math.min(4, Math.max(1, g.level | 0))} ok">✓ <bdi>${esc(g.label)}</bdi></li>`
    : `<li><bdi>${esc(g.label)}</bdi></li>`).join("");
  const tiles = p.items.filter(i => !solvedIds.has(String(i.id))).map(i =>
    `<button type="button" class="g-it" data-gid="${esc(i.id)}" aria-pressed="${sel.has(String(i.id))}"><bdi>${esc(i.name)}</bdi></button>`).join("");
  return `<ul class="g-labels" aria-label="הקבוצות">${labels}</ul>${grp}<div class="g-grid">${tiles}</div>
  <p class="g-count">נשארו ${left} טעויות <span class="g-dots" aria-hidden="true">${"●".repeat(left)}${"○".repeat(s.mistakes)}</span></p>
  <p class="g-msg" role="status">${FEEDBACK[s.last] || ""}</p>
  <div class="g-acts"><button type="button" class="btn primary" data-gsubmit${sel.size === 4 ? "" : " disabled"}>שליחה</button><button type="button" class="btn ghost" data-gclear${sel.size ? "" : " disabled"}>ניקוי</button></div>`;
}

export function blurHTML(p, s, x = {}) {
  const img = safeImg(p.actor.photo), r = blur.result(s, p);
  // Initials only when the photo fails (the error handler unhides them): while it loads they'd give the answer away.
  const photo = `<div class="g-photo"><span class="g-ini" aria-hidden="true"${img ? " hidden" : ""}>${esc(initials(p.actor.name))}</span>${img ? `<img src="${img}" alt="${s.done ? esc(p.actor.name) : "תמונה מטושטשת"}" style="filter: blur(${blur.blurPx(s)}px)">` : ""}</div>`;
  const hints = blur.hints(s, p).map(h => `<li><bdi>${esc(h)}</bdi></li>`).join("");
  const wrong = s.guesses.filter(g => g.trim().toLowerCase() !== p.actor.name.trim().toLowerCase()).map(g => `<li class="no"><bdi>${esc(g)}</bdi></li>`).join("");
  const end = `<div class="g-end"><p class="g-res">${r.win ? `ניחשתם ב-${r.score} ניסיונות` : "לא הפעם. זה היה:"}</p><p class="g-name"><bdi>${esc(p.actor.name)}</bdi></p>${actorBtn(p.actor.name, x.hasActor)}</div>`;
  return `${photo}<p class="g-count">${s.guesses.length}/${BLUR_MAX} ניחושים</p>
  ${hints ? `<ol class="g-clues g-hints">${hints}</ol>` : ""}
  ${wrong ? `<ul class="g-tried" aria-label="ניחושים">${wrong}</ul>` : ""}
  ${s.done ? end : input("ניחוש שחקן", "שם השחקן/ית, באנגלית או בעברית")}`;
}

const SCREEN = { guess: guessHTML, odd: oddHTML, chain: chainHTML, groups: groupsHTML, blur: blurHTML };

/* mount: one session per module load, kept across re-renders of the tab (app.js repaints on many actions) */
let ses = null, R = null, C = null, ACTS = null;

const storage = () => C.storage;
const hasSeries = id => C.S.some(x => String(x.tmdbId) === String(id));
const hasActor = n => C.actorNames.includes(n);
const nameOf = id => {
  const x = C.S.find(s => String(s.tmdbId) === String(id)), a = ses.day.games.guess && ses.day.games.guess.answer;
  return x ? x.n : a && String(a.id) === String(id) ? a.name : "#" + id;
};

function guessSug(q) {
  const p = ses.day.games.guess, s = stateOf("guess", p, ses.states);
  const out = searchSeries(C.S, q, SUG + s.guesses.length).filter(i => !s.guesses.some(g => String(g) === String(C.S[i].tmdbId)))
    .slice(0, SUG).map(i => ({ v: C.S[i].tmdbId, label: C.S[i].n }));
  // The answer may have left the series list since the file was made; it must stay guessable.
  if (!hasSeries(p.answer.id) && searchSeries([{ n: p.answer.name }], q).length) out.unshift({ v: p.answer.id, label: p.answer.name });
  return out.slice(0, SUG);
}
const actEntry = n => { const kw = /[֐-׿]/.test(n) ? hebKey(n) : latKey(n); return { n, l: n.toLowerCase(), kw, kf: kw.join("") }; };
/** Actor names by the actors tab's rules: text match first, then Hebrew pronunciation. */
function actorSug(q) {
  q = q.trim().toLowerCase();
  if (q.length < 2) return [];
  if (!ACTS) ACTS = C.actorNames.map(actEntry);
  const answer = ses.day.games.blur.actor.name;
  const list = hasActor(answer) ? ACTS : [...ACTS, actEntry(answer)]; // the answer may have left the actor list
  const heb = /[֐-׿]/.test(q), qk = heb ? hebKey(q) : [];
  return list.map(a => ({ a, r: a.l.startsWith(q) ? 0 : a.l.includes(q) ? 1 : heb && keyMatch(a, qk) ? 2 : 9 }))
    .filter(o => o.r < 9).sort((x, y) => x.r - y.r || x.a.n.localeCompare(y.a.n)).slice(0, SUG).map(o => ({ v: o.a.n, label: o.a.n }));
}

function streakNow() {
  if (ses.practice) return 0;
  return allDone(ses.day, ses.states) ? markComplete(storage(), ses.day.date) : streakOf(storage(), ses.today);
}

function paint(top) {
  if (!R || !R.isConnected) return;
  let h;
  if (ses.status === "loading") h = `<div class="empty loading" role="status"><p>טוענים את המשחקים…</p></div>`;
  else if (ses.status === "error") h = `<div class="empty"><h2 data-focus tabindex="-1">המשחקים לא נטענו</h2><p>בדקו את החיבור.</p><button type="button" class="btn primary" data-gretry>לנסות שוב</button></div>`;
  else if (ses.status === "version") h = `<div class="empty"><p data-focus tabindex="-1">המשחקים של היום לא זמינים, נסו לרענן</p></div>`;
  else if (ses.status === "missing") h = `<div class="empty"><h2 data-focus tabindex="-1">המשחקים של היום עוד בדרך</h2>${ses.practice ? `<p>בינתיים אפשר לשחק במשחקים של אתמול. התוצאות לא נספרות ברצף.</p><button type="button" class="btn primary" data-gpractice>תרגול</button>` : ""}</div>`;
  else if (ses.screen === "hub") {
    if (C.today() !== ses.today) { load(); return; } // midnight passed: today's file
    h = hubHTML(ses.day, ses.states, streakNow(), { practice: ses.practice });
  } else {
    const id = ses.screen, g = GAMES.find(x => x.id === id), p = ses.day.games[id];
    const x = { ...ses.ui, nameOf, hasSeries, hasActor };
    h = `<div class="g-top"><button type="button" class="linkbtn" data-ghub>חזרה למשחקים</button></div>
    <h2 class="g-title" data-focus tabindex="-1"><span aria-hidden="true">${g.icon}</span> ${g.name}</h2>${howHTML(id, p)}
    <div class="g-body g-${id}">${SCREEN[id](p, stateOf(id, p, ses.states), x)}</div>`;
  }
  const y = window.scrollY;
  R.innerHTML = `<section class="games">${h}</section>`;
  if (top) { window.scrollTo(0, 0); const f = R.querySelector("[data-focus]"); if (f) f.focus({ preventScroll: true }); }
  else window.scrollTo(0, y);
}

async function load() {
  const today = C.today();
  ses = { today, status: "loading" };
  paint(false);
  const r = await loadGamesDay(C.fetch, today);
  if (!ses || ses.today !== today || ses.status !== "loading") return;
  if (r.status === "ok") {
    ses = { today, status: "ok", day: r.day, practice: false, states: loadDay(storage(), r.day.date), screen: "hub", ui: {} };
    saveTotal(storage(), r.day.date, available(r.day).length);
  }
  else ses = { today, status: r.status, practice: r.status === "missing" ? r.practice : null };
  paint(true);
}

function startPractice() {
  const day = ses.practice;
  ses = { today: ses.today, status: "ok", day, practice: true, states: loadPractice(storage(), day.date), screen: "hub", ui: {} };
  paint(true);
}

/** Applies a move to the open game and saves. Returns the new state, or null when the move changed nothing. */
function move(m) {
  const id = ses.screen, p = ses.day.games[id], s0 = stateOf(id, p, ses.states), s1 = LOGIC[id].play(s0, p, m);
  if (s1 === s0) return null;
  ses.states = { ...ses.states, [id]: s1 };
  if (ses.practice) savePractice(storage(), ses.day.date, ses.states); else saveDay(storage(), ses.day.date, ses.states);
  if (!ses.practice && allDone(ses.day, ses.states)) markComplete(storage(), ses.day.date);
  return s1;
}

function focusInput() { const q = R.querySelector("#gq"); if (q) q.focus(); }
function pick(v) {
  if (ses.screen === "guess") move({ id: Number(v) });
  else if (ses.screen === "blur") move({ name: v });
  paint(false); focusInput();
}

async function share() {
  const text = shareText({ date: ses.day.date, streak: streakNow(), results: results(ses.day, ses.states) });
  if (navigator.share) {
    try { await navigator.share({ text }); return; }
    catch (e) { if (e && e.name === "AbortError") return; }
  }
  if (await C.copy(text)) { C.toast("התוצאות הועתקו"); return; }
  // The toast's field is one line; the full text is already on screen in the summary, so select it there.
  const pre = R && R.querySelector(".g-share");
  try { if (pre && window.getSelection) window.getSelection().selectAllChildren(pre); } catch (e) {}
  C.toast("אי אפשר להעתיק מהמסך הזה. סמנו את התוצאות והעתיקו אותן ידנית.");
}

function onClick(e) {
  const t = e.target.closest && e.target.closest("button");
  if (!t || !R.contains(t) || t.disabled) return;
  const d = t.dataset, ui = ses.ui;
  if (d.g) { ses.screen = d.g; ses.ui = {}; paint(true); }
  else if ("ghub" in d) { ses.screen = "hub"; ses.ui = {}; paint(true); }
  else if ("gretry" in d) load();
  else if ("gpractice" in d) startPractice();
  else if ("gshare" in d) share();
  else if (d.gs) C.openSeries(Number(d.gs));
  else if (d.ga) C.openActor(d.ga);
  else if (d.gpick != null) pick(d.gpick);
  else if (d.gi != null) {
    const before = stateOf("odd", ses.day.games.odd, ses.states).picks.length;
    if (move({ index: Number(d.gi) })) ui.reveal = before;
    paint(false); const n = R.querySelector("[data-gnext]"); if (n) n.focus();
  } else if ("gnext" in d) { ui.reveal = null; paint(false); const f = R.querySelector(".g-body button, .g-body [data-focus]"); if (f) f.focus(); }
  else if (d.gact != null) { ui.actor = d.gact; paint(false); }
  else if (d.gto != null) { move({ type: "step", actor: ui.actor, to: Number(d.gto) }); ui.actor = null; paint(false); }
  else if ("gback" in d) { if (ui.actor) ui.actor = null; else move({ type: "back" }); paint(false); }
  else if ("ghint" in d) {
    const s = stateOf("chain", ses.day.games.chain, ses.states);
    move({ type: "hint" }); ui.hint = String(s.path[s.path.length - 1]); paint(false);
    const h = R.querySelector(".g-cast .is-hint"); if (h) h.focus();
  }
  else if (d.gid != null) {
    const sel = ui.sel || (ui.sel = []), k = sel.indexOf(d.gid);
    if (k >= 0) sel.splice(k, 1); else if (sel.length < 4) sel.push(d.gid);
    paint(false);
  } else if ("gsubmit" in d) {
    const s = move({ ids: (ui.sel || []).map(Number) });
    if (s && s.last === "ok") ui.sel = [];
    paint(false);
  } else if ("gclear" in d) { ui.sel = []; paint(false); }
}

function onInput(e) {
  if (e.target.id !== "gq") return;
  const q = e.target.value, box = R.querySelector("#gsug");
  if (box) box.innerHTML = sugHTML(ses.screen === "guess" ? guessSug(q) : actorSug(q));
}
function onKey(e) {
  if (e.target.id !== "gq" || e.key !== "Enter") return;
  e.preventDefault();
  const first = R.querySelector("[data-gpick]");
  if (first) pick(first.dataset.gpick);
}

/** ctx = { S, storage, actorNames, today: () => date, fetch, openSeries(tmdbId), openActor(name), toast, copy, nav }
 *  nav: true when the tab was just entered (scroll to top and focus the heading), false on a re-render. */
export function mountGames(root, ctx) {
  if (C && C.actorNames !== ctx.actorNames) ACTS = null;
  const old = R && R !== root && R.querySelector("#gq"), typed = old ? old.value : "";
  R = root; C = ctx;
  prune(ctx.storage, ctx.today());
  root.onclick = onClick;
  root.oninput = onInput;
  root.onkeydown = onKey;
  // A photo or poster that fails: the name (or the initials, unhidden only now) stays.
  root.addEventListener("error", e => {
    const t = e.target;
    if (!t || t.tagName !== "IMG" || !t.closest(".games")) return;
    const c = t.closest(".g-s"); if (c) c.classList.add("noimg");
    const ini = t.parentNode && t.parentNode.querySelector(".g-ini"); if (ini) ini.hidden = false;
    t.remove();
  }, true);
  if (!ses || ses.today !== ctx.today()) { load(); return; }
  // app.js re-renders the whole page on many actions: only a real navigation (ctx.nav) jumps to the top.
  paint(!!ctx.nav && ses.status !== "loading");
  const q = !ctx.nav && typed && R.querySelector("#gq");
  if (q) q.value = typed;
}

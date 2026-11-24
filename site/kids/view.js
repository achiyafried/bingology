// HTML for the kids page. Every string from the data goes through esc; images through safeImg.
import { esc, safeImg } from "../lib/esc.js";
import { GROUPS, LABEL, title } from "./catalog.js";
import { blur, outcome } from "./game.js";

const pressed = on => `aria-pressed="${on}"`;

function posterHTML(x, cls = "k-poster", style = "") {
  const src = safeImg(x.poster);
  return src
    ? `<img class="${cls}" src="${src}" alt="" loading="lazy"${style ? ` style="${style}"` : ""}>`
    : `<span class="${cls} k-noposter" aria-hidden="true">📺</span>`;
}

export function headerHTML(age) {
  const groups = GROUPS.map(g =>
    `<button class="k-age" data-age="${g.id}" data-a="age" data-v="${g.id}" ${pressed(g.id === age)}><span aria-hidden="true">${g.icon}</span> ${g.name}<small><bdi dir="ltr">${g.range}</bdi></small></button>`).join("");
  return `<header class="k-head"><a class="k-back" href="./">← חזרה ל-Bingology</a><h1>🧸 ילדים</h1></header>
<nav class="k-ages" aria-label="קבוצת גיל">${groups}</nav>
<div class="k-btns"><button class="k-gamebtn" data-a="game"><span aria-hidden="true">🎲</span> משחק היום</button>${age === "small" ? `<button class="k-gamebtn k-playbtn" data-a="play"><span aria-hidden="true">🎮</span> משחקים</button>` : ""}</div>`;
}

export function servicesHTML(available, selected) {
  if (!available.length) return "";
  const btn = (v, label, on) => `<button class="k-svc" data-a="svc" data-v="${v}" ${pressed(on)}>${esc(label)}</button>`;
  return `<div class="k-svcs" role="group" aria-label="שירות צפייה">${btn("", "הכול", !selected.length)}${available.map(p => btn(p, LABEL[p] || p, selected.includes(p))).join("")}</div>`;
}

export function gridHTML(items) {
  if (!items.length) return `<p class="k-empty">אין כאן סדרות בשירות הזה 🙈</p>`;
  return `<ul class="k-grid">${items.map(x =>
    `<li><button class="k-tile" data-a="card" data-v="${x.tmdb}">${posterHTML(x)}<span class="k-name">${esc(title(x))}</span></button></li>`).join("")}</ul>`;
}

export function cardHTML(x) {
  const group = GROUPS.find(g => g.id === x.age);
  const en = x.nameHe && x.name !== x.nameHe ? `<p class="k-en" dir="ltr">${esc(x.name)}</p>` : "";
  const facts = [x.seasons ? `${x.seasons} ${x.seasons === 1 ? "עונה" : "עונות"}` : null, x.year].filter(Boolean).join(" · ");
  const where = (x.providers ?? []).filter(p => p !== "other");
  const whereText = where.length
    ? `איפה רואים: ${where.map(p => `${esc(LABEL[p] || p)}${(x.providersGuess ?? []).includes(p) ? " (כנראה)" : ""}`).join(", ")}`
    : "לא מצאנו איפה רואים אותה בישראל";
  return `<div class="k-card" data-age="${esc(x.age)}">
<button class="k-close" data-a="close" aria-label="סגירה">✕</button>
${posterHTML(x, "k-cposter")}
<h2>${esc(title(x))}</h2>${en}
<p class="k-chip">${group ? `${group.icon} ${group.name} <bdi dir="ltr">${group.range}</bdi>` : ""}</p>
${facts ? `<p class="k-facts">${esc(facts)}</p>` : ""}
<p class="k-over">${esc(x.overview ?? x.overviewEn ?? "")}</p>
<p class="k-where">${whereText}</p>
</div>`;
}

export function gameHTML(puzzle, state, items) {
  if (!puzzle || !state) return `<section class="k-game"><p class="k-empty">אין עדיין משחק לקבוצה הזו</p></section>`;
  const byId = new Map(items.map(x => [x.tmdb, x]));
  const ans = byId.get(puzzle.answer);
  const res = outcome(state);
  const picks = puzzle.choices.map(id => {
    const x = byId.get(id); if (!x) return "";
    const miss = state.misses.includes(id), right = state.done && id === puzzle.answer;
    const cls = `k-pick${miss ? " miss" : ""}${right ? " right" : ""}`;
    return `<button class="${cls}" data-a="pick" data-v="${id}"${miss || state.done ? " disabled" : ""}>${posterHTML(x, "k-mini")}<span>${esc(title(x))}</span></button>`;
  }).join("");
  const end = !res ? `<p class="k-ask">איזו סדרה מסתתרת כאן?</p>`
    : `<p class="k-result ${res}">${res === "win" ? "כל הכבוד! 🎉" : `זאת הייתה ${esc(title(ans))}`}</p>
<button class="k-more" data-a="card" data-v="${puzzle.answer}">לפרטי הסדרה</button>`;
  return `<section class="k-game" aria-live="polite">
<button class="k-back" data-a="grid">← חזרה לסדרות</button>
<h2>🎲 איזו סדרה מסתתרת?</h2>
<div class="k-hidden">${posterHTML(ans, "k-big", `filter: blur(${blur(state)}px)`)}</div>
${end}
<div class="k-picks">${picks}</div>
</section>`;
}

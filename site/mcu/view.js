// MCU page markup (pure: data in, HTML out). Every value from data goes through esc().
import { esc, safeImg } from "../lib/esc.js";
import { trailBtnHTML, searchLinkHTML } from "../lib/trailer.js";

const LABEL = { netflix: "Netflix", hbo: "HBO Max", apple: "Apple TV+", prime: "Prime Video", disney: "Disney+", yes: "yes", hot: "HOT", partner: "פרטנר", cellcom: "סלקום", kan: "כאן", other: "אחר" };
const THEMES = [["cosmic", "🌌", "קוסמי"], ["comic", "💥", "קומיקס"], ["hud", "🖥️", "HUD"]];
const ORDERS = [["story", "סדר העלילה"], ["release", "סדר היציאה"]];
const VIEWS = [["list", "רשימה"], ["grid", "פוסטרים"]];
const CHECK = `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** The main title (Hebrew when there is one) and the secondary one. */
const title = x => x.nameHe || x.name;
const sub = x => (x.nameHe ? x.name : "");
const seasonOf = x => (x.kind === "season" ? ` · עונה ${x.season}` : "");
const dateText = d => { const [y, m, day] = String(d || "").split("-"); return y && m && day ? `${+day}.${+m}.${y}` : ""; };

/** "סרט · 2:06 שעות" / "סדרה · 6 פרקים" (the season number is in the title). */
export function lengthText(x) {
  if (x.kind === "season") return `סדרה${x.episodes ? ` · ${x.episodes} פרקים` : ""}`;
  if (!x.runtime) return "סרט";
  return `סרט · ${Math.floor(x.runtime / 60)}:${String(x.runtime % 60).padStart(2, "0")} שעות`;
}

const poster = (x, cls) => {
  const src = safeImg(x.poster);
  return src ? `<img class="${cls}" src="${src}" alt="" loading="lazy">` : `<span class="${cls} m-noimg" aria-hidden="true"></span>`;
};
const seenBtn = (x, seen, big) => {
  const on = seen.has(x.id);
  return `<button class="m-seen${big ? " big" : ""}" data-a="seen" data-id="${esc(x.id)}" aria-pressed="${on}" aria-label="${on ? "סומן כנצפה" : "סימון כנצפה"}: ${esc(title(x))}">${CHECK}${big ? `<span>${on ? "ראיתי" : "סימון כנצפה"}</span>` : ""}</button>`;
};
const pill = (a, [v, label, extra], cur) => `<button class="m-pill" data-a="${a}" data-v="${v}" aria-pressed="${cur === v}">${extra ? `<span aria-hidden="true">${label}</span> ${extra}` : label}</button>`;

export function headerHTML({ theme, order, view, done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `<header class="m-top">
  <a class="m-back" href="./">→ Bingology</a>
  <div class="m-themes" role="group" aria-label="סגנון">${THEMES.map(([v, em, name]) => pill("theme", [v, em, name], theme)).join("")}</div>
  <h1 class="m-title">ציר הזמן של <span>MCU</span></h1>
  <div class="m-prog"><div class="m-bar" style="--p:${pct}%" aria-hidden="true"><i></i></div><span>ראית ${done} מתוך ${total}</span></div>
  <div class="m-switch">
    <div role="group" aria-label="סדר">${ORDERS.map(o => pill("order", o, order)).join("")}</div>
    <div role="group" aria-label="תצוגה">${VIEWS.map(o => pill("view", o, view)).join("")}</div>
  </div>
</header>`;
}

export function nextHTML(x) {
  if (!x) return `<section class="m-next done"><p class="m-k">הבא בתור</p><h2>סיימת את כל ה-MCU! 🎉</h2></section>`;
  return `<section class="m-next" data-phase="${Number(x.phase)}"><p class="m-k">הבא בתור</p>
  <div class="m-nrow">${poster(x, "m-npost")}<div class="m-ninfo"><h2><bdi>${esc(title(x))}</bdi>${esc(seasonOf(x))}</h2>
  <p class="m-story">${esc(x.story)}</p><p class="m-len">${esc(lengthText(x))}</p>
  <div class="m-nacts">${seenBtn(x, new Set(), true)}<button class="m-pill" data-a="open" data-id="${esc(x.id)}">פרטים</button></div></div></div></section>`;
}

const row = (x, seen) => `<li class="m-item${seen.has(x.id) ? " seen" : ""}" data-phase="${Number(x.phase)}">
  <button class="m-open" data-a="open" data-id="${esc(x.id)}">${poster(x, "m-post")}<span class="m-txt"><b><bdi>${esc(title(x))}</bdi>${esc(seasonOf(x))}</b>${sub(x) ? `<small><bdi>${esc(sub(x))}</bdi></small>` : ""}<span class="m-story">${esc(x.story)}</span><span class="m-len">${esc(lengthText(x))}</span></span></button>
  ${seenBtn(x, seen)}</li>`;

export function listHTML(groups, seen) {
  return `<div class="m-list">${groups.map(g => `<section class="m-era"><h3>${esc(g.title)}</h3><ol>${g.items.map(x => row(x, seen)).join("")}</ol></section>`).join("")}</div>`;
}

export function gridHTML(items, seen) {
  return `<div class="m-grid">${items.map(x => `<button class="mtile${seen.has(x.id) ? " seen" : ""}" data-phase="${Number(x.phase)}" data-a="open" data-id="${esc(x.id)}" aria-label="${esc(title(x))}${esc(seasonOf(x))}${seen.has(x.id) ? ", נצפה" : ""}">${poster(x, "m-gpost")}<span class="m-check" aria-hidden="true">${CHECK}</span><span class="m-gcap"><b>${esc(x.story)}</b><bdi>${esc(title(x))}</bdi></span></button>`).join("")}</div>`;
}

export function upcomingHTML(items) {
  if (!items.length) return "";
  return `<section class="m-soon"><h3>בקרוב</h3><ul>${items.map(x => `<li><bdi>${esc(title(x))}</bdi>${esc(seasonOf(x))} · <span class="m-date">${esc(dateText(x.date))}</span></li>`).join("")}</ul></section>`;
}

/** The card's seen toggle on its own: swapped in place so a playing trailer keeps playing. */
export const cardSeenHTML = (x, on) => `<button class="m-pill${on ? "" : " primary"}" data-a="seen" data-id="${esc(x.id)}" aria-pressed="${on}">${on ? "עוד לא ראיתי" : "סימון כנצפה"}</button>`;

export function cardHTML(x, seen) {
  const on = seen.has(x.id);
  const where = x.providers.length ? x.providers.map(p => `${esc(LABEL[p] || p)}${x.providersGuess.includes(p) ? " (כנראה)" : ""}`).join(", ") : "לא ידוע";
  const text = x.overview ? `<p class="m-ov">${esc(x.overview)}</p>` : x.overviewEn ? `<p class="m-ov" dir="ltr" lang="en">${esc(x.overviewEn)}</p>` : "";
  // The trailer helpers expect the site's series shape: name in n, key in tr.
  const s = { n: x.name, tr: x.trailer };
  const trail = (trailBtnHTML(s, 0) || searchLinkHTML(s)).replace('data-a="trail" data-i="0"', `data-a="trail" data-id="${esc(x.id)}"`);
  return `<div class="m-card" data-phase="${Number(x.phase)}">
  <div class="m-ctop">${poster(x, "m-cpost")}<div><h2><bdi>${esc(title(x))}</bdi>${esc(seasonOf(x))}</h2>${sub(x) ? `<p class="m-sub"><bdi>${esc(sub(x))}</bdi></p>` : ""}
  <p class="m-story">${esc(x.story)}</p><p class="m-meta">שלב ${Number(x.phase)} · ${esc(dateText(x.date))} · ${esc(lengthText(x))}${x.vote ? ` · TMDB ${esc(x.vote)}` : ""}</p></div></div>
  ${x.note ? `<p class="m-note">${esc(x.note)}</p>` : ""}
  ${text}
  <p class="m-where">איפה לצפות: ${where}</p>
  ${trail}
  <div class="m-cacts">${cardSeenHTML(x, on)}<button class="m-pill" data-a="close">סגירה</button></div>
</div>`;
}

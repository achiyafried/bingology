// The "מה חדש" page (#news). Loaded by app.js with import() only, on #news.
// The bell and the home strip render from site/lib/news.js at boot; this module is the full page.
import { groupByDay, rowHTML, visibleItems } from "../lib/news.js";

export const FILTERS = ["הכל", "עונות חדשות", "סטרימינג", "הסתיימו"];
const KINDS = {
  "עונות חדשות": ["announced", "premiere"],
  "סטרימינג": ["stream_added", "stream_removed"],
  "הסתיימו": ["ended", "canceled"],
};
const UP_MAX = 10;
export const EMPTY = "אין חדשות כרגע";

/** items: news.json items (newest first); upcoming: upcomingSeasons(S, today); filter: one of FILTERS; more: show all upcoming. */
export function newsPageHTML({ items, upcoming, filter, today, more }, S) {
  const f = FILTERS.includes(filter) ? filter : FILTERS[0];
  const kinds = KINDS[f];
  const vis = visibleItems(items, S).filter((i) => !kinds || kinds.includes(i.kind));
  const ids = new Set(S.map((s) => s.tmdbId));
  const up = f === "הכל" || f === "עונות חדשות" ? (upcoming || []).filter((u) => ids.has(u.tmdbId)) : [];
  const chips = `<div class="chips nchips" role="group" aria-label="סינון">${FILTERS.map((x) => `<button class="chip" data-nf="${x}" aria-pressed="${x === f}">${x}</button>`).join("")}</div>`;
  let body = "";
  if (up.length) {
    const shown = more ? up : up.slice(0, UP_MAX);
    const rest = up.length - shown.length;
    body += `<h3 class="day">עונות בדרך</h3><div class="ncard">${shown.map((u) => rowHTML(u, S, today, false)).join("")}${rest > 0 ? `<button class="linkbtn more" data-nmore>עוד ${rest}</button>` : ""}</div>`;
  }
  for (const g of groupByDay(vis, today)) {
    body += `<h3 class="day">${g.label}</h3><div class="ncard">${g.items.map((i) => rowHTML(i, S, today, false)).join("")}</div>`;
  }
  if (!body) body = `<div class="empty"><p>${EMPTY}</p></div>`;
  return `<section class="news"><div class="nh"><h2 data-focus tabindex="-1">מה חדש</h2><a class="linkbtn" href="#">חזרה</a></div>${chips}${body}
  <p class="note">החדשות מתעדכנות כל לילה מתוך הנתונים של הסדרות באתר.</p></section>`;
}

let filter = FILTERS[0];
let more = false;

/** Paints the page into root and handles the filter chips and "עוד N" (the rows use app.js's data-a="detail"). */
export function mountNews(root, ctx) {
  const paint = () => { root.innerHTML = newsPageHTML({ items: ctx.items, upcoming: ctx.upcoming, filter, today: ctx.today, more }, ctx.S); };
  root.onclick = (e) => {
    const c = e.target.closest("[data-nf]");
    if (c) { filter = c.dataset.nf; paint(); return; }
    if (e.target.closest("[data-nmore]")) { more = true; paint(); }
  };
  paint();
}

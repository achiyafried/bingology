// Pure helpers for the "מה חדש" (news) UI: Hebrew copy, day groups, upcoming seasons.
// No DOM (the *HTML functions return strings; the bell and the strip render from app.js at boot). `today` is always passed in as a "YYYY-MM-DD" LOCAL date string. The view computes it:
//   const d = new Date();
//   const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

import { esc, safeImg } from "./esc.js";

const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

/** "2027-03-14" -> "14 במרץ 2027" */
export function formatDateHe(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return `${d} ב${MONTHS[m - 1]} ${y}`;
}

function dayNum(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}
const daysAgo = (date, today) => dayNum(today) - dayNum(date);

const TAGS = {
  announced: "עונה חדשה הוכרזה",
  stream_added: "עלתה לסטרימינג",
  stream_removed: "ירדה מסטרימינג",
  ended: "הסתיימה",
  canceled: "בוטלה",
};

const list = (a) => (Array.isArray(a) && a.length ? a : null);

/** -> {tag, kind, title, sub, region|null} for one news.json item (s = app series array). */
export function newsText(item, S, today) {
  const s = S.find((x) => x.tmdbId === item.tmdbId) || {};
  const name = s.n || "";
  const strm = s.strm || {};
  const kind = item.kind;
  const region = item.region || null;
  let tag = TAGS[kind] || "";
  let title = name;
  let sub = "";
  if (kind === "announced") {
    title = `${name} · עונה ${item.season} ב-${formatDateHe(item.airDate)}`;
    sub = (list(strm.IL) || list(strm.US) || []).join(", ");
  } else if (kind === "premiere") {
    tag = item.date === today ? "התחילה היום" : "התחילה";
    title = `${name} · עונה ${item.season}`;
  } else if (kind === "stream_added") {
    title = `${name} · ${item.provider}`;
  } else if (kind === "stream_removed") {
    title = `${name} · ירדה מ-${item.provider}`;
    const left = [...(strm[item.region] || []), ...(strm.IL || [])].filter((p) => p !== item.provider);
    const uniq = [...new Set(left)];
    sub = uniq.length ? `עדיין ב-${uniq.join(", ")}` : "";
  } else if (kind === "ended") {
    sub = "כל הפרקים זמינים לבינג׳";
  } else if (kind === "canceled") {
    sub = s.s === 1 ? "אחרי עונה אחת" : s.s ? `אחרי ${s.s} עונות` : "";
  }
  return { tag, kind, title, sub, region: kind === "stream_added" || kind === "stream_removed" ? region : null };
}

/** Groups (already newest-first) items into היום / אתמול / השבוע / קודם; empty groups omitted. */
export function groupByDay(items, today) {
  const labels = ["היום", "אתמול", "השבוע", "קודם"];
  const buckets = labels.map((label) => ({ label, items: [] }));
  for (const it of items) {
    const d = daysAgo(it.date, today);
    buckets[d <= 0 ? 0 : d === 1 ? 1 : d < 7 ? 2 : 3].items.push(it);
  }
  return buckets.filter((b) => b.items.length);
}

/** Items newer than lastSeen (a "YYYY-MM-DD" or null = never seen -> all). */
export function unseenCount(items, lastSeen) {
  return lastSeen ? items.filter((i) => i.date > lastSeen).length : items.length;
}

/** Series whose next episode is a season premiere (episode 1) after today, nearest first. Full list; the view caps at 10 + "עוד N". */
export function upcomingSeasons(S, today) {
  return S.filter((s) => s.nx && s.nx.episode === 1 && s.nx.date && s.nx.date > today)
    .map((s) => ({ tmdbId: s.tmdbId, season: s.nx.season, date: s.nx.date }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.tmdbId - b.tmdbId);
}

/** Only items whose series is still in S (a series dropped from data.json gets no news). */
export function visibleItems(items, S) {
  const ids = new Set(S.map((s) => s.tmdbId));
  return (items || []).filter((i) => ids.has(i.tmdbId));
}

/** Home strip (cap 3): items from the last 7 days (newest first), then upcoming seasons for series not
 *  already in the strip, then older items. Items for series not in S are skipped. */
export function stripItems(items, S, today) {
  const vis = visibleItems(items, S).sort((a, b) => b.date.localeCompare(a.date));
  const recent = vis.filter((i) => daysAgo(i.date, today) < 7).slice(0, 3);
  const shown = new Set(recent.map((i) => i.tmdbId));
  const up = upcomingSeasons(S, today).filter((u) => !shown.has(u.tmdbId));
  const older = vis.filter((i) => daysAgo(i.date, today) >= 7);
  return [...recent, ...up, ...older].slice(0, 3);
}

/* ───────── HTML (strings) ───────── */

const KCLS = { announced: "season", premiere: "prem", stream_added: "stream", stream_removed: "stream", ended: "end", canceled: "cancel" };
const BELL_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`;
// Latin runs (series and service names: "AMC+", "Apple TV+") in their own <bdi>, so RTL doesn't flip a trailing "+".
const LATIN = /([A-Za-z](?:[^\u0590-\u05FF·,]*[^\u0590-\u05FF·,\s])?)/;
const bidi = (t) => String(t).split(LATIN).map((x, k) => (k % 2 ? `<bdi>${esc(x)}</bdi>` : esc(x))).join("");
const flag = (r) => (r ? `<span class="flag">${esc(r)}</span>` : "");

/** The bell beside the logo; a dot when count > 0. */
export function bellHTML(count) {
  const label = count > 0 ? "מה חדש, יש ידיעות חדשות" : "מה חדש";
  return `<a class="bell" href="#news" aria-label="${label}">${BELL_SVG}${count > 0 ? `<i></i>` : ""}</a>`;
}

function dayWord(date, today) {
  const d = daysAgo(date, today);
  return d <= 0 ? "היום" : d === 1 ? "אתמול" : formatDateHe(date);
}

/** One row: a news item (has `kind`) or an upcoming season ({tmdbId, season, date}). "" when the series is not in S.
 *  `when` adds the day word to the sub line (the strip; the page has day headings). */
export function rowHTML(entry, S, today, when) {
  const i = S.findIndex((x) => x.tmdbId === entry.tmdbId);
  if (i < 0) return "";
  const s = S[i];
  let t;
  if (entry.kind) t = newsText(entry, S, today);
  else {
    const strm = s.strm || {};
    t = { tag: "עונה חדשה", kind: "announced", title: `${s.n || ""} · עונה ${entry.season} ב-${formatDateHe(entry.date)}`, sub: (list(strm.IL) || list(strm.US) || []).join(", "), region: null };
  }
  const src = safeImg(s.poster);
  const img = src ? `<img class="poster" src="${src}" alt="" loading="lazy" data-pi="${i}" data-pc="">` : `<span class="noimg" aria-hidden="true"></span>`;
  const subBits = [t.sub ? bidi(t.sub) : "", entry.kind && when ? dayWord(entry.date, today) : ""].filter(Boolean).join(" · ");
  return `<button class="n" data-a="detail" data-i="${i}">${img}<span class="i"><span class="k ${KCLS[t.kind] || "season"}">${esc(t.tag)}</span><b><bdi dir="rtl">${bidi(t.title)}</bdi>${flag(t.region)}</b>${subBits ? `<small>${subBits}</small>` : ""}</span></button>`;
}

/** Home-screen strip under "או פשוט תפתיעו אותי"; "" when there is nothing to show. */
export function stripHTML(entries, S, today) {
  const rows = (entries || []).map((e) => rowHTML(e, S, today, true)).join("");
  if (!rows) return "";
  return `<section class="strip" aria-labelledby="stripH"><div class="sh"><h3 id="stripH">מה חדש</h3><a href="#news">כל החדשות ←</a></div>${rows}</section>`;
}

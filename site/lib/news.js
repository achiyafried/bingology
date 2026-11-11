// Pure helpers for the "מה חדש" (news) UI: Hebrew copy, day groups, upcoming seasons.
// No DOM. `today` is always passed in as a "YYYY-MM-DD" LOCAL date string. The view computes it:
//   const d = new Date();
//   const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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
    sub = s.s ? `אחרי ${s.s} עונות` : "";
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

/** Home strip: 3 most recent items (in S); if fewer than 3 are from the last 7 days, fill with upcoming seasons. */
export function stripItems(items, S, today) {
  const ids = new Set(S.map((s) => s.tmdbId));
  const recent = items
    .filter((i) => ids.has(i.tmdbId) && daysAgo(i.date, today) < 7)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  if (recent.length >= 3) return recent;
  return [...recent, ...upcomingSeasons(S, today)].slice(0, 3);
}

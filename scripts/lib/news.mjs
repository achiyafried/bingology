// Pure news logic: diff two nights of series data into items, then fold into history.

const REGIONS = ["IL", "US", "UK"];

export function diffNews(prevSeries, currSeries, now) {
  const date = now.slice(0, 10);
  const prevById = new Map((prevSeries || []).map((s) => [s.tmdbId, s]));
  const out = [];
  for (const c of currSeries || []) {
    const p = prevById.get(c.tmdbId);
    if (!p || c.fetchedAt !== now) continue;
    const seen = new Set();
    const push = (id, extra) => {
      if (seen.has(id)) return;
      seen.add(id);
      out.push({ id, date, tmdbId: c.tmdbId, ...extra });
    };

    if ("next" in p) {
      const n = c.next;
      if (n && n.episode === 1 && n.season > (p.seasons ?? 0)
          && !(p.next && p.next.season === n.season && p.next.date === n.date)) {
        push(`${c.tmdbId}-announced-${n.season}-${n.date}`,
          { kind: "announced", season: n.season, airDate: n.date });
      }
      const pn = p.next;
      if (pn && pn.episode === 1 && pn.season >= 2 && pn.date <= date) {
        push(`${c.tmdbId}-premiere-${pn.season}`, { kind: "premiere", season: pn.season });
      }
      if (c.seasons > p.seasons && c.seasons >= 2) {
        push(`${c.tmdbId}-premiere-${c.seasons}`, { kind: "premiere", season: c.seasons });
      }
    }

    if (p.status !== c.status && p.status !== "ended" && p.status !== "canceled") {
      if (c.status === "ended") push(`${c.tmdbId}-ended`, { kind: "ended" });
      if (c.status === "canceled") push(`${c.tmdbId}-canceled`, { kind: "canceled" });
    }

    if (p.streams && c.streams) {
      for (const region of REGIONS) {
        const before = p.streams[region] || [];
        const after = c.streams[region] || [];
        for (const provider of after) {
          if (!before.includes(provider)) {
            push(`${c.tmdbId}-stream_added-${region}-${provider}`, { kind: "stream_added", region, provider });
          }
        }
        for (const provider of before) {
          if (!after.includes(provider)) {
            push(`${c.tmdbId}-stream_removed-${region}-${provider}`, { kind: "stream_removed", region, provider });
          }
        }
      }
    }
  }
  return out;
}

const KEEP_DAYS = 60;
const MAX_ITEMS = 400;
const FLAP_DAYS = 7;
const DAY = 86400000;

const dayNum = (d) => Date.parse(`${d}T00:00:00Z`) / DAY;

// Drop stream_added/stream_removed pairs for the same show+region+provider that cancel out within 7 days.
function dropFlaps(items) {
  const opposite = { stream_added: "stream_removed", stream_removed: "stream_added" };
  const dead = new Set();
  items.forEach((a, i) => {
    if (!opposite[a.kind] || dead.has(i)) return;
    const j = items.findIndex((b, k) => k !== i && !dead.has(k) && b.kind === opposite[a.kind]
      && b.tmdbId === a.tmdbId && b.region === a.region && b.provider === a.provider
      && Math.abs(dayNum(a.date) - dayNum(b.date)) <= FLAP_DAYS);
    if (j >= 0) { dead.add(i); dead.add(j); }
  });
  return items.filter((_, i) => !dead.has(i));
}

export function mergeNews(prevNews, newItems, now) {
  const seen = new Set();
  const all = [];
  for (const item of [...newItems, ...(prevNews?.items || [])]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    all.push(item);
  }
  const cutoff = dayNum(now.slice(0, 10)) - KEEP_DAYS;
  const recent = all.filter((i) => dayNum(i.date) >= cutoff);
  const items = dropFlaps(recent).slice(0, MAX_ITEMS);
  return { updatedAt: now, items };
}

export function buildNews(prevData, data, prevNews, now) {
  const news = mergeNews(prevNews, diffNews(prevData, data, now), now);
  const changed = JSON.stringify(news.items) !== JSON.stringify(prevNews?.items || []);
  return { news, changed };
}

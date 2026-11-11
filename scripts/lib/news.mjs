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

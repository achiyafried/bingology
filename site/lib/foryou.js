/* "For you": recommendations from loved / disliked series, via series similarity. */
import { neighbours } from "./similar.js";

const rated = entries => [...entries.values()].filter(r => r.status === "seen" && r.rating != null);

export function readiness(entries) {
  const r = rated(entries);
  if (r.length < 3) return { ready: false, need: 3 - r.length };
  return r.some(x => x.rating >= 8) ? { ready: true, need: 0 } : { ready: false, need: 1 };
}

function signals(S, entries) {
  const idx = new Map(S.map((s, i) => [s.tmdbId, i]));
  const out = [];
  for (const [id, r] of entries) {
    const i = idx.get(id);
    if (i === undefined) continue;
    if (r.status === "seen" && r.rating >= 8) out.push({ i, w: r.rating - 7 });
    else if ((r.status === "seen" && r.rating != null && r.rating <= 5) || r.status === "dropped" || r.status === "nope") out.push({ i, w: -0.5 });
  }
  return out;
}

function pass(S, entries, localSeen, sig, k, n) {
  const candidate = j => !entries.has(S[j].tmdbId) && !localSeen.has(j);
  const score = new Map(), contrib = new Map();
  for (const { i, w } of sig) {
    for (const { j, sc } of neighbours(S, i, k)) {
      if (!candidate(j)) continue;
      score.set(j, (score.get(j) ?? 0) + w * sc);
      if (w > 0) {
        if (!contrib.has(j)) contrib.set(j, new Map());
        contrib.get(j).set(i, (contrib.get(j).get(i) ?? 0) + w * sc);
      }
    }
  }
  const rank = j => score.get(j) + (S[j].bs ?? 0) / 1000;
  return [...score.keys()].filter(j => score.get(j) > 0).sort((a, b) => rank(b) - rank(a)).slice(0, n).map(j => {
    const [top, second] = [...(contrib.get(j) ?? [])].sort((a, b) => b[1] - a[1]);
    const because = top ? [S[top[0]].n] : [];
    if (second && second[1] >= 0.8 * top[1] && S[second[0]].n !== because[0]) because.push(S[second[0]].n);
    return { i: j, score: score.get(j), because };
  });
}

export function forYou(S, entries, localSeen, opts = {}) {
  const { n = 8, k = 20, wide = 60 } = opts;
  const sig = signals(S, entries);
  const r = pass(S, entries, localSeen, sig, k, n);
  return r.length || k >= wide ? r : pass(S, entries, localSeen, sig, wide, n);
}

export function unrated(S, entries, max = 4) {
  const idx = new Map(S.map((s, i) => [s.tmdbId, i]));
  return [...entries].filter(([id, r]) => r.status === "seen" && r.rating == null && idx.has(id))
    .sort((a, b) => (a[1].updated_at < b[1].updated_at ? 1 : a[1].updated_at > b[1].updated_at ? -1 : 0))
    .slice(0, max).map(([id]) => idx.get(id));
}

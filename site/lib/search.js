import { hebKey, keyMatch, nameKeys } from "./phonetic.js";

/**
 * Indices of series matching `q`: text matches first (part of the name, any case), then — for Hebrew
 * queries — pronunciation matches against English names ("סופרנוס" → The Sopranos). Ties by binge score.
 */
export function searchSeries(S, q, limit = 60) {
  q = (q || "").trim().toLowerCase();
  if (q.length < 2) return [];
  const heb = /[֐-׿]/.test(q), qk = heb ? hebKey(q) : [], qf = qk.join("");
  return S.map((s, i) => {
    let r = 9;
    if (s.n.toLowerCase().includes(q)) r = s.n.toLowerCase().startsWith(q) ? 0 : 1;
    else if (heb) {
      const k = nameKeys(s.n);
      if (keyMatch(k, qk)) r = k.kf === qf ? 2 : k.kw.some(w => w.startsWith(qf)) ? 3 : 4;
    }
    return { i, r, bs: s.bs ?? 0 };
  }).filter(o => o.r < 9).sort((a, b) => a.r - b.r || b.bs - a.bs).slice(0, limit).map(o => o.i);
}

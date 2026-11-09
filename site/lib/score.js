// Pure quiz scoring, moved verbatim from the legacy artifact (rank()).

export const LNAME = { en: "אנגלית", he: "עברית", ko: "קוריאנית", fr: "צרפתית", ja: "יפנית" };
export const GENRES = { crime: "פשע ועולם תחתון", drama: "דרמה", thriller: "מתח וריגול", scifi: "מדע בדיוני", fantasy: "פנטזיה ואפוס", comedy: "קומדיה", history: "היסטוריה ופוליטיקה", apoc: "אפוקליפסה והישרדות", mystery: "תעלומה", israeli: "ישראלית", doc: "דוקו וריאליטי" };
export const MOODS = { laugh: "לצחוק ולהרים", feel: "להתרגש", tense: "מתח ואדרנלין", think: "להעסיק את המוח", escape: "בריחה לעולם אחר" };
export const WEIGHT_WHY = { 1: "קלילה, אפשר לצפות בלי להתאמץ", 2: "עומק בינוני, בלי להכביד", 3: "כבדה ומטלטלת, כמו שביקשתם" };
export const bL = m => m <= 32 ? 0 : m <= 52 ? 1 : 2;
export const bS = n => n === 1 ? 0 : n <= 3 ? 1 : n <= 6 ? 2 : 3;
export const LEN_IDX = { s: 0, m: 1, l: 2 };
export const SEAS_IDX = { one: 0, few: 1, mid: 2, many: 3 };
export const LEN_TXT = { s: "עד חצי שעה", m: "כ-45 דקות", l: "שעה ומעלה" };
export const SEAS_TXT = { one: "עונה אחת", few: "2–3 עונות", mid: "4–6 עונות", many: "7 עונות ומעלה" };

/** Indices of S in the chosen source list, filtered to series on any of the chosen services. */
export function poolIds(S, src, plats) {
  let ids = S.map((_, i) => i);
  if (src === "mine") ids = ids.filter(i => S[i].lists.includes("mine"));
  if (src === "nyt") ids = ids.filter(i => S[i].nyt).sort((x, y) => S[x].nyt - S[y].nyt);
  if (plats && plats.length) ids = ids.filter(i => S[i].providers.some(p => plats.includes(p)));
  return ids;
}

/** How well one series fits the quiz answers `a`: normalized score, percent, and reasons. */
export function scoreSeries(s, a) {
  let sc = 0, max = 0; const items = [];
  const add = (w, got, okT, noT) => { max += w; sc += got; const ok = got >= w * 0.5; items.push({ ok, w, t: ok ? okT : noT }); };
  if (a.genres.length) {
    const hit = s.g.filter(x => a.genres.includes(x));
    const got = hit.length ? 3 * Math.min(1, Math.max(0.6, hit.length / Math.min(a.genres.length, 2))) : 0;
    add(3, got, "בז׳אנר שבחרתם: " + hit.map(x => GENRES[x]).join(", "), "לא בדיוק בז׳אנרים שבחרתם");
  }
  if (a.lang) {
    const match = a.lang === "other" ? !["en", "he"].includes(s.lang) : s.lang === a.lang;
    add(3, match ? 3 : 0, "שפת מקור: " + LNAME[s.lang], "שפת המקור היא " + LNAME[s.lang]);
  }
  if (a.imdb) {
    const got = s.imdb >= a.imdb ? 2.5 : s.imdb >= a.imdb - 0.3 ? 1 : 0;
    add(2.5, got, `ציון IMDb ${s.imdb.toFixed(1)}`, `ציון IMDb ${s.imdb.toFixed(1)} (ביקשתם ${a.imdb.toFixed(1)}+)`);
  }
  if (a.rt && s.rt != null) {
    const got = s.rt >= a.rt ? 2 : s.rt >= a.rt - 5 ? 0.8 : 0;
    add(2, got, `${s.rt}% ממבקרי רוטן טומייטו`, `${s.rt}% ברוטן טומייטו (ביקשתם ${a.rt}%+)`);
  }
  if (a.mood) {
    const got = s.mo.includes(a.mood) ? (s.mo[0] === a.mood ? 2 : 1.6) : 0;
    add(2, got, "מתאימה למצב הרוח: " + MOODS[a.mood], "פחות מתאימה למצב הרוח שבחרתם");
  }
  if (a.seasons) {
    const d = Math.abs(bS(s.s) - SEAS_IDX[a.seasons]);
    add(2, [2, 0.7, 0, 0][d], `${s.s === 1 ? "עונה אחת" : s.s + " עונות"}, ${s.e} פרקים`, `${s.s === 1 ? "עונה אחת" : s.s + " עונות"} (ביקשתם ${SEAS_TXT[a.seasons]})`);
  }
  if (a.len) {
    const d = Math.abs(bL(s.m) - LEN_IDX[a.len]);
    add(1.5, [1.5, 0.5, 0][d], `פרקים של כ-${s.m} דקות`, `פרקים של כ-${s.m} דקות (ביקשתם ${LEN_TXT[a.len]})`);
  }
  if (a.weight) {
    const d = Math.abs(s.h - a.weight);
    add(1.5, [1.5, 0.6, 0][d], WEIGHT_WHY[s.h], s.h > a.weight ? "כבדה יותר ממה שביקשתם" : "קלילה יותר ממה שביקשתם");
  }
  const norm = max ? sc / max : 1;
  const pct = Math.min(100, Math.round(100 * norm));
  return { norm, pct, items };
}

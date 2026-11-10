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

export const ERAS = { "80": "שנות ה־80 ולפני", "90": "שנות ה־90", "00": "שנות ה־2000", "10": "שנות ה־2010", "20": "שנות ה־2020" };
// Explicit order: integer-like object keys ("10", "80"...) would otherwise be sorted numerically.
export const ERA_KEYS = ["80", "90", "00", "10", "20"];

/** Decade bucket of a premiere year ("80" covers 1989 and earlier). */
export function eraOf(y) {
  if (!y) return null;
  if (y < 1990) return "80";
  return String(Math.floor(y / 10) % 10) + "0";
}

/** Indices of S in the chosen source list, filtered to series on any of the chosen services. */
export function poolIds(S, src, plats) {
  let ids = S.map((_, i) => i);
  if (src === "mine") ids = ids.filter(i => S[i].lists.includes("mine"));
  if (src === "nyt") ids = ids.filter(i => S[i].nyt).sort((x, y) => S[x].nyt - S[y].nyt);
  if (src === "pool") ids = ids.filter(i => S[i].lists.includes("pool"));
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
  // One combined quality question (ציון בינג׳, 50–100) replaces the IMDb and Rotten Tomatoes questions.
  if (a.quality && s.bs == null) add(2.5, 0, "", "אין עדיין ציון בינג׳");
  else if (a.quality) {
    const got = s.bs >= a.quality ? 2.5 : s.bs >= a.quality - 5 ? 1 : 0;
    add(2.5, got, `ציון בינג׳ ${s.bs}`, `ציון בינג׳ ${s.bs} (ביקשתם ${a.quality}+)`);
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
  if (a.company === "solo") {
    add(1.5, s.solo ? 1.5 : 1.2, s.solo ? "מתאימה במיוחד לצפייה לבד" : "מתאימה גם לצפייה לבד", "");
  } else if (a.company === "couple") {
    add(1.5, s.solo ? 0 : 1.5, "מתאימה לצפייה בזוג", "עדיף לצפות בה לבד");
  } else if (a.company === "family") {
    if (s.solo) add(1.5, 0, "", "עדיף לצפות בה לבד");
    else if (s.minAge != null) {
      const got = s.minAge <= 14 ? 1.5 : s.minAge < 17 ? 0.6 : 0;
      add(1.5, got, s.minAge ? `מתאימה מגיל ${s.minAge}` : "מתאימה לכל הגילים", `מיועדת לגילאי ${s.minAge}+`);
    } else add(1.5, s.h === 1 ? 1 : 0, "קלילה, כנראה מתאימה למשפחה", "לא בטוח שמתאימה למשפחה");
  }
  if (a.eras && a.eras.length) {
    const e = eraOf(s.y), k = ERA_KEYS.indexOf(e);
    const d = e == null ? 9 : Math.min(...a.eras.map(x => Math.abs(ERA_KEYS.indexOf(x) - k)));
    const label = e ? `${ERAS[e]} (${s.y})` : "שנת הבכורה לא ידועה";
    add(2, d === 0 ? 2 : d === 1 ? 1 : 0, `מהתקופה שבחרתם: ${label}`, `מתקופה אחרת: ${label}`);
  }
  const norm = max ? sc / max : 1;
  const pct = Math.min(100, Math.round(100 * norm));
  return { norm, pct, items };
}

import { ERAS, ERA_KEYS, GENRES, MOODS, WEIGHT_WHY, LNAME, bL, bS, LEN_IDX, SEAS_IDX, LEN_TXT, SEAS_TXT, poolIds as poolIn, scoreSeries } from "./lib/score.js";
import { fromData, providerNames } from "./lib/data.js";
import { loadSeen, saveSeen } from "./lib/seen.js";
import { esc, safeImg } from "./lib/esc.js";
import { hebKey, latKey, keyMatch } from "./lib/phonetic.js";
import { searchSeries } from "./lib/search.js";
import { addSeriesUrl } from "./lib/addlink.js";
import { bellHTML, stripHTML, stripItems, unseenCount, upcomingSeasons, visibleItems } from "./lib/news.js";
import { israelToday } from "./lib/games/day.js";
import { dayProgress, loadTotal, streak as gamesStreak } from "./lib/games/store.js";

const REPO = "achiyafried/bingology";
import { quizSteps, resetQuiz, orderResults, emptyPlatforms, quizPlatforms } from "./lib/quiz.js";
import { bingeScores } from "./lib/binge.js";
import { bingePlan } from "./lib/plan.js";

let S = [];
const poolIds = (src, plats) => poolIn(S, src, plats);
const store = (() => { try { return window.localStorage; } catch (e) { return null; } })();
function save() { saveSeen(store, st.seen, S); }
const PLAT_LABEL = { netflix: "Netflix", hbo: "HBO Max", apple: "Apple TV+", prime: "Prime Video", disney: "Disney+", yes: "yes", hot: "HOT", partner: "פרטנר", cellcom: "סלקום", kan: "כאן", other: "אחר" };
const platsInUse = () => quizPlatforms(Object.keys(PLAT_LABEL), S);
const platLine = s => { const ps = providerNames(s, PLAT_LABEL); return ps.length ? "זמין ב: " + ps.map(p => `<bdi>${esc(p.name)}</bdi>` + (p.guess ? " (כנראה)" : "")).join(", ") : "לא זמינה כרגע בסטרימינג בישראל"; };
// Official logos from TMDB (offered by TMDB for this use). TMDB has no Israeli services, so those get a letter mark.
const PLAT_LOGO = { netflix: "/rK1KljqmbvO9HQa1PBFLILWah72.png", hbo: "/skypuy7SXuugIQeYg0IglmzoKaS.png", apple: "/9icYBfYFcwgCbky5VdGUIKJ4C5i.png", prime: "/gMZdpavHmxFNnLpMHwVxfqeux2g.png", disney: "/5eZ872CghnHFLB1j8grszbrx0dx.png" };
const PLAT_MARK = { yes: "y", hot: "H", partner: "פ", cellcom: "ס", kan: "כ", other: "…" };
const platChipHTML = k => (PLAT_LOGO[k] ? `<img class="plogo" src="https://image.tmdb.org/t/p/w92${PLAT_LOGO[k]}" width="24" height="24" style="width:24px;height:24px;border-radius:7px" alt="" loading="lazy">`
  : PLAT_MARK[k] ? `<span class="pmark pm-${k}" aria-hidden="true">${PLAT_MARK[k]}</span>` : "") + `<span><bdi>${PLAT_LABEL[k]}</bdi></span>`;
const PHOTO = new Map();

const LOGO = "<svg class=\"ic\" viewBox=\"0 0 512 512\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\">\n  <defs>\n    <linearGradient id=\"bgh\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#3B2FD0\"/><stop offset=\"1\" stop-color=\"#12102B\"/></linearGradient>\n    <linearGradient id=\"scrh\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#5B4EF0\"/><stop offset=\"1\" stop-color=\"#12102B\"/></linearGradient>\n  </defs>\n  <rect width=\"512\" height=\"512\" rx=\"116\" fill=\"url(#bgh)\"/>\n  <g transform=\"translate(0 14)\">\n    <g stroke=\"#FFF6E3\" stroke-width=\"14\" stroke-linecap=\"round\" fill=\"none\"><path d=\"M256 132 L196 66\"/><path d=\"M256 132 L316 66\"/></g>\n    <circle cx=\"196\" cy=\"62\" r=\"14\" fill=\"#FFC933\"/><circle cx=\"316\" cy=\"62\" r=\"14\" fill=\"#FFC933\"/>\n    <rect x=\"64\" y=\"128\" width=\"384\" height=\"280\" rx=\"60\" fill=\"#FFF6E3\"/>\n    <rect x=\"94\" y=\"158\" width=\"262\" height=\"220\" rx=\"40\" fill=\"url(#scrh)\"/>\n    <path d=\"M120 198 Q124 178 148 174\" stroke=\"#fff\" stroke-opacity=\".38\" stroke-width=\"8\" stroke-linecap=\"round\" fill=\"none\"/>\n    <path d=\"M206 218 L206 318 L292 268 Z\" fill=\"#FFF6E3\" stroke=\"#FFF6E3\" stroke-width=\"22\" stroke-linejoin=\"round\"/>\n    <circle cx=\"400\" cy=\"200\" r=\"22\" fill=\"#3B2FD0\"/>\n    <circle cx=\"400\" cy=\"262\" r=\"22\" fill=\"#FFC933\"/>\n    <g stroke=\"#3B2FD0\" stroke-width=\"8\" stroke-linecap=\"round\"><path d=\"M382 322 H418\"/><path d=\"M382 340 H418\"/><path d=\"M382 358 H418\"/></g>\n    <rect x=\"120\" y=\"408\" width=\"52\" height=\"30\" rx=\"10\" fill=\"#FFF6E3\"/><rect x=\"340\" y=\"408\" width=\"52\" height=\"30\" rx=\"10\" fill=\"#FFF6E3\"/>\n  </g></svg><svg class=\"wm\" viewBox=\"-40 -784 5014 1007\" role=\"img\" aria-label=\"Bingology\" xmlns=\"http://www.w3.org/2000/svg\"><g fill=\"currentColor\"><path transform=\"translate(0 0)\" d=\"M73 0V-660H347Q408 -660 456.0 -649.5Q504 -639 538.5 -618.0Q573 -597 591.5 -563.5Q610 -530 610 -484Q610 -445 593.5 -416.0Q577 -387 542.5 -369.0Q508 -351 452 -344V-329Q547 -322 591.5 -281.5Q636 -241 636 -173Q636 -116 606.5 -77.5Q577 -39 518.0 -19.5Q459 0 372 0ZM210 -116H370Q434 -116 465.0 -135.5Q496 -155 496 -196Q496 -243 457.0 -266.5Q418 -290 339 -290H210ZM210 -380H318Q396 -380 432.5 -401.5Q469 -423 469 -465Q469 -507 436.0 -526.5Q403 -546 335 -546H210Z\"/><path transform=\"translate(689 0)\" d=\"M66 0V-525H210V0Z\"/><path transform=\"translate(971 0)\" d=\"M66 0V-318V-525H184L183 -368H203Q216 -425 240.0 -463.0Q264 -501 300.5 -520.0Q337 -539 387 -539Q478 -539 525.5 -475.0Q573 -411 573 -274V0H428V-258Q428 -342 403.5 -380.5Q379 -419 332 -419Q292 -419 265.0 -394.0Q238 -369 224.5 -328.5Q211 -288 210 -238V0Z\"/><path transform=\"translate(1608 0)\" d=\"M274 183Q188 183 132.5 169.5Q77 156 51.0 130.0Q25 104 25 65Q25 19 61.5 -10.0Q98 -39 169 -45V-65Q115 -65 86.0 -76.5Q57 -88 57 -117Q57 -145 85.5 -167.0Q114 -189 180 -202V-222Q118 -226 83.0 -262.0Q48 -298 48 -355Q48 -405 76.0 -444.5Q104 -484 159.5 -507.5Q215 -531 296 -531H562V-421L397 -444V-421Q461 -412 489.5 -389.0Q518 -366 518 -325Q518 -284 491.0 -253.0Q464 -222 414.5 -204.5Q365 -187 296 -187Q283 -187 268.0 -188.0Q253 -189 218 -193Q199 -179 188.5 -168.5Q178 -158 178 -149Q178 -142 185.5 -137.0Q193 -132 205.5 -130.0Q218 -128 231 -128H381Q401 -128 433.0 -125.5Q465 -123 497.0 -110.0Q529 -97 551.0 -68.5Q573 -40 573 13Q573 71 540.5 109.0Q508 147 441.5 165.0Q375 183 274 183ZM290 68Q351 68 385.0 61.5Q419 55 433.5 40.5Q448 26 448 4Q448 -16 439.5 -27.0Q431 -38 417.5 -42.5Q404 -47 390.5 -48.5Q377 -50 367 -50H241Q199 -46 180.5 -27.5Q162 -9 162 15Q162 37 176.0 48.0Q190 59 218.5 63.5Q247 68 290 68ZM288 -262Q336 -262 360.0 -285.5Q384 -309 384 -347Q384 -387 359.5 -413.0Q335 -439 288 -439Q242 -439 216.0 -413.5Q190 -388 190 -348Q190 -323 201.5 -303.5Q213 -284 235.0 -273.0Q257 -262 288 -262Z\"/><path transform=\"translate(2215 0)\" d=\"M304 14Q225 14 165.0 -17.5Q105 -49 71.0 -110.5Q37 -172 37 -264Q37 -356 71.5 -417.0Q106 -478 166.5 -508.5Q227 -539 304 -539Q383 -539 443.5 -508.0Q504 -477 538.5 -415.5Q573 -354 573 -262Q573 -169 537.5 -107.5Q502 -46 441.5 -16.0Q381 14 304 14ZM309 -93Q348 -93 374.5 -111.0Q401 -129 414.5 -165.5Q428 -202 428 -254Q428 -309 413.5 -347.5Q399 -386 371.0 -406.5Q343 -427 300 -427Q263 -427 236.0 -409.5Q209 -392 195.0 -355.5Q181 -319 181 -266Q181 -181 215.0 -137.0Q249 -93 309 -93Z\"/><path transform=\"translate(2830 0)\" d=\"M66 0V-715H208V0Z\"/><path transform=\"translate(3110 0)\" d=\"M304 14Q225 14 165.0 -17.5Q105 -49 71.0 -110.5Q37 -172 37 -264Q37 -356 71.5 -417.0Q106 -478 166.5 -508.5Q227 -539 304 -539Q383 -539 443.5 -508.0Q504 -477 538.5 -415.5Q573 -354 573 -262Q573 -169 537.5 -107.5Q502 -46 441.5 -16.0Q381 14 304 14ZM309 -93Q348 -93 374.5 -111.0Q401 -129 414.5 -165.5Q428 -202 428 -254Q428 -309 413.5 -347.5Q399 -386 371.0 -406.5Q343 -427 300 -427Q263 -427 236.0 -409.5Q209 -392 195.0 -355.5Q181 -319 181 -266Q181 -181 215.0 -137.0Q249 -93 309 -93Z\"/><path transform=\"translate(3725 0)\" d=\"M274 183Q188 183 132.5 169.5Q77 156 51.0 130.0Q25 104 25 65Q25 19 61.5 -10.0Q98 -39 169 -45V-65Q115 -65 86.0 -76.5Q57 -88 57 -117Q57 -145 85.5 -167.0Q114 -189 180 -202V-222Q118 -226 83.0 -262.0Q48 -298 48 -355Q48 -405 76.0 -444.5Q104 -484 159.5 -507.5Q215 -531 296 -531H562V-421L397 -444V-421Q461 -412 489.5 -389.0Q518 -366 518 -325Q518 -284 491.0 -253.0Q464 -222 414.5 -204.5Q365 -187 296 -187Q283 -187 268.0 -188.0Q253 -189 218 -193Q199 -179 188.5 -168.5Q178 -158 178 -149Q178 -142 185.5 -137.0Q193 -132 205.5 -130.0Q218 -128 231 -128H381Q401 -128 433.0 -125.5Q465 -123 497.0 -110.0Q529 -97 551.0 -68.5Q573 -40 573 13Q573 71 540.5 109.0Q508 147 441.5 165.0Q375 183 274 183ZM290 68Q351 68 385.0 61.5Q419 55 433.5 40.5Q448 26 448 4Q448 -16 439.5 -27.0Q431 -38 417.5 -42.5Q404 -47 390.5 -48.5Q377 -50 367 -50H241Q199 -46 180.5 -27.5Q162 -9 162 15Q162 37 176.0 48.0Q190 59 218.5 63.5Q247 68 290 68ZM288 -262Q336 -262 360.0 -285.5Q384 -309 384 -347Q384 -387 359.5 -413.0Q335 -439 288 -439Q242 -439 216.0 -413.5Q190 -388 190 -348Q190 -323 201.5 -303.5Q213 -284 235.0 -273.0Q257 -262 288 -262Z\"/><path transform=\"translate(4332 0)\" d=\"M265 182Q225 182 183.5 174.5Q142 167 105.5 151.5Q69 136 43 112L84 -11Q116 22 164.0 38.5Q212 55 259 55Q312 55 347.5 33.5Q383 12 401.5 -32.5Q420 -77 423 -144L429 -235H407Q397 -169 374.5 -127.0Q352 -85 317.5 -65.5Q283 -46 236 -46Q179 -46 140.0 -75.0Q101 -104 81.5 -162.0Q62 -220 62 -305V-525H206V-340Q206 -247 227.0 -206.0Q248 -165 291 -165Q314 -165 333.0 -177.5Q352 -190 365.5 -214.0Q379 -238 386.5 -272.5Q394 -307 394 -351V-525H538V-139Q538 -76 527.0 -24.5Q516 27 494.5 65.5Q473 104 440.0 130.0Q407 156 363.5 169.0Q320 182 265 182Z\"/></g><circle class=\"acc\" cx=\"827.0\" cy=\"-651.8\" r=\"92.2\"/></svg>";


const ALL_QS = [
  { id: "src", t: "מאיפה לבחור?", d: "מאגר הסדרות שמהן נבחר.", o: [
    ["any", "🌐", "כל הסדרות", "הרשימה האישית, הניו יורק טיימס והמאגר הרחב יחד"],
    ["mine", "⭐", "הרשימה האישית שלי", "הסדרות שבחרתם בעצמכם"],
    ["nyt", "📰", "הניו יורק טיימס", "100 הסדרות הטובות של המאה ה-21, דירוג ספטמבר 2026"],
    ["pool", "🌍", "המאגר הרחב", "500 הסדרות המדורגות ביותר ב-TMDB, מעבר לרשימות"] ] },
  { id: "platforms", multi: true, t: "באילו שירותים אתם צופים?", d: "לפי הזמינות בישראל, מתעדכן כל יום. Disney+ מוערך לפי הזמינות בארה״ב. שירותים ישראליים כמו yes ו-HOT יתווספו בהמשך. אפשר לבחור כמה או לדלג." },
  { id: "genres", multi: true, t: "איזה ז׳אנר מתחשק?", d: "אפשר לבחור כמה, או לדלג." },
  { id: "eras", multi: true, t: "מאיזו תקופה?", d: "לפי שנת הבכורה. אפשר לבחור כמה, או לדלג." },
  { id: "mood", t: "איזה מצב רוח אתם מחפשים הערב?", d: "מה הסדרה צריכה לעשות לכם?", o: [
    ["laugh", "😄", "שתצחיק ותרים", "משהו שמשאיר חיוך"],
    ["feel", "🥹", "שתרגש", "דרמה שנוגעת בלב"],
    ["tense", "⚡", "מתח ואדרנלין", "כזו שקשה ללחוץ בה על עצור"],
    ["think", "🧠", "שתעסיק את המוח", "תעלומות, רעיונות ושאלות גדולות"],
    ["escape", "🚀", "בריחה לעולם אחר", "ממלכות, חלל או עתיד רחוק"],
    ["any", "🤷", "לא משנה", ""] ] },
  { id: "weight", t: "כמה כבד מותר להיות?", d: "העומס הרגשי של הסדרה.", o: [
    [1, "🛋️", "קליל", "אפשר לצפות בלי להתאמץ"],
    [2, "⚖️", "באמצע", "קצת עומק, בלי להכביד"],
    [3, "🌧️", "כבד ומטלטל", "מוכנים לצאת מזה עם משהו על הלב"],
    ["any", "🤷", "לא משנה", ""] ] },
  { id: "company", t: "עם מי צופים?", d: "נתאים את הסדרה לחברה.", o: [
    ["solo", "🧍", "לבד", "זמן איכות עם עצמי"],
    ["couple", "💑", "בזוג", "משהו ששנינו נהנה ממנו"],
    ["family", "👨‍👩‍👧", "עם המשפחה", "מתאים גם לבני נוער"],
    ["any", "🤷", "לא משנה", ""] ] },
  { id: "quality", t: "כמה טובה היא צריכה להיות?", d: "לפי ציון בינג׳: שילוב של IMDb, TMDB, רוטן טומייטו והניו יורק טיימס, יחסית לסדרות ברשימה.", o: [
    [90, "🏆", "מהטובות ברשימה", "ציון בינג׳ 90 ומעלה"],
    [80, "🌟", "מצוינת", "ציון בינג׳ 80 ומעלה"],
    [70, "⭐", "טובה מאוד", "ציון בינג׳ 70 ומעלה"],
    ["any", "🤷", "לא משנה", ""] ] },
  { id: "len", t: "מה אורך הפרק הנוח?", d: "כמה זמן יש לכם בערב.", o: [
    ["s", "⏱️", "עד חצי שעה", "פרק קצר לפני השינה"],
    ["m", "🕐", "בערך 45 דקות", "הסטנדרט הטלוויזיוני"],
    ["l", "🎬", "שעה ומעלה", "כמעט סרט בכל פרק"],
    ["any", "🤷", "לא משנה", ""] ] },
  { id: "seasons", t: "כמה עונות?", d: "אורך הסדרה לאורך השנים.", o: [
    ["one", "🏁", "עונה אחת", "מיני-סדרה, מסיימים מהר"],
    ["few", "📺", "2–3 עונות", "מחויבות סבירה"],
    ["mid", "📚", "4–6 עונות", "סדרה מלאה"],
    ["many", "🏔️", "7 עונות ומעלה", "יש מה לראות חודשים"],
    ["any", "🤷", "לא משנה", ""] ] },
  { id: "lang", t: "באיזו שפה?", d: "שפת המקור של הסדרה.", o: [
    ["en", "🗽", "אנגלית", ""],
    ["he", "🇮🇱", "עברית", "סדרות ישראליות"],
    ["other", "🌍", "שפה אחרת", "קוריאנית, צרפתית או יפנית, עם כתוביות"],
    ["any", "🤷", "לא משנה", ""] ] }
];
let QS = ALL_QS; // set per dataset in boot()
// questions + "what have you seen" + "how to sort"
const totalSteps = () => QS.length + 2;
const SORTS = [
  ["match", "🎯", "הכי מתאימות קודם", "לפי אחוז ההתאמה לתשובות שלכם"],
  ["old", "📼", "הוותיקות קודם", "מבין ההתאמות הכי טובות, מהסדרה הוותיקה לחדשה"],
  ["new", "✨", "החדשות קודם", "מבין ההתאמות הכי טובות, מהסדרה החדשה לוותיקה"],
  ["score", "🏅", "הכי גבוהות בציון", "מבין ההתאמות הכי טובות, לפי ציון בינג׳"] ];
const SORT_NOTE = { old: "מסודרות מהוותיקה לחדשה, מבין ההתאמות הטובות ביותר", new: "מסודרות מהחדשה לוותיקה, מבין ההתאמות הטובות ביותר", score: "מסודרות לפי ציון בינג׳, מבין ההתאמות הטובות ביותר" };
const BS_NAME = { imdb: "IMDb", tmdb: "TMDB", rt: "רוטן טומייטו", nyt: "ניו יורק טיימס" };
const STATUS = { airing: ["עדיין משודרת", "st-air"], ended: ["הסתיימה", "st-end"], canceled: ["בוטלה", "st-cxl"] };

/* state */
const st = { tab: "pick", screen: "intro", step: 0, ans: blankAns(), seen: new Set(), ranked: [], idx: 0, chosen: false, surprise: false, seed: 1, hideSeen: false, dlgId: null, listSrc: "all", listPlat: null, actQuery: "", actMulti: false, actLimit: 60, dlgStack: [], dlgCur: null };
function blankAns() { return { src: null, platforms: [], genres: [], eras: [], mood: null, weight: null, company: null, quality: null, len: null, seasons: null, lang: null, sort: null }; }

const $ = (s, r = document) => r.querySelector(s);
const CHECK = '<svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const ART = {
0:["#4a4f57","#0e1013","#e6e1d6","#b36a3a","stars"],1:["#7a1212","#1a0404","#e8d9b5","#c9a24b","house"],2:["#2e7d32","#0b1f0d","#d7ff6b","#f4f1c8","flask"],3:["#d9822b","#2a1405","#fff0c9","#1f6f78","sun"],
4:["#2c6f8f","#06131b","#e8f4f8","#8ad0e0","split"],5:["#1f2a44","#080b14","#d4af37","#e6ecf5","bars"],6:["#e8c500","#3a3000","#111111","#fff7c2","clock"],7:["#3b4a55","#0b1014","#d9d9d9","#e84a3a","target"],
8:["#c81e2b","#1a0306","#f4f4f4","#2a6df4","bolt"],9:["#2b3a4a","#080c10","#d8dde3","#a8b3be","sword"],10:["#2f4f4f","#0b1515","#e8efe9","#b7d7c9","house"],11:["#1d3b6b","#050c1c","#9bd0ff","#f2d16b","hex"],
12:["#4b5d3a","#0e140a","#a9b78f","#d9d4b0","skyline"],13:["#27324b","#05070d","#e8eaf0","#d9552b","moon"],14:["#1f8a70","#06241c","#f2ffe0","#ffcf5a","mountain"],15:["#2b3f5c","#0a111c","#f0e2c2","#e08a3a","window"],
16:["#f2b705","#4a3200","#fff5cc","#1f1f1f","sun"],17:["#59606b","#0d1014","#f0f2f5","#e07b39","rings"],18:["#a30f1b","#1a0204","#f4f4f4","#ff6b6b","diag"],19:["#3a1f5c","#0c0618","#d4af37","#f3e6b3","crown"],
20:["#1f5f6b","#041a1f","#f5f5f5","#7fe0d0","cross"],21:["#2aa5a0","#05302d","#fff6e6","#ffb3c1","lotus"],22:["#3f6b3a","#0a140a","#e8f2d9","#d9822b","mountain"],23:["#1f4e5f","#050f14","#cfe3ea","#e8a33d","waves"],
24:["#4a4a4a","#0c0c0c","#ff8a00","#e8e8e8","bars"],25:["#1d3f7a","#08142a","#e63946","#f1f5f9","split"],26:["#a30f1b","#1a0204","#ffffff","#7a0a12","eye"],27:["#c98a4b","#2b1a0c","#f6e7c9","#2b3a4a","sun"],
28:["#7a1f2e","#1a060a","#f4f4f4","#b8b8b8","cards"],29:["#0f5b6b","#021c22","#e8fbff","#ff5a5f","pulse"],30:["#8a1c1c","#1a0505","#ffb347","#ffe0a3","flame"],31:["#2b3f55","#0a121a","#d9e4ee","#e84a3a","globe"],
32:["#6f8faa","#13202b","#f2f7fb","#d9482b","mountain"],33:["#1f4f5f","#071a21","#f0e2b8","#c9a24b","stripes"],34:["#ff7aa2","#4a1230","#fff0c9","#3fd0c9","sun"],35:["#2c3e50","#080c10","#e8d7a0","#c0572b","tent"],
36:["#4a4f3a","#0e100a","#e8e4c9","#c9a24b","keyhole"],37:["#0f2b4a","#030a14","#ffffff","#e63946","clock"],38:["#3a4a2b","#0a0f06","#f2d230","#1a1a1a","radiation"],39:["#1a1a1f","#000000","#d9d9e0","#6a6a78","crack"],
40:["#1f7a3a","#062a12","#fff7c2","#1d4ed8","stripes"],41:["#8c2f1b","#240a05","#f1dfb5","#c9a24b","bars"],42:["#3aa0ff","#06223f","#ffffff","#b6e0ff","cloud"],43:["#6b4a2b","#160d05","#e8c89a","#c0572b","diag"],
44:["#2b7a3d","#06210f","#f4e8b0","#d9822b","mountain"],45:["#3a3a3a","#0a0a0a","#e8e8e8","#ff8a00","keyhole"],46:["#2a2a3a","#08080f","#f0f0f0","#e0a03a","skyline"],47:["#4a5a4a","#0c120c","#e8ecdc","#c9a24b","reels"],
48:["#1b3a6b","#060f20","#f0f4fa","#c0272d","chevron"],49:["#7a0f2a","#12020a","#ff5a6e","#ffd2d9","stars"],50:["#0f3d5c","#030c14","#7fd6ff","#ff8a5c","split"],51:["#16261f","#030806","#cfe8d8","#7fdc9a","spot"],
52:["#e86a1c","#3a1503","#ffffff","#ffd1a8","stripes"],53:["#7a1f1f","#150404","#f4f4f4","#1a1a1a","chevron"],54:["#1f3b2a","#050f09","#d4af37","#f3e6b3","rings"],55:["#3a3a5a","#0c0c1a","#f2d9a0","#c9a24b","window"],
56:["#6b5a3a","#140f08","#e8dcc0","#c0392b","diag"],57:["#6a1b1b","#120404","#e8e8e8","#2b2b2b","stripes"],58:["#ffd6a5","#b5651d","#ffffff","#a0d8ef","cloud"],59:["#e0245e","#2a0414","#ffffff","#16a085","shapes"],
60:["#7a1f4d","#220a1a","#ff5fa2","#ffd1e3","eye"],61:["#14305f","#0a1428","#e63946","#f1f5f9","stripes"],62:["#f08a24","#7a2a0a","#fff3d6","#ffd166","skyline"],63:["#1f5f4a","#0a2219","#f2d16b","#a6e3c2","spot"],
64:["#5b3a8c","#1b0f33","#ffb38a","#ffd9c2","skyline"],65:["#2f6aa3","#10253d","#cfe6ff","#f5c542","window"],66:["#e8b923","#5a3a07","#2a5db0","#fff4c2","house"],67:["#f08fb4","#5b1d3a","#fff0f6","#ffd54a","window"],
68:["#0f3d6e","#06182c","#ffb000","#ffe29a","spot"],69:["#3c6e71","#122a2b","#e9f1f1","#f2c14e","window"],70:["#5a1fa8","#1a0a33","#ff3d7f","#ffe03d","split"],71:["#2a2a2a","#050505","#f5c542","#fff2c0","spot"],
72:["#8a4b1e","#2b1507","#f2b36b","#ffe0b3","mountain"],73:["#4b5d2a","#151c0c","#d9e4b0","#f2d16b","chevron"],74:["#1e5fd6","#0a1e4d","#ffd23f","#ffffff","split"],75:["#0f8a8a","#04302f","#ff9a3d","#ffe0b0","waves"],
76:["#1b3b3d","#050f10","#e0a63a","#cfe9e5","stars"],77:["#6aa84f","#1b3310","#fff0a8","#c9e8b0","sun"],78:["#7d1f3a","#26080f","#f7e6c4","#e0a458","house"],79:["#3d4a2a","#0b0f06","#d9822b","#e8d9a0","rings"],
80:["#102a5c","#050c1f","#ff4d3d","#9ec5ff","stars"],81:["#2a4b6b","#08121c","#9fd0ff","#ffffff","split"],82:["#555b63","#14161a","#f2c94c","#ffffff","spot"],83:["#7b2cbf","#1a0733","#ffd166","#f8e1ff","spot"],
84:["#3a3a3a","#0b0b0b","#c05a2b","#e0d7c3","diag"],85:["#5d7a91","#1a2630","#ffd23f","#e8f0f6","mountain"],86:["#12a39a","#053a37","#ffe24d","#ffffff","skyline"],87:["#2b5d9c","#0b1d38","#fbeed7","#ff8f6b","pair"],
88:["#2f8f4e","#0c3318","#ffd23f","#e8ffd0","sun"],89:["#1a2748","#080d1a","#d4af37","#f3e6b3","house"],90:["#27333f","#0a0e12","#e04848","#c8d4df","globe"],91:["#ff7a59","#5c1f4a","#fff1e6","#ffd23f","window"],
92:["#0b2a4a","#030d18","#b5f23d","#ffffff","bars"],93:["#ff3d8b","#4a0a29","#ffe14d","#ffffff","diag"],94:["#b3121f","#2a0206","#ffffff","#ffd23f","spot"],95:["#8e7dff","#241a66","#ffe14d","#7ae0d0","stripes"],
96:["#2a5fb0","#0a1a38","#ff8a3d","#ffffff","eye"],97:["#c2188f","#3a0530","#ffd700","#fff0fa","stars"],98:["#8a1c1c","#260606","#e8e8e8","#c4c4c4","bars"],99:["#c4561e","#2c0f06","#f7d9a8","#1f6f78","globe"],
100:["#4f6d8f","#10192a","#eaf4ff","#9bb8d6","mountain"],101:["#e09f1f","#2a1a04","#0e2a4f","#fff1c9","grid"],102:["#b8231a","#2d0805","#fbe9c9","#e8b24a","plate"],103:["#12284a","#050c18","#d4af37","#e6ecf5","chevron"],
104:["#c4161c","#1a0204","#ffffff","#ffb400","split"],105:["#2d2d3a","#0a0a10","#f2c14e","#e2e2ee","target"],106:["#222222","#050505","#ff6b1a","#ffd9b8","plate"],107:["#5aa9e6","#143252","#ffd6e8","#fff6b8","sun"],
108:["#ff9f43","#6a2f05","#fff4e0","#4a90d9","house"],109:["#f5c518","#4a3a00","#1c5bbf","#fff7cc","sun"],110:["#6b1f2e","#1f080d","#f1e3d0","#d4af37","bars"],111:["#4a4a4f","#101012","#ff5a47","#f2f2f2","window"],
112:["#6b4a2f","#1c120b","#f4e4c1","#b5651d","grid"],113:["#f2a65a","#5a2d0c","#fff3e0","#7a1f5c","pair"],114:["#c79a5a","#2f1f0a","#1a1a1a","#fff1d6","target"],115:["#0e4a7a","#021a2e","#4cd18a","#bfe9ff","globe"],
116:["#f6b8d0","#6b2a45","#fff7e6","#74c69d","tent"],117:["#8c1c1c","#1a0505","#f4e3c1","#d9a441","sun"],118:["#e8742c","#4a1a05","#1f7a8c","#ffe8cc","mountain"],119:["#5a1414","#150303","#ff6b6b","#ffe0e0","heart"],
120:["#1f4e8c","#07172e","#e63946","#ffffff","diag"],121:["#e2557a","#47112a","#fff0d9","#7ad0e0","pair"],122:["#0f1a3d","#02040f","#f0e6b8","#8fa5ff","stars"],123:["#0f3d1f","#020a05","#4cff7a","#b5ffcc","grid"],
124:["#2f6fe0","#0a1a42","#ffd23f","#ffffff","grid"],125:["#5b3ea8","#140a33","#d9c8ff","#ffe08a","eye"],126:["#c4622d","#3d1a09","#fff0d4","#7a3b1a","house"],127:["#6b1d1d","#150404","#f5f5f5","#c8a24a","chevron"]
};
const MOTIF = {
  crown: (a, b) => `<path d="M64 128 L58 62 L92 92 L120 52 L148 92 L182 62 L176 128 Z" fill="${a}"/><rect x="64" y="132" width="112" height="14" rx="4" fill="${b}"/><circle cx="58" cy="58" r="8" fill="${b}"/><circle cx="120" cy="48" r="8" fill="${b}"/><circle cx="182" cy="58" r="8" fill="${b}"/>`,
  flask: (a, b) => `<path d="M104 36 H136 V72 L172 132 Q180 146 164 146 H76 Q60 146 68 132 L104 72 Z" fill="none" stroke="${a}" stroke-width="7" stroke-linejoin="round"/><path d="M88 112 H152 L170 138 Q172 142 166 142 H74 Q68 142 70 138 Z" fill="${b}" opacity=".9"/><rect x="98" y="28" width="44" height="10" rx="4" fill="${a}"/><circle cx="116" cy="96" r="5" fill="${b}"/><circle cx="132" cy="84" r="4" fill="${b}"/>`,
  cross: (a, b) => `<rect x="96" y="40" width="48" height="104" rx="10" fill="${a}"/><rect x="68" y="68" width="104" height="48" rx="10" fill="${a}"/><circle cx="120" cy="92" r="12" fill="${b}"/>`,
  hex: (a, b) => [58, 42, 26].map((r, k) => `<polygon points="${[0, 1, 2, 3, 4, 5].map(i => { const t = Math.PI / 180 * (60 * i - 30); return (120 + r * Math.cos(t)).toFixed(1) + "," + (86 + r * Math.sin(t)).toFixed(1); }).join(" ")}" fill="none" stroke="${k % 2 ? b : a}" stroke-width="7" stroke-linejoin="round"/>`).join(""),
  sword: (a, b) => `<polygon points="120,28 131,100 109,100" fill="${a}"/><rect x="80" y="100" width="80" height="10" rx="4" fill="${b}"/><rect x="114" y="110" width="12" height="30" fill="${b}"/><circle cx="120" cy="146" r="8" fill="${a}"/>`,
  cards: (a, b, bg) => `<g transform="rotate(-16 120 90)"><rect x="70" y="40" width="70" height="98" rx="8" fill="${b}"/></g><rect x="85" y="36" width="70" height="98" rx="8" fill="${a}"/><g transform="rotate(16 120 90)"><rect x="100" y="40" width="70" height="98" rx="8" fill="${b}" opacity=".85"/></g><path d="M120 70 l12 18 -12 18 -12 -18z" fill="${bg}"/>`,
  radiation: (a, b, bg) => [90, 210, 330].map(c => { const q = ang => [120 + 56 * Math.cos(ang * Math.PI / 180), 86 - 56 * Math.sin(ang * Math.PI / 180)], [x1, y1] = q(c - 30), [x2, y2] = q(c + 30); return `<path d="M120 86 L${x1.toFixed(1)} ${y1.toFixed(1)} A56 56 0 0 0 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${a}"/>`; }).join("") + `<circle cx="120" cy="86" r="12" fill="${a}"/><circle cx="120" cy="86" r="5" fill="${bg}"/>`,
  shapes: (a, b) => `<circle cx="72" cy="86" r="26" fill="none" stroke="${a}" stroke-width="8"/><polygon points="120,56 148,112 92,112" fill="none" stroke="${b}" stroke-width="8" stroke-linejoin="round"/><rect x="164" y="62" width="48" height="48" fill="none" stroke="${a}" stroke-width="8"/>`,
  lotus: (a, b) => `<g transform="translate(120 132)">${[-62, -31, 31, 62, 0].map((r, k) => `<ellipse cx="0" cy="-34" rx="16" ry="40" transform="rotate(${r})" fill="${k === 4 ? a : b}" opacity="${k === 4 ? 1 : .88}" stroke="${a}" stroke-width="2"/>`).join("")}</g><rect x="40" y="134" width="160" height="4" rx="2" fill="${b}"/>`,
  bolt: (a, b) => `<polygon points="136,28 84,96 114,96 100,148 158,76 126,76" fill="${a}" stroke="${b}" stroke-width="6" stroke-linejoin="round"/>`,
  moon: (a, b, bg) => `<circle cx="120" cy="86" r="52" fill="${a}"/>${[[100, 66, 10], [140, 98, 13], [112, 108, 7], [138, 64, 6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${bg}" opacity=".35"/>`).join("")}${[[40, 40], [190, 36], [200, 120], [34, 120], [60, 70]].map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="${k % 2 ? 2 : 3}" fill="${b}"/>`).join("")}`,
  keyhole: (a, b, bg) => `<rect x="54" y="30" width="132" height="124" rx="30" fill="${a}" opacity=".9"/><circle cx="120" cy="82" r="22" fill="${bg}"/><path d="M108 94 L102 130 H138 L132 94 Z" fill="${bg}"/>`,
  reels: (a, b) => `<circle cx="78" cy="84" r="34" fill="none" stroke="${a}" stroke-width="7"/><circle cx="162" cy="84" r="34" fill="none" stroke="${a}" stroke-width="7"/>${[78, 162].map(x => [0, 120, 240].map(r => `<circle cx="${x}" cy="84" r="5" fill="${b}" transform="rotate(${r} ${x} 84) translate(0 -18)"/>`).join("")).join("")}<rect x="78" y="124" width="84" height="12" rx="4" fill="${b}"/>`,
  clock: (a, b) => `<circle cx="120" cy="86" r="54" fill="none" stroke="${a}" stroke-width="8"/>${[...Array(12)].map((_, i) => `<line x1="120" y1="40" x2="120" y2="${i % 3 ? 46 : 52}" stroke="${b}" stroke-width="${i % 3 ? 3 : 5}" transform="rotate(${i * 30} 120 86)"/>`).join("")}<path d="M120 86 V54 M120 86 L146 100" stroke="${a}" stroke-width="7" stroke-linecap="round"/><circle cx="120" cy="86" r="6" fill="${b}"/>`,
  crack: (a, b) => `<rect x="50" y="30" width="140" height="122" rx="8" fill="none" stroke="${a}" stroke-width="5" opacity=".7"/><path d="M168 30 L136 72 L156 80 L118 118 L132 126 L98 152" fill="none" stroke="${b}" stroke-width="5" stroke-linejoin="round"/><path d="M136 72 L100 66 M118 118 L84 112" stroke="${a}" stroke-width="3" opacity=".7"/>`,
  pulse: (a, b) => `<path d="M24 92 H78 L92 60 L108 120 L122 44 L138 108 L148 92 H216" fill="none" stroke="${a}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="216" cy="92" r="7" fill="${b}"/>`,
  flame: (a, b) => `<path d="M120 28 C132 56 168 70 160 112 C156 134 138 148 120 148 C100 148 82 134 80 114 C78 94 96 84 100 64 C110 78 112 56 120 28 Z" fill="${a}"/><path d="M120 76 C128 92 146 98 142 118 C140 130 130 138 120 138 C110 138 100 130 100 118 C100 104 114 100 120 76 Z" fill="${b}"/>`,
  cloud: (a, b) => `<g fill="${a}"><circle cx="86" cy="96" r="28"/><circle cx="122" cy="80" r="36"/><circle cx="162" cy="98" r="26"/><rect x="62" y="96" width="126" height="28" rx="14"/></g><circle cx="196" cy="42" r="12" fill="${b}"/>`,
  sun: (a, b, bg) => `<circle cx="120" cy="82" r="48" fill="${a}"/>${[0, 1, 2, 3].map(k => `<rect x="60" y="${94 + k * 11}" width="120" height="${3 + k * 2}" fill="${bg}"/>`).join("")}<rect x="40" y="148" width="160" height="3" fill="${b}" opacity=".8"/>`,
  stripes: (a, b) => `<g transform="rotate(-16 120 90)">${[0, 1, 2, 3, 4, 5].map(k => `<rect x="-40" y="${-10 + k * 28}" width="320" height="14" fill="${k % 2 ? b : a}" opacity=".9"/>`).join("")}</g>`,
  rings: (a, b) => [56, 44, 32, 20, 8].map((r, k) => `<circle cx="120" cy="84" r="${r}" fill="none" stroke="${k % 2 ? b : a}" stroke-width="7"/>`).join(""),
  skyline: (a, b) => `<circle cx="178" cy="40" r="17" fill="${b}"/>${[[18, 28, 48], [48, 22, 78], [72, 30, 58], [104, 26, 96], [132, 24, 66], [158, 30, 84], [190, 28, 46]].map(([x, w, h]) => `<rect x="${x}" y="${150 - h}" width="${w}" height="${h}" fill="${a}" opacity=".92"/>${[0, 1, 2].map(r => `<rect x="${x + 5}" y="${158 - h + r * 14}" width="4" height="6" fill="${b}"/><rect x="${x + w - 10}" y="${158 - h + r * 14}" width="4" height="6" fill="${b}"/>`).join("")}`).join("")}<rect x="0" y="150" width="240" height="4" fill="${a}"/>`,
  mountain: (a, b) => `<circle cx="190" cy="38" r="15" fill="${b}"/><polygon points="0,150 80,56 128,118 170,48 240,150" fill="${a}" opacity=".9"/><polygon points="0,150 60,100 120,150" fill="${b}" opacity=".55"/>`,
  waves: (a, b) => `<circle cx="170" cy="48" r="24" fill="${a}"/>${[0, 1, 2, 3].map(k => `<path d="M0 ${88 + k * 18} Q30 ${74 + k * 18} 60 ${88 + k * 18} T120 ${88 + k * 18} T180 ${88 + k * 18} T240 ${88 + k * 18} V160 H0Z" fill="${k % 2 ? b : a}" opacity="${0.55 + k * 0.1}"/>`).join("")}`,
  grid: (a, b) => `${[0, 1, 2, 3].map(r => [0, 1, 2, 3, 4, 5, 6, 7].map(c => (r + c) % 2 ? "" : `<rect x="${c * 30}" y="${30 + r * 30}" width="30" height="30" fill="${a}" opacity=".85"/>`).join("")).join("")}<rect x="0" y="28" width="240" height="2" fill="${b}"/><rect x="0" y="150" width="240" height="2" fill="${b}"/>`,
  stars: (a, b, bg) => `<circle cx="140" cy="62" r="32" fill="${a}"/><circle cx="154" cy="54" r="28" fill="${bg}"/>${[[30, 34], [62, 92], [200, 118], [40, 126], [92, 40], [206, 30], [180, 138], [70, 60]].map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="${k % 3 ? 1.8 : 2.8}" fill="${b}"/>`).join("")}`,
  bars: (a, b) => [40, 70, 55, 92, 60, 100, 50, 80, 45].map((h, k) => `<rect x="${24 + k * 22}" y="${150 - h}" width="14" height="${h}" rx="2" fill="${k % 2 ? b : a}" opacity=".92"/>`).join(""),
  spot: (a, b) => `<polygon points="120,0 52,150 188,150" fill="${a}" opacity=".28"/><ellipse cx="120" cy="150" rx="68" ry="12" fill="${a}" opacity=".5"/><circle cx="120" cy="104" r="12" fill="${b}"/><rect x="108" y="116" width="24" height="30" rx="8" fill="${b}"/>`,
  split: (a, b) => `<path d="M114 34A50 50 0 0 0 114 134Z" fill="${a}"/><path d="M126 34A50 50 0 0 1 126 134Z" fill="${b}"/>`,
  plate: (a, b) => `<circle cx="120" cy="84" r="50" fill="none" stroke="${a}" stroke-width="6"/><circle cx="120" cy="84" r="34" fill="${b}" opacity=".3"/><g stroke="${a}" stroke-width="4" stroke-linecap="round" fill="none"><path d="M38 36v32M46 36v32M54 36v32M46 68v54"/><path d="M202 36c-12 16-12 40 0 52v36"/></g>`,
  tent: (a, b) => `<polygon points="14,150 120,34 226,150" fill="${a}"/><polygon points="120,34 96,150 144,150" fill="${b}"/>${[0, 1, 2, 3, 4, 5, 6].map(k => `<polygon points="${22 + k * 32},24 ${42 + k * 32},24 ${32 + k * 32},40" fill="${k % 2 ? a : b}"/>`).join("")}`,
  window: (a, b, bg) => [0, 1].map(r => [0, 1, 2].map(c => { const lit = (r + c * 2) % 3 === 0; return `<rect x="${34 + c * 62}" y="${34 + r * 58}" width="52" height="46" rx="4" fill="${lit ? b : a}" opacity="${lit ? 1 : 0.5}"/><path d="M${60 + c * 62} ${34 + r * 58}v46M${34 + c * 62} ${57 + r * 58}h52" stroke="${bg}" stroke-width="2"/>`; }).join("")).join(""),
  diag: (a, b) => [0, 1, 2].map(k => `<polygon points="${20 + k * 72},150 ${58 + k * 72},24 ${84 + k * 72},24 ${46 + k * 72},150" fill="${k === 1 ? b : a}" opacity=".9"/>`).join(""),
  globe: (a, b) => `<circle cx="120" cy="84" r="52" fill="none" stroke="${a}" stroke-width="4"/><ellipse cx="120" cy="84" rx="22" ry="52" fill="none" stroke="${a}" stroke-width="3"/><ellipse cx="120" cy="84" rx="40" ry="52" fill="none" stroke="${a}" stroke-width="2" opacity=".6"/><path d="M68 84h104M76 58h88M76 110h88" stroke="${a}" stroke-width="3"/><circle cx="150" cy="62" r="7" fill="${b}"/>`,
  target: (a, b) => `<circle cx="120" cy="84" r="52" fill="none" stroke="${a}" stroke-width="5"/><circle cx="120" cy="84" r="34" fill="none" stroke="${b}" stroke-width="5"/><circle cx="120" cy="84" r="16" fill="${a}"/><path d="M120 22v124M58 84h124" stroke="${b}" stroke-width="2"/>`,
  eye: (a, b, bg) => `<path d="M34 84Q120 14 206 84Q120 154 34 84Z" fill="none" stroke="${a}" stroke-width="6"/><circle cx="120" cy="84" r="27" fill="${b}"/><circle cx="120" cy="84" r="11" fill="${bg}"/><circle cx="130" cy="74" r="5" fill="${a}"/>`,
  heart: (a, b, bg) => `<path d="M120 138C58 98 66 40 100 46C112 48 120 60 120 60C120 60 128 48 140 46C174 40 182 98 120 138Z" fill="${a}"/><path d="M120 60L110 84L128 98L116 120" fill="none" stroke="${bg}" stroke-width="4" stroke-linejoin="round"/>`,
  pair: (a, b) => `<circle cx="96" cy="84" r="42" fill="${a}" opacity=".9"/><circle cx="146" cy="84" r="42" fill="${b}" opacity=".85"/>`,
  house: (a, b) => `<polygon points="46,150 46,92 120,38 194,92 194,150" fill="${a}"/><polygon points="34,98 120,30 206,98" fill="none" stroke="${b}" stroke-width="6" stroke-linejoin="round"/><rect x="106" y="108" width="28" height="42" rx="3" fill="${b}"/><rect x="62" y="102" width="24" height="22" fill="${b}"/><rect x="154" y="102" width="24" height="22" fill="${b}"/>`,
  chevron: (a, b) => `<path d="M48 64L120 28L192 64" fill="none" stroke="${a}" stroke-width="16"/><path d="M48 96L120 60L192 96" fill="none" stroke="${b}" stroke-width="16"/><path d="M48 128L120 92L192 128" fill="none" stroke="${a}" stroke-width="16"/>`
};
function mix(c1, c2, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), x = p(c1), y = p(c2);
  return "#" + x.map((v, k) => Math.round(v + (y[k] - v) * t).toString(16).padStart(2, "0")).join("");
}
function wrapTitle(n) {
  const lines = []; let cur = "";
  for (const w of n.split(" ")) {
    if (cur && (cur + " " + w).length > 13) { lines.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}
let _gid = 0;
function art(i, cls) {
  const s = S[i], [c1, c2, a, b, m] = ART[i] || ["#333333", "#111111", "#dddddd", "#ffffff", "rings"];
  const id = "pg" + (++_gid);
  const lines = wrapTitle(s.n), long = Math.max(...lines.map(l => l.length));
  const fs = lines.length > 3 || long > 13 ? 20 : long > 10 ? 25 : 30, lh = Math.round(fs * 1.1), y0 = 204 - (lines.length - 1) * lh;
  const txt = lines.map((l, k) => `<tspan x="14" y="${y0 + k * lh}">${esc(l)}</tspan>`).join("");
  return `<svg class="poster ${cls}" viewBox="0 0 240 216" role="img" aria-label="${esc(s.n)}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${id}a" x1="0" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient><linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></linearGradient></defs><rect width="240" height="216" fill="url(#${id}a)"/><g transform="translate(12 -8) scale(.9)">${MOTIF[m](a, b, mix(c1, c2, .42))}</g><rect width="240" height="216" fill="url(#${id}b)"/><text fill="#fff" font-family="'Secular One','Assistant',system-ui,sans-serif" font-size="${fs}" direction="ltr" style="unicode-bidi:isolate">${txt}</text></svg>`;
}
function poster(i, cls) {
  if (safeImg(S[i].poster)) return `<img class="poster ${cls || ""}" src="${safeImg(S[i].poster)}" alt="" loading="lazy" data-pi="${i}" data-pc="${cls || ""}">`;
  return art(i, cls || "");
}

/* ranking */
const CROSS = '<svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

function rank(surprise) {
  const rnd = mulberry(Math.floor(Math.random() * 1e9));
  const a = st.ans;
  const answered = a.genres.length || a.eras.length || a.mood || a.weight || a.company || a.quality || a.len || a.seasons || a.lang;
  const out = [];
  const pool = new Set(poolIds(a.src, a.platforms));
  S.forEach((s, i) => {
    if (st.seen.has(i) || !pool.has(i)) return;
    if (surprise || !answered) { out.push({ i, sc: rnd(), pct: null, why: [{ ok: true, t: "נבחרה באקראי מתוך הרשימה" }] }); return; }
    const { norm, pct, items } = scoreSeries(s, a);
    const hits = items.filter(x => x.ok).sort((x, y) => y.w - x.w).slice(0, 5);
    const misses = items.filter(x => !x.ok).sort((x, y) => y.w - x.w).slice(0, 2);
    out.push({ i, sc: norm + ((s.bs ?? 50) - 50) / 50 * 0.04 + rnd() * 0.02, pct, why: hits.concat(misses) });
  });
  out.sort((x, y) => y.sc - x.sc);
  st.ranked = out; st.idx = 0; st.chosen = false; st.surprise = surprise || !answered;
}


const crew = i => S[i].creators.map(x => x.replace(/\s*\(.*\)/, "").replace(/^בהפקת /, "").trim()).filter(Boolean);
function similar(i, n) {
  const s = S[i], mine = crew(i);
  return S.map((o, j) => {
    if (j === i) return null;
    const g = o.g.filter(x => s.g.includes(x)), m = o.mo.filter(x => s.mo.includes(x));
    const shared = crew(j).filter(x => mine.includes(x));
    const sc = (shared.length ? 4 : 0) + 2 * g.length + 1.2 * m.length + (o.h === s.h ? 1 : Math.abs(o.h - s.h) === 1 ? 0.3 : -0.5) + (o.lang === s.lang ? 0.3 : 0) + (o.providers.some(p => s.providers.includes(p)) ? 0.2 : 0) + (Math.abs(o.y - s.y) <= 5 ? 0.3 : 0) + o.imdb / 20;
    const why = shared.length ? `מאותם יוצרים (${shared[0]})` : g.length ? "גם " + g.slice(0, 2).map(x => GENRES[x]).join(" ו") + (m.length ? ", באותו מצב רוח" : "") : "באותו מצב רוח";
    return { j, sc, why };
  }).filter(Boolean).sort((a, b) => b.sc - a.sc).slice(0, n || 4);
}
function moreHTML(i) {
  const s = S[i];
  const rows = [];
  if (s.creators.length) rows.push(`<dt>יוצרים</dt><dd>${s.creators.map(n => `<bdi>${esc(n)}</bdi>`).join(", ")}</dd>`);
  if (s.cast.length) rows.push(`<dt>${s.castLabel || "בכיכוב"}</dt><dd>${actorLinks(s.cast.map(c => c.name).join(", "))}</dd>`);
  const aw = (s.nyt ? [["📰", `מקום ${s.nyt} ברשימת 100 הסדרות הטובות של המאה ה-21 של הניו יורק טיימס (2026)`]] : []).concat(s.awards.map(a => ["🏆", a]));
  return `<section class="more" aria-label="עוד על הסדרה">
    ${rows.length ? `<div class="sec"><h3>מי עומד מאחורי הסדרה</h3><dl>${rows.join("")}</dl></div>` : ""}
    ${aw.length ? `<div class="sec"><h3>פרסים והכרה</h3><ul class="aw">${aw.map(a => `<li><span aria-hidden="true">${a[0]}</span><span>${a[1]}</span></li>`).join("")}</ul></div>` : ""}
    <div class="sec"><h3>אם אהבתם, אולי גם</h3><div class="sim">${similar(i).map(x => `<button class="tile${st.seen.has(x.j) ? " seen" : ""}" data-a="detail" data-i="${x.j}" aria-label="${esc(S[x.j].n)}">${poster(x.j, "")}<span class="badge">${CHECK}</span><span class="cap"><bdi>${esc(S[x.j].n)}</bdi></span><span class="why2">${x.why}</span></button>`).join("")}</div></div>
    <p class="note">מוצגים הפרסים הבולטים בלבד, לא רשימה מלאה.</p>
  </section>`;
}


function praiseHTML(s) {
  const p = s.praise;
  return p ? `<p class="praise"><b>המבקרים בקצרה</b>${p}</p>` : "";
}

/* helpers */
function trailerHTML(s) {
  const q = (/[\u0590-\u05FF]/.test(s.n) ? s.n + " טריילר רשמי" : s.n + " TV series official trailer");
  const url = "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
  return `<div class="trail"><a href="${url}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M6 4l10 6-10 6z" fill="currentColor"/></svg>צפייה בטריילר<span class="sr"> (נפתח בלשונית חדשה ביוטיוב)</span></a><button class="linkbtn" data-a="copylink" data-u="${url}">העתקת קישור</button></div>`;
}
function metaHTML(s) {
  return `<div class="meta">${s.y ? `<span>${s.y}</span>` : ""}<span>${s.s === 1 ? "עונה אחת" : s.s + " עונות"}</span><span>${s.e} פרקים</span><span>כ-${s.m} דק׳ לפרק</span>${STATUS[s.status] ? `<span class="stat ${STATUS[s.status][1]}">${STATUS[s.status][0]}</span>` : ""}</div>`;
}
function ratesHTML(s) {
  const bsTip = s.bs == null ? "" : Object.entries(s.bsParts).map(([k, p]) => `${BS_NAME[k]}: אחוזון ${Math.round(p * 100)}`).join(" · ");
  return `<div class="rates">${s.bs != null ? `<span class="rate bs" title="${bsTip}"><b>ציון בינג׳</b> ${s.bs}</span>` : ""}${s.imdb != null ? `<span class="rate"><b>IMDb</b> ${s.imdb.toFixed(1)}</span>` : ""}${s.rt != null ? `<span class="rate"><b>רוטן טומייטו</b> ${s.rt}%</span>` : ""}${s.nyt ? `<span class="rate"><b>ניו יורק טיימס</b> מקום ${s.nyt}</span>` : ""}${s.minAge != null ? `<span class="rate"><b>גיל</b> ${s.minAge ? s.minAge + "+" : "לכל הגילים"}</span>` : ""}${s.tmdbVote != null ? `<span class="rate"><b>TMDB</b> ${s.tmdbVote.toFixed(1)}</span>` : ""}<span class="rate"><b>שפה</b> ${LNAME[s.lang] || s.lang}</span></div>`;
}
function tagsHTML(s) { return `<div class="tags">${s.lists.includes("mine") ? `<span class="tag pick">⭐ בחירה אישית</span>` : ""}${s.g.map(g => `<span class="tag">${GENRES[g]}</span>`).join("")}</div>`; }
function bulbs(n) { let h = ""; for (let i = 0; i < totalSteps(); i++) h += `<i class="bulb${i <= n ? " on" : ""}"></i>`; return `<div class="bulbs" role="img" aria-label="שלב ${n + 1} מתוך ${totalSteps()}">${h}</div>`; }
function tile(i, mode, cap) {
  const s = S[i], seen = st.seen.has(i);
  const pre = st.tab === "list" && st.listSrc === "nyt" && s.nyt ? s.nyt + ". " : "";
  return `<button class="tile${seen ? " seen" : ""}" data-a="${mode}" data-i="${i}" ${mode === "toggle" ? `aria-pressed="${seen}"` : ""} aria-label="${esc(s.n)}${seen ? ", סומנה כנצפתה" : ""}">${poster(i, "")}<span class="badge">${CHECK}</span>${cap ? `<span class="cap">${pre}<bdi>${esc(s.n)}</bdi></span>` : ""}</button>`;
}

/* screens */
function header() {
  return `<header class="top"><div class="brandrow"><button class="brand" data-a="home" aria-label="Bingology, לעמוד הבית">${LOGO}</button><div class="hacts">${inviteBtn()}${bellNow()}</div></div>
  <div class="tabs" role="tablist"><button class="tab" role="tab" data-a="tab" data-v="pick" aria-selected="${!onNews() && st.tab === "pick"}">המלצה</button><button class="tab" role="tab" data-a="tab" data-v="list" aria-selected="${!onNews() && st.tab === "list"}">הרשימה<span class="tn"> (${S.length})</span></button><button class="tab" role="tab" data-a="tab" data-v="actors" aria-selected="${!onNews() && st.tab === "actors"}">שחקנים/ניות</button><button class="tab" role="tab" data-a="tab" data-v="search" aria-label="חיפוש" aria-selected="${!onNews() && st.tab === "search"}"><span aria-hidden="true">🔍</span><span class="tl"> חיפוש</span></button><button class="tab" role="tab" data-a="tab" data-v="games" aria-selected="${!onNews() && st.tab === "games"}">משחקים</button><button class="tab" role="tab" data-a="tab" data-v="mine" aria-selected="${!onNews() && st.tab === "mine"}">שלי</button></div></header>`;
}

function introHTML() {
  const fan = [[59, -2, "-9deg"], [4, -1, "-4deg"], [40, 0, "0deg"], [2, 1, "4deg"], [34, 2, "9deg"]];
  return `<section class="hero">
    <div class="fan" aria-hidden="true">${fan.map(f => `<div class="fcard" style="--k:${f[1]};--r:${f[2]}">${poster(f[0], "")}</div>`).join("")}</div>
    <h1 data-focus tabindex="-1">לא מצליחים להחליט?</h1>
    <p>${QS.length} שאלות סגורות והבחירה האולטימטיבית שלכם מתוך ${S.length} סדרות מובילות.</p>
    <div class="stack"><button class="btn primary" data-a="start">מתחילים</button><button class="linkbtn" data-a="surprise">או פשוט תפתיעו אותי</button></div>
    ${gamesCardHTML()}
    ${stripHTML(stripItems(st.news || [], S, today()), S, today())}
  </section>`;
}
/** Home card: today's games (Israel date, recomputed on every render), progress and streak. */
function gamesCardHTML() {
  const t = israelToday(), n = dayProgress(store, t), total = loadTotal(store, t), k = gamesStreak(store, t);
  return `<button class="gcard" data-a="tab" data-v="games"><span class="gc-ic" aria-hidden="true">🧩</span><span class="gc-t"><b>המשחקים של היום</b><small>${total != null ? `${n}/${total}` : `${n} הושלמו`}${k > 0 ? ` · רצף ${k} 🔥` : ""}</small></span><span class="gc-go" aria-hidden="true">‹</span></button>`;
}

function qHTML() {
  const step = st.step;
  const head = `<div class="qhead"><button class="linkbtn" data-a="back">${step === 0 ? "לדף הראשי" : "חזרה"}</button>${bulbs(step)}<span class="count">${step < QS.length ? `${step + 1} מתוך ${QS.length}` : step === QS.length ? "כמעט שם" : "אחרון"}</span></div>`;
  if (step === QS.length) {
    return head + `<div class="qbody"><h2 data-focus tabindex="-1">מה כבר ראיתם?</h2><p class="sub">סמנו סדרות שכבר ראיתם כדי שלא נמליץ עליהן. אפשר לדלג.</p>
    <div class="skip-top"><button class="btn ghost" data-a="next">דילוג</button></div>
    <div class="grid">${poolIds(st.ans.src, st.ans.platforms).map(i => tile(i, "toggle", false)).join("")}</div>
    <div class="sticky-cta"><button class="btn primary block" data-a="next">הראו לי את ההמלצה</button></div></div>`;
  }
  if (step === QS.length + 1) {
    return head + `<div class="qbody"><h2 data-focus tabindex="-1">שנייה לפני התוצאות</h2><p class="sub">לפי מה לסדר את ההמלצות?</p>
    ${SORTS.map(o => `<button class="opt" data-a="sortpick" data-v="${o[0]}" aria-pressed="${st.ans.sort === o[0]}"><span class="em" aria-hidden="true">${o[1]}</span><span><b>${o[2]}</b><small>${o[3]}</small></span></button>`).join("")}</div>`;
  }
  const q = QS[step];
  if (q.multi) {
    const chips = q.id === "genres" ? GENRES : q.id === "eras" ? ERAS : PLAT_LABEL, keys = q.id === "genres" ? Object.keys(GENRES) : q.id === "eras" ? ERA_KEYS : platsInUse(), sel = st.ans[q.id];
    return head + `<div class="qbody"><h2 data-focus tabindex="-1">${q.t}</h2><p class="sub">${q.d}</p>
    <div class="chips">${keys.map(g => `<button class="chip${q.id === "platforms" ? " plat" : ""}" data-a="chip" data-q="${q.id}" data-v="${g}" aria-pressed="${sel.includes(g)}">${q.id === "platforms" ? platChipHTML(g) : chips[g]}</button>`).join("")}</div>
    <button class="btn primary block" data-a="next">${sel.length ? "המשך" : "דלגו על השאלה"}</button></div>`;
  }
  const cur = st.ans[q.id];
  return head + `<div class="qbody"><h2 data-focus tabindex="-1">${q.t}</h2><p class="sub">${q.d}</p>
  ${q.o.map(o => `<button class="opt" data-a="opt" data-q="${q.id}" data-v="${o[0]}" aria-pressed="${!!(cur === o[0] || (o[0] === "any" && cur === null && st.touched && st.touched[q.id]))}"><span class="em" aria-hidden="true">${o[1]}</span><span><b>${o[2]}</b>${o[3] ? `<small>${o[3]}</small>` : ""}</span></button>`).join("")}</div>`;
}

function ticketHTML(r) {
  const s = S[r.i];
  const stub = st.chosen
    ? `<div class="stub"><div class="acts"><div class="chosen">נבחרה לערב הזה. צפייה נעימה!</div><button class="btn ghost" data-a="unchoose">בעצם, הראו עוד אחת</button></div></div>`
    : `<div class="stub"><div class="match">${r.pct === null ? `<strong aria-hidden="true">🎲</strong><span>הפתעה</span>` : `<strong>${r.pct}%</strong><span>התאמה</span>`}</div>
       <div class="acts"><button class="btn primary choose" data-a="choose"><span class="c-main">יאללה מתחילים</span><small class="c-sub">לתוכנית הצפייה ←</small></button>
       <div class="row2"><button class="btn ghost" data-a="another">הציגו אחרת</button><button class="btn ghost" data-a="markseen" data-i="${r.i}">כבר ראיתי</button></div></div></div>`;
  return `<article class="ticket" aria-live="polite">
    <div class="t-top">${poster(r.i, "t-poster")}<div><h2 class="t-title"><bdi>${esc(s.n)}</bdi></h2>${metaHTML(s)}${tagsHTML(s)}</div></div>
    ${ratesHTML(s)}
    <p class="avail">${platLine(s)}</p>
    <p class="t-line"${s.lEn ? ' dir="ltr" lang="en"' : ""}>${esc(s.l)}</p>
    ${praiseHTML(s)}
    ${trailerHTML(s)}
    <ul class="why">${r.why.map(w => `<li class="${w.ok ? "" : "miss"}">${w.ok ? CHECK : CROSS}<span>${w.t}</span></li>`).join("")}</ul>
    <div class="perf"><i></i></div>${stub}</article>`;
}

const PACES = [1, 2, 3, 5];
function planHTML() {
  const r = st.ranked[st.idx], s = S[r.i], pace = st.pace || 2, p = bingePlan(s, pace);
  const yr = p.finish && p.finish.getFullYear() !== new Date().getFullYear();
  const fin = p.finish ? p.finish.toLocaleDateString("he-IL", yr ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "long" }) : "";
  const stat = (em, n, label) => `<div class="p-stat"><span class="p-em" aria-hidden="true">${em}</span><strong>${n}</strong><span>${label}</span></div>`;
  const sum = p.evenings == null ? "" : `<p class="p-sum"><strong>${p.evenings === 1 ? "ערב אחד" : p.evenings + " ערבים"}</strong>${p.evenings > 1 ? ` · תסיימו בערך ב־${fin}` : ""}</p>
    <p class="p-alt">או ${p.weekends === 1 ? "סוף שבוע מרתוני אחד" : p.weekends + " סופי שבוע מרתוניים"}</p>`;
  return `<h1 class="rtitle" data-focus tabindex="-1">תוכנית הבינג׳ שלך</h1>
  <article class="ticket plan">
    <div class="t-top">${poster(r.i, "t-poster")}<div><h2 class="t-title"><bdi>${esc(s.n)}</bdi></h2>${metaHTML(s)}${tagsHTML(s)}</div></div>
    <div class="p-stats">${stat("📺", s.s, s.s === 1 ? "עונה" : "עונות")}${stat("🎬", s.e, "פרקים")}${stat("⏱️", p.hours != null ? "כ־" + p.hours : "?", "שעות צפייה")}</div>
    ${s.airing ? `<p class="p-note">הסדרה עדיין משודרת, אז בדרך עוד פרקים.</p>` : ""}
    <div class="perf"><i></i></div>
    <div class="p-pace"><h3>כמה פרקים בערב?</h3>
      <div class="chips">${PACES.map(n => `<button class="chip" data-a="pace" data-v="${n}" aria-pressed="${pace === n}">${n}</button>`).join("")}</div>
      ${sum}</div>
    <div class="perf"><i></i></div>
    <p class="avail">${platLine(s)}</p>
    ${ratesHTML(s)}
    <ul class="why">${r.why.filter(w => w.ok).map(w => `<li>${CHECK}<span>${w.t}</span></li>`).join("")}</ul>
    ${trailerHTML(s)}
    <p class="note p-fine">סך השעות מקורב: לפי אורך פרק ממוצע, ופרקי סיום לפעמים ארוכים יותר.</p>
  </article>
  <div class="foot"><button class="btn ghost" data-a="backrec">חזרה להמלצות</button><button class="btn primary" data-a="restart">התחלה מחדש</button></div>`;
}

function resultHTML() {
  if (!st.ranked.length || st.idx >= st.ranked.length) {
    const plats = st.ans.platforms || [], missing = emptyPlatforms(S, plats);
    if (plats.length && missing.length === plats.length) {
      const names = missing.map(p => PLAT_LABEL[p]).join(", ");
      return `<div class="empty"><h2>אין עדיין סדרות מסומנות ב־${names}</h2><p>ל־TMDB אין נתונים על השירותים הישראליים, ולכן הם מסומנים ידנית לכל סדרה. אפשר לבחור עוד שירות, או להוסיף סדרה ולסמן "זמין גם ב־" בטופס ההוספה.</p>
      <button class="btn primary" data-a="edit">שינוי התשובות</button><a class="btn ghost" href="${esc(addSeriesUrl(REPO, ""))}" target="_blank" rel="noopener noreferrer">➕ הוספת סדרה</a></div>`;
    }
    const none = st.seen.size >= S.length;
    return `<div class="empty"><h2>${none ? "ראיתם הכול!" : "אין עוד המלצות"}</h2><p>${none ? `כל ${S.length} הסדרות מסומנות כנצפו.` : "לא נשארו סדרות שמתאימות לבחירות. אפשר לשנות את התשובות או לאפס את מה שסימנתם כנצפה."}</p>
    <button class="btn primary" data-a="edit">שינוי התשובות</button><button class="btn ghost" data-a="resetseen">איפוס הנצפו</button></div>`;
  }
  const r = st.ranked[st.idx];
  const alts = st.ranked.slice(st.idx + 1, st.idx + 4);
  return `<h1 class="rtitle" data-focus tabindex="-1">${st.surprise ? "ההפתעה של הערב" : "הבחירה האולטימטיבית שלכם"}</h1>` + (!st.surprise && SORT_NOTE[st.ans.sort] ? `<p class="sortnote">${SORT_NOTE[st.ans.sort]}</p>` : "") + ticketHTML(r) + moreHTML(r.i) +
    (alts.length && !st.chosen ? `<section class="alts"><h3>הכי קרובות אחריה</h3><div class="grid">${alts.map((x, k) => `<button class="tile" data-a="alt" data-k="${st.idx + 1 + k}" aria-label="${esc(S[x.i].n)}">${poster(x.i, "")}<span class="cap"><bdi>${esc(S[x.i].n)}</bdi></span></button>`).join("")}</div></section>` : "") +
    `<div class="foot"><button class="linkbtn" data-a="edit">שינוי התשובות</button><button class="linkbtn" data-a="surprise">תפתיעו אותי</button><button class="linkbtn" data-a="restart">התחלה מחדש</button></div><p class="note" style="text-align:center">הציונים מקורבים ועשויים להשתנות.</p>`;
}

function listHTML() {
  const ids = poolIds(st.listSrc === "all" ? null : st.listSrc, st.listPlat ? [st.listPlat] : null).filter(i => !(st.hideSeen && st.seen.has(i)));
  const nMine = S.filter(x => x.lists.includes("mine")).length, nNyt = S.filter(x => x.nyt).length, nPool = S.filter(x => x.lists.includes("pool")).length;
  const srcs = [["all", "הכול", `כל ${S.length} הסדרות באתר: הרשימה האישית, הניו יורק טיימס והמאגר הרחב`],
    ["mine", "הרשימה שלי", `${nMine} הסדרות שנבחרו ידנית, עם תגיות ותיאורים שנכתבו בעצמנו`],
    ["nyt", "ניו יורק טיימס", `${nNyt} הסדרות הטובות של המאה ה-21 לפי הניו יורק טיימס (דירוג ספטמבר 2026), לפי סדר הדירוג`],
    ["pool", "המאגר הרחב", `${nPool} הסדרות המדורגות ביותר ב-TMDB שאינן ברשימות. מתעדכן כל לילה, והתגיות מנוחשות אוטומטית`]];
  const inUse = platsInUse(), plats = [["all", "כל הפלטפורמות"]].concat(inUse.map(k => [k, PLAT_LABEL[k]]));
  return `<div class="listbar"><h2>הרשימה</h2><span class="count">ראיתם ${st.seen.size} מתוך ${S.length}</span></div>
  <div class="chips">${srcs.map(x => `<button class="chip" data-a="lsrc" data-v="${x[0]}" data-tip="${x[2]}" aria-pressed="${st.listSrc === x[0]}">${x[1]}</button>`).join("")}<button class="chip" data-a="hideseen" data-tip="מסתיר מהרשימה סדרות שסימנתם כנצפו" aria-pressed="${st.hideSeen}">הסתרת מה שכבר ראיתי</button></div>
  <p class="srcnote">${(srcs.find(x => x[0] === st.listSrc) || srcs[0])[2]}</p>
  ${inUse.length ? `<div class="chips">${plats.map(x => `<button class="chip${x[0] === "all" ? "" : " plat"}" data-a="lplat" data-v="${x[0]}" aria-pressed="${(st.listPlat || "all") === x[0]}">${x[0] === "all" ? x[1] : platChipHTML(x[0])}</button>`).join("")}</div>` : ""}
  ${ids.length ? `<div class="grid">${ids.map(i => tile(i, "detail", true)).join("")}</div>` : `<div class="empty"><h2>אין סדרות להצגה</h2><p>נסו פלטפורמה אחרת או בטלו את הסתרת הנצפו.</p></div>`}
  <p class="note">הקשה על סדרה פותחת את הפרטים ומאפשרת לסמן אותה כנצפתה. הדירוג של הניו יורק טיימס הוא ״100 הסדרות הטובות של המאה ה-21״ (ספטמבר 2026). הזמינות היא לפי שירותי הסטרימינג בישראל. מספר העונות והפרקים, הפוסטרים וציון IMDb מתעדכנים כל יום; ציון רוטן טומייטו קבוע.</p>`;
}

function render(top) {
  const y = window.scrollY;
  let body;
  if (onNews()) { body = `<div id="news"></div>`; newsSeen(true); }
  else if (st.tab === "mine") body = `<div id="mine"></div>`;
  else if (st.tab === "games") body = `<div id="games"></div>`;
  else if (st.tab === "list") body = listHTML();
  else if (st.tab === "actors") body = actorsHTML();
  else if (st.tab === "search") body = searchHTML();
  else if (st.screen === "intro") body = introHTML();
  else if (st.screen === "q") body = qHTML();
  else if (st.screen === "plan") body = planHTML();
  else body = resultHTML();
  $("#app").innerHTML = header() + body + footerHTML();
  if (onNews()) showNews();
  else if (st.tab === "mine") showMine();
  else if (st.tab === "games") showGames(top);
  if (top) { window.scrollTo(0, 0); const f = $("[data-focus]"); if (f) f.focus({ preventScroll: true }); }
  else window.scrollTo(0, y);
}

/* actors */
let ACT = null, ACTMAP = null;
function actorIndex() {
  if (ACT) return ACT;
  const m = new Map();
  S.forEach((s, i) => {
    s.cast.forEach(c => { const n = c.name; if (!n) return; if (c.photo && !PHOTO.has(n)) PHOTO.set(n, c.photo); if (!m.has(n)) m.set(n, []); if (!m.get(n).includes(i)) m.get(n).push(i); });
  });
  ACT = [...m.entries()].map(([n, ids]) => ({ n, ids }));
  ACTMAP = new Map(ACT.map((a, k) => [a.n, k]));
  ACT.forEach(a => { a.kw = /[\u0590-\u05FF]/.test(a.n) ? hebKey(a.n) : latKey(a.n); a.kf = a.kw.join(""); });
  return ACT;
}
function actorLinks(x) {
  actorIndex();
  return x.split(", ").map(n => { const k = ACTMAP.get(n.trim()); return k === undefined ? `<bdi>${esc(n)}</bdi>` : `<button class="nm" data-a="actor" data-k="${k}"><bdi>${esc(n)}</bdi></button>`; }).join(", ");
}
function avatar(n, big) {
  const parts = n.split(" ").filter(Boolean), ini = (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  const h = [...n].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const img = safeImg(PHOTO.get(n)) ? `<img src="${safeImg(PHOTO.get(n))}" alt="" loading="lazy">` : "";
  return `<span class="av${big ? " big" : ""}" style="--h:${h}" aria-hidden="true">${esc(ini)}${img}</span>`;
}
function actorRows() {
  const q = st.actQuery.trim().toLowerCase();
  let a = actorIndex();
  if (q) {
    const heb = /[\u0590-\u05FF]/.test(q), qk = heb ? hebKey(q) : [], qf = qk.join("");
    return a.map(x => {
      let s = 9;
      if (x.n.toLowerCase().includes(q)) s = 0;
      else if (heb && keyMatch(x, qk)) s = x.kf === qf ? 1 : x.kf.startsWith(qf) ? 2 : x.kw.some(w => w === qf || w.startsWith(qf)) ? 3 : 4;
      return { x, s };
    }).filter(o => o.s < 9).sort((p, r) => p.s - r.s || r.x.ids.length - p.x.ids.length || p.x.n.localeCompare(r.x.n)).map(o => o.x);
  }
  if (st.actMulti) a = a.filter(x => x.ids.length > 1);
  return a.slice().sort((x, y) => y.ids.length - x.ids.length || x.n.localeCompare(y.n));
}
function actListHTML() {
  const rows = actorRows(), shown = rows.slice(0, st.actLimit);
  if (!rows.length) return `<div class="empty"><h2>לא נמצא שחקן</h2><p>נסו חלק מהשם, באנגלית או בעברית. בעברית החיפוש מבוסס על הגייה, ולכן הכתיב לא חייב להיות מדויק. מופיעים רק השחקנים המרכזיים של סדרות שנמצאות באתר, כך ששחקן שהסדרות שלו לא כאן לא יופיע. אפשר לחפש את הסדרה שלו בלשונית החיפוש.</p></div>`;
  return shown.map(a => {
    const k = ACTMAP.get(a.n), names = a.ids.slice(0, 3).map(i => `<bdi>${esc(S[i].n)}</bdi>`).join(", "), more = a.ids.length - 3;
    return `<button class="arow" data-a="actor" data-k="${k}">${avatar(a.n)}<span class="ainfo"><b><bdi>${esc(a.n)}</bdi></b><small>${names}${more > 0 ? " ועוד " + more : ""}</small></span><span class="acount">${a.ids.length}</span></button>`;
  }).join("") + (rows.length > shown.length ? `<button class="btn ghost block" data-a="actmore">הצגת עוד (${rows.length - shown.length})</button>` : "");
}
function serResHTML() {
  const q = (st.serQuery || "").trim();
  if (q.length < 2) return `<p class="note">אפשר לחפש באנגלית או בעברית. בעברית החיפוש לפי הגייה, כך ש"סופרנוס" ימצא את The Sopranos.</p>`;
  const ids = searchSeries(S, q);
  const add = `<a class="btn primary" href="${esc(addSeriesUrl(REPO, q))}" target="_blank" rel="noopener noreferrer">➕ הוספה או הצעה לרשימה<span class="sr"> (נפתח ב-GitHub)</span></a>`;
  const how = `<p class="note">נפתח טופס קצר ב-GitHub (צריך חשבון). בקשה של בעל האתר נוספת אוטומטית תוך כמה דקות, והצעות של אחרים מחכות לאישור.</p>`;
  if (!ids.length) return `<div class="empty"><h2>הסדרה לא נמצאת באתר</h2><p>האתר כולל את הרשימה האישית, את 100 הסדרות של הניו יורק טיימס ואת המאגר הרחב: הסדרות המדורגות ביותר ב-TMDB.</p>${add}${how}</div>`;
  return `<div class="grid">${ids.map(i => tile(i, "detail", true)).join("")}</div><p class="note">לא מצאתם? <a href="${esc(addSeriesUrl(REPO, q))}" target="_blank" rel="noopener noreferrer">הציעו להוסיף את "${esc(q)}"</a></p>`;
}
function searchHTML() {
  return `<div class="listbar"><h2>חיפוש סדרה</h2><span class="count">${S.length} סדרות</span></div>
  <input id="serq" data-focus class="search" type="search" dir="auto" placeholder="שם הסדרה, באנגלית או בעברית" aria-label="חיפוש סדרה" value="${esc(st.serQuery || "")}" autocomplete="off">
  <div id="serRes" aria-live="polite">${serResHTML()}</div>`;
}
function actorsHTML() {
  actorIndex();
  return `<div class="listbar"><h2>שחקנים/ניות</h2><span class="count">${ACT.length} שמות</span></div>
  <input id="actq" class="search" type="search" dir="auto" placeholder="חיפוש לפי שם, גם בעברית" aria-label="חיפוש שחקן או שחקנית" value="${st.actQuery.replace(/"/g, "&quot;")}" autocomplete="off">
  <div class="chips"><button class="chip" data-a="actall" aria-pressed="${st.actMulti}">רק מי שמופיע ביותר מסדרה אחת</button></div>
  <div id="actList">${actListHTML()}</div>
  <p class="note">הרשימה מבוססת על השחקנים המרכזיים בכל סדרה, ולא על כל צוות השחקנים, וכוללת גם מגישים ומספרים בסדרות דוקו וריאליטי. לשחקנים שעדיין אין להם תמונה מוצגות ראשי תיבות.</p>`;
}

/* dialog */
function seriesDlgHTML(i) {
  const s = S[i], seen = st.seen.has(i); st.dlgId = i;
  return `<div class="t-top">${poster(i, "t-poster")}<div><h2 class="t-title"><bdi>${esc(s.n)}</bdi></h2>${metaHTML(s)}${tagsHTML(s)}</div></div>
  ${ratesHTML(s)}
  <p class="avail">${platLine(s)}</p>
  <p class="d-line"${s.lEn ? ' dir="ltr" lang="en"' : ""}>${esc(s.l)}</p>
  ${praiseHTML(s)}
  ${trailerHTML(s)}
  ${hasSession() ? `<div id="acct"></div>` : ""}
  <div class="d-acts">${hasSession() ? "" : `<button class="btn primary" data-a="dseen">${seen ? "עוד לא ראיתי" : "סימון כנצפתה"}</button>`}${st.dlgStack.length ? `<button class="btn ghost" data-a="dback">חזרה</button>` : ""}<button class="btn ghost" data-a="dclose">סגירה</button></div>${moreHTML(i)}`;
}
function actorLinksHTML(n) {
  const e = encodeURIComponent, he = /[\u0590-\u05FF]/.test(n);
  const link = (u, t) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}<span class="sr"> (נפתח בלשונית חדשה)</span></a>`;
  return `<div class="trail alinks">${link("https://www.google.com/search?tbm=isch&amp;q=" + e(he ? n : n + " actor"), "תמונות")}${link("https://www.imdb.com/find/?s=nm&amp;q=" + e(n), "IMDb")}${link("https://" + (he ? "he" : "en") + ".wikipedia.org/w/index.php?search=" + e(n), "ויקיפדיה")}</div>`;
}
function actorDlgHTML(k) {
  const a = actorIndex()[k], unseen = a.ids.filter(i => !st.seen.has(i));
  return `<div class="a-head">${avatar(a.n, true)}<div><h2 class="t-title"><bdi>${esc(a.n)}</bdi></h2><div class="meta"><span>${a.ids.length} סדרות באפליקציה</span><span>${unseen.length} שעוד לא ראיתם</span></div></div></div>
  ${actorLinksHTML(a.n)}
  <div class="grid a-grid">${a.ids.map(i => tile(i, "detail", true)).join("")}</div>
  <div class="d-acts">${unseen.length ? `<button class="btn primary" data-a="actpick" data-k="${k}">תפתיעו אותי עם <bdi>${esc(a.n)}</bdi></button>` : ""}${st.dlgStack.length ? `<button class="btn ghost" data-a="dback">חזרה</button>` : ""}<button class="btn ghost" data-a="dclose">סגירה</button></div>`;
}
function paintDlg(keep) {
  const d = $("#dlg"), v = st.dlgCur, sc = d.scrollTop;
  d.innerHTML = v.t === "s" ? seriesDlgHTML(v.v) : actorDlgHTML(v.v);
  d.scrollTop = keep ? sc : 0;
  if (!d.open) d.showModal();
  const s = v.t === "s" && S[v.v], box = $("#acct");
  // views/card.js could not load at all: the local seen toggle instead.
  if (s && box) acct(m => m.mountCard(box, { s, seen: st.seen.has(v.v), toast: showToast, onSeen: on => { setSeen(v.v, on); render(false); } }))
    .then(() => { if (box.isConnected && !box.innerHTML) box.outerHTML = `<div class="d-acts"><button class="btn primary" data-a="dseen">${st.seen.has(v.v) ? "עוד לא ראיתי" : "סימון כנצפתה"}</button></div>`; });
}
function dlgGo(view) {
  const d = $("#dlg");
  if (d.open && st.dlgCur) st.dlgStack.push(st.dlgCur); else st.dlgStack = [];
  st.dlgCur = view; st.phMsg = ""; paintDlg(false);
}
function dlgBack() { const v = st.dlgStack.pop(); if (v) { st.dlgCur = v; paintDlg(false); } }
function openDlg(i) { dlgGo({ t: "s", v: i }); }

/* actions */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-a]"); if (!el) return;
  const a = el.dataset.a, v = el.dataset.v, i = el.dataset.i !== undefined ? +el.dataset.i : null;
  switch (a) {
    case "hinvite": headerInvite(); break;
    case "home": // the logo: back to the start screen from anywhere (quiz answers are kept, like "לדף הראשי")
      if (st.share || location.hash) { st.share = null; history.replaceState(null, "", location.pathname + location.search); }
      st.tab = "pick"; st.screen = "intro"; st.step = 0; render(true); break;
    case "tab": if (st.share || onNews() || (location.hash === "#games" && v !== "games")) { st.share = null; history.replaceState(null, "", location.pathname + location.search); } st.tab = v; render(true); break;
    case "start": st.ans = blankAns(); st.touched = {}; st.screen = "q"; st.step = 0; render(true); break;
    case "surprise": st.tab = "pick"; rank(true); st.screen = "result"; render(true); break;
    case "back": if (st.step === 0) st.screen = "intro"; else st.step--; render(true); break;
    case "opt": {
      if (st.advancing) break; st.advancing = true;
      const q = el.dataset.q; st.touched = st.touched || {}; st.touched[q] = true;
      const val = v === "any" ? null : (isNaN(+v) ? v : +v);
      st.ans[q] = val; render(false);
      setTimeout(() => { st.advancing = false; st.step++; render(true); }, 180);
      break; }
    case "chip": { const g = st.ans[el.dataset.q], k = g.indexOf(v); if (k >= 0) g.splice(k, 1); else g.push(v); render(false); break; }
    case "lplat": st.listPlat = v === "all" ? null : v; render(false); break;
    case "next": st.step++; render(true); break;
    case "toggle": setSeen(i, !st.seen.has(i), true); render(false); break;
    case "finish": rank(false); st.screen = "result"; render(true); break;
    case "another": st.idx++; st.chosen = false; render(true); break;
    case "alt": st.idx = +el.dataset.k; st.chosen = false; render(true); break;
    case "choose": st.chosen = true; st.screen = "plan"; render(true); break;
    case "pace": st.pace = +v; render(false); break;
    case "backrec": st.chosen = false; st.screen = "result"; render(true); break;
    case "unchoose": st.chosen = false; st.idx++; render(true); break;
    case "markseen": setSeen(i, true, true); st.ranked = st.ranked.filter(r => r.i !== i); render(true); break;
    case "edit": st.tab = "pick"; st.screen = "q"; st.step = 0; render(true); break;
    case "resetseen": st.seen.clear(); if (hasSession()) showToast("הסימונים בחשבון לא נמחקו. הסדרות שסימנתם יחזרו בכניסה הבאה."); else save(); rank(false); render(true); break;
    case "lsrc": st.listSrc = v; render(false); break;
    case "hideseen": st.hideSeen = !st.hideSeen; render(false); break;
    case "detail": openDlg(i); break;
    case "dseen": { const k = st.dlgId; setSeen(k, !st.seen.has(k), true); paintDlg(true); render(false); break; }
    case "dback": dlgBack(); break;
    case "actor": dlgGo({ t: "a", v: +el.dataset.k }); break;
    case "actpick": { const a = actorIndex()[+el.dataset.k], un = a.ids.filter(x => !st.seen.has(x)); if (un.length) dlgGo({ t: "s", v: un[Math.floor(Math.random() * un.length)] }); break; }
    case "copylink": copyText(el.dataset.u).then(ok => showToast(ok ? "הקישור הועתק. הדביקו אותו בדפדפן או באפליקציית יוטיוב." : "אי אפשר להעתיק מהמסך הזה. סמנו את הכתובת והעתיקו אותה ידנית.", el.dataset.u)); break;
    case "actall": st.actMulti = !st.actMulti; st.actLimit = 60; render(false); break;
    case "actmore": st.actLimit += 60; $("#actList").innerHTML = actListHTML(); break;
    case "dclose": $("#dlg").close(); break;
    case "retry": boot(); break;
    case "sortpick": st.ans.sort = v; rank(false); st.ranked = orderResults(st.ranked, S, v); st.screen = "result"; render(true); break;
    case "restart": resetQuiz(st, blankAns()); render(true); break;
  }
});
$("#dlg").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
$("#dlg").addEventListener("close", () => { st.dlgStack = []; st.dlgCur = null; });
document.addEventListener("input", e => { if (e.target && e.target.id === "serq") { st.serQuery = e.target.value; $("#serRes").innerHTML = serResHTML(); } });
document.addEventListener("input", e => { if (e.target && e.target.id === "actq") { st.actQuery = e.target.value; st.actLimit = 60; $("#actList").innerHTML = actListHTML(); } });

/* external links: some viewers (for example in-app webviews) block new windows, so fall back to copying the address */
function legacyCopy(txt) {
  const ta = document.createElement("textarea"); ta.value = txt; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;opacity:0";
  document.body.appendChild(ta); ta.select(); let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) {}
  ta.remove(); return ok;
}
function copyText(txt) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).then(() => true, () => legacyCopy(txt)); } catch (e) {}
  return Promise.resolve(legacyCopy(txt));
}
let toastTimer = null;
function showToast(msg, url) {
  const old = document.getElementById("toast"); if (old) old.remove();
  const d = $("#dlg"), host = d && d.open ? d : document.body, el = document.createElement("div");
  el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status");
  el.innerHTML = `<p></p>${url ? '<input readonly aria-label="כתובת הקישור">' : ""}`;
  el.querySelector("p").textContent = msg;
  if (url) { const inp = el.querySelector("input"); inp.value = url; inp.addEventListener("focus", () => inp.select()); }
  host.appendChild(el);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), 12000);
}
async function linkFallback(url) {
  const ok = await copyText(url);
  showToast(ok ? "אי אפשר לפתוח קישורים מהמסך הזה, ולכן הקישור הועתק. הדביקו אותו בדפדפן או באפליקציית יוטיוב." : "אי אפשר לפתוח קישורים מהמסך הזה. העתיקו את הכתובת ופתחו אותה בדפדפן.", url);
}
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest('a[target="_blank"]'); if (!a) return;
  e.preventDefault();
  let w = null; try { w = window.open(a.href, "_blank"); } catch (err) {}
  if (w) { try { w.opener = null; } catch (err) {} } else linkFallback(a.href);
});
document.addEventListener("error", e => {
  const t = e.target; if (!t || t.tagName !== "IMG") return;
  if (t.closest && t.closest(".av")) t.remove();
  else if (t.classList.contains("plogo")) t.remove();
  else if (t.dataset.pi) t.outerHTML = art(+t.dataset.pi, t.dataset.pc || "");
}, true);

function footerHTML() {
  const d = st.updatedAt ? new Date(st.updatedAt).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" }) : "";
  return `<footer class="credits">${d ? `<p>הנתונים עודכנו ב-${d}</p>` : ""}
  <p dir="ltr"><img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB" height="12"> This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
  <p>נתוני זמינות: JustWatch</p>
  <p><a href="privacy.html">מדיניות פרטיות · Privacy</a></p></footer>`;
}

/* "שלי" tab: the account code loads only here (or for a #u= / #join= / sign-in return link), never at startup —
   except for a signed-in visitor, whose "seen" marks live on the account (views/card.js). */
function showMine() {
  const root = $("#mine"), join = st.join;
  st.join = null; // handed over once; mine.js keeps it until the join is done
  import("./views/mine.js")
    .then(m => m.mountMine(root, { S, storage: store, pace: st.pace || 2, share: st.share, join, localSeen: () => st.seen.size, toast: showToast, copy: copyText,
      onSeen: (id, on) => { const k = S.findIndex(x => x.tmdbId === id); if (k >= 0) setSeen(k, on); } }))
    .catch(() => { if (root.isConnected) root.innerHTML = `<div class="empty"><p>${ACCOUNT_DOWN}</p><button class="btn primary" data-a="tab" data-v="mine">נסו שוב</button></div>`; });
}
/* "משחקים" tab: views/games.js loads only here. */
function showGames(nav) {
  const root = $("#games");
  import("./views/games.js")
    .then(m => { if (root.isConnected) m.mountGames(root, { S, storage: store, actorNames: actorIndex().map(a => a.n), today: () => israelToday(), fetch: (u, o) => fetch(u, o),
      openSeries: id => { const k = S.findIndex(x => x.tmdbId === id); if (k >= 0) openDlg(k); },
      openActor: n => { actorIndex(); const k = ACTMAP.get(n); if (k !== undefined) dlgGo({ t: "a", v: k }); },
      toast: showToast, copy: copyText, nav: !!nav }); })
    .catch(() => { if (root.isConnected) root.innerHTML = `<div class="empty"><p>המשחקים לא נטענו</p><button class="btn primary" data-a="tab" data-v="games">לנסות שוב</button></div>`; });
}
const hasSession = () => { try { return !!store && Object.keys(store).some(k => /^sb-.+-auth-token$/.test(k)); } catch (e) { return false; } };
const ACCOUNT_DOWN = "לא הצלחנו להתחבר לחשבון. נסו שוב בעוד רגע";
const SITE_URL = "https://achiyafried.github.io/bingology/";
const SHARE_TEXT = "wanna binge? join bingology at"; // same wording as lib/account/invite.js (that module loads only for signed-in visitors)
const inviteBtn = () => `<button class="hbtn" type="button" data-a="hinvite" aria-label="הזמנת חבר"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg></button>`;
/** Header invite: signed in, bring a friend into the circle; signed out, share the site itself. */
async function headerInvite() {
  if (hasSession()) {
    try { const m = await import("./lib/account/invite.js"); await m.inviteFriend({ toast: showToast, copy: copyText }); }
    catch (e) { showToast(ACCOUNT_DOWN); }
    return;
  }
  if (navigator.share) {
    try { await navigator.share({ title: "Bingology", text: SHARE_TEXT, url: SITE_URL }); return; }
    catch (e) { if (e && e.name === "AbortError") return; }
  }
  if (await copyText(`${SHARE_TEXT} ${SITE_URL}`)) showToast("ההודעה והקישור הועתקו"); else showToast("העתיקו את הקישור ושלחו לחברים.", SITE_URL);
}
const acct = fn => import("./views/card.js").then(fn).catch(() => {});
/** Local mark (as before); when signed in and `write`, the account too. */
function setSeen(i, on, write) {
  if (on) st.seen.add(i); else st.seen.delete(i);
  save();
  if (write && hasSession()) acct(m => m.writeSeen(S[i], on));
}
/* "מה חדש": st.news = visible news.json items (newest first), null when missing/corrupt, undefined while loading.
   Strip and page treat null/undefined as [] — "עונות בדרך" comes from data.json and shows regardless. */
const onNews = () => location.hash === "#news";
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const SEEN_KEY = "bingology:newsSeen";
function newsSeen(mark) {
  if (!store) return null;
  try {
    if (mark && st.news && st.news[0]) store.setItem(SEEN_KEY, st.news[0].date);
    return store.getItem(SEEN_KEY);
  } catch (e) { return null; }
}
const bellNow = () => bellHTML(st.news ? unseenCount(st.news, newsSeen(false)) : 0);
function loadNews() {
  fetch("news.json", { cache: "no-cache" }).then(r => (r.ok ? r.json() : null)).catch(() => null).then(j => {
    const ok = j && Array.isArray(j.items) && j.items.every(i => i && typeof i.date === "string" && typeof i.kind === "string" && Number.isInteger(i.tmdbId));
    st.news = ok ? visibleItems(j.items, S).sort((a, b) => b.date.localeCompare(a.date)) : null;
    if (onNews() || (st.tab === "pick" && st.screen === "intro")) render(false);
    else { const b = $(".bell"); if (b) b.outerHTML = bellNow(); }
  });
}
function showNews() {
  const root = $("#news");
  const t = today(), items = st.news || [];
  import("./views/news.js")
    .then(m => { if (root.isConnected) m.mountNews(root, { S, items, upcoming: upcomingSeasons(S, t), today: t }); })
    .catch(() => { if (root.isConnected) root.innerHTML = `<div class="empty"><p>אין חדשות כרגע</p></div>`; });
}
function route() {
  const m = /^#u=([A-Za-z0-9_-]{1,64})$/.exec(location.hash), j = /^#join=(.{1,200})$/.exec(location.hash);
  st.share = m ? m[1] : null;
  if (j) { try { st.join = decodeURIComponent(j[1]).slice(0, 64); } catch (e) { st.join = j[1].slice(0, 64); } }
  if (m || j || /[#&](access_token|error_description)=/.test(location.hash) || /[?&]code=/.test(location.search)) st.tab = "mine";
  else if (location.hash === "#games") st.tab = "games";
}
window.addEventListener("hashchange", () => { route(); if (S.length) render(true); });
window.addEventListener("bingology:write-failed", () => showToast("השינוי לא נשמר"));

async function boot() {
  $("#app").innerHTML = `<div class="empty loading" role="status"><p>טוענים את הסדרות…</p></div>`;
  try {
    const res = await fetch("data.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    S = fromData(json);
    bingeScores(S).forEach((b, i) => { S[i].bs = b.score; S[i].bsParts = b.parts; });
    QS = quizSteps(ALL_QS, S);
    st.updatedAt = json.updatedAt;
    st.seen = loadSeen(store, S);
    ACT = null; PHOTO.clear();
    route();
    render(false);
    loadNews();
    // Signed in: after the first paint, add the account's seen marks (memory only, so "איפוס הנצפו" stays a local reset).
    if (hasSession()) setTimeout(() => acct(m => m.syncSeen(S, st.seen)).then(n => { if (n && st.tab !== "mine") render(false); }), 0);
  } catch (e) {
    $("#app").innerHTML = `<div class="empty loading"><h2>לא הצלחנו לטעון את הסדרות</h2><p>בדקו את החיבור ונסו שוב.</p><button class="btn primary" data-a="retry">נסו שוב</button></div>`;
  }
}

boot();

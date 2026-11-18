# סרטון הדרכה: תוכנית בנייה

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**המטרה:** הפקודה `npm run video` מפיקה את `video/out/bingology-tour.mp4`, סיור של 60–90 שניות באתר בגודל מסך טלפון, עם כתוביות בעברית.

**הארכיטקטורה:** כל העבודה נעשית בתיקייה עצמאית `video/` עם `package.json` משלה. שרת סטטי קטן מגיש את `site/`. Playwright פותח את האתר בגודל טלפון, מזריק שכבה עם כתובית ואפקט "נגיעה", מריץ סצנות לפי הסדר ומקליט WebM. בסוף `ffmpeg-static` ממיר את ההקלטה ל-MP4.

**הטכנולוגיות:** Node 22 (ESM), `playwright` (Chromium), `ffmpeg-static`, `node --test`.

**האפיון:** `docs/superpowers/specs/2026-11-18-bingology-tour-video-design.md`

## אילוצים כלליים
- אסור לשנות שום דבר בתוך `site/`.
- התלויות נכנסות רק ל-`video/package.json`. ה-`package.json` בשורש מקבל רק את הסקריפט `"video": "npm --prefix video run record"`.
- `npm test` בשורש לא מריץ שום דבר מ-`video/`, כי ה-glob שלו הוא `tests/**/*.test.mjs`. הבדיקות של הסרטון נמצאות ב-`video/tests/` ורצות עם `npm --prefix video test`.
- `.gitignore`: מוסיפים את `video/out/` ואת `video/node_modules/`.
- גודל החלון 390×844 עם `deviceScaleFactor: 2`, `isMobile: true` ו-`hasTouch: true`, ו-`locale: "he-IL"`. הקלטה בגודל 780×1688.
- אורך הסרטון הסופי בין 60 ל-90 שניות.
- הכתובית של סצנת מארוול היא בדיוק: `🌌 היקום של מארוול — מוקדש לעמליה ❤️`, בסגנון מודגש (`accent: true`).
- סצנה שנכשלת (סלקטור לא נמצא או טעינה שלא הסתיימה בזמן) לא מפילה את ההקלטה. מציגים את הכתובית שלה על מה שיש על המסך, רושמים אזהרה ועוברים לסצנה הבאה.

## על מה לשים לב בבדיקה
1. **אין קובץ משחקים להיום ב-`site/games/`:** הסצנה מראה את מה שהלשונית מציגה, וההקלטה ממשיכה.
2. **הטריילר מ-YouTube לא נטען, או שאין לסדרה טריילר (`S[i].tr` ריק):** מדלגים על הלחיצה על "play" בלי לחכות יותר מ-3 שניות.
3. **הלשונית "שלי" לא מצליחה לטעון את Supabase:** אחרי 8 שניות מציגים את הכתובית על מה שיש, בלי לחכות לכפתור Google.
4. **ffmpeg או Chromium לא מותקנים:** `record.mjs` עוצר עם הודעה ברורה בעברית שאומרת להריץ `npm --prefix video install`, ולא עם stack trace.
5. **הפורט 4173 תפוס:** השרת מקבל פורט 0, כלומר פורט פנוי, ומחזיר את הכתובת בפועל.

---

### משימה 1: שלד התיקייה, שרת סטטי והמרה ל-MP4

**הקבצים:**
- ליצור: `video/package.json`, עם `"type": "module"`, `"private": true`, והסקריפטים `"record": "node record.mjs"`, `"test": "node --test \"tests/**/*.test.mjs\""` ו-`"postinstall": "playwright install chromium"`. התלויות: `playwright` ו-`ffmpeg-static`.
- ליצור: `video/lib/server.mjs`
- ליצור: `video/lib/convert.mjs`
- ליצור: `video/tests/server.test.mjs`, `video/tests/convert.test.mjs`
- לשנות: `package.json` בשורש (הסקריפט `video`), `.gitignore`

**הממשקים:**
- מייצרת: `startServer(root: string, port = 0): Promise<{ url: string, close(): Promise<void> }>`. השרת מגיש קבצים מתוך `root`, `/` מוגש כ-`index.html`, ה-MIME נקבע לפי סיומת (html, js, mjs, css, json, svg, png, jpg, webp, ico), נתיב שיוצא מ-`root` מחזיר 404, וקובץ חסר מחזיר 404.
- מייצרת: `ffmpegArgs(input: string, output: string): string[]`, ו-`toMp4(input, output): Promise<void>` שמריצה את הבינארי של `ffmpeg-static` עם הארגומנטים האלה.

- [ ] **שלב 1: כתיבת הבדיקות שנכשלות**

`server.test.mjs` (על תיקייה זמנית עם `index.html` ו-`a.json`):
- `GET /`: סטטוס 200, הגוף הוא תוכן `index.html`, ו-`content-type` מתחיל ב-`text/html`
- `GET /a.json`: `content-type` מתחיל ב-`application/json`
- `GET /../package.json`: סטטוס 404 (שולחים את הבקשה עם `http.request` ו-`path` גולמי, כי `fetch` מנרמל את הנתיב)
- `GET /missing.js`: סטטוס 404
- `startServer(dir, 0)`: ה-`url` מתאים ל-`/^http:\/\/127\.0\.0\.1:\d+\/$/` והפורט שונה מ-0

`convert.test.mjs`:
- `ffmpegArgs("in.webm", "out.mp4")` מכיל את `"-i", "in.webm"`, `"-c:v", "libx264"`, `"-pix_fmt", "yuv420p"`, `"-movflags", "+faststart"` ו-`"-y"`, והאיבר האחרון הוא `"out.mp4"`
- הארגומנטים כוללים `"-an"` (אין שמע)

- [ ] **שלב 2:** להריץ `cd video && npm install && npm test`. **הציפייה:** כישלון, כי המודולים עוד לא קיימים.
- [ ] **שלב 3:** לממש את `server.mjs` עם `node:http` ו-`node:fs/promises`, ואת `convert.mjs` עם `node:child_process.execFile`. ב-`toMp4`, אם הבינארי חסר נזרקת שגיאה עם הטקסט `ffmpeg לא נמצא — הריצו npm --prefix video install`.
- [ ] **שלב 4:** להריץ `npm --prefix video test`. **הציפייה:** כל הבדיקות עוברות. אחר כך להריץ `npm test` בשורש. **הציפייה:** אותה ספירת בדיקות כמו לפני השינוי, בלי בדיקות מ-`video/`.
- [ ] **שלב 5: קומיט** `feat(video): static server and mp4 conversion for the tour video`

### משימה 2: שכבת הכתוביות והנגיעה

**הקבצים:**
- ליצור: `video/lib/overlay.mjs`
- ליצור: `video/tests/overlay.test.mjs`

**הממשקים:**
- מייצרת: `overlayInitScript(): string`. זה קוד שנכנס ל-`context.addInitScript` ורץ בכל טעינת עמוד, כולל `mcu.html`. הוא יוצר על `window` את `__tour.caption(text: string, accent: boolean)` ואת `__tour.tap(x: number, y: number)`.
  - כתובית: פס בתחתית המסך, `position: fixed`, `z-index: 2147483647`, `dir="rtl"`, הגופן `Assistant, sans-serif`, רקע כהה חצי-שקוף, טקסט לבן בגודל 20px, ומעבר fade של 300ms. עם `accent`: מסגרת זוהרת בצבע `#ffcc4d` ו-`font-weight: 700`. אם `text` ריק, הכתובית מוסתרת.
  - נגיעה: עיגול בקוטר 44px בנקודה (x, y) שגדל ונעלם בתוך 500ms.
  - השכבה עם `pointer-events: none`, כדי שלא תחסום לחיצות.
- מייצרת: `caption(page, text, { accent = false } = {}): Promise<void>` ו-`tap(page, selector, { timeout = 5000 } = {}): Promise<boolean>`. הפונקציה `tap` מחכה לאלמנט שנראה על המסך, גוללת אליו, מציגה נגיעה במרכז שלו, מחכה 350ms ולוחצת. היא מחזירה `false` (ולא זורקת שגיאה) אם האלמנט לא הופיע בזמן.

- [ ] **שלב 1: כתיבת הבדיקות שנכשלות** (Chromium אמיתי, `page.setContent` עם כפתור)
- אחרי `caption(page, "שלום")`: יש אלמנט עם הטקסט `שלום`, והוא נראה על המסך
- אחרי `caption(page, "x", { accent: true })`: המאפיין `data-accent` שווה `"true"`
- אחרי `caption(page, "")`: הכתובית מוסתרת
- `tap(page, "#b")` מחזיר `true`, וה-handler של הכפתור רץ
- `tap(page, "#nope", { timeout: 300 })` מחזיר `false`
- `getComputedStyle` של השכבה מחזיר `pointer-events` שווה `"none"`

- [ ] **שלב 2:** להריץ `npm --prefix video test`. **הציפייה:** בדיקות overlay נכשלות.
- [ ] **שלב 3:** לממש את `overlay.mjs`. הבדיקה מזריקה את `overlayInitScript()` דרך `page.addInitScript`, לפני `setContent`.
- [ ] **שלב 4:** להריץ `npm --prefix video test`. **הציפייה:** הכול עובר.
- [ ] **שלב 5: קומיט** `feat(video): caption and tap overlay`

### משימה 3: הסצנות וההקלטה

**הקבצים:**
- ליצור: `video/scenes.mjs`
- ליצור: `video/record.mjs`
- ליצור: `video/tests/scenes.test.mjs`

**הממשקים:**
- צורכת: `startServer`, `toMp4`, `overlayInitScript`, `caption` ו-`tap`.
- מייצרת: `SCENES: Array<{ id: string, caption: string, accent?: boolean, dwell: number, run(page, ctx): Promise<void> }>`. ה-`ctx` מכיל את `{ url, tap, caption, data }`, כש-`data` הוא התוכן של `site/data.json`. השדה `dwell` הוא מספר השניות שהסצנה מחזיקה על המסך אחרי הפעולות שלה.

**הסצנות לפי הסדר** (הכתוביות כאן הן הטקסט המדויק):

| id | הכתובית | מה קורה |
|---|---|---|
| `home` | `לא יודעים מה לראות הערב? Bingology בוחרת בשבילכם` | `goto(url)`, מחכים ל-`.marq img` |
| `quiz` | `עונים על כמה שאלות קצרות…` ואחרי התוצאה `…ומקבלים את הבחירה האולטימטיבית` | לוחצים על `[data-a="start"][data-v="quick"]`, ואז לולאה של עד 12 צעדים: אם יש `[data-a="opt"]`, לוחצים על הראשון. אם יש `[data-a="chip"]`, לוחצים על הראשון ואז על `[data-a="next"]`. אם יש `[data-a="sortpick"]`, לוחצים על הראשון. אחרת לוחצים על `[data-a="next"]`. עוצרים כשמופיע `.rtitle` |
| `card` | `כל סדרה: עונות, ציונים, איפה צופים וטריילר` | לוחצים על `[data-a="detail"]` הראשון בתוצאה, מחכים ל-`#dlg[open]` וגוללים בתוך הדיאלוג. אם יש `[data-a="play"]`, לוחצים, מחכים 4 שניות וסוגרים עם `[data-a="vclose"]` (טיימאאוט של 3 שניות). בסוף `[data-a="dclose"]` |
| `list` | `כל הסדרות במקום אחד — ומסננים לפי שירות הצפייה שלכם` | `[data-a="tab"][data-v="list"]`, ואז לוחצים על ה-`[data-a="lplat"]` השני (לא על "all") וגוללים 600px |
| `search` | `מחפשים בעברית או באנגלית` | `[data-a="tab"][data-v="search"]`, ואז מקלידים ב-`#serq` את 5 התווים הראשונים של `data.series[0].n` (או של השדה המקביל ב-data.json) עם `delay: 120` |
| `actors` | `…או לפי השחקנים שאתם אוהבים` | `[data-a="tab"][data-v="actors"]`, ואז לוחצים על ה-`[data-a="actpick"]` הראשון |
| `games` | `משחקים יומיים לחובבי סדרות 🧩` | `[data-a="tab"][data-v="games"]` ומחכים ל-`#games` עם תוכן. אין לחיצה על משחק |
| `marvel` | `🌌 היקום של מארוול — מוקדש לעמליה ❤️` (`accent: true`) | `goto(url + "mcu.html")`, מחכים עד ש-`.m-warn` נעלם וגוללים לאט 900px |
| `mine` | `נכנסים עם Google — ושומרים רשימות, התקדמות ומשתפים חברים` | `goto(url)`, ואז `[data-a="tab"][data-v="mine"]` ומחכים ל-`[data-a="signin-google"]` (טיימאאוט של 8 שניות) |

לפני שכותבים את `run`, מוודאים את מבנה `site/data.json` (המפתח של מערך הסדרות ושם השדה של השם) ומתאימים את סצנת החיפוש.

- [ ] **שלב 1: כתיבת הבדיקות שנכשלות** (`scenes.test.mjs`, בלי דפדפן)
- הערכים של `SCENES.map(s => s.id)` שווים בדיוק לרשימה `["home","quiz","card","list","search","actors","games","marvel","mine"]`
- לכל סצנה יש `caption` לא ריק ו-`run` שהוא פונקציה
- הסצנה `marvel` מוגדרת עם `accent === true`, וה-caption שלה שווה בדיוק `"🌌 היקום של מארוול — מוקדש לעמליה ❤️"`
- רק לסצנת `marvel` יש `accent`
- סכום ה-`dwell` בין 35 ל-60 (יחד עם זמן הפעולות, הסרטון יוצא 60–90 שניות)

- [ ] **שלב 2:** להריץ `npm --prefix video test`. **הציפייה:** בדיקות scenes נכשלות.
- [ ] **שלב 3:** לממש את `scenes.mjs` ואת `record.mjs`. הסדר ב-`record.mjs`:
  1. בודקים ש-`ffmpeg-static` ו-Chromium קיימים, ואם לא, יוצאים עם קוד 1 והודעה בעברית
  2. `startServer(<repo>/site)`
  3. `chromium.launch()` ו-context עם ההגדרות מהאילוצים, ו-`recordVideo: { dir: video/out/raw, size: {780,1688} }`
  4. `addInitScript(overlayInitScript())`
  5. לכל סצנה: `caption`, אחר כך `run` בתוך try/catch (בכישלון: `console.warn` עם ה-id), ובסוף `waitForTimeout(dwell * 1000)`
  6. `context.close()`, ואז `toMp4(raw, video/out/bingology-tour.mp4)` ומחיקת `video/out/raw`
  7. מדפיסים את הנתיב ואת האורך. האורך נלקח מתוך פלט ה-stderr של `ffmpeg -i` (`Duration: …`)
- [ ] **שלב 4:** להריץ `npm --prefix video test`. **הציפייה:** הכול עובר.
- [ ] **שלב 5:** להריץ `npm run video` מהשורש. **הציפייה:** נוצר `video/out/bingology-tour.mp4`, האורך המודפס בין 60 ל-90 שניות, ו-`git status` לא מראה שינויים ב-`site/`.
- [ ] **שלב 6:** לחלץ 9 פריימים, אחד מאמצע כל סצנה. אפשר להשתמש ב-`ffmpeg -ss <t> -frames:v 1` או לשמור `page.screenshot` לכל סצנה ב-`video/out/frames/`. צריך לבדוק בעין שהכתובית קריאה, שהעברית מימין לשמאל, ושבסצנת מארוול ההקדשה לעמליה מודגשת. אם אורך הסרטון יוצא מחוץ לטווח, מכווננים את ה-`dwell`.
- [ ] **שלב 7: קומיט** `feat(video): scripted tour scenes and recorder (npm run video)`

### משימה 4: תיעוד

**הקבצים:**
- לשנות: `README.md`. מוסיפים תחת "פיתוח מקומי" סעיף "סרטון הדרכה": התקנה חד-פעמית עם `npm --prefix video install`, הפקה עם `npm run video`, ואיפה נשמר הקובץ. כדאי לציין גם שהסצנות והכתוביות נמצאות ב-`video/scenes.mjs`.

- [ ] **שלב 1:** לעדכן את README.
- [ ] **שלב 2: קומיט** `docs: how to record the tour video`

# Bingology

אפליקציה לבחירת סדרה לבינג׳ מתוך שתי רשימות: הרשימה האישית (60 סדרות) ו-100 הסדרות הטובות של המאה ה-21 של הניו יורק טיימס.
הנתונים (עונות, פרקים, פוסטרים, שחקנים, ציון IMDb וזמינות בסטרימינג בישראל) מתעדכנים אוטומטית כל לילה.

## איך זה עובד

```
series.json            ← הרשימות והטעם האישי (נערך ידנית)
scripts/fetch-data.mjs ← רץ כל לילה ב-GitHub Actions: TMDB + OMDb
site/data.json         ← נוצר אוטומטית — לא עורכים ידנית
site/                  ← האתר, מתפרסם ב-GitHub Pages
```

אם העדכון הלילי נכשל (שירות לא זמין, יותר מ-20% מהסדרות נכשלו, או נתונים לא תקינים) — האתר נשאר על הגרסה האחרונה שעבדה, ו-GitHub שולח מייל.

## הקמה (פעם אחת)

### 1. מפתח TMDB
1. נרשמים ב-[themoviedb.org](https://www.themoviedb.org/signup).
2. נכנסים ל-**Settings → API** ([קישור](https://www.themoviedb.org/settings/api)) ומבקשים מפתח (Developer, שימוש אישי).
3. מעתיקים את **API Read Access Token** (המחרוזת הארוכה, לא ה-API Key הקצר).

### 2. מפתח OMDb (ציוני IMDb)
1. נרשמים ב-[omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) — המסלול החינמי (1,000 בקשות ביום) מספיק.
2. מאשרים את המייל ומעתיקים את המפתח.

### 3. GitHub
1. יוצרים מאגר ציבורי בשם `bingology` ומעלים אליו את הקוד.
2. **Settings → Secrets and variables → Actions → New repository secret** — מוסיפים שניים:
   - `TMDB_TOKEN` — ה-Read Access Token מ-TMDB
   - `OMDB_KEY` — המפתח מ-OMDb
3. **Settings → Pages → Source:** בוחרים **GitHub Actions**.
4. **Actions → Update data → Run workflow** — הרצה ראשונה ידנית. הרצה ידנית תמיד מפרסמת את האתר, גם אם הנתונים לא השתנו.

האתר יהיה בכתובת `https://<שם-המשתמש>.github.io/bingology`.

## הוספה או הסרה של סדרה

1. עורכים את `series.json`: מוסיפים רשומה עם `"tmdbId": null`, שם, `lists`, ז׳אנרים, מצבי רוח, כובד, תיאור, ו-`fallback` (ערכים משוערים למקרה שאין עדיין נתונים חיים). להסרה — מוחקים את הרשומה.
2. מריצים `npm run match` (צריך `TMDB_TOKEN`) — הסקריפט ממלא את ה-`tmdbId`. אם הוא לא בטוח, הוא כותב את המועמדים ל-`needs-review.md` וצריך להעתיק את המזהה הנכון ידנית.
3. עושים commit ו-push. בלילה הנתונים יתעדכנו, או מריצים את **Update data** ידנית.

## פיתוח מקומי

צריך Node.js 20 ומעלה.

```bash
npm test                         # בדיקות
npm run fetch -- --offline       # data.json בלי רשת (מהנתונים הקודמים / fallback)
python3 -m http.server 8080 -d site
```

עם מפתחות (בקובץ `.env`, שלא נכנס ל-git):

```bash
set -a; source .env; set +a
npm run fetch -- --only 3        # בדיקת עשן, לא כותב כלום
npm run fetch                    # עדכון מלא של site/data.json
```

אם מופיעה אזהרה `unknown IL provider "…"` — מוסיפים את השם לקטגוריה המתאימה ב-`scripts/providers.json`.

## קרדיטים

This product uses the TMDB API but is not endorsed or certified by TMDB. נתוני זמינות: JustWatch. ציוני IMDb דרך OMDb.

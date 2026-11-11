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

**המאגר הרחב:** האתר מציג 1001 סדרות — הרשימות שלך, ומה שחסר משלימים כל לילה מהסדרות המדורגות ביותר ב-TMDB (בלי ריאליטי, אירוח, חדשות, ילדים ואנימציה). הרף מתחיל ב-7.5 עם 500 מצביעים ויורד בהדרגה (עד 7.0 עם 200) רק עד שיש מספיק, ונשארות רק סדרות עם 7.5+ ב-IMDb (או בלי ציון IMDb). התגיות מנוחשות מהז׳אנרים (`scripts/lib/discover.mjs`). ציון IMDb נשמר ומתרענן כל 3 ימים לכל סדרה, עם תקציב של 900 בקשות OMDb בלילה (המכסה היומית 1,000).

**שירותי צפייה:** ל-TMDB אין נתונים על Disney+ ועל השירותים הישראליים בישראל. Disney+ מוערך לפי Disney Plus / Hulu בארה״ב ומסומן "(כנראה)". yes, HOT, פרטנר, סלקום וכאן מסומנים ידנית: `extraProviders` ב-`series.json` או "זמין גם ב-" בטופס ההוספה.

**ציון בינג׳** (50–100) משלב IMDb (40%), TMDB (20%), רוטן טומייטו (30%) והניו יורק טיימס (10%). כל מקור מומר לאחוזון בתוך הרשימה, מקור חסר לא פוגע בציון, ובציוני TMDB עם מעט מצביעים הציון נמשך לממוצע. המשקלות ב-`site/lib/binge.js`.

**אזור אישי:** לשונית "אישי" באתר (רשימות, התקדמות ושיתוף עם חברים) נשמרת ב-Supabase, עם התחברות Google או מייל. האתר עצמו נשאר סטטי; ההגנה על הנתונים היא כללי RLS ב-`supabase/schema.sql`, והעדכון הלילי שולח גם פינג קטן כדי שהפרויקט החינמי לא יושהה. ההקמה למטה.

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

## אזור אישי (Supabase)

הקמה חד-פעמית, ידנית. פרויקט הבדיקות `bingology-test` כבר קיים; כאן מקימים את פרויקט הייצור.

### 1. פרויקט Supabase
1. נכנסים ל-[supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. שם: `bingology`. אזור (Region): **Central EU (Frankfurt)**. מסלול Free.

### 2. סכמה (טבלאות וכללי הגנה)
1. בפרויקט: **SQL Editor → New query**.
2. מדביקים את כל התוכן של `supabase/schema.sql` ולוחצים **Run**.
3. אחרי כל שינוי עתידי בסכמה — מריצים אותה שוב כך.

### 3. התחברות
1. **Authentication → Providers → Email:** מוודאים שמופעל.
2. **Authentication → Providers → Google:** מפעילים, ומעתיקים משם את **Callback URL** (נראה כמו `https://<project>.supabase.co/auth/v1/callback`).
3. ב-[Google Cloud Console](https://console.cloud.google.com/): יוצרים פרויקט → **APIs & Services → OAuth consent screen** (External, ממלאים שם ומייל) → **Credentials → Create credentials → OAuth client ID** → סוג **Web application**. תחת **Authorized redirect URIs** מדביקים את ה-Callback URL מהשלב הקודם.
4. מעתיקים את **Client ID** ו-**Client secret** חזרה ל-Supabase (עמוד ה-provider של Google) ושומרים.
5. **Authentication → URL Configuration:** ב-**Site URL** וגם ב-**Redirect URLs** מזינים `https://achiyafried.github.io/bingology/`.

### 4. מפתחות באתר
1. **Project Settings → API Keys** (או **API**): מעתיקים את **Project URL** ואת ה-**Publishable key** (מתחיל ב-`sb_publishable_`; בדשבורד ישן הוא נקרא `anon`).
2. מדביקים אותם ב-`site/lib/account/config.js`.
3. המפתחות האלה פומביים בכוונה, וההגנה היא כללי ה-RLS. את ה-**Secret key** (`service_role`) לעולם לא שמים בקוד האתר.

### 5. סודות ב-GitHub (פינג לילי)
ב-**Settings → Secrets and variables → Actions** מוסיפים שניים (של פרויקט הייצור):
- `SUPABASE_URL` — ה-Project URL
- `SUPABASE_ANON_KEY` — ה-Publishable key

העדכון הלילי שולח בקשת קריאה קטנה כדי שהפרויקט לא יושהה אחרי שבוע ללא פעילות. אם הצעד נכשל הוא לא מפיל את העדכון.

### 6. פרויקט הבדיקות (למפתחים)
```bash
sh scripts/set-supabase-keys.sh   # שומר ב-.env: SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SERVICE_KEY
npm run test:rls                  # בדיקות כללי ההגנה מול פרויקט הבדיקות

sh scripts/set-supabase-token.sh  # טוקן אישי קצר-מועד (Account → Access Tokens)
npm run schema:test               # מחיל את schema.sql על פרויקט הבדיקות
```
אחרי הרצת הסכמה מבטלים (Revoke) את הטוקן ב-Supabase.

## הוספה או הסרה של סדרה

**הדרך הקלה:** בלשונית החיפוש באתר, כשסדרה לא נמצאת, לוחצים "➕ הוספה או הצעה לרשימה" (או ישירות: Issues → New issue → "הוספת סדרה לרשימה"). חובה רק השם. בקשה שלך נוספת אוטומטית תוך כמה דקות; הצעה של מישהו אחר נוספת רק אחרי שמוסיפים לה את התווית `approved`. אם יש כמה סדרות באותו שם, התהליך מבקש להדביק קישור מ-TMDB — עריכת הבקשה מפעילה אותו שוב.

**ידנית:**

1. עורכים את `series.json`: מוסיפים רשומה עם `"tmdbId": null`, שם, `lists`, ז׳אנרים, מצבי רוח, כובד, תיאור, ו-`fallback` (ערכים משוערים למקרה שאין עדיין נתונים חיים). להסרה — מוחקים את הרשומה.
2. מריצים `npm run match` (צריך `TMDB_TOKEN`) — הסקריפט ממלא את ה-`tmdbId`. אם הוא לא בטוח, הוא כותב את המועמדים ל-`needs-review.md` וצריך להעתיק את המזהה הנכון ידנית.
3. עושים commit ו-push. בלילה הנתונים יתעדכנו, או מריצים את **Update data** ידנית.

## פיתוח מקומי

צריך Node.js 22 ומעלה.

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

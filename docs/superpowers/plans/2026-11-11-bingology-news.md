# Bingology "מה חדש" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public "מה חדש" page (bell + home-screen strip + `#news` page) generated nightly by diffing tonight's TMDB data against last night's, plus an "עונות בדרך" section built in the browser from data that already exists.

**Architecture:** `transformTv` adds `next` and `streams` to each series (no extra TMDB calls). After the nightly merge, a pure `buildNews(prevData, data, prevNews, now)` diffs the two datasets and folds the result into `site/news.json` (60 days / 400 items, de-duplicated, flapping stream changes removed). The site fetches `news.json` after `data.json`; pure helpers in `site/lib/news.js` produce Hebrew copy, day groups and upcoming seasons; `site/views/news.js` (lazy) renders the strip and the page.

**Tech Stack:** Node 22 (`node:test`), vanilla ES modules, GitHub Actions, GitHub Pages. Zero npm dependencies.

**Spec:** `docs/superpowers/specs/2026-11-11-bingology-news-design.md`

**Branch:** `feat/news`, cut from `main` **after** `feat/personal-area` is merged (both touch `app.js`, `transformTv`, `fetch-data.mjs`).

## Global Constraints

- Zero npm dependencies. Tests: `node --test`.
- No new TMDB requests: `next` and `streams` come from the existing `/tv/{id}` response with `watch/providers`.
- `streams` regions exactly `IL`, `US`, `UK` (TMDB `GB` is stored as `UK`); provider names stored exactly as TMDB's `provider_name`; missing region → `[]`.
- `next` = `{ season, episode, date }` from `next_episode_to_air` (`season_number`, `episode_number`, `air_date`) or `null`.
- `next` and `streams` are **live only** in `data.json` — no fallback from last night (spec "יחידות", merge.mjs row).
- Item kinds exactly: `announced`, `premiere`, `ended`, `canceled`, `stream_added`, `stream_removed`. Item `id` exactly as spec examples: `${tmdbId}-announced-${season}-${airDate}`, `${tmdbId}-premiere-${season}`, `${tmdbId}-ended`, `${tmdbId}-canceled`, `${tmdbId}-stream_added-${region}-${provider}`, `${tmdbId}-stream_removed-${region}-${provider}`.
- Item `date` = run date `now.slice(0, 10)` (UTC; the nightly runs at 03:00 UTC, same calendar day in Israel).
- `news.json` shape: `{ "updatedAt": <ISO>, "items": [newest first] }`; keep last **60** days, at most **400** items. Flap window **7** days.
- No news: first run (no previous `data.json`), series missing from either day, series whose fetch failed tonight (`fetchedAt !== now`), or fields `next`/`streams` absent yesterday.
- News failure never fails the nightly update: warning, `news.json` left as is.
- Filters exactly: הכל / עונות חדשות (`announced`, `premiere`, and the "עונות בדרך" section) / סטרימינג (`stream_*`) / הסתיימו (`ended`, `canceled`).
- Day groups exactly: היום / אתמול / השבוע / קודם (browser local date).
- Copy (verbatim from the spec "נוסחים"): tags "עונה חדשה הוכרזה", "התחילה היום" / "התחילה", "עלתה לסטרימינג", "ירדה מסטרימינג", "הסתיימה", "בוטלה"; titles "Severance · עונה 3 ב-14 במרץ 2027", "Slow Horses · עונה 5", "The Bear · Disney Plus", "Succession · ירדה מ-Sky Go"; subs "עדיין ב-…", "כל הפרקים זמינים לבינג׳", "אחרי N עונות"; empty page "אין חדשות כרגע".
- "עונות בדרך": series with `next.episode === 1` and `next.date` after today, nearest first, up to **10** then "עוד N"; hidden when empty. Home strip: 3 most recent items; when fewer than 3 items from the last 7 days, fill from upcoming seasons.
- Bell dot: `localStorage` key `bingology:newsSeen` = `date` of the newest item seen; every access in `try/catch`.
- UI Hebrew RTL, existing tokens/classes (`.chip`, `.btn`, `.linkbtn`, `.empty`), dark mode; visual reference = the approved news mockup (bell beside the logo, strip under "או פשוט תפתיעו אותי", page with day groups and colored tags, country flag chip on stream items).
- Items whose `tmdbId` is not in today's `data.json` are not shown.

## Review Focus

1. **A series whose fetch failed tonight** — keeps last night's other fields but has no `next`/`streams` (live only); it must produce no `stream_removed`/`ended` items tonight and no false items tomorrow. (Test in Task 2.)
2. **Pool rotation** — ~dozens of series enter/leave the wide pool nightly; none of them may produce items. (Test in Task 2.)
3. **JustWatch flapping** — removed tonight, back in 3 days → both items gone; back in 8 days → both kept. (Test in Task 3.)
4. **Missing or corrupt `news.json`** — on the site: no bell dot, no strip, `#news` shows "אין חדשות כרגע", rest of site unaffected; in the nightly: start empty with a warning. (Tests in Tasks 4 and 6.)
5. **Announcement date moves** (TMDB shifts the premiere) — a new `announced` item with the new date; same date tomorrow → nothing. (Test in Task 2.)

---

### Task 1: `next` and `streams` in nightly data

**Files:**
- Modify: `scripts/lib/tmdb.mjs` (`transformTv`, `live`)
- Modify: `scripts/lib/merge.mjs` (`mergeEntry`: live-only fields)
- Modify: `site/lib/data.js` (`fromData`)
- Test: `tests/tmdb.test.mjs`, `tests/merge.test.mjs`, `tests/site-data.test.mjs`

**Interfaces:**
- Produces: data.json `next: {season, episode, date}|null`, `streams: {IL: string[], US: string[], UK: string[]}|null`; app series `nx` (= `next`) and `strm` (= `streams`; not `st`, which is app.js's state object).

- [ ] **Step 1: Failing tests**
  - `transformTv` with `next_episode_to_air: {season_number: 3, episode_number: 1, air_date: "2027-03-14"}` → `live.next` deep-equals `{season: 3, episode: 1, date: "2027-03-14"}`; missing → `null`.
  - `watch/providers.results` with `IL.flatrate:[{provider_name:"Apple TV+"}]`, `GB.flatrate:[{provider_name:"Sky Go"}]`, no `US` → `live.streams` deep-equals `{IL:["Apple TV+"], US:[], UK:["Sky Go"]}`.
  - `mergeEntry` with `live` → copies `next`/`streams`; with `live = null` and `prev` having them → both `null` (live only).
  - `fromData` maps `nx`, `strm`; missing → `null`.
- [ ] **Step 2:** `npm test` → new tests FAIL.
- [ ] **Step 3:** Implement. In `mergeEntry`: `s.next = live ? live.next ?? null : null; s.streams = live ? live.streams ?? null : null;` (not in `SCALAR_FIELDS`, which falls back to `prev`).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: next episode and multi-region streams in nightly data`.

### Task 2: Diff two nights into items (pure)

**Files:**
- Create: `scripts/lib/news.mjs`
- Test: `tests/news.test.mjs`

**Interfaces:**
- Consumes: data.json series shape from Task 1 (`tmdbId`, `seasons`, `status`, `next`, `streams`, `fetchedAt`).
- Produces: `diffNews(prevSeries: object[], currSeries: object[], now: string) -> item[]` (item shapes and ids per Global Constraints).

- [ ] **Step 1: Failing tests** (fixtures built inline; `now = "2026-11-12T03:00:00Z"`, current series have `fetchedAt: now`)
  - `announced`: prev `{seasons: 2, next: null}`, curr `{seasons: 2, next: {season: 3, episode: 1, date: "2027-03-14"}}` → one item `{id: "95396-announced-3-2027-03-14", date: "2026-11-12", kind: "announced", season: 3, airDate: "2027-03-14"}`. Same `next` both nights → `[]`. Date changed to `"2027-04-01"` → new item with the new id.
  - `premiere`: prev `{seasons: 4, next: {season: 5, episode: 1, date: "2026-11-12"}}`, curr `{seasons: 5}` → `{kind: "premiere", season: 5}`; season 1 premieres → nothing.
  - `ended` / `canceled`: status `airing` → `ended` / `canceled`.
  - `stream_added` / `stream_removed`: `UK` gains "Sky Go" / `IL` loses "Netflix" → items with `region`, `provider`.
  - No items: `prev` empty array (first run); series only in curr or only in prev; curr series with `fetchedAt` ≠ `now`; prev series without `next`/`streams` keys.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: nightly news diff`.

### Task 3: Fold items into news.json (pure)

**Files:**
- Modify: `scripts/lib/news.mjs`
- Test: `tests/news.test.mjs`

**Interfaces:**
- Produces: `mergeNews(prevNews: {items}|null, newItems: item[], now: string) -> {updatedAt, items}`; `buildNews(prevData, data, prevNews, now) -> {news, changed: boolean}` (calls `diffNews` then `mergeNews`; `changed` false when items are identical to `prevNews.items`).

- [ ] **Step 1: Failing tests**
  - New items go first; an item whose `id` already exists is dropped.
  - Items older than 60 days (by `date`) are removed; more than 400 → oldest cut.
  - Flap: `stream_removed` IL/Netflix on 2026-11-10 then `stream_added` IL/Netflix on 2026-11-13 → both removed; same pair 8 days apart → both kept. Also the reverse order (added then removed).
  - `prevNews` null → starts empty. `buildNews` with no new items → `changed: false`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: news history with flap filter`.

### Task 4: Wire into the nightly job

**Files:**
- Modify: `scripts/fetch-data.mjs` (`main`)
- Modify: `.github/workflows/update-data.yml` (commit step adds `site/news.json`; `changed` output true when either file changed)
- Test: `tests/fetch-data.test.mjs` (or a new small test of the helper you extract)

**Interfaces:**
- Consumes: `buildNews` (Task 3).
- Produces: `site/news.json` written by the nightly run.

- [ ] **Step 1: Failing tests** — extract `writeNews({prevData, data, newsPath, now, read, write, warn})` (fs injected) in `scripts/lib/news.mjs`:
  - corrupt previous `news.json` (`read` returns `"{oops"`) → `warn` called once, result written from an empty history.
  - `buildNews` throwing (pass `data: null`) → `warn` called, `write` never called, no throw.
  - unchanged → `write` not called.
- [ ] **Step 2:** FAIL. **Step 3:** Implement; call it in `main()` after the abort/smoke checks and **before** the `sameData` early return, passing the `prev` read at start (news.json is decided independently of whether data.json changed). Workflow: `git status --porcelain site/data.json site/news.json`, `git add site/data.json site/news.json`.
- [ ] **Step 4:** `npm test` PASS; `node scripts/fetch-data.mjs --offline` runs without error and writes no news (offline → no fetchedAt = now → `[]`).
- [ ] **Step 5:** Commit `feat: nightly news.json`.

### Task 5: Hebrew copy, day groups, upcoming seasons (pure)

**Files:**
- Create: `site/lib/news.js`
- Test: `tests/news-site.test.mjs`

**Interfaces:**
- Consumes: app series (`nx`, `strm`, `s`, `n`, `poster`, `tmdbId`), items from news.json.
- Produces: `newsText(item, s, today) -> {tag, kind, title, sub, region|null}`; `groupByDay(items, today) -> [{label, items}]` (labels היום / אתמול / השבוע / קודם; empty groups omitted); `unseenCount(items, lastSeen) -> number`; `upcomingSeasons(S, today) -> [{tmdbId, season, date}]`; `stripItems(items, S, today) -> (item|upcoming)[]` (3; fills from upcoming when fewer than 3 items in last 7 days); `formatDateHe("2027-03-14") -> "14 במרץ 2027"`.

- [ ] **Step 1: Failing tests** — every copy line in Global Constraints asserted verbatim:
  - `announced` Severance → title "Severance · עונה 3 ב-14 במרץ 2027", sub = IL services joined, else US.
  - `premiere` on today → tag "התחילה היום"; earlier → "התחילה".
  - `stream_removed` Succession UK Sky Go with `strm.UK=[]`, `strm.IL=["HBO Max"]` → sub "עדיין ב-HBO Max"; nothing anywhere → sub "".
  - `ended` → sub "כל הפרקים זמינים לבינג׳"; `canceled` with `s: 2` → "אחרי 2 עונות".
  - `groupByDay` around midnight: item dated today/yesterday/5 days ago/20 days ago → four groups in order.
  - `upcomingSeasons`: past date excluded, `episode !== 1` excluded, `nx` null excluded, sorted by date.
  - `stripItems`: 1 recent item + 5 upcoming → 3 entries (item first); 4 recent items → 3 items.
  - `unseenCount(items, null)` → all; with newest date → 0.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: news copy and grouping helpers`.

### Task 6: Bell, home strip, `#news` page

**Files:**
- Create: `site/views/news.js`
- Modify: `site/app.js` (fetch `news.json` after `data.json` — failure → `st.news = null`, silent; bell in the header; strip in `introHTML`; `#news` in `route()`; lazy `import("./views/news.js")`)
- Modify: `site/styles.css` (bell, strip, news page, tag colors, flag chip — from the mockup, tokens only)
- Test: `tests/news-site.test.mjs` (render functions), `tests/site-data.test.mjs` (lazy-load guard still passes)

**Interfaces:**
- Consumes: Task 5 helpers.
- Produces: `stripHTML(entries, S) -> string`, `newsPageHTML({items, upcoming, filter, today}, S) -> string`, `bellHTML(count) -> string`.

- [ ] **Step 1: Failing tests**
  - `bellHTML(0)` has no dot; `bellHTML(2)` has the dot and an aria-label mentioning new items.
  - `stripHTML([])` → `""`.
  - `newsPageHTML` with no items and no upcoming → "אין חדשות כרגע"; with filter "סטרימינג" → only `stream_*` and no "עונות בדרך"; filter "עונות חדשות" → upcoming section shown; stream item shows the region chip; every title passes through `esc`.
  - Items for a `tmdbId` not in `S` are not rendered.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. Opening `#news` sets `bingology:newsSeen` to the newest item `date`. Tapping an item calls the existing `openDlg` for that series. Strip and bell render from boot state; the page module loads only on `#news`.
- [ ] **Step 4:** `npm test` PASS. Browser (local `site` server, 375px, light + dark) with a fixture `site/news.json` (do not commit it): bell with and without dot, strip (and fill from upcoming), page, each filter, tap opens card, `news.json` missing (404) → no bell dot, no strip, page empty message, rest of site works.
- [ ] **Step 5:** Commit `feat: what's new page, bell and home strip`.

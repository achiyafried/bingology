# אזור MCU — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A separate MCU page: every Marvel Studios movie and Disney+ season on a story-order (or release-order) timeline, in three viewer-chosen styles and two views, with local "seen" tracking and "next up".

**Architecture:** A hand-written `mcu.json` (story order, era, phase) is enriched nightly by `scripts/fetch-mcu.mjs` into `site/mcu-data.json`. The page `site/mcu.html` loads its own modules in `site/mcu/`: pure logic (`timeline.js`, `seen.js`) and rendering (`app.js`), styled by `site/mcu/mcu.css` with three theme classes on `<html>`.

**Tech Stack:** Vanilla ES modules, Node 22 scripts, TMDB v3, YouTube Data API (existing helpers), `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-17-bingology-mcu-timeline-design.md`

## Global Constraints

- Only what the official Disney+ "MCU in timeline order" collection includes; one item per movie, one per season.
- `id` values (`movie:<tmdb>` / `tv:<tmdb>:s<n>`) never change; seen marks are keyed by them.
- localStorage keys: `bingology:mcu-seen` (array of ids), `bingology:mcu-theme` (`cosmic` | `comic` | `hud`, default `cosmic`), `bingology:mcu-order` (`story` | `release`, default `story`), `bingology:mcu-view` (`list` | `grid`, default `list`). Every access in try/catch.
- `mcu.html` loads nothing from Bingology's `app.js`/`styles.css`; it may import `site/lib/esc.js` and `site/lib/trailer.js`.
- The nightly MCU step must never fail the series update (`continue-on-error`); >20% failed items or a crash keeps the previous `site/mcu-data.json`.
- An item with no data yet (new and failed on its first night) is hidden and not counted. An item whose release date is after today is "בקרוב" only.
- Hebrew RTL; names inside `<bdi>`, all data through `esc()`.
- Commit at the end of each task on `feat/mcu`. Don't push or merge.

## Review Focus

1. A seen id that no longer exists in the data → kept in storage, not counted in "ראית X מתוך Y".
2. Storage unavailable (private mode) → marks work for the page's lifetime and a one-line note says they won't be kept.
3. A season with no own trailer → the show's trailer; a movie with no Hebrew title → English title only.
4. Everything seen → "next up" shows the finished message, not an empty card.
5. Phone width 375px in all three themes × two views → no horizontal page scroll.

---

### Task 1: `mcu.json` and its validation

**Files:**
- Create: `mcu.json`, `scripts/lib/mcu.mjs`
- Test: `tests/mcu-file.test.mjs`

**Interfaces:**
- Produces: `validateMcu(list) -> string[]` (errors, one per problem, naming the row) in `scripts/lib/mcu.mjs`. Row shape: `{ id, tmdb, kind: "movie"|"season", season?, era, story, phase, note? }`.

- [ ] **Step 1: Tests** — `validateMcu`: valid rows → `[]`; duplicate `id`; `id` not matching `kind`/`tmdb`/`season` (`movie:<tmdb>`, `tv:<tmdb>:s<season>`); missing `era` or `story`; `kind: "season"` without integer `season ≥ 1`; `phase` not 1–6; unknown `kind`. And `the real mcu.json is valid and has at least 50 items`.
- [ ] **Step 2: Run** `node --test tests/mcu-file.test.mjs` — fails.
- [ ] **Step 3: Implement `validateMcu`; write `mcu.json`** in story order from the official Disney+ timeline as of November 2026, with TMDB ids verified by a TMDB lookup per title. `era` names: "שנות ה-40", "שנות ה-90", "2008–2012", "2013–2015", "2016–2018", "2023: אחרי הבליפ", "2024–2025", "2026 ואילך" (adjust only if the order demands; consecutive items share an era). Contested placements get a Hebrew `note`.
- [ ] **Step 4: Run** `npm test` — all pass.
- [ ] **Step 5: Commit** `feat(mcu): story-order timeline file`.

### Task 2: Nightly `fetch-mcu`

**Files:**
- Create: `scripts/fetch-mcu.mjs`
- Modify: `scripts/lib/mcu.mjs` (transforms), `.github/workflows/update-data.yml` (step after "Fetch all series", `continue-on-error: true`; commit step adds `site/mcu-data.json` when it exists), `package.json` (`"fetch:mcu"` script)
- Test: `tests/mcu-fetch.test.mjs`

**Interfaces:**
- Consumes: `validateMcu`; `tmdbGet`, `pool` (`scripts/lib/api.mjs`); `mapProviders`, `trailerCandidates` (`scripts/lib/tmdb.mjs`); `videoVerdicts` (`scripts/lib/youtube.mjs`).
- Produces: `run({ items, prev, fetchImpl, now, youtubeKey, map }) -> { data, warnings, abort }` exported from `scripts/fetch-mcu.mjs`; `data = { updatedAt, items: [...] }`, each item = the `mcu.json` row + `{ story_i, name, nameHe, date, runtime, episodes, poster, overview, overviewEn, vote, providers, providersGuess, trailer, fetchedAt }` (`story_i` = index in `mcu.json`; `runtime` minutes total; `episodes` null for movies; `poster` w342 URL).
- Requests: movie → `/movie/{id}` (en-US, `append_to_response=watch/providers,videos`, `include_video_language=en,he,null`) + `/movie/{id}` he-IL. Season → `/tv/{id}` (en-US, `watch/providers,videos`) + `/tv/{id}` he-IL + `/tv/{id}/season/{n}` (en-US, `append_to_response=videos`).

- [ ] **Step 1: Tests** (fake fetch, like `tests/fetch-data.test.mjs`)
  - `maps a movie` — name, nameHe, date = `release_date`, runtime, poster, providers via `mapProviders`, overview from he-IL else `overviewEn`.
  - `maps a season` — date = season `air_date`, episodes = episode count, runtime = sum of episode runtimes, poster = season poster else show's, nameHe = show's he name.
  - `season trailer first, then the show's` — season videos with a playable key win; none → show's first playable.
  - `a failed item keeps last night's data; a new failed item is left out`.
  - `more than 20% failed → abort: true` and `run` result is not written by `main`.
  - `invalid rows are skipped with a warning, never abort`.
- [ ] **Step 2: Run** — fails.
- [ ] **Step 3: Implement** transforms in `scripts/lib/mcu.mjs` and `run`/`main` in `scripts/fetch-mcu.mjs` (`main`: `loadEnv()`, read `mcu.json` + previous `site/mcu-data.json`, write only when `!abort`; YouTube check only with `YOUTUBE_KEY`).
- [ ] **Step 4: Run** `npm test`; then locally `npm run fetch:mcu` — writes `site/mcu-data.json`, prints item count and warnings.
- [ ] **Step 5: Commit** `feat(mcu): nightly TMDB data for the timeline` (including the generated `site/mcu-data.json`).

### Task 3: Timeline logic and tracking (pure)

**Files:**
- Create: `site/mcu/timeline.js`, `site/mcu/seen.js`
- Test: `tests/mcu-timeline.test.mjs`

**Interfaces:**
- Consumes: `mcu-data.json` items (Task 2).
- Produces:
  - `visible(items, today) -> { released, upcoming }` — drops items without `fetchedAt`; `date > today` (YYYY-MM-DD) → upcoming (sorted by date).
  - `ordered(items, order) -> items` — `"story"` by `story_i`, `"release"` by `date` then `story_i`.
  - `groups(items, order) -> [{ title, items }]` — story: consecutive `era`; release: `"שלב " + phase`.
  - `nextUp(items, seen, order) -> item | null`.
  - `progress(items, seen) -> { done, total }` — counts only ids present.
  - `loadSeen(storage) -> { ids: Set<string>, ok: boolean }`, `saveSeen(storage, ids) -> boolean`, `loadPref(storage, key, allowed, fallback) -> string`, `savePref(storage, key, value)`.

- [ ] **Step 1: Tests** — each function above, plus: unknown seen id not counted; storage that throws → `ok: false` and `saveSeen` returns false without throwing; `loadPref` rejects a value not in `allowed`; `nextUp` null when all seen.
- [ ] **Step 2: Run** — fails.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — passes.
- [ ] **Step 5: Commit** `feat(mcu): timeline order, eras, next up and seen marks`.

### Task 4: The MCU page

**Files:**
- Create: `site/mcu.html`, `site/mcu/app.js`, `site/mcu/view.js` (pure markup), `site/mcu/mcu.css`
- Modify: `site/app.js` (`introHTML`: an MCU card after `gamesCardHTML()`, an `<a class="gcard mcu" href="mcu.html">🌌 היקום של מארוול · ציר הזמן</a>`), `site/styles.css` (only that card)
- Test: `tests/mcu-view.test.mjs`

**Interfaces:**
- Consumes: Task 3 functions; `playerHTML`, `searchLinkHTML`, `ytErrorCode`, `YT_ORIGINS`, `validKey` (`site/lib/trailer.js`); `esc`, `safeImg` (`site/lib/esc.js`).
- Produces (`site/mcu/view.js`): `headerHTML({ theme, order, view, done, total })`, `nextHTML(item | null)`, `listHTML(groups, seen)`, `gridHTML(items, seen)`, `upcomingHTML(items)`, `cardHTML(item, seen)`. Buttons use `data-a`: `theme`, `order`, `view`, `seen` (data-id), `open` (data-id), `trail` (data-id), `close`.

- [ ] **Step 1: Tests** — `headerHTML` marks the current theme/order/view (`aria-pressed`) and shows `ראית 3 מתוך 5`; `nextHTML(null)` is the finished message `סיימת את כל ה-MCU! 🎉`; `listHTML` renders one `<h3>` per group and a ✓ `aria-pressed="true"` on seen items; `gridHTML` marks seen tiles `class="… seen"`; `cardHTML` shows `note` only when present and the trailer button only with a valid key (else the search link); all text escaped; Bingology's home has a link to `mcu.html`.
- [ ] **Step 2: Run** — fails.
- [ ] **Step 3: Implement** `view.js`, then `app.js` (fetch `mcu-data.json`, state from prefs, one delegated click handler, `<dialog>` card, trailer in place with the same error fallback as `site/app.js`), `mcu.html` (`<html lang="he" dir="rtl" class="theme-cosmic">`, Google Fonts per theme), `mcu.css`: shared layout on CSS variables; `.theme-cosmic` (dark navy `#0b0f2a`, gold `#f5c542`, glow line), `.theme-comic` (cream halftone, `#e62429`/`#ffd400`, 3px black borders, hard shadow), `.theme-hud` (`#05080b`, cyan `#7fe7ff`, monospace dates); phase colors 1–6 per theme as variables.
- [ ] **Step 4: Run** `npm test` — passes.
- [ ] **Step 5: Commit** `feat(mcu): the MCU page — timeline, styles, views, card`.

### Task 5: Check and review

- [ ] Serve `site/` locally; check in the browser at 375px and desktop: all 3 themes × 2 views × 2 orders; mark/unmark; next up advances; reload keeps marks and prefs; card opens, trailer plays and falls back; Bingology home card leads here and back link returns.
- [ ] Fix what's found (with a test where the bug is in pure code); commit.
- [ ] One fresh reviewer on the whole branch; fix confirmed findings; commit.

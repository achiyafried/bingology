# Kids Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A separate kids page (`site/kids.html`) with three age groups, a streaming-service filter, series cards and a daily "which series is hiding?" game, fed by a hand-picked `kids.json` refreshed nightly from TMDB.

**Architecture:** Same shape as the MCU zone. A hand-written `kids.json` → `scripts/fetch-kids.mjs` (nightly, best effort) → `site/kids-data.json`. The page is plain ESM in `site/kids/`: pure modules (`catalog.js`, `game.js`, `view.js`) tested in Node, and a thin `app.js` that wires the DOM.

**Tech Stack:** Node 22 (`node:test`), plain browser ESM, no dependencies.

**Spec:** `docs/superpowers/specs/2026-11-19-bingology-kids-design.md`

## Global Constraints
- Age groups: `small` (2–5, label "🐣 קטנטנים 2–5"), `mid` (6–9, "🚀 ילדים 6–9"), `big` (10–13, "⚡ גדולים 10–13"). Default `mid`.
- Age caps on `minAge`: `small` ≤ 7, `mid` ≤ 10, `big` ≤ 13. `null` minAge is allowed.
- Failure threshold: more than 20% failed → keep yesterday's file (`MAX_FAILED = 0.2`).
- No trailers and no YouTube anywhere on the page.
- localStorage keys: `bingology:kids-age`, `bingology:kids-game:<YYYY-MM-DD>`. Every access in `try/catch`.
- Every data string rendered goes through `esc` from `site/lib/esc.js`.
- Copy: no results "אין כאן סדרות בשירות הזה 🙈"; no IL service "לא מצאנו איפה רואים אותה בישראל"; win "כל הכבוד! 🎉"; loss "זאת הייתה …" (the series name).
- Bingology changes only: the menu tab in `site/app.js` and a `.tab.kids` rule in `site/styles.css`.
- Buttons at least 48px tall. Rubik font. Group colors: small yellow, mid turquoise, big purple.
- Commit with `git -c user.name="achiya fried" -c user.email="achiyafried@achiyas-MacBook-Pro.local" commit`, message ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus
1. **A group with fewer than 4 series** (or a filter that leaves 0–3): the game must still build a puzzle with as many choices as exist (min 2) or show nothing, never crash. → Task 5 test.
2. **Missing poster** (`poster: null`): grid, card and game show a placeholder tile with the name instead of a broken image; the game skips series without a poster when picking the answer. → Tasks 5 and 6 tests.
3. **Stored age/game state is junk** (`"xyz"`, broken JSON, storage throws): falls back to `mid` / a fresh game. → Task 5 and 7.
4. **A saved game for a group whose puzzle changed** (list edited mid-day): a saved state whose `answer` ≠ today's puzzle answer is ignored. → Task 5 test.
5. **Selected services that no longer exist in the new group** after switching groups: the filter drops unknown services, so the grid isn't empty for no visible reason. → Task 4 test.

---

### Task 1: Kids data library (validation + mapping), shared providers

**Files:**
- Create: `scripts/lib/providers.mjs` (move `providersOf` and `US_DISNEY` out of `scripts/lib/mcu.mjs`, export `providersOf`)
- Modify: `scripts/lib/mcu.mjs` (import `providersOf` from `./providers.mjs`)
- Create: `scripts/lib/kids.mjs`
- Test: `tests/kids-file.test.mjs`

**Interfaces:**
- Produces: `providersOf(wp, map) → { providers: string[], providersGuess: string[] }` (unchanged behavior).
- Produces: `AGES = ["small", "mid", "big"]`, `AGE_CAP = { small: 7, mid: 10, big: 13 }`.
- Produces: `validateKids(list) → string[]` errors, each `row <i>: …`; non-array → one error.
- Produces: `kidsLive(tv, he, map) → { name, nameHe, poster, overview, overviewEn, year, seasons, vote, minAge, providers, providersGuess }` where `nameHe = heText(he?.name, tv.name)`, `poster = "https://image.tmdb.org/t/p/w342" + poster_path` or null, `overview` = he overview or null, `overviewEn` = tv.overview or null, `year` from `first_air_date`, `seasons = number_of_seasons`, `vote` rounded to 1 decimal or null when `vote_count` is 0, `minAge = minAgeOf(tv)` from `scripts/lib/tmdb.mjs`.
- Produces: `overCap(row) → boolean` — `row.minAge != null && row.minAge > AGE_CAP[row.age]`.

- [ ] **Step 1: Write failing tests** in `tests/kids-file.test.mjs`:
  - `validateKids accepts good rows`: `[{tmdb:1,age:"small"},{tmdb:2,age:"big",he:"שם"}]` → `[]`.
  - `validateKids names each bad row`: duplicate tmdb (row 1, /duplicate/), `tmdb:"3"` (/tmdb/), `age:"teen"` (/age/), `he: 5` (/he/), `he: "  "` (/he/); `validateKids("x").length === 1`.
  - `kidsLive maps a TMDB show`: fixture with `name:"Bluey"`, he `name:"בלואי"`, `poster_path:"/b.jpg"`, `first_air_date:"2018-10-01"`, `number_of_seasons:3`, `vote_average:8.66, vote_count:10`, `content_ratings.results:[{iso_3166_1:"US",rating:"TV-Y"}]`, IL flatrate `Disney Plus` with map `{disney:["Disney Plus"]}` → `nameHe:"בלואי"`, `poster` full URL, `year:2018`, `seasons:3`, `vote:8.7`, `minAge:0`, `providers:["disney"]`.
  - `kidsLive: no Hebrew, no poster, no votes` → `nameHe:null, poster:null, vote:null, overview:null`.
  - `overCap`: `{age:"small",minAge:7}` false, `{age:"small",minAge:10}` true, `{age:"big",minAge:null}` false, `{age:"big",minAge:14}` true.
- [ ] **Step 2:** `node --test tests/kids-file.test.mjs` → FAIL (module missing).
- [ ] **Step 3:** Create `scripts/lib/providers.mjs` and `scripts/lib/kids.mjs`; switch `mcu.mjs` to import `providersOf`.
- [ ] **Step 4:** `npm test` → all pass (MCU tests prove the move kept behavior).
- [ ] **Step 5:** Commit `feat(kids): kids.json validation and TMDB mapping`.

### Task 2: Nightly fetch script

**Files:**
- Create: `scripts/fetch-kids.mjs`
- Modify: `.github/workflows/update-data.yml` (step "Fetch kids section", `continue-on-error: true`, `run: node scripts/fetch-kids.mjs`, after the MCU step; add `site/kids-data.json` to the commit file list with the same `if [ -f … ]` guard)
- Test: `tests/kids-fetch.test.mjs`

**Interfaces:**
- Consumes: `validateKids`, `kidsLive`, `overCap` (Task 1); `tmdbGet`, `pool` from `scripts/lib/api.mjs`; `loadEnv` from `scripts/lib/env.mjs`.
- Produces: `run({ rows, prev, fetchImpl = fetch, now, map }) → { data: { updatedAt, items }, warnings: string[], abort: boolean, failed: number }`. Each item: `{ tmdb, age, ...kidsLive fields, nameHe: row.he ?? live.nameHe, fetchedAt }`. The file `site/kids-data.json` = `data`.
- Per row: `GET /tv/{id}` with `language: "en-US", append_to_response: "watch/providers,content_ratings"` and `GET /tv/{id}` with `language: "he-IL"` (he failure → null, not a failure). Concurrency 4.
- Invalid rows are skipped with a `kids.json row …` warning. A failed row keeps `prev` item with today's `age`/`he`; a new failed row is left out. Items over the cap (checked after merging) are dropped with warning `<tmdb>: minAge <n> is above the <age> cap`. `abort = rows.length > 0 && failed / rows.length > 0.2`.
- CLI `main()`: reads `kids.json`, `site/kids-data.json`, `scripts/providers.json`; `--dry` writes nothing; abort → exit 1 without writing. Same guard as `fetch-mcu.mjs`: `if (process.argv[1] === fileURLToPath(import.meta.url)) main();`.

- [ ] **Step 1: Write failing tests** with a fake fetch like `tests/mcu-fetch.test.mjs` (`fail` = set of ids answering 500):
  - `maps rows and lets the hand-written Hebrew name win`: row `{tmdb:1,age:"mid",he:"שם ידני"}` → item `nameHe:"שם ידני"`, `fetchedAt: NOW`.
  - `a failed row keeps yesterday's details with today's age`: prev item for 2 with `age:"small"`, row `{tmdb:2,age:"mid"}` failing → item present with `age:"mid"` and prev `name`.
  - `a new row that fails is left out` → no item, `failed === 1`.
  - `drops a series above its group's cap`: show rated `TV-PG` (10) in `small` → absent, a warning matches `/above the small cap/`.
  - `more than 20% failures aborts`: 2 of 5 fail → `abort === true`; 1 of 5 → false.
  - `bad rows are skipped with a warning`: `{tmdb:"x",age:"mid"}` → no fetch for it, warning starts with `kids.json row 0`.
- [ ] **Step 2:** `node --test tests/kids-fetch.test.mjs` → FAIL.
- [ ] **Step 3:** Implement `scripts/fetch-kids.mjs` and the workflow change.
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat(kids): nightly fetch-kids script`.

### Task 3: The list and the first data file

**Files:**
- Create: `kids.json` (repo root)
- Create: `site/kids-data.json` (generated by running the script)
- Test: `tests/kids-file.test.mjs` (append)

**Interfaces:**
- Consumes: `validateKids`, `overCap`, `AGES` (Task 1); `scripts/fetch-kids.mjs` CLI (Task 2).

- [ ] **Step 1: Write failing tests** (append):
  - `the real kids.json is valid with at least 20 series per group`.
  - `site/kids-data.json has no series above its cap and at least 15 per group with a poster`.
- [ ] **Step 2:** Run → FAIL (files missing).
- [ ] **Step 3:** Write `kids.json`: 20–30 series per group, well-known kids shows available in Israel (Disney, Netflix, Nickelodeon, Cartoon Network, HOT/yes, Israeli kids shows that exist on TMDB). Look up every id with `tmdbGet("/search/tv", { query })` (or `/tv/{id}`) using `.env`; never guess ids. Add `he` when TMDB's Hebrew name is missing or not the name used in Israel. `small` = preschool only.
- [ ] **Step 4:** `node scripts/fetch-kids.mjs` → writes `site/kids-data.json`; read the warnings and move or drop any series the cap removed (re-run until clean).
- [ ] **Step 5:** `npm test` → pass. Commit `feat(kids): the kids series list and first data file`.

### Task 4: Catalog logic (site)

**Files:**
- Create: `site/kids/catalog.js`
- Test: `tests/kids-catalog.test.mjs`

**Interfaces:**
- Produces: `GROUPS = [{ id: "small", label: "קטנטנים 2–5", icon: "🐣" }, { id: "mid", label: "ילדים 6–9", icon: "🚀" }, { id: "big", label: "גדולים 10–13", icon: "⚡" }]`.
- Produces: `inGroup(items, age) → item[]` sorted by `vote` desc (null last), then `nameHe ?? name` (he locale).
- Produces: `servicesIn(items) → string[]` keys present in the group, in the order `["netflix","disney","hbo","apple","prime","yes","hot","partner","cellcom","kan"]` (`other` excluded).
- Produces: `pickServices(selected, available) → string[]` — `selected` minus anything not in `available`.
- Produces: `byServices(items, selected) → item[]` — all items if `selected` empty, else items with any selected provider.
- Produces: `LABEL` (copy of the MCU map in `site/mcu/view.js:5`).

- [ ] **Step 1: Write failing tests** for each function, including: `byServices` with `[]` keeps items with no providers; with `["netflix"]` drops them; `pickServices(["hot","netflix"], ["netflix"])` → `["netflix"]`; sort puts `vote:null` last.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(kids): catalog filtering and order`.

### Task 5: Daily game logic + storage (site)

**Files:**
- Create: `site/kids/game.js`
- Create: `site/kids/store.js`
- Test: `tests/kids-game.test.mjs`

**Interfaces:**
- Consumes: `inGroup` (Task 4).
- Produces (`game.js`):
  - `MAX_MISSES = 3`, `PX = [28, 18, 10, 0]` (blur by misses; 0 once done).
  - `seed(str) → uint32` (FNV-1a), `puzzleFor(items, date, age) → { answer: tmdb, choices: tmdb[] } | null`. Candidates = `inGroup(items, age)` with a poster. `null` if fewer than 2. Answer = candidates sorted by `tmdb` at index `seed(date + ":" + age) % n`; the other choices are the next `min(3, n-1)` distinct candidates picked with the same seeded PRNG (mulberry32); choices shuffled with it. Deterministic for the same input.
  - `initGame(puzzle) → { answer, misses: [], done: false }`.
  - `guess(state, tmdb) → state` — ignores done, repeated or unknown choices; correct → `done`; wrong → added to `misses`, `done` when `misses.length === MAX_MISSES` or no wrong choice is left.
  - `blur(state) → number` — `state.done ? 0 : PX[state.misses.length]`.
  - `outcome(state) → "win" | "lose" | null`.
- Produces (`store.js`): `loadAge(storage) → "small"|"mid"|"big"` (default `"mid"`), `saveAge(storage, age)`, `loadGame(storage, date, age, answer) → state | null` (null if missing, broken, or `answer` differs), `saveGame(storage, date, age, state)`. Key `bingology:kids-game:<date>` holds `{ [age]: state }`. All `try/catch`; `storage` may be null.

- [ ] **Step 1: Write failing tests:**
  - same `(items, date, age)` → deepEqual puzzles; another date (over 10 dates) gives at least 2 different answers.
  - 4 distinct choices containing the answer; with 3 eligible items → 3 choices; with 1 → `null`; items without poster are never the answer.
  - `guess` wrong → `blur` drops 28 → 18; 3 misses → `done`, `outcome === "lose"`; right → `"win"`, `blur === 0`; a repeated wrong guess is ignored.
  - store: `loadAge` with `"xyz"` / throwing storage / null → `"mid"`; `loadGame` with a different `answer` → `null`; broken JSON → `null`; round trip works.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(kids): daily poster game logic and storage`.

### Task 6: HTML views (site)

**Files:**
- Create: `site/kids/view.js`
- Test: `tests/kids-view.test.mjs`

**Interfaces:**
- Consumes: `GROUPS`, `LABEL` (Task 4); `blur`, `outcome` (Task 5); `esc` from `../lib/esc.js`.
- Produces (all return strings; buttons use `data-a`/`data-v` like `site/mcu/view.js`):
  - `headerHTML(age)` — back link `href="./"` "← חזרה ל-Bingology", title "🧸 ילדים", three `data-a="age"` buttons with `aria-pressed`, and a `data-a="game"` "🎲 משחק היום" button.
  - `servicesHTML(available, selected)` — "הכול" (`data-a="svc" data-v=""`, pressed when none selected) + one button per service with `LABEL`. Empty string when `available` is empty.
  - `gridHTML(items)` — `<ul>` of `data-a="card" data-v="<tmdb>"` buttons with poster `<img loading="lazy" alt="">` or a `.k-noposter` tile, and the name (`nameHe ?? name`). Empty → `<p>` "אין כאן סדרות בשירות הזה 🙈".
  - `cardHTML(item)` — poster, `nameHe ?? name`, English name when different, group label, overview (`overview ?? overviewEn`), "N עונות · year", "איפה רואים: " services with " (כנראה)" for guessed ones, or "לא מצאנו איפה רואים אותה בישראל"; a `data-a="close"` button.
  - `gameHTML(puzzle, state, items)` — big poster with `style="filter: blur(<n>px)"`, choices as `data-a="pick" data-v="<tmdb>"` buttons with small poster + name (`disabled` + class `miss` for misses, `right` on the answer when done); when done, "כל הכבוד! 🎉" or "זאת הייתה <name>" plus a `data-a="card"` button for the answer. `puzzle === null` → `<p>` "אין עדיין משחק לקבוצה הזו".
- [ ] **Step 1: Write failing tests:** pressed state of age buttons; `servicesHTML` "הכול" pressed when none selected; a name `"<b>x</b>"` comes out escaped in grid, card and game; null poster → `.k-noposter`; card with `providers:[]` shows the "לא מצאנו" text; guessed Disney shows "(כנראה)"; game blur style is `blur(28px)` at start and `blur(0px)` when won; no `youtube` substring in any view output.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(kids): page views`.

### Task 7: The page, its style, and the menu tab

**Files:**
- Create: `site/kids.html` (shape of `site/mcu.html`: `lang="he" dir="rtl"`, Rubik font, `kids/kids.css`, `<main id="kids">`, `<dialog id="kcard">`, `<script type="module" src="kids/app.js">`)
- Create: `site/kids/app.js`, `site/kids/kids.css`
- Modify: `site/app.js:318` (add after the MCU link: `<a class="tab kids" href="kids.html"><span aria-hidden="true">🧸</span><span class="tl"> ילדים</span><span class="sr">סקשן הילדים</span></a>`)
- Modify: `site/styles.css` (`.tab.kids` next to `.tab.mcu`: bright yellow background, dark text)
- Test: `tests/kids-page.test.mjs`

**Interfaces:**
- Consumes: everything from Tasks 4–6; `israelToday` from `../lib/games/day.js`.
- `app.js` state: `{ items, age, services: [], view: "grid" | "game", cardId }`. Fetch `kids-data.json` (`cache: "no-cache"`); on failure show "לא הצלחנו לטעון את הסדרות. נסו שוב מאוחר יותר.". Hash `#game` opens the game; clicks delegated on `data-a`. Switching age resets `services` through `pickServices`. Picking in the game saves through `saveGame`.
- [ ] **Step 1: Write failing tests:** `site/app.js` contains `href="kids.html"`; `site/kids.html` references `kids/app.js` and `kids/kids.css` and has `dir="rtl"`; `scripts/stamp.mjs`'s `unstamped(stampJs(code))` is empty for every file in `site/kids/` (cache busting covers the new modules).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement the page, CSS (yellow/turquoise/purple per group via `data-age` on `<main>`, buttons ≥ 48px, 2 posters per row under 480px, 3 above) and the tab.
- [ ] **Step 4:** `npm test` → all pass.
- [ ] **Step 5: Browser check:** serve `site/` (`npx serve`-free: `python3 -m http.server` via a `.claude/launch.json` entry) and check at 375px and desktop: switch groups, filter Netflix, open a card, play the game to a win and to a loss, reload and see the saved result, the menu tab on the main page leads to the kids page. No console errors.
- [ ] **Step 6:** Commit `feat(kids): kids page and menu tab`.

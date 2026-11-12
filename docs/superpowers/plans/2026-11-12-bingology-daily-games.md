# Bingology Daily Games (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "משחקים" area with five daily games (same for every visitor), generated nightly into `site/games/YYYY-MM-DD.json`, played in the browser with progress and a streak in `localStorage`, and a share line.

**Architecture:** Five pure generators (`scripts/lib/games/*.mjs`, `make(pool, rng, recent) → { puzzle, used } | null`) run from `scripts/make-games.mjs` after `fetch-data`, writing one self-contained file per day for today…today+7 (never overwriting). The site lazy-loads `site/views/games.js`; per-game state logic lives in pure modules under `site/lib/games/` (`init` / `play` / `result`), with `day.js` (Israel date, file loading), `store.js` (localStorage, streak) and `share.js`.

**Tech Stack:** Node 22 (`node:test`), vanilla ES modules, GitHub Actions, GitHub Pages. Zero npm dependencies.

**Spec:** `docs/superpowers/specs/2026-11-12-bingology-daily-games-design.md`

**Branch:** `feat/daily-games` (already created from `main`; the spec is committed there).

## Global Constraints

- Zero npm dependencies. Tests: `node --test`, files `tests/games-*.test.mjs`.
- Game ids and order exactly: `guess`, `odd`, `chain`, `groups`, `blur`; names נחשו את הסדרה / מי לא שייך / שרשרת / ארבע קבוצות / השחקן המטושטש; share icons 🎬 🕵️ 🔗 🧩 👤.
- "Known series" = the **300** series with the highest `tmdbVotes` (constant `KNOWN = 300` in `pool.mjs`). Autocomplete always offers the whole pool.
- Day = calendar date in `Asia/Jerusalem`. The nightly creates today…today+7 (**8** files), never rewrites an existing file, deletes files older than **90** days.
- Seed = `"<date>:<gameId>:<attempt>"`, attempts 0…49; after **50** failures the day ships without that game and a `console.warn` is logged. Generators never throw on a small pool; they return `null`.
- No repeats within **60** days (days before the target date, including days created in the same run): `guess` answer, `blur` actor, `odd` actors, `chain` pair. `used` = `{ series: number[], actors: string[], pairs: string[] }`; actors by name; pair = `"<smaller tmdbId>-<larger tmdbId>"`.
- File shape: `{ date, v: 1, used, games: { guess?, odd?, chain?, groups?, blur? } }` with the per-game shapes in the spec ("פורמט הקובץ"). Series card = `{ id: tmdbId, name, poster }`.
- Limits: guess **6** guesses / **6** clues; odd **3** rounds; chain shortest **2 or 3** actors, limit = shortest + **2**; groups **16** items, **4** groups, ≥**3** kinds, **4** mistakes; blur **5** guesses, blur px `[24, 16, 10, 5, 2]`, photo size `w342`.
- localStorage keys: `bingology:games:<date>`, `bingology:games:streak` (`{ last, n }`), `bingology:games:practice`. Every access in `try/catch`; storage may be `null`. Day states older than **30** days pruned on load.
- Share line exactly: `Bingology · D.M · רצף N 🔥` (streak part omitted when 0), then the results of the finished games, space-separated as `<icon> <label>`, then `https://achiyafried.github.io/bingology/#games`. Labels: guess `3/6`|`X/6`, odd `2/3`, chain `מושלם`|`הצלחה`|`נתקעת`, groups `0 טעויות`|`1 טעות`|`N טעויות`|`X`, blur `2/5`|`X/5`.
- Copy: missing day "המשחקים של היום עוד בדרך"; network error + "לנסות שוב"; unknown `v` "המשחקים של היום לא זמינים, נסו לרענן"; buttons "חזרה למשחקים", "לפרטי הסדרה", "לפרטי השחקן", "שיתוף"; home card "המשחקים של היום".
- UI Hebrew RTL, existing tokens/classes (`.btn`, `.chip`, `.empty`, `.search`), dark mode; all images through `safeImg`, all text through `esc`.

## Review Focus

1. **Real data is sparser than the fixture** (8 cast names per series, 300 known): every generator must succeed on the real `site/data.json` for most days. Smoke test in Task 7: 30 consecutive dates, each game present on ≥ 27 of them.
2. **Midnight / DST** — a page left open past midnight, and the October/March clock change in Israel, must roll the day exactly once. Tests in Task 8 (`israelToday` at `2026-10-24T21:30Z` and `2026-10-24T22:30Z`, `2027-03-25T21:59Z` and `2027-03-25T22:01Z`).
3. **Corrupt or foreign localStorage values** (bad JSON, wrong type, `setItem` throwing on quota) must fall back to a fresh state, never break the page. Tests in Task 8.
4. **Two series or actors with the same name** — guess matches by `tmdbId` only; blur matches by trimmed, case-insensitive name and a same-name actor is a correct answer. Tests in Tasks 9 and 10.
5. **Chain subgraph completeness** — every series the player can legally step to within the limit must be in `chain.series`, or the player gets stuck on a missing card. Test in Task 4 (walk every legal move to depth `limit` from `from` using only the file).

---

### Task 1: Seeded RNG, pool and test fixture

**Files:**
- Create: `scripts/lib/games/rng.mjs`, `scripts/lib/games/pool.mjs`
- Create: `site/lib/games/day.js` (date helpers and `GAMES` only; Task 8 adds loading)
- Create: `tests/lib/games-fixture.mjs`
- Test: `tests/games-pool.test.mjs`

**Interfaces:**
- Produces:
  - `makeRng(seed: string) → () => number` in `[0, 1)` (string hash → mulberry32).
  - `shuffle(rng, arr) → new array`, `pick(rng, arr) → item`, `sample(rng, arr, n) → n distinct items`.
  - `buildPool(series: RawSeries[], { known = KNOWN } = {}) → Pool`, where `RawSeries` is a `data.json` series and `Pool = { all, known, byId: Map<tmdbId, RawSeries>, knownIds: Set<tmdbId>, actorsKnown: Map<name, tmdbId[]> /* known series only, most votes first */, photo: Map<name, url> }`. Series without `tmdbId` are dropped.
  - `card(s) → { id: s.tmdbId, name: s.name, poster: s.poster ?? null }`.
  - `emptyRecent() → { series: Set, actors: Set, pairs: Set }`.
  - `day.js`: `GAMES = [{ id, name, icon }]` (order and values from Global Constraints), `israelToday(now: Date) → "YYYY-MM-DD"` (`Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" })`), `addDays(date, n) → date` (UTC arithmetic on the date string).
  - `fixtureSeries() → RawSeries[]` (tests only): 60 series, `tmdbId` 1…60, `tmdbVotes = 10000 − 100·id`, `year = 2000 + (id % 12)`, `lang = id % 10 === 0 ? "ko" : "en"`, genres cycling `["drama"]`, `["crime","drama"]`, `["comedy"]`, `["scifi"]`, `creators = ["Creator " + ceil(id/5)]`, 6 cast members each with photos (`https://image.tmdb.org/t/p/w185/a<n>.jpg`), arranged so that some actors appear in ≥ 4 series and every pair of series is connected within 3 actor hops. `overviewHe` mentions the cast's first name in English; `poster` set.

- [ ] **Step 1: Failing tests** — `makeRng("a")` twice gives the same first 5 numbers; `"a"` vs `"b"` differ; `sample` returns distinct items and never more than asked; `buildPool(fixtureSeries(), { known: 20 }).known` has the 20 highest-vote series; `actorsKnown` only counts known series; a series with `tmdbId: null` is dropped; `israelToday` at `2026-11-12T21:59Z` → `2026-11-12`, at `22:01Z` → `2026-11-13`; `addDays("2026-12-31", 1)` → `2027-01-01`; `GAMES` ids in order.
- [ ] **Step 2:** `node --test tests/games-pool.test.mjs` → FAIL (module not found).
- [ ] **Step 3:** Implement `rng.mjs`, `pool.mjs` (`KNOWN = 300` exported), the `day.js` helpers and the fixture.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(games): seeded rng, pool and fixture`.

### Task 2: `guess` generator

**Files:**
- Create: `scripts/lib/games/guess.mjs`
- Test: `tests/games-guess.test.mjs`

**Interfaces:**
- Consumes: Task 1 (`Pool`, rng helpers, `card`). Genre names from `site/lib/score.js` `GENRES`; language names from `new Intl.DisplayNames(["he"], { type: "language" })`.
- Produces: `make(pool, rng, recent) → { puzzle: { answer: card, clues: Clue[] }, used: { series: [id] } } | null`, `Clue = { kind, text, img? }`, kinds in order `genreYear`, `langSeasons`, `creators`, `actor`, `overview`, `poster`.

Clue texts: `genreYear` = genre names joined `", "` + ` · ` + year; `langSeasons` = language + ` · ` + (`עונה אחת` | `N עונות`); `creators` = `יוצרים: ` + names joined `", "`; `actor` = `בכיכוב ` + `cast[0].name`; `overview` = `overviewHe` with the English series name and every `cast`/`creators` name replaced by `███` (case-insensitive), cut to 220 chars at a word boundary + `…`; `poster` = `{ text: "", img: poster }`. A clue whose source field is missing is skipped; a series with fewer than 5 clues is not chosen.

- [ ] **Step 1: Failing tests** — deterministic for the same seed; answer is a known series not in `recent.series`; ≥ 5 clues, kinds in the order above; the overview clue contains none of the answer's English name or cast/creator names; returns `null` when every known series is in `recent`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(games): guess generator`.

### Task 3: `odd` generator

**Files:**
- Create: `scripts/lib/games/odd.mjs`
- Test: `tests/games-odd.test.mjs`

**Interfaces:**
- Consumes: Task 1.
- Produces: `make(pool, rng, recent) → { puzzle: { rounds: [{ actor: { name, photo }, series: card[4], odd: 0..3 }] /* 3 */ }, used: { actors: [3 names] } } | null`.

Actor: ≥ 3 known series, not in `recent.actors`, distinct across rounds. Impostor: known series whose `cast` lacks the actor, sharing ≥ 1 genre with one of the three and with `|year − year| ≤ 5` to one of them. The four are shuffled; `odd` is the impostor's index.

- [ ] **Step 1: Failing tests** — 3 rounds, 3 distinct actors; for every round the three non-odd series contain the actor and the odd one doesn't; genre and year rules hold; `null` on a pool where no actor has 3 known series.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(games): odd-one-out generator`.

### Task 4: `chain` generator

**Files:**
- Create: `scripts/lib/games/chain.mjs`
- Test: `tests/games-chain.test.mjs`

**Interfaces:**
- Consumes: Task 1.
- Produces: `make(pool, rng, recent) → { puzzle: { from, to, shortest, limit, series: { [tmdbId]: { name, poster, cast: string[] } } }, used: { pairs: ["a-b"] } } | null`; also exported `shortestActors(seriesMap, from, to) → number | Infinity` (BFS over series↔actor, counting actors), reused by the site in Task 10 and by tests.

The graph uses known series only. Pick `from` at random, BFS, pick `to` among series at distance exactly 2 or 3 actors (prefer 3 when available, 50/50 otherwise) whose pair is not in `recent.pairs`. `series` = every known series reachable from `from` within `limit` actors (BFS depth limit), each with its full `cast` names.

- [ ] **Step 1: Failing tests** — `shortest ∈ {2,3}` and equals `shortestActors(puzzle.series, from, to)`; `limit = shortest + 2`; **completeness:** a DFS over legal moves (`actor ∈ cast(current)` → any series in `puzzle.series` with that actor) to depth `limit` never needs a series missing from `puzzle.series`, and reaches `to`; pair recorded sorted; `null` when the pool has no pair at distance 2–3.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(games): chain generator`.

### Task 5: `groups` generator

**Files:**
- Create: `scripts/lib/games/groups.mjs`
- Test: `tests/games-groups.test.mjs`

**Interfaces:**
- Consumes: Task 1; language names as in Task 2.
- Produces: `make(pool, rng, recent) → { puzzle: { items: card[16], groups: [{ kind, key, label, level, ids: [4] }] }, used: {} } | null`; exported `fits(kind, key, s) → boolean`.

Candidates over known series: `actor` (key = name, ≥ 4 series), `creator` (≥ 4), `year` (≥ 4), `lang` (key ≠ `"en"`, ≥ 4). Up to 200 internal tries: choose 4 candidates spanning ≥ 3 kinds, sample 4 series each, accept when all 16 are distinct and **no series fits another group's `(kind, key)`**. Labels: `actor` `שחקן/ית משותף/ת: X`, `creator` `יוצר/ת: X`, `year` `בכורה ב-YYYY`, `lang` `בשפה: <Hebrew language name>`. `level` 1…4 by mean `tmdbVotes` of the group, most votes = 1. `items` shuffled.

- [ ] **Step 1: Failing tests** — 16 distinct ids; 4 groups × 4; ≥ 3 distinct kinds; levels are a permutation of 1–4 ordered by mean votes; exclusivity: for every item and every other group, `fits` is false; `null` on a 10-series pool.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(games): groups generator`.

### Task 6: `blur` generator

**Files:**
- Create: `scripts/lib/games/blur.mjs`
- Test: `tests/games-blur.test.mjs`

**Interfaces:**
- Consumes: Task 1.
- Produces: `make(pool, rng, recent) → { puzzle: { actor: { name, photo }, count, series: string[] }, used: { actors: [name] } } | null`.

Actor with a photo and ≥ 2 known series, not in `recent.actors`. `photo` = the actor's photo URL with `/w185/` replaced by `/w342/`. `count` = number of series in the **whole** pool with the actor; `series` = their names ordered by `tmdbVotes` ascending (hardest hint first).

- [ ] **Step 1: Failing tests** — photo matches `safeImg` and contains `/w342/`; `series` ascending by votes; `count === series.length`; actor not in recent; `null` when no actor has a photo.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(games): blurred actor generator`.

### Task 7: `make-games` (days, recent, pruning) and the nightly workflow

**Files:**
- Create: `scripts/lib/games/make.mjs`, `scripts/make-games.mjs`
- Modify: `.github/workflows/update-data.yml`
- Modify: `README.md` (one paragraph under "איך זה עובד": `site/games/` נוצר כל לילה, לא עורכים ידנית)
- Test: `tests/games-make.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–6; `GAMES`, `israelToday`, `addDays` from `site/lib/games/day.js` (Task 1).
- Produces: `makeDays({ series, dir, today, days = 8, keepDays = 90, recentDays = 60, log = console }) → { created: string[], deleted: string[], missing: { [date]: string[] } }`; `buildDay(pool, date, recent, log) → dayFile`. CLI: `node scripts/make-games.mjs` reads `site/data.json`, `dir = "site/games"`, `today = israelToday(new Date())`, prints created/deleted counts.

Recent for date D = union of `used` from files dated D−60…D−1 that exist in `dir` (read again after each day is written, so days in the same run count). Unreadable files are skipped with a warning.

Workflow: after "Fetch all series" add step `Make daily games` with `continue-on-error: true`, `run: node scripts/make-games.mjs`. In the commit step add `site/games` to `files` and use `git add -A $files` (deletions included); keep the existing `news.json` guard.

- [ ] **Step 1: Failing tests** (temp dir via `fs.mkdtempSync`) — creates exactly the 8 missing dates; a pre-existing file is byte-identical and its mtime unchanged after a run; a generator stubbed to always return `null` yields a day without that game, a warning, and no throw; files older than 90 days deleted, `.json` only; a day created in the same run contributes to the next day's `recent` (answer of day 1 not reused on day 2); `today` at `2026-11-12T22:30Z` → first file `2026-11-13`.
- [ ] **Step 2: Real-data smoke test** (skipped when `site/data.json` is missing): `buildDay` for 30 consecutive dates from `2026-12-01`, threading `recent`; each game present on ≥ 27 days.
- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Implement `make.mjs`, the CLI, workflow and README.
- [ ] **Step 5:** Run → PASS; run `node scripts/make-games.mjs` locally and check one file by eye (all five games, sizes reasonable: chain under ~60 KB).
- [ ] **Step 6:** Commit `feat(games): nightly day files` (do **not** commit generated `site/games/*.json`; the nightly does).

### Task 8: Site plumbing — `day.js`, `store.js`, `share.js`

**Files:**
- Create: `site/lib/games/day.js`, `site/lib/games/store.js`, `site/lib/games/share.js`
- Test: `tests/games-day.test.mjs`, `tests/games-store.test.mjs`, `tests/games-share.test.mjs`

**Interfaces:**
- Produces:
  - `day.js` (extends Task 1): `loadGamesDay(fetchFn, date) → Promise<{ status: "ok", day } | { status: "missing", practice: day | null } | { status: "error" } | { status: "version" }>` (fetches `games/<date>.json` with `cache: "no-cache"`; on 404 tries `addDays(date, -1)` for practice; `v !== 1` → `"version"`; network/JSON failure → `"error"`).
  - `store.js`: `loadDay(storage, date) → { [gameId]: state }`, `saveDay(storage, date, states)`, `loadPractice(storage, date)` / `savePractice(storage, date, states)` (one slot, replaced when the date differs), `markComplete(storage, date) → n` (idempotent per date; `n+1` if `last === addDays(date, -1)`, else 1), `streak(storage, today) → n` (0 unless `last` is today or yesterday), `dayProgress(storage, date) → number of games with a finished state` (state has `done: true`), `prune(storage, today, keep = 30)`.
  - `share.js`: `shareText({ date, streak, results: [{ id, label }] }) → string`.

- [ ] **Step 1: Failing tests** — `israelToday` across both DST switches (Review Focus 2); `loadGamesDay` with stub fetches: ok, 404 + yesterday present → missing with practice, 404 both → missing with `null`, `v: 2` → version, throw → error. Store: streak 1 → 2 on consecutive days, skipped day resets to 1, `markComplete` twice same day stays, practice never touches the streak, `prune` removes day keys older than 30 days only; `storage = null`, `getItem` returning `"{bad"`, and `setItem` throwing all work (Review Focus 3). Share: full line for the spec example (`13.11`, streak 4, five results) equals the spec text exactly; streak 0 omits `· רצף`; missing games omitted.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(games): day loading, storage and share line`.

### Task 9: Game logic — `guess` and `odd`

**Files:**
- Create: `site/lib/games/guess.js`, `site/lib/games/odd.js`
- Test: `tests/games-play-guess.test.mjs`, `tests/games-play-odd.test.mjs`

**Interfaces:**
- Produces (same contract for all five game modules, Tasks 9–10): `init(puzzle) → state` (JSON-serialisable, includes `done: false`), `play(state, puzzle, move) → newState` (pure; a move after `done` returns the state unchanged), `result(state, puzzle) → { done, win, score, label }`.
  - guess: move `{ id: tmdbId }`; `state = { guesses: [ids], done }`; `revealed(state) → clue count` = `min(guesses.length + 1, 6)` (all 6 once done); a repeated id is ignored.
  - odd: move `{ index }` for the current round; `state = { picks: [indices], done }`; `round(state) → 0..2`.

- [ ] **Step 1: Failing tests** — guess: win on 3rd → `3/6`; six misses → `X/6`, `done`; same id twice counts once; two different series with the same name: only the answer's id wins (Review Focus 4); revealed counts. Odd: 2 of 3 → `2/3`; move after done ignored.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(games): guess and odd logic`.

### Task 10: Game logic — `chain`, `groups`, `blur`

**Files:**
- Create: `site/lib/games/chain.js`, `site/lib/games/groups.js`, `site/lib/games/blur.js`
- Test: `tests/games-play-chain.test.mjs`, `tests/games-play-groups.test.mjs`, `tests/games-play-blur.test.mjs`

**Interfaces:**
- Consumes: Task 9's contract.
- Produces:
  - chain: moves `{ type: "step", actor, to }` (valid only if `actor` is in the current series' and `to`'s `cast`; invalid → unchanged) and `{ type: "back" }`; `state = { path: [ids], via: [actors], steps, done }`; `steps` only grows; win when the current series is `to`; fail when `steps === limit` and not at `to`. Labels: `steps === shortest` → `מושלם`, win → `הצלחה`, fail → `נתקעת`.
  - groups: move `{ ids: [4] }`; `state = { solved: [groupIndex], mistakes, tried: [sorted-key], last: "ok" | "one-away" | "wrong" | "repeat" | null, done }`; a repeated wrong set → `"repeat"`, no mistake. Labels as Global Constraints.
  - blur: move `{ name }`; `state = { guesses: [names], done }`; correct = trimmed, case-insensitive equal to `actor.name`; `blurPx(state) → [24,16,10,5,2][guesses.length]`, `0` when done; `hints(state, puzzle) → string[]` = `[]`, then `N סדרות במאגר`, then series names one per further miss.

- [ ] **Step 1: Failing tests** — chain: perfect path → `מושלם`; back then forward still counts both steps; limit reached → `נתקעת`; invalid actor ignored. Groups: three-of-four → `one-away` + mistake; repeat → no mistake; fourth mistake → `done`, `X`; all solved with 1 mistake → `1 טעות`. Blur: `"  bryan CRANSTON "` matches `Bryan Cranston` (Review Focus 4); blur px sequence; hints sequence; fifth miss → `X/5`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(games): chain, groups and blur logic`.

### Task 11: Games view, tab, home card, `#games`

**Files:**
- Create: `site/views/games.js`
- Modify: `site/app.js` (tab, `#games` route, `showGames()`, home card in `introHTML`), `site/styles.css` (a `/* games */` section)
- Test: `tests/games-view.test.mjs` (HTML-string functions only, as in `news-site.test.mjs`)

**Interfaces:**
- Consumes: Tasks 8–10; `searchSeries` (`site/lib/search.js`), `esc`/`safeImg`; from `app.js`: `S`, `store`, the actor index (`actorIndex()` names, for blur autocomplete), series/actor dialog openers, `showToast`, `copyText`.
- Produces: `mountGames(root, ctx)` with `ctx = { S, storage, actorNames: string[], today: () => date, fetch, openSeries(tmdbId), openActor(name), toast, copy }`; exported pure renderers `hubHTML(day, states, streak)`, `summaryHTML(...)`, and one `<game>HTML(puzzle, state, extra)` per game for tests.

Behaviour: hub (5 cards: לשחק / בתהליך / סיים + label; date and streak on top) → game screen ("חזרה למשחקים"; on finish the answer plus "לפרטי הסדרה"/"לפרטי השחקן" when it exists in `S`/actor index) → summary when every available game is done (`markComplete`, streak, "שיתוף" via `navigator.share` else `copy` + toast, same pattern as `headerInvite`). Autocomplete: guess uses `searchSeries(S, q, 8)` and submits `S[i].tmdbId`; blur filters `actorNames` with the same phonetic helpers as the actors tab. Save after every move. On `missing`, show the spec copy and a "תרגול" button when `practice` exists (stored with `savePractice`, no streak). Re-check `ctx.today()` whenever the hub renders; a changed date reloads.

app.js: tab `<button … data-v="games">משחקים</button>` between search and mine; `location.hash === "#games"` → `st.tab = "games"` in `route()`; body `<div id="games"></div>` and `showGames()` lazy-imports the view (same catch pattern as `showMine`). Home card above the news strip in `introHTML`: "המשחקים של היום", `dayProgress/5`, streak when > 0, `data-a="tab" data-v="games"`. `store.js` is imported statically (small); the view is not.

- [ ] **Step 1: Failing tests** — `hubHTML` shows five cards in order with states and labels; a game missing from the day is not shown; `summaryHTML` contains the share text; guess screen escapes a series name containing `<b>`; blur screen applies `filter: blur(24px)` initially and falls back to initials when `safeImg` rejects the photo; a series card with `poster: null` renders the name without an `<img>`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement view, app.js wiring and CSS.
- [ ] **Step 4:** Run `npm test` → all PASS.
- [ ] **Step 5: Manual check** — `node scripts/make-games.mjs && python3 -m http.server 8080 -d site`; at 360px and desktop, light and dark: play all five to the end, reload mid-game (progress kept), finish → summary and share; open `#games` directly; rename today's file to simulate 404 → practice offered. If six tabs overflow at 360px, render the search tab as `🔍` only with `aria-label="חיפוש"`.
- [ ] **Step 6:** Commit `feat(games): games area, tab and home card` (without generated `site/games/*.json`).

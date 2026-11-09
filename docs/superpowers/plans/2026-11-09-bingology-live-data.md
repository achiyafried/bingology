# Bingology Live Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Bingology Claude artifact into a standalone GitHub Pages site whose 128 series get live data (TMDB + OMDb) from a nightly job.

**Architecture:** `series.json` (hand-curated) → `scripts/fetch-data.mjs` (nightly in GitHub Actions; merges TMDB/OMDb, validates, keeps last good values) → `site/data.json` → static site in `site/` that reads only `data.json`. Pure logic lives in small ES modules (`scripts/lib/*`, `site/lib/*`) that run unchanged in Node tests and in the browser.

**Tech Stack:** Node.js 20 (built-in `fetch`, `node:test`, `node:vm`), no npm dependencies; vanilla HTML/CSS/JS ES modules; GitHub Actions; GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-09-bingology-live-data-design.md`

## Global Constraints

- Node 20, `"type": "module"`, **zero runtime or dev dependencies**. Tests: `node --test`.
- Secrets only via env: `TMDB_TOKEN` (TMDB API Read Access Token, sent as `Authorization: Bearer`), `OMDB_KEY`. Never written to any file or log.
- UI copy is Hebrew, RTL, matching the existing tone. Keep existing CSS tokens and dark mode.
- `localStorage` keys: read legacy `tvpick:v1`, write `tvpick:v2` as `{ "seen": [tmdbId, …] }`. Every access wrapped in `try/catch`.
- Order of entries in `series.json` = order of `RAW` in the legacy artifact (index 0–127). Entries with `lists` containing `"mine"` are exactly legacy indices 0–59.
- Manual fields win over live fields: `name`, `blurb`, `praise`, `awards`, `rt`, `genres`, `moods`, `weight`, `solo`, `lists`, `nytRank`, `castLabel`.
- Failure threshold: abort (exit 1, `data.json` untouched) if **more than 20%** of series fail, or TMDB is unreachable, or validation fails.
- TMDB concurrency ≤ 8. Image base: `https://image.tmdb.org/t/p/w342` (posters), `https://image.tmdb.org/t/p/w185` (cast). Cast: first 10.
- Footer copy, verbatim: `This product uses the TMDB API but is not endorsed or certified by TMDB.` plus "נתוני זמינות: JustWatch" and "הנתונים עודכנו ב-{date}".
- Provider categories (exact keys and labels): `netflix` Netflix · `hbo` HBO Max · `apple` Apple TV+ · `prime` Prime Video · `disney` Disney+ · `israel` yes / HOT / סלקום / פרטנר / כאן · `other` אחר. Only TMDB `flatrate`, region `IL`.
- The legacy artifact is reference only (`legacy/`); it is never published.

## Review Focus

1. **Bot commits don't trigger other workflows.** A push made with `GITHUB_TOKEN` does not fire `deploy.yml`; the nightly job must deploy itself (Task 9 makes deploy a reusable workflow it calls).
2. **A series whose TMDB data is partial** (no runtime, no seasons yet, no `imdb_id`, no IL providers) must still render — fallback chain prev → `fallback` (Task 4/5 tests).
3. **Old "seen" marks** from the artifact era are positional; a user who opens the new site must keep them (Task 7 migration test).
4. **Unknown provider names** in IL (renamed services) must land in `other` with a warning, not be dropped (Task 4 test).
5. **`data.json` fails to load** (offline, 404 on first deploy) must show the retry screen, not a blank page (Task 8 Step 6 browser check).

---

## File Structure

```
package.json                     scripts: test, extract, match, fetch
legacy/bingology-artifact.html   copy of artifact v1794236776-b553 (reference)
scripts/
  extract-legacy.mjs             CLI: legacy HTML → scripts/legacy-data.json
  match-ids.mjs                  CLI: one-time TMDB id matching → series.json + needs-review.md
  fetch-data.mjs                 CLI: nightly; series.json → site/data.json
  providers.json                 provider_name → category
  lib/legacy.mjs                 parse legacy HTML; legacyToSeries()
  lib/match.mjs                  pickMatch()
  lib/tmdb.mjs                   transformTv(), medianRuntime(), mapProviders()
  lib/merge.mjs                  mergeEntry(), validateData(), shouldAbort(), sameData()
  lib/api.mjs                    tmdbGet(), omdbRating(), pool()
series.json                      curated list (generated once, then hand-edited)
site/
  index.html  styles.css  app.js
  lib/score.js                   scoreSeries(), poolIds(), bL, bS
  lib/data.js                    fromData()
  lib/seen.js                    loadSeen(), saveSeen()
  data.json                      generated
tests/                           *.test.mjs, fixtures/
.github/workflows/update-data.yml, deploy.yml
README.md
```

---

### Task 1: Scaffold and extract legacy data

**Files:**
- Create: `package.json`, `.gitignore` (`node_modules/`, `.env`, `.DS_Store`), `legacy/bingology-artifact.html`, `scripts/lib/legacy.mjs`, `scripts/extract-legacy.mjs`
- Test: `tests/legacy.test.mjs`

**Interfaces:**
- Produces: `parseLegacy(html: string) -> { RAW: any[][], META: any[][], NYTR: Record<number,number>, MORE: Record<number,any[]>, PRAISE: string[] }`; `scripts/legacy-data.json` with that shape.

- [ ] **Step 1:** Copy the artifact source into the repo:
  `cp "<tool-results>/artifact-04e87795-1794236776-b553.html" legacy/bingology-artifact.html` (path is in the session; if absent, re-read the artifact `https://claude.ai/artifact/1c9pXdY1nCDXSmTakHSNan` with the Artifact tool `read` action and save the returned file). Create `package.json` with `"type": "module"`, `"engines": {"node": ">=20"}`, scripts `test: node --test tests/`, `extract: node scripts/extract-legacy.mjs`, `match: node scripts/match-ids.mjs`, `fetch: node scripts/fetch-data.mjs`.

- [ ] **Step 2: Write the failing test** `tests/legacy.test.mjs`:
```js
const d = parseLegacy(readFileSync("legacy/bingology-artifact.html", "utf8"));
assert.equal(d.RAW.length, 128);
assert.equal(d.META.length, 128);
assert.equal(d.RAW[2][0], "Breaking Bad");
assert.equal(d.NYTR[2], 1);
assert.equal(d.PRAISE.length, 128);
assert.equal(d.MORE[2][0], "Vince Gilligan");
```

- [ ] **Step 3:** Run `npm test` → FAIL (module not found).

- [ ] **Step 4: Implement `parseLegacy`** in `scripts/lib/legacy.mjs`: take the `<script>` body, slice each `const RAW =`, `const META =`, `const NYTR =`, `const MORE =`, `const PRAISE =` statement up to its terminating `];` / `};` at line start, rewrite `const X =` to `globalThis.X =`, run each in a fresh `vm.createContext({})`, return the values. Do not execute the rest of the script. `extract-legacy.mjs` writes the result to `scripts/legacy-data.json` (pretty-printed).

- [ ] **Step 5:** `npm test` → PASS. `npm run extract` → file written.

- [ ] **Step 6: Commit** `feat: extract legacy series data from artifact`.

---

### Task 2: Build `series.json` entries from legacy data

**Files:**
- Modify: `scripts/lib/legacy.mjs`
- Test: `tests/legacy.test.mjs`

**Interfaces:**
- Consumes: `parseLegacy()` output.
- Produces: `legacyToSeries(d) -> Entry[]` where `Entry = { tmdbId: number|null, name, year, lists: ("mine"|"nyt")[], nytRank?: number, genres: string[], moods: string[], weight: 1|2|3, solo: boolean, blurb: string, praise?: string, awards?: string[], castLabel?: string, rt: number|null, fallback: { year, seasons, episodes, runtime, imdb, lang } }`. `year` is kept top-level for matching only.

- [ ] **Step 1: Write failing tests:**
```js
const e = legacyToSeries(d);
assert.equal(e.length, 128);
assert.deepEqual(e[2].lists, ["mine", "nyt"]); assert.equal(e[2].nytRank, 1);
assert.deepEqual(e[60].lists, ["nyt"]);
assert.deepEqual(e[2].fallback, { year: 2008, seasons: 5, episodes: 62, runtime: 47, imdb: 9.5, lang: "en" });
assert.equal(e[2].rt, 96);
assert.deepEqual(e[2].genres, ["crime", "thriller", "drama"]);
assert.equal(e[0].solo, true);
assert.ok(e[2].awards.length === 2);
assert.equal(e[0].tmdbId, null);
assert.equal(e.filter(x => x.lists.includes("mine")).length, 60);
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (index < 60 → `"mine"`; `NYTR[i]` present → `"nyt"` + `nytRank`; omit `praise`/`awards`/`castLabel` when empty; `castLabel` from `MORE[i][3]`). **Step 4:** Run → PASS.

- [ ] **Step 5: Commit** `feat: map legacy data to series entries`.

---

### Task 3: One-time TMDB id matching

**Files:**
- Create: `scripts/lib/match.mjs`, `scripts/lib/api.mjs` (only `tmdbGet` for now), `scripts/match-ids.mjs`
- Test: `tests/match.test.mjs`

**Interfaces:**
- Consumes: `legacyToSeries()`.
- Produces: `pickMatch(results: {id, name, original_name, first_air_date}[], want: {name, year}) -> { id: number } | { candidates: {id, name, year}[] }`; `tmdbGet(path: string, params?: object, fetchImpl = fetch) -> Promise<object>` (base `https://api.themoviedb.org/3`, Bearer `TMDB_TOKEN`, throws `Error` with status on non-2xx, retries once on 429 after `Retry-After` seconds, default 2).

- [ ] **Step 1: Failing tests** for `pickMatch`:
  - exactly one result with `first_air_date` year === `want.year` → `{id}`.
  - two results with the wanted year (want `{name:"The Office", year:2005}`, results ids 2316 and 9999 both 2005, plus id 2996 from 2001) → `{candidates}` with exactly ids 2316 and 9999.
  - zero results → `{candidates: []}`.
  - year off by one and it is the only result whose `name` or `original_name` equals `want.name` case-insensitively → `{id}` (premiere-date drift).

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement `pickMatch`. **Step 4:** Run → PASS.

- [ ] **Step 5: Implement `match-ids.mjs`:** for each entry with `tmdbId === null`, `GET /search/tv?query=name&first_air_date_year=year&language=en-US`, falling back to a query without the year if empty. Write `series.json` (2-space JSON, `year` removed, `tmdbId` filled where matched) and `needs-review.md` listing each unresolved series with candidate `id · name · year · https://www.themoviedb.org/tv/{id}`. Re-running only touches entries still `null`. If `series.json` exists, read entries from it instead of legacy data.

- [ ] **Step 6: Commit** `feat: add one-time TMDB id matcher`. (Running it needs `TMDB_TOKEN`; done in Task 11.)

---

### Task 4: Transform TMDB responses

**Files:**
- Create: `scripts/lib/tmdb.mjs`, `scripts/providers.json`, `tests/fixtures/tv-1396-he.json`, `tests/fixtures/tv-partial.json`
- Test: `tests/tmdb.test.mjs`

**Interfaces:**
- Produces:
  - `medianRuntime(tv) -> number|null` — median of `episode_run_time`; else `last_episode_to_air.runtime`; else `null`.
  - `mapProviders(wp, map) -> { cats: string[], unknown: string[] }` — `wp` is `tv["watch/providers"].results.IL?.flatrate ?? []`; `map` is `providers.json` (`{ category: [exact provider_name, …] }`, compared case-insensitively); unmatched names → `"other"` + listed in `unknown`; `cats` deduped, in the order of `providers.json` keys, `other` last.
  - `transformTv(tv, { en, map }) -> { live: Live, warnings: string[] }`, `Live = { year, seasons, episodes, runtime, status: "ended"|"airing", lang, poster: string|null, creators: string[], cast: {name, photo: string|null}[], providers: string[], overviewHe: string|null, imdbId: string|null }`. `status` is `"airing"` when `tv.in_production` is true. `seasons` = `number_of_seasons`, `episodes` = `number_of_episodes`, `year` from `first_air_date`. `en` (optional English response) supplies `overview` only when Hebrew is empty — `overviewHe` stays `null` in that case (English text is not Hebrew). Cast from `aggregate_credits.cast` ordered by `order`, first 10.

- [ ] **Step 1:** Create fixtures: `tv-1396-he.json` — trimmed real-shaped object for Breaking Bad (fields used above, 3 cast, IL flatrate `[{provider_name:"Netflix"}]`); `tv-partial.json` — `episode_run_time: []`, no `last_episode_to_air`, no `watch/providers`, `poster_path: null`, `external_ids.imdb_id: null`.

- [ ] **Step 2: Failing tests:**
```js
assert.equal(medianRuntime({ episode_run_time: [45, 47, 60] }), 47);
assert.equal(medianRuntime({ episode_run_time: [], last_episode_to_air: { runtime: 52 } }), 52);
assert.equal(medianRuntime({ episode_run_time: [] }), null);
assert.deepEqual(mapProviders([{ provider_name: "Netflix" }, { provider_name: "Brand New TV" }], map),
  { cats: ["netflix", "other"], unknown: ["Brand New TV"] });
const { live } = transformTv(bb, { map });
assert.equal(live.seasons, 5); assert.equal(live.status, "ended");
assert.match(live.poster, /^https:\/\/image\.tmdb\.org\/t\/p\/w342\//);
assert.deepEqual(live.providers, ["netflix"]);
const p = transformTv(partial, { map }).live;
assert.equal(p.runtime, null); assert.equal(p.poster, null); assert.deepEqual(p.providers, []); assert.equal(p.imdbId, null);
```

- [ ] **Step 3:** Run → FAIL. **Step 4:** Implement, and create `providers.json` with categories: `netflix: ["Netflix","Netflix basic with Ads"]`, `hbo: ["Max","HBO Max"]`, `apple: ["Apple TV+","Apple TV Plus"]`, `prime: ["Amazon Prime Video","Amazon Prime Video with Ads"]`, `disney: ["Disney Plus","Disney+"]`, `israel: ["yes","Yes TV","STINGTV","HOT","Next TV","Partner TV","Cellcom TV","Kan","Kan Box"]`. (Real names get corrected from `unknown` warnings after the first live run, Task 11.) **Step 5:** Run → PASS.

- [ ] **Step 6: Commit** `feat: transform TMDB tv responses`.

---

### Task 5: Merge, fallback, validation, abort rule

**Files:**
- Create: `scripts/lib/merge.mjs`
- Test: `tests/merge.test.mjs`

**Interfaces:**
- Consumes: `Entry` (Task 2, without `year`), `Live` (Task 4).
- Produces:
  - `mergeEntry(entry, live: Live|null, imdb: number|null, prev: Series|null, now: string) -> Series` — `Series` = every `Entry` field except `fallback`, plus `year, seasons, episodes, runtime, status, imdb, lang, poster, creators, cast, providers, overviewHe, fetchedAt`. Per field: live value if non-null/non-empty-for-numbers → else `prev` value → else `entry.fallback` value (for the 6 fallback fields) → else `null`/`[]`. `imdb` arg null → prev → fallback. `fetchedAt` = `now` if `live` is non-null, else `prev?.fetchedAt ?? null`. Manual fields (Global Constraints) always from `entry`.
  - `validateData(data, expectedCount) -> string[]` (empty = valid): count matches; each series has `tmdbId` (integer), `name`, `seasons >= 1`, `episodes >= 1`, `runtime > 0`, `0 <= imdb <= 10`.
  - `shouldAbort(failed: number, total: number) -> boolean` — `failed / total > 0.2`.
  - `sameData(a, b) -> boolean` — deep-equal ignoring `updatedAt` and every `fetchedAt`.

- [ ] **Step 1: Failing tests:**
  - live wins over prev and fallback for `seasons`; `name` from entry even if live has another name.
  - `live = null`, `prev` present → prev values, `fetchedAt` = prev's.
  - `live = null`, `prev = null` → fallback values (`seasons: 5`, `runtime: 47`, `imdb: 9.5`), `providers: []`, `poster: null`.
  - `live.runtime = null` with prev runtime 50 → 50.
  - `validateData` flags `seasons: 0` and a count mismatch; passes a good object.
  - `shouldAbort(25, 128) === false`, `shouldAbort(26, 128) === true`.
  - `sameData` true when only timestamps differ; false when one `imdb` differs.

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.

- [ ] **Step 5: Commit** `feat: merge live data with fallbacks and validate`.

---

### Task 6: `fetch-data` CLI

**Files:**
- Modify: `scripts/lib/api.mjs`
- Create: `scripts/fetch-data.mjs`
- Test: `tests/fetch-data.test.mjs`

**Interfaces:**
- Consumes: `tmdbGet`, `transformTv`, `mapProviders`, `mergeEntry`, `validateData`, `shouldAbort`, `sameData`.
- Produces:
  - `omdbRating(imdbId, fetchImpl = fetch) -> Promise<number|null>` — `https://www.omdbapi.com/?i={id}&apikey={OMDB_KEY}`; `null` on `"N/A"`, `Response: "False"`, or network error (never throws).
  - `pool(items, limit, fn) -> Promise<Result[]>` with limit 8.
  - `run({ series, prev, fetchImpl, now, only?: number, offline?: boolean }) -> Promise<{ data, failed: string[], warnings: string[], abort: boolean }>` exported from `fetch-data.mjs`; the CLI part runs only when the file is executed directly.
  - CLI flags: `--only N` (first N series, writes nothing, prints summary — smoke test), `--offline` (no network; every series via prev/fallback; never aborts — for local dev).
  - Per series: `tmdbGet("/tv/{id}", {language:"he-IL", append_to_response:"aggregate_credits,watch/providers,external_ids"})`; if `overview` empty, `tmdbGet("/tv/{id}", {language:"en-US"})` → passed as `en`; then `omdbRating`. A thrown TMDB error marks that series failed (merge with `live = null`).
  - TMDB unreachable = the first 3 series all failed with a network error (not 404) → `abort: true` immediately.
  - Writes `site/data.json` (`{ updatedAt: now, series }`, 2-space JSON) only when not aborting, validation passes, and `!sameData(new, prev)`. Exit codes: 0 written/unchanged, 1 abort. Logs: counts, each failure, each unknown provider name (once).

- [ ] **Step 1: Failing tests** using a stub `fetchImpl` that serves fixtures by URL:
  - 2 series, both succeed → `data.series.length === 2`, `abort === false`, OMDb `imdbRating: "9.5"` → `imdb === 9.5`.
  - 5 series, 2 return 404 → `abort === true` (40% > 20%), failed lists their names.
  - 5 series, 1 returns 404 with a prev entry → not aborted, that series has prev values.
  - all network errors → `abort === true`.
  - `offline: true` with no prev → all series from fallback, `abort === false`, no `fetchImpl` calls.
  - OMDb returns `"N/A"` → `imdb` falls back to prev.

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.

- [ ] **Step 5:** Generate a dev dataset: run `match-ids` is not possible yet, so create a temporary `series.json` via `node -e` from `legacyToSeries()` with `tmdbId` set to `-(index+1)` (placeholder, clearly fake), run `npm run fetch -- --offline`, and confirm `site/data.json` has 128 series. Commit both files with message `chore: offline dev dataset (placeholder ids)`. Task 11 replaces them.

- [ ] **Step 6: Commit** `feat: nightly fetch-data CLI`.

---

### Task 7: Split the site and extract pure logic

**Files:**
- Create: `site/index.html`, `site/styles.css`, `site/app.js`, `site/lib/score.js`, `site/lib/data.js`, `site/lib/seen.js`
- Test: `tests/score.test.mjs`, `tests/site-data.test.mjs`

**Interfaces:**
- Consumes: `site/data.json` shape (Task 5 `Series`).
- Produces:
  - `fromData(json) -> S[]` where each item has the legacy shape the UI code already uses: `{ id: index, tmdbId, n: name, y: year, s: seasons, e: episodes, m: runtime, g: genres, mo: moods, h: weight, solo, l: blurb || overviewHe || "", imdb, rt, lang, nyt: nytRank ?? null, lists, providers, poster, cast, creators, airing: status === "airing", praise: praise ?? null, awards: awards ?? [], castLabel: castLabel ?? null }`.
  - `scoreSeries(s, a) -> { norm: number, pct: number, items: {ok, w, t}[] }` — the body of the legacy `rank()` per-series block (legacy lines 614–655), moved verbatim; needs `GENRES`, `MOODS`, `LNAME`, `WEIGHT_WHY`, `SEAS_IDX`, `SEAS_TXT`, `LEN_IDX`, `LEN_TXT`, `bL`, `bS`, all exported from `score.js` (moved from `app.js`).
  - `poolIds(S, src, plats) -> number[]` — `mine`: `lists.includes("mine")`; `nyt`: has `nyt`, sorted by rank; `plats` non-empty → `s.providers.some(p => plats.includes(p))`.
  - `loadSeen(storage, S) -> Set<number>` (indices) — reads `tvpick:v2` ids → indices; else `tvpick:v1` integers 0..S.length-1 kept as indices (same order); unknown ids dropped; any throw → empty set.
  - `saveSeen(storage, seen, S)` → writes `tvpick:v2` `{ seen: [tmdbId…] }`; swallows errors.

- [ ] **Step 1: Failing tests.** First create `tests/fixtures/data-small.json` (`{updatedAt, series:[…]}` in the Task 5 `Series` shape) with Breaking Bad, Severance and Ted Lasso using their legacy values (genres/moods/weight/runtime/seasons/imdb from `legacy-data.json`), `tmdbId` 1396 / 95396 / 97546, and `providers` `["netflix"]` / `["apple"]` / `["apple"]`.
```js
// score.test.mjs — values computed by hand from the legacy formula
const S = fromData(fixture);          // tests/fixtures/data-small.json: Breaking Bad, Severance, Ted Lasso with legacy values
const a = { genres: ["crime"], mood: "tense", platforms: [] };
assert.equal(scoreSeries(byName("Breaking Bad"), a).pct, 100);
assert.equal(scoreSeries(byName("Severance"), a).pct, 32);
assert.equal(scoreSeries(byName("Ted Lasso"), { genres: [], platforms: [], weight: 3 }).pct, 0);
assert.deepEqual(poolIds(S, "any", ["netflix"]).map(i => S[i].n), ["Breaking Bad"]);
// site-data.test.mjs
const mem = new Map(); const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
mem.set("tvpick:v1", JSON.stringify({ seen: [1, 99] }));
assert.deepEqual([...loadSeen(storage, S)], [1]);
saveSeen(storage, new Set([1]), S);
assert.deepEqual(JSON.parse(mem.get("tvpick:v2")).seen, [S[1].tmdbId]);
assert.equal(loadSeen({ getItem() { throw new Error("blocked"); } }, S).size, 0);
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement the three `site/lib` modules. **Step 4:** Run → PASS.

- [ ] **Step 5:** Split the legacy file: `<style>` → `styles.css`; `<script>` → `app.js` (loaded as `<script type="module" src="app.js">`); `index.html` keeps `<head>` (title, meta, fonts), `#app`, `#dlg`. In `app.js`: import from `lib/`; replace the inline per-series scoring in `rank()` with `scoreSeries`; delete `RAW`, `META`, `PLAT`, `PCODE`, `NYTR`, `MORE`, `PRAISE`, `P`, `MINE_N`, the legacy `localStorage` block, and the entire photo system (legacy lines 1246–1337: `PH`…`keydown` handler, plus the `window.claude` IIFE at 1371–1379, `phPanelHTML`/`phAddHTML` call sites, `.phadd`/`.pastezone`/`.phpanel` CSS). Leave app boot for Task 8 — the page is not expected to run between Task 7 and Task 8.

- [ ] **Step 6:** `npm test` → PASS. **Step 7: Commit** `refactor: split site and extract scoring, data and seen modules`.

---

### Task 8: Run the site on `data.json`

**Files:**
- Modify: `site/app.js`, `site/styles.css`, `site/index.html`

**Interfaces:**
- Consumes: `fromData`, `loadSeen`, `saveSeen`, `poolIds`, `scoreSeries`.

- [ ] **Step 1: Boot:** `S` becomes `let S = []`. On start render a loading view ("טוענים את הסדרות…"), `fetch("data.json", { cache: "no-cache" })` → `S = fromData(json)`, `st.seen = loadSeen(localStorage, S)`, `st.updatedAt = json.updatedAt`, `render(false)`. On any error render: heading "לא הצלחנו לטעון את הסדרות", text "בדקו את החיבור ונסו שוב.", button `data-a="retry"` that reruns boot. `save()` calls `saveSeen`.

- [ ] **Step 2: Platforms question:** replace `PLAT_LABEL` with the 7 categories from Global Constraints; chips show only categories present in some `s.providers`; question `d` text: "לפי הזמינות בישראל, מתעדכן כל יום. אפשר לבחור כמה או לדלג." All `poolIds` calls pass `S`.

- [ ] **Step 3: Series content from data:** `poster(i)` → `<img src=s.poster loading="lazy" alt="">` when present, else `art(i)`; on image error swap to `art(i)` (extend the existing `error` listener to `.poster` images). `similar()`'s `crew(i)` → `S[i].creators`; drop the `o.plat === s.plat` term in favor of `o.providers.some(p => s.providers.includes(p))`. `moreHTML`: creators from `s.creators`, cast from `s.cast` names, label `s.castLabel || "בכיכוב"`, awards from `s.awards`. `praiseHTML` from `s.praise`. `metaHTML` adds `<span>עדיין משודרת</span>` when `s.airing`. Ticket and series dialog add one line: "זמין ב: {labels joined by ', '}" or "לא זמינה כרגע בסטרימינג בישראל".

- [ ] **Step 4: Actors:** `actorIndex()` builds from `s.cast`; `avatar(n)` uses the cast `photo` URL when any series has one for that name (map built in `actorIndex`), initials otherwise.

- [ ] **Step 5: Footer** on every screen, below content: "הנתונים עודכנו ב-{date in he-IL, day month year}" · the TMDB sentence (verbatim, `dir="ltr"`) with the TMDB logo from `https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg` (height 12px) · "נתוני זמינות: JustWatch".

- [ ] **Step 6: Verify in a browser.** Add `.claude/launch.json` entry `{ "name": "site", "runtimeExecutable": "python3", "runtimeArgs": ["-m","http.server","8080","-d","site"], "port": 8080 }`, start it, and check at 375px and desktop, light and dark: full quiz → result ticket; "הפתיעו אותי"; list tab with seen toggling survives reload; actors tab + actor dialog; series dialog; temporarily rename `data.json` → retry screen appears, restoring it and pressing retry loads. No console errors.

- [ ] **Step 7: Commit** `feat: load series from data.json with live fields`.

---

### Task 9: GitHub Actions and README

**Files:**
- Create: `.github/workflows/deploy.yml`, `.github/workflows/update-data.yml`, `README.md`

- [ ] **Step 1: `deploy.yml`:** `on: push (branches: [main], paths: ["site/**"]), workflow_dispatch, workflow_call`. Permissions `pages: write`, `id-token: write`, `contents: read`. Steps: `actions/checkout@v4` (with `ref: main` so a calling run sees the fresh commit), `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3` (`path: site`), `actions/deploy-pages@v4`. Concurrency group `pages`.

- [ ] **Step 2: `update-data.yml`:** `on: schedule (cron "0 3 * * *"), workflow_dispatch`. Job `update`: `contents: write`; checkout; `actions/setup-node@v4` (node 20); `npm test`; `node scripts/fetch-data.mjs --only 3` (smoke); `node scripts/fetch-data.mjs`; if `git status --porcelain site/data.json` non-empty → commit as `github-actions[bot]` "chore: update series data" and push; set output `changed`. Job `deploy`: `needs: update`, `if: needs.update.outputs.changed == 'true'`, `uses: ./.github/workflows/deploy.yml`, inherits permissions `pages: write, id-token: write`. Env from secrets `TMDB_TOKEN`, `OMDB_KEY`.

- [ ] **Step 3:** Validate both files parse: `node -e` is not a YAML parser, so run `npx --yes @action-validator/cli@0.6.0 .github/workflows/*.yml` if network allows; otherwise `ruby -ryaml -e 'ARGV.each{|f| YAML.load_file(f)}' .github/workflows/*.yml` (macOS ships Ruby). Expected: no errors.

- [ ] **Step 4: `README.md` (Hebrew):** what the project is; how to get the TMDB Read Access Token (themoviedb.org → Settings → API) and the OMDb key (omdbapi.com/apikey.aspx, free tier); adding both as repo secrets; enabling Pages with source "GitHub Actions"; running "Update data" manually; how to add/remove a series (edit `series.json`, `npm run match`, commit); local dev (`npm run fetch -- --offline`, then serve `site/`).

- [ ] **Step 5: Commit** `ci: nightly data update and Pages deploy`.

---

### Task 10: Go live (with the user)

Needs the user's GitHub account and API keys; the agent never types keys or passwords — the user does.

- [ ] **Step 1:** User creates the keys (README steps). User puts `TMDB_TOKEN` in a local `.env` (git-ignored); agent runs `set -a; source .env; set +a; npm run match`. Expected: `series.json` with real ids, `needs-review.md` with ~5–10 entries.
- [ ] **Step 2:** Go through `needs-review.md` with the user; write chosen ids into `series.json`; rerun `npm run match` → `needs-review.md` empty. Delete it.
- [ ] **Step 3:** `npm run fetch -- --only 3` then `npm run fetch` locally. Fix `providers.json` from any "unknown provider" warnings; rerun until none. Commit `series.json`, `providers.json`, `site/data.json` — `feat: real TMDB ids and first live data`.
- [ ] **Step 4:** User creates public repo `bingology` on GitHub; agent adds the remote and pushes `main` (after the user confirms). User adds the two secrets and sets Pages source to "GitHub Actions".
- [ ] **Step 5:** Trigger "Update data" (`gh workflow run update-data.yml`), then confirm both jobs green with `gh run list --limit 3`.
- [ ] **Step 6:** Open `https://<user>.github.io/bingology` in the browser pane: quiz end to end, a series dialog shows a real poster, availability line, and the footer date is today. User opens it on their phone in a private window (no Claude login) to confirm sharing works.

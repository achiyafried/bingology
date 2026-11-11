# Bingology Personal Area Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a signed-in personal area ("שלי" tab) with want / watching / seen / dropped lists, episode progress, 1–10 ratings, a small circle of friends with a feed and a joint binge pick, and a read-only share link — without the public site depending on it.

**Architecture:** The site stays static on GitHub Pages. A new Supabase project (Postgres + Auth + RLS) holds accounts and lists; `supabase/schema.sql` is the source of truth for tables, triggers, RLS policies and RPC functions. Browser code talks to Supabase through `@supabase/supabase-js` loaded with dynamic `import()` from a pinned CDN URL only when the "שלי" tab, a hash link, or a signed-in series card needs it. Pure logic (progress, joint pick, migration, write queue) lives in small ES modules tested with `node --test`.

**Tech Stack:** Node 22 (`node:test`, built-in `fetch`), vanilla ES modules, Supabase (Postgres 15, Auth, PostgREST, RLS), GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-11-bingology-personal-area-design.md`

## Global Constraints

- **Zero npm dependencies** (runtime or dev), as today. Node tests reach Supabase with plain `fetch` to its REST/Auth endpoints.
- Browser Supabase client: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm`, loaded only via `import()` inside `site/lib/account/client.js`. No static import of anything under `site/lib/account/` or `site/views/` from `app.js` top level.
- `site/lib/account/config.js` holds the public Project URL and anon key (public by design; protection is RLS). Service keys never appear in `site/`.
- Series key everywhere: `tmdbId` (int). Statuses exactly: `want`, `watching`, `seen`, `dropped`. Rating: integer 1–10 or null. Note: ≤ 140 chars.
- Event kinds exactly: `started`, `finished`, `rated`, `wanted`, `dropped`. Events are written only by the DB trigger; "+1 episode" alone never creates an event.
- Default pace for "evenings left": **2 episodes per evening** (same as `st.pace || 2` in `app.js`).
- UI copy is Hebrew, RTL, in the existing tone; reuse existing CSS tokens and classes (`.btn`, `.ticket`, `.chip`, `.tabs`, `.empty`), dark mode included. Visual reference: the approved mockup (tab "שלי", circle section, card additions, sign-in screen).
- Hash routes: `#join=<code>` (invite), `#u=<slug>` (read-only shared profile).
- Every `localStorage` access in `try/catch`. Existing keys `tvpick:v1` / `tvpick:v2` keep working for signed-out users.
- Feed: last **20** events. Write retries: give up and show "השינוי לא נשמר" after **3** failures.
- Error copy, verbatim: account unavailable — "לא הצלחנו להתחבר לחשבון. נסו שוב בעוד רגע"; bad invite — "הקישור לא תקין או שפג תוקפו"; failed write — "השינוי לא נשמר".

## Prerequisites (owner, before Task 1)

- Node 22 installed locally (`brew install node@22`) — not currently on this machine; CI already has it.
- Two Supabase projects (prod + test, region Frankfurt). Test project URL and service-role key in `.env` as `SUPABASE_TEST_URL`, `SUPABASE_TEST_SERVICE_KEY`, plus `SUPABASE_TEST_ANON_KEY`. Google provider enabled on prod. Task 9's README section documents this; the owner may do it earlier from the spec's "הקמה" section.

## Review Focus

1. **Signed-out visitor or Supabase down** — recommendation, list, actors and search must load and work exactly as today; no network request to Supabase or jsDelivr until "שלי" is opened. (Test in Task 7.)
2. **Series with no `seasonEps`** (old data, specials-only, TMDB gap) — "+1 episode" still advances within a single flat count and never throws or shows NaN. (Test in Task 2.)
3. **Same series edited twice while offline** — the queue keeps only the latest write per `tmdbId`, replays in order, and does not resurrect an older status. (Test in Task 6.)
4. **Invite link opened by someone already in a circle, or by the circle's own member** — asks before switching; own circle is a no-op. (Test in Task 5's RLS/RPC tests.)
5. **Series that rotated out of the nightly pool** — still listed in "שלי" from stored `title`/`poster`, no binge score, tapping does not open a broken card. (Test in Task 7.)

---

### Task 1: `seasonEps` in nightly data

**Files:**
- Modify: `scripts/lib/tmdb.mjs` (`transformTv`, `live` object)
- Modify: `scripts/lib/merge.mjs:2` (`SCALAR_FIELDS`)
- Modify: `site/lib/data.js` (`fromData`)
- Test: `tests/tmdb.test.mjs`, `tests/merge.test.mjs`, `tests/site-data.test.mjs`

**Interfaces:**
- Produces: data.json field `seasonEps: number[] | null`; app series field `se: number[] | null` (episodes per regular season, in order, season 0 excluded).

- [ ] **Step 1: Failing tests**
  - `transformTv` with `seasons: [{season_number:0,episode_count:3},{season_number:1,episode_count:7},{season_number:2,episode_count:13}]` → `live.seasonEps` deep-equals `[7, 13]`; with no `seasons` → `null`; with a season whose `episode_count` is 0 → that season dropped.
  - `mergeEntry` keeps `prev.seasonEps` when `live.seasonEps` is null.
  - `fromData({series:[{…, seasonEps:[7,13]}]})[0].se` deep-equals `[7,13]`; missing → `null`.
- [ ] **Step 2:** `npm test` → the new tests FAIL.
- [ ] **Step 3:** Implement: add `seasonEps` to `live`; add `"seasonEps"` to `SCALAR_FIELDS`; add `se: x.seasonEps ?? null` to `fromData`.
- [ ] **Step 4:** `npm test` → all PASS.
- [ ] **Step 5:** Commit `feat: episodes per season in nightly data`.

### Task 2: Episode progress (pure)

**Files:**
- Create: `site/lib/progress.js`
- Test: `tests/progress.test.mjs`

**Interfaces:**
- Consumes: series shape `{ e, se, m }` from Task 1.
- Produces:
  - `nextEpisode(pos: {season:number, episode:number}, s) -> {season, episode, last: boolean}` — `last` true when `pos` is the final episode (then `pos` is returned unchanged).
  - `progress(pos, s, pace = 2) -> {watched:number, total:number|null, pct:number|null, eveningsLeft:number|null}`.

- [ ] **Step 1: Failing tests** (`s = { e: 20, se: [10, 10] }`)
  - `nextEpisode({season:1,episode:9}, s)` → `{season:1,episode:10,last:false}`; `({1,10})` → `{2,1,false}`; `({2,10})` → `{2,10,last:true}`.
  - `progress({season:2,episode:4}, s)` → `{watched:14,total:20,pct:70,eveningsLeft:3}`.
  - No `se` (`{ e: 20, se: null }`): `nextEpisode({1,5})` → `{1,6,false}`; `({1,20})` → `last:true`; `progress({1,5})` → `{watched:5,total:20,pct:25,eveningsLeft:8}`.
  - No `se` and no `e`: `nextEpisode({1,5})` → `{1,6,false}`; `progress` → `{watched:5,total:null,pct:null,eveningsLeft:null}` (no NaN anywhere).
- [ ] **Step 2:** `node --test tests/progress.test.mjs` → FAIL (module missing).
- [ ] **Step 3:** Implement both functions in `site/lib/progress.js`. `pct` rounded to integer; `eveningsLeft = ceil((total - watched) / pace)`.
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Commit `feat: episode progress helpers`.

### Task 3: Migrate local "seen" marks (pure)

**Files:**
- Create: `site/lib/migrate.js`
- Test: `tests/migrate.test.mjs`

**Interfaces:**
- Consumes: `loadSeen(storage, S)` from `site/lib/seen.js`.
- Produces: `seenToEntries(storage, S, existing: Set<number>) -> Array<{tmdb_id, status:'seen', title, poster}>` and `MIGRATED_KEY = "bingology:migrated"`.

- [ ] **Step 1: Failing tests** (fake storage object with `getItem`/`setItem`)
  - v2 storage `{"seen":[1396,1438]}`, both in `S` → two rows with `title`/`poster` from `S`.
  - v1 storage `{"seen":[0,1]}` → rows for `S[0]`, `S[1]`.
  - `existing` contains 1396 → only 1438 returned.
  - v2 id not present in today's `S` → skipped (no title to store).
  - Storage `getItem` throws → `[]`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement on top of `loadSeen`.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: migrate local seen marks to account rows`.

### Task 4: Joint binge pick (pure)

**Files:**
- Create: `site/lib/jointpick.js`
- Test: `tests/jointpick.test.mjs`

**Interfaces:**
- Consumes: `bingeScores(S)` output (`{score}` per index) from `site/lib/binge.js`.
- Produces:
  - `pickPartner(me: string, lists: Map<userId, Map<tmdbId,status>>) -> userId | null` — the other member with the most shared `want` ids; tie → first in map order; no other members → null.
  - `jointPick(S, scores, lists, members: string[], skipped: Set<number>) -> {tmdbId, mode:'shared'|'fallback'} | null`.

- [ ] **Step 1: Failing tests**
  - Shared: both members `want` 95396 and 136315, neither seen/watching/dropped either → returns the one with the higher binge score, `mode:'shared'`.
  - A series that any *other* circle member (not in `members`) has `seen` is still allowed; a series with any row other than `want` for either of `members` is excluded.
  - `skipped` contains the best → next best.
  - No shared wants → highest-score series in `S` that no member has any row for, `mode:'fallback'`.
  - Everything excluded → `null`.
  - `pickPartner` picks the member with 2 overlaps over one with 1; alone in circle → `null`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: joint binge pick`.

### Task 5: Database schema, RLS, RPCs

**Files:**
- Create: `supabase/schema.sql`
- Create: `tests/rls.test.mjs`
- Create: `tests/lib/supa.mjs` (tiny fetch helpers for tests)
- Modify: `scripts/lib/env.mjs` only if needed to read the three `SUPABASE_TEST_*` vars (follow existing pattern)

**Interfaces:**
- Produces (SQL, exact names): tables `profiles`, `circles`, `entries`, `events`, `pick_votes` with columns as in the spec's "מודל נתונים"; trigger `entries_to_events` (after insert/update on `entries`); trigger `set_finished_on` (before update/insert: status → `seen` and `finished_on` null ⇒ today); trigger `drop_empty_circle`; RPCs:
  - `create_circle() returns circles` — creates circle with random 10-char `invite_code`, sets caller's `profiles.circle_id`.
  - `join_circle(code text, force boolean default false) returns jsonb` — `{ok:true}` | `{error:'bad_code'}` | `{error:'in_other_circle', circle_names: text[]}` (when `force` false and caller is in a different circle) | `{ok:true, noop:true}` (already in that circle).
  - `leave_circle() returns void`.
  - `shared_profile(slug text) returns jsonb` — `{name, entries:[…]}` or `null` (unknown/disabled slug). `security definer`.
- `tests/lib/supa.mjs` produces: `adminCreateUser(email) -> {id, token}` (service key, auto-confirmed, signs in with password via `/auth/v1/token`), `rest(token, method, path, body?) -> {status, json}`, `rpc(token, fn, args) -> {status, json}`, `resetDb()` (deletes test users).

- [ ] **Step 1: Failing tests** in `tests/rls.test.mjs`; whole file `skip`s when `SUPABASE_TEST_URL` is unset. Users A, B (same circle via `create_circle` + `join_circle`), C (outside).
  - B reads A's `entries` → rows; C reads A's `entries` → `[]`.
  - C reads circle `events` → `[]`; A inserts into `events` directly → 401/403.
  - B updates A's entry → 0 rows changed.
  - A upserts entry status `want`→`watching` → exactly one `started` event; updating only `episode` → no new event; setting `rating` 9 → one `rated` event; status → `seen` → `finished` event and `finished_on` = today.
  - `join_circle('nope')` → `{error:'bad_code'}`; C (after `create_circle`) calling `join_circle(A's code)` → `in_other_circle`; with `force:true` → ok, C's old circle deleted (was empty).
  - A calls `join_circle` with own code → `noop`.
  - `shared_profile(slug)` with A's `share_slug` set → A's name + entries (with `note`); after `share_slug = null` → `null`; never returns events or circle.
- [ ] **Step 2:** Apply `supabase/schema.sql` to the test project (SQL editor or `psql`), run `node --test tests/rls.test.mjs` → FAIL until schema is right.
- [ ] **Step 3:** Write `supabase/schema.sql` (idempotent: `create … if not exists`, `create or replace function`, `drop policy if exists`). RLS enabled on all five tables.
- [ ] **Step 4:** Re-apply, tests PASS. `npm test` without env → RLS file skipped, rest PASS.
- [ ] **Step 5:** Commit `feat: personal area database schema and RLS tests`.

### Task 6: Account client, auth, write queue

**Files:**
- Create: `site/lib/account/config.js`, `site/lib/account/client.js`, `site/lib/account/auth.js`, `site/lib/account/store.js`, `site/lib/account/queue.js`
- Test: `tests/queue.test.mjs`

**Interfaces:**
- Consumes: `seenToEntries`, `MIGRATED_KEY` (Task 3); schema (Task 5).
- Produces:
  - `config.js`: `export const SUPABASE_URL`, `export const SUPABASE_ANON_KEY`.
  - `client.js`: `getClient() -> Promise<SupabaseClient>` (memoized dynamic import; rejects if CDN fails).
  - `auth.js`: `currentUser() -> Promise<{id,email,name}|null>`, `signInGoogle()`, `signInEmail(email)`, `signOut()`, `ensureProfile(defaultName) -> profile`, `onAuth(cb)`.
  - `store.js`: `loadMine() -> Map<tmdbId, Entry>`, `saveEntry(tmdbId, patch)` (optimistic; goes through queue), `migrateLocal(storage, S)`, `setShare(on:boolean) -> slug|null`.
  - `queue.js` (pure, storage-injected): `enqueue(storage, tmdbId, row)`, `pending(storage) -> row[]`, `flush(storage, send: (row)=>Promise) -> {sent, failed, gaveUp: tmdbId[]}`; key `bingology:queue`.

- [ ] **Step 1: Failing tests** for `queue.js`:
  - Two `enqueue` calls for the same `tmdbId` → `pending` has one row, the later one.
  - `flush` with `send` that rejects for one id → that row stays, attempt count +1; after the 3rd failure it is removed and its id is in `gaveUp`.
  - Rows replay in enqueue order.
  - Throwing storage → `pending` returns `[]`, `enqueue` does not throw.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement `queue.js`, then the other four modules. `store.saveEntry` upserts `{user_id, tmdb_id, …patch, title, poster, updated_at: now}`; on failure enqueue; `flush` runs on `online` and at load. `migrateLocal` runs once per user (skips when `MIGRATED_KEY` holds the user id).
- [ ] **Step 4:** `npm test` PASS. Manual: in browser console on local server, `(await import('./lib/account/auth.js')).signInEmail(...)` receives a link (test project config).
- [ ] **Step 5:** Commit `feat: account client, auth and offline write queue`.

### Task 7: "שלי" tab — profile, lists, sign-in, share view

**Files:**
- Create: `site/views/mine.js`
- Modify: `site/app.js` (tab button, `render` branch, actions, hash handling — lazy `import("./views/mine.js")`)
- Modify: `site/styles.css` (classes from the mockup: `.me`, `.stats`, `.stat`, `.sh`, `.card`, `.it`, `.bar`, `.plus`, `.score`, `.bscore`, `.signin`)
- Test: `tests/mine.test.mjs`, `tests/site-data.test.mjs` (lazy-load guard)

**Interfaces:**
- Consumes: Tasks 2, 3, 6.
- Produces: `mineHTML(state) -> string` (pure render from `{user, profile, entries, S, scores, circle, feed, pick}`), `sharedHTML({name, entries}, S) -> string`, `mountMine(root, ctx) -> Promise<void>` (loads data, wires actions `plus`, `share`, `signin-google`, `signin-email`, `signout`).

- [ ] **Step 1: Failing tests**
  - `mineHTML` with `user:null` → contains "כניסה עם Google" and "יעברו לחשבון" with the local seen count.
  - Watching entry `{tmdb_id:95480, status:'watching', season:3, episode:4}` with `se:[6,6,6,6]` → contains "עונה 3 · פרק 4" and "עוד 7 ערבים".
  - Seen list sorted by rating desc; `dropped` entry shows "נטשתי בעונה N" and "—".
  - Entry whose `tmdb_id` is not in `S` → rendered with stored `title`/`poster`, no `data-a="detail"`, no binge score.
  - `sharedHTML` contains no buttons and no circle section.
  - Guard: `app.js` source has no top-level `import` matching `/account\/|views\//` (read the file as text).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement. Tab label "שלי" after "חיפוש". "+1 פרק" uses `nextEpisode`; when `last` is true, switch the row to a rating prompt ("סיימת? תנו ציון") that saves `status:'seen'` + rating. `#u=<slug>` renders `sharedHTML` from `shared_profile` and hides other tabs' state changes. Supabase/CDN failure → `.empty` box with the verbatim "account unavailable" copy and a retry button.
- [ ] **Step 4:** `npm test` PASS. Browser (local `site` server, mobile 375px, light + dark): signed-out tab, sign-in, local marks migrated, "+1 פרק" across a season boundary, share link opens read-only in a private window. With network to Supabase blocked: recommendation/list/search still work and no request goes to jsDelivr before opening "שלי".
- [ ] **Step 5:** Commit `feat: personal tab with lists, progress and sharing`.

### Task 8: Circle, feed, joint pick, series-card additions

**Files:**
- Create: `site/lib/account/circle.js`
- Modify: `site/views/mine.js` (circle section)
- Modify: `site/app.js` (series dialog: status / rating / friends block when signed in; list "seen" toggle writes `entries` when signed in; `#join=` route)
- Modify: `site/styles.css` (`.faces`, `.face`, `.joint`, `.friends`, `.fr`, `.status`, `.rate10`, `.lbl`)
- Test: `tests/mine.test.mjs` (circle render cases)

**Interfaces:**
- Consumes: Tasks 4, 6, 7; RPCs from Task 5.
- Produces (`circle.js`): `loadCircle() -> {circle, members: profile[], lists: Map, feed: Event[]}` (feed = last 20), `createCircle()`, `joinCircle(code, force=false)` (returns RPC jsonb), `leaveCircle()`, `vote(tmdbId, 'yes'|'skip')`, `inviteUrl(code) -> string`.

- [ ] **Step 1: Failing tests** (`mineHTML` with circle state)
  - No circle → "פתחו מעגל" and "יש לי קישור הזמנה".
  - Feed event `{kind:'rated', rating:9, tmdb_id:136315}` by "דנה" → "דנה נתנה 9 ל-The Bear" style line with relative time; only 20 newest rendered from 25.
  - Joint pick present → card with both names and "יאללה" / "הצעה אחרת"; `mode:'fallback'` → card header says "אף אחד במעגל עוד לא ראה".
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implement. "יאללה" → `vote('yes')` + `saveEntry(…, {status:'watching', season:1, episode:1})` for the current user (partner gets it on their own "יאללה"). "הצעה אחרת" → `vote('skip')`, recompute with skipped set. Invite button uses `navigator.share` when present, else clipboard. `#join=<code>`: signed out → sign-in then join; `in_other_circle` → confirm dialog "אתם כבר במעגל עם …. לעבור?" → `joinCircle(code, true)`; `bad_code` → verbatim bad-invite copy. Series dialog (signed in): 4 status buttons, 1–10 rating row, friends chips ("דנה 8", "יואב רוצה לראות").
- [ ] **Step 4:** `npm test` PASS. Browser, two profiles (normal + private window): create circle, join via link, rating in one shows in the other's feed and card, joint pick appears, "הצעה אחרת" changes it, leave circle hides data.
- [ ] **Step 5:** Commit `feat: circle, feed, joint pick and card additions`.

### Task 9: Keep-alive, setup docs, final check

**Files:**
- Modify: `.github/workflows/update-data.yml` (new step after "Commit data.json", `continue-on-error: true`)
- Modify: `README.md` (new section "אזור אישי (Supabase)" in the existing setup style)

- [ ] **Step 1:** Workflow step: `curl -fsS "$SUPABASE_URL/rest/v1/circles?select=id&limit=1" -H "apikey: $SUPABASE_ANON_KEY"` with both from repo secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`; `continue-on-error: true` so it never fails the nightly update.
- [ ] **Step 2:** README: the five setup steps from the spec's "הקמה" section, plus the two repo secrets and the three `.env` test vars.
- [ ] **Step 3:** `npm test` (all PASS, RLS file runs with `.env` loaded). Run the workflow manually once (`workflow_dispatch`) and confirm the ping step is green.
- [ ] **Step 4:** Commit `chore: keep Supabase awake and document setup`.

# "לא בשבילי" + "בשבילך" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users mark a series "לא בשבילי" so it stops being recommended, and give signed-in users a "בשבילך" row in "שלי", built from the series they rated 8+, with a "כי אהבתם את X" reason on each item.

**Architecture:** Two pure modules carry the logic: `site/lib/similar.js` holds the series-to-series similarity, moved out of `app.js`, and `site/lib/foryou.js` builds the recommendations. A third pure module, `site/lib/nope.js`, holds the local "not for me" marks, like `seen.js`. Signed-in marks become a new `entries.status = 'nope'`. The schema keeps them private: the events trigger and `shared_profile` both skip them. `app.js`, `views/card.js` and `views/mine.js` wire it into the UI.

**Tech Stack:** Vanilla ES modules (static site on GitHub Pages), Supabase (Postgres + RLS), `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-15-bingology-for-you-design.md`

## Global Constraints

- Hebrew RTL UI. Series names go inside `<bdi>` and pass through `esc()`.
- Schema changes stay safe to re-run (`drop constraint if exists` / `add constraint`). Never put the Supabase service key in site code.
- The `nope` status is private. It writes no event, `shared_profile` doesn't return it, and nothing shows it to circle-mates.
- Offer "לא בשבילי" only for a series with no account row, or with a `want` row.
- Undo: a series that was `want` goes back to `want`, anything else is deleted. "החזרה להמלצות" in "שלי" always deletes.
- Local key: `bingology:nope`. It holds TMDB ids and keeps ids that are no longer in today's data.
- Upload local nope marks on **every** sign-in, only for ids with no row in the account.
- "בשבילך" signals:
  - loved = `seen` with rating ≥ 8, weight `rating − 7`.
  - disliked = `seen` with rating ≤ 5, or `dropped`, or `nope`, weight 1, multiplied by −0.5.
  - Ratings 6–7 are ignored.
- Neighbours: 20 per signal series, widening to 60 when the result is empty. Show the top 8 with a positive score. Tie-break by `bs`.
- Gate: at least 3 `seen` rows with a rating, at least one of them ≥ 8.
- Commit at the end of each task. Don't push or release: the user releases.

## Review Focus

1. A rated or `seen` series must never get the "לא בשבילי" button (data-loss path). Test this in Task 4 (card) and Task 6 (mine).
2. A signed-in un-nope must also clear the local mark, or the series stays hidden in the quiz. Test this in Task 2 (`setNope` round-trip) and Task 5 (app wiring).
3. A series that is nope'd and then rated would sit in the "לא בשבילי" list and "ראיתי" at once. Since a row has a single status, rating it replaces `nope` with `seen`. Test that a `nope` row isn't counted in the stats, in Task 6.
4. Series in an account row that aren't in today's data (they rotated out). `foryou` must skip unknown ids without throwing. Test in Task 3.
5. Ties and duplicate reasons, such as two loved series contributing equally. The reason line must name each one once. Test in Task 3.

---

### Task 1: Move similarity into `site/lib/similar.js`

**Files:**
- Create: `site/lib/similar.js`
- Modify: `site/app.js` (`crew` and `similar` around line 251; the "אם אהבתם" block in `moreHTML`)
- Test: `tests/similar.test.mjs`

**Interfaces:**
- Produces:
  - `crew(s) -> string[]`: the same cleanup as today's `crew` in `app.js`.
  - `similarity(s, o) -> { sc: number, shared: string[], g: string[], m: string[] }`: today's formula, unchanged.
  - `neighbours(S, i, n, skip?: (j) => boolean) -> Array<{ j, sc, why }>`: highest `sc` first, never includes `i`, `why` text exactly as today.
  - `why` uses the `GENRES` labels. Pass them in as `neighbours(S, i, n, skip, GENRES)` (5th param), or export `GENRES` from a lib module. The implementer picks one; keep `app.js` importing the same object.

- [ ] **Step 1: Write the failing tests.** Use `fromData` over `tests/fixtures/data-small.json`, as `tests/site-data.test.mjs` does.
  - `test("neighbours excludes the series itself and is sorted by score")`: for `i = 0`, no `j === 0`, and `sc` is non-increasing.
  - `test("shared creator scores at least 4 and explains it")`: pick two fixture series that share a creator (or build two minimal objects). Assert `sc >= 4` and that `why` starts with `"מאותם יוצרים ("`.
  - `test("skip filters candidates")`: with `skip = j => j === top.j`, that `j` is absent.
- [ ] **Step 2:** Run `node --test tests/similar.test.mjs`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `site/lib/similar.js` by moving the formula from `app.js`. In `app.js`, have `similar(i, n)` call `neighbours(S, i, n || 4, j => st.nope.has(j))`. `st.nope` arrives in Task 5; until then use `() => false`.
- [ ] **Step 4:** Run `npm test`. Expected: all pass, including the existing `site-data` tests.
- [ ] **Step 5:** Commit with the message `refactor: move series similarity to lib/similar.js`.

### Task 2: Local "not for me" marks

**Files:**
- Create: `site/lib/nope.js`
- Modify: `site/lib/migrate.js`
- Test: `tests/nope.test.mjs`, `tests/migrate.test.mjs`

**Interfaces:**
- Produces:
  - `NOPE_KEY = "bingology:nope"`
  - `loadNope(storage, S) -> Set<number>`: indexes into S. Never throws.
  - `saveNope(storage, nope: Set<number>, S)`: keeps stored ids that aren't in S, like `saveSeen`.
  - `nopeToEntries(storage, S, existing: Set<tmdbId>) -> Array<{ tmdb_id, status: "nope", title, poster }>`, in `migrate.js`.

- [ ] **Step 1: Write the failing tests.**
  - `loadNope` on empty or corrupt storage returns an empty Set.
  - A round-trip through `saveNope` and `loadNope` keeps the same indexes.
  - `saveNope` keeps an id that isn't in S. Example: stored `[999]`, then save `{0}` → the stored JSON contains 999 and `S[0].tmdbId`.
  - `nopeToEntries` skips ids in `existing` and returns rows with `status: "nope"` plus title and poster.
- [ ] **Step 2:** Run `node --test tests/nope.test.mjs tests/migrate.test.mjs`. Expected: FAIL.
- [ ] **Step 3:** Implement both. The storage format is `{"nope":[tmdbId,...]}` under `NOPE_KEY`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with the message `feat: local "not for me" marks`.

### Task 3: Recommendation engine `site/lib/foryou.js`

**Files:**
- Create: `site/lib/foryou.js`
- Test: `tests/foryou.test.mjs`

**Interfaces:**
- Consumes: `neighbours` and `similarity` from Task 1.
- Produces:
  - `readiness(entries: Map<tmdbId,row>) -> { ready: boolean, need: number }`. `need` is the number of extra ratings still required: `max(0, 3 − rated)`, or 1 when there are 3 or more but none is ≥ 8.
  - `forYou(S, entries: Map<tmdbId,row>, localSeen: Set<index>, opts?) -> Array<{ i, score, because: string[] }>`. Defaults: `opts = { n: 8, k: 20, wide: 60 }`. `because` holds the names of 1–2 loved series, the top contributor first. The second name is added only when its contribution is ≥ 80% of the first.
  - `unrated(S, entries, max = 4) -> number[]`: indexes of `seen` rows with no rating, newest `updated_at` first.

Algorithm (not fixed by the signature):
```
idx = Map tmdbId -> i
for each row with idx.has(id):
  loved (seen, rating>=8): w = rating-7
  disliked (seen rating<=5 | dropped | nope): w = -0.5
for each signal series i with weight w:
  for {j, sc} of neighbours(S, i, k):
    if candidate(j): score[j] += w*sc; if w>0: contrib[j][i] += w*sc
candidate(j) = no entries row for S[j].tmdbId && !localSeen.has(j)
result = j with score>0, sorted by score + bs/1000, take n
if result empty and k < wide: rerun with k = wide
```

- [ ] **Step 1: Write the failing tests.** Build a small S by hand: 6–8 objects with the fields `similarity` reads (`g`, `mo`, `h`, `lang`, `providers`, `y`, `imdb`, `creators`, `n`, `tmdbId`, `bs`).
  - `readiness`: 2 rated → `{ready:false, need:1}`; 3 rated, all ≤ 7 → `{ready:false, need:1}`; 3 rated with one 9 → `{ready:true, need:0}`.
  - `excludes anything with an entry row or a local seen mark`.
  - `a loved series pulls up its neighbour, and the reason names it`: `because[0] === S[loved].n`.
  - `a dropped series pushes its neighbour below an unrelated one`.
  - `ignores entries whose tmdb id is not in S` (Review Focus 4).
  - `two equal contributors are both named, once each` (Review Focus 5).
  - `widens to 60 when 20 neighbours are all taken`: with `k:1, wide:3` on the fixture, the first pass is empty and the result is non-empty.
  - `returns at most n`.
- [ ] **Step 2:** Run `node --test tests/foryou.test.mjs`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with the message `feat: for-you recommendation engine`.

### Task 4: Schema, account store, card, joint pick

**Files:**
- Modify:
  - `supabase/schema.sql` (constraint in the "Extra checks" block; `entries_to_events`; `shared_profile`)
  - `site/lib/account/store.js` (add `migrateNope`)
  - `site/views/card.js` (`STATUSES` stays; add the nope link; `syncSeen` gets a nope sibling)
  - `site/lib/jointpick.js` and `site/views/mine.js:15` (`BUSY`)
- Test: `tests/rls.test.mjs`, `tests/jointpick.test.mjs`, `tests/mine.test.mjs` (`cardHTML` tests live there)

**Interfaces:**
- Produces:
  - `store.migrateNope(storage, S) -> Promise<number>`: runs on every call, with no flag. It uploads `nopeToEntries(storage, S, existingIds)`.
  - `card.syncNope(S, nope: Set<index>) -> Promise<number>`: adds the indexes of account `nope` rows.
  - `card.writeNope(s, on: boolean, prevStatus?: string|null)`. on: `saveEntry(status:"nope")`, only when there's no row or the row is `want`. off: when `prevStatus === "want"`, save `want`; otherwise `removeEntry` (only if the row is `nope`).
  - `cardHTML(state)`. When `entry` is null or `entry.status ∈ {want, nope}`, it renders `<button class="linkbtn" data-a="cnope">`. The text is `לא בשבילי`, or `החזרה להמלצות` when the status is `nope`. `ctx.onNope(on)` lets `app.js` update `st.nope`.
  - The `nope` status button isn't in `STATUSES`. `aria-pressed` stays false for all four status buttons when the status is `nope`.

- [ ] **Step 1: Write the failing tests.**
  - rls: `test("entries: status nope is accepted; no event is written for it; moving nope→want writes 'wanted'")`.
  - rls: `test("shared_profile: nope rows are not returned")`.
  - jointpick: `test("fallback: a series someone in the circle marked nope is never picked")`.
  - mine.test (`cardHTML`): the link shows for `entry:null` and for `want`, and not for `seen`, `watching` or `dropped` (Review Focus 1). For `nope` it reads "החזרה להמלצות".
- [ ] **Step 2:** Run `npm test`. Expected: the jointpick and card tests FAIL. The rls test runs separately, in Step 5.
- [ ] **Step 3:** Implement the schema:
  - Add `alter table public.entries drop constraint if exists entries_status_check; alter table public.entries add constraint entries_status_check check (status in ('want','watching','seen','dropped','nope'));`. Use whatever name Postgres gave the inline check; look it up with `\d public.entries` on the TEST project and drop that name.
  - In the trigger: `if new.status = 'nope' then return null; end if;` right after the circle lookup. That skips the status event and the rating event.
  - In `shared_profile`: `where e.user_id = p.id and e.status <> 'nope'`.
- [ ] **Step 4:** Implement the store, card and `BUSY` changes. In `mine.js`, call `store.migrateNope(CTX.storage, CTX.S)` next to `migrateLocal` (around line 384), wrapped in the same try.
- [ ] **Step 5:** Run `npm run schema:test`, then `npm run test:rls`, then `npm test`. Expected: all PASS.
- [ ] **Step 6:** Commit with the message `feat: private 'nope' entry status`.

### Task 5: Wire "לא בשבילי" into the quiz and series card (`app.js`)

**Files:**
- Modify: `site/app.js`, `site/styles.css`
- Test: `tests/site-data.test.mjs`

**Interfaces:**
- Consumes: `loadNope` and `saveNope` (Task 2); `syncNope`, `writeNope` and `ctx.onNope` (Task 4); `neighbours` skip (Task 1).
- Produces:
  - `st.nope: Set<index>`.
  - `setNope(i, on, write)`, the twin of `setSeen`. For the undo, it remembers the previous account status in `st.nopePrev: Map<index, status|null>`.
  - `showToast(msg, url, undo?: () => void)`. With `undo`, the toast adds `<button class="linkbtn" data-a="undo">ביטול</button>`.
  - `mountMine` ctx gains `nope: () => st.nope` and `onNope: (tmdbId, on) => void`.

- [ ] **Step 1: Write the failing tests** (source and HTML assertions, like the existing site-data tests).
  - The result card has `data-a="nopepick"` with the text `לא בשבילי` next to `markseen`.
  - `rank()` skips `st.nope`. Test it through an exported or testable path if one exists; otherwise add a source assertion that the line filtering `st.seen` also checks `st.nope`.
  - The signed-out detail has `data-a="dnope"`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement:
  - boot: `st.nope = loadNope(store, S)`, plus `syncNope` after `syncSeen`.
  - `nopepick`: `setNope(i, true, true)`, remove it from `st.ranked`, `render(true)`, then `showToast("הוסר מההמלצות", null, () => setNope(i, false, true))`.
  - `dnope` toggles for signed-out visitors. The signed-in detail goes through `card.js` and `onNope`.
  - The "אם אהבתם" skip uses `st.nope`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS. Then check it by hand with a local server (`python3 -m http.server 8080 -d site`):
  - Mark a series in the quiz, undo, and confirm it comes back.
  - Reload, and confirm a marked series stays hidden.
- [ ] **Step 5:** Commit with the message `feat: "not for me" in quiz result and series card`.

### Task 6: "בשבילך" and the "לא בשבילי" list in "שלי" (`views/mine.js`)

**Files:**
- Modify: `site/views/mine.js`, `site/styles.css`
- Test: `tests/mine.test.mjs`

**Interfaces:**
- Consumes: `forYou`, `readiness` and `unrated` (Task 3); `CTX.nope` / `CTX.onNope` (Task 5); `save(id, patch)` and `store.removeEntry` (existing).
- Produces:
  - `forYouHTML(state) -> string`. It's inserted in `mineHTML` right after `quickHTML(st)`. It reads `state.entries`, `state.S` and `state.localSeenSet` (`CTX.seenSet()`; add this accessor to the `mountMine` ctx in `app.js`).
  - New `onClick` cases: `fy-want` (`save(id, {status:"want"})`), `fy-nope` (`save(id, {status:"nope"})` plus `CTX.onNope(id, true)`), `nope-open` (toggles `V.nopeOpen`), `nope-undo` (`store.removeEntry(id)`, then `V.entries.delete(id)` and `CTX.onNope(id, false)`). `detail` already exists.

Copy (exact):
- Heading: `בשבילך`
- Reason: `כי אהבתם את <bdi>X</bdi>`, or `כי אהבתם את <bdi>X</bdi> ואת <bdi>Y</bdi>`
- Not ready: `דרגו עוד N סדרות שראיתם ונתחיל להמליץ`. For N = 1: `דרגו עוד סדרה אחת שראיתם ונתחיל להמליץ`.
- Ready but empty: `עברתם על כל מה שמצאנו. דרגו עוד סדרות שראיתם ונמצא עוד`
- No unrated series to show: add `סמנו סדרות שראיתם בלשונית "הרשימה"`.
- Buttons: `+ רוצה`, `לא בשבילי`. Folded list: `לא בשבילי (N)`. Per row: `החזרה להמלצות`.

- [ ] **Step 1: Write the failing tests** with `mineHTML(...)`, using a fixture S big enough for `forYou` (reuse `data-small.json` via `fromData`).
  - Ready → the heading `בשבילך`, at most 8 items, each with `data-a="fy-want"`, `data-a="fy-nope"` and `כי אהבתם את`.
  - 2 rated → the not-ready line with N = 1, plus up to 4 unrated posters linking to `data-a="detail"`.
  - Ready but empty → the "עברתם על כל מה שמצאנו" line.
  - A `nope` row: not in "רוצה לראות" or "ראיתי", not counted in the stats, and present under `לא בשבילי (1)` with `data-a="nope-undo"` (Review Focus 3).
  - A `seen` row never gets `fy-nope` (Review Focus 1). It isn't a candidate anyway; assert that it's absent.
  - `sharedHTML` with a `nope` row (defence in depth): not shown.
- [ ] **Step 2:** Run `node --test tests/mine.test.mjs`. Expected: FAIL.
- [ ] **Step 3:** Implement. The item markup copies the `.sim` tile pattern from `app.js` `moreHTML`, with a `.fy` row that scrolls horizontally.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit with the message `feat: "for you" row and "not for me" list in the personal area`.

### Task 7: End-to-end check

- [ ] **Step 1:** Run `npm test` and `npm run test:rls`. Expected: 0 failures.
- [ ] **Step 2:** In the browser on a local server, signed in to the TEST project config if one is available; otherwise check the signed-out paths only and say so:
  - Rate 3 series (one of them 9), and confirm "בשבילך" appears with reasons.
  - `+ רוצה` moves an item into "רוצה לראות".
  - `לא בשבילי` removes an item, it shows in the folded list, and "החזרה להמלצות" brings it back.
  - The quiz never shows a nope'd series.
  - Check at 375px width. No console errors.
- [ ] **Step 3:** Report to the user. Don't merge to main or push until they ask. At release, `supabase/schema.sql` must be applied to the **production** project **before** the site deploys. The old constraint rejects `nope`, and the old trigger would announce it as "dropped". Remind the user of this order.

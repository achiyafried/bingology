# טריילרים בתוך האתר — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play a series' YouTube trailer inside the site — in the series card / result ticket / watch plan, and from a small ▶ on result tiles and "בשבילך" tiles — instead of sending people to a YouTube search.

**Architecture:** The nightly fetch adds `videos` to the existing `/tv/{id}` request; `scripts/lib/tmdb.mjs` picks one YouTube key into `live.trailer`, `merge.mjs` keeps last night's key when a night has none, and `site/lib/data.js` exposes it as `s.tr`. A new pure module `site/lib/trailer.js` holds key validation, the embed URL and the button markup; `app.js` and `views/mine.js` call it, and one `<dialog id="vdlg">` plays trailers opened from tiles.

**Tech Stack:** Vanilla ES modules (static site on GitHub Pages), Node 22 scripts, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-17-bingology-trailers-design.md`

## Global Constraints

- No extra TMDB requests: `videos` rides on the existing `append_to_response`.
- Only YouTube. Nothing loads from YouTube before a click. Embeds use `https://www.youtube-nocookie.com/embed/<key>`.
- A key is used only if it matches `/^[A-Za-z0-9_-]{11}$/` (it lands in an attribute/URL).
- Pick order: official `Trailer` → `Trailer` → `Teaser`; newest `published_at` inside each group.
- Hebrew RTL UI; series names inside `<bdi>` and through `esc()`.
- **Call made during planning (deviates from spec line "no trailer → no button"):** in the card/ticket/plan, a series with no embeddable trailer keeps today's "צפייה בטריילר" YouTube-search link, so nothing regresses. Tiles show no ▶ without a trailer, as specced.
- **Call made during planning:** in the card/ticket/plan the inline player opens in the existing trailer row (full width, 16:9), not over the small poster — the poster thumbnail is too small to watch in.
- Commit at the end of each task on `feat/trailers`. Don't push or merge.

## Review Focus

1. A key that fails validation (bad data) → no player, falls back to the search link; never injected into markup.
2. Closing the tile player (✕, Esc, backdrop) stops the sound — the iframe is removed, not just hidden.
3. A night with no videos (TMDB hiccup, `--offline` build) keeps last night's trailer.
4. A ▶ on a tile must not also open the series card (it is a sibling button, not nested in the tile button).
5. iPhone: the inline player plays in-page (`playsinline=1`), not forced full-screen.

---

### Task 1: Trailer key in the nightly data

**Files:**
- Modify: `scripts/lib/tmdb.mjs` (new `trailerOf`, used in `transformTv`'s `live`)
- Modify: `scripts/fetch-data.mjs:14,30` (`APPEND` + `include_video_language`)
- Modify: `scripts/lib/merge.mjs:2` (`SCALAR_FIELDS`)
- Modify: `site/lib/data.js` (`tr`)
- Test: `tests/tmdb.test.mjs`, `tests/merge.test.mjs`, `tests/site-data.test.mjs`

**Interfaces:**
- Produces: `trailerOf(tv) -> string | null` (exported from `scripts/lib/tmdb.mjs`); `live.trailer`; data.json field `trailer`; app series field `s.tr` (string | null).

- [ ] **Step 1: Write failing tests**
  - `trailerOf picks official trailer, then trailer, then teaser, newest first` — videos with an unofficial newer Trailer, an official older Trailer, a Teaser → official Trailer's key. Without the official one → newest Trailer. Only a Teaser → its key.
  - `trailerOf ignores non-YouTube and malformed keys` — Vimeo site, key `"bad key"` → `null`; missing `videos` → `null`.
  - `mergeEntry keeps last night's trailer` — live `{trailer: null}`, prev `{trailer: "abcdefghijk", fetchedAt}` → `"abcdefghijk"`; live key wins over prev.
  - `fromData exposes tr` — `trailer: "abcdefghijk"` → `s.tr === "abcdefghijk"`; missing → `null`.
- [ ] **Step 2: Run** `npm test` — the four new tests fail.
- [ ] **Step 3: Implement.** `trailerOf` reads `tv.videos?.results`. `APPEND` gains `,videos`; the en-US `/tv/{id}` call gains `include_video_language: "en,null"`. Add `"trailer"` to `SCALAR_FIELDS`. `fromData` adds `tr: x.trailer ?? null`.
- [ ] **Step 4: Run** `npm test` — all pass.
- [ ] **Step 5: Commit** `feat(trailers): nightly trailer key per series`.

### Task 2: Player in the card, results and "בשבילך"

**Files:**
- Create: `site/lib/trailer.js`
- Modify: `site/app.js` (`trailerHTML` at ~274, `resultHTML` alts grid at ~405, click switch), `site/views/mine.js` (`forYouHTML` tile at ~138), `site/index.html` (add `<dialog id="vdlg">`), `site/styles.css`
- Test: `tests/trailer.test.mjs`, `tests/mine.test.mjs`

**Interfaces:**
- Consumes: `s.tr` from Task 1.
- Produces (all in `site/lib/trailer.js`):
  - `validKey(k) -> boolean`
  - `embedUrl(k) -> string` = `https://www.youtube-nocookie.com/embed/${k}?autoplay=1&rel=0&playsinline=1`
  - `playerHTML(k, title) -> string` — 16:9 wrapper `<div class="tvid">` with `<iframe src=embedUrl allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="טריילר: <title>">`.
  - `tilePlayHTML(s, i) -> string` — `""` unless `validKey(s.tr)`; else `<button class="tplay" data-a="play" data-i="${i}" aria-label="טריילר: ${esc(s.n)}">▶</button>`.
  - Click action `play` (data-i) in `app.js`: opens `#vdlg` with `playerHTML` + a ✕ button (`data-a="vclose"`). Action `trail` (data-i) replaces the `.trail` row's content with `playerHTML`.

- [ ] **Step 1: Write failing tests** in `tests/trailer.test.mjs`
  - `validKey` accepts `"dQw4w9WgXcQ"`, rejects `""`, `null`, `"abc"`, `'x"onload="'` padded to 11.
  - `embedUrl` exact string for `"dQw4w9WgXcQ"`.
  - `playerHTML` contains the nocookie URL, `playsinline=1`, and an escaped title.
  - `tilePlayHTML` returns `""` for `tr: null` and for an invalid key; contains `data-a="play" data-i="3"` for a valid one.
  - In `tests/mine.test.mjs`: "בשבילך" markup contains a `.tplay` for a recommended series with `tr`, and none for one without.
- [ ] **Step 2: Run** `npm test` — new tests fail.
- [ ] **Step 3: Implement `site/lib/trailer.js`**, then wire:
  - `trailerHTML(s, i)`: valid key → `<div class="trail"><button class="tbtn" data-a="trail" data-i>` + today's ▶ icon + `צפייה בטריילר</button></div>`; otherwise today's search-link markup unchanged. Pass `i` at the three call sites (ticket, plan, series dialog).
  - Result alts and "בשבילך" tiles: wrap in a positioned container and append `tilePlayHTML` as a sibling of the tile button (never inside it). "בשבילך" already has `.fyi`.
  - `#vdlg`: `showModal()`; close on ✕, on `cancel` (Esc) and on a click on the dialog element itself (backdrop); on `close`, empty its innerHTML so playback stops.
  - CSS: `.tvid` 16:9 (`aspect-ratio: 16/9`, iframe 100%/100%, border 0, radius); `.tplay` round 36px button at the tile's top-left corner with a dark translucent background; `.tbtn` styled like today's `.trail a`; `#vdlg` wider than `#dlg` (max 720px) with a dark background.
- [ ] **Step 4: Run** `npm test` — all pass.
- [ ] **Step 5: Commit** `feat(trailers): play trailers inside the site`.

### Task 3: Check in the browser

- [ ] Copy `site/` to the scratchpad, add `trailer` keys to a few series in the copy's `data.json` (keys from a real TMDB `/tv/{id}?append_to_response=videos` call), serve it with `python3 -m http.server`.
- [ ] Check: result ticket inline player; series dialog inline player; alts ▶ opens `#vdlg`, closes with ✕ / Esc / backdrop and the sound stops; a series without a key still shows the search link; mobile width (375px) layout.
- [ ] Fix anything found (in `site/`, with a test where the bug is in `trailer.js`), commit.

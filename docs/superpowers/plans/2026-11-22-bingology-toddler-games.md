# Toddler Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A games area for the "קטנטנים" group of the kids page: a puzzle, a memory game, a sticker scene ("איפה?") and short official clips, all with characters from the toddler series in `kids.json`.

**Architecture:** The data side extends the existing pipeline. `kids.json` gets optional `art` and `yt` fields, and `scripts/fetch-kids.mjs` adds a textless TMDB backdrop, a sticker crop and up to 12 YouTube clips (refreshed weekly through the cheap `playlistItems` API) to `site/kids-data.json`. The page side adds pure modules in `site/kids/` (route, puzzle, memory, scene, clips, sound), each tested in Node. `app.js` wires them to the DOM through hash routes `#play…`.

**Tech Stack:** Node 22 (`node:test`), plain browser ESM, Pointer Events, Web Audio, YouTube IFrame postMessage API. No dependencies.

**Spec:** `docs/superpowers/specs/2026-11-22-bingology-toddler-games-design.md`

## Global Constraints
- Games exist only for age `small`. The "🎮 משחקים" button only in `small`. A `#play…` hash in another group → back to the grid.
- In `#play…` screens: no "← חזרה ל-Bingology" link, no age row. The only exit is "🏠" (at least 64px), one step back; from `#play` it goes to the grid. The TMDB credit line stays at the bottom.
- No text the child has to read. Every button has an `aria-label` in Hebrew. No "wrong", "lost", score, timer or attempt limit anywhere.
- Images are TMDB URLs only (backdrop `w780`, poster as today) plus YouTube thumbnails from `https://i.ytimg.com/vi/<id>/…`. No image files added except inline SVG scenes.
- Clips: duration **61 s – 12 min** (`61 ≤ sec ≤ 720`), `playableIn(item, "IL")`, `status.madeForKids !== false`, max **12** per series, channels in listed order (Hebrew first), up to **4** pages of 50 uploads per channel, refresh when `clipsAt` is **≥ 7 days** old or missing. YouTube failures never count toward the 20% TMDB failure threshold.
- Puzzle: **4** pieces (2×2), **6** (3×2) after **3** completed puzzles. Snap when the piece centre is within **35%** of a cell width from its cell centre.
- Memory: **3** pairs, **4** after **3** completed games. Unmatched pair closes after **1500 ms**. Hidden when fewer than 3 series have a backdrop.
- Sticker default: `{ x: 0.5, y: 0.5, r: 0.3 }`, where `r` is a fraction of the image height. Sticker diameter in the tray: 72px.
- Scenes (ids and Hebrew labels): `kitchen` מטבח, `garden` גינה, `beach` חוף, `bedroom` חדר שינה, `park` פארק.
- localStorage keys (every access in `try/catch`): `bingology:kids-mute`, `bingology:kids-level:puzzle`, `bingology:kids-level:memory`, `bingology:kids-scene:<place>`.
- Every data string goes through `esc`, every TMDB image through `safeImg`, every thumbnail through `safeThumb`.
- Every new module in `site/kids/` imports with static `from "./x.js"` strings (the deploy stamp test in `tests/kids-page.test.mjs` checks this).
- `prefers-reduced-motion`: no animations except the snap.
- Commit with `git -c user.name="achiya fried" -c user.email="achiyafried@achiyas-MacBook-Pro.local" commit`, message ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus
1. **A series with no backdrop or no clips** (TMDB has only texted images, the channel has no matching uploads): it is left out of the puzzle, the sticker tray and the clips screen, and nothing renders a broken image. → Task 1 test (`backdrop: null`), Task 5 test (home and pickers filter it out).
2. **The child leaves mid-clip and comes back, or the iframe never loads** (no `load`, blocked by an extension): the clips list still works, and a later "ended" message from a removed iframe does nothing. → Task 9 test (`onPlayerMessage` with an unknown source is a no-op).
3. **Saved state is junk** (level `"x"`, scene with stickers missing `x`, storage throws): level falls back to 0, bad stickers are dropped, the page never crashes. → Task 4 tests.
4. **A sticker dropped exactly on the scene's edge, or the scene resized after saving** (rotating the phone): positions are stored as fractions and clamped to 0–1, so stickers stay inside. → Task 8 test.
5. **Fast double taps in memory** (a third card tapped while two unmatched cards are open): it is ignored until they close. → Task 7 test.

---

### Task 1: `kids.json` art and channels: validation and backdrop/sticker mapping

**Files:**
- Modify: `scripts/lib/kids.mjs`
- Test: `tests/kids-file.test.mjs`

**Interfaces:**
- Produces: `validateKids(list)` additionally reports `row <i>: art …` and `row <i>: yt …` errors.
- Produces: `kidsArt(images, art) → { backdrop: string|null, sticker: {x,y,r} }`. `images` is TMDB's `images` object (`{ backdrops: [{ file_path, iso_639_1 }] }`), `art` the row's `art` or undefined. `backdrop = "https://image.tmdb.org/t/p/w780" + path`, where path is `art.img` if set, else the first backdrop with `iso_639_1 == null`, else `null`. `sticker` takes `art.x/y/r` over the default `{x:.5,y:.5,r:.3}`.

- [ ] **Step 1: Write failing tests** in `tests/kids-file.test.mjs`:
  - `validateKids accepts art and yt`: `{tmdb:1,age:"small",art:{img:"/a.jpg",x:.4,y:.5,r:.2},yt:[{channel:"UC"+"a".repeat(22)},{channel:"UC"+"b".repeat(22),match:"Bluey"}]}` → `[]`.
  - `validateKids rejects bad art`: `art:{x:1.2}` /art/, `art:{img:"a.jpg"}` /art/, `art:{img:"/a.gif"}` /art/, `art:"x"` /art/.
  - `validateKids rejects bad yt`: `yt:[]` /yt/, four channels /yt/, the same channel twice /yt/, `channel:"UCshort"` /yt/, `match:""` /yt/, `yt:{channel:…}` (not an array) /yt/.
  - `kidsArt prefers the hand-picked image`: `art.img:"/h.jpg"` → backdrop ends `/w780/h.jpg`.
  - `kidsArt picks the first textless backdrop`: backdrops `[{file_path:"/en.jpg",iso_639_1:"en"},{file_path:"/n.jpg",iso_639_1:null}]` → `/w780/n.jpg`.
  - `kidsArt with only texted backdrops` → `backdrop: null`; with `images` undefined → `backdrop: null`.
  - `kidsArt sticker defaults`: no art → `{x:.5,y:.5,r:.3}`; `art:{y:.4}` → `{x:.5,y:.4,r:.3}`.
- [ ] **Step 2:** `node --test tests/kids-file.test.mjs` → FAIL.
- [ ] **Step 3:** Implement in `scripts/lib/kids.mjs`. `art.img` must match `/^\/[\w.-]+\.(jpg|png)$/`. `x/y/r` must be numbers in `[0,1]`. `channel` must match `/^UC[\w-]{22}$/`. `yt` is an array of 1–3 objects with distinct channels.
- [ ] **Step 4:** `npm test` → all pass.
- [ ] **Step 5:** Commit `feat(kids): art and yt fields in kids.json`.

### Task 2: YouTube clips from a channel's uploads

**Files:**
- Modify: `scripts/lib/youtube.mjs`
- Test: `tests/kids-clips.test.mjs`

**Interfaces:**
- Consumes: `playableIn(item, region)` (existing), `cleanKey` from `./api.mjs`.
- Produces: `uploadsId(channel) → string` (`"UC…"` → `"UU…"`).
- Produces: `isoSeconds(iso) → number` (`"PT7M3S"` → 423, `"PT1H"` → 3600, junk → 0).
- Produces: `clipOk(item, region="IL") → boolean`: `playableIn` && `61 ≤ isoSeconds(contentDetails.duration) ≤ 720` && `status.madeForKids !== false`.
- Produces: `seriesClips(yt, { key, fetchImpl=fetch, region="IL", max=12, pages=4 }) → Promise<[{ id, title, thumb, sec }]>`. For each channel in order: page `playlistItems` (`part=snippet`, `maxResults=50`, `playlistId=uploadsId`, `pageToken`), keep titles matching `match` (whole word, case-insensitive, using the existing `norm`), then `videos.list` (`part=status,contentDetails`) on the kept ids, keep `clipOk`, and stop when `max` is reached or pages run out. `thumb = "https://i.ytimg.com/vi/<id>/mqdefault.jpg"`. Throws on HTTP errors.

- [ ] **Step 1: Write failing tests** in `tests/kids-clips.test.mjs`, with a fake `fetchImpl` that serves `playlistItems` pages (with `nextPageToken`) and `videos`:
  - `uploadsId swaps the prefix`, `isoSeconds parses and rejects junk`.
  - `clipOk keeps 61s–12min only`: 60 s false, 61 s true, 720 s true, 721 s false; `madeForKids:false` false; `embeddable:false` false.
  - `seriesClips fills from the first channel before the second`: channel A yields 12 good → B is never requested (assert on the fake's call log).
  - `seriesClips tops up from the second channel`: A yields 2 → result is A's 2 then B's, length ≤ 12.
  - `seriesClips filters by match`: titles "Bluey | Fruit Bat" and "Peppa Pig | Muddy" with `match:"Bluey"` → only the first is sent to `videos.list`.
  - `seriesClips stops after 4 pages`: endless `nextPageToken` → exactly 4 `playlistItems` calls.
  - `seriesClips throws on HTTP 403`.
- [ ] **Step 2:** `node --test tests/kids-clips.test.mjs` → FAIL.
- [ ] **Step 3:** Implement in `scripts/lib/youtube.mjs`.
- [ ] **Step 4:** `npm test` → all pass.
- [ ] **Step 5:** Commit `feat(kids): clips from official YouTube channels`.

### Task 3: `fetch-kids` adds backdrops, stickers and weekly clips

**Files:**
- Modify: `scripts/fetch-kids.mjs`, `.github/workflows/update-data.yml` (add `YOUTUBE_KEY: ${{ secrets.YOUTUBE_KEY }}` to the "Fetch kids section" step's `env`)
- Test: `tests/kids-fetch.test.mjs`

**Interfaces:**
- Consumes: `kidsArt` (Task 1), `seriesClips` (Task 2).
- Produces: `run({ rows, prev, fetchImpl, now, map, youtubeKey = null, clipsImpl = seriesClips })`. Each item gains `backdrop`, `sticker`, and, for rows with `yt`, `clips` and `clipsAt`. The en-US request appends `images` with `include_image_language=null`.

- [ ] **Step 1: Write failing tests** in `tests/kids-fetch.test.mjs`:
  - `adds backdrop and sticker`: the fake show has `images.backdrops:[{file_path:"/b.jpg",iso_639_1:null}]` → item `backdrop` ends `/w780/b.jpg`, `sticker` the default.
  - `fetches clips when clipsAt is missing`: row with `yt`, `youtubeKey:"k"`, `clipsImpl` returns `[{id:"aaaaaaaaaaa",…}]` → `clips` length 1, `clipsAt === now`.
  - `keeps last week's clips when fresh`: prev `clipsAt` 3 days before `now` → `clipsImpl` not called and `clips` carried over.
  - `refreshes after 7 days`: prev `clipsAt` exactly 7 days before → called.
  - `no key keeps previous clips`: `youtubeKey:null` → not called, prev `clips`/`clipsAt` kept.
  - `YouTube failure keeps previous clips, warns, and is not a failure`: `clipsImpl` throws → prev clips kept, a warning containing the tmdb id, `failed === 0`, `abort === false`.
  - `warns about a series with no clips`: `clipsImpl` returns `[]` → warning matching `/no clips/`.
  - `a TMDB-failed series keeps its previous clips` (carried with the rest of the prev item).
- [ ] **Step 2:** `node --test tests/kids-fetch.test.mjs` → FAIL.
- [ ] **Step 3:** Implement. Clips run after the TMDB pool, one series at a time (no concurrency needed). `main()` passes `youtubeKey: process.env.YOUTUBE_KEY || null`.
- [ ] **Step 4:** `npm test` → all pass.
- [ ] **Step 5:** Commit `feat(kids): nightly backdrops, stickers and weekly clips`.

### Task 4: Shared page helpers: thumbnails, sticker geometry, storage, sound

**Files:**
- Modify: `site/lib/esc.js` (add `safeThumb`), `site/kids/store.js`
- Create: `site/kids/art.js`, `site/kids/sound.js`
- Test: `tests/kids-art.test.mjs`, `tests/kids-game.test.mjs` (store tests)

**Interfaces:**
- Produces: `safeThumb(u) → string|null`, accepting only `/^https:\/\/i\.ytimg\.com\/vi\/[A-Za-z0-9_-]{11}\/\w+\.jpg$/`.
- Produces (`art.js`): `stickerStyle(sticker, size, aspect = 16/9) → string`. It returns CSS for a `size`-px circle showing that region: `background-size` so that `2r × imageHeight = size`, and `background-position` centring `(x, y)`. `withArt(items) → items` keeps `small` items with a `safeImg(backdrop)`.
- Produces (`store.js`): `loadLevel(storage, game) → number` (non-negative integer, else 0), `bumpLevel(storage, game)`, `loadMute(storage) → boolean`, `saveMute(storage, on)`, `loadScene(storage, place) → [{tmdb,x,y}]` (drops entries with a non-integer tmdb or x/y outside 0–1), `saveScene(storage, place, list)`, `clearScene(storage, place)`.
- Produces (`sound.js`): `makeSound(isMuted: () => boolean) → { snap(), pair(), win() }`. It uses Web Audio short tones, creates the `AudioContext` lazily on the first call, and does nothing when muted or when `AudioContext` is missing.

- [ ] **Step 1: Write failing tests:**
  - `safeThumb` accepts `https://i.ytimg.com/vi/aaaaaaaaaaa/mqdefault.jpg` and rejects `http:`, other hosts, `javascript:` and a 10-character id.
  - `stickerStyle` for `{x:.5,y:.5,r:.25}`, size 72 → `background-size` height 144px (72/(2·.25)) and width 256px (144·16/9), and a centring position (assert the exact numbers).
  - `withArt` drops a `mid` item, an item with `backdrop:null`, and one with a non-TMDB URL.
  - store: `loadLevel` with `"x"` / `-1` / a throwing storage → 0; `bumpLevel` twice → 2; `loadScene` drops `{tmdb:1,x:2,y:.5}` and `{tmdb:"a",x:.1,y:.1}`; a throwing storage → `[]`.
  - `makeSound` with `isMuted = () => true` never constructs an `AudioContext` (stub `globalThis.AudioContext` with a counter).
- [ ] **Step 2:** Run the two test files → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → all pass.
- [ ] **Step 5:** Commit `feat(kids): thumbnails, sticker geometry, game storage and sound`.

### Task 5: The games shell: routes, home screen, page wiring

**Files:**
- Create: `site/kids/play.js`
- Modify: `site/kids/app.js`, `site/kids/view.js` (`headerHTML(age)` adds the "🎮 משחקים" button `data-a="play"` only when `age === "small"`), `site/kids/kids.css`
- Test: `tests/kids-play.test.mjs`

**Interfaces:**
- Consumes: `withArt`, `loadMute`/`saveMute`, `makeSound`.
- Produces: `parseRoute(hash) → { game: null|"home"|"puzzle"|"memory"|"scene"|"clips", arg: string|null }`. `""`/`"#game"` → `game:null`; `"#play"` → `home`; `"#play/puzzle/82728"` → `{game:"puzzle",arg:"82728"}`; an unknown game → `home`.
- Produces: `backHash(route) → string` (`puzzle` with arg → `#play/puzzle`; `puzzle` without arg → `#play`; `home` → `""`).
- Produces: `shellHTML(inner, { muted }) → string`: the 🏠 button `data-a="home"` (`aria-label="חזרה"`), the mute button `data-a="mute"` (`aria-label` "השתקה"/"הפעלת צליל"), `inner`, and the TMDB credit. No back link, no age row.
- Produces: `homeHTML(items) → string`: four tiles `data-a="go" data-v="puzzle|memory|scene|clips"` with `aria-label` פאזל / זיכרון / איפה? / קליפים. The memory tile only when `withArt(items).length >= 3`, the clips tile only when some small item has `clips.length`.
- Produces in `app.js`: `render()` checks `parseRoute(location.hash)`. When `game` is set and `st.age !== "small"`, it replaces the hash with the grid. Otherwise it renders `shellHTML(...)` with the game's view (Tasks 6–9 plug in their `…HTML` and handlers).

- [ ] **Step 1: Write failing tests** in `tests/kids-play.test.mjs`:
  - `parseRoute` for the cases above, plus `"#play/nope"` → `home`.
  - `backHash` for each level.
  - `headerHTML("small")` contains `data-a="play"`; `headerHTML("mid")` does not.
  - `shellHTML` contains `data-a="home"` and the TMDB credit, and does not contain `k-back` or `k-ages`.
  - `homeHTML`: 2 series with art → no memory tile; 3 → memory tile; no clips anywhere → no clips tile.
  - All tiles and buttons have an `aria-label`.
- [ ] **Step 2:** `node --test tests/kids-play.test.mjs` → FAIL.
- [ ] **Step 3:** Implement and wire. CSS: tiles in two columns, `min-height: 140px`, yellow `--g`; `#play` screens set `touch-action: none` on the play area only.
- [ ] **Step 4:** `npm test` → all pass. Manual check in the browser: open `site/kids.html` with a local static server (`npx serve site` or `python3 -m http.server -d site`). Choose קטנטנים → 🎮 → the four tiles show; 🏠 goes back to the grid; switching to ילדים hides 🎮; opening `kids.html#play` in ילדים lands on the grid.
- [ ] **Step 5:** Commit `feat(kids): toddler games shell`.

### Task 6: 🧩 Puzzle

**Files:**
- Create: `site/kids/puzzle.js`
- Modify: `site/kids/app.js` (drag wiring), `site/kids/kids.css`
- Test: `tests/kids-puzzle.test.mjs`

**Interfaces:**
- Consumes: `withArt`, `loadLevel`/`bumpLevel(storage,"puzzle")`, `makeSound`, `parseRoute`.
- Produces: `grid(level) → { cols, rows }`: `level < 3` → `{2,2}`, else `{3,2}`.
- Produces: `initPuzzle(tmdb, level, rnd = Math.random) → { tmdb, cols, rows, placed: boolean[], tray: number[] }`, where `tray` is a shuffled list of piece indexes (never already in solved order when n > 1).
- Produces: `trySnap(state, piece, cx, cy, board: {w,h}) → state`. `cx, cy` are the piece centre in board pixels. It sets `placed[piece]` when the distance to its cell centre is `≤ 0.35 × (board.w / cols)`, and otherwise returns the state unchanged.
- Produces: `solved(state) → boolean`.
- Produces: `pickerHTML(items)` (posters of `withArt` items, `data-a="go" data-v="puzzle/<tmdb>"`) and `puzzleHTML(item, state)`. The board is the backdrop with `filter: grayscale(1); opacity: .35`, each placed cell shows its slice in colour, and tray pieces are `div`s with the backdrop as `background` and `background-position` of their cell. When solved: confetti, "🔁" `data-a="again"` and "🏠".

- [ ] **Step 1: Write failing tests:**
  - `grid` at levels 0, 2, 3, 9.
  - `initPuzzle` has `cols·rows` pieces, all unplaced, and the tray is a permutation that is not identity (seeded `rnd`).
  - `trySnap` places a piece dropped at 0.34 × cell width from its centre and leaves it unplaced at 0.36 ×. A piece dropped on another piece's cell stays unplaced.
  - `solved` true only when every piece is placed.
  - `puzzleHTML` passes the backdrop through `safeImg` (a non-TMDB backdrop renders no image) and shows the again button only when solved.
- [ ] **Step 2:** `node --test tests/kids-puzzle.test.mjs` → FAIL.
- [ ] **Step 3:** Implement. Drag in `app.js`: `pointerdown` on a tray piece → `setPointerCapture`, move with `transform`, and `pointerup` → `trySnap` with coordinates relative to the board's `getBoundingClientRect()`. If it snapped: `sound.snap()`. If not: animate back. When solved: `bumpLevel` once, then `sound.win()`.
- [ ] **Step 4:** `npm test` → all pass. Manual check: finish a puzzle by mouse and by touch emulation (built-in browser, mobile preset). The 4th puzzle has 6 pieces.
- [ ] **Step 5:** Commit `feat(kids): toddler puzzle`.

### Task 7: 🃏 Memory

**Files:**
- Create: `site/kids/memory.js`
- Modify: `site/kids/app.js`, `site/kids/kids.css`
- Test: `tests/kids-memory.test.mjs`

**Interfaces:**
- Consumes: `withArt`, `stickerStyle`, `loadLevel`/`bumpLevel(storage,"memory")`, `makeSound`.
- Produces: `pairsFor(level) → 3|4` (`level < 3` → 3).
- Produces: `deal(items, pairs, rnd = Math.random) → { cards: [{ tmdb, open: false, matched: false }], busy: false }`: `pairs` distinct series, each twice, shuffled. With fewer series than `pairs`, it uses as many as exist.
- Produces: `flip(state, i) → state`. It ignores a matched or open card and any tap while `busy`. When the second open card matches, both become `matched`. When it doesn't, `busy: true`.
- Produces: `settle(state) → state`: closes the unmatched open cards and sets `busy: false`. `app.js` calls it after **1500 ms**.
- Produces: `won(state) → boolean`, `memoryHTML(state, items)`. The card face is the sticker circle and the back is coloured with ❓. Each card has `aria-label` "קלף" or the series name once open.

- [ ] **Step 1: Write failing tests:**
  - `deal(…, 3)` → 6 cards, each tmdb exactly twice, 3 distinct series. With 2 series available → 4 cards.
  - `flip` a match → both `matched`. A non-match → `busy`, and a third `flip` while busy returns the same state. `settle` closes them.
  - `flip` on a matched card is a no-op.
  - `won` after all pairs.
  - `pairsFor(0) === 3`, `pairsFor(3) === 4`.
- [ ] **Step 2:** `node --test tests/kids-memory.test.mjs` → FAIL.
- [ ] **Step 3:** Implement and wire (a `setTimeout(settle, 1500)` cleared on route change; `sound.pair()` on a match; `bumpLevel` and `sound.win()` on a win).
- [ ] **Step 4:** `npm test` → all pass. Manual check: play a full game. Tapping fast on a third card does nothing.
- [ ] **Step 5:** Commit `feat(kids): toddler memory game`.

### Task 8: 🏠 Sticker scenes

**Files:**
- Create: `site/kids/scene.js`, `site/kids/scenes.js` (the five inline SVG backgrounds: `export const SCENES = [{ id, label, svg }]`, with `viewBox="0 0 1600 900"`, no `<text>`)
- Modify: `site/kids/app.js`, `site/kids/kids.css`
- Test: `tests/kids-scene.test.mjs`

**Interfaces:**
- Consumes: `withArt`, `stickerStyle`, `loadScene`/`saveScene`/`clearScene`.
- Produces: `addSticker(list, tmdb, x, y) → list`, `moveSticker(list, i, x, y) → list`, `removeSticker(list, i) → list`. `x, y` are fractions of the scene size, clamped to `[0,1]`.
- Produces: `outside(x, y) → boolean` (true when the drop fraction is outside `[0,1]` on either axis, which means remove).
- Produces: `placesHTML()` (five tiles `data-a="go" data-v="scene/<id>"` with the scaled SVG and `aria-label` = label) and `sceneHTML(place, list, items)`: the SVG, absolutely positioned stickers (`left: x·100%`, `top: y·100%`, centred), a horizontally scrolling tray of every `withArt` sticker, and "🧽" `data-a="clear"`, which shows "לנקות?" with ✓ `data-a="clear-yes"` / ✕ `data-a="clear-no"`.

- [ ] **Step 1: Write failing tests:**
  - `addSticker` clamps `(1.2, -0.1)` to `(1, 0)`. The same tmdb may be added twice.
  - `moveSticker` and `removeSticker` by index. Out-of-range indexes are a no-op.
  - `outside(1.01, .5)` true, `outside(1, 1)` false.
  - `SCENES` has exactly the ids `kitchen, garden, beach, bedroom, park`, and no SVG contains `<text` or `<script`.
  - `sceneHTML` renders one element per saved sticker and the tray only from `withArt` items.
- [ ] **Step 2:** `node --test tests/kids-scene.test.mjs` → FAIL.
- [ ] **Step 3:** Draw the five scenes (simple flat shapes in the section's palette: a kitchen with a counter and fridge, a garden with grass and flowers, a beach with sea and sand, a bedroom with a bed and window, a park with trees and a slide). Implement and wire the drag: from the tray → clone, `pointerup` inside the scene → `addSticker`. From the scene → `moveSticker`, or `removeSticker` when `outside`. `saveScene` after every change.
- [ ] **Step 4:** `npm test` → all pass. Manual check: stickers stay after a reload, rotating the emulated phone keeps them inside, and 🧽 → ✓ empties the room.
- [ ] **Step 5:** Commit `feat(kids): sticker scenes`.

### Task 9: 📺 Clips

**Files:**
- Create: `site/kids/clips.js`
- Modify: `site/kids/app.js`, `site/kids/kids.css`
- Test: `tests/kids-clips-page.test.mjs`

**Interfaces:**
- Consumes: `embedUrl`, `validKey`, `YT_ORIGINS`, `ytErrorCode` from `site/lib/trailer.js`; `safeThumb`, `stickerStyle`.
- Produces: `ytState(data) → number|null`: the `info` of an `{"event":"onStateChange","info":n}` message (string or object), else `null`.
- Produces: `withClips(items) → items` (small items with at least one clip whose id passes `validKey`).
- Produces: `nextIndex(clips, i) → number` (wraps to 0).
- Produces: `clipsPickerHTML(items)`, `clipListHTML(item)` (thumbnails in two columns, `data-a="clip" data-v="<i>"`, `aria-label` = clip title), `playerBoxHTML(item, i, origin)` (the iframe from `embedUrl(id, origin)` inside `.k-player`) and `endedHTML(item, i)` (the clip thumbnail, "🔁" `data-a="clip" data-v="<i>"` and "⏭" `data-a="clip" data-v="<next>"`).
- Produces in `app.js`: after inserting the iframe, the IFrame API handshake (as `watchPlayer` in `site/app.js`) subscribes to both `onStateChange` and `onError`. A `message` handler with origin in `YT_ORIGINS` and a source equal to the current iframe's `contentWindow`: `ytState === 0` → replace the box with `endedHTML`; `ytErrorCode !== null` → play `nextIndex`. Any other source is ignored.

- [ ] **Step 1: Write failing tests:**
  - `ytState` for `'{"event":"onStateChange","info":0}'`, an object form, an `onError` message (→ null) and junk (→ null).
  - `withClips` drops items with `clips: []` or only invalid ids.
  - `nextIndex([a,b,c], 2) === 0`.
  - `clipListHTML` uses `safeThumb` (a non-ytimg thumb renders no `<img>`) and escapes titles in `aria-label`.
  - `playerBoxHTML` with an invalid id → `""`. A valid id → contains `youtube-nocookie.com/embed/` and `rel=0`.
  - `endedHTML` contains both buttons and no iframe.
- [ ] **Step 2:** `node --test tests/kids-clips-page.test.mjs` → FAIL.
- [ ] **Step 3:** Implement and wire.
- [ ] **Step 4:** `npm test` → all pass. Manual check (needs Task 10's data): play a clip to its end. Our ended screen appears, never YouTube's suggestions. ⏭ plays the next clip.
- [ ] **Step 5:** Commit `feat(kids): official clips with our own end screen`.

### Task 10: Fill the data and ship

**Files:**
- Modify: `kids.json` (art and yt for the 32 `small` rows), `site/kids-data.json` (regenerated), `README.md` (a short paragraph on the toddler games and the new `kids.json` fields)

- [ ] **Step 1:** For each `small` row, pick a textless backdrop that shows the main character clearly (TMDB `/tv/{id}/images?include_image_language=null`) and set `art.img`, plus `x/y/r` so the circle frames the character's face. Check by rendering the sticker locally.
- [ ] **Step 2:** For each `small` row, find the official YouTube channels. First an official Hebrew-dubbed channel if one exists, then the English one. Add `match` for shared channels (Disney Junior, Nick Jr.). Leave out `yt` when there is no official channel.
- [ ] **Step 3:** `npm test` → all pass (validation covers the new fields).
- [ ] **Step 4:** `node scripts/fetch-kids.mjs` with `.env` holding `TMDB_TOKEN` and `YOUTUBE_KEY`. Read the warnings and fix series with no backdrop or no clips (another image or channel), then run it again.
- [ ] **Step 5:** Full manual pass in the built-in browser, mobile preset: all four games, mute, 🏠 everywhere, and the age guard. Check that the main Bingology page is unchanged.
- [ ] **Step 6:** Commit `feat(kids): toddler art and channels, first data`.

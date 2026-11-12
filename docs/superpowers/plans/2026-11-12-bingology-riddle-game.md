# Riddle Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sixth daily game, "חידת היגיון" 🧠: a hand-written cryptic clue whose answer is a series' Hebrew title, solved by filling letters into boxes.

**Architecture:**
- Riddles live in `riddles.json` at the repo root.
- Each night, after the existing day files are created, `make-games` writes the next unused riddle into each of the next 8 day files that lacks one.
- The site gets a pure game module (`site/lib/games/riddle.js`) like the other five, plus a letter-box screen in `site/views/games.js`.

**Tech Stack:** Vanilla ES modules, `node --test`, no dependencies.

**Spec:** `docs/superpowers/specs/2026-11-12-bingology-riddle-game-design.md`

## Global Constraints

- Game entry: `{ id: "riddle", name: "חידת היגיון", icon: "🧠" }`, appended last in `GAMES`.
- `riddles.json` row fields:
  - `clue` (required)
  - `answer` (required): Hebrew letters and spaces only.
  - `tmdbId` (required): must exist in `site/data.json`.
  - `explain` (optional)
  - `date` (optional): `YYYY-MM-DD`.
- Riddle key: `` `${tmdbId}:${answer}` ``. The day file stores it in `used.riddles`.
- Day-file puzzle: `games.riddle = { clue, answer, words: number[], tmdbId, explain }`. `words` holds the letters per word of `answer`.
- Final letters equal regular ones: ך=כ, ם=מ, ן=נ, ף=פ, ץ=צ. Comparison uses letters only.
- Hints reveal the next correct letter and lock it. At most `n - 1` hints, where `n` is the number of letters.
- Result labels:
  - Win with 0 hints: `"✓"`.
  - Win with 1 hint: `"רמז 1"`.
  - Win with N hints: `"N רמזים"`.
  - Reveal: `"✗"`.
  - The score is the number of hints.
- Window: today … today+7. A day that already has `games.riddle` is never changed.
- Empty bank: log a warning `make-games: no riddle for DATE` and leave the day without a riddle.
- If `riddles.json` is missing or invalid at night: warn, skip the riddle step, and keep making the other games.
- Strings shown in the UI:
  - Buttons: "בדיקה", "רמז", "גילוי התשובה".
  - Wrong answer: "לא בדיוק, נסו שוב".
- Git identity for commits: `git -c user.name="achiya fried" -c user.email="achiyafried@achiyas-MacBook-Pro.local"`.

## Review Focus

- **Hebrew typed with final forms, or with spaces or geresh pasted in.** "הנותרימ" counts as correct, and pasted spaces are ignored. Tested in Task 1.
- **Keyboard on a phone.** Tapping the boxes opens the keyboard, and Backspace on an empty hidden input still deletes. Tested in Task 3 by a view test that checks `inputmode`/focus target, and in the browser.
- **Two riddles pinned to the same date, or a pinned date already in the past.** The test fails on duplicate dates. A past date is never assigned, and the riddle is not used in the queue either. Tested in Task 2.
- **A riddle whose series later leaves `data.json`.** It still plays, with no series button. Tested in Task 3.
- **A stored state from an old or hand-edited `localStorage`.** It starts over instead of breaking. Covered by `SHAPE.riddle` in Task 3.

---

### Task 1: Riddle game logic

**Files:**
- Create: `site/lib/games/riddle.js`
- Test: `tests/games-play-riddle.test.mjs`

**Interfaces:**
- Produces:
  - `letters(str: string) -> string[]`: Hebrew letters only, final forms normalized.
  - `init(puzzle) -> State`.
  - `play(state, puzzle, move) -> State`: returns the same object when nothing changes.
  - `result(state, puzzle) -> { done, win, score, label }`.
- `State = { letters: string[], hints: number, tries: number, done: boolean, gaveUp: boolean, last?: "wrong" }`.
- Moves:
  - `{ type: "type", ch }`
  - `{ type: "del" }`
  - `{ type: "check" }`
  - `{ type: "hint" }`
  - `{ type: "reveal" }`

- [ ] **Step 1: Write the failing tests** (puzzle `{ clue: "…", answer: "הנותרים", words: [7], tmdbId: 54344 }`)

```js
test("letters normalizes finals and drops non-letters", () => {
  assert.deepEqual(letters("הנותרים"), ["ה","נ","ו","ת","ר","י","מ"]);
  assert.deepEqual(letters(" ה'נותרימ "), letters("הנותרים"));
});
test("typing fills up to the answer length; non-Hebrew is ignored", () => { /* 8 types → 7 letters; {ch:"a"} → same state */ });
test("del removes the last typed letter but never a hinted one", () => { /* hint then del → letters.length stays 1 */ });
test("check: full and correct wins; full and wrong counts a try and sets last='wrong'; not full does nothing", () => {});
test("typing 'הנותרימ' (final mem typed as regular) wins", () => {});
test("hint reveals the next correct letter, drops letters after it, stops at n-1", () => { /* 7 letters → 6 hints max, 7th hint returns same state */ });
test("reveal ends without a win; moves after done are ignored", () => {});
test("labels", () => {
  // win, no hints → { done: true, win: true, score: 0, label: "✓" }
  // win, 1 hint → "רמז 1"; win, 3 hints → "3 רמזים"; reveal → { done: true, win: false, score: null, label: "✗" }
});
```

- [ ] **Step 2:** Run `node --test tests/games-play-riddle.test.mjs`. Expected: FAIL, because the module is not found.
- [ ] **Step 3:** Implement `site/lib/games/riddle.js` with the interfaces above. The answer's letters come from `letters(puzzle.answer)`. `type` accepts one Hebrew letter (`/^[א-ת]$/`), normalized. A hint sets `letters = answer.slice(0, hints + 1)`.
- [ ] **Step 4:** Run `node --test tests/games-play-riddle.test.mjs`. Expected: all pass.
- [ ] **Step 5:** Commit: `feat(games): riddle game logic`.

---

### Task 2: Riddle bank and nightly assignment

**Files:**
- Create: `scripts/lib/games/riddles.mjs`
- Create: `riddles.json`, seeded with the spec's example: `{ "clue": "הוא נשאר בתוך הים אז הם שרדו", "answer": "הנותרים", "tmdbId": 54344, "explain": "נותר = נשאר, בתוך ה+ים" }`
- Modify: `scripts/make-games.mjs`, which calls the assignment after `makeDays`.
- Test: `tests/games-riddles.test.mjs` (unit) and `tests/riddles-file.test.mjs` (the real file)

**Interfaces:**
- Consumes: `letters` from Task 1 (`site/lib/games/riddle.js`), and `addDays` from `site/lib/games/day.js`.
- Produces:
  - `riddleKey(r) -> string`.
  - `toPuzzle(r) -> { clue, answer, words, tmdbId, explain }`. `explain` is omitted when there is none.
  - `validateRiddles(list, ids: Set<number>) -> string[]`: error messages, empty when the file is valid.
  - `assignRiddles({ riddles, dir, today, days = 8, log = console }) -> { assigned: { [date]: key }, empty: string[] }`.

- [ ] **Step 1: Write the failing unit tests**

```js
test("validateRiddles flags missing fields, non-Hebrew answers, unknown tmdbId, duplicate keys, duplicate or malformed dates", () => {
  // each case → errors.length > 0 and the message names the row index; the seed row → []
});
test("toPuzzle computes words per word of the answer", () => {
  assert.deepEqual(toPuzzle({ clue: "c", answer: "שובר שורות", tmdbId: 1396 }).words, [4, 4]);
});
test("assigns the next unused riddle, in file order, to each day without one", () => {});
test("a dated riddle goes to its date and is skipped by the queue", () => {});
test("a day that already has a riddle is left byte-identical", () => {});
test("riddles already in used.riddles of any existing file are not assigned again", () => {});
test("a dated riddle whose date is before today is never assigned", () => {});
test("empty bank: day keeps its other games, a warning names the date", () => {});
```

In the tests, build temp day files with `fs.mkdtempSync` and write minimal days such as `{ date, v: 1, used: {}, games: { guess: {...} } }`.

- [ ] **Step 2: Write the file test** `tests/riddles-file.test.mjs`. It runs `validateRiddles(JSON.parse(riddles.json), new Set(data.series.map(s => s.tmdbId)))` and asserts the result is `[]`.
- [ ] **Step 3:** Run `node --test tests/games-riddles.test.mjs tests/riddles-file.test.mjs`. Expected: FAIL.
- [ ] **Step 4:** Implement `riddles.mjs`. In `assignRiddles`:
  - Collect the used keys from every `*.json` file in `dir`.
  - For each date in the window that has no `games.riddle`, pick first the dated riddle for that date, then the first undated unused riddle.
  - Write `games.riddle` and add the key to `used.riddles`.
  - Log the warning for every date that gets nothing.
- [ ] **Step 5:** Wire it in `scripts/make-games.mjs`:
  - Read `riddles.json`. If it is missing or has validation errors, log `make-games: riddles skipped: …` and stop the riddle step.
  - Otherwise call `assignRiddles` and log `make-games: riddles assigned N`.
- [ ] **Step 6:** Run `npm test`. Expected: all pass.
- [ ] **Step 7:** Commit: `feat(games): riddle bank and nightly assignment`.

---

### Task 3: Site registration and letter-box screen

**Files:**
- Modify: `site/lib/games/day.js`, which appends the riddle entry to `GAMES`.
- Modify: `scripts/lib/games/make.mjs`:
  - In `buildDay`, skip a `GAMES` id that has no generator (`if (!gens[id]) continue;`).
  - In `makeDays`, leave the riddle out of the `missing` list.
- Modify: `site/views/games.js`:
  - Register `riddle` in `LOGIC`, `SHAPE` and `SCREEN`.
  - Add the `howHTML` text "פתרו את החידה. התשובה היא שם של סדרה. כל רמז חושף אות."
  - Add `riddleHTML(p, s, x)` and the click and key handlers.
- Modify: `site/styles.css`, which adds the boxes, the hinted-box color and the shake animation.
- Tests:
  - Modify `tests/games-pool.test.mjs`, where the expected `GAMES` ids gain `"riddle"`.
  - Modify `tests/games-make.test.mjs:30`, which compares only against the generated ids (`GAMES` minus `riddle`).
  - Modify `tests/games-share.test.mjs`, adding the line `🧠 ✓`.
  - Modify `tests/games-view.test.mjs`, adding the `riddleHTML` cases.

**Interfaces:**
- Consumes: `init`, `play` and `result` from Task 1, and the `games.riddle` puzzle shape from Task 2.
- Produces: `export function riddleHTML(p, s, x = {}) -> string` in `site/views/games.js`.
- `SHAPE.riddle = s => Array.isArray(s.letters) && Number.isInteger(s.hints) && Number.isInteger(s.tries)`.

- [ ] **Step 1: Write the failing view tests**

```js
test("riddleHTML: clue, one box per letter grouped by word, hidden input for the keyboard", () => {
  // p.words [4,4] → two .g-word groups of 4 .g-box; an <input id="gr" inputmode="text" autocomplete="off"> exists
});
test("riddleHTML: hinted boxes carry .hint; check is disabled until all boxes are full", () => {});
test("riddleHTML: last='wrong' shows 'לא בדיוק, נסו שוב' and the .shake class", () => {});
test("riddleHTML done: answer, explain, series button only when hasSeries(tmdbId)", () => {});
test("shareText prints 🧠 last when the riddle is in the results", () => {});
```

- [ ] **Step 2:** Run `npm test`. Expected: the new tests fail, and `games-pool` fails on the ids.
- [ ] **Step 3: Implement the screen.**
  - The boxes are buttons (`data-rfocus`) that focus the hidden `#gr`.
  - `onInput` for `#gr`: run `move({ type: "type", ch })` for each character, clear the field, then repaint and refocus.
  - `onKey` for `#gr`: `Backspace` sends `del`, and `Enter` sends `check`.
  - Buttons: `data-rcheck`, `data-rhint` and `data-rreveal`. The first click on reveal sets `ui.sure = true` and shows "בטוחים? לגלות" in place of the button. The second click sends `reveal`.
  - The end screen reuses the existing `seriesBtn(p.tmdbId, x.hasSeries)`.
  - `aria-label` on the box row: `"N אותיות, הוזנו: …"`. The result message goes in an `aria-live="polite"` element.
- [ ] **Step 4: Update the GAMES-dependent tests** listed above, then run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit: `feat(games): riddle screen`.

---

### Task 4: End-to-end check and PR

- [ ] **Step 1:** Run `node scripts/make-games.mjs`. Expected: `riddles assigned 1`, and the seed riddle lands in the first day file in the window that has no riddle.
- [ ] **Step 2:** Serve `site/` in the browser preview, open `#games`, and play the riddle at mobile size (375) and at desktop size:
  - Type with a final letter.
  - Delete with Backspace.
  - Make a wrong check, then take a hint.
  - Solve it, then check the series button.
  - Reload and confirm the state is kept.
  - Clear the game's `localStorage` key, then test "גילוי התשובה" including its confirmation step.
- [ ] **Step 3:** Revert the generated day files with `git checkout site/games`; the nightly run assigns riddles, and committing day files by hand would conflict with it. Push `feat/riddle-game` and give the user the PR link.

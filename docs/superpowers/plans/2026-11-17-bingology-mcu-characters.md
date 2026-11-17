# דמויות באזור ה-MCU — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "דמויות" tab in the MCU zone: a poster grid of ~40 main characters, each opening its path on the timeline with shared seen marks.

**Architecture:** Hand-written `mcu-characters.json` (TMDB person ids + a character-name regex + a poster item). `fetch-mcu` adds cast per item and computes each character's appearances into `mcu-data.json.characters`. The page gets tabs and a hash route (`#chars`, `#char/<id>`); logic in `site/mcu/characters.js`, markup in `site/mcu/view.js`.

**Tech Stack:** as the MCU zone (vanilla ES modules, Node 22, TMDB v3, `node --test`).

**Spec:** `docs/superpowers/specs/2026-11-17-bingology-mcu-characters-design.md`

## Global Constraints
- Character row: `{ id, he, en, people: number[], match: string (case-insensitive regex), poster: "<mcu.json id>" }`; `id` is `[a-z0-9-]+` and never changes (it is in URLs).
- An appearance counts when a cast member's TMDB person id is in `people` AND their character string matches `match`. "(uncredited)" in the character string → `cameo: true`.
- Movies: `/movie/{id}` `append_to_response` gains `credits`. Seasons: one extra request `/tv/{id}/season/{n}/aggregate_credits` (character = `roles[].character` joined by " / ").
- A character with no appearances after the fetch is left out with a warning.
- Seen marks are the same `bingology:mcu-seen` set as the timeline.
- Commit per task on `feat/mcu-characters`; don't push or merge.

## Review Focus
1. Same actor, two characters (Chris Evans: Steve Rogers / Johnny Storm) → only the matching one counts.
2. Same character, two actors (Banner: Edward Norton, Mark Ruffalo) → both count.
3. Unknown `#char/<id>` in the URL → the grid, not an error.
4. A character whose poster item has no data yet → a placeholder, not a broken image.
5. Character path in release order follows the same order as the timeline.

---

### Task 1: `mcu-characters.json` and validation
**Files:** Create `mcu-characters.json`; Modify `scripts/lib/mcu.mjs` (`validateCharacters(list, mcuIds) -> string[]`); Test `tests/mcu-file.test.mjs`.
- [ ] Tests: good row → `[]`; duplicate id; bad id format; `people` empty or non-integers; `match` not a valid regex; `poster` not in `mcuIds`; the real file is valid with ≥ 30 rows.
- [ ] Run → fails. Implement; write the file (person ids resolved via TMDB `/search/person`, checked by name). Run `npm test` → passes. Commit `feat(mcu): main characters file`.

### Task 2: Cast and appearances in the nightly fetch
**Files:** Modify `scripts/lib/mcu.mjs` (`castOf(credits) -> [{ person, character }]`, `appearances(chars, castById, items) -> characters[]`), `scripts/fetch-mcu.mjs` (credits requests; `characters` in the output; reads `mcu-characters.json`); Test `tests/mcu-fetch.test.mjs`.
- Output: `characters: [{ id, he, en, poster: <url of the poster item>, actor: <name from the latest appearance>, apps: [{ id: <item id>, as: <character string>, cameo: boolean }] }]`, sorted by `apps.length` desc, then `he`.
- An item that failed tonight keeps yesterday's cast (stored on the item as `cast` — the person/character pairs only).
- [ ] Tests: Review Focus 1 and 2; uncredited → cameo; character with no apps left out + warning; season `aggregate_credits` roles joined; failed item keeps yesterday's cast. Run → fails. Implement. Run `npm test`; `npm run fetch:mcu` locally → prints characters count. Commit `feat(mcu): character appearances from TMDB cast` (with the regenerated `site/mcu-data.json`).

### Task 3: The characters tab
**Files:** Create `site/mcu/characters.js` (`charPath(items, char, order) -> [{ item, as, cameo }]`, `charProgress(path, seen) -> { done, total }`, `route(hash, chars) -> { tab: "timeline"|"chars", char: object|null }`); Modify `site/mcu/view.js` (`tabsHTML(tab)`, `charsGridHTML(chars, seenAllIds)`, `charPathHTML(char, path, seen, order)`), `site/mcu/app.js` (hashchange routing), `site/mcu/mcu.css`; Test `tests/mcu-characters.test.mjs`, `tests/mcu-view.test.mjs`.
- [ ] Tests: `route` for `""`, `#chars`, `#char/thor`, `#char/nope` (→ chars grid); `charPath` follows `ordered()` for both orders and skips items not shown (no data / upcoming); `charProgress`; grid shows "N כותרים" and ✓ when all seen; path shows "הופעה קצרה" for cameos and the per-title character name; poster placeholder when missing. Run → fails. Implement. Run `npm test`. Commit `feat(mcu): characters tab and character paths`.

### Task 4: Check and review
- [ ] Browser at 375px and desktop, 3 themes: tabs, grid, a path, marking from a path shows on the timeline, back button, direct link `#char/loki`.
- [ ] One fresh reviewer on the branch; fix Critical/Important test-first; commit.

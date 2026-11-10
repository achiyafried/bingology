import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIssueForm, tmdbIdFrom, buildEntry, chooseMatch } from "../scripts/lib/add-series.mjs";

const body = `### שם הסדרה

The Penguin

### קישור ל-TMDB (לא חובה)

https://www.themoviedb.org/tv/194764-the-penguin

### מצבי רוח (לא חובה)

- [X] מתח ואדרנלין (tense)
- [ ] לצחוק ולהרים (laugh)
- [X] להעסיק את המוח (think)

### כמה כבדה?

כבדה ומטלטלת (3)

### עדיף לראות לבד?

- [X] כן, עדיף לבד

### תיאור קצר בעברית (לא חובה)

עלייתו של הפינגווין.
שורה שנייה.`;

test("parseIssueForm reads the GitHub issue-form markdown", () => {
  assert.deepEqual(parseIssueForm(body), {
    name: "The Penguin", tmdb: "https://www.themoviedb.org/tv/194764-the-penguin",
    moods: ["tense", "think"], weight: 3, solo: true, blurb: "עלייתו של הפינגווין.\nשורה שנייה.", extra: [],
  });
});

test("parseIssueForm treats '_No response_' and defaults as empty", () => {
  const b = "### שם הסדרה\n\nSevered\n\n### קישור ל-TMDB (לא חובה)\n\n_No response_\n\n### כמה כבדה?\n\nלא יודע/ת (ניחוש אוטומטי)\n\n### עדיף לראות לבד?\n\n- [ ] כן, עדיף לבד";
  assert.deepEqual(parseIssueForm(b), { name: "Severed", tmdb: null, moods: [], weight: null, solo: false, blurb: null, extra: [] });
});

test("tmdbIdFrom accepts a TMDB link or a bare number, nothing else", () => {
  assert.equal(tmdbIdFrom("https://www.themoviedb.org/tv/194764-the-penguin"), 194764);
  assert.equal(tmdbIdFrom("themoviedb.org/tv/1396?language=he"), 1396);
  assert.equal(tmdbIdFrom(" 2140 "), 2140);
  assert.equal(tmdbIdFrom("https://www.themoviedb.org/movie/550"), null);
  assert.equal(tmdbIdFrom("evil; rm -rf /"), null);
  assert.equal(tmdbIdFrom(null), null);
});

test("chooseMatch picks a single exact name, else the dominant result, else asks", () => {
  const r = (id, name, popularity, date = "2020-01-01") => ({ id, name, original_name: name, popularity, first_air_date: date });
  assert.deepEqual(chooseMatch([r(1, "Dark", 50), r(2, "Dark Matter", 80)], "dark"), { id: 1 });
  assert.deepEqual(chooseMatch([r(3, "The Penguin", 90), r(4, "The Penguins of Madagascar", 10)], "Penguin"), { id: 3 });
  const amb = chooseMatch([r(5, "Shameless", 40, "2011-01-09"), r(6, "Shameless", 30, "2004-01-13")], "Shameless");
  assert.deepEqual(amb.candidates.map(c => c.id), [5, 6]);
  assert.deepEqual(chooseMatch([], "x"), { candidates: [] });
});

test("buildEntry uses the form where given, auto-tags otherwise, and always has a runtime fallback", () => {
  const tv = { id: 194764, name: "The Penguin", genres: [{ id: 80 }, { id: 18 }], origin_country: ["US"], first_air_date: "2024-09-19",
    number_of_seasons: 1, number_of_episodes: 8, episode_run_time: [], last_episode_to_air: { runtime: 63 }, original_language: "en" };
  const e = buildEntry(tv, 17, { moods: ["think"], weight: null, solo: true, blurb: "תיאור" });
  assert.deepEqual(e, {
    tmdbId: 194764, name: "The Penguin", lists: ["mine"], genres: ["crime", "drama"], moods: ["think"], weight: 3, solo: true, blurb: "תיאור", rt: null,
    fallback: { year: 2024, seasons: 1, episodes: 8, runtime: 63, imdb: null, lang: "en", creators: [], cast: [], providers: [] },
  });
  assert.equal(buildEntry({ ...tv, last_episode_to_air: null }, 17, {}).fallback.runtime, 45);
});

test("parseIssueForm reads the 'also available on' checkboxes as categories", () => {
  const b = "### שם הסדרה\n\nFauda\n\n### זמין גם ב- (לא חובה)\n\n- [X] yes (yes)\n- [ ] HOT (hot)\n- [X] פרטנר (partner)\n- [X] כאן (kan)\n- [X] Disney+ (disney)\n- [X] bogus (rm)";
  assert.deepEqual(parseIssueForm(b).extra, ["yes", "partner", "kan", "disney"]);
  assert.deepEqual(parseIssueForm("### שם הסדרה\n\nX").extra, []);
});

test("buildEntry keeps the manual extra providers", () => {
  const tv = { id: 1, name: "X", genres: [], origin_country: ["IL"], episode_run_time: [45] };
  assert.deepEqual(buildEntry(tv, 14, { extra: ["israel"] }).extraProviders, ["israel"]);
  assert.equal("extraProviders" in buildEntry(tv, 14, {}), false);
});

// The MCU timeline as data: what is shown, in which order, under which headings, and what to watch next.

/** Items with data, split by release: date after today (YYYY-MM-DD) is "upcoming" (by date); no date is upcoming too. */
export function visible(items, today) {
  const withData = items.filter(x => x.fetchedAt);
  const released = withData.filter(x => x.date && x.date <= today);
  const upcoming = withData.filter(x => !x.date || x.date > today)
    .sort((a, b) => String(a.date ?? "9999").localeCompare(String(b.date ?? "9999")) || a.story_i - b.story_i);
  return { released, upcoming };
}

/** "story": the hand-written order; "release": by date, ties in story order. */
export function ordered(items, order) {
  const by = order === "release"
    ? (a, b) => String(a.date).localeCompare(String(b.date)) || a.story_i - b.story_i
    : (a, b) => a.story_i - b.story_i;
  return [...items].sort(by);
}

/** Headings: in story order, runs of the same era; in release order, one per phase (phases in order, items by date). */
export function groups(items, order) {
  const out = [];
  const list = ordered(items, order);
  if (order === "release") list.sort((a, b) => a.phase - b.phase); // stable: dates stay in order inside a phase
  for (const x of list) {
    const title = order === "release" ? `שלב ${x.phase}` : x.era;
    const last = out[out.length - 1];
    if (last && last.title === title) last.items.push(x); else out.push({ title, items: [x] });
  }
  return out;
}

/** The first item not yet seen, in the chosen order; null when everything is seen. */
export const nextUp = (items, seen, order) => ordered(items, order).find(x => !seen.has(x.id)) ?? null;

/** Seen out of shown: marks for ids that are not on the timeline (any more) don't count. */
export const progress = (items, seen) => ({ done: items.filter(x => seen.has(x.id)).length, total: items.length });

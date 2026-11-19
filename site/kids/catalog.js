// The kids catalog: age groups, streaming services, order. Pure, shared by the page and the tests.
export const GROUPS = [
  { id: "small", label: "קטנטנים 2–5", icon: "🐣" },
  { id: "mid", label: "ילדים 6–9", icon: "🚀" },
  { id: "big", label: "גדולים 10–13", icon: "⚡" },
];
export const LABEL = { netflix: "Netflix", hbo: "HBO Max", apple: "Apple TV+", prime: "Prime Video", disney: "Disney+", yes: "yes", hot: "HOT", partner: "פרטנר", cellcom: "סלקום", kan: "כאן", other: "אחר" };
const ORDER = ["netflix", "disney", "hbo", "apple", "prime", "yes", "hot", "partner", "cellcom", "kan"];

export const title = x => x.nameHe ?? x.name;

/** The group's series: best TMDB vote first, unrated last, then by name. */
export function inGroup(items, age) {
  return items.filter(x => x.age === age).sort((a, b) =>
    (b.vote ?? -1) - (a.vote ?? -1) || title(a).localeCompare(title(b), "he"));
}

/** Services that at least one of these series has, in a fixed order ("other" left out). */
export function servicesIn(items) {
  const has = new Set(items.flatMap(x => x.providers ?? []));
  return ORDER.filter(p => has.has(p));
}

/** The selection, minus services this group does not have. */
export const pickServices = (selected, available) => selected.filter(p => available.includes(p));

/** Nothing selected keeps everything; otherwise series on any selected service. */
export const byServices = (items, selected) =>
  selected.length ? items.filter(x => (x.providers ?? []).some(p => selected.includes(p))) : items;

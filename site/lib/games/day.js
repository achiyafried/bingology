// Plain browser-compatible ESM: shared by the site and the Node scripts.
export const GAMES = [
  { id: "guess", name: "נחשו את הסדרה", icon: "🎬" },
  { id: "odd", name: "מי לא שייך", icon: "🕵️" },
  { id: "chain", name: "שרשרת", icon: "🔗" },
  { id: "groups", name: "ארבע קבוצות", icon: "🧩" },
  { id: "blur", name: "השחקן המטושטש", icon: "👤" },
  { id: "riddle", name: "חידת היגיון", icon: "🧠" }, // hand-written: assigned from riddles.json, not generated
];

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" });

export function israelToday(now = new Date()) {
  return fmt.format(now);
}

export function addDays(date, n) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function fetchDay(fetchFn, date) {
  const res = await fetchFn(`games/${date}.json`, { cache: "no-cache" });
  if (res.status === 404) return { missing: true };
  if (!res.ok) throw new Error("http " + res.status);
  return { day: await res.json() };
}

/** Today's file: ok | missing (with yesterday's file as practice, or null) | version | error. Never throws. */
export async function loadGamesDay(fetchFn, date) {
  try {
    const r = await fetchDay(fetchFn, date);
    if (r.missing) {
      let practice = null;
      try {
        const prev = await fetchDay(fetchFn, addDays(date, -1));
        if (prev.day && prev.day.v === 1) practice = prev.day;
      } catch (e) {}
      return { status: "missing", practice };
    }
    if (!r.day || r.day.v !== 1) return { status: "version" };
    return { status: "ok", day: r.day };
  } catch (e) {
    return { status: "error" };
  }
}

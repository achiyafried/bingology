// Plain browser-compatible ESM: shared by the site and the Node scripts.
export const GAMES = [
  { id: "guess", name: "נחשו את הסדרה", icon: "🎬" },
  { id: "odd", name: "מי לא שייך", icon: "🕵️" },
  { id: "chain", name: "שרשרת", icon: "🔗" },
  { id: "groups", name: "ארבע קבוצות", icon: "🧩" },
  { id: "blur", name: "השחקן המטושטש", icon: "👤" },
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

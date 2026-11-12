import { GAMES } from "./day.js";

const URL = "https://achiyafried.github.io/bingology/#games";

/** The share message. `results` holds only finished games; they are printed in the fixed game order. */
export function shareText({ date, streak, results }) {
  const [, m, d] = date.split("-").map(Number);
  const head = `Bingology · ${d}.${m}` + (streak > 0 ? ` · רצף ${streak} 🔥` : "");
  const byId = new Map(results.map(r => [r.id, r.label]));
  const line = GAMES.filter(g => byId.has(g.id)).map(g => `${g.icon} ${byId.get(g.id)}`).join("  ");
  return [head, line, URL].filter(Boolean).join("\n");
}

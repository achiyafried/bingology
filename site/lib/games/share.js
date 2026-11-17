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

/** What a friend fills in to send a riddle (no contact details here: they know who to send it to). */
export const RIDDLE_TEMPLATE = [
  "חידה ל-Bingology 🧩",
  "החידה:",
  "התשובה (שם הסדרה בעברית):",
  "הסבר (לא חובה):",
  "השם שיופיע ליד החידה (לא חובה):",
].join("\n");

/** Where riddles from friends go: a mailbox just for the site (it is public on the page). */
export const RIDDLE_EMAIL = "bingeislife@gmail.com";

/** A mailto link with the subject and the template filled in. */
export const riddleMailto = (to = RIDDLE_EMAIL) =>
  `mailto:${to}?subject=${encodeURIComponent("חידה ל-Bingology")}&body=${encodeURIComponent(RIDDLE_TEMPLATE.split("\n").slice(1).join("\n\n") + "\n")}`;

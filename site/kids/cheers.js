// Personal cheers for the toddler games: who's playing (name + boy/girl, saved on this device only),
// a random cheer with the child's name in the right grammar, shown big and spoken by the browser's Hebrew voice.
import { esc } from "../lib/esc.js";

export const MAX_PLAYERS = 4;

/** Cheer templates; {n} is the child's name. "m" a boy, "f" a girl, "none" when nobody entered a name. */
export const CHEERS = {
  m: [
    "{n}! איזה תותח!!", "וואו {n}, אלוף!", "{n}, אתה גאון!", "יש! {n} עשה את זה!", "{n}, איזה גיבור!",
    "כל הכבוד {n}!", "{n}! אתה מדהים!", "בראבו {n}!", "{n}, איזה כיף איתך!", "{n}! מושלם!",
    "{n}, אתה כוכב!", "יופי {n}, הצלחת!", "{n}! איזה חכם!", "הידד ל{n}!", "{n}, אתה אלוף העולם!",
  ],
  f: [
    "{n}! איזו תותחית!!", "וואו {n}, אלופה!", "{n}, את גאונה!", "יש! {n} עשתה את זה!", "{n}, איזו גיבורה!",
    "כל הכבוד {n}!", "{n}! את מדהימה!", "בראבו {n}!", "{n}, איזה כיף איתך!", "{n}! מושלם!",
    "{n}, את כוכבת!", "יופי {n}, הצלחת!", "{n}! איזו חכמה!", "הידד ל{n}!", "{n}, את אלופת העולם!",
  ],
  none: ["כל הכבוד!", "וואו!", "יש! הצלחת!", "בראבו!", "מושלם!", "איזה כיף!", "הידד!", "יופי!"],
};

/** A random cheer for this player (null: no name), never the same template index as `last`. */
export function pickCheer(player, rnd = Math.random, last = -1) {
  const set = player && player.name ? CHEERS[player.g === "f" ? "f" : "m"] : CHEERS.none;
  let idx = Math.floor(rnd() * set.length);
  if (idx === last && set.length > 1) idx = (idx + 1) % set.length;
  const template = set[idx];
  return { idx, template, text: template.replace("{n}", player && player.name ? player.name : "") };
}

/** A name as typed by a parent: trimmed, at most 16 characters, without markup characters. */
export const cleanName = s => String(s ?? "").replace(/[<>"'&]/g, "").trim().slice(0, 16);

/** The big cheer bubble (announced politely to screen readers). */
export const cheerHTML = text => `<div class="k-cheer" role="status" aria-live="polite"><span>${esc(text)} 🎉</span></div>`;

/** speak(text) → true when spoken: the browser's Hebrew voice, silent when muted or when there is no Hebrew voice. */
export function makeSpeaker(isMuted, synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance) {
  return text => {
    try {
      if (isMuted() || !synth || typeof Utterance !== "function") return false;
      const voice = (synth.getVoices() || []).find(v => /^he\b|^iw\b/i.test(v.lang || ""));
      if (!voice) return false;
      const u = new Utterance(text);
      u.voice = voice; u.lang = voice.lang || "he-IL"; u.rate = 1; u.pitch = 1.15;
      synth.cancel();
      synth.speak(u);
      return true;
    } catch { return false; }
  };
}

/** The "who's playing" row on the games home: a button per child, ✕ to remove, ➕ to add (up to MAX_PLAYERS). */
export function playersHTML(players, current) {
  const btns = players.map((p, i) => `<span class="k-pl"><button class="k-pl-b" data-a="player" data-v="${i}" aria-pressed="${i === current}">${p.g === "f" ? "👧" : "👦"} ${esc(p.name)}</button><button class="k-pl-x" data-a="player-del" data-v="${i}" aria-label="הסרת ${esc(p.name)}">✕</button></span>`).join("");
  const add = players.length < MAX_PLAYERS ? `<button class="k-pl-add" data-a="go" data-v="who" aria-label="הוספת ילד או ילדה">➕</button>` : "";
  return `<div class="k-pls" role="group" aria-label="מי משחק">${btns}${add}</div>`;
}

/** The setup screen: the child's name, boy or girl, save or skip. */
export function whoHTML({ g = "m" } = {}) {
  const gb = (v, label) => `<button class="k-who-g" data-a="who-g" data-v="${v}" aria-pressed="${g === v}">${label}</button>`;
  return `<section class="k-who"><h2>מי משחק? 🎮</h2>
<label class="k-who-l" for="k-who-name">השם של הילד או הילדה</label>
<input id="k-who-name" class="k-who-in" type="text" maxlength="16" autocomplete="off" enterkeyhint="done" placeholder="למשל: דין">
<div class="k-who-gs" role="group" aria-label="בן או בת">${gb("m", "👦 בן")}${gb("f", "👧 בת")}</div>
<button class="k-who-save" data-a="who-save">יאללה!</button>
<button class="k-who-skip" data-a="who-skip">אפשר גם לדלג</button></section>`;
}

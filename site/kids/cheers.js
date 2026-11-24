// Personal cheers for the toddler games: who's playing (a Hebrew name shown on the buttons, plus its English spelling,
// saved on this device only), a random English cheer with the child's name, shown big and spoken by an English voice
// (the browsers' Hebrew voices sound poor).
import { esc } from "../lib/esc.js";

export const MAX_PLAYERS = 4;

/** Cheer templates; {n} is the English spelling of the child's name. "none" when there is no English name. */
export const CHEERS = {
  en: [
    "{n}! You're a superstar!", "Wow, {n}! Amazing!", "{n}, you did it!", "Way to go, {n}!", "{n}, you're a champion!",
    "Great job, {n}!", "{n}! So clever!", "Yay, {n}!", "{n}, you rock!", "High five, {n}!",
    "{n}! Brilliant!", "Hooray for {n}!", "{n}, that was awesome!", "You're the best, {n}!", "{n}! Fantastic!",
    "Look at you go, {n}!",
  ],
  none: ["Great job!", "Wow!", "You did it!", "Amazing!", "Hooray!", "Superstar!", "Brilliant!", "Way to go!"],
};

/** A random cheer for this player (no English spelling or no player: no name), never the same template index as `last`. */
export function pickCheer(player, rnd = Math.random, last = -1) {
  const name = player && player.en ? player.en : "";
  const set = name ? CHEERS.en : CHEERS.none;
  let idx = Math.floor(rnd() * set.length);
  if (idx === last && set.length > 1) idx = (idx + 1) % set.length;
  const template = set[idx];
  return { idx, template, text: template.replace("{n}", () => name) }; // a function: "$&" in a name stays literal
}

/** The Hebrew name as typed by a parent: trimmed, at most 24 characters, no control or angle-bracket characters. */
export const cleanName = s => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 24);
/** The English spelling the voice says: Latin letters, spaces, hyphens and apostrophes only, at most 24 characters. */
export const cleanEn = s => String(s ?? "").replace(/[^A-Za-z' -]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);

/** Index of the first child without an English spelling (saved before cheers were in English), or -1. */
export const missingEn = players => players.findIndex(p => !p.en);

/** The big cheer bubble (English, left to right; announced politely to screen readers). */
export const cheerHTML = text => `<div class="k-cheer" role="status" aria-live="polite"><span dir="ltr">${esc(text)} 🎉</span></div>`;

/** speak(text) → true when spoken: an English voice (on-device first), silent when muted or without one. */
export function makeSpeaker(isMuted, synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance) {
  return text => {
    try {
      if (isMuted() || !synth || typeof Utterance !== "function") return false;
      const en = (synth.getVoices() || []).filter(v => /^en([-_]|$)/i.test(v.lang || ""));
      const voice = en.find(v => v.localService) || en[0];
      if (!voice) return false;
      const u = new Utterance(text);
      u.voice = voice; u.lang = voice.lang || "en-US"; u.rate = 1; u.pitch = 1.15;
      if (synth.speaking || synth.pending) synth.cancel(); // Safari may drop a speak() right after cancel()
      synth.speak(u);
      return true;
    } catch { return false; }
  };
}

/** The "who's playing" row on the games home: a button per child (Hebrew name), ✕ to remove, ➕ to add. */
export function playersHTML(players, current) {
  const btns = players.map((p, i) => `<span class="k-pl"><button class="k-pl-b" data-a="player" data-v="${i}" aria-pressed="${i === current}">⭐ ${esc(p.name)}</button><button class="k-pl-x" data-a="player-del" data-v="${i}" aria-label="הסרת ${esc(p.name)}">✕</button></span>`).join("");
  const add = players.length < MAX_PLAYERS ? `<button class="k-pl-add" data-a="go" data-v="who" aria-label="הוספת ילד או ילדה">➕</button>` : "";
  return `<div class="k-pls" role="group" aria-label="מי משחק">${btns}${add}</div>`;
}

/** The setup screen: the name in Hebrew (shown) and in English letters (said in the cheers).
 *  edit: the index of a saved child who still needs an English spelling (its name filled in, no skip). */
export function whoHTML({ edit = null, name = "" } = {}) {
  const editing = Number.isInteger(edit);
  return `<section class="k-who"><h2>${editing ? "איך כותבים באנגלית? 🔤" : "מי משחק? 🎮"}</h2>
<label class="k-who-l" for="k-who-name">השם בעברית</label>
<input id="k-who-name" class="k-who-in" type="text" maxlength="24" autocomplete="off" placeholder="למשל: דין"${name ? ` value="${esc(name)}"` : ""}>
<label class="k-who-l" for="k-who-en">ואיך כותבים אותו באנגלית (כך הוא יישמע בתשואות)</label>
<input id="k-who-en" class="k-who-in" type="text" dir="ltr" lang="en" maxlength="24" autocomplete="off" autocapitalize="words" enterkeyhint="done" placeholder="Dean">
<button class="k-who-save" data-a="who-save"${editing ? ` data-edit="${edit}"` : ""}>יאללה!</button>
${editing ? "" : `<button class="k-who-skip" data-a="who-skip">אפשר גם לדלג</button>`}</section>`;
}

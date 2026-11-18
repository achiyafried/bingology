// Narration with macOS's built-in English voice. No network, no keys; on other systems synth() just reports false.
import { execFile } from "node:child_process";

export const VOICE = "Samantha";
const RATE = "200"; // words per minute: upbeat, still easy to follow
// say's embedded commands: a higher base pitch and a wider pitch swing make Samantha sound cheerful instead of flat
const JOY = "[[pbas +10]][[pmod +70]]";

export function sayArgs(text, out) {
  return ["-v", VOICE, "-r", RATE, "-o", out, JOY + text];
}

/** Speaks `text` into an AIFF file. True on success, false (never throws) if `say` or the voice is missing. */
export function synth(text, out) {
  return new Promise(ok => execFile("say", sayArgs(text, out), err => ok(!err)));
}

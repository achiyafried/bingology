// Narration with macOS's built-in Hebrew voice. No network, no keys; on other systems synth() just reports false.
import { execFile } from "node:child_process";

export const VOICE = "Carmit";
const RATE = "175"; // words per minute; a touch slower than the default so it's easy to follow

export function sayArgs(text, out) {
  return ["-v", VOICE, "-r", RATE, "-o", out, text];
}

/** Speaks `text` into an AIFF file. True on success, false (never throws) if `say` or the voice is missing. */
export function synth(text, out) {
  return new Promise(ok => execFile("say", sayArgs(text, out), err => ok(!err)));
}

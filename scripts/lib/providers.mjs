// Streaming services of a TMDB title, shared by the MCU and kids fetchers.
import { mapProviders } from "./tmdb.mjs";

const US_DISNEY = ["Disney Plus", "Hulu"];

/** IL providers in providers.json order ("other" last), plus Disney+ guessed from the US listing (TMDB has no IL Disney+ data). */
export function providersOf(wp, map) {
  const il = mapProviders(wp?.results?.IL?.flatrate ?? [], map).cats;
  const us = (wp?.results?.US?.flatrate ?? []).map(p => p.provider_name);
  const guess = map.disney && !il.includes("disney") && us.some(n => US_DISNEY.includes(n)) ? ["disney"] : [];
  const all = new Set([...il, ...guess]);
  const providers = Object.keys(map).filter(k => all.has(k)).concat(all.has("other") ? ["other"] : []);
  return { providers, providersGuess: guess };
}

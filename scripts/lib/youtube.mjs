// YouTube Data API v3: which trailer keys actually play, embedded, in a given country.
// A trailer can be region-blocked, private, removed, age-restricted (never plays embedded) or not embeddable.
import { cleanKey } from "./api.mjs";

const API = "https://www.googleapis.com/youtube/v3/videos";
const BATCH = 50; // the API's limit per request; each request costs 1 quota unit

/** One videos.list item → can a viewer in `region` watch it in our embedded player? */
export function playableIn(item, region) {
  const st = item.status ?? {}, cd = item.contentDetails ?? {};
  if (st.embeddable === false || st.privacyStatus === "private") return false;
  if (st.uploadStatus && st.uploadStatus !== "processed") return false;
  const rr = cd.regionRestriction;
  if (rr?.blocked?.includes(region)) return false;
  if (rr?.allowed && !rr.allowed.includes(region)) return false;
  if (cd.contentRating?.ytRating === "ytAgeRestricted") return false;
  return true;
}

/** ids → Map(id → playable). An id YouTube doesn't return (removed/private) is false. Throws on HTTP/network errors. */
export async function videoVerdicts(ids, { key, region = "IL", fetchImpl = fetch }) {
  const out = new Map();
  const uniq = [...new Set(ids)];
  for (let k = 0; k < uniq.length; k += BATCH) {
    const chunk = uniq.slice(k, k + BATCH);
    const url = new URL(API);
    url.searchParams.set("part", "status,contentDetails");
    url.searchParams.set("id", chunk.join(","));
    url.searchParams.set("fields", "items(id,status(embeddable,privacyStatus,uploadStatus),contentDetails(regionRestriction,contentRating/ytRating))");
    url.searchParams.set("key", cleanKey(key));
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`YouTube videos.list → HTTP ${res.status}`);
    const items = (await res.json()).items ?? [];
    const byId = new Map(items.map(i => [i.id, i]));
    for (const id of chunk) out.set(id, byId.has(id) && playableIn(byId.get(id), region));
  }
  return out;
}

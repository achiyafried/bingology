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

const SEARCH = "https://www.googleapis.com/youtube/v3/search"; // 100 quota units per request
const TRAILER_WORD = /(?:^| )(?:trailer|teaser|promo|טריילר|טיזר)(?: |$)/;
const ENTITIES = { "&#39;": "'", "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">" };

/** Lowercase words only: entities decoded, accents and apostrophes dropped, everything else a space. */
const norm = t => String(t ?? "")
  .replace(/&#39;|&quot;|&amp;|&lt;|&gt;/g, m => ENTITIES[m])
  .normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/['’`]/g, "")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Is a search result's title a trailer of this series? Name as whole words (a "(US)" suffix ignored), a trailer word, no "movie". */
export function matchesTrailer(title, name) {
  const t = ` ${norm(title)} `;
  const n = norm(String(name).replace(/\s*\([^)]*\)\s*$/, ""));
  if (!n || !t.includes(` ${n} `)) return false;
  if (/ movie /.test(t)) return false;
  return TRAILER_WORD.test(t.trim());
}

/** YouTube search for a series' trailer: ids of embeddable, viewable-in-region results whose title matches, in result order. Throws on HTTP errors. */
export async function searchTrailers({ name, year }, { key, region = "IL", fetchImpl = fetch }) {
  const url = new URL(SEARCH);
  const params = { part: "snippet", type: "video", maxResults: "10", videoEmbeddable: "true", regionCode: region,
    q: `${name}${year ? " " + year : ""} official trailer`, fields: "items(id/videoId,snippet/title)", key: cleanKey(key) };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`YouTube search → HTTP ${res.status}`);
  const items = (await res.json()).items ?? [];
  return items.map(i => ({ id: i.id?.videoId, title: i.snippet?.title }))
    .filter(i => /^[A-Za-z0-9_-]{11}$/.test(i.id ?? "") && matchesTrailer(i.title, name))
    .map(i => i.id);
}

const PLAYLIST_ITEMS = "https://www.googleapis.com/youtube/v3/playlistItems";
const VIDEOS = "https://www.googleapis.com/youtube/v3/videos";

/** A channel id ("UC…") → its uploads playlist id ("UU…"). */
export const uploadsId = channel => "UU" + String(channel).slice(2);

/** ISO 8601 duration ("PT7M3S") → seconds; anything unparsable → 0. */
export function isoSeconds(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(iso ?? ""));
  if (!m) return 0;
  const [d, h, mi, s] = m.slice(1).map(Number);
  return (d || 0) * 86400 + (h || 0) * 3600 + (mi || 0) * 60 + (s || 0);
}

/** One videos.list item → a clip we show a toddler: playable, 61 s – 12 min, not marked as not-for-kids. */
export function clipOk(item, region = "IL") {
  const sec = isoSeconds(item.contentDetails?.duration);
  return playableIn(item, region) && sec >= 61 && sec <= 720 && item.status?.madeForKids !== false;
}

async function getJson(url, what, fetchImpl) {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`YouTube ${what} → HTTP ${res.status}`);
  return res.json();
}

/** Clips of a series from official channels' uploads, channels in order, newest first, up to `max`. Throws on HTTP/network errors. */
export async function seriesClips(yt, { key, fetchImpl = fetch, region = "IL", max = 12, pages = 4 }) {
  const out = [], seen = new Set();
  for (const { channel, match } of yt ?? []) {
    const want = match ? ` ${norm(match)} ` : null;
    let token;
    for (let p = 0; p < pages && out.length < max; p++) {
      const url = new URL(PLAYLIST_ITEMS);
      url.searchParams.set("part", "snippet");
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("playlistId", uploadsId(channel));
      if (token) url.searchParams.set("pageToken", token);
      url.searchParams.set("fields", "nextPageToken,items(snippet(title,resourceId/videoId))");
      url.searchParams.set("key", cleanKey(key));
      const page = await getJson(url, "playlistItems.list", fetchImpl);
      const titles = new Map();
      for (const i of page.items ?? []) {
        const id = i.snippet?.resourceId?.videoId, title = i.snippet?.title ?? "";
        if (!/^[A-Za-z0-9_-]{11}$/.test(id ?? "") || seen.has(id)) continue;
        if (want && !` ${norm(title)} `.includes(want)) continue;
        titles.set(id, title);
      }
      if (titles.size) {
        const vurl = new URL(VIDEOS);
        vurl.searchParams.set("part", "status,contentDetails");
        vurl.searchParams.set("id", [...titles.keys()].join(","));
        vurl.searchParams.set("fields", "items(id,status(embeddable,privacyStatus,uploadStatus,madeForKids),contentDetails(duration,regionRestriction,contentRating/ytRating))");
        vurl.searchParams.set("key", cleanKey(key));
        const byId = new Map(((await getJson(vurl, "videos.list", fetchImpl)).items ?? []).map(v => [v.id, v]));
        for (const [id, title] of titles) {
          const v = byId.get(id);
          if (!v || !clipOk(v, region) || out.length >= max) continue;
          seen.add(id);
          out.push({ id, title, thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, sec: isoSeconds(v.contentDetails.duration) });
        }
      }
      token = page.nextPageToken;
      if (!token) break;
    }
    if (out.length >= max) break;
  }
  return out;
}

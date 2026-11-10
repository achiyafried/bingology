const TMDB = "https://api.themoviedb.org/3";
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** A key as pasted into a terminal may carry bracketed-paste markers, newlines or spaces. */
export const cleanKey = k => (k ?? "").replace(/\x1b\[20[01]~/g, "").replace(/[\s\x00-\x1f\x7f]/g, "");

/** GET a TMDB v3 endpoint. Throws an Error with `.status` on non-2xx; retries once on 429. */
export async function tmdbGet(path, params = {}, fetchImpl = fetch) {
  const url = new URL(TMDB + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // Accept either the long Read Access Token (Bearer) or the short 32-hex v3 API key (query param).
  const key = cleanKey(process.env.TMDB_TOKEN);
  const headers = { Accept: "application/json" };
  if (/^[0-9a-f]{32}$/i.test(key)) url.searchParams.set("api_key", key);
  else headers.Authorization = `Bearer ${key}`;
  const opts = { headers };
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(url, opts);
    if (res.status === 429 && attempt === 0) {
      const wait = Number(res.headers.get("Retry-After") ?? 2);
      await sleep((Number.isFinite(wait) ? wait : 2) * 1000);
      continue;
    }
    if (!res.ok) {
      const hint = res.status === 401 ? " — TMDB rejected the key: paste the API Read Access Token (long, starts with eyJ) or the 32-character API Key, not the OMDb key" : "";
      const err = new Error(`TMDB ${path} → HTTP ${res.status}${hint}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }
}

/** IMDb rating via OMDb, or null when unavailable. Never throws. */
export async function omdbRating(imdbId, fetchImpl = fetch) {
  if (!imdbId) return null;
  try {
    const url = `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(cleanKey(process.env.OMDB_KEY))}`;
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    const j = await res.json();
    const n = Number(j.imdbRating);
    return j.Response === "False" || !Number.isFinite(n) ? null : n;
  } catch {
    return null;
  }
}

/** Map `items` through async `fn` with at most `limit` in flight; results keep input order. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

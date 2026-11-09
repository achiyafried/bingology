const TMDB = "https://api.themoviedb.org/3";
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** GET a TMDB v3 endpoint. Throws an Error with `.status` on non-2xx; retries once on 429. */
export async function tmdbGet(path, params = {}, fetchImpl = fetch) {
  const url = new URL(TMDB + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const opts = { headers: { Authorization: `Bearer ${process.env.TMDB_TOKEN}`, Accept: "application/json" } };
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(url, opts);
    if (res.status === 429 && attempt === 0) {
      const wait = Number(res.headers.get("Retry-After") ?? 2);
      await sleep((Number.isFinite(wait) ? wait : 2) * 1000);
      continue;
    }
    if (!res.ok) {
      const err = new Error(`TMDB ${path} → HTTP ${res.status}`);
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
    const url = `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(process.env.OMDB_KEY ?? "")}`;
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

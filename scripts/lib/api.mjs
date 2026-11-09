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

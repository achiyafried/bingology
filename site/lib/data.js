/** data.json → the series shape the app code has always used (short keys, index ids). */
export function fromData(json) {
  return json.series.map((x, i) => ({
    id: i,
    tmdbId: x.tmdbId,
    n: x.name,
    y: x.year,
    s: x.seasons,
    se: x.seasonEps ?? null,
    e: x.episodes,
    m: x.runtime,
    g: x.genres,
    mo: x.moods,
    h: x.weight,
    solo: !!x.solo,
    l: x.blurb || x.overviewHe || "",
    imdb: x.imdb,
    tmdbVote: x.tmdbVote ?? null,
    tmdbVotes: x.tmdbVotes ?? null,
    minAge: x.minAge ?? null,
    rt: x.rt ?? null,
    lang: x.lang,
    nyt: x.nytRank ?? null,
    lists: x.lists,
    providers: x.providers ?? [],
    providersGuess: x.providersGuess ?? [],
    po: x.providersOther ?? [],
    poster: x.poster ?? null,
    cast: x.cast ?? [],
    creators: x.creators ?? [],
    status: x.status ?? null,
    airing: x.status === "airing",
    praise: x.praise ?? null,
    awards: x.awards ?? [],
    castLabel: x.castLabel ?? null,
    nx: x.next ?? null,
    strm: x.streams ?? null,
  }));
}

/** A series' services for display: our labels, with "other" replaced by the real service names. */
export const providerNames = (s, labels) => s.providers.flatMap(p => p === "other"
  ? s.po.map(name => ({ name, guess: false }))
  : [{ name: labels[p], guess: s.providersGuess.includes(p) }]);

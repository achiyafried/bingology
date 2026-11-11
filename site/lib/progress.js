/** Episodes watched up to and including pos. */
function watchedCount(pos, s) {
  const before = Array.isArray(s.se) ? s.se.slice(0, Math.max(0, pos.season - 1)).reduce((a, b) => a + b, 0) : 0;
  return before + pos.episode;
}

/** The episode after pos; `last` is true (and pos unchanged) when pos is the final episode. */
export function nextEpisode(pos, s) {
  if (Array.isArray(s.se) && s.se.length) {
    if (pos.episode < s.se[pos.season - 1]) return { season: pos.season, episode: pos.episode + 1, last: false };
    if (pos.season < s.se.length) return { season: pos.season + 1, episode: 1, last: false };
    return { season: pos.season, episode: pos.episode, last: true };
  }
  if (s.e && pos.episode >= s.e) return { season: pos.season, episode: pos.episode, last: true };
  return { season: pos.season, episode: pos.episode + 1, last: false };
}

/** How far through a series pos is; total/pct/eveningsLeft are null when the episode count is unknown. */
export function progress(pos, s, pace = 2) {
  const watched = watchedCount(pos, s);
  const total = s.e || null;
  if (total === null) return { watched, total: null, pct: null, eveningsLeft: null };
  return {
    watched, total,
    pct: Math.round((watched / total) * 100),
    eveningsLeft: Math.max(0, Math.ceil((total - watched) / pace)),
  };
}

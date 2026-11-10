/** Link to the GitHub issue form for adding a series, with the searched name pre-filled. */
export function addSeriesUrl(repo, name) {
  const u = new URL(`https://github.com/${repo}/issues/new`);
  u.searchParams.set("template", "add-series.yml");
  const n = (name || "").trim();
  u.searchParams.set("title", n ? `הוספת סדרה: ${n}` : "הוספת סדרה");
  if (n) u.searchParams.set("name", n);
  return u.toString();
}

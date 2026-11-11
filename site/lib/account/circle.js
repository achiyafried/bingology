// The circle: create / join / leave, members, their lists, the feed and joint-pick votes.
// Reads rely on RLS: profiles, entries, events and pick_votes are visible only for the caller's current circle.
import { getClient } from "./client.js";
import { currentUser } from "./auth.js";

const FEED_N = 20;
const PAGE = 1000; // PostgREST's default row cap

async function signedIn() {
  const user = await currentUser();
  if (!user) throw new Error("not signed in");
  return { c: await getClient(), user };
}
const ok = r => { if (r.error) throw r.error; return r.data; };

/** All rows of a query, page by page (a circle's entries can pass the 1000-row cap). */
async function all(make) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const rows = ok(await make().range(from, from + PAGE - 1)) || [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** Invite link for a circle code: this page with #join=<code>. */
export function inviteUrl(code, base) {
  const b = base || (typeof location !== "undefined" ? location.origin + location.pathname : "");
  return b + "#join=" + encodeURIComponent(code);
}

/**
 * { circle, members, lists, rows, feed, votes }
 * circle: {id, invite_code} | null. members: profile rows {id, name}. lists: Map<userId, Map<tmdbId, status>>
 * (for jointPick). rows: Map<userId, Map<tmdbId, {status, rating, title}>>. feed: the 20 newest events. votes: pick_votes.
 */
export async function loadCircle() {
  const { c, user } = await signedIn();
  const me = ok(await c.from("profiles").select("id,circle_id").eq("id", user.id).maybeSingle());
  const cid = me && me.circle_id;
  if (!cid) return { circle: null, members: [], lists: new Map(), rows: new Map(), feed: [], votes: [] };
  const [circle, members, feed, votes] = await Promise.all([
    c.from("circles").select("id,invite_code").eq("id", cid).maybeSingle().then(ok),
    c.from("profiles").select("id,name,created_at").eq("circle_id", cid).order("created_at").then(ok),
    c.from("events").select("id,user_id,tmdb_id,kind,rating,season,created_at").eq("circle_id", cid)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(FEED_N).then(ok),
    all(() => c.from("pick_votes").select("tmdb_id,user_id,vote").eq("circle_id", cid)),
  ]);
  const ids = (members || []).map(m => m.id);
  const entries = ids.length ? await all(() => c.from("entries").select("user_id,tmdb_id,status,rating,title").in("user_id", ids)) : [];
  const lists = new Map(ids.map(id => [id, new Map()]));
  const rows = new Map(ids.map(id => [id, new Map()]));
  for (const e of entries) {
    if (!lists.has(e.user_id)) continue;
    lists.get(e.user_id).set(e.tmdb_id, e.status);
    rows.get(e.user_id).set(e.tmdb_id, e);
  }
  return { circle, members: members || [], lists, rows, feed: feed || [], votes };
}

/** What the other circle members did with one series: [{id, name, status, rating}]. */
export async function friendsOn(tmdbId) {
  const { c, user } = await signedIn();
  const [profiles, entries] = await Promise.all([
    c.from("profiles").select("id,name,created_at").neq("id", user.id).order("created_at").then(ok),
    c.from("entries").select("user_id,status,rating").eq("tmdb_id", tmdbId).neq("user_id", user.id).then(ok),
  ]);
  const by = new Map((entries || []).map(e => [e.user_id, e]));
  return (profiles || []).filter(p => by.has(p.id)).map(p => ({ id: p.id, name: p.name, status: by.get(p.id).status, rating: by.get(p.id).rating }));
}

/** Opens a new circle and moves the caller into it (out of any current circle: confirm first). */
export async function createCircle() {
  const { c } = await signedIn();
  return ok(await c.rpc("create_circle"));
}

/** RPC jsonb: {ok:true} | {ok:true, noop:true} | {error:'bad_code'} | {error:'in_other_circle', circle_names:[…]} */
export async function joinCircle(code, force = false) {
  const { c } = await signedIn();
  return ok(await c.rpc("join_circle", { code, force }));
}

export async function leaveCircle() {
  const { c } = await signedIn();
  ok(await c.rpc("leave_circle"));
}

/** The caller's vote on a joint pick in their current circle. */
export async function vote(tmdbId, v) {
  if (v !== "yes" && v !== "skip") throw new Error("vote must be yes or skip");
  const { c, user } = await signedIn();
  const cid = ok(await c.from("profiles").select("circle_id").eq("id", user.id).maybeSingle());
  if (!cid || !cid.circle_id) throw new Error("no circle");
  ok(await c.from("pick_votes").upsert({ circle_id: cid.circle_id, tmdb_id: tmdbId, user_id: user.id, vote: v }, { onConflict: "circle_id,tmdb_id,user_id" }));
}

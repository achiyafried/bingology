// Permission (RLS) tests against the separate TEST Supabase project.
// Skipped entirely when SUPABASE_TEST_URL is not in the environment (CI without secrets, plain `npm test`).
// Run: npm run test:rls   (loads .env)
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { adminCreateUser, rest, rpc, resetDb } from "./lib/supa.mjs";

const enabled = Boolean(process.env.SUPABASE_TEST_URL);
const nothing = (r) => r.status === 401 || r.status === 403 || (r.status === 200 && r.json.length === 0);
const today = () => new Date().toISOString().slice(0, 10); // DB current_date is UTC

describe("personal area RLS", { skip: !enabled && "SUPABASE_TEST_URL not set" }, () => {
  let A, B, C, codeA;
  const SHOW = 1399; // tmdb id used for A's entry
  const events = async (who, tmdb = SHOW) =>
    (await rest(who.token, "GET", `events?user_id=eq.${A.id}&tmdb_id=eq.${tmdb}&select=kind,rating,season&order=id`)).json;

  before(async () => {
    [A, B, C] = await Promise.all([adminCreateUser(), adminCreateUser(), adminCreateUser()]);
    for (const [u, name] of [[A, "Ann"], [B, "Ben"], [C, "Cal"]]) {
      const r = await rest(u.token, "POST", "profiles", { id: u.id, name });
      assert.equal(r.status, 201, JSON.stringify(r.json));
    }
    const made = await rpc(A.token, "create_circle");
    assert.equal(made.status, 200, JSON.stringify(made.json));
    assert.match(made.json.invite_code, /^[A-Za-z0-9]{10}$/);
    codeA = made.json.invite_code;
    const joined = await rpc(B.token, "join_circle", { code: codeA });
    assert.deepEqual(joined.json, { ok: true });
  });

  after(() => resetDb());

  test("a user cannot write another user's profile or set their own circle_id directly", async () => {
    const denied = (r) => r.status === 401 || r.status === 403;
    const fresh = await rest(C.token, "POST", "profiles", { id: randomUUID(), name: "ghost" });
    assert.ok(denied(fresh), `insert of a profile that is not mine must be refused, got ${fresh.status}`);
    const upsert = await rest(C.token, "POST", "profiles?on_conflict=id", { id: A.id, name: "hijack" },
      "return=representation,resolution=merge-duplicates");
    assert.ok(denied(upsert), `upsert onto another user's profile must be refused, got ${upsert.status}`);
    assert.deepEqual((await rest(A.token, "GET", `profiles?id=eq.${A.id}&select=name`)).json, [{ name: "Ann" }]);
    const own = await rest(C.token, "PATCH", `profiles?id=eq.${C.id}`, { circle_id: (await rest(A.token, "GET", "circles?select=id")).json[0].id });
    assert.ok(denied(own), `setting circle_id directly must be refused, got ${own.status}`);
    const renamed = await rest(B.token, "PATCH", `profiles?id=eq.${A.id}`, { name: "x" });
    assert.deepEqual(renamed.json, []);
  });

  test("profiles and circles are visible only inside the circle", async () => {
    const seenByB = (await rest(B.token, "GET", "profiles?select=name&order=name")).json.map((p) => p.name);
    assert.deepEqual(seenByB, ["Ann", "Ben"]);
    const seenByC = (await rest(C.token, "GET", "profiles?select=name")).json.map((p) => p.name);
    assert.deepEqual(seenByC, ["Cal"]);
    assert.equal((await rest(B.token, "GET", "circles?select=invite_code")).json[0].invite_code, codeA);
    assert.deepEqual((await rest(C.token, "GET", "circles?select=id")).json, []);
    assert.ok(nothing(await rest(null, "GET", "profiles?select=id")), "anon reads no profiles");
  });

  test("entries: own write, circle read, outsiders see nothing, others cannot change", async () => {
    const w = await rest(A.token, "POST", "entries", { user_id: A.id, tmdb_id: SHOW, status: "want", title: "GoT", note: "must see" });
    assert.equal(w.status, 201, JSON.stringify(w.json));
    assert.equal((await rest(B.token, "GET", `entries?user_id=eq.${A.id}&select=tmdb_id`)).json.length, 1);
    assert.deepEqual((await rest(C.token, "GET", `entries?user_id=eq.${A.id}&select=tmdb_id`)).json, []);
    assert.ok(nothing(await rest(null, "GET", "entries?select=tmdb_id")), "anon reads no entries");

    const upd = await rest(B.token, "PATCH", `entries?user_id=eq.${A.id}&tmdb_id=eq.${SHOW}`, { rating: 1 });
    assert.deepEqual(upd.json, []);
    const del = await rest(B.token, "DELETE", `entries?user_id=eq.${A.id}&tmdb_id=eq.${SHOW}`);
    assert.deepEqual(del.json, []);
    const forged = await rest(B.token, "POST", "entries", { user_id: A.id, tmdb_id: 1, status: "want" });
    assert.ok(forged.status >= 400, `expected failure, got ${forged.status}`);
    const mine = (await rest(A.token, "GET", `entries?tmdb_id=eq.${SHOW}&select=rating,status`)).json;
    assert.deepEqual(mine, [{ rating: null, status: "want" }]);
  });

  test("profile name is 1..40 chars", async () => {
    const long = await rest(A.token, "PATCH", `profiles?id=eq.${A.id}`, { name: "x".repeat(41) });
    assert.equal(long.status, 400);
    assert.equal(long.json.code, "23514", "check violation");
    const empty = await rest(A.token, "PATCH", `profiles?id=eq.${A.id}`, { name: "" });
    assert.equal(empty.json.code, "23514");
    assert.deepEqual((await rest(A.token, "GET", `profiles?id=eq.${A.id}&select=name`)).json, [{ name: "Ann" }]);
  });

  test("entries checks: title <= 200, poster must be a TMDB image URL", async () => {
    for (const bad of [{ poster: "javascript:alert(1)" }, { poster: "https://evil.example/t/p/w342/a.jpg" }, { title: "t".repeat(201) }]) {
      const r = await rest(C.token, "POST", "entries", { user_id: C.id, tmdb_id: 9, status: "want", ...bad });
      assert.equal(r.status, 400, JSON.stringify(bad));
      assert.equal(r.json.code, "23514", "check violation");
    }
    const ok = await rest(C.token, "POST", "entries", { user_id: C.id, tmdb_id: 9, status: "want", title: "Ok", poster: "https://image.tmdb.org/t/p/w342/abc.jpg" });
    assert.equal(ok.status, 201, JSON.stringify(ok.json));
  });

  test("entries checks: status, rating 1..10, note <= 140", async () => {
    for (const bad of [{ status: "maybe" }, { status: "seen", rating: 11 }, { status: "seen", rating: 0 }, { status: "want", note: "x".repeat(141) }]) {
      const r = await rest(A.token, "POST", "entries", { user_id: A.id, tmdb_id: 7, ...bad });
      assert.equal(r.status, 400, JSON.stringify(bad));
    }
  });

  test("events: written only by the trigger, read only inside the circle", async () => {
    const before = (await events(A)).map((e) => e.kind);
    assert.deepEqual(before, ["wanted"]);

    const up = await rest(A.token, "POST", "entries?on_conflict=user_id,tmdb_id",
      { user_id: A.id, tmdb_id: SHOW, status: "watching", season: 1, episode: 1 },
      "return=representation,resolution=merge-duplicates");
    assert.equal(up.status, 200, JSON.stringify(up.json));
    assert.deepEqual((await events(A)).map((e) => e.kind), ["wanted", "started"]);

    await rest(A.token, "PATCH", `entries?user_id=eq.${A.id}&tmdb_id=eq.${SHOW}`, { episode: 2 });
    assert.deepEqual((await events(A)).map((e) => e.kind), ["wanted", "started"], "episode only: no event");

    await rest(A.token, "PATCH", `entries?user_id=eq.${A.id}&tmdb_id=eq.${SHOW}`, { rating: 9 });
    const rated = await events(A);
    assert.deepEqual(rated.map((e) => e.kind), ["wanted", "started", "rated"]);
    assert.equal(rated[2].rating, 9);

    const seen = await rest(A.token, "PATCH", `entries?user_id=eq.${A.id}&tmdb_id=eq.${SHOW}`, { status: "seen" });
    assert.equal(seen.json[0].finished_on, today());
    assert.deepEqual((await events(A)).map((e) => e.kind), ["wanted", "started", "rated", "finished"]);

    assert.equal((await events(B)).length, 4, "circle friend reads events");
    assert.deepEqual(await events(C), [], "outsider reads no events");
    assert.ok(nothing(await rest(null, "GET", "events?select=id")), "anon reads no events");

    const circle = (await rest(A.token, "GET", "circles?select=id")).json[0].id;
    const forged = await rest(A.token, "POST", "events", { user_id: A.id, circle_id: circle, tmdb_id: 1, kind: "finished" });
    assert.ok([401, 403].includes(forged.status), `insert into events must be refused, got ${forged.status}`);
    const edited = await rest(A.token, "PATCH", `events?user_id=eq.${A.id}`, { kind: "dropped" });
    assert.ok(edited.status >= 400 || edited.json.length === 0, "events cannot be updated");
    const wiped = await rest(A.token, "DELETE", `events?user_id=eq.${A.id}`);
    assert.ok(wiped.status >= 400 || wiped.json.length === 0, "events cannot be deleted");
    assert.equal((await events(A)).length, 4);
  });

  test("finished_on stays editable once seen", async () => {
    const r = await rest(A.token, "PATCH", `entries?user_id=eq.${A.id}&tmdb_id=eq.${SHOW}`, { finished_on: "2024-05-01" });
    assert.equal(r.json[0].finished_on, "2024-05-01");
  });

  test("finished_on: inserted as seen stays null (unknown date)", async () => {
    const r = await rest(C.token, "POST", "entries", { user_id: C.id, tmdb_id: 4242, status: "seen", title: "Old mark", poster: null }, "return=representation");
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json[0].finished_on, null);
  });

  test("events: seen rows inserted without a date (migration) write no event; watching to seen still does", async () => {
    const ev = async (id) => (await rest(B.token, "GET", `events?user_id=eq.${A.id}&tmdb_id=eq.${id}&select=kind`)).json;
    for (const id of [7001, 7002, 7003]) {
      const r = await rest(A.token, "POST", "entries", { user_id: A.id, tmdb_id: id, status: "seen", title: "Old", poster: null });
      assert.equal(r.status, 201, JSON.stringify(r.json));
      assert.deepEqual(await ev(id), [], "no event for a seen insert with unknown date");
    }
    await rest(A.token, "POST", "entries", { user_id: A.id, tmdb_id: 7004, status: "watching", title: "Now", poster: null });
    assert.deepEqual((await ev(7004)).map((e) => e.kind), ["started"]);
    await rest(A.token, "PATCH", `entries?user_id=eq.${A.id}&tmdb_id=eq.7004`, { status: "seen" });
    assert.deepEqual((await ev(7004)).map((e) => e.kind), ["started", "finished"]);
    await rest(A.token, "DELETE", `entries?user_id=eq.${A.id}&tmdb_id=in.(7001,7002,7003,7004)`); // keep later tests' counts intact
  });

  test("pick_votes: circle reads, own writes only", async () => {
    const circle = (await rest(A.token, "GET", "circles?select=id")).json[0].id;
    const ok = await rest(B.token, "POST", "pick_votes", { circle_id: circle, tmdb_id: SHOW, user_id: B.id, vote: "skip" });
    assert.equal(ok.status, 201, JSON.stringify(ok.json));
    const forged = await rest(B.token, "POST", "pick_votes", { circle_id: circle, tmdb_id: SHOW, user_id: A.id, vote: "yes" });
    assert.ok(forged.status >= 400);
    const outsider = await rest(C.token, "POST", "pick_votes", { circle_id: circle, tmdb_id: SHOW, user_id: C.id, vote: "yes" });
    assert.ok(outsider.status >= 400, "cannot vote in a circle you are not in");
    assert.equal((await rest(A.token, "GET", "pick_votes?select=vote")).json.length, 1);
    assert.deepEqual((await rest(C.token, "GET", "pick_votes?select=vote")).json, []);
  });

  test("join_circle: bad code, own code noop, other circle needs force, empty old circle is dropped", async () => {
    assert.deepEqual((await rpc(C.token, "join_circle", { code: "nope" })).json, { error: "bad_code" });
    assert.deepEqual((await rpc(A.token, "join_circle", { code: codeA })).json, { ok: true, noop: true });

    const own = await rpc(C.token, "create_circle");
    assert.equal(own.status, 200);
    const refused = await rpc(C.token, "join_circle", { code: codeA });
    assert.equal(refused.json.error, "in_other_circle");
    assert.deepEqual(refused.json.circle_names, [], "C was alone in its own circle");
    assert.deepEqual((await rpc(B.token, "join_circle", { code: own.json.invite_code })).json,
      { error: "in_other_circle", circle_names: ["Ann"] }, "B is told who it would leave");
    assert.deepEqual((await rest(C.token, "GET", `entries?user_id=eq.${A.id}&select=tmdb_id`)).json, [], "still outside");

    const forced = await rpc(C.token, "join_circle", { code: codeA, force: true });
    assert.deepEqual(forced.json, { ok: true });
    assert.equal((await rest(C.token, "GET", `entries?user_id=eq.${A.id}&select=tmdb_id`)).json.length, 1, "now inside");
    // C's old circle had only C, so the trigger removed it: C now sees exactly one circle (A's).
    const circles = (await rest(C.token, "GET", "circles?select=id,invite_code")).json;
    assert.deepEqual(circles.map((c) => c.invite_code), [codeA]);
    assert.deepEqual((await rpc(C.token, "join_circle", { code: own.json.invite_code })).json, { error: "bad_code" });
  });

  test("shared_profile: name + entries while the slug is on, null when off", async () => {
    const slug = randomBytes(9).toString("base64url");
    const on = await rest(A.token, "PATCH", `profiles?id=eq.${A.id}`, { share_slug: slug });
    assert.equal(on.status, 200, JSON.stringify(on.json));

    const shared = await rpc(null, "shared_profile", { slug });
    assert.equal(shared.status, 200, JSON.stringify(shared.json));
    assert.deepEqual(Object.keys(shared.json).sort(), ["entries", "name"]);
    assert.equal(shared.json.name, "Ann");
    assert.equal(shared.json.entries.length, 1);
    assert.equal(shared.json.entries[0].tmdb_id, SHOW);
    assert.equal(shared.json.entries[0].note, "must see");
    for (const k of ["user_id", "circle_id", "kind"]) assert.ok(!(k in shared.json.entries[0]), `no ${k}`);

    assert.equal((await rpc(null, "shared_profile", { slug: "unknown-slug-123" })).json, null);
    await rest(A.token, "PATCH", `profiles?id=eq.${A.id}`, { share_slug: null });
    assert.equal((await rpc(null, "shared_profile", { slug })).json, null);
    assert.equal((await rpc(null, "shared_profile", { slug: null })).json, null);
  });

  test("leave_circle: a leaver's pick votes disappear for the old circle", async () => {
    assert.equal((await rest(A.token, "GET", `pick_votes?user_id=eq.${B.id}&select=vote`)).json.length, 1);
    assert.equal((await rpc(B.token, "leave_circle")).status, 204);
    assert.deepEqual((await rest(A.token, "GET", `pick_votes?user_id=eq.${B.id}&select=vote`)).json, []);
  });

  test("leave_circle: friends stop seeing my entries and events", async () => {
    // C (joined A's circle earlier) is the remaining friend and observer.
    assert.equal((await rest(C.token, "GET", `entries?user_id=eq.${A.id}&select=tmdb_id`)).json.length, 1);
    assert.equal((await events(C)).length, 4);
    const r = await rpc(A.token, "leave_circle");
    assert.equal(r.status, 204, JSON.stringify(r.json));
    assert.deepEqual((await rest(C.token, "GET", `entries?user_id=eq.${A.id}&select=tmdb_id`)).json, []);
    assert.deepEqual(await events(C), []);
    assert.deepEqual((await rest(C.token, "GET", `profiles?id=eq.${A.id}&select=name`)).json, []);
    assert.equal((await rest(A.token, "GET", "entries?select=tmdb_id")).json.length, 1, "own data kept");
  });

  test("anonymous callers cannot use the circle RPCs", async () => {
    assert.ok((await rpc(null, "create_circle")).status >= 400);
    assert.ok((await rpc(null, "join_circle", { code: codeA })).status >= 400);
  });
});

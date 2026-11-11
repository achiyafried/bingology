// Tiny fetch helpers for tests that talk to the TEST Supabase project.
// Reads SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY (publishable) and SUPABASE_TEST_SERVICE_KEY (secret) from process.env.
import { randomBytes } from "node:crypto";

export const EMAIL_PREFIX = "rls-t-";
const env = (k) => process.env[k];
const base = () => env("SUPABASE_TEST_URL").replace(/\/$/, "");
const created = [];

async function call(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

function adminHeaders() {
  return { apikey: env("SUPABASE_TEST_SERVICE_KEY"), "Content-Type": "application/json" };
}

/** Creates an auto-confirmed user with a random password and signs in. Returns {id, token, email}. */
export async function adminCreateUser(email = `${EMAIL_PREFIX}${randomBytes(6).toString("hex")}@example.com`) {
  const password = randomBytes(18).toString("base64url");
  const made = await call(`${base()}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (made.status >= 300) throw new Error(`admin create user failed: ${made.status} ${JSON.stringify(made.json)}`);
  created.push(made.json.id);
  const signed = await call(`${base()}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env("SUPABASE_TEST_ANON_KEY"), "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (signed.status >= 300) throw new Error(`sign in failed: ${signed.status} ${JSON.stringify(signed.json)}`);
  return { id: made.json.id, token: signed.json.access_token, email };
}

/** PostgREST request as a user (token) or anonymously (token = null). path like "entries?select=*". */
export function rest(token, method, path, body, prefer = "return=representation") {
  const headers = { apikey: env("SUPABASE_TEST_ANON_KEY"), "Content-Type": "application/json", Prefer: prefer };
  if (token) headers.Authorization = `Bearer ${token}`;
  return call(`${base()}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Calls a Postgres function exposed by PostgREST. */
export function rpc(token, fn, args = {}) {
  return rest(token, "POST", `rpc/${fn}`, args, "");
}

async function deleteUser(id) {
  return call(`${base()}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: adminHeaders() });
}

/** Deletes users created in this run plus leftovers from earlier runs (by email prefix). Rows cascade. */
export async function resetDb() {
  for (const id of created.splice(0)) await deleteUser(id);
  for (let page = 1; page < 20; page++) {
    const list = await call(`${base()}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: adminHeaders() });
    const users = list.json?.users ?? [];
    for (const u of users) {
      const stale = Date.now() - Date.parse(u.created_at) > 10 * 60e3; // leave a concurrent run's users alone
      if (stale && u.email?.startsWith(EMAIL_PREFIX) && u.email.endsWith("@example.com")) await deleteUser(u.id);
    }
    if (users.length < 200) break;
  }
}

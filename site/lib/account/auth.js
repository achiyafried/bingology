import { getClient } from "./client.js";

const redirect = () => location.origin + location.pathname;
const toUser = u => u && { id: u.id, email: u.email || "", name: (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || "" };

export async function currentUser() {
  const { data } = await (await getClient()).auth.getSession();
  return toUser(data && data.session && data.session.user) || null;
}

export async function signInGoogle() {
  const { error } = await (await getClient()).auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect() } });
  if (error) throw error;
}

export async function signInEmail(email) {
  const { error } = await (await getClient()).auth.signInWithOtp({ email, options: { emailRedirectTo: redirect() } });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await (await getClient()).auth.signOut();
  if (error) throw error;
}

/** Returns { profile, created }: the user's profile row, creating it (name trimmed to 40) when missing. */
export async function ensureProfile(defaultName) {
  const c = await getClient();
  const user = await currentUser();
  if (!user) throw new Error("not signed in");
  const got = await c.from("profiles").select("id,name,circle_id,share_slug").eq("id", user.id).maybeSingle();
  if (got.error) throw got.error;
  if (got.data) return { profile: got.data, created: false };
  const name = String(defaultName || "").trim().slice(0, 40) || "Bingologist";
  const ins = await c.from("profiles").insert({ id: user.id, name }).select("id,name,circle_id,share_slug").single();
  if (ins.error) throw ins.error;
  return { profile: ins.data, created: true };
}

/** Sets the display name (trimmed, 1–40 chars); returns the updated profile row. */
export async function setName(name) {
  const n = String(name || "").trim().slice(0, 40);
  if (!n) throw new Error("empty name");
  const c = await getClient();
  const user = await currentUser();
  if (!user) throw new Error("not signed in");
  const r = await c.from("profiles").update({ name: n }).eq("id", user.id).select("id,name,circle_id,share_slug").single();
  if (r.error) throw r.error;
  return r.data;
}

/** cb(user|null) on every auth change; returns an unsubscribe function. */
export async function onAuth(cb) {
  const { data } = (await getClient()).auth.onAuthStateChange((_e, session) => cb(toUser(session && session.user) || null));
  return () => data.subscription.unsubscribe();
}

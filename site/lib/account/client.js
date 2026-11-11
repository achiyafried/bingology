import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
let clientP = null;

/** Memoized, loaded on demand. Rejects if the CDN fails (and retries on the next call). */
export function getClient() {
  if (!clientP) {
    clientP = import(CDN)
      .then(m => m.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } }))
      .catch(e => { clientP = null; throw e; });
  }
  return clientP;
}

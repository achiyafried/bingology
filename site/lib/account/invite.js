// Bringing a friend into the circle: shared by the profile card (views/mine.js) and the header button (app.js).
// Loaded with import() only.
import { createCircle, inviteUrl, loadCircle } from "./circle.js";

/** The message that goes before every shared link (owner's wording). */
export const SHARE_TEXT = "wanna binge? join bingology at";

export const CIRCLE_OPENED = "המעגל נפתח. עכשיו שלחו לחברים קישור הזמנה.";

/** Web Share the invite link, else copy it + toast. A cancelled share (AbortError) does nothing. ctx: {toast(msg, url?), copy(text) -> Promise<bool>} */
export async function shareInvite(url, ctx) {
  if (navigator.share) {
    try { await navigator.share({ title: "Bingology", text: SHARE_TEXT, url }); return; }
    catch (e) { if (e && e.name === "AbortError") return; }
  }
  const ok = ctx.copy ? await ctx.copy(`${SHARE_TEXT} ${url}`) : false;
  if (ctx.toast) ctx.toast(ok ? "קישור ההזמנה הועתק. שלחו אותו למי שתרצו במעגל." : "זה קישור ההזמנה. העתיקו אותו ושלחו לחברים.", url);
}

/** Header flow: open a circle when there is none (toast the notice), then share the invite link. Throws when the account is unreachable. */
export async function inviteFriend(ctx) {
  let { circle } = await loadCircle();
  if (!circle) {
    await createCircle();
    ({ circle } = await loadCircle());
    if (!circle) throw new Error("circle missing");
    if (ctx.toast) ctx.toast(CIRCLE_OPENED);
  }
  await shareInvite(inviteUrl(circle.invite_code), ctx);
}

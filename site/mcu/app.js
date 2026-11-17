// The MCU page: loads mcu-data.json, keeps the viewer's choices and seen marks, paints the timeline.
import { visible, ordered, groups, nextUp, progress } from "./timeline.js";
import { loadSeen, saveSeen, loadPref, savePref } from "./seen.js";
import { headerHTML, nextHTML, listHTML, gridHTML, upcomingHTML, cardHTML, cardSeenHTML, focusSelector } from "./view.js";
import { playerHTML, unavailableHTML, ytErrorCode, YT_ORIGINS } from "../lib/trailer.js";

const store = (() => { try { return window.localStorage; } catch { return null; } })();
const THEMES = ["cosmic", "comic", "hud"], ORDERS = ["story", "release"], VIEWS = ["list", "grid"];
const KEY = { theme: "bingology:mcu-theme", order: "bingology:mcu-order", view: "bingology:mcu-view" };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
const { ids, ok } = loadSeen(store);
const st = {
  items: [], cardId: null, seen: ids, stored: ok,
  theme: loadPref(store, KEY.theme, THEMES, "cosmic"),
  order: loadPref(store, KEY.order, ORDERS, "story"),
  view: loadPref(store, KEY.view, VIEWS, "list"),
};
const root = document.getElementById("mcu");
const dlg = document.getElementById("mcard");
const byId = id => st.items.find(x => x.id === id);

function applyTheme() { document.documentElement.className = `theme-${st.theme}`; }

function render() {
  const { released, upcoming } = visible(st.items, today());
  const { done, total } = progress(released, st.seen);
  const body = st.view === "grid" ? gridHTML(ordered(released, st.order), st.seen) : listHTML(groups(released, st.order), st.seen);
  root.innerHTML = headerHTML({ theme: st.theme, order: st.order, view: st.view, done, total })
    + (st.stored ? "" : `<p class="m-warn" role="status">הסימונים לא יישמרו בדפדפן הזה (גלישה בסתר או אחסון חסום).</p>`)
    + nextHTML(nextUp(released, st.seen, st.order))
    + body + upcomingHTML(upcoming)
    + `<footer class="m-foot">This product uses the TMDB API but is not endorsed or certified by TMDB. Marvel ו-MCU הם סימנים של Marvel ו-Disney. האתר אינו קשור אליהן.</footer>`;
}

function paintCard() {
  const x = byId(st.cardId); if (!x) return;
  dlg.innerHTML = cardHTML(x, st.seen);
}

function toggleSeen(id, el) {
  if (st.seen.has(id)) st.seen.delete(id); else st.seen.add(id);
  if (!saveSeen(store, st.seen)) st.stored = false;
  renderKeepFocus(el);
  const btn = dlg.open && dlg.querySelector(".m-cacts [data-a=seen]");
  if (btn && st.cardId === id) btn.outerHTML = cardSeenHTML({ id }, st.seen.has(id));
}
function closeCard() { dlg.innerHTML = ""; st.cardId = null; if (dlg.open) dlg.close(); } // removing the iframe stops the sound

/** The player reports errors only after the IFrame API handshake. */
function watchPlayer(box) {
  const f = box && box.querySelector(".tvid iframe"); if (!f) return;
  f.addEventListener("load", () => {
    const w = f.contentWindow; if (!w) return;
    const send = m => w.postMessage(JSON.stringify({ ...m, id: 1, channel: "widget" }), YT_ORIGINS[0]);
    send({ event: "listening" });
    send({ event: "command", func: "addEventListener", args: ["onError"] });
  });
}
window.addEventListener("message", e => {
  if (!YT_ORIGINS.includes(e.origin) || ytErrorCode(e.data) === null) return;
  const f = [...document.querySelectorAll(".tvid iframe")].find(x => x.contentWindow === e.source); if (!f) return;
  const x = byId(st.cardId); if (!x) return;
  const row = f.closest(".trail") || f.closest(".tvid");
  row.outerHTML = unavailableHTML({ n: x.name });
});

/** Repaints the page and gives focus back to the control that was used (it is a new element after the repaint). */
function renderKeepFocus(el) {
  const inPage = root.contains(el), sel = inPage && focusSelector(el.dataset);
  render();
  const again = sel && root.querySelector(sel);
  if (again) again.focus();
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

document.addEventListener("click", e => {
  const el = e.target.closest("[data-a]"); if (!el) return;
  const a = el.dataset.a, v = el.dataset.v, id = el.dataset.id;
  if (a === "copylink") {
    copy(el.dataset.u).then(ok => { el.textContent = ok ? "הקישור הועתק" : "לא הצלחנו להעתיק"; });
    return;
  }
  if (a === "theme" || a === "order" || a === "view") {
    st[a] = v; savePref(store, KEY[a], v);
    if (a === "theme") applyTheme();
    renderKeepFocus(el);
  } else if (a === "seen") toggleSeen(id, el);
  else if (a === "open") { st.cardId = id; paintCard(); if (!dlg.open) dlg.showModal(); }
  else if (a === "close") closeCard();
  else if (a === "trail") {
    const x = byId(id), row = el.closest(".trail"); if (!x || !row) return;
    row.innerHTML = playerHTML(x.trailer, x.name, 0, location.origin);
    row.classList.add("on"); watchPlayer(row);
    const f = row.querySelector("iframe"); if (f) f.focus();
  }
});
dlg.addEventListener("click", e => { if (e.target === dlg) closeCard(); });
dlg.addEventListener("close", () => { dlg.innerHTML = ""; st.cardId = null; }); // Esc

async function boot() {
  applyTheme();
  try {
    const r = await fetch("mcu-data.json", { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);
    st.items = (await r.json()).items || [];
    render();
  } catch {
    root.innerHTML = `<p class="m-warn">לא הצלחנו לטעון את ציר הזמן. נסו לרענן בעוד רגע.</p>`;
  }
}
boot();

// The kids page: loads kids-data.json, keeps the age group and today's game, paints the grid or the game.
import { inGroup, servicesIn, pickServices, byServices } from "./catalog.js";
import { puzzleFor, initGame, guess } from "./game.js";
import { loadAge, saveAge, loadGame, saveGame, loadMute, saveMute } from "./store.js";
import { parseRoute, backHash, shellHTML, homeHTML } from "./play.js";
import { headerHTML, servicesHTML, gridHTML, cardHTML, gameHTML } from "./view.js";
import { israelToday } from "../lib/games/day.js";

const store = (() => { try { return window.localStorage; } catch { return null; } })();
const root = document.getElementById("kids");
const dlg = document.getElementById("kcard");
const st = { items: [], age: loadAge(store), services: [], game: null, puzzle: null, muted: loadMute(store) };
const FOOT = `<footer class="k-foot">This product uses the TMDB API but is not endorsed or certified by TMDB.</footer>`;

// Game views by route.game; Tasks 6-9 replace the stubs.
const empty = () => `<section></section>`;
const VIEWS = {
  home: () => homeHTML(st.items),
  puzzle: empty,
  memory: empty,
  scene: empty,
  clips: empty,
};

function setupGame() {
  const date = israelToday();
  st.puzzle = puzzleFor(st.items, date, st.age);
  st.game = st.puzzle ? { ...initGame(st.puzzle), ...(loadGame(store, date, st.age, st.puzzle) ?? {}), choices: st.puzzle.choices } : null;
}

function render() {
  root.dataset.age = st.age;
  const route = parseRoute(location.hash);
  if (route.game) {
    if (st.age !== "small") { history.replaceState(null, "", location.pathname + location.search); }
    else { root.innerHTML = shellHTML(VIEWS[route.game](route), { muted: st.muted }); return; }
  }
  const group = inGroup(st.items, st.age);
  const available = servicesIn(group);
  st.services = pickServices(st.services, available);
  const body = location.hash === "#game"
    ? gameHTML(st.puzzle, st.game, st.items)
    : servicesHTML(available, st.services) + gridHTML(byServices(group, st.services));
  root.innerHTML = headerHTML(st.age) + body
    + FOOT;
}

function openCard(id) {
  const x = st.items.find(i => i.tmdb === id); if (!x) return;
  dlg.innerHTML = cardHTML(x);
  if (!dlg.open) dlg.showModal();
}
function closeCard() { dlg.innerHTML = ""; if (dlg.open) dlg.close(); }

root.addEventListener("click", e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const { a, v } = b.dataset;
  if (a === "age" && v !== st.age) { st.age = v; saveAge(store, v); setupGame(); render(); }
  else if (a === "svc") {
    st.services = !v ? [] : st.services.includes(v) ? st.services.filter(p => p !== v) : [...st.services, v];
    render();
  }
  else if (a === "card") openCard(Number(v));
  else if (a === "game") { location.hash = "game"; }
  else if (a === "play") { location.hash = "play"; }
  else if (a === "go") { location.hash = `play/${v}`; }
  else if (a === "home") {
    const back = backHash(parseRoute(location.hash));
    if (back) location.hash = back;
    else { history.pushState(null, "", location.pathname + location.search); render(); }
  }
  else if (a === "mute") { st.muted = !st.muted; saveMute(store, st.muted); render(); }
  else if (a === "grid") { history.pushState(null, "", location.pathname + location.search); render(); }
  else if (a === "pick" && st.game) {
    st.game = guess(st.game, Number(v));
    saveGame(store, israelToday(), st.age, st.game);
    render();
  }
});
dlg.addEventListener("click", e => {
  if (e.target === dlg || e.target.closest("[data-a=close]")) closeCard();
});
window.addEventListener("hashchange", () => { closeCard(); render(); window.scrollTo(0, 0); });

fetch("kids-data.json", { cache: "no-cache" })
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(d => { st.items = Array.isArray(d.items) ? d.items : []; setupGame(); render(); })
  .catch(() => { root.innerHTML = headerHTML(st.age) + `<p class="k-empty" role="alert">לא הצלחנו לטעון את הסדרות. נסו שוב מאוחר יותר.</p>`; });

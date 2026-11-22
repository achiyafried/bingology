// The kids page: loads kids-data.json, keeps the age group and today's game, paints the grid or the game.
import { inGroup, servicesIn, pickServices, byServices } from "./catalog.js";
import { puzzleFor, initGame, guess } from "./game.js";
import { loadAge, saveAge, loadGame, saveGame, loadMute, saveMute, loadLevel, bumpLevel } from "./store.js";
import { makeSound } from "./sound.js";
import { withArt } from "./art.js";
import { initPuzzle, trySnap, solved, pickerHTML, puzzleHTML } from "./puzzle.js";
import { pairsFor, deal, flip, settle, won as memWon, memoryHTML } from "./memory.js";
import { parseRoute, backHash, shellHTML, homeHTML } from "./play.js";
import { headerHTML, servicesHTML, gridHTML, cardHTML, gameHTML } from "./view.js";
import { israelToday } from "../lib/games/day.js";

const store = (() => { try { return window.localStorage; } catch { return null; } })();
const root = document.getElementById("kids");
const dlg = document.getElementById("kcard");
const st = { items: [], age: loadAge(store), services: [], game: null, puzzle: null, jig: null, mem: null, muted: loadMute(store) };
const FOOT = `<footer class="k-foot">This product uses the TMDB API but is not endorsed or certified by TMDB.</footer>`;

const sound = makeSound(() => st.muted);

function puzzleView(route) {
  const arts = withArt(st.items);
  const item = route.arg ? arts.find(i => String(i.tmdb) === route.arg) : null;
  if (!item) { st.jig = null; return pickerHTML(st.items); }
  if (!st.jig || st.jig.tmdb !== item.tmdb) st.jig = initPuzzle(item.tmdb, loadLevel(store, "puzzle"));
  return puzzleHTML(item, st.jig);
}

function puzzleAgain() {
  const arts = withArt(st.items);
  const others = arts.filter(i => !st.jig || i.tmdb !== st.jig.tmdb);
  const pool = others.length ? others : arts;
  st.jig = null;
  if (!pool.length) { location.hash = "play/puzzle"; return; }
  const h = `#play/puzzle/${pool[Math.floor(Math.random() * pool.length)].tmdb}`;
  if (location.hash === h) render(); else location.hash = h;
}

function memoryView() {
  const arts = withArt(st.items);
  if (!st.mem) st.mem = deal(arts, pairsFor(loadLevel(store, "memory")));
  return memoryHTML(st.mem, arts);
}

function memFlip(i) {
  if (!st.mem) return;
  const next = flip(st.mem, i);
  if (next === st.mem) return;
  const matched = next.cards.filter(c => c.matched).length > st.mem.cards.filter(c => c.matched).length;
  st.mem = next;
  if (matched) sound.pair();
  const done = memWon(next);
  if (done) bumpLevel(store, "memory");
  else if (next.busy) memTimer = setTimeout(() => { memTimer = 0; if (st.mem) { st.mem = settle(st.mem); render(); } }, 1500);
  render();
  if (done) winTimer = setTimeout(() => sound.win(), 250);
}

// Drag a tray piece with a pointer: move it with transform, re-render only on drop.
let drag = null, winTimer = 0, memTimer = 0;
function endDrag() { if (drag) { drag.abort(); drag = null; } }
function startDrag(e) {
  const el = e.target.closest?.("[data-piece]");
  if (!el || !st.jig || e.button > 0) return;
  endDrag();
  e.preventDefault();
  const piece = Number(el.dataset.piece);
  const ac = new AbortController(), { signal } = ac;
  const x0 = e.clientX, y0 = e.clientY;
  el.setPointerCapture(e.pointerId);
  el.classList.add("k-dragging");
  el.addEventListener("pointermove", m => { el.style.transform = `translate(${m.clientX - x0}px,${m.clientY - y0}px)`; }, { signal });
  const finish = (up, drop) => {
    endDrag();
    const board = root.querySelector("[data-board]");
    if (drop && board) {
      const b = board.getBoundingClientRect(), r = el.getBoundingClientRect();
      const next = trySnap(st.jig, piece, r.left + r.width / 2 - b.left, r.top + r.height / 2 - b.top, { w: b.width, h: b.height });
      if (next !== st.jig) {
        st.jig = next;
        sound.snap();
        const won = solved(next) && !next.won;
        if (won) { next.won = true; bumpLevel(store, "puzzle"); }
        render();
        if (won) winTimer = setTimeout(() => sound.win(), 250);
        return;
      }
    }
    el.classList.remove("k-dragging");
    el.style.transform = "";
  };
  el.addEventListener("pointerup", () => finish(true, true), { signal });
  el.addEventListener("pointercancel", () => finish(false, false), { signal });
  drag = ac;
}
root.addEventListener("pointerdown", startDrag);

// Game views by route.game; Tasks 7-9 replace the stubs.
const empty = () => `<section></section>`;
const VIEWS = {
  home: () => homeHTML(st.items),
  puzzle: puzzleView,
  memory: memoryView,
  scene: empty,
  clips: empty,
};

function setupGame() {
  const date = israelToday();
  st.puzzle = puzzleFor(st.items, date, st.age);
  st.game = st.puzzle ? { ...initGame(st.puzzle), ...(loadGame(store, date, st.age, st.puzzle) ?? {}), choices: st.puzzle.choices } : null;
}

function render() {
  endDrag();
  clearTimeout(winTimer);
  const route = parseRoute(location.hash);
  if (route.game !== "memory") { st.mem = null; clearTimeout(memTimer); memTimer = 0; }
  root.dataset.age = st.age;
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
  else if (a === "again") puzzleAgain();
  else if (a === "mem-flip") memFlip(Number(v));
  else if (a === "mem-again") { clearTimeout(memTimer); memTimer = 0; st.mem = null; render(); }
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

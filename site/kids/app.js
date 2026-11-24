// The kids page: loads kids-data.json, keeps the age group and today's game, paints the grid or the game.
import { inGroup, servicesIn, pickServices, byServices } from "./catalog.js";
import { puzzleFor, initGame, guess } from "./game.js";
import { loadAge, saveAge, loadGame, saveGame, loadMute, saveMute, loadPuzzleSize, savePuzzleSize, loadMemorySize, saveMemorySize, loadScene, saveScene, clearScene, loadPlayers, savePlayers, loadPlayer, savePlayer, loadNoName, saveNoName } from "./store.js";
import { makeSound } from "./sound.js";
import { withArt } from "./art.js";
import { initPuzzle, trySnap, solved, pickerHTML, puzzleHTML, levelsHTML, puzzleScreen, boardFor, onLevels, confettiHTML } from "./puzzle.js";
import { pickTargets, tryFill, allFilled, blocksFreeDrop } from "./silhouette.js";
import { pickBubble, bubbleHTML, MAX_BUBBLES, SPAWN_MS } from "./bubbles.js";
import { pickCheer, cleanName, cheerHTML, makeSpeaker, playersHTML, whoHTML, MAX_PLAYERS } from "./cheers.js";
import { deal, flip, settle, won as memWon, memoryHTML, memoryScreen, memLevelsHTML } from "./memory.js";
import { addSticker, moveSticker, removeSticker, outside, placesHTML, sceneHTML, circleStyle } from "./scene.js";
import { SCENES } from "./scenes.js";
import { withClips, onPlayerMessage, afterError, clipsPickerHTML, clipScreenHTML } from "./clips.js";
import { YT_ORIGINS } from "../lib/trailer.js";
import { parseRoute, gameRouteFor, backHash, shellHTML, homeHTML } from "./play.js";
import { headerHTML, servicesHTML, gridHTML, cardHTML, gameHTML } from "./view.js";
import { israelToday } from "../lib/games/day.js";

const store = (() => { try { return window.localStorage; } catch { return null; } })();
const root = document.getElementById("kids");
const dlg = document.getElementById("kcard");
const st = { whoG: "m", items: [], age: loadAge(store), services: [], game: null, puzzle: null, jig: null, mem: null, scn: null, clip: null, muted: loadMute(store) };
const FOOT = `<footer class="k-foot">This product uses the TMDB API but is not endorsed or certified by TMDB.</footer>`;

const sound = makeSound(() => st.muted);

// Personal cheers: the current child's name, shown big and spoken (only in a tap handler, so iOS lets it speak).
const speak = makeSpeaker(() => st.muted);
try { globalThis.speechSynthesis?.getVoices(); } catch {} // voices load lazily; ask early
let lastCheer = -1, cheerTimer = 0, pairsFound = 0, pops = 0, speechReady = false;
/** iOS unlocks speech only from a real tap: say nothing, once, from a click (the bubbles pop on pointerdown, which doesn't count). */
function unlockSpeech() {
  if (speechReady) return;
  speechReady = true;
  try { const u = new SpeechSynthesisUtterance(""); u.volume = 0; speechSynthesis.speak(u); } catch {}
}
function cheer() {
  const players = loadPlayers(store), p = players.length ? players[Math.min(loadPlayer(store), players.length - 1)] : null;
  const c = pickCheer(p, Math.random, lastCheer);
  lastCheer = c.idx;
  document.querySelector(".k-cheer")?.remove();
  clearTimeout(cheerTimer);
  document.body.insertAdjacentHTML("beforeend", cheerHTML(c.text));
  cheerTimer = setTimeout(() => document.querySelector(".k-cheer")?.remove(), 2300);
  speak(c.text);
}

function puzzleView(route) {
  const screen = puzzleScreen(route, st.items);
  if (screen === "picker") { st.jig = null; return pickerHTML(st.items); }
  const item = withArt(st.items).find(i => String(i.tmdb) === route.arg);
  if (screen === "levels") { st.jig = onLevels(st.jig); return levelsHTML(item, loadPuzzleSize(store)); }
  const n = Number(route.sub);
  savePuzzleSize(store, n);
  st.jig = boardFor(st.jig, item.tmdb, n);
  return puzzleHTML(item, st.jig);
}

function puzzleAgain() {
  const arts = withArt(st.items);
  const n = st.jig ? st.jig.n : loadPuzzleSize(store);
  const others = arts.filter(i => !st.jig || i.tmdb !== st.jig.tmdb);
  const pool = others.length ? others : arts;
  st.jig = null;
  if (!pool.length) { location.hash = "play/puzzle"; return; }
  const h = `#play/puzzle/${pool[Math.floor(Math.random() * pool.length)].tmdb}/${n}`;
  if (location.hash === h) render(); else location.hash = h;
}

function memoryView(route) {
  const arts = withArt(st.items);
  if (memoryScreen(route, st.items) === "levels") { st.mem = null; clearTimeout(memTimer); memTimer = 0; return memLevelsHTML(loadMemorySize(store), st.items); }
  const n = Number(route.arg);
  saveMemorySize(store, n);
  if (!st.mem || st.mem.cards.length !== n) { clearTimeout(memTimer); memTimer = 0; pairsFound = 0; st.mem = deal(arts, n / 2); } // no stale settle on a new board
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
  if (matched) pairsFound++;
  const cheerNow = done || (matched && pairsFound % 2 === 0);
  if (!done && next.busy) memTimer = setTimeout(() => { memTimer = 0; if (st.mem) { st.mem = settle(st.mem); render(); } }, 1500);
  render();
  if (cheerNow) cheer();
  if (done) winTimer = setTimeout(() => sound.win(), 250);
}

function sceneView(route) {
  if (!SCENES.some(x => x.id === route.arg)) { st.scn = null; return placesHTML(); }
  if (!st.scn || st.scn.place !== route.arg) st.scn = { place: route.arg, list: loadScene(store, route.arg), confirm: false, targets: pickTargets(st.items) };
  const cheer = st.scn.cheer; st.scn.cheer = false; // confetti only in the render right after the last fill
  const end = allFilled(st.scn.targets)
    ? `${cheer ? confettiHTML() : ""}<div class="k-pz-end"><button class="k-pz-btn" data-a="sil-again" aria-label="צלליות חדשות"><span aria-hidden="true">🔁</span></button></div>` : "";
  return sceneHTML(st.scn.place, st.scn.list, st.items, { confirm: st.scn.confirm, targets: st.scn.targets }) + end;
}

function sceneSet(list) {
  st.scn.list = list;
  saveScene(store, st.scn.place, list);
  render();
}

// Sticker scenes. From the tray: a press that moves mostly vertically (touch/pen) or any move of 6px+ (mouse)
// lifts a copy, so a horizontal swipe still scrolls the tray (touch-action: pan-x; the browser then cancels the pointer).
// On the scene: a sticker drags at once. Dropping outside the scene removes it.
function sceneDown(e) {
  if (!st.scn || e.button > 0) return;
  const tpl = e.target.closest?.("[data-t]"), placed = e.target.closest?.("[data-i]");
  const scene = root.querySelector("[data-scene]");
  if (!scene || !(tpl || placed)) return;
  endDrag();
  const frac = (cx, cy) => { const b = scene.getBoundingClientRect(); return [(cx - b.left) / b.width, (cy - b.top) / b.height]; };
  const ac = new AbortController(), { signal } = ac;
  const el = tpl || placed, x0 = e.clientX, y0 = e.clientY;
  let ghost = null;
  const lift = () => {
    if (placed) { el.classList.add("k-dragging"); return placed; }
    ghost = tpl.cloneNode(true);
    ghost.removeAttribute("data-t");
    ghost.className = `k-sc-st k-dragging k-sc-ghost${tpl.classList.contains("k-cut") ? " k-cut" : ""}`;
    ghost.style.left = `${x0}px`; ghost.style.top = `${y0}px`;
    document.body.appendChild(ghost);
    return ghost;
  };
  let mover = null;
  try { el.setPointerCapture(e.pointerId); } catch {}
  if (placed) { e.preventDefault(); mover = lift(); }
  const clean = () => { ghost?.remove(); el.classList.remove("k-dragging"); el.style.transform = ""; };
  el.addEventListener("pointermove", m => {
    const dx = m.clientX - x0, dy = m.clientY - y0;
    if (!mover) {
      const far = m.pointerType === "mouse" ? Math.hypot(dx, dy) > 6 : Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx);
      if (!far) return;
      mover = lift();
    }
    if (ghost) { ghost.style.left = `${m.clientX}px`; ghost.style.top = `${m.clientY}px`; }
    else el.style.transform = `translate(${dx}px,${dy}px)`;
  }, { signal });
  el.addEventListener("pointerup", u => {
    const moved = !!mover;
    let cx = u.clientX, cy = u.clientY;
    if (placed) { const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
    endDrag(); clean();
    if (!moved) return;
    const [fx, fy] = frac(cx, cy);
    if (placed) {
      const i = Number(placed.dataset.i);
      sceneSet(outside(fx, fy) ? removeSticker(st.scn.list, i) : moveSticker(st.scn.list, i, fx, fy));
    } else if (!outside(fx, fy)) {
      const filled = tryFill(st.scn.targets, Number(tpl.dataset.t), fx, fy);
      if (filled !== st.scn.targets) { // the right character on its silhouette: it fills in (not a free sticker)
        st.scn.targets = filled;
        st.scn.cheer = allFilled(filled);
        sound.pair();
        render();
        cheer();
        if (allFilled(filled)) winTimer = setTimeout(() => sound.win(), 250);
        return;
      }
      if (blocksFreeDrop(st.scn.targets)) return; // silhouettes still waiting: a wrong character floats back
      sceneSet(addSticker(st.scn.list, Number(tpl.dataset.t), fx, fy));
    }
  }, { signal });
  el.addEventListener("pointercancel", () => { endDrag(); clean(); }, { signal });
  drag = ac;
  drag.clean = clean;
}
root.addEventListener("pointerdown", sceneDown);
root.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing && e.target.id === "k-who-name") root.querySelector("[data-a=who-save]")?.click(); });
// A cut-out that fails to load (missing PNG) turns back into the round sticker.
root.addEventListener("error", e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.classList.contains("k-cut-img")) return;
  const box = img.parentElement, item = st.items.find(i => i.tmdb === Number(img.dataset.tmdb));
  img.remove();
  if (!box || !item) return;
  box.classList.remove("k-cut");
  box.setAttribute("style", `${box.getAttribute("style") || ""}${circleStyle(item)}`);
}, true);

// Drag a tray piece with a pointer: move it with transform, re-render only on drop.
let drag = null, winTimer = 0, memTimer = 0;
function endDrag() { if (drag) { drag.abort(); drag.clean?.(); drag = null; } }
function startDrag(e) {
  const el = e.target.closest?.("[data-piece]");
  if (!el || !st.jig || e.button > 0) return;
  endDrag();
  e.preventDefault();
  const piece = Number(el.dataset.piece);
  const ac = new AbortController(), { signal } = ac;
  const x0 = e.clientX, y0 = e.clientY;
  try { el.setPointerCapture(e.pointerId); } catch {}
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
        if (won) next.won = true;
        render();
        if (won) { cheer(); winTimer = setTimeout(() => sound.win(), 250); }
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

function clipsView(route) {
  const item = route.arg ? withClips(st.items).find(i => String(i.tmdb) === route.arg) : null;
  if (!item) { st.clip = null; return clipsPickerHTML(st.items); }
  if (!st.clip || st.clip.tmdb !== item.tmdb) st.clip = { tmdb: item.tmdb, i: 0, ended: false, errs: 0 };
  return clipScreenHTML(item, st.clip, location.origin);
}

// After a clip screen is painted: subscribe to the player's state and error events (as watchPlayer in site/app.js).
function watchClip() {
  const f = root.querySelector(".k-player iframe"); if (!f) return;
  f.addEventListener("load", () => {
    const w = f.contentWindow; if (!w) return;
    const send = m => w.postMessage(JSON.stringify({ ...m, id: 1, channel: "widget" }), YT_ORIGINS[0]);
    send({ event: "listening" });
    send({ event: "command", func: "addEventListener", args: ["onStateChange"] });
    send({ event: "command", func: "addEventListener", args: ["onError"] });
  });
}

function playClip(i, keepErrs) {
  if (!st.clip) return;
  st.clip = { ...st.clip, i, ended: false, errs: keepErrs ? st.clip.errs : 0 };
  render();
  root.querySelector(".k-player")?.scrollIntoView?.({ block: "start", behavior: "smooth" });
}

// Registered once. A message counts only from the current player iframe; a removed iframe has no match.
window.addEventListener("message", e => {
  if (!st.clip) return;
  const item = withClips(st.items).find(i => i.tmdb === st.clip.tmdb); if (!item) return;
  const cur = root.querySelector(".k-player iframe")?.contentWindow;
  const r = onPlayerMessage(e.data, e.origin, e.source, cur);
  if (r === "ended") { st.clip = { ...st.clip, ended: true, errs: 0 }; render(); }
  else if (r === "playing") st.clip.errs = 0;
  else if (r === "error") {
    const { state, play } = afterError(st.clip, item.clips.length);
    st.clip = state;
    if (play === null) render(); else playClip(play, true);
  }
});

// Game views by route.game.
const VIEWS = {
  home: () => {
    const players = loadPlayers(store);
    if (!players.length && !loadNoName(store)) return whoHTML({ g: st.whoG }); // first visit: who's playing?
    return (players.length ? playersHTML(players, Math.min(loadPlayer(store), players.length - 1)) : "") + homeHTML(st.items);
  },
  who: () => whoHTML({ g: st.whoG }),
  puzzle: puzzleView,
  memory: memoryView,
  scene: sceneView,
  bubbles: () => `<div class="k-bub-area" data-bubbles></div>`,
  clips: clipsView,
};

function setupGame() {
  const date = israelToday();
  st.puzzle = puzzleFor(st.items, date, st.age);
  st.game = st.puzzle ? { ...initGame(st.puzzle), ...(loadGame(store, date, st.age, st.puzzle) ?? {}), choices: st.puzzle.choices } : null;
}

// 🫧 Bubbles: spawn on a timer while the bubbles screen is up; render() always stops it first.
let bubTimer = 0, bubId = 0;
const reducedMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
function stopBubbles() { clearInterval(bubTimer); bubTimer = 0; }
function startBubbles() {
  const area = root.querySelector("[data-bubbles]"); if (!area) return;
  const spawn = () => {
    if (!area.isConnected) { stopBubbles(); return; }
    if (area.querySelectorAll(".k-bub:not(.k-popped)").length >= MAX_BUBBLES) return;
    const b = pickBubble(st.items, Math.random, bubId++); if (!b) return;
    const item = st.items.find(i => i.tmdb === b.tmdb);
    area.insertAdjacentHTML("beforeend", bubbleHTML(b, item, reducedMotion()));
    const el = area.lastElementChild;
    el.addEventListener("animationend", ev => { if (ev.animationName === "k-rise") el.remove(); });
  };
  spawn();
  bubTimer = setInterval(spawn, SPAWN_MS);
}
function pop(b) {
  if (b.classList.contains("k-popped")) return;
  b.classList.add("k-popped");
  sound.pair();
  if (++pops % 5 === 0) cheer();
  setTimeout(() => b.remove(), reducedMotion() ? 0 : 450);
}
// Pointer: pop on press (a moving target); keyboard: Enter/Space reach the click delegation below.
root.addEventListener("pointerdown", e => {
  const b = e.target.closest?.("[data-a=pop]"); if (!b) return;
  e.preventDefault();
  pop(b);
});

function render() {
  endDrag();
  stopBubbles();
  clearTimeout(winTimer);
  const route = parseRoute(location.hash);
  const game = gameRouteFor(location.hash, st.age);
  if (route.game !== "memory") { st.mem = null; clearTimeout(memTimer); memTimer = 0; }
  if (route.game !== "scene") st.scn = null;
  if (route.game !== "clips") st.clip = null;
  root.dataset.age = st.age;
  if (route.game) {
    if (!game) { history.replaceState(null, "", location.pathname + location.search); }
    else { root.innerHTML = shellHTML(VIEWS[route.game](route), { muted: st.muted }); if (route.game === "clips") watchClip(); if (route.game === "bubbles") startBubbles(); return; }
  }
  const group = inGroup(st.items, st.age);
  const available = servicesIn(group);
  st.services = pickServices(st.services, available);
  const body = location.hash === "#game"
    ? gameHTML(st.puzzle, st.game, st.items)
    : servicesHTML(available, st.services) + gridHTML(byServices(group, st.services));
  root.innerHTML = headerHTML(st.age, { hasClips: withClips(st.items).length > 0 }) + body
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
  if (location.hash.startsWith("#play")) unlockSpeech();
  const { a, v } = b.dataset;
  if (a === "age" && v !== st.age) { st.age = v; saveAge(store, v); setupGame(); render(); }
  else if (a === "svc") {
    st.services = !v ? [] : st.services.includes(v) ? st.services.filter(p => p !== v) : [...st.services, v];
    render();
  }
  else if (a === "card") openCard(Number(v));
  else if (a === "game") { location.hash = "game"; }
  else if (a === "play") { location.hash = "play"; }
  else if (a === "clips") { location.hash = "play/clips"; }
  else if (a === "go") { location.hash = `play/${v}`; }
  else if (a === "again") puzzleAgain();
  else if (a === "clip") playClip(Number(v));
  else if (a === "clear" && st.scn) { st.scn.confirm = true; render(); }
  else if (a === "clear-no" && st.scn) { st.scn.confirm = false; render(); }
  else if (a === "clear-yes" && st.scn) { clearScene(store, st.scn.place); st.scn.list = []; st.scn.confirm = false; render(); }
  else if (a === "mem-flip") memFlip(Number(v));
  else if (a === "pop") pop(b);
  else if (a === "who-g") { st.whoG = v; root.querySelectorAll("[data-a=who-g]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.v === v))); }
  else if (a === "who-save") {
    const input = root.querySelector("#k-who-name"), name = cleanName(input?.value);
    if (!name) { input?.focus(); return; }
    const before = loadPlayers(store);
    if (before.length >= MAX_PLAYERS) { location.hash = "play"; return; }
    const players = [...before, { name, g: st.whoG === "f" ? "f" : "m" }];
    savePlayers(store, players); savePlayer(store, players.length - 1); saveNoName(store, false);
    st.whoG = "m";
    if (location.hash === "#play") render(); else location.hash = "play";
  }
  else if (a === "who-skip") { saveNoName(store, true); if (location.hash === "#play") render(); else location.hash = "play"; }
  else if (a === "player") { savePlayer(store, Number(v)); render(); }
  else if (a === "player-del") {
    const players = loadPlayers(store), i = Number(v);
    if (!players[i] || !confirm(`להסיר את ${players[i].name}?`)) return;
    players.splice(i, 1); savePlayers(store, players);
    const cur = loadPlayer(store); savePlayer(store, cur > i ? cur - 1 : Math.min(cur, Math.max(0, players.length - 1)));
    render();
  }
  else if (a === "tray") { const t = root.querySelector(".k-sc-tray"); if (t) t.scrollBy({ left: Number(v) * -Math.max(160, t.clientWidth * 0.8), behavior: "smooth" }); }
  else if (a === "sil-again" && st.scn) { st.scn.targets = pickTargets(st.items); render(); }
  else if (a === "mem-again") { clearTimeout(memTimer); memTimer = 0; st.mem = null; render(); }
  else if (a === "home") {
    const back = backHash(parseRoute(location.hash));
    if (back) location.hash = back;
    else { history.pushState(null, "", location.pathname + location.search); render(); }
  }
  else if (a === "mute") {
    st.muted = !st.muted; saveMute(store, st.muted);
    if (st.muted) { try { speechSynthesis.cancel(); } catch {} }
    b.setAttribute("aria-label", st.muted ? "הפעלת צליל" : "השתקה");
    const ic = b.querySelector("span"); if (ic) ic.textContent = st.muted ? "🔇" : "🔊";
  }
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

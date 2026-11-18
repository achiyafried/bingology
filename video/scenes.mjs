// The tour, scene by scene. Captions are the exact on-screen copy; `dwell` is how many seconds a scene
// holds after its actions. `goto` (a path under the site) loads a page before the caption appears.
// A scene that can't find something just shows its caption over whatever is on screen (see record.mjs).

const pause = (page, ms) => page.waitForTimeout(ms);

/** Smoothly scrolls the page, or an element inside it, by `dy` pixels. */
async function glide(page, dy, selector = null) {
  await page.evaluate(([y, sel]) => {
    const el = sel ? document.querySelector(sel) : null;
    (el || window).scrollBy({ top: y, behavior: "smooth" });
  }, [dy, selector]);
  await pause(page, 1200);
}

/** What to type in the search scene: a show most people know, else the first one on the list. */
export function searchTerm(data) {
  const names = (data?.series || []).map(s => s.name).filter(Boolean);
  const known = ["Breaking Bad", "Friends", "The Office", "Game of Thrones", "The Sopranos"].find(n => names.includes(n));
  return (known || names[0] || "").slice(0, 5);
}

export const SCENES = [
  {
    id: "home", goto: "", dwell: 4,
    caption: "לא יודעים מה לראות הערב? Bingology בוחרת בשבילכם",
    async run(page) { await page.locator(".marq img").first().waitFor({ timeout: 8000 }); },
  },
  {
    id: "quiz", dwell: 4,
    caption: "עונים על כמה שאלות קצרות…",
    async run(page, { tap, caption }) {
      await tap(page, '[data-a="start"][data-v="quick"]');
      for (let i = 0; i < 12; i++) {
        await pause(page, 700);
        if (await page.locator(".rtitle").count()) break;
        if (await page.locator('[data-a="opt"]').count()) await tap(page, '[data-a="opt"]');
        else if (await page.locator('[data-a="sortpick"]').count()) await tap(page, '[data-a="sortpick"]');
        else {
          if (await page.locator('[data-a="chip"][data-q="genres"]').count()) await tap(page, '[data-a="chip"][data-q="genres"]');
          await tap(page, '[data-a="next"]');
        }
      }
      await page.locator(".rtitle").waitFor({ timeout: 5000 });
      await caption(page, "…ומקבלים את הבחירה האולטימטיבית");
    },
  },
  {
    id: "card", dwell: 3,
    caption: "כל סדרה: עונות, ציונים, איפה צופים וטריילר",
    async run(page, { tap }) {
      await tap(page, '[data-a="detail"]');
      await page.locator("#dlg[open]").waitFor({ timeout: 5000 });
      await pause(page, 1500);
      await glide(page, 500, "#dlg");
      if (await tap(page, '#dlg [data-a="play"]', { timeout: 3000 })) {
        await pause(page, 4000);
        await tap(page, '[data-a="vclose"]', { timeout: 3000 });
      }
      await tap(page, '#dlg [data-a="dclose"]', { timeout: 3000 });
    },
  },
  {
    id: "list", dwell: 3,
    caption: "כל הסדרות במקום אחד — ומסננים לפי שירות הצפייה שלכם",
    async run(page, { tap }) {
      await tap(page, '[data-a="tab"][data-v="list"]');
      await pause(page, 1000);
      await tap(page, '[data-a="lplat"]:not([data-v="all"])');
      await pause(page, 800);
      await glide(page, 600);
    },
  },
  {
    id: "search", dwell: 3,
    caption: "מחפשים בעברית או באנגלית",
    async run(page, { tap, data }) {
      await tap(page, '[data-a="tab"][data-v="search"]');
      await page.locator("#serq").pressSequentially(searchTerm(data), { delay: 120 });
    },
  },
  {
    id: "actors", dwell: 4,
    caption: "…או לפי השחקנים שאתם אוהבים",
    async run(page, { tap }) {
      await tap(page, '[data-a="tab"][data-v="actors"]');
      await pause(page, 800);
      await tap(page, '[data-a="actpick"]');
    },
  },
  {
    id: "games", dwell: 5,
    caption: "משחקים יומיים לחובבי סדרות 🧩",
    async run(page, { tap }) {
      await tap(page, '[data-a="tab"][data-v="games"]');
      await page.waitForFunction(() => document.querySelector("#games")?.children.length > 0, null, { timeout: 6000 });
    },
  },
  {
    id: "marvel", goto: "mcu.html", dwell: 6, accent: true,
    caption: "🌌 היקום של מארוול — מוקדש לעמליה ❤️",
    async run(page) {
      await page.locator(".m-warn").waitFor({ state: "detached", timeout: 8000 });
      await pause(page, 1200);
      await glide(page, 450);
      await glide(page, 450);
    },
  },
  {
    id: "mine", goto: "", dwell: 5,
    caption: "נכנסים עם Google — ושומרים רשימות, התקדמות ומשתפים חברים",
    async run(page, { tap }) {
      await tap(page, '[data-a="tab"][data-v="mine"]');
      await page.locator('[data-a="signin-google"]').waitFor({ timeout: 8000 });
    },
  },
];

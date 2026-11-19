// The tour, scene by scene. Captions are the exact on-screen copy; `say` is the English narration (Samantha).
// `dwell` is the least a scene holds after its actions; it holds longer if its narration is still running. `goto` (a path under the site) loads a page before the caption appears.
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
    say: "Can't decide what to watch tonight? Binjology picks for you!",
    async run(page) { await page.locator(".marq img").first().waitFor({ timeout: 8000 }); },
  },
  {
    id: "quiz", dwell: 4,
    caption: "עונים על כמה שאלות קצרות…",
    say: "Answer a few quick questions, and get your ultimate pick, with a binge score!",
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
    say: "Every show has its own card: seasons, ratings, where to watch, and a trailer!",
    async run(page, { tap }) {
      await tap(page, '[data-a="detail"]');
      await page.locator("#dlg[open]").waitFor({ timeout: 5000 });
      await pause(page, 1500);
      await glide(page, 500, "#dlg");
      if (await tap(page, '#dlg [data-a="play"]', { timeout: 3000, optional: true })) {
        await pause(page, 4000);
        await tap(page, '[data-a="vclose"]', { timeout: 3000, optional: true });
      }
      await tap(page, '#dlg [data-a="dclose"]', { timeout: 3000 });
    },
  },
  {
    id: "list", dwell: 3,
    caption: "כל הסדרות במקום אחד — ומסננים לפי שירות הצפייה שלכם",
    say: "All the shows in one place, filtered by the streaming services you have!",
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
    say: "Search for a show in Hebrew or in English!",
    async run(page, { tap, data }) {
      await tap(page, '[data-a="tab"][data-v="search"]');
      await page.locator("#serq").pressSequentially(searchTerm(data), { delay: 120, timeout: 5000 });
    },
  },
  {
    id: "actors", dwell: 4,
    caption: "…או לפי השחקנים שאתם אוהבים",
    say: "Or find shows by the actors you love!",
    async run(page, { tap }) {
      await tap(page, '[data-a="tab"][data-v="actors"]');
      await pause(page, 800);
      await tap(page, '[data-a="actor"]');
      await page.locator("#dlg[open]").waitFor({ timeout: 5000 });
      await pause(page, 1500);
      await glide(page, 400, "#dlg");
      await tap(page, '#dlg [data-a="dclose"]', { timeout: 3000 });
    },
  },
  {
    id: "games", dwell: 5,
    caption: "משחקים יומיים לחובבי סדרות 🧩",
    say: "And every day, there are new games for TV lovers!",
    async run(page, { tap }) {
      await tap(page, '[data-a="tab"][data-v="games"]');
      await page.waitForFunction(() => document.querySelector("#games")?.children.length > 0, null, { timeout: 6000 });
    },
  },
  {
    id: "marvel", goto: "mcu.html", dwell: 6, accent: true,
    caption: "🌌 היקום של מארוול — במיוחד בשביל עמליה ❤️",
    say: "There's also the Marvel universe, with a timeline of every movie and series. And this one is made especially for Amalia!",
    async run(page) {
      await page.locator(".m-warn").waitFor({ state: "detached", timeout: 8000 });
      await pause(page, 1200);
      await glide(page, 450);
      await glide(page, 450);
    },
  },
  {
    id: "kids", goto: "kids.html", dwell: 5, accent: true,
    caption: "🧸 סקשן הילדים — במיוחד בשביל לגוני 💛",
    say: "And for the little ones, a kids corner, with shows for every age and a daily guessing game. Made especially for Lagooni!",
    async run(page, { tap }) {
      await page.locator('[data-a="card"]').first().waitFor({ timeout: 8000 });
      await pause(page, 1000);
      await tap(page, '[data-a="age"][data-v="small"]');
      await pause(page, 1200);
      await glide(page, 350);
      await tap(page, '[data-a="game"]');
      await page.locator('[data-a="pick"]').first().waitFor({ timeout: 5000 });
      await pause(page, 1800);
      await tap(page, '[data-a="pick"]:not([disabled])');
    },
  },
  {
    id: "mine", goto: "", dwell: 5,
    caption: "נכנסים עם Google — ושומרים רשימות, התקדמות ומשתפים חברים",
    say: "And in your personal tab, sign in with Google to save lists, track your progress, and share with friends!",
    async run(page, { tap }) {
      await tap(page, '[data-a="tab"][data-v="mine"]');
      await page.locator('[data-a="signin-google"]').waitFor({ timeout: 8000 });
    },
  },
];

/** The closing card. Played after SCENES; it holds long enough for the music's last hit to land on it. */
export const OUTRO = {
  id: "outro", dwell: 7, caption: "",
  say: "Binjology. Your next binge starts here!",
  card: { title: "Bingology", tagline: "הבינג׳ הבא שלכם מתחיל כאן", url: "achiyafried.github.io/bingology" },
  async run(page) {
    const { endCard } = await import("./lib/overlay.mjs");
    await endCard(page, OUTRO.card);
  },
};

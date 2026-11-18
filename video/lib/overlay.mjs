// The layer drawn over the site while recording: a caption bar at the bottom and a "finger tap" ripple.
// It is injected by the recorder only; nothing here touches site/.

/** Runs in every page (addInitScript), so it also survives the move to mcu.html. */
export function overlayInitScript() {
  return `(() => {
    const CSS = \`
      #tour-overlay { position: fixed; inset: 0; width: auto; height: auto; margin: 0; padding: 0; border: 0;
        background: transparent; overflow: visible; pointer-events: none; z-index: 2147483647; }
      #tour-caption { position: absolute; left: 14px; right: 14px; bottom: 34px; padding: 14px 18px; border-radius: 16px;
        background: rgba(12, 12, 20, .82); color: #fff; font: 600 20px/1.35 Assistant, "Secular One", sans-serif;
        text-align: center; direction: rtl; box-shadow: 0 6px 24px rgba(0,0,0,.35);
        opacity: 0; transform: translateY(10px); transition: opacity .3s, transform .3s; }
      #tour-caption.on { opacity: 1; transform: none; }
      #tour-caption[data-accent="true"] { font-weight: 700; border: 2px solid #ffcc4d;
        box-shadow: 0 0 18px rgba(255, 204, 77, .75), 0 6px 24px rgba(0,0,0,.35); }
      .tour-tap { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
        background: rgba(255, 255, 255, .55); border: 2px solid rgba(255, 255, 255, .9);
        animation: tour-tap .5s ease-out forwards; }
      @keyframes tour-tap { from { transform: scale(.4); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }\`;
    // The site's cards are modal dialogs, which live in the browser's top layer above any z-index.
    // So the overlay is a popover (also top layer), shown again whenever a dialog opens to stay above it.
    function raise(root) {
      if (root.matches(":popover-open")) root.hidePopover();
      root.showPopover();
    }
    function ensure() {
      let root = document.getElementById("tour-overlay");
      if (root) return root;
      const style = document.createElement("style");
      style.textContent = CSS;
      document.head.appendChild(style);
      root = document.createElement("div");
      root.id = "tour-overlay";
      root.setAttribute("popover", "manual");
      root.innerHTML = '<div id="tour-caption" data-accent="false" hidden></div>';
      document.body.appendChild(root);
      raise(root);
      new MutationObserver(ms => { if (ms.some(m => m.target.localName === "dialog" && m.target.open)) raise(root); })
        .observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
      return root;
    }
    window.__tour = {
      caption(text, accent) {
        const el = ensure().querySelector("#tour-caption");
        el.dataset.accent = String(!!accent);
        if (!text) { el.classList.remove("on"); el.hidden = true; return; }
        el.textContent = text;
        el.hidden = false;
        requestAnimationFrame(() => el.classList.add("on"));
      },
      tap(x, y) {
        const dot = document.createElement("div");
        dot.className = "tour-tap";
        dot.style.left = x + "px";
        dot.style.top = y + "px";
        ensure().appendChild(dot);
        setTimeout(() => dot.remove(), 600);
      },
    };
  })();`;
}

/** Shows `text` in the caption bar (empty hides it). */
export async function caption(page, text, { accent = false } = {}) {
  await page.waitForFunction(() => window.__tour && document.body);
  await page.evaluate(([t, a]) => window.__tour.caption(t, a), [text, accent]);
}

/** Waits for a visible element, shows a tap on it, then clicks. Returns false (never throws) if it never shows up. */
export async function tap(page, selector, { timeout = 5000 } = {}) {
  const el = page.locator(selector).first();
  try {
    await el.waitFor({ state: "visible", timeout });
    await el.scrollIntoViewIfNeeded({ timeout });
    const b = await el.boundingBox();
    if (b) await page.evaluate(([x, y]) => window.__tour?.tap(x, y), [b.x + b.width / 2, b.y + b.height / 2]);
    await page.waitForTimeout(350);
    await el.click({ timeout });
    return true;
  } catch {
    return false;
  }
}

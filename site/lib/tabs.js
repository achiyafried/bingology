// The main menu: one icon per tab, its name as tooltip, and the current tab also shows its name.
// Icons: Tabler Icons (outline), MIT License, https://tabler.io/icons
export const TABS = [
  { id: "pick", name: "המלצה", icon: '<path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z"/>' },
  { id: "list", name: "הרשימה", icon: '<path d="M13 5h8"/><path d="M13 9h5"/><path d="M13 15h8"/><path d="M13 19h5"/><path d="M3 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M3 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/>' },
  { id: "actors", name: "קאסט", icon: '<path d="M13.192 9h6.616a2 2 0 0 1 1.992 2.183l-.567 6.182a4 4 0 0 1 -3.983 3.635h-1.5a4 4 0 0 1 -3.983 -3.635l-.567 -6.182a2 2 0 0 1 1.992 -2.183z"/><path d="M15 13h.01"/><path d="M18 13h.01"/><path d="M15 16.5c1 .667 2 .667 3 0"/><path d="M8.632 15.982a4.037 4.037 0 0 1 -.382 .018h-1.5a4 4 0 0 1 -3.983 -3.635l-.567 -6.182a2 2 0 0 1 1.992 -2.183h6.616a2 2 0 0 1 2 2"/><path d="M6 8h.01"/><path d="M9 8h.01"/><path d="M6 12c.764 -.51 1.528 -.63 2.291 -.36"/>' },
  { id: "search", name: "חיפוש", icon: '<path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M21 21l-6 -6"/>' },
  { id: "games", name: "משחקים", icon: '<path d="M12 5h3.5a5 5 0 0 1 0 10h-5.5l-4.015 4.227a2.3 2.3 0 0 1 -3.923 -2.035l1.634 -8.173a5 5 0 0 1 4.904 -4.019h3.4z"/><path d="M14 15l4.07 4.284a2.3 2.3 0 0 0 3.925 -2.023l-1.6 -8.232"/><path d="M8 9v2"/><path d="M7 10h2"/><path d="M14 10h2"/>' },
  { id: "mine", name: "שלי", icon: '<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/>' },
  { id: "mcu", name: "מארוול", href: "mcu.html", icon: '<path d="M18.816 13.58c2.292 2.138 3.546 4 3.092 4.9c-.745 1.46 -5.783 -.259 -11.255 -3.838c-5.47 -3.579 -9.304 -7.664 -8.56 -9.123c.464 -.91 2.926 -.444 5.803 .805"/><path d="M12 12m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/>' },
  { id: "kids", name: "ילדים", href: "kids.html", icon: '<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M9 10l.01 0"/><path d="M15 10l.01 0"/><path d="M9.5 15a3.5 3.5 0 0 0 5 0"/><path d="M12 3a2 2 0 0 0 0 4"/>' },
];

const svg = d => `<svg class="ti" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

/** The tab bar. `current` is the selected tab id, or null (news page). */
export function tabsHTML(current) {
  return `<div class="tabs" role="tablist">${TABS.map(t => {
    const label = `aria-label="${t.name}" data-tip="${t.name}"`;
    if (t.href) return `<a class="tab ${t.id}" href="${t.href}" ${label}>${svg(t.icon)}</a>`;
    const on = t.id === current;
    return `<button class="tab" role="tab" data-a="tab" data-v="${t.id}" aria-selected="${on}" ${label}>${svg(t.icon)}${on ? `<span class="tl">${t.name}</span>` : ""}</button>`;
  }).join("")}</div>`;
}

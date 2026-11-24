const MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape text for HTML (content and attributes). Data from TMDB is third-party and editable by anyone. */
export const esc = s => (s == null ? "" : String(s).replace(/[&<>"']/g, c => MAP[c]));

/** An image URL we are willing to put in src: TMDB's image CDN with a plain path only. */
export const safeImg = u => (typeof u === "string" && /^https:\/\/image\.tmdb\.org\/t\/p\/w\d+\/[\w.-]+$/.test(u) ? u : null);

/** A YouTube thumbnail URL we are willing to put in src: https://i.ytimg.com/vi/<11-char id>/<name>.jpg only. */
export const safeThumb = u => (typeof u === "string" && /^https:\/\/i\.ytimg\.com\/vi\/[A-Za-z0-9_-]{11}\/\w+\.jpg$/.test(u) ? u : null);

// Upcoming-season reminders and WhatsApp sharing for the news rows. Pure: strings and URLs only.
// A reminder is a calendar event (Google Calendar link or an .ics file); nothing is stored or sent by the site.
import { esc } from "./esc.js";
import { formatDateHe } from "./news.js";

export const SITE_URL = "https://achiyafried.github.io/bingology/";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** {tmdbId, name, season, date, where} for a row about a season that hasn't started yet, else null.
 *  entry: an upcoming season ({tmdbId, season, date}) or a news item (only kind "announced" counts). */
export function remindInfo(entry, S, today) {
  const date = entry.kind ? (entry.kind === "announced" ? entry.airDate : null) : entry.date;
  if (!date || !ISO.test(date) || date <= today) return null;
  const s = S.find((x) => x.tmdbId === entry.tmdbId);
  if (!s) return null;
  const strm = s.strm || {};
  const where = [...(strm.IL?.length ? strm.IL : strm.US || [])].join(", ");
  return { tmdbId: s.tmdbId, name: s.n || "", season: entry.season, date, where };
}

const compact = (iso) => iso.replace(/-/g, "");
function nextDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}
const title = (i) => `🎬 ${i.name}: עונה ${i.season} מתחילה`;
const details = (i) => `${i.where ? `איפה רואים: ${i.where}\n` : ""}${SITE_URL}`;

/** A Google Calendar "add event" link: an all-day event on the premiere date. */
export function googleCalUrl(i) {
  const u = new URL("https://calendar.google.com/calendar/render");
  u.searchParams.set("action", "TEMPLATE");
  u.searchParams.set("text", title(i));
  u.searchParams.set("dates", `${compact(i.date)}/${compact(nextDay(i.date))}`);
  u.searchParams.set("details", details(i));
  return u.toString();
}

const enc = new TextEncoder();
/** RFC 5545 line folding: lines over 75 octets continue on the next line after CRLF + space; never splits a character. */
export function fold(line) {
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = "", bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length, max = out.length ? 74 : 75; // continuation lines start with a space
    if (bytes + n > max) { out.push(cur); cur = ""; bytes = 0; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.map((p, k) => (k ? ` ${p}` : p)).join("\r\n");
}

const icsEsc = (t) => String(t).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** An iCalendar file: the same all-day event, with an alarm at 9:00 the day before (15 hours before midnight). */
export function icsText(i, nowIso = new Date().toISOString()) {
  const stamp = nowIso.replace(/[-:]/g, "").replace(/\.\d+/, "").slice(0, 15) + "Z";
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bingology//Reminders//HE", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:bingology-${Number(i.tmdbId)}-s${Number(i.season)}-${compact(i.date)}@achiyafried.github.io`,
    `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${compact(i.date)}`, `DTEND;VALUE=DATE:${compact(nextDay(i.date))}`,
    `SUMMARY:${icsEsc(title(i))}`, `DESCRIPTION:${icsEsc(details(i))}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc(`מחר: ${i.name} עונה ${i.season}`)}`, "TRIGGER:-PT15H", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].map(fold).join("\r\n") + "\r\n";
}

/** A WhatsApp link with a ready message (the person picks who to send it to). */
export function waUrl(i) {
  const text = `עונה ${i.season} של \u2068${i.name}\u2069 מתחילה ב-${formatDateHe(i.date)}! 🎉 מתכננים בינג׳? ${SITE_URL}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

const BELL = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3"/></svg>`;
const WA = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.5 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3Z"/></svg>`;

const menuId = (i) => `nm-${Number(i.tmdbId)}-${Number(i.season)}`;

/** The two round buttons beside an upcoming-season row. */
export function actionsHTML(i) {
  const name = esc(i.name);
  return `<span class="nact" role="group" aria-label="${name}"><button class="nact-b" data-a="nremind" data-t="${Number(i.tmdbId)}" data-s="${Number(i.season)}" data-d="${esc(i.date)}" aria-expanded="false" aria-controls="${menuId(i)}" aria-label="תזכורת לבכורה של ${name}" title="תזכורת לבכורה">${BELL}</button>`
    + `<a class="nact-b nwa" href="${esc(waUrl(i))}" target="_blank" rel="noopener noreferrer" aria-label="שיתוף בוואטסאפ של ${name} (נפתח בלשונית חדשה)" title="שיתוף בוואטסאפ">${WA}</a></span>`;
}

/** The small reminder menu: Google Calendar or the phone's calendar (.ics). */
export function remindMenuHTML(i) {
  return `<div class="nmenu" id="${menuId(i)}" role="group" aria-label="תזכורת לבכורה של ${esc(i.name)}">`
    + `<a href="${esc(googleCalUrl(i))}" target="_blank" rel="noopener noreferrer" data-a="nclose">Google Calendar<span class="sr"> (נפתח בלשונית חדשה)</span></a>`
    + `<button data-a="nics" data-t="${Number(i.tmdbId)}" data-s="${Number(i.season)}" data-d="${esc(i.date)}">יומן הטלפון</button></div>`;
}

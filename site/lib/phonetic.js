// Moved from app.js: pronunciation-based matching between Hebrew queries and Latin/Hebrew names.
/* Hebrew name search by pronunciation: both the Latin name and the Hebrew query are reduced to a consonant skeleton */
const HMAP = { "ב": "B", "ג": "G", "ד": "D", "ז": "S", "ט": "T", "כ": "K", "ך": "K", "ק": "K", "ל": "L", "מ": "M", "ם": "M", "נ": "N", "ן": "N", "ס": "S", "פ": "P", "ף": "P", "ר": "R", "ש": "S", "ת": "T" };
const collapseKey = s => s.replace(/(.)\1+/g, "$1");
export function hebKey(s) {
  return s.replace(/[\u0591-\u05C7]/g, "").split(/[\s\-]+/).filter(Boolean).map(w => {
    let out = "";
    for (let i = 0; i < w.length; i++) {
      const c = w[i], n = w[i + 1];
      if ("'׳’\"״".includes(c)) continue;
      if (c === "ו") { if (n === "ו") { out += "B"; i++; } else if (i === 0) out += "B"; continue; }
      if (c === "צ" || c === "ץ") { out += (n === "'" || n === "׳") ? "K" : "S"; continue; }
      out += HMAP[c] || "";
    }
    return collapseKey(out);
  }).filter(Boolean);
}
export function latKey(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, "").split(/\s+/).filter(Boolean).map(w => {
    w = w.replace(/sch/g, "S").replace(/tch/g, "K").replace(/ch/g, "K").replace(/sh/g, "S").replace(/th/g, "T").replace(/ph/g, "P").replace(/ck/g, "K").replace(/qu/g, "KB").replace(/gh/g, "").replace(/x/g, "KS");
    let out = "";
    for (let i = 0; i < w.length; i++) {
      const c = w[i], n = w[i + 1] || "";
      if (c >= "A" && c <= "Z") { out += c; continue; }
      if ("bvw".includes(c)) out += "B";
      else if (c === "c") out += "eiy".includes(n) ? "S" : "K";
      else if ("kq".includes(c)) out += "K";
      else if ("gj".includes(c)) out += "G";
      else if ("sz".includes(c)) out += "S";
      else if ("fp".includes(c)) out += "P";
      else if ("dlmnrt".includes(c)) out += c.toUpperCase();
    }
    return collapseKey(out);
  }).filter(Boolean);
}
export function keyMatch(a, q) {
  const qf = q.join("");
  if (qf.length < 2) return false;
  return qf.length >= 3 ? a.kf.includes(qf) : a.kw.some(w => w.startsWith(qf));
}

/** Keys for a name, whichever script it is written in. */
export function nameKeys(n) {
  const kw = /[\u0590-\u05FF]/.test(n) ? hebKey(n) : latKey(n);
  return { kw, kf: kw.join("") };
}

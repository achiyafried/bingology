// Five flat, cheerful places for the sticker book. Pure shapes: no text, scripts or external refs.
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${body}</svg>`;
const sun = (x, y) => `<circle cx="${x}" cy="${y}" r="90" fill="#ffd45e"/><circle cx="${x}" cy="${y}" r="62" fill="#ffe595"/>`;
const cloud = (x, y) => `<g fill="#fff"><ellipse cx="${x}" cy="${y}" rx="110" ry="42"/><ellipse cx="${x + 70}" cy="${y - 30}" rx="70" ry="42"/><ellipse cx="${x - 60}" cy="${y - 20}" rx="55" ry="34"/></g>`;
const tree = (x, y, c) => `<rect x="${x - 25}" y="${y}" width="50" height="190" rx="10" fill="#a8744a"/><circle cx="${x}" cy="${y - 20}" r="130" fill="${c}"/><circle cx="${x - 70}" cy="${y + 40}" r="80" fill="${c}"/><circle cx="${x + 75}" cy="${y + 40}" r="80" fill="${c}"/>`;
const flower = (x, y, c) => `<rect x="${x - 5}" y="${y}" width="10" height="90" fill="#4fa05b"/><g fill="${c}"><circle cx="${x - 24}" cy="${y}" r="22"/><circle cx="${x + 24}" cy="${y}" r="22"/><circle cx="${x}" cy="${y - 24}" r="22"/><circle cx="${x}" cy="${y + 24}" r="22"/></g><circle cx="${x}" cy="${y}" r="16" fill="#ffd45e"/>`;

export const SCENES = [
  { id: "kitchen", label: "מטבח", svg: svg(
    `<rect width="1600" height="900" fill="#fff1d6"/><rect y="700" width="1600" height="200" fill="#f0cf9f"/>` +
    `<rect x="90" y="120" width="320" height="600" rx="24" fill="#dce9f1"/><rect x="90" y="360" width="320" height="10" fill="#b9ccd8"/><rect x="360" y="180" width="14" height="120" rx="7" fill="#9bb0bf"/><rect x="360" y="440" width="14" height="180" rx="7" fill="#9bb0bf"/>` +
    `<rect x="560" y="520" width="1040" height="200" fill="#d79a62"/><rect x="560" y="490" width="1040" height="40" fill="#f0c48f"/><g fill="#c4864f"><rect x="600" y="560" width="270" height="130" rx="10"/><rect x="900" y="560" width="270" height="130" rx="10"/><rect x="1200" y="560" width="270" height="130" rx="10"/></g>` +
    `<rect x="760" y="130" width="420" height="300" rx="18" fill="#a8744a"/><rect x="782" y="152" width="376" height="256" rx="8" fill="#bfe6fb"/><rect x="964" y="152" width="12" height="256" fill="#a8744a"/><rect x="782" y="274" width="376" height="12" fill="#a8744a"/>` +
    `<circle cx="1060" cy="220" r="34" fill="#ffd45e"/><rect x="1300" y="400" width="150" height="90" rx="14" fill="#ee6c6c"/><rect x="1340" y="370" width="70" height="34" rx="10" fill="#ee6c6c"/>`) },
  { id: "garden", label: "גינה", svg: svg(
    `<rect width="1600" height="900" fill="#c9ecfb"/>${sun(1380, 150)}${cloud(420, 160)}${cloud(900, 110)}` +
    `<path d="M0 520 Q400 440 800 500 T1600 480 V900 H0Z" fill="#8bd17c"/><rect y="640" width="1600" height="260" fill="#6fc069"/>` +
    `<g fill="#fff"><rect x="60" y="420" width="40" height="220" rx="14"/><rect x="300" y="420" width="40" height="220" rx="14"/><rect x="540" y="420" width="40" height="220" rx="14"/><rect x="780" y="420" width="40" height="220" rx="14"/><rect x="1020" y="420" width="40" height="220" rx="14"/><rect x="1260" y="420" width="40" height="220" rx="14"/><rect x="1500" y="420" width="40" height="220" rx="14"/><rect y="470" width="1600" height="30"/><rect y="570" width="1600" height="30"/></g>` +
    `${flower(200, 740, "#ff7aa8")}${flower(480, 800, "#ffb23e")}${flower(760, 740, "#b58cf7")}${flower(1060, 810, "#ff7aa8")}${flower(1340, 750, "#ffb23e")}`) },
  { id: "beach", label: "חוף", svg: svg(
    `<rect width="1600" height="900" fill="#bfe8fa"/>${sun(240, 150)}${cloud(900, 140)}` +
    `<rect y="380" width="1600" height="200" fill="#4dbbe0"/><path d="M0 560 Q200 520 400 560 T800 560 T1200 560 T1600 560 V620 H0Z" fill="#8fd8ee"/>` +
    `<path d="M0 600 Q400 560 800 600 T1600 590 V900 H0Z" fill="#f6dc9d"/>` +
    `<rect x="1090" y="360" width="16" height="400" rx="8" fill="#a8744a"/><path d="M880 400 A230 190 0 0 1 1320 400Z" fill="#ff6b6b"/><path d="M1000 400 A110 190 0 0 1 1200 400Z" fill="#fff"/>` +
    `<ellipse cx="400" cy="760" rx="110" ry="50" fill="#4d96ff"/><circle cx="1400" cy="780" r="38" fill="#ffb23e"/><path d="M500 690 l30 -40 l30 40 l30 -40 l30 40Z" fill="#ffe8ea"/>`) },
  { id: "bedroom", label: "חדר שינה", svg: svg(
    `<rect width="1600" height="900" fill="#e8defa"/><rect y="680" width="1600" height="220" fill="#d8b98c"/>` +
    `<rect x="980" y="120" width="360" height="300" rx="18" fill="#fff"/><rect x="1004" y="144" width="312" height="252" rx="8" fill="#a9d9f5"/><rect x="1154" y="144" width="12" height="252" fill="#fff"/><circle cx="1240" cy="220" r="28" fill="#fff3a8"/>` +
    `<rect x="120" y="400" width="720" height="300" rx="30" fill="#b98557"/><rect x="120" y="330" width="60" height="370" rx="20" fill="#9c6c43"/><rect x="170" y="440" width="640" height="150" rx="40" fill="#ff9aa8"/><rect x="190" y="410" width="220" height="80" rx="36" fill="#fff"/><rect x="170" y="560" width="640" height="40" fill="#ff7b8f"/>` +
    `<ellipse cx="800" cy="800" rx="380" ry="70" fill="#6ec6b8"/><ellipse cx="800" cy="800" rx="270" ry="46" fill="#9fe0d4"/>` +
    `<rect x="1430" y="520" width="150" height="190" rx="12" fill="#b98557"/><rect x="1495" y="400" width="20" height="130" fill="#8b6a4a"/><path d="M1440 410 L1480 320 H1530 L1570 410Z" fill="#ffd45e"/>`) },
  { id: "park", label: "פארק", svg: svg(
    `<rect width="1600" height="900" fill="#c9ecfb"/>${sun(1400, 130)}${cloud(500, 140)}` +
    `<rect y="470" width="1600" height="430" fill="#86cf77"/>${tree(180, 320, "#4fb26a")}${tree(1480, 300, "#5cc07a")}` +
    `<path d="M600 900 Q760 700 900 620 T1100 470 L1180 470 Q1040 620 960 700 T820 900Z" fill="#f1d9a5"/>` +
    `<rect x="520" y="410" width="30" height="260" fill="#ee6c6c"/><rect x="740" y="410" width="30" height="260" fill="#ee6c6c"/><rect x="510" y="400" width="270" height="34" rx="12" fill="#ffb23e"/><path d="M780 440 L1000 670 L1060 670 L1060 640 L830 410Z" fill="#4d96ff"/><rect x="540" y="470" width="30" height="190" fill="#c94444" transform="rotate(-8 540 470)"/>` +
    `<circle cx="330" cy="780" r="30" fill="#ff7aa8"/><circle cx="1240" cy="800" r="26" fill="#ffd45e"/>`) },
];

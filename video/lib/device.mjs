// The phone the tour is recorded on. Playwright records at the CSS viewport size and never scales up,
// so the video frame must equal the viewport (a larger one pads the picture with grey).
const PHONE = { width: 390, height: 844 };

export function contextOptions(rawDir) {
  return {
    viewport: { ...PHONE }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: "he-IL", timezoneId: "Asia/Jerusalem",
    recordVideo: { dir: rawDir, size: { ...PHONE } },
  };
}

// Shared browser launcher: Playwright's bundled Chromium if installed, else the system Google Chrome.
// Force one with BROWSER=chromium | BROWSER=chrome.
import { chromium } from "playwright";

export async function launch(args = []) {
  const want = process.env.BROWSER;
  if (want !== "chrome") {
    try { return await chromium.launch({ headless: true, args }); }
    catch (e) { if (want === "chromium") throw e; }
  }
  return chromium.launch({ headless: true, channel: "chrome", args });
}

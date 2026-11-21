/* Renders the popup with mocked chrome.* APIs for README screenshots.
 * Usage: node scripts/screenshot.mjs           (uses playwright-core chromium)
 *        CHROME=/path/to/chrome node scripts/screenshot.mjs
 */
import { chromium } from "playwright-core";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs");
fs.mkdirSync(outDir, { recursive: true });

const EXE = process.env.CHROME || "/home/not6248/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome";
const browser = await chromium.launch({ executablePath: EXE, headless: true });

async function shot(name, { settings = {}, tab = "highlight", theme = "light" }) {
  const page = await browser.newPage({ viewport: { width: 372, height: 620 }, deviceScaleFactor: 2 });
  settings = { theme, ...settings };
  await page.addInitScript(
    ({ settings }) => {
      const sync = {
        color: "#ffeb3b",
        textColor: "#000000",
        bold: false,
        underline: false,
        caseSensitive: false,
        wholeWord: true,
        inflect: true,
        enabled: true,
        autoHighlight: true,
        theme: "light",
        ankiUrl: "http://127.0.0.1:8765",
        ankiKey: "",
        ankiDeck: "",
        ankiField: "",
        ankiMode: "learned",
        ...settings,
      };
      const local = { keywords: "highlight, error code, run, leaf" };
      const listeners = [];
      globalThis.chrome = {
        storage: {
          local: {
            async get(def) { return typeof def === "string" ? { [def]: local[def] } : { ...def, ...local }; },
            async set(o) { Object.assign(local, o); },
            async remove(k) { (Array.isArray(k) ? k : [k]).forEach((x) => delete local[x]); },
          },
          sync: {
            async get(def) { return { ...def, ...sync }; },
            async set(o) { Object.assign(sync, o); },
            async remove(k) { (Array.isArray(k) ? k : [k]).forEach((x) => delete sync[x]); },
          },
          onChanged: { addListener(fn) { listeners.push(fn); } },
        },
        tabs: { async query() { return []; }, sendMessage() { return Promise.resolve(); } },
        runtime: { onMessage: { addListener() {} } },
      };
    },
    { settings },
  );
  await page.addInitScript((t) => localStorage.setItem("ce-tab", t), tab);
  await page.goto(pathToFileURL(path.join(root, "popup.html")).href, { waitUntil: "load" });
  await page.waitForTimeout(150);
  const height = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewportSize({ width: 372, height });
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
  await page.close();
  console.log("wrote docs/" + name);
}

await shot("popup-light.png", { tab: "highlight", theme: "light" });
await shot("popup-dark.png", { tab: "highlight", theme: "dark", settings: { theme: "dark" } });
await shot("popup-style.png", { tab: "style", theme: "light" });
await shot("popup-system.png", { tab: "system", theme: "light", settings: { autoHighlight: false, theme: "light" } });
await browser.close();

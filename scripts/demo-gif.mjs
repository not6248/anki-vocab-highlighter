/* Demo GIF generator — no extension logic changes.
 * Opens test-page.html, embeds the REAL popup.html (with mocked chrome.*
 * APIs, same approach as scripts/screenshot.mjs) next to a demo article,
 * types "run, cry, error code" into the real keywords field, clicks the
 * real Save button, then applies the REAL pipeline from highlight.js
 * (parseKeywords → expandKeywords → buildHighlightRegex) to the article.
 * Captures frames with Playwright, then assembles docs/demo.gif with ffmpeg.
 *
 * Usage: npm run gif      (English UI → docs/demo.gif)
 *        npm run gif:th   (Thai UI → docs/demo-th.gif)
 *        CHROME=/path/to/chrome node scripts/demo-gif.mjs [--lang=th]
 *        FPS=10 WIDTH=780 node scripts/demo-gif.mjs
 */
import { chromium } from "playwright-core";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Highlight = require("../highlight.js");

const FPS = Number(process.env.FPS || 10);
const WIDTH = Number(process.env.WIDTH || 780); // must stay <= 800
const LANG = (() => {
  const arg = (process.argv.find((a) => a.startsWith("--lang=")) || "").split("=")[1];
  return arg === "th" ? "th" : "en";
})();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = path.join(root, "docs");
const outGif = path.join(docsDir, LANG === "th" ? "demo-th.gif" : "demo.gif");
fs.mkdirSync(docsDir, { recursive: true });

// Stage captions per UI language (the demo article itself stays English).
const CAP = {
  en: {
    s1: `<b>1/4 · Plain page</b> — real popup, nothing highlighted yet`,
    s2: `<b>2/4 · Typing keywords</b> — run, cry, error code`,
    s3: `<b>3/4 · Highlighted</b> — running and cried match too`,
    s4: `<b>4/4 · Phrases win</b> — error code matches as one unit`,
    note: "<code>error code</code> matches as one phrase — the lone <code>error</code> at the end stays plain.",
  },
  th: {
    s1: `<b>1/4 · หน้าปกติ</b> — popup จริง ยังไม่มีไฮไลต์`,
    s2: `<b>2/4 · พิมพ์คำศัพท์</b> — run, cry, error code`,
    s3: `<b>3/4 · ไฮไลต์แล้ว</b> — running กับ cried ก็โดนด้วย`,
    s4: `<b>4/4 · วลีชนะ</b> — error code โดนทั้งวลี`,
    note: "<code>error code</code> โดนทั้งวลี — <code>error</code> ตัวเดียวท้ายประโยคไม่โดน",
  },
}[LANG];

if (WIDTH > 800) {
  console.error(`WIDTH must be <= 800 (got ${WIDTH})`);
  process.exit(1);
}
if (FPS < 8 || FPS > 12) {
  console.error(`FPS should be 8-12 (got ${FPS}) — continuing anyway`);
}

function haveFfmpeg() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (!haveFfmpeg()) {
  console.error(`
ffmpeg not found — docs/demo.gif was NOT created.

Install it first (do NOT install via this script), then re-run:
  npm run gif

  Fedora / RHEL : sudo dnf install ffmpeg
  Ubuntu/Debian: sudo apt update && sudo apt install ffmpeg
  macOS (brew)  : brew install ffmpeg
  Windows (winget): winget install Gyan.FFmpeg
  or: https://ffmpeg.org/download.html
`);
  process.exit(1);
}

const EXE =
  process.env.CHROME ||
  "/home/not6248/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome";

if (!fs.existsSync(EXE)) {
  console.error(`Chromium not found at ${EXE}\nSet CHROME=/path/to/chrome and retry.`);
  process.exit(1);
}

// --- real pipeline (same as docs/highlight-demo.png) ---
const KEYWORDS_RAW = "run, cry, error code";
const parsed = Highlight.parseKeywords(KEYWORDS_RAW);
const expanded = Highlight.expandKeywords(parsed);
const built = Highlight.buildHighlightRegex(expanded, {
  caseSensitive: false,
  wholeWord: true,
});
console.log(`keywords: ${JSON.stringify(parsed)} → ${expanded.length} forms`);

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({
  viewport: { width: WIDTH, height: 800 },
  deviceScaleFactor: 2, // retina-crisp element shots, downscaled by ffmpeg
});

// Mock chrome.* for the real popup (same approach as scripts/screenshot.mjs).
// Registered before any navigation so it also applies to the popup iframe.
await page.addInitScript((lang) => {
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
    language: lang,
    ankiUrl: "http://127.0.0.1:8765",
    ankiKey: "",
    ankiDeck: "",
    ankiField: "",
    ankiMode: "learned",
  };
  const local = { keywords: "" };
  globalThis.chrome = {
    storage: {
      local: {
        async get(def) {
          return typeof def === "string" ? { [def]: local[def] } : { ...def, ...local };
        },
        async set(o) {
          Object.assign(local, o);
        },
        async remove(k) {
          (Array.isArray(k) ? k : [k]).forEach((x) => delete local[x]);
        },
      },
      sync: {
        async get(def) {
          return { ...def, ...sync };
        },
        async set(o) {
          Object.assign(sync, o);
        },
        async remove(k) {
          (Array.isArray(k) ? k : [k]).forEach((x) => delete sync[x]);
        },
      },
      onChanged: { addListener() {} },
    },
    tabs: {
      async query() {
        return [];
      },
      async sendMessage() {
        return {};
      },
    },
    runtime: { onMessage: { addListener() {} } },
  };
  try {
    localStorage.setItem("ce-tab", "highlight");
  } catch {}
}, LANG);

// Open the real test page (requirement) via file://
await page.goto(pathToFileURL(path.join(root, "test-page.html")).href, {
  waitUntil: "domcontentloaded",
});

// Stage: caption bar (ours) + REAL popup.html in an iframe + demo article.
await page.evaluate(() => {
  const css = document.createElement("style");
  css.textContent = `
    html, body { margin: 0; padding: 0; background: #eef1f6; }
    body > *:not(#stage) { display: none !important; }
    #stage {
      width: 764px; margin: 0 auto; padding: 10px 8px; box-sizing: border-box;
      font-family: system-ui, "Segoe UI", sans-serif; color: #1e2430;
    }
    #gif-caption { display: flex; align-items: center; gap: 10px; margin: 2px 0 8px; min-height: 20px; }
    #gif-dots { display: flex; gap: 5px; flex: none; }
    #gif-dots i { width: 22px; height: 6px; border-radius: 3px; background: #c6cddd; }
    #gif-dots i.on { background: #1e2430; }
    #gif-text { margin: 0; font-size: 12.5px; color: #5b6478; }
    #gif-text b { color: #1e2430; }
    #gif-cols { display: flex; gap: 10px; align-items: flex-start; }
    #popup-frame {
      width: 372px; height: 618px; flex: none;
      border: 1px solid #e2e6f0; border-radius: 12px; background: #fff;
    }
    #gif-article {
      flex: 1; background: #fff;
      border: 1px solid #e2e6f0; border-radius: 12px;
      padding: 14px 15px; box-sizing: border-box; min-height: 618px;
    }
    #gif-article p { font-size: 13.5px; line-height: 1.7; margin: 9px 0; }
    #gif-note {
      visibility: hidden; margin-top: 10px; font-size: 12px; color: #5b6478;
      background: #f3f4f8; border: 1px solid #e2e6f0; border-radius: 8px;
      padding: 7px 10px;
    }
    #gif-note.show { visibility: visible; }
    #gif-note code { background: #fff; border: 1px solid #e2e6f0; border-radius: 4px; padding: 0 4px; font-size: 11px; }
    .ce-highlight {
      background: #ffeb3b !important; color: #1a1a1a !important;
      border-radius: 3px; padding: 0 2px;
    }
  `;
  document.head.appendChild(css);

  const stage = document.createElement("div");
  stage.id = "stage";
  const popupUrl = new URL("popup.html", location.href).href;
  stage.innerHTML =
    '<div id="gif-caption"><div id="gif-dots"><i></i><i></i><i></i><i></i></div><p id="gif-text"></p></div>' +
    '<div id="gif-cols">' +
    `<iframe id="popup-frame" src="${popupUrl}" title="extension popup"></iframe>` +
    '<div id="gif-article">' +
    "<p>I run every morning. She is running in the park.</p>" +
    "<p>The baby cries at night. Yesterday he cried for an hour.</p>" +
    "<p>Build failed with error code 500. It was not just a simple error.</p>" +
    '<div id="gif-note"></div>' +
    "</div></div>";
  document.body.appendChild(stage);
});

const popup = page.frameLocator("#popup-frame");
await popup.locator("#keywords").waitFor({ timeout: 10000 });
await page.waitForTimeout(500); // let popup.js load() finish filling defaults

const stage = page.locator("#stage");

function setStep(n, html) {
  return page.evaluate(
    ({ n, html }) => {
      document
        .querySelectorAll("#gif-dots i")
        .forEach((el, i) => el.classList.toggle("on", i < n));
      document.getElementById("gif-text").innerHTML = html;
    },
    { n, html },
  );
}

// Same DOM walk as content.js, scoped to the demo article, styled with the
// popup's real default color (#ffeb3b on black, bold off).
async function applyHighlightInPage(source, flags) {
  return await page.evaluate(
    ({ source, flags }) => {
      const re = new RegExp(source, flags);
      const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "NOSCRIPT"]);
      const isSkipped = (node) => {
        let el = node.parentElement;
        while (el) {
          if (el.classList && el.classList.contains("ce-highlight")) return true;
          if (SKIP.has(el.tagName)) return true;
          el = el.parentElement;
        }
        return false;
      };
      const walker = document.createTreeWalker(
        document.getElementById("gif-article"),
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(n) {
            if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            if (isSkipped(n)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          },
        },
      );
      const nodes = [];
      let n;
      while ((n = walker.nextNode())) nodes.push(n);
      let total = 0;
      for (const tn of nodes) {
        if (!tn.isConnected) continue;
        const text = tn.nodeValue;
        re.lastIndex = 0;
        let m;
        let last = 0;
        let found = 0;
        const frag = document.createDocumentFragment();
        while ((m = re.exec(text)) !== null) {
          if (!m[0].length) {
            re.lastIndex += 1;
            continue;
          }
          found += 1;
          if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
          const mark = document.createElement("span");
          mark.className = "ce-highlight";
          mark.textContent = m[0];
          frag.appendChild(mark);
          last = m.index + m[0].length;
          if (re.lastIndex === m.index) re.lastIndex += 1;
        }
        if (found) {
          if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
          tn.parentNode.replaceChild(frag, tn);
          total += found;
        }
      }
      return total;
    },
    { source, flags },
  );
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "demo-gif-"));
const uniq = [];
async function snap(tag) {
  const f = path.join(tmp, `${tag}.png`);
  await stage.screenshot({ path: f }); // tight crop, no stray content
  uniq.push(f);
  return f;
}

// a. plain page: real popup with empty keywords, article untouched
await setStep(1, CAP.s1);
await popup.locator("#keywords").click();
await page.waitForTimeout(350);
await snap("a-plain");

// b. type into the REAL popup field (count badge updates by itself)
await setStep(2, CAP.s2);
await popup.locator("#keywords").pressSequentially("run, cry, ", { delay: 60 });
await snap("b-typing");
await popup.locator("#keywords").pressSequentially("error code", { delay: 60 });
await page.waitForTimeout(250);
await snap("b-full");

// c. click the REAL Save button → inflection matches (running, cried)
await popup.locator("#save").click();
await page.waitForTimeout(300);
await snap("c-press");
const total = await applyHighlightInPage(built.source, built.flags);
await setStep(3, CAP.s3);
await page.waitForTimeout(350);
await snap("c-highlight");

// d. whole-phrase win: footnote calls out "error code" vs lone "error"
await setStep(4, CAP.s4);
await page.evaluate((html) => {
  const note = document.getElementById("gif-note");
  note.innerHTML = html;
  note.classList.add("show");
}, CAP.note);
await page.waitForTimeout(350);
await snap("d-phrase");

await browser.close();
console.log(`highlighted ${total} matches (expect 5: run, running, cries, cried, error code)`);

// Normalize unique shots to identical dimensions (safety net — the layout
// is fixed-height by design, so padding should be a no-op).
{
  const probe = (f) =>
    execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${f}"`,
      { encoding: "utf8" },
    )
      .trim()
      .split(",")
      .map(Number);
  let maxW = 0;
  let maxH = 0;
  const sizes = new Map();
  for (const f of uniq) {
    const [w, h] = probe(f);
    sizes.set(f, [w, h]);
    maxW = Math.max(maxW, w);
    maxH = Math.max(maxH, h);
  }
  for (const f of uniq) {
    const [w, h] = sizes.get(f);
    if (w !== maxW || h !== maxH) {
      execSync(`ffmpeg -y -v error -i "${f}" -vf "pad=${maxW}:${maxH}:(ow-iw)/2:0:white" "${f}.tmp.png"`, {
        stdio: "inherit",
      });
      fs.renameSync(`${f}.tmp.png`, f);
    }
  }
  console.log(`normalized ${uniq.length} shots to ${maxW}x${maxH}`);
}

// Frame holds at 10fps: plain 0.7s, typing, result, final freeze 1.5s.
const HOLD = [
  ["a-plain", 7],
  ["b-typing", 4],
  ["b-full", 5],
  ["c-press", 3],
  ["c-highlight", 9],
  ["d-phrase", 9],
  ["d-phrase", 15], // final freeze ~1.5s
];
const framesDir = path.join(tmp, "seq");
fs.mkdirSync(framesDir, { recursive: true });
let idx = 0;
for (const [tag, count] of HOLD) {
  const src = path.join(tmp, `${tag}.png`);
  for (let i = 0; i < count; i++) {
    idx += 1;
    fs.copyFileSync(src, path.join(framesDir, `frame-${String(idx).padStart(3, "0")}.png`));
  }
}
console.log(`frames: ${idx} PNGs at ${FPS}fps (${(idx / FPS).toFixed(1)}s), width ${WIDTH}px`);

function encode({ colors, fps, scaleW, out }) {
  const pal = path.join(tmp, `pal-${colors}.png`);
  execSync(
    `ffmpeg -y -v error -framerate ${fps} -i "${path.join(framesDir, "frame-%03d.png")}" ` +
      `-vf "scale=${scaleW}:-2:flags=lanczos,palettegen=max_colors=${colors}" "${pal}"`,
    { stdio: "inherit" },
  );
  execSync(
    `ffmpeg -y -v error -framerate ${fps} -i "${path.join(framesDir, "frame-%03d.png")}" -i "${pal}" ` +
      `-lavfi "scale=${scaleW}:-2:flags=lanczos [s];[s][1:v]paletteuse=dither=bayer:bayer_scale=3" ` +
      `-loop 0 -gifflags -offsetting "${out}"`,
    { stdio: "inherit" },
  );
}

const attempts = [
  { colors: 128, fps: FPS, scaleW: WIDTH },
  { colors: 64, fps: FPS, scaleW: WIDTH },
  { colors: 64, fps: 8, scaleW: Math.min(WIDTH, 640) },
];
let finalCfg = attempts[0];
for (const cfg of attempts) {
  encode({ ...cfg, out: outGif });
  const size = fs.statSync(outGif).size;
  console.log(`try colors=${cfg.colors} fps=${cfg.fps} w=${cfg.scaleW} → ${(size / 1024 / 1024).toFixed(2)} MB`);
  finalCfg = cfg;
  if (size <= 2 * 1024 * 1024) break;
}
const finalSize = fs.statSync(outGif).size;
console.log(`wrote ${path.relative(root, outGif)} (${(finalSize / 1024).toFixed(0)} KB, ${idx} frames, ${finalCfg.fps}fps, loop infinite)`);
console.log(`regenerate: npm run gif  (FPS=${finalCfg.fps} WIDTH=${finalCfg.scaleW} node scripts/demo-gif.mjs)`);

fs.rmSync(tmp, { recursive: true, force: true });

if (finalSize > 2 * 1024 * 1024) {
  console.error("WARNING: GIF is still over ~2 MB — consider fewer frames or WIDTH=640.");
  process.exit(2);
}

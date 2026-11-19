import { chromium } from "playwright-core";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Highlight = require("./highlight.js");

// --- unit: whole-word boundaries (real module, no browser) ---
{
  const re = Highlight.buildHighlightRegex(["tall"], { caseSensitive: false, wholeWord: true });
  const t = (s) => { re.lastIndex = 0; return re.test(s); };
  assert.ok(t("a tall man"), "standalone tall matches");
  assert.ok(t("TALL"), "case-insensitive");
  assert.ok(!t("Installation"), "no match inside Installation");
  assert.ok(!t("taller"), "no match inside taller");
  assert.ok(t("(tall)"), "punctuation boundary ok");
  const sub = Highlight.buildHighlightRegex(["tall"], { wholeWord: false });
  assert.ok(sub.test("Installation"), "substring mode still matches inside");
  const phrase = Highlight.buildHighlightRegex(["error code", "error"], { wholeWord: true });
  assert.ok("found error code here".match(phrase)[0] === "error code", "longest-first phrase wins");
  assert.deepEqual(Highlight.parseKeywords("xxx, yyy,zzz,, xxx-yy,xxx"), ["xxx-yy", "xxx", "yyy", "zzz"]);
  console.log("PASS: highlight unit (whole-word)");
}

// --- unit: inflection expansion ---
{
  const has = (kw, ...forms) => {
    const got = Highlight.expandKeyword(kw);
    for (const f of forms) assert.ok(got.includes(f), `${kw} expands to ${f} (got: ${got.slice(0, 8).join(",")}...)`);
  };
  has("cry", "cry", "cries", "cried", "crying");
  has("leaf", "leaf", "leaves");
  has("run", "run", "runs", "ran", "running");
  has("tall", "tall", "taller", "tallest");
  has("happy", "happy", "happier", "happiest");
  has("wash", "wash", "washes");
  has("stop", "stop", "stopped", "stopping");
  has("hope", "hope", "hoping", "hoped");
  has("box", "box", "boxes");
  has("went", "go", "goes", "going"); // past form resolves to base
  has("mice", "mouse");
  has("children", "child");
  has("lives", "life"); // f/fe -> ves via irregular map
  assert.deepEqual(Highlight.expandKeyword("error code"), ["error code"], "phrases stay exact");
  assert.deepEqual(Highlight.expandKeyword("xxx-yy"), ["xxx-yy"], "hyphenated stays exact");
  // expanded forms match through the whole-word engine
  const reLeaf = Highlight.buildHighlightRegex(Highlight.expandKeywords(["leaf"]), { wholeWord: true });
  const t2 = (s) => { reLeaf.lastIndex = 0; return reLeaf.test(s); };
  assert.ok(t2("leaves fall"), "leaf matches leaves");
  assert.ok(t2("a leaf"), "leaf matches leaf");
  assert.ok(!t2("leaflets"), "leaf does not match leaflets");
  console.log("PASS: highlight unit (inflection)");
}

// --- perf: 2000 keywords expanded + trie scan of ~200KB ---
{
  const abc = (i) => { let s = ""; do { s = String.fromCharCode(97 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } while (i >= 0); return "w" + s; };
  const words = Array.from({ length: 2000 }, (_, i) => abc(i)).concat(["cry", "leaf", "run", "tall", "happy"]);
  const t0 = Date.now();
  const forms = Highlight.expandKeywords(words);
  const re = Highlight.buildHighlightRegex(forms, { wholeWord: true });
  const buildMs = Date.now() - t0;
  const hay = ("She cries as leaves fall while children are running. word1999 is here. ").repeat(3000);
  const t1 = Date.now();
  re.lastIndex = 0;
  const m = hay.match(new RegExp(re.source, "g"));
  const scanMs = Date.now() - t1;
  assert.ok(forms.length > 10000, `expanded forms large enough (got ${forms.length})`);
  assert.ok(m && m.length > 1000, "scan finds matches");
  console.log(`PASS: perf (forms=${forms.length}, build=${buildMs}ms, scan ${Math.round(hay.length / 1024)}KB in ${scanMs}ms)`);
  assert.ok(buildMs < 3000, "regex build under 3s");
  assert.ok(scanMs < 3000, "scan under 3s");
}

// --- browser: real DOM highlighting + styles via Playwright ---
const EXE = "/home/not6248/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome";
const PORT = 8766;
let server = null;

if (!process.env.TEST_URL) {
  // serve test-page.html so `npm test` works with no setup
  const http = await import("node:http");
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = path.dirname(fileURLToPath(import.meta.url));
  server = http.createServer(async (req, res) => {
    try {
      const file = req.url === "/" ? "test-page.html" : req.url.replace(/^\//, "");
      const body = await fs.readFile(path.join(root, file));
      res.writeHead(200, { "Content-Type": file.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
}

const URL = process.env.TEST_URL || `http://127.0.0.1:${PORT}/test-page.html`;

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "domcontentloaded" });

// serialize the REAL pipeline (parse → expand → trie regex) into the page
const built = Highlight.buildHighlightRegex(
  Highlight.expandKeywords(Highlight.parseKeywords("xxx, yyy, zzz, xxx-yy, tall, cry, leaf, run")),
  { caseSensitive: false, wholeWord: true },
);
const result = await page.evaluate(
  ({ source, flags, style }) => {
    const re = new RegExp(source, flags);
    const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "NOSCRIPT"]);
    const skipped = (node) => {
      let el = node.parentElement;
      while (el) {
        if (el.classList?.contains("ce-highlight")) return true;
        if (SKIP.has(el.tagName)) return true;
        el = el.parentElement;
      }
      return false;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
        if (skipped(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    let total = 0;
    for (const tn of nodes) {
      const text = tn.nodeValue;
      re.lastIndex = 0;
      let m, last = 0, found = 0;
      const frag = document.createDocumentFragment();
      while ((m = re.exec(text)) !== null) {
        if (!m[0].length) { re.lastIndex++; continue; }
        found++;
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const mark = document.createElement("span");
        mark.className = "ce-highlight";
        mark.textContent = m[0];
        mark.style.backgroundColor = style.color;
        mark.style.color = style.textColor;
        mark.style.fontWeight = style.bold ? "bold" : "";
        mark.style.textDecoration = style.underline ? "underline" : "";
        frag.appendChild(mark);
        last = m.index + m[0].length;
      }
      if (found) {
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        tn.parentNode.replaceChild(frag, tn);
        total += found;
      }
    }
    const first = document.querySelector("span.ce-highlight");
    const cs = first ? getComputedStyle(first) : null;
    return {
      total,
      marks: document.querySelectorAll("span.ce-highlight").length,
      p1: document.getElementById("p1").innerHTML,
      p2marks: document.getElementById("p2").querySelectorAll("span.ce-highlight").length,
      p3marks: document.getElementById("p3").querySelectorAll("span.ce-highlight").length,
      p4html: document.getElementById("p4").innerHTML,
      p4marks: document.getElementById("p4").querySelectorAll("span.ce-highlight").length,
      p5html: document.getElementById("p5").innerHTML,
      p5marks: document.getElementById("p5").querySelectorAll("span.ce-highlight").length,
      inputVal: document.getElementById("inp").value,
      scriptTouched: document.querySelector("script").textContent.includes("ce-highlight"),
      style: cs ? { bg: cs.backgroundColor, fg: cs.color, weight: cs.fontWeight, deco: cs.textDecorationLine } : null,
    };
  },
  {
    source: built.source,
    flags: built.flags,
    style: { color: "#ffeb3b", textColor: "#000000", bold: true, underline: false },
  },
);

console.log(JSON.stringify({ ...result, p1: result.p1.slice(0, 100) + "..." }, null, 2));
assert.equal(result.total, 12, "total = p1(4) + p3(2) + p4(3) + p5(3)");
assert.equal(result.marks, 12, "DOM marks should be 12");
assert.equal(result.p2marks, 0, "p2 must have no highlight");
assert.equal(result.p3marks, 2, "p3 case-insensitive should have 2");
assert.equal(result.p4marks, 3, "p4: tall + taller(comparative) + TALL, not Installation");
assert.ok(result.p4html.startsWith("Installation "), "Installation untouched");
assert.equal(result.p5marks, 3, "p5: cries + leaves + running");
assert.equal(result.inputVal, "xxx should NOT highlight in input", "input value untouched");
assert.equal(result.scriptTouched, false, "script tag untouched");
assert.ok(result.p1.includes("xxx-yy</span>"), "longest-first: xxx-yy wins");
assert.equal(result.style.bg, "rgb(255, 235, 59)", "background color applied");
assert.equal(result.style.fg, "rgb(0, 0, 0)", "text color applied");
assert.equal(result.style.weight, "700", "bold applied");
console.log("PASS: all highlight assertions");
await browser.close();
if (server) server.close();

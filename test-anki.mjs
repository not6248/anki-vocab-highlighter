import assert from "node:assert";
import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AnkiSync = require("./anki.js");

// --- pure function tests ---
assert.equal(AnkiSync.normalizeBaseUrl(""), "http://127.0.0.1:8765");
assert.equal(AnkiSync.normalizeBaseUrl("http://127.0.0.1:8765/"), "http://127.0.0.1:8765");
assert.equal(AnkiSync.normalizeBaseUrl("127.0.0.1:8765"), "http://127.0.0.1:8765");

assert.equal(AnkiSync.buildQuery("", "all"), "*");
assert.equal(AnkiSync.buildQuery("*", "all"), "*");
assert.equal(AnkiSync.buildQuery("Default", "all"), 'deck:"Default"');
assert.equal(AnkiSync.buildQuery("Default", "learned"), 'deck:"Default" -is:new');
assert.equal(AnkiSync.buildQuery("", "learned"), "-is:new");
assert.equal(AnkiSync.buildQuery("My Deck", "all"), 'deck:"My Deck"');

assert.equal(AnkiSync.stripHtml("<b>apple</b>"), "apple");
assert.equal(AnkiSync.stripHtml("a<br>Expo &amp; Co"), "a Expo & Co");
assert.equal(AnkiSync.stripHtml("<div>  cat   <br/>dog </div>"), "cat dog");

const fields = { Front: { value: "<b>apple</b>", order: 1 }, Back: { value: "meaning", order: 0 } };
assert.deepEqual(AnkiSync.pickFieldValues(fields, ""), ["<b>apple</b>"]); // default guesses Front
assert.deepEqual(AnkiSync.pickFieldValues({ Id: { value: "X_001", order: 0 }, Word: { value: "cry", order: 1 } }, ""), ["cry"]); // skips Id
assert.deepEqual(AnkiSync.pickFieldValues({ Foo: { value: "a", order: 1 }, Bar: { value: "b", order: 0 } }, ""), ["b"]); // fallback order-0
assert.deepEqual(AnkiSync.pickFieldValues(fields, "*").sort(), ["<b>apple</b>", "meaning"].sort());
assert.deepEqual(AnkiSync.pickFieldValues(fields, "Front"), ["<b>apple</b>"]);
assert.deepEqual(AnkiSync.pickFieldValues(fields, "front"), ["<b>apple</b>"]); // case-insensitive
assert.deepEqual(AnkiSync.pickFieldValues(fields, "Nope"), []);

const notes = [
  { fields: { Front: { value: "apple", order: 0 } } },
  { fields: { Front: { value: "<i>Apple</i>", order: 0 } } }, // dup (case-insensitive)
  { fields: { Front: { value: "banana", order: 0 } } },
];
assert.deepEqual(AnkiSync.extractKeywordsFromNotes(notes, "Front"), ["apple", "banana"]);

assert.equal(AnkiSync.isLearnedCard({ reps: 5, type: 2 }), true);
assert.equal(AnkiSync.isLearnedCard({ reps: 0, type: 0 }), false);
assert.equal(AnkiSync.isLearnedCard({ type: 1 }), true);

assert.equal(AnkiSync.mergeKeywords("xxx, yyy", ["yyy", "zzz"]), "xxx, yyy, zzz");
console.log("PASS: pure functions");

// --- mock Anki-Connect server ---
const CARDS = {
  1: { cardId: 1, note: 101, reps: 5, type: 2, fields: { Front: { value: "apple", order: 0 } } },
  2: { cardId: 2, note: 102, reps: 0, type: 0, fields: { Front: { value: "banana", order: 0 } } },
  3: { cardId: 3, note: 103, reps: 2, type: 1, fields: { Front: { value: "<b>cat</b>", order: 0 } } },
};

function handleLegacy(body) {
  if (body.action === "version") return 6;
  if (body.action === "findCards") {
    const q = body.params?.query || "";
    if (q.includes("-is:new")) return [1, 3];
    return [1, 2, 3];
  }
  if (body.action === "cardsInfo") return (body.params?.cards || []).map((id) => CARDS[id]).filter(Boolean);
  if (body.action === "notesInfo") {
    const byNote = Object.fromEntries(Object.values(CARDS).map((c) => [c.note, c]));
    return (body.params?.notes || []).map((id) => ({ noteId: id, fields: byNote[id]?.fields || {} }));
  }
  throw new Error("unknown action " + body.action);
}

let v1Enabled = true;
const server = http.createServer((req, res) => {
  let data = "";
  req.on("data", (c) => (data += c));
  req.on("end", () => {
    try {
      if (req.url === "/api/v1") {
        if (!v1Enabled) { res.writeHead(404).end("not found"); return; }
        const rpc = JSON.parse(data || "{}");
        const result = handleLegacy({ action: rpc.method, params: rpc.params });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result }));
      } else if (req.url === "/") {
        const body = JSON.parse(data || "{}");
        if (body.key && body.key !== "secret") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ result: null, error: "Invalid API key" }));
          return;
        }
        const result = handleLegacy(body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ result, error: null }));
      } else { res.writeHead(404).end("nf"); }
    } catch (e) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ result: null, error: String(e.message || e) }));
    }
  });
});
await new Promise((r) => server.listen(18765, "127.0.0.1", r));
const BASE = "http://127.0.0.1:18765";

// v1 path
let t = await AnkiSync.testConnection(BASE, "");
assert.equal(t.version, 6);
console.log("PASS: testConnection");

let r = await AnkiSync.sync({ baseUrl: BASE, deck: "", field: "Front", mode: "learned" });
assert.equal(r.query, "-is:new");
assert.deepEqual(r.words, ["apple", "cat"], "learned excludes banana, strips html");
assert.equal(r.cardCount, 2);

r = await AnkiSync.sync({ baseUrl: BASE, deck: "", field: "Front", mode: "all" });
assert.deepEqual(r.words, ["apple", "banana", "cat"]);
assert.equal(r.cardCount, 3);

// legacy fallback (disable v1 → 404)
v1Enabled = false;
r = await AnkiSync.sync({ baseUrl: BASE, deck: "Default", field: "Front", mode: "learned" });
assert.equal(r.query, 'deck:"Default" -is:new');
assert.deepEqual(r.words, ["apple", "cat"]);

// apiKey wrong → error surfaces
let failed = false;
try {
  await AnkiSync.sync({ baseUrl: BASE, apiKey: "wrong", deck: "", field: "Front", mode: "all" });
} catch { failed = true; }
assert.equal(failed, true, "wrong api key must fail");

server.close();
console.log("PASS: mock Anki-Connect (v1 + legacy + key auth)");

// --- storage split: keywords -> local (no 8KB sync quota), settings -> sync ---
function memStore(initial = {}) {
  const m = { ...initial };
  return {
    data: m,
    async get(def) {
      if (typeof def === "string") return { [def]: m[def] };
      if (Array.isArray(def)) return Object.fromEntries(def.map((k) => [k, m[k]]));
      const out = { ...def };
      for (const k of Object.keys(m)) out[k] = m[k];
      return out;
    },
    async set(o) { Object.assign(m, o); },
    async remove(k) { (Array.isArray(k) ? k : [k]).forEach((x) => delete m[x]); },
  };
}

{
  // fresh install → defaults
  const s = { local: memStore(), sync: memStore() };
  const st = await AnkiSync.loadState(s);
  assert.equal(st.keywords, "");
  assert.equal(st.ankiUrl, "http://127.0.0.1:8765");
  assert.equal(st.ankiMode, "learned");
  assert.equal(st.wholeWord, true, "whole-word default on");
  assert.equal(st.textColor, "#000000");
  assert.equal(st.bold, false);
  assert.equal(st.autoHighlight, true, "auto-highlight default on");
  assert.equal(st.theme, "system", "theme default follows system");
  assert.equal(st.language, "en", "language default is English");
  assert.equal(st.shortcut, "Alt+Shift+H", "shortcut default");
}
{
  // legacy: keywords stuck in sync → migrated to local
  const s = { local: memStore(), sync: memStore({ keywords: "aaa, bbb", color: "#fff" }) };
  const st = await AnkiSync.loadState(s);
  assert.equal(st.keywords, "aaa, bbb");
  assert.equal(s.local.data.keywords, "aaa, bbb");
  assert.ok(!("keywords" in s.sync.data), "migrated out of sync");
  assert.equal(st.color, "#fff");
}
{
  // big deck: 2000 words (~13KB) must NOT go through sync (8KB/item quota)
  const big = Array.from({ length: 2000 }, (_, i) => "word" + i).join(", ");
  assert.ok(Buffer.byteLength(big, "utf8") > 8192, "fixture exceeds sync per-item quota");
  const s = { local: memStore(), sync: memStore() };
  await AnkiSync.saveKeywords(s, big);
  await AnkiSync.saveSettings(s, { color: "#fff", keywords: "SHOULD_BE_STRIPPED" });
  assert.equal(s.local.data.keywords, big);
  assert.ok(!("keywords" in s.sync.data), "keywords never touch sync");
  const st = await AnkiSync.loadState(s);
  assert.equal(st.keywords, big);
  assert.equal(st.color, "#fff");
}
{
  // manual mode + theme settings round-trip through sync storage
  const s = { local: memStore(), sync: memStore() };
  await AnkiSync.saveSettings(s, { autoHighlight: false, theme: "dark", language: "th", shortcut: "Ctrl+Shift+K" });
  const st = await AnkiSync.loadState(s);
  assert.equal(st.autoHighlight, false);
  assert.equal(st.theme, "dark");
  assert.equal(st.language, "th");
  assert.equal(st.shortcut, "Ctrl+Shift+K");
}
console.log("PASS: storage split (local keywords + migration)");

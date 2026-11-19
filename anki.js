/* Shared Anki-Connect logic (no chrome.* dependency — unit-testable).
 * Supports Anki-Connect legacy endpoint POST / (API v6)
 * and new endpoint POST /api/v1 (JSON-RPC 2.0).
 */
const AnkiSync = (() => {
  "use strict";

  const LEGACY_VERSION = 6;

  function normalizeBaseUrl(raw) {
    const s = String(raw || "").trim().replace(/\/+$/, "");
    if (!s) return "http://127.0.0.1:8765";
    if (/^https?:\/\//i.test(s)) return s;
    return "http://" + s;
  }

  function escapeDeck(deck) {
    return String(deck).replace(/"/g, '\\"');
  }

  // mode: "all" | "learned" (เคยเรียน = ไม่ใช่ไพ่ใหม่)
  function buildQuery(deck, mode) {
    const d = String(deck || "").trim();
    const base = d === "" || d === "*" ? "*" : `deck:"${escapeDeck(d)}"`;
    if (mode === "learned") return base === "*" ? "-is:new" : `${base} -is:new`;
    return base;
  }

  function decodeEntities(s) {
    return String(s)
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  function stripHtml(html) {
    const withBreaks = String(html || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<\/div>/gi, " ");
    const noTags = withBreaks.replace(/<[^>]*>/g, " ");
    return decodeEntities(noTags).replace(/\s+/g, " ").trim();
  }

  // fieldsObj: { Front: {value, order} | string }
  function pickFieldValues(fieldsObj, fieldName) {
    if (!fieldsObj || typeof fieldsObj !== "object") return [];
    const entries = Object.entries(fieldsObj).map(([name, v]) => {
      const value = v != null && typeof v === "object" && "value" in v ? v.value : String(v ?? "");
      const order = v != null && typeof v === "object" && typeof v.order === "number" ? v.order : 999;
      return { name, value, order };
    });
    const want = String(fieldName || "").trim();
    if (want === "") {
      // default: guess the word field (Word/Front/...) so decks whose first
      // field is an Id don't sync garbage; fall back to order-0 field.
      for (const guess of WORD_FIELD_GUESS) {
        const hit = entries.find((e) => e.name.toLowerCase() === guess.toLowerCase());
        if (hit) return [hit.value];
      }
      entries.sort((a, b) => a.order - b.order);
      return entries.length ? [entries[0].value] : [];
    }
    if (want === "*") return entries.map((e) => e.value);
    const exact = entries.find((e) => e.name === want);
    if (exact) return [exact.value];
    const ci = entries.find((e) => e.name.toLowerCase() === want.toLowerCase());
    return ci ? [ci.value] : [];
  }

  function extractKeywordsFromNotes(notes, fieldName, limit = 5000) {
    const out = [];
    const seen = new Set();
    for (const n of notes || []) {
      const vals = pickFieldValues(n.fields, fieldName);
      for (const v of vals) {
        const w = stripHtml(v);
        if (!w || w.length > 100) continue;
        const key = w.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(w);
        if (out.length >= limit) return out;
      }
    }
    return out;
  }

  function extractKeywordsFromCards(cards, fieldName, limit = 5000) {
    // cardsInfo also carries `fields` in the same shape — reuse note extractor
    return extractKeywordsFromNotes(
      (cards || []).map((c) => ({ fields: c.fields })),
      fieldName,
      limit,
    );
  }

  // Field names that usually hold the word itself (Anki default is Front,
  // popular vocab decks use Word/Term/Expression). Used when user leaves
  // the field setting empty — avoids grabbing Id/audio/definition fields.
  const WORD_FIELD_GUESS = ["Word", "Front", "Term", "Expression", "Vocabulary"];

  // storage split: keywords can exceed chrome.storage.sync limits
  // (8KB per item), so they live in storage.local; small prefs stay in sync.
  const SETTING_KEYS = ["color", "textColor", "bold", "underline", "caseSensitive", "wholeWord", "inflect", "enabled", "autoHighlight", "theme", "ankiUrl", "ankiKey", "ankiDeck", "ankiField", "ankiMode"];
  const SETTING_DEFAULTS = {
    color: "#ffeb3b",
    textColor: "#000000",
    bold: false,
    underline: false,
    caseSensitive: false,
    wholeWord: true,
    inflect: true,
    enabled: true,
    autoHighlight: true,
    theme: "system",
    ankiUrl: "http://127.0.0.1:8765",
    ankiKey: "",
    ankiDeck: "",
    ankiField: "",
    ankiMode: "learned",
  };

  async function loadState(storages) {
    const [localData, syncData] = await Promise.all([
      storages.local.get({ keywords: "" }),
      storages.sync.get({ keywords: "", ...SETTING_DEFAULTS }),
    ]);
    let keywords = localData.keywords || "";
    if (!keywords && syncData.keywords) {
      // migrate legacy installs that kept keywords in sync
      keywords = syncData.keywords;
      try {
        await storages.local.set({ keywords });
        await storages.sync.remove("keywords");
      } catch {
        // storage may be unavailable in some contexts — keep working
      }
    }
    const out = { keywords };
    for (const k of SETTING_KEYS) out[k] = k in syncData ? syncData[k] : SETTING_DEFAULTS[k];
    return out;
  }

  async function saveKeywords(storages, keywords) {
    await storages.local.set({ keywords: String(keywords || "") });
  }

  async function saveSettings(storages, settings) {
    const clean = {};
    for (const k of SETTING_KEYS) if (k in settings) clean[k] = settings[k];
    await storages.sync.set(clean);
  }
  function isLearnedCard(c) {
    if (!c || typeof c !== "object") return false;
    if (typeof c.reps === "number") return c.reps > 0;
    // Anki card type: 0=new, 1=learning, 2=review
    if (typeof c.type === "number") return c.type !== 0;
    return true; // unknown shape — keep (query already filtered)
  }

  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  async function postJson(url, body, extraHeaders) {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(extraHeaders || {}) },
        body: JSON.stringify(body),
      });
    } catch (e) {
      // Connection refused = Anki ปิดอยู่ / Anki-Connect ไม่ได้รัน (port ไม่เปิด)
      throw new Error(
        `เชื่อมต่อ ${url} ไม่ได้ (${e.message || "Failed to fetch"}) — Anki อาจปิดอยู่ หรือ Anki-Connect ยังไม่ทำงาน`,
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${text.slice(0, 120)}`);
    }
    return res.json();
  }

  // Try /api/v1 (JSON-RPC 2.0) first, fall back to legacy / (v6).
  async function invoke(baseUrl, apiKey, action, params) {
    const base = normalizeBaseUrl(baseUrl);
    const key = String(apiKey || "");
    const headers = key ? { Authorization: "Bearer " + key } : undefined;
    // v1
    try {
      const v1 = await postJson(
        base + "/api/v1",
        { jsonrpc: "2.0", id: 1, method: action, params: params || {} },
        headers,
      );
      if (v1 && ("result" in v1 || "error" in v1)) {
        if (v1.error) throw new Error(v1.error.message || JSON.stringify(v1.error));
        return v1.result;
      }
      // unexpected shape — fall through to legacy
    } catch (e) {
      // 404/old server → legacy; keep original error if legacy also fails
      const legacyErr = await invokeLegacy(base, key, action, params).catch((le) => {
        throw new Error(`v1 failed (${e.message}); legacy failed (${le.message})`);
      });
      return legacyErr;
    }
    return invokeLegacy(base, key, action, params);
  }

  async function invokeLegacy(base, key, action, params) {
    const body = { action, version: LEGACY_VERSION, params: params || {} };
    if (key) body.key = key;
    const data = await postJson(base + "/", body);
    if (data && data.error) throw new Error(String(data.error));
    return data ? data.result : null;
  }

  function mergeKeywords(existingRaw, incoming) {
    const seen = new Set();
    const out = [];
    const push = (w) => {
      const t = String(w || "").trim();
      if (!t) return;
      const k = t.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      out.push(t);
    };
    String(existingRaw || "")
      .split(/[,，;\n]+/)
      .forEach(push);
    (incoming || []).forEach(push);
    return out.join(", ");
  }

  async function sync(opts) {
    const {
      baseUrl,
      apiKey = "",
      deck = "",
      field = "",
      mode = "learned",
      limit = 5000,
      fetchFn, // for tests; defaults to global fetch
    } = opts || {};
    if (fetchFn) globalThis.fetch = fetchFn;
    const query = buildQuery(deck, mode);
    const cardIds = await invoke(baseUrl, apiKey, "findCards", { query });
    if (!Array.isArray(cardIds) || cardIds.length === 0) return { query, words: [], cardCount: 0 };
    const limited = cardIds.slice(0, limit);
    let words = [];
    // Prefer cardsInfo (has reps/type for learned check + fields)
    let cards = [];
    for (const part of chunk(limited, 200)) {
      const info = await invoke(baseUrl, apiKey, "cardsInfo", { cards: part });
      if (Array.isArray(info)) cards.push(...info);
    }
    if (mode === "learned") cards = cards.filter(isLearnedCard);
    if (cards.length && cards[0].fields) {
      words = extractKeywordsFromCards(cards, field, limit);
    } else {
      const noteIds = [...new Set(cards.map((c) => c.note).filter(Boolean))];
      for (const part of chunk(noteIds, 200)) {
        const notes = await invoke(baseUrl, apiKey, "notesInfo", { notes: part });
        words.push(...extractKeywordsFromNotes(notes, field, limit));
        if (words.length >= limit) break;
      }
      words = words.slice(0, limit);
    }
    return { query, words, cardCount: cardIds.length };
  }

  // Quick check: is Anki-Connect reachable? Returns { endpoint, version }.
  async function testConnection(baseUrl, apiKey) {
    const base = normalizeBaseUrl(baseUrl);
    const key = String(apiKey || "");
    try {
      const v = await invoke(base, key, "version", {});
      return { endpoint: base + " (/api/v1 หรือ /)", version: v };
    } catch (e) {
      throw new Error(
        `${e.message} — ตรวจ: 1) เปิด Anki ค้างไว้ 2) Tools → Add-ons มี Anki-Connect และไม่มี error 3) restart Anki หลังติดตั้ง/อัปเดต add-on`,
      );
    }
  }

  return {
    normalizeBaseUrl,
    buildQuery,
    stripHtml,
    pickFieldValues,
    extractKeywordsFromNotes,
    extractKeywordsFromCards,
    isLearnedCard,
    mergeKeywords,
    invoke,
    testConnection,
    loadState,
    saveKeywords,
    saveSettings,
    SETTING_DEFAULTS,
    sync,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = AnkiSync;

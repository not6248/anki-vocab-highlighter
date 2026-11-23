const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  keywords: "",
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
  shortcut: "Alt+Shift+H",
  ankiUrl: "http://127.0.0.1:8765",
  ankiKey: "",
  ankiDeck: "",
  ankiField: "",
  ankiMode: "learned",
};

let cachedAuto = true;
let currentTheme = "system";

let currentLang = "en";

/* Popup UI strings — English default, ไทยใน System tab. Applied via
 * data-i18n* attributes (static) + t() calls (dynamic messages). */
const STRINGS = {
  en: {
    navLabel: "Settings",
    tabHighlight: "Highlight",
    tabStyle: "Customize",
    tabSystem: "System & Anki",
    hint1: "Separate words with commas or new lines<br />e.g. <code>xxx, yyy, zzz</code>",
    enabled: "Enabled",
    bgColor: "Background",
    save: "Save & Highlight",
    clear: "Clear words",
    highlightNow: "Highlight now",
    clearPage: "Clear page colors",
    clearPageTitle: "Remove highlights from the open page",
    shortcutLabel: "Shortcut",
    notSet: "Not set",
    changeBtn: "Change",
    cancelBtn: "Cancel",
    shortcutHint: "Press this on any web page to highlight instantly, no popup needed",
    recPress: "Press shortcut…",
    recHint: "Needs Ctrl, Alt or Meta · Backspace clears · Esc cancels",
    savedShortcut: "Saved: press {keys} on any page to highlight",
    clearedShortcut: "Shortcut cleared",
    needMod: "Needs Ctrl, Alt or Meta · Esc cancels",
    countWords: "{n} words",
    countEmpty: "No words yet",
    matchLegend: "Word matching",
    matchCase: "Match case",
    wholeWord: "Whole words only",
    inflect: "Include inflections (s/ed/ing/irregular)",
    subMatch: "Turn whole-word off for substring matching — useful for Thai with no spaces",
    styleLegend: "Highlight appearance",
    textColor: "Text color",
    bold: "Bold",
    underline: "Underline",
    bgHint: "Background color lives on the Highlight tab",
    behaviorLegend: "Behavior",
    autoOn: "Highlight automatically",
    autoNote: "On: highlight every page + watch pages that load more (best for reading)<br />Off: press “Highlight now” yourself — never touches the DOM while you select text",
    themeLegend: "Popup theme",
    themeLight: "Light",
    themeSystem: "System",
    themeDark: "Dark",
    themeLabel: "Theme",
    themeQuickTitle: "Switch light / dark theme",
    langLegend: "Language",
    ankiHint: "Pull words from Anki as keywords — keep Anki open before pressing Sync",
    phApiKey: "API key (if set, else leave empty)",
    phDeck: "Deck e.g. Default (empty = every deck, * = every deck)",
    phField: "Field e.g. Word (empty = guess word field, * = every field)",
    modeAll: "All words",
    modeLearned: "Learned only",
    testBtn: "Test connection",
    ankiTiny: "Learned = cards that are not new (-is:new). If sync fails: check Anki is open, approve the Anki popup, add the extension origin to webCorsOriginList",
    savedStatus: "Saved",
    highlightingStatus: "Highlighting…",
    savedManualStatus: "Saved — press Highlight now",
    syncing: "Syncing Anki…",
    syncNone: "No words found (query: {q}, cards: {c})\nCheck deck/field names or try “All words” mode",
    syncDone: "Sync done: {w} words (cards: {c})\nquery: {q}",
    syncFail: "Sync failed: {m}",
    syncHintSuffix: "\nCheck: 1) Anki is open 2) Anki-Connect is installed 3) approve the Anki popup 4) extension origin is in webCorsOriginList",
    testing: "Testing…",
    connOk: "Connected: Anki-Connect v{v}",
    connFail: "Connection failed: {m}",
  },
  th: {
    navLabel: "ส่วนตั้งค่า",
    tabHighlight: "ไฮไลต์",
    tabStyle: "ปรับแต่ง",
    tabSystem: "ระบบ & Anki",
    hint1: "ใส่คำคั่นด้วย comma หรือขึ้นบรรทัดใหม่<br />เช่น <code>xxx, yyy, zzz</code>",
    enabled: "เปิดใช้งาน",
    bgColor: "พื้นหลัง",
    save: "บันทึก & Highlight",
    clear: "ล้างคำ",
    highlightNow: "Highlight ตอนนี้",
    clearPage: "ล้างสีในหน้า",
    clearPageTitle: "ล้างแถบสีในหน้าที่เปิดอยู่",
    shortcutLabel: "ปุ่มลัด",
    notSet: "ยังไม่ได้ตั้ง",
    changeBtn: "เปลี่ยน",
    cancelBtn: "ยกเลิก",
    shortcutHint: "กดปุ่มนี้บนหน้าเว็บเพื่อ highlight ทันที ไม่ต้องเปิด popup",
    recPress: "กดปุ่มลัด…",
    recHint: "ต้องมี Ctrl, Alt หรือ Meta · Backspace ล้าง · Esc ยกเลิก",
    savedShortcut: "บันทึกแล้ว: กด {keys} บนหน้าเว็บเพื่อ highlight",
    clearedShortcut: "ล้างปุ่มลัดแล้ว",
    needMod: "ต้องมี Ctrl, Alt หรือ Meta · Esc ยกเลิก",
    countWords: "จำนวนคำ: {n}",
    countEmpty: "ยังไม่มีคำ",
    matchLegend: "การจับคู่คำ",
    matchCase: "ตัวเล็ก/ใหญ่ตรงกัน",
    wholeWord: "จับทั้งคำเท่านั้น",
    inflect: "รวมรูปผัน (s/ed/ing/irregular)",
    subMatch: "ปิดทั้งคำแล้วจับแบบ substring ได้ เหมาะกับภาษาไทยที่ไม่มีช่องว่าง",
    styleLegend: "ลักษณะแถบสี",
    textColor: "สีตัวอักษร",
    bold: "ตัวหนา",
    underline: "ขีดเส้นใต้",
    bgHint: "สีพื้นหลังตั้งได้ที่แท็บไฮไลต์",
    behaviorLegend: "พฤติกรรม",
    autoOn: "ไฮไลต์อัตโนมัติ",
    autoNote: "เปิด: highlight ทุกหน้า + เฝ้าหน้าเว็บที่โหลดเพิ่ม (เหมาะกับเว็บอ่านทั่วไป)<br />ปิด: กด “Highlight ตอนนี้” เอง ไม่แตะ DOM ขณะครอบข้อความหรือเลือกข้อความ",
    themeLegend: "ธีม popup",
    themeLight: "สว่าง",
    themeSystem: "ระบบ",
    themeDark: "มืด",
    themeLabel: "ธีม",
    themeQuickTitle: "สลับธีมสว่าง / มืด",
    langLegend: "ภาษา",
    ankiHint: "ดึงคำจาก Anki มาเป็น keywords — เปิด Anki ทิ้งไว้ก่อนกด Sync",
    phApiKey: "API key (ถ้ามี, ไม่มีเว้นว่าง)",
    phDeck: "Deck เช่น Default (ว่าง = ทุก deck, * = ทุก deck)",
    phField: "Field เช่น Word (ว่าง = เดาฟิลด์คำ, * = ทุกฟิลด์)",
    modeAll: "ทุกคำ",
    modeLearned: "เคยเรียนแล้ว",
    testBtn: "ทดสอบเชื่อมต่อ",
    ankiTiny: "เคยเรียนแล้ว = ไพ่ที่ไม่ใช่ new (-is:new). ถ้า Sync ไม่ติด: เช็ค Anki เปิดอยู่, approve popup ใน Anki, ใส่ origin ของ extension ใน webCorsOriginList",
    savedStatus: "บันทึกแล้ว",
    highlightingStatus: "กำลัง highlight…",
    savedManualStatus: "บันทึกแล้ว รอกด Highlight ตอนนี้",
    syncing: "กำลัง Sync Anki...",
    syncNone: "ไม่พบคำ (query: {q}, cards: {c})\nเช็คชื่อ deck/field หรือลองโหมด “ทุกคำ”",
    syncDone: "Sync สำเร็จ: {w} คำ (cards: {c})\nquery: {q}",
    syncFail: "Sync ล้มเหลว: {m}",
    syncHintSuffix: "\nเช็ค: 1) เปิด Anki ค้างไว้ 2) ติดตั้ง Anki-Connect แล้ว 3) approve popup ใน Anki 4) webCorsOriginList มี origin ของ extension",
    testing: "กำลังทดสอบ...",
    connOk: "เชื่อมต่อสำเร็จ: Anki-Connect v{v}",
    connFail: "เชื่อมต่อล้มเหลว: {m}",
  },
};

function t(key, vars) {
  const table = STRINGS[currentLang] || STRINGS.en;
  let s = table[key] !== undefined ? table[key] : (STRINGS.en[key] !== undefined ? STRINGS.en[key] : key);
  if (vars) for (const k of Object.keys(vars)) s = s.split("{" + k + "}").join(String(vars[k]));
  return s;
}

function applyLanguage(lang) {
  currentLang = STRINGS[lang] ? lang : "en";
  document.documentElement.lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.getAttribute("data-i18n-html"));
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    el.placeholder = t(el.getAttribute("data-i18n-ph"));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.getAttribute("data-i18n-title"));
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
  });
  const note = $("autoNote");
  if (note) note.innerHTML = t("autoNote");
  renderShortcut();
  if (recordingShortcut) {
    $("shortcutKeys").textContent = t("recPress");
    $("shortcutHint").textContent = t("recHint");
  } else {
    $("shortcutHint").textContent = t("shortcutHint");
  }
  updateCount($("keywords").value);
  applyTheme();
}

function syncLangSeg() {
  document.querySelectorAll("[data-lang-opt]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.langOpt === currentLang));
  });
}

async function setLang(lang, save = true) {
  currentLang = STRINGS[lang] ? lang : "en";
  syncLangSeg();
  applyLanguage(currentLang);
  if (save) await AnkiSync.saveSettings(chrome.storage, { language: currentLang });
}

let currentShortcut = Shortcut.DEFAULT;
let recordingShortcut = false;
const mediaDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function getAnkiMode() {
  const el = document.querySelector('input[name="ankiMode"]:checked');
  return el ? el.value : "learned";
}

function setAnkiMode(mode) {
  const el = document.querySelector(`input[name="ankiMode"][value="${mode}"]`);
  if (el) el.checked = true;
}

function resolvedTheme() {
  if (currentTheme === "dark") return "dark";
  if (currentTheme === "light") return "light";
  return mediaDark && mediaDark.matches ? "dark" : "light";
}

function applyTheme() {
  document.documentElement.dataset.theme = resolvedTheme();
  document.querySelectorAll("[data-theme-opt]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.themeOpt === currentTheme));
  });
  const label = t(currentTheme === "light" ? "themeLight" : currentTheme === "dark" ? "themeDark" : "themeSystem");
  $("themeQuick").textContent = t("themeLabel") + ": " + label;
}

async function setTheme(t) {
  currentTheme = t;
  applyTheme();
  await AnkiSync.saveSettings(chrome.storage, { theme: t });
}

function switchTab(name) {
  document.querySelectorAll("nav.tabs button").forEach((b) => {
    b.setAttribute("aria-selected", String(b.dataset.tab === name));
  });
  document.querySelectorAll("section.panel").forEach((p) => {
    const on = p.id === `tab-${name}`;
    p.classList.toggle("active", on);
    if (on) p.removeAttribute("hidden");
    else p.setAttribute("hidden", "");
  });
  try {
    localStorage.setItem("ce-tab", name);
  } catch { /* popup storage may be unavailable */ }
}

async function load() {
  const data = await AnkiSync.loadState(chrome.storage);
  $("keywords").value = data.keywords;
  $("color").value = data.color;
  $("textColor").value = data.textColor || DEFAULTS.textColor;
  $("bold").checked = !!data.bold;
  $("underline").checked = !!data.underline;
  $("caseSensitive").checked = !!data.caseSensitive;
  $("wholeWord").checked = data.wholeWord !== false;
  $("inflect").checked = data.inflect !== false;
  $("enabled").checked = data.enabled !== false;
  $("autoHighlight").checked = data.autoHighlight !== false;
  cachedAuto = $("autoHighlight").checked;
  currentTheme = data.theme || "system";
  currentShortcut = data.shortcut != null ? data.shortcut : Shortcut.DEFAULT;
  $("ankiUrl").value = data.ankiUrl || DEFAULTS.ankiUrl;
  $("ankiKey").value = data.ankiKey || "";
  $("ankiDeck").value = data.ankiDeck || "";
  $("ankiField").value = data.ankiField || "";
  setAnkiMode(data.ankiMode || "learned");
  setLang(data.language || "en", false);
  let initial = "highlight";
  try {
    initial = localStorage.getItem("ce-tab") || "highlight";
  } catch { /* ignore */ }
  if (!document.getElementById(`tab-${initial}`)) initial = "highlight";
  switchTab(initial);
}

function updateCount(raw) {
  const n = raw
    .split(/[,，\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
  $("count").textContent = n ? t("countWords", { n }) : t("countEmpty");
}

function collectSettings() {
  return {
    color: $("color").value,
    textColor: $("textColor").value,
    bold: $("bold").checked,
    underline: $("underline").checked,
    caseSensitive: $("caseSensitive").checked,
    wholeWord: $("wholeWord").checked,
    inflect: $("inflect").checked,
    enabled: $("enabled").checked,
    autoHighlight: $("autoHighlight").checked,
  };
}

async function notifyTabs(type = "CE_REHIGHLIGHT") {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type }).catch(() => {});
  } catch {
    // popup อาจเปิดโดยไม่มี active tab ที่ส่ง message ได้ เช่น chrome://
  }
}

document.querySelectorAll("nav.tabs button").forEach((b) => {
  b.addEventListener("click", () => switchTab(b.dataset.tab));
});

$("keywords").addEventListener("input", (e) => updateCount(e.target.value));

// ธีม
document.querySelectorAll("[data-theme-opt]").forEach((b) => {
  b.addEventListener("click", () => setTheme(b.dataset.themeOpt));
});
document.querySelectorAll("[data-lang-opt]").forEach((b) => {
  b.addEventListener("click", () => setLang(b.dataset.langOpt));
});
$("themeQuick").addEventListener("click", () => {
  const next = currentTheme === "system" ? "light" : currentTheme === "light" ? "dark" : "system";
  setTheme(next);
});
if (mediaDark && mediaDark.addEventListener) {
  mediaDark.addEventListener("change", () => {
    if (currentTheme === "system") applyTheme();
  });
}

// บันทึก & Highlight — ปุ่มชัดแจ้ง ทำในทุกโหมด
$("save").addEventListener("click", async () => {
  await AnkiSync.saveKeywords(chrome.storage, $("keywords").value);
  const s = collectSettings();
  cachedAuto = s.autoHighlight;
  await AnkiSync.saveSettings(chrome.storage, s);
  $("status").textContent = t("savedStatus");
  setTimeout(() => ($("status").textContent = ""), 1500);
  await notifyTabs("CE_REHIGHLIGHT");
});

// Highlight ตอนนี้ — สำหรับโหมด manual: เซฟงานค้างก่อนแล้วสั่งทำทันที
$("highlightNow").addEventListener("click", async () => {
  await AnkiSync.saveKeywords(chrome.storage, $("keywords").value);
  const s = collectSettings();
  cachedAuto = s.autoHighlight;
  await AnkiSync.saveSettings(chrome.storage, s);
  $("status").textContent = t("highlightingStatus");
  await notifyTabs("CE_HIGHLIGHT_NOW");
  setTimeout(() => ($("status").textContent = ""), 1500);
});

$("clearPage").addEventListener("click", async () => {
  await notifyTabs("CE_CLEAR");
});

// --- ปุ่มลัด: กดเปลี่ยนแล้วบันทึกปุ่มที่กดใน popup ---
function renderShortcut() {
  $("shortcutKeys").textContent = currentShortcut ? Shortcut.format(currentShortcut) : t("notSet");
}

function setRecording(on) {
  recordingShortcut = on;
  const kbd = $("shortcutKeys");
  kbd.classList.toggle("recording", on);
  $("editShortcut").textContent = on ? t("cancelBtn") : t("changeBtn");
  if (on) {
    kbd.textContent = t("recPress");
    $("shortcutHint").textContent = t("recHint");
  } else {
    renderShortcut();
    $("shortcutHint").textContent = t("shortcutHint");
  }
}

async function saveShortcut(combo) {
  currentShortcut = combo;
  await AnkiSync.saveSettings(chrome.storage, { shortcut: combo });
  setRecording(false);
  $("shortcutHint").textContent = combo
    ? t("savedShortcut", { keys: Shortcut.format(combo) })
    : t("clearedShortcut");
}

$("editShortcut").addEventListener("click", () => setRecording(!recordingShortcut));

document.addEventListener(
  "keydown",
  async (e) => {
    if (!recordingShortcut) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setRecording(false);
      return;
    }
    if (e.key === "Tab") {
      setRecording(false);
      return; // ปล่อยให้ Tab ย้ายโฟกัสตามปกติ
    }
    e.preventDefault();
    e.stopPropagation();
    if (Shortcut.isModifierKey(e)) return;
    if (!e.ctrlKey && !e.altKey && !e.metaKey && (e.key === "Backspace" || e.key === "Delete")) {
      await saveShortcut("");
      return;
    }
    const combo = Shortcut.fromEvent(e);
    if (!combo || !Shortcut.hasRequiredModifier(combo)) {
      $("shortcutHint").textContent = t("needMod");
      return;
    }
    await saveShortcut(combo);
  },
  true,
);

$("clear").addEventListener("click", async () => {
  $("keywords").value = "";
  await AnkiSync.saveKeywords(chrome.storage, "");
  updateCount("");
  // ล้างคำ = ตั้งใจชัดแจ้ง ให้แท็บล้างสีด้วย
  await notifyTabs("CE_CLEAR");
});

$("enabled").addEventListener("change", async (e) => {
  await AnkiSync.saveSettings(chrome.storage, { enabled: e.target.checked });
  // ปิดใช้งานต้องล้างทันทีแม้โหมด manual
  await notifyTabs(e.target.checked ? "CE_REHIGHLIGHT" : "CE_CLEAR");
});

$("autoHighlight").addEventListener("change", async (e) => {
  cachedAuto = e.target.checked;
  await AnkiSync.saveSettings(chrome.storage, { autoHighlight: cachedAuto });
  // เปิด auto กลับมา → highlight เลย; ปิด → เงียบไว้ ไม่แตะ DOM
  if (cachedAuto) await notifyTabs("CE_REHIGHLIGHT");
  const note = $("autoNote");
  if (note) note.innerHTML = t("autoNote");
});

// style + match options: โหมด auto ให้เห็นผลทันที, โหมด manual เก็บเงียบรอปุ่ม
for (const id of ["color", "textColor", "bold", "underline", "caseSensitive", "wholeWord", "inflect"]) {
  $(id).addEventListener("change", async () => {
    const s = collectSettings();
    cachedAuto = s.autoHighlight;
    await AnkiSync.saveSettings(chrome.storage, s);
    if (cachedAuto) await notifyTabs("CE_REHIGHLIGHT");
    else {
      $("status").textContent = t("savedManualStatus");
      setTimeout(() => ($("status").textContent = ""), 1500);
    }
  });
}

async function saveAnkiSettings() {
  await AnkiSync.saveSettings(chrome.storage, {
    ankiUrl: $("ankiUrl").value.trim(),
    ankiKey: $("ankiKey").value,
    ankiDeck: $("ankiDeck").value.trim(),
    ankiField: $("ankiField").value.trim(),
    ankiMode: getAnkiMode(),
  });
}

for (const id of ["ankiUrl", "ankiKey", "ankiDeck", "ankiField"]) {
  $(id).addEventListener("change", saveAnkiSettings);
}
for (const r of document.querySelectorAll('input[name="ankiMode"]')) {
  r.addEventListener("change", saveAnkiSettings);
}

$("syncAnki").addEventListener("click", async () => {
  const btn = $("syncAnki");
  const box = $("ankiStatus");
  btn.disabled = true;
  box.textContent = t("syncing");
  try {
    await saveAnkiSettings();
    const opts = {
      baseUrl: $("ankiUrl").value.trim() || DEFAULTS.ankiUrl,
      apiKey: $("ankiKey").value,
      deck: $("ankiDeck").value.trim(),
      field: $("ankiField").value.trim(),
      mode: getAnkiMode(),
    };
    const { query, words, cardCount } = await AnkiSync.sync(opts);
    if (!words.length) {
      box.textContent = t("syncNone", { q: query, c: cardCount });
      return;
    }
    const merged = AnkiSync.mergeKeywords($("keywords").value, words);
    $("keywords").value = merged;
    await AnkiSync.saveKeywords(chrome.storage, merged);
    updateCount(merged);
    box.textContent = t("syncDone", { w: words.length, c: cardCount, q: query });
    await notifyTabs("CE_REHIGHLIGHT");
  } catch (e) {
    const msg = String((e && e.message) || e);
    let hint = "";
    if (/เชื่อมต่อ .* ไม่ได้|Failed to fetch|NetworkError|Load failed/i.test(msg)) {
      hint = t("syncHintSuffix");
    }
    box.textContent = t("syncFail", { m: msg }) + hint;
  } finally {
    btn.disabled = false;
  }
});

$("testAnki").addEventListener("click", async () => {
  const btn = $("testAnki");
  const box = $("ankiStatus");
  btn.disabled = true;
  box.textContent = t("testing");
  try {
    await saveAnkiSettings();
    const { version } = await AnkiSync.testConnection($("ankiUrl").value.trim() || DEFAULTS.ankiUrl, $("ankiKey").value);
    box.textContent = t("connOk", { v: version });
  } catch (e) {
    box.textContent = t("connFail", { m: String((e && e.message) || e) });
  } finally {
    btn.disabled = false;
  }
});

load();

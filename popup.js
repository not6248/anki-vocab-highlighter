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
  ankiUrl: "http://127.0.0.1:8765",
  ankiKey: "",
  ankiDeck: "",
  ankiField: "",
  ankiMode: "learned",
};

let cachedAuto = true;
let currentTheme = "system";
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
  const label = currentTheme === "light" ? "สว่าง" : currentTheme === "dark" ? "มืด" : "ระบบ";
  $("themeQuick").textContent = `ธีม: ${label}`;
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
  $("ankiUrl").value = data.ankiUrl || DEFAULTS.ankiUrl;
  $("ankiKey").value = data.ankiKey || "";
  $("ankiDeck").value = data.ankiDeck || "";
  $("ankiField").value = data.ankiField || "";
  setAnkiMode(data.ankiMode || "learned");
  updateCount(data.keywords);
  applyTheme();
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
  $("count").textContent = n ? `จำนวนคำ: ${n}` : "ยังไม่มีคำ";
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
  $("status").textContent = "บันทึกแล้ว";
  setTimeout(() => ($("status").textContent = ""), 1500);
  await notifyTabs("CE_REHIGHLIGHT");
});

// Highlight ตอนนี้ — สำหรับโหมด manual: เซฟงานค้างก่อนแล้วสั่งทำทันที
$("highlightNow").addEventListener("click", async () => {
  await AnkiSync.saveKeywords(chrome.storage, $("keywords").value);
  const s = collectSettings();
  cachedAuto = s.autoHighlight;
  await AnkiSync.saveSettings(chrome.storage, s);
  $("status").textContent = "กำลัง highlight…";
  await notifyTabs("CE_HIGHLIGHT_NOW");
  setTimeout(() => ($("status").textContent = ""), 1500);
});

$("clearPage").addEventListener("click", async () => {
  await notifyTabs("CE_CLEAR");
});

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
  if (note) {
    note.textContent = cachedAuto
      ? "เปิด: highlight ทุกหน้า + เฝ้าหน้าเว็บที่โหลดเพิ่ม"
      : "ปิด: กด “Highlight ตอนนี้” เอง ไม่แตะ DOM ขณะครอบข้อความ";
  }
});

// style + match options: โหมด auto ให้เห็นผลทันที, โหมด manual เก็บเงียบรอปุ่ม
for (const id of ["color", "textColor", "bold", "underline", "caseSensitive", "wholeWord", "inflect"]) {
  $(id).addEventListener("change", async () => {
    const s = collectSettings();
    cachedAuto = s.autoHighlight;
    await AnkiSync.saveSettings(chrome.storage, s);
    if (cachedAuto) await notifyTabs("CE_REHIGHLIGHT");
    else {
      $("status").textContent = "บันทึกแล้ว รอกด Highlight ตอนนี้";
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
  box.textContent = "กำลัง Sync Anki...";
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
      box.textContent = `ไม่พบคำ (query: ${query}, cards: ${cardCount})\nเช็คชื่อ deck/field หรือลองโหมด "ทุกคำ"`;
      return;
    }
    const merged = AnkiSync.mergeKeywords($("keywords").value, words);
    $("keywords").value = merged;
    await AnkiSync.saveKeywords(chrome.storage, merged);
    updateCount(merged);
    box.textContent = `Sync สำเร็จ: ${words.length} คำ (cards: ${cardCount})\nquery: ${query}`;
    await notifyTabs("CE_REHIGHLIGHT");
  } catch (e) {
    const msg = String((e && e.message) || e);
    let hint = "";
    if (/เชื่อมต่อ .* ไม่ได้|Failed to fetch|NetworkError|Load failed/i.test(msg)) {
      hint = "\nเช็ค: 1) เปิด Anki ค้างไว้ 2) ติดตั้ง Anki-Connect แล้ว 3) approve popup ใน Anki 4) webCorsOriginList มี origin ของ extension";
    }
    box.textContent = `Sync ล้มเหลว: ${msg}${hint}`;
  } finally {
    btn.disabled = false;
  }
});

$("testAnki").addEventListener("click", async () => {
  const btn = $("testAnki");
  const box = $("ankiStatus");
  btn.disabled = true;
  box.textContent = "กำลังทดสอบ...";
  try {
    await saveAnkiSettings();
    const { version } = await AnkiSync.testConnection($("ankiUrl").value.trim() || DEFAULTS.ankiUrl, $("ankiKey").value);
    box.textContent = `เชื่อมต่อสำเร็จ: Anki-Connect v${version}`;
  } catch (e) {
    box.textContent = `เชื่อมต่อล้มเหลว: ${String((e && e.message) || e)}`;
  } finally {
    btn.disabled = false;
  }
});

load();

(() => {
  "use strict";

  const CLASS = "ce-highlight";
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "NOSCRIPT"]);
  const DEFAULT_COLOR = "#ffeb3b";

  const HL = typeof Highlight !== "undefined" ? Highlight : null;

  let current = {
    keywords: [],
    color: DEFAULT_COLOR,
    textColor: "#000000",
    bold: false,
    underline: false,
    caseSensitive: false,
    wholeWord: true,
    inflect: true,
    enabled: true,
    autoHighlight: true,
  };
  let debounceTimer = 0;
  let observer = null;

  function hasUncollapsedSelection() {
    try {
      const sel = document.getSelection();
      return !!sel && sel.rangeCount > 0 && !sel.isCollapsed;
    } catch {
      return false;
    }
  }

  function ensureObserver() {
    if (!document.body) return;
    const want = !!(current.autoHighlight && current.enabled);
    if (want && !observer) {
      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "childList" && (m.addedNodes.length || m.removedNodes.length)) {
            scheduleRehighlight();
            break;
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } else if (want && observer) {
      // already observing — nothing to do
    } else if (!want && observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function isSkipped(node) {
    let el = node.parentElement;
    while (el) {
      if (el.classList && el.classList.contains(CLASS)) return true;
      if (SKIP_TAGS.has(el.tagName)) return true;
      if (el.isContentEditable) return true;
      el = el.parentElement;
    }
    return false;
  }

  function collectTextNodes(root) {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (isSkipped(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  function styleMark(mark, style) {
    mark.style.backgroundColor = style.color;
    mark.style.color = style.textColor;
    mark.style.fontWeight = style.bold ? "bold" : "";
    mark.style.textDecoration = style.underline ? "underline" : "";
  }

  function highlightNode(textNode, regex, style) {
    const text = textNode.nodeValue;
    regex.lastIndex = 0;
    let match;
    let lastIndex = 0;
    const frag = document.createDocumentFragment();
    let found = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex += 1;
        continue;
      }
      found += 1;
      const start = match.index;
      if (start > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
      const mark = document.createElement("span");
      mark.className = CLASS;
      mark.textContent = match[0];
      styleMark(mark, style);
      frag.appendChild(mark);
      lastIndex = start + match[0].length;
      // กัน loop ค้างกับ regex ที่ match ซ้ำตำแหน่งเดิม
      if (regex.lastIndex === start) regex.lastIndex += 1;
    }
    if (!found) return 0;
    if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    textNode.parentNode.replaceChild(frag, textNode);
    return found;
  }

  function clearHighlights(root = document.body) {
    if (!root) return;
    const marks = root.querySelectorAll
      ? root.querySelectorAll("span." + CLASS)
      : [];
    marks.forEach((m) => {
      const parent = m.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    });
  }

  function applyHighlight(opts) {
    const force = !!(opts && opts.force);
    // กัน Observer ทำลาย selection ขณะครอบข้อความ: โหมด auto ให้เลื่อนไปก่อน
    // โหมด manual ที่กดปุ่มเอง (force) ถือว่าผู้ใช้ตั้งใจ ให้ทำเลย
    if (!force && hasUncollapsedSelection()) {
      scheduleRehighlight(1000);
      return 0;
    }
    clearHighlights();
    if (!HL || !current.enabled || !current.keywords.length) return 0;
    if (!document.body) return 0;
    let regex;
    try {
      let forms = current.keywords;
      if (current.inflect) forms = HL.expandKeywords(forms);
      regex = HL.buildHighlightRegex(forms, {
        caseSensitive: current.caseSensitive,
        wholeWord: current.wholeWord,
      });
    } catch {
      return 0; // keyword มีอักขระที่สร้าง regex ไม่ได้
    }
    if (!regex) return 0;
    const nodes = collectTextNodes(document.body);
    const style = {
      color: current.color,
      textColor: current.textColor,
      bold: current.bold,
      underline: current.underline,
    };
    let total = 0;
    for (const n of nodes) {
      // node อาจหลุดจาก DOM แล้วหลัง replace ก่อนหน้า
      if (!n.isConnected) continue;
      try {
        total += highlightNode(n, regex, style);
      } catch {
        // ข้าม node ที่มีปัญหา ไม่ให้ทั้งหน้าพัง
      }
    }
    return total;
  }

  function scheduleRehighlight(delay) {
    if (!current.autoHighlight) return;
    // กำลังลากครอบข้อความอยู่ → เลื่อนออกไป ไม่ให้ selection หลุด
    if (hasUncollapsedSelection()) delay = 1000;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyHighlight(), delay || 400);
  }

  async function reloadSettings(reason) {
    try {
      const data =
        typeof AnkiSync !== "undefined"
          ? await AnkiSync.loadState(chrome.storage)
          : await chrome.storage.sync.get({
              keywords: "",
              color: DEFAULT_COLOR,
              caseSensitive: false,
              enabled: true,
            });
      current = {
        keywords: HL ? HL.parseKeywords(data.keywords) : [],
        color: data.color || DEFAULT_COLOR,
        textColor: data.textColor || "#000000",
        bold: !!data.bold,
        underline: !!data.underline,
        caseSensitive: !!data.caseSensitive,
        wholeWord: data.wholeWord !== false,
        inflect: data.inflect !== false,
        enabled: data.enabled !== false,
        autoHighlight: data.autoHighlight !== false,
      };
    } catch {
      current = { keywords: [], color: DEFAULT_COLOR, textColor: "#000000", bold: false, underline: false, caseSensitive: false, wholeWord: true, inflect: true, enabled: true, autoHighlight: true };
    }
    ensureObserver();
    // โหมด manual สมบูรณ์: ไม่ apply อัตโนมัติเลย ยกเว้นกดปุ่ม (reason === "manual")
    if (!current.autoHighlight && reason !== "manual") {
      if (!current.enabled) clearHighlights();
      return 0;
    }
    return applyHighlight({ force: reason === "manual" });
  }

  // ตั้งค่าเริ่มต้น — โหมด manual จะยังไม่ highlight จนกว่าจะกดปุ่ม
  reloadSettings("init");

  // เปลี่ยนค่าใน popup แล้ว highlight ใหม่ทันที
  // (keywords อยู่ใน storage.local, settings อยู่ใน storage.sync)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.keywords && HL) {
      current.keywords = HL.parseKeywords(changes.keywords.newValue);
    }
    if (area === "sync") {
      if (changes.color) current.color = changes.color.newValue || DEFAULT_COLOR;
      if (changes.textColor) current.textColor = changes.textColor.newValue || "#000000";
      if (changes.bold) current.bold = !!changes.bold.newValue;
      if (changes.underline) current.underline = !!changes.underline.newValue;
      if (changes.caseSensitive) current.caseSensitive = !!changes.caseSensitive.newValue;
      if (changes.wholeWord) current.wholeWord = changes.wholeWord.newValue !== false;
      if (changes.inflect) current.inflect = changes.inflect.newValue !== false;
      if (changes.enabled) current.enabled = changes.enabled.newValue !== false;
      if (changes.autoHighlight) current.autoHighlight = changes.autoHighlight.newValue !== false;
    }
    ensureObserver();
    // เปลี่ยนแค่ธีม/ค่า Anki ไม่ต้อง rebuild DOM ทั้งหน้า
    const relevant = Object.keys(changes).some((k) => k !== "theme" && !k.startsWith("anki"));
    if (!relevant) return;
    // โหมด manual: เปลี่ยนค่าอะไรก็ไม่ apply เอง ยกเว้นกดปิดใช้งาน → ล้างทันที
    if (!current.autoHighlight) {
      if (changes.enabled && changes.enabled.newValue === false) clearHighlights();
      return;
    }
    applyHighlight();
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || typeof msg.type !== "string") return;
    if (msg.type === "CE_REHIGHLIGHT" || msg.type === "CE_HIGHLIGHT_NOW") {
      reloadSettings("manual");
    } else if (msg.type === "CE_CLEAR") {
      clearHighlights();
    }
  });

  // รองรับเว็บโหลดเนื้อหาเพิ่มทีหลัง (infinite scroll / SPA) — เฉพาะโหมด auto
  // observer ถูกสร้าง/ตัดผ่าน ensureObserver() ตามค่า autoHighlight + enabled
  if (document.body) {
    ensureObserver();
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      if (current.autoHighlight) applyHighlight();
      ensureObserver();
    });
  }
})();

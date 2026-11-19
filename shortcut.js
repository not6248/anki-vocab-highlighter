/* Shared keyboard shortcut helpers (no chrome.* dependency).
 * Canonical format: "Ctrl+Alt+Shift+H" — modifiers first, key last.
 * Keys are derived from KeyboardEvent.code so the combo works on any layout.
 */
const Shortcut = (() => {
  "use strict";

  const DEFAULT = "Alt+Shift+H";

  const SPECIAL = {
    Space: "Space",
    Comma: "Comma",
    Period: "Period",
    Slash: "Slash",
    Semicolon: "Semicolon",
    Quote: "Quote",
    BracketLeft: "BracketLeft",
    BracketRight: "BracketRight",
    Backslash: "Backslash",
    Minus: "Minus",
    Equal: "Equal",
    Backquote: "Backquote",
    ArrowUp: "ArrowUp",
    ArrowDown: "ArrowDown",
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Insert: "Insert",
    Delete: "Delete",
  };

  const LABEL = {
    Comma: ",",
    Period: ".",
    Slash: "/",
    Semicolon: ";",
    Quote: "'",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Minus: "-",
    Equal: "=",
    Backquote: "`",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Delete: "Del",
    Insert: "Ins",
    PageUp: "PgUp",
    PageDown: "PgDn",
  };

  function keyFromEvent(e) {
    const code = String((e && e.code) || "");
    let m = /^Key([A-Z])$/.exec(code);
    if (m) return m[1];
    m = /^Digit([0-9])$/.exec(code);
    if (m) return m[1];
    if (SPECIAL[code]) return SPECIAL[code];
    // fallback for synthetic events that have no `code`
    const k = String((e && e.key) || "");
    if (/^[a-zA-Z]$/.test(k)) return k.toUpperCase();
    if (/^[0-9]$/.test(k)) return k;
    return null;
  }

  function isModifierKey(e) {
    return ["Control", "Alt", "Shift", "Meta"].includes(e && e.key);
  }

  // Returns canonical combo, or null if the event has no usable key.
  function fromEvent(e) {
    const key = keyFromEvent(e);
    if (!key) return null;
    const mods = [];
    if (e.ctrlKey) mods.push("Ctrl");
    if (e.altKey) mods.push("Alt");
    if (e.shiftKey) mods.push("Shift");
    if (e.metaKey) mods.push("Meta");
    return [...mods, key].join("+");
  }

  function parse(str) {
    if (!str || typeof str !== "string") return null;
    const parts = str.split("+").map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const key = parts.pop();
    const out = { ctrl: false, alt: false, shift: false, meta: false, key };
    for (const p of parts) {
      const l = p.toLowerCase();
      if (l === "ctrl" || l === "control") out.ctrl = true;
      else if (l === "alt" || l === "option") out.alt = true;
      else if (l === "shift") out.shift = true;
      else if (l === "meta" || l === "cmd" || l === "command") out.meta = true;
      else return null;
    }
    return out;
  }

  function hasRequiredModifier(str) {
    const p = parse(str);
    return !!p && (p.ctrl || p.alt || p.meta);
  }

  function matches(e, str) {
    const p = parse(str);
    if (!p) return false;
    if (e.ctrlKey !== p.ctrl) return false;
    if (e.altKey !== p.alt) return false;
    if (e.shiftKey !== p.shift) return false;
    if (e.metaKey !== p.meta) return false;
    return keyFromEvent(e) === p.key;
  }

  function format(str) {
    if (!str) return "";
    return String(str)
      .split("+")
      .map((p) => LABEL[p] || p)
      .join(" + ");
  }

  return { DEFAULT, keyFromEvent, isModifierKey, fromEvent, parse, hasRequiredModifier, matches, format };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Shortcut;

import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Shortcut = require("./shortcut.js");

const ev = (over) => ({
  code: "KeyH",
  key: "H",
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...over,
});

assert.equal(Shortcut.fromEvent(ev({ altKey: true, shiftKey: true })), "Alt+Shift+H");
assert.equal(Shortcut.fromEvent(ev({ code: "Digit1", key: "1", ctrlKey: true })), "Ctrl+1");
assert.equal(Shortcut.fromEvent(ev({ code: "Comma", key: ",", ctrlKey: true })), "Ctrl+Comma");
assert.equal(Shortcut.fromEvent(ev({ code: "Space", key: " ", metaKey: true })), "Meta+Space");
assert.equal(Shortcut.fromEvent({ code: "", key: "k", ctrlKey: true }), "Ctrl+K", "fallback when code missing");
assert.equal(Shortcut.fromEvent(ev({ code: "F5", key: "F5" })), null, "unsupported key");

assert.equal(Shortcut.format("Alt+Shift+H"), "Alt + Shift + H");
assert.equal(Shortcut.format("Ctrl+Comma"), "Ctrl + ,");
assert.equal(Shortcut.format(""), "");

assert.equal(Shortcut.hasRequiredModifier("Alt+Shift+H"), true);
assert.equal(Shortcut.hasRequiredModifier("Meta+Space"), true);
assert.equal(Shortcut.hasRequiredModifier("Shift+H"), false, "shift alone is not enough");
assert.equal(Shortcut.hasRequiredModifier("H"), false);

assert.equal(Shortcut.matches(ev({ altKey: true, shiftKey: true }), "Alt+Shift+H"), true);
assert.equal(Shortcut.matches(ev({ altKey: true }), "Alt+Shift+H"), false, "missing shift");
assert.equal(Shortcut.matches(ev({ altKey: true, shiftKey: true, code: "KeyJ", key: "J" }), "Alt+Shift+H"), false, "other key");
assert.equal(Shortcut.matches(ev({ ctrlKey: true, altKey: true, shiftKey: true }), "Alt+Shift+H"), false, "extra modifier");
assert.deepEqual(Shortcut.parse("Ctrl+Shift+K"), { ctrl: true, alt: false, shift: true, meta: false, key: "K" });
assert.equal(Shortcut.parse("garbage"), null);
assert.equal(Shortcut.matches(ev({ altKey: true, shiftKey: true }), ""), false, "unbound never matches");

console.log("PASS: shortcut parsing and matching");

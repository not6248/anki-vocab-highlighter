/* Pure highlight helpers (no chrome.* dependency — unit-testable).
 *
 * Whole-word mode uses Unicode-aware boundaries so "tall" matches
 * standalone "tall" but NOT inside "Installation" or "taller".
 *
 * Inflection mode expands each keyword into surface forms
 * (cry → cries/cried/crying, leaf → leaves, run → runs/ran/running)
 * so all forms highlight. Expansion feeds the same whole-word engine.
 */
const Highlight = (() => {
  "use strict";

  function parseKeywords(raw) {
    // รองรับคั่นด้วย comma, semicolon, newline — เช่น "xxx,yyy,zzz"
    const parts = String(raw || "")
      .split(/[,，;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    // ตัดซ้ำ + เรียงยาวไปสั้น เพื่อให้คำยาวชนะก่อน (เช่น "xxx-yy" ก่อน "xxx")
    const uniq = [...new Set(parts)];
    uniq.sort((a, b) => b.length - a.length);
    return uniq;
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // base -> all known surface forms (irregulars). Regular rules in regularForms().
  const IRREG = {
    be: ["be", "am", "is", "are", "was", "were", "been", "being"],
    have: ["have", "has", "had", "having"],
    do: ["do", "does", "did", "done", "doing"],
    go: ["go", "goes", "went", "gone", "going"],
    say: ["say", "says", "said", "saying"],
    get: ["get", "gets", "got", "gotten", "getting"],
    make: ["make", "makes", "made", "making"],
    take: ["take", "takes", "took", "taken", "taking"],
    come: ["come", "comes", "came", "coming"],
    see: ["see", "sees", "saw", "seen", "seeing"],
    eat: ["eat", "eats", "ate", "eaten", "eating"],
    drink: ["drink", "drinks", "drank", "drunk", "drinking"],
    run: ["run", "runs", "ran", "running"],
    swim: ["swim", "swims", "swam", "swum", "swimming"],
    sing: ["sing", "sings", "sang", "sung", "singing"],
    ring: ["ring", "rings", "rang", "rung", "ringing"],
    fall: ["fall", "falls", "fell", "fallen", "falling"],
    give: ["give", "gives", "gave", "given", "giving"],
    drive: ["drive", "drives", "drove", "driven", "driving"],
    ride: ["ride", "rides", "rode", "ridden", "riding"],
    rise: ["rise", "rises", "rose", "risen", "rising"],
    break: ["break", "breaks", "broke", "broken", "breaking"],
    choose: ["choose", "chooses", "chose", "chosen", "choosing"],
    speak: ["speak", "speaks", "spoke", "spoken", "speaking"],
    steal: ["steal", "steals", "stole", "stolen", "stealing"],
    wake: ["wake", "wakes", "woke", "woken", "waking"],
    wear: ["wear", "wears", "wore", "worn", "wearing"],
    tear: ["tear", "tears", "tore", "torn", "tearing"],
    find: ["find", "finds", "found", "finding"],
    fly: ["fly", "flies", "flew", "flown", "flying"],
    grow: ["grow", "grows", "grew", "grown", "growing"],
    know: ["know", "knows", "knew", "known", "knowing"],
    throw: ["throw", "throws", "threw", "thrown", "throwing"],
    draw: ["draw", "draws", "drew", "drawn", "drawing"],
    forget: ["forget", "forgets", "forgot", "forgotten", "forgetting"],
    freeze: ["freeze", "freezes", "froze", "frozen", "freezing"],
    hide: ["hide", "hides", "hid", "hidden", "hiding"],
    shake: ["shake", "shakes", "shook", "shaken", "shaking"],
    shoot: ["shoot", "shoots", "shot", "shooting"],
    sink: ["sink", "sinks", "sank", "sunk", "sinking"],
    spend: ["spend", "spends", "spent", "spending"],
    stand: ["stand", "stands", "stood", "standing"],
    teach: ["teach", "teaches", "taught", "teaching"],
    tell: ["tell", "tells", "told", "telling"],
    think: ["think", "thinks", "thought", "thinking"],
    win: ["win", "wins", "won", "winning"],
    write: ["write", "writes", "wrote", "written", "writing"],
    leaf: ["leaf", "leaves"],
    loaf: ["loaf", "loaves"],
    thief: ["thief", "thieves"],
    wife: ["wife", "wives"],
    knife: ["knife", "knives"],
    life: ["life", "lives"],
    wolf: ["wolf", "wolves"],
    calf: ["calf", "calves"],
    half: ["half", "halves"],
    shelf: ["shelf", "shelves"],
    mouse: ["mouse", "mice"],
    foot: ["foot", "feet"],
    tooth: ["tooth", "teeth"],
    goose: ["goose", "geese"],
    child: ["child", "children"],
    man: ["man", "men"],
    woman: ["woman", "women"],
    person: ["person", "people"],
  };

  const FORM_TO_BASE = {};
  for (const [base, forms] of Object.entries(IRREG)) {
    for (const f of forms) FORM_TO_BASE[f] = base;
  }

  // Regular English inflections for a single lowercase base word.
  function regularForms(base) {
    const out = new Set([base]);
    const add = (f) => {
      if (f && f.length <= 40) out.add(f);
    };
    const isConsonantY = /[^aeiou]y$/.test(base); // cry, happy
    const sibilant = /(s|x|z|ch|sh)$/.test(base); // wash, box
    // 3rd singular / plural
    if (isConsonantY) add(base.slice(0, -1) + "ies");
    else if (sibilant) add(base + "es");
    else add(base + "s");
    if (/o$/.test(base) && !sibilant) add(base + "es"); // potato -> potatoes
    // f/fe -> ves family (leaf->leaves, life->lives)
    if (/fe$/.test(base)) add(base.slice(0, -2) + "ves");
    else if (/[^f]f$/.test(base)) add(base.slice(0, -1) + "ves");
    // past + -ing
    const cvc = /[^aeiou][aeiou][^aeiouwx]$/.test(base) && base.length >= 3; // run, stop
    const doubled = base + base[base.length - 1];
    if (isConsonantY) {
      add(base.slice(0, -1) + "ied");
      add(base.slice(0, -1) + "ying");
    } else if (/[^e]e$/.test(base) || /ee$/.test(base)) {
      if (/ee$/.test(base)) {
        add(base + "d");
        add(base + "ing"); // free -> freed, freeing
      } else {
        add(base + "d"); // hope -> hoped
        add(base.slice(0, -1) + "ing"); // hope -> hoping
      }
    } else {
      add(base + "ed");
      add(base + "ing");
    }
    if (cvc && !isConsonantY) {
      add(doubled + "ed");
      add(doubled + "ing"); // run -> running
    }
    // comparatives (tall -> taller/tallest, happy -> happier)
    if (isConsonantY) {
      add(base.slice(0, -1) + "ier");
      add(base.slice(0, -1) + "iest");
    } else {
      add(base + "er");
      add(base + "est");
      if (cvc) {
        add(doubled + "er");
        add(doubled + "est"); // big -> bigger/biggest
      }
    }
    return out;
  }

  function expandKeyword(kw) {
    // Phrases / hyphenated / non-letters stay exact.
    if (!/^[A-Za-z]+$/.test(kw)) return [kw];
    const lower = kw.toLowerCase();
    const base = FORM_TO_BASE[lower] || lower;
    const out = new Set([kw]);
    for (const f of IRREG[base] || []) out.add(f);
    for (const f of regularForms(base)) out.add(f);
    // preserve original casing variant too (regex is case-insensitive anyway)
    return [...out];
  }

  function expandKeywords(keywords, limit = 30000) {
    const seen = new Set();
    const out = [];
    for (const kw of keywords || []) {
      for (const f of expandKeyword(kw)) {
        const key = f.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(f);
        if (out.length >= limit) return out.sort((a, b) => b.length - a.length);
      }
    }
    out.sort((a, b) => b.length - a.length);
    return out;
  }

  // Build a prefix-trie regex from literal forms: compact + fast even for
  // thousands of forms (shared prefixes collapse, e.g. run/runs/running).
  function trieToPattern(node) {
    const parts = [];
    const kids = [...node.kids.entries()];
    for (const [ch, child] of kids) parts.push(escapeRegExp(ch) + trieToPattern(child));
    if (node.end) parts.push("");
    parts.sort((a, b) => b.length - a.length); // longer first, empty last
    if (parts.length === 1) return parts[0];
    return `(?:${parts.join("|")})`;
  }

  // wholeWord=true: keyword must not be glued to another letter/mark/number.
  // Uses lookarounds (zero-width) so match length is unchanged.
  function buildHighlightRegex(keywords, options) {
    const { caseSensitive = false, wholeWord = true } = options || {};
    if (!keywords || !keywords.length) return null;
    const root = { end: false, kids: new Map() };
    for (const form of keywords) {
      let node = root;
      for (const ch of Array.from(form)) {
        if (!node.kids.has(ch)) node.kids.set(ch, { end: false, kids: new Map() });
        node = node.kids.get(ch);
      }
      node.end = true;
    }
    const trie = trieToPattern(root);
    const body = wholeWord
      ? `(?<![\\p{L}\\p{M}\\p{N}_])(?:${trie})(?![\\p{L}\\p{M}\\p{N}_])`
      : `(?:${trie})`;
    return new RegExp(body, (caseSensitive ? "" : "i") + "gu");
  }

  return { parseKeywords, escapeRegExp, expandKeyword, expandKeywords, buildHighlightRegex };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Highlight;

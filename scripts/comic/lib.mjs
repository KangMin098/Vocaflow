// scripts/comic/lib.mjs
// Shared utilities for the book -> comic pipeline:
// source fetch, GATE-1 (verbatim quote match + coverage), image gen + GATE-2,
// prompt composition, and the Gonick-style HTML assembly.

import fs from "fs";
import path from "path";

const UA = { "User-Agent": "Mozilla/5.0 (Vocaflow comic pipeline)" };

/* ---------- text normalisation (used by the quote gate) ---------- */

export function normalizeForMatch(s) {
  return String(s)
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, "-")
    .replace(/_/g, "")           // gutenberg italics markers
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/* ---------- source acquisition ---------- */

export async function fetchSource(book) {
  if (book.source === "file") {
    const raw = fs.readFileSync(book.ref, "utf8");
    return normalizeSourceText(raw);
  }
  if (book.source === "gutenberg") {
    const id = String(book.ref).trim();
    const urls = [
      `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
      `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    ];
    let lastErr;
    for (const url of urls) {
      try {
        const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(45000) });
        if (r.ok) return normalizeSourceText(await r.text());
        lastErr = new Error(`HTTP ${r.status} @ ${url}`);
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("gutenberg fetch failed");
  }
  throw new Error(`unknown source '${book.source}'`);
}

function normalizeSourceText(raw) {
  return raw.replace(/\r/g, "");
}

/* ---------- GATE-1: verbatim quote match ---------- */
// A quote may condense the original with "…"/"..." — every fragment must
// appear in the source, in order. This catches misquotes (e.g. "that which
// is bad" vs the real "those that are bad").

export function quoteMatch(sourceNorm, quote) {
  const fragments = String(quote)
    .split(/\s*(?:…|\.\.\.)\s*/)
    .map((f) => normalizeForMatch(f))
    .filter(Boolean);
  const missing = [];
  let cursor = 0;
  for (const frag of fragments) {
    const at = sourceNorm.indexOf(frag, cursor);
    if (at === -1) missing.push(frag);
    else cursor = at + frag.length;
  }
  return { ok: missing.length === 0, missing, fragments: fragments.length };
}

/* ---------- GATE-1: full report ---------- */

export function gate1(script, sourceText) {
  const sourceNorm = normalizeForMatch(sourceText);
  const totalChars = sourceNorm.length;
  const quotes = [];
  const defTier = script.adaptation.default_tier;

  for (const p of script.panels) {
    for (const [tier, t] of Object.entries(p.text || {})) {
      if (t.quote) {
        const m = quoteMatch(sourceNorm, t.quote);
        quotes.push({ panel: p.n, tier, ok: m.ok, missing: m.missing, quote: t.quote });
      }
      // verbatim speech bubbles are verified too (bubbles can be the primary text)
      for (const b of t.bubbles || []) {
        if (!b.verbatim) continue;
        const m = quoteMatch(sourceNorm, b.text);
        quotes.push({ panel: p.n, tier, ok: m.ok, missing: m.missing, quote: b.text });
      }
    }
  }
  const quotesOk = quotes.every((q) => q.ok);

  // Coverage: panels ordered, contiguous beat ranges spanning the declared span.
  const span = script.adaptation.source_span || [0, totalChars];
  const sorted = [...script.panels].sort((a, b) => a.beat_offset[0] - b.beat_offset[0]);
  let gaps = 0, overlaps = 0, prevEnd = span[0];
  for (const p of sorted) {
    const [a, b] = p.beat_offset;
    if (a > prevEnd + 1) gaps++;
    if (a < prevEnd - 1) overlaps++;
    prevEnd = Math.max(prevEnd, b);
  }
  const spanCovered = prevEnd >= span[1] - 1 && sorted[0].beat_offset[0] <= span[0] + 1;
  const coverage = { span, gaps, overlaps, spanCovered };

  // Panel-count band vs declared count.
  const band = {
    declared: script.adaptation.panel_count,
    actual: script.panels.length,
    ok: script.adaptation.panel_count === script.panels.length,
  };

  // default tier present on every panel
  const missingTier = script.panels.filter((p) => !p.text || !p.text[defTier]).map((p) => p.n);

  const ok = quotesOk && band.ok && missingTier.length === 0;
  return { ok, quotesOk, quotes, coverage, band, missingTier, defTier };
}

/* ---------- Phase C: prompt composition ---------- */

// the fixed house style — appended to every panel so style stays locked
export const STYLE = "clean thin black ink line cartoon, strictly monochrome black and white, no colour, grayscale ink and light hatching only, simple wobbly hand-drawn illustrated-science-comic style, big-nose caricatures with expressive googly eyes, lots of white space";

// learned QC lessons (playbook.json). global constraints are injected into EVERY
// prompt (prevention); by_tag constraints target specific defects during repair.
let _playbook = null;
export function getPlaybook() {
  if (_playbook) return _playbook;
  const p = path.join(import.meta.dirname, "playbook.json");
  try { _playbook = JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { _playbook = { global: [], by_tag: {} }; }
  return _playbook;
}

export function buildImagePrompt(panel, cast, style) {
  // FLUX prompt-craft: subject-first (position = weight), natural language, the
  // fixed style clause pinned at the END, and POSITIVE phrasing only (FLUX is
  // guidance-distilled at CFG=1, so negative prompts like "no X" are ignored —
  // always state the positive opposite instead).
  const byId = Object.fromEntries(cast.map((c) => [c.id, c]));
  const chars = (panel.characters || []).map((id) => byId[id]).filter(Boolean);
  const present = chars.map((c) => `${c.name.toUpperCase()} (${c.canonical}, ${c.anchor})`);
  const parts = [];
  if (present.length) {
    parts.push(`Characters: ${present.join("; ")}.`);
    // character-lightweighting: simple iconic designs reproduce far more
    // consistently on prompt-only models (and use fewer lines → smaller files)
    parts.push("Draw every character simple and iconic: flat shapes, few clean lines, the exact same signature features in every panel, easy to redraw identically.");
    // spatial binding reduces multi-character attribute bleed
    if (chars.length === 2) parts.push(`Place ${chars[0].name} on the left and ${chars[1].name} on the right, clearly apart.`);
  }
  parts.push(`Scene: ${panel.scene}.`);
  parts.push(`Composition: ${panel.composition}.`);
  // Text lives in its own zone ABOVE the art (not overlaid), so the art can fill
  // the whole frame with the subject prominent — just keep it inside the edges.
  parts.push("Fill the frame with the scene, the main subject prominent and fully inside the edges, not cropped.");
  if ((panel.characters || []).length >= 3)
    parts.push("Show the characters small and spread far apart in a wide shot so each stays a distinct full figure.");
  // proactively apply learned global lessons to prevent known defects
  for (const g of getPlaybook().global || []) parts.push(g);
  // fixed house style clause, pinned at the END for cross-image style consistency
  parts.push(`Style: ${style}.`);
  return parts.join(" ");
}

/* ---------- GATE-2.5: repair-prompt refinement ---------- */
// Given a panel that failed QC (with issue tags), build a stricter prompt that
// targets the specific defects while keeping the character anchors/style locked.
export const ISSUE_TAGS = ["extra_figures", "scene_mismatch", "identity_drift", "capzone_blocked", "style_drift", "cropped_figure"];

export function refinePrompt(panel, cast, style, tags = [], hint = "", attempt = 1) {
  const base = buildImagePrompt(panel, cast, style);
  const byId = Object.fromEntries(cast.map((c) => [c.id, c]));
  const n = Number.isInteger(panel.figure_count) ? panel.figure_count : (panel.characters || []).length;
  const crowd = /crowd|peasants|villagers|dancing|montage|mob/i.test(panel.scene || "");
  const extra = [];
  // apply learned per-tag fixes from the playbook first
  const pb = getPlaybook().by_tag || {};
  for (const t of tags) if (pb[t]) extra.push(pb[t]);
  // POSITIVE phrasing only — FLUX ignores negatives ("no X"); state the opposite.
  if (tags.includes("cropped_figure"))
    extra.push("Draw each character as a complete full body, from head to feet, standing whole on the ground.");
  if (!crowd && (tags.includes("extra_figures") || tags.includes("scene_mismatch")))
    extra.push(`Show exactly ${n} character${n === 1 ? "" : "s"}; the frame contains only ${n === 1 ? "this one complete figure" : "these " + n + " complete figures"} and empty background around them.`);
  if (tags.includes("scene_mismatch"))
    extra.push(`The panel clearly shows this exact action: ${panel.scene}.`);
  if (tags.includes("identity_drift"))
    for (const id of panel.characters || []) {
      const c = byId[id];
      if (c) extra.push(`${c.name} looks identical to their established design: ${c.canonical}, with ${c.anchor}.`);
    }
  if (tags.includes("capzone_blocked"))
    extra.push(`Keep the ${(panel.cap_zone || "top")} area a plain empty background.`);
  if (tags.includes("style_drift"))
    extra.push("Keep a clean thin black-and-white cartoon line style, light and tidy.");
  if (hint) extra.push(hint);
  if (attempt >= 2) extra.push("Use a simpler, clearer composition than the previous attempt.");
  return `${base} REPAIR CONSTRAINTS: ${extra.join(" ")}`;
}

/* ---------- Phase C + GATE-2: image generation ---------- */

// downscale a big JPEG buffer to the small display size + compress (light file)
async function downscaleJpeg(buf, width, height, quality) {
  const { Jimp } = await import("jimp");
  const img = await Jimp.read(buf);
  img.resize({ w: width, h: height });
  return img.getBuffer("image/jpeg", { quality });
}

export async function genImage(prompt, { seed, width = 640, height = 460, outPath, tries = 4, minBytes = 4000, token = "", genMP = 1, quality = 62 }) {
  // FLUX loses coherence at tiny sizes, so GENERATE near ~1 megapixel (same aspect
  // ratio) for correct anatomy/composition, then DOWNSCALE to the small display
  // size — best of both: FLUX quality + a light file.
  const ar = width / height;
  let gw = Math.round(Math.sqrt(genMP * 1e6 * ar)); gw -= gw % 16;
  let gh = Math.round(Math.sqrt(genMP * 1e6 / ar)); gh -= gh % 16;
  gw = Math.max(gw, 512); gh = Math.max(gh, 512);
  let url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${gw}&height=${gh}&seed=${seed}&model=flux&nologo=true`;
  // authenticated (Seed+) requests: faster cadence + no watermark
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    url += `&token=${encodeURIComponent(token)}`;
  }
  for (let a = 0; a < tries; a++) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(90000) });
      if (r.ok) {
        const b = Buffer.from(await r.arrayBuffer());
        if (b.length >= minBytes) {
          fs.mkdirSync(path.dirname(outPath), { recursive: true });
          let out = b;
          try { out = await downscaleJpeg(b, width, height, quality); }
          catch { /* jimp unavailable → keep raw (still valid, just larger) */ }
          fs.writeFileSync(outPath, out);
          return { ok: true, bytes: out.length, genSize: `${gw}x${gh}` };
        }
      }
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 1800));
  }
  return { ok: false, bytes: 0 };
}

export function gate2(outPath, minBytes = 4000) {
  if (!fs.existsSync(outPath)) return { ok: false, reason: "missing" };
  const bytes = fs.statSync(outPath).size;
  if (bytes < minBytes) return { ok: false, reason: "too-small", bytes };
  return { ok: true, bytes };
}

/* ---------- Phase D/E: Gonick-style HTML assembly ---------- */

// Gonick-style panel (IMG_1175 layout): a caption BAND sits at the TOP of the
// panel (its own paper region) and the artwork sits BELOW it — text and art never
// overlap, so captions can never cover a character (comic best practice: give text
// its own space, don't obstruct the art). Only short speech bubbles overlay the art
// in a corner for dialogue.
const CSS = `
:root{--paper:#f6efdd;--ink:#141210;--frame:#141210;--quote:#fff6d9;--stage:#d8c9a8;--artbg:#efe8d5}
@media(prefers-color-scheme:dark){:root{--stage:#20242b}}
:root[data-theme="light"]{--stage:#d8c9a8}:root[data-theme="dark"]{--stage:#20242b}
*{box-sizing:border-box}
body{margin:0;background:var(--stage);color:var(--ink);
 font-family:"Comic Sans MS","Comic Neue","Chalkboard SE",ui-rounded,system-ui,sans-serif;-webkit-text-size-adjust:100%}
.book{max-width:940px;margin:0 auto;padding:18px 12px 60px}
header.cover{background:var(--paper);border:4px solid var(--frame);border-radius:4px;padding:22px 20px;margin-bottom:16px;box-shadow:6px 6px 0 rgba(0,0,0,.25)}
.kick{font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.7}
h1{font-size:clamp(24px,6vw,42px);line-height:1.02;margin:.15em 0 .1em;text-transform:uppercase;text-wrap:balance;letter-spacing:.5px;-webkit-text-stroke:.4px var(--ink)}
.byline{font-size:14px;margin-top:6px;border-top:2px solid var(--frame);padding-top:8px}
.byline b{font-weight:800}
.pages{display:grid;grid-template-columns:1fr 1fr;gap:13px;align-items:start}
.panel{display:flex;flex-direction:column;grid-column:span 1;background:var(--paper);
 border:3px solid var(--frame);border-radius:3px;overflow:hidden;box-shadow:4px 4px 0 rgba(0,0,0,.22)}
.panel.wide{grid-column:span 2}
/* ONE unified text system: a zone of comic bubbles/boxes ABOVE the art (never over it) */
.stack{display:flex;flex-direction:column;gap:6px;padding:9px 10px 11px;background:var(--artbg);border-bottom:3px solid var(--frame)}
.art{position:relative;width:100%;aspect-ratio:4/3;background:var(--artbg);overflow:hidden}
.panel.wide .art{aspect-ratio:2/1}
.art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:contrast(1.05) grayscale(1);mix-blend-mode:multiply}
.tb{position:relative;max-width:86%;background:#fff;color:#111;border:2.5px solid #111;border-radius:44% 46% 45% 47%/50% 52% 48% 50%;
 padding:6px 10px;font-size:11px;line-height:1.18;text-transform:uppercase;letter-spacing:.2px;box-shadow:1.5px 1.5px 0 rgba(0,0,0,.22)}
.tb.right{align-self:flex-end}.tb.left{align-self:flex-start}
.tb .who{display:block;font-size:8px;font-weight:800;opacity:.55;margin-bottom:1px}
.tb .qby2{display:block;text-align:right;font-size:8.5px;font-weight:bold;opacity:.55;margin-top:2px}
/* SPEECH gets a little tail toward the scene below */
.tb.speech::after{content:"";position:absolute;width:12px;height:12px;background:#fff;border-right:2.5px solid #111;border-bottom:2.5px solid #111;bottom:-7px;left:18px;transform:rotate(45deg)}
.tb.right.speech::after{left:auto;right:18px}
/* CAPTION — rectangular narrator box (paper) */
.tb.caption{background:var(--paper);border-radius:2px;max-width:96%}
/* SHOUT — spiky burst */
.tb.shout{border:none;border-radius:0;font-weight:800;text-align:center;background:#fff;
 clip-path:polygon(0% 22%,12% 12%,10% 0%,26% 10%,38% 0,50% 11%,62% 0,74% 10%,90% 0,88% 12%,100% 22%,90% 38%,100% 52%,88% 66%,100% 80%,84% 84%,74% 100%,60% 86%,50% 98%,40% 86%,26% 100%,16% 84%,0% 80%,12% 66%,0% 52%,10% 38%);
 filter:drop-shadow(1.5px 0 0 #111) drop-shadow(-1.5px 0 0 #111) drop-shadow(0 1.5px 0 #111) drop-shadow(0 -1.5px 0 #111);padding:11px 14px}
/* THOUGHT — cloud */
.tb.thought{border-radius:50%/42%}
.tb.thought::after{content:"";position:absolute;width:8px;height:8px;background:#fff;border:2.5px solid #111;border-radius:50%;bottom:-6px;left:20px;box-shadow:-9px 7px 0 -2px #fff,-9px 7px 0 0 #111}
/* WHISPER — dashed, quiet */
.tb.whisper{border-style:dashed;font-style:italic;opacity:.92}
/* QUOTE — verbatim source line, yellow */
.tb.quote{background:var(--quote);border-radius:2px;max-width:96%;border-left-width:6px}
.label{position:absolute;background:var(--paper);border:2px solid var(--ink);font-size:10px;font-weight:bold;
 text-transform:uppercase;letter-spacing:.5px;padding:1px 5px;border-radius:1px;box-shadow:1px 1px 0 rgba(0,0,0,.25)}
.label.bl{bottom:8px;left:8px}.label.br{bottom:8px;right:8px}
.label{position:absolute;background:var(--paper);border:2px solid var(--ink);font-size:10px;font-weight:bold;
 text-transform:uppercase;letter-spacing:.5px;padding:1px 5px;border-radius:1px;box-shadow:1px 1px 0 rgba(0,0,0,.25)}
.label.bl{bottom:8px;left:8px}.label.br{bottom:8px;right:8px}
.foot{margin-top:20px;background:var(--paper);border:3px solid var(--frame);border-radius:3px;padding:14px 16px;font-size:13px;line-height:1.5;box-shadow:4px 4px 0 rgba(0,0,0,.2)}
.foot .tag{display:inline-block;background:transparent;color:var(--ink);border:1.5px solid var(--ink);font-weight:700;font-size:11px;padding:1px 6px;margin-right:6px;text-transform:uppercase}
@media(max-width:640px){.pages{grid-template-columns:1fr}.panel.wide{grid-column:span 1}.panel.wide .art{aspect-ratio:4/3}}
`;

function imgDataUri(dir, n) {
  const p = path.join(dir, `${String(n).padStart(2, "0")}.jpg`);
  return "data:image/jpeg;base64," + fs.readFileSync(p).toString("base64");
}

function panelHTML(p, tier, defTier, dir) {
  const t = (p.text && (p.text[tier] || p.text[defTier])) || {};
  // ONE unified text system: narration, verbatim quotes and dialogue are ALL comic
  // bubbles/boxes, stacked over the empty upper area of the art (no separate band).
  const sideOf = (pos) => (pos === "tr" || pos === "br") ? "right" : "left";
  const items = [];
  if (t.narration) items.push(`<div class="tb caption left">${t.narration}</div>`);
  if (t.quote) items.push(`<div class="tb quote left">&ldquo;${t.quote}&rdquo;<span class="qby2">&mdash; ${t.quote_by || "SOURCE"}</span></div>`);
  for (const b of t.bubbles || []) {
    const kind = b.kind || "speech";
    const side = kind === "caption" || kind === "quote" ? "left" : sideOf(b.pos);
    const who = b.speaker && kind !== "caption" ? `<span class="who">${String(b.speaker).toUpperCase()}</span>` : "";
    const by = b.verbatim && b.by ? `<span class="qby2">&mdash; ${b.by}</span>` : "";
    items.push(`<div class="tb ${kind} ${side}">${who}${b.text}${by}</div>`);
  }
  const labels = (t.labels || [])
    .map((l) => `<div class="label ${l.pos === "br" ? "br" : "bl"}">${l.text}</div>`)
    .join("");
  return `<figure class="panel${p.wide ? " wide" : ""}">
  <div class="stack">${items.join("")}</div>
  <div class="art"><img src="${imgDataUri(dir, p.n)}" alt="">${labels}</div>
</figure>`;
}

export function assembleHTML(script, { tier, imagesDir }) {
  const defTier = script.adaptation.default_tier;
  const useTier = tier || defTier;
  const panels = [...script.panels]
    .sort((a, b) => a.n - b.n)
    .map((p) => panelHTML(p, useTier, defTier, imagesDir))
    .join("\n");
  const a = script.adaptation;
  const b = script.book;
  return `<title>${b.title} — a Cartoon (${useTier})</title>
<style>${CSS}</style>
<div class="book">
 <header class="cover">
  <div class="kick">Vocaflow Cartoon Reader &middot; Tier: ${useTier} &middot; Style: ${a.style}${a.target_v_level ? " &middot; V" + a.target_v_level : ""}</div>
  <h1>${b.title}</h1>
  <div class="byline">Adapted from <b>${b.author}</b> &middot; verbatim source quotes shown in the yellow boxes</div>
 </header>
 <div class="pages">
${panels}
 </div>
 <div class="foot">
  <span class="tag">Narration</span> plain-english play-by-play &middot;
  <span class="tag">Yellow</span> the author&rsquo;s exact words &middot;
  <span class="tag">Bubbles</span> the characters talk.
 </div>
</div>`;
}

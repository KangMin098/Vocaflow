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

// Art style is matched to the BOOK'S DIFFICULTY so characters read at the right
// maturity: a cute big-eyed cartoon suits an easy children's book but looks too
// juvenile for a hard adult classic like Frankenstein. Three tiers, chosen from the
// adaptation's V-level (or an explicit adaptation.art_maturity override).
export const STYLES = {
  young: "cute simple hand-drawn cartoon, chibi child-friendly proportions, big round expressive eyes, thick clean black lines, whimsical, strictly monochrome black and white, no colour",
  teen: "clean hand-drawn black-and-white cartoon, balanced proportions, expressive but natural-sized eyes, light ink and a little hatching, strictly monochrome, no colour",
  mature: "mature graphic-novel black-and-white ink illustration, realistic adult human proportions and faces, restrained expressive features with natural eyes (NOT big cartoon eyes), fine cross-hatching for shadow, a serious literary gothic tone, strictly monochrome, no colour",
};
export function styleFor(vLevel, override) {
  if (override && STYLES[override]) return STYLES[override];
  const v = Number(vLevel) || 7;
  return v >= 9 ? STYLES.mature : v >= 5 ? STYLES.teen : STYLES.young;
}
// backward-compatible default
export const STYLE = STYLES.teen;

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

// Which corners/edges of the panel hold text (so the art can reserve them as empty).
// narration + verbatim quote default to the top-left caption slot; bubbles use their pos.
export function textZones(panel) {
  const set = new Set();
  for (const tv of Object.values(panel.text || {})) {
    if (!tv || typeof tv !== "object") continue;
    if (tv.narration) set.add("tl");
    if (tv.quote) set.add("tl");
    for (const b of tv.bubbles || []) set.add(b.pos && ["tl", "tr", "bl", "br", "tc"].includes(b.pos) ? b.pos : "tr");
  }
  return [...set];
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
  parts.push("Fill the frame with the scene, the main subject prominent and fully inside the edges, not cropped.");
  // Gonick-style FREE text overlay: speech balloons & caption boxes sit OVER the art
  // in its empty areas. So the art must RESERVE those zones as open background and keep
  // the subject (and its face) out of them — this is how the text never covers a figure.
  const zones = textZones(panel);
  if (zones.length) {
    // Reliable on FLUX: a single subject standing in the CENTER leaves the four corners
    // as open background — exactly where the Gonick caption boxes/balloons overlay.
    parts.push("Frame the single subject in the centre so all four corners stay as open, uncluttered background (sky, wall, or floor) — clear room for comic caption boxes and speech balloons to sit in the corners without covering the figure or its face.");
  }
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

// Gonick-style FREE text composition (ref: Cartoon History pages): speech balloons
// and caption boxes are placed OVER the art, in its empty corners/edges, at varied
// positions and sizes — dynamic like the reference. The art is generated with those
// zones reserved as open background (see buildImagePrompt), so text never covers the
// subject. Each text item is absolutely positioned by its `pos` (tl/tr/bl/br/tc).
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
/* CAPTION BAND (Gonick top caption boxes) — narration & source quotes live here, in
 their OWN reserved paper strip above the art, so they NEVER cover a character. */
.capband{background:var(--artbg);border-bottom:3px solid var(--frame);padding:7px 8px;display:flex;flex-wrap:wrap;gap:5px}
.capband:empty{display:none}
.capband .tb{position:static;max-width:100%;flex:1 1 46%}
/* the art sits below; only short dialogue balloons float over it, in the clear corners */
.art{position:relative;width:100%;aspect-ratio:4/3;background:var(--artbg);overflow:hidden}
.panel.wide .art{aspect-ratio:2/1}
.art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:contrast(1.05) grayscale(1)}
.tb{background:#fff;color:#111;border:2.5px solid #111;border-radius:46% 47% 45% 48%/52% 50% 50% 48%;
 padding:5px 9px;font-size:10.5px;line-height:1.16;text-transform:uppercase;letter-spacing:.2px;box-shadow:1.5px 1.5px 0 rgba(0,0,0,.28)}
.art .tb{position:absolute;max-width:44%;z-index:2}
.art .tb.at-tl{top:5px;left:5px}.art .tb.at-tr{top:5px;right:5px}.art .tb.at-bl{bottom:5px;left:5px}.art .tb.at-br{bottom:5px;right:5px}
.art .tb.at-tc{top:5px;left:50%;transform:translateX(-50%);max-width:56%}
.tb .who{display:block;font-size:8px;font-weight:800;opacity:.6;margin-bottom:1px}
.tb .qby2{display:block;text-align:right;font-size:8px;font-weight:bold;opacity:.55;margin-top:1px}
/* SPEECH — tail toward the subject (down) */
.tb.speech::after{content:"";position:absolute;width:11px;height:11px;background:#fff;border-right:2.5px solid #111;border-bottom:2.5px solid #111;bottom:-6px;left:16px;transform:rotate(45deg)}
.tb.speech.at-tr::after,.tb.speech.at-br::after{left:auto;right:16px}
.tb.speech.at-bl::after,.tb.speech.at-br::after{bottom:auto;top:-6px;transform:rotate(225deg)}
/* CAPTION — rectangular narrator box (paper) */
.tb.caption{background:var(--paper);border-radius:2px;border-width:2px}
/* SHOUT — spiky burst */
.tb.shout{border:none;border-radius:0;font-weight:800;text-align:center;background:#fff;
 clip-path:polygon(0% 22%,12% 12%,10% 0%,26% 10%,38% 0,50% 11%,62% 0,74% 10%,90% 0,88% 12%,100% 22%,90% 38%,100% 52%,88% 66%,100% 80%,84% 84%,74% 100%,60% 86%,50% 98%,40% 86%,26% 100%,16% 84%,0% 80%,12% 66%,0% 52%,10% 38%);
 filter:drop-shadow(1.5px 0 0 #111) drop-shadow(-1.5px 0 0 #111) drop-shadow(0 1.5px 0 #111) drop-shadow(0 -1.5px 0 #111);padding:10px 13px}
/* THOUGHT — cloud */
.tb.thought{border-radius:50%/44%}
.tb.thought::after{content:"";position:absolute;width:8px;height:8px;background:#fff;border:2.5px solid #111;border-radius:50%;bottom:-6px;left:18px;box-shadow:-9px 7px 0 -2px #fff,-9px 7px 0 0 #111}
/* WHISPER — dashed, quiet */
.tb.whisper{border-style:dashed;font-style:italic}
/* QUOTE — verbatim source line, yellow */
.tb.quote{background:var(--quote);border-radius:2px;border-left-width:6px}
.label{position:absolute;background:var(--paper);border:2px solid var(--ink);font-size:10px;font-weight:bold;z-index:2;
 text-transform:uppercase;letter-spacing:.5px;padding:1px 5px;border-radius:1px;box-shadow:1px 1px 0 rgba(0,0,0,.25)}
.label.bl{bottom:8px;left:8px}.label.br{bottom:8px;right:8px}
.foot{margin-top:20px;background:var(--paper);border:3px solid var(--frame);border-radius:3px;padding:14px 16px;font-size:13px;line-height:1.5;box-shadow:4px 4px 0 rgba(0,0,0,.2)}
.foot .tag{display:inline-block;background:transparent;color:var(--ink);border:1.5px solid var(--ink);font-weight:700;font-size:11px;padding:1px 6px;margin-right:6px;text-transform:uppercase}
@media(max-width:640px){.pages{grid-template-columns:1fr}.panel.wide{grid-column:span 1}.panel.wide .art{aspect-ratio:4/3}.tb{font-size:11px}}
`;

function imgDataUri(dir, n) {
  const p = path.join(dir, `${String(n).padStart(2, "0")}.jpg`);
  return "data:image/jpeg;base64," + fs.readFileSync(p).toString("base64");
}

function panelHTML(p, tier, defTier, dir) {
  const t = (p.text && (p.text[tier] || p.text[defTier])) || {};
  // OCCLUSION-SAFE Gonick layout: narration + verbatim captions go in a reserved
  // caption BAND above the art (never over a character); only short dialogue balloons
  // (speech/thought/shout/whisper) float over the art's clear corners.
  const POS = new Set(["tl", "tr", "bl", "br", "tc"]);
  const at = (pos, def) => `at-${POS.has(pos) ? pos : def}`;
  // ALL text lives in the reserved caption band above the art → ZERO occlusion,
  // guaranteed by construction (verified by verify-occlusion.mjs). Dialogue keeps its
  // speech/thought/shout styling and a speaker label, but sits in the band, never over
  // a character. (Floating balloons over art need controlled art — a paid-tier upgrade.)
  const band = [];
  const floatB = [];
  void at;
  if (t.narration) band.push(`<div class="tb caption">${t.narration}</div>`);
  if (t.quote) band.push(`<div class="tb quote">&ldquo;${t.quote}&rdquo;<span class="qby2">&mdash; ${t.quote_by || "SOURCE"}</span></div>`);
  for (const b of t.bubbles || []) {
    const kind = b.kind || "speech";
    const who = b.speaker && kind !== "caption" ? `<span class="who">${String(b.speaker).toUpperCase()}</span>` : "";
    const by = b.verbatim && b.by ? `<span class="qby2">&mdash; ${b.by}</span>` : "";
    band.push(`<div class="tb ${kind}">${who}${b.text}${by}</div>`);
  }
  const labels = (t.labels || [])
    .map((l) => `<div class="label ${l.pos === "br" ? "br" : "bl"}">${l.text}</div>`)
    .join("");
  return `<figure class="panel${p.wide ? " wide" : ""}">
  <div class="capband">${band.join("")}</div>
  <div class="art"><img src="${imgDataUri(dir, p.n)}" alt="">${floatB.join("")}${labels}</div>
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

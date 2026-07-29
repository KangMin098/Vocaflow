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
      if (!t.quote) continue;
      const m = quoteMatch(sourceNorm, t.quote);
      quotes.push({ panel: p.n, tier, ok: m.ok, missing: m.missing, quote: t.quote });
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

export function buildImagePrompt(panel, cast, style) {
  const byId = Object.fromEntries(cast.map((c) => [c.id, c]));
  const present = (panel.characters || [])
    .map((id) => byId[id])
    .filter(Boolean)
    .map((c) => `${c.name.toUpperCase()} (${c.canonical}, ${c.anchor})`);
  const parts = [style];
  if (present.length) parts.push(`Characters: ${present.join("; ")}.`);
  parts.push(`Scene: ${panel.scene}.`);
  parts.push(`Composition: ${panel.composition}.`);
  if ((panel.characters || []).length >= 3)
    parts.push("Keep characters small and spaced apart to preserve their identities (no face close-ups).");
  return parts.join(" ");
}

/* ---------- Phase C + GATE-2: image generation ---------- */

export async function genImage(prompt, { seed, width = 640, height = 460, outPath, tries = 4, minBytes = 4000 }) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&model=flux&nologo=true`;
  for (let a = 0; a < tries; a++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(75000) });
      if (r.ok) {
        const b = Buffer.from(await r.arrayBuffer());
        if (b.length >= minBytes) {
          fs.mkdirSync(path.dirname(outPath), { recursive: true });
          fs.writeFileSync(outPath, b);
          return { ok: true, bytes: b.length };
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

// Split-panel layout: art region on top (never covered by narration) + a
// dedicated caption zone below inside the same panel border. Only short speech
// bubbles sit over the art, kept in corners over the empty/white areas.
const CSS = `
:root{--paper:#f3ead6;--ink:#1a1712;--frame:#141210;--quote:#fff7e0;--stage:#d8c9a8;--artbg:#e9e1cd}
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
.byline b{background:var(--ink);color:var(--paper);padding:0 5px}
.pages{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.panel{display:flex;flex-direction:column;grid-column:span 1;margin:0;background:var(--paper);
 border:3px solid var(--frame);border-radius:3px;overflow:hidden;box-shadow:4px 4px 0 rgba(0,0,0,.22)}
.panel.wide{grid-column:span 2}
.art{position:relative;width:100%;aspect-ratio:4/3;overflow:hidden;background:var(--artbg);border-bottom:3px solid var(--frame)}
.panel.wide .art{aspect-ratio:16/6}
.art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:contrast(1.05) grayscale(1);mix-blend-mode:multiply}
.cap{padding:9px 11px 10px}
.nar{font-size:13px;line-height:1.34;text-transform:uppercase;letter-spacing:.2px}
.nar b{background:var(--ink);color:var(--paper);padding:0 3px;border-radius:1px}
.quote{margin-top:8px;background:var(--quote);border:2px solid var(--ink);border-left-width:6px;border-radius:2px;
 padding:7px 9px;font-size:12.5px;line-height:1.32;letter-spacing:.2px;box-shadow:2px 2px 0 rgba(0,0,0,.22)}
.qby{display:block;text-align:right;font-size:10px;font-weight:bold;margin-top:3px;opacity:.7;text-transform:uppercase}
.bub{position:absolute;background:#fff;color:#111;border:2.5px solid #111;border-radius:44% 46% 45% 47%/50% 52% 48% 50%;
 padding:5px 8px;font-size:11px;line-height:1.14;text-transform:uppercase;max-width:46%;box-shadow:1.5px 1.5px 0 rgba(0,0,0,.25)}
.bub .tail{position:absolute;width:13px;height:13px;background:#fff;border-right:2.5px solid #111;border-bottom:2.5px solid #111;transform:rotate(45deg)}
.bub.tr{top:7px;right:7px}.bub.tr .tail{left:15px;bottom:-7px}
.bub.br{bottom:7px;right:7px}.bub.br .tail{left:15px;top:-7px;transform:rotate(225deg)}
.bub.tl{top:7px;left:7px}.bub.tl .tail{right:15px;bottom:-7px}
.bub.bl{bottom:7px;left:7px}.bub.bl .tail{right:15px;top:-7px;transform:rotate(225deg)}
.label{position:absolute;background:var(--paper);border:2px solid var(--ink);font-size:10px;font-weight:bold;
 text-transform:uppercase;letter-spacing:.5px;padding:1px 5px;border-radius:1px;box-shadow:1px 1px 0 rgba(0,0,0,.25)}
.label.bl{bottom:8px;left:8px}.label.br{bottom:8px;right:8px}.label.tl{top:8px;left:8px}.label.tr{top:8px;right:8px}
.foot{margin-top:20px;background:var(--paper);border:3px solid var(--frame);border-radius:3px;padding:14px 16px;font-size:13px;line-height:1.5;box-shadow:4px 4px 0 rgba(0,0,0,.2)}
.foot .tag{display:inline-block;background:var(--ink);color:var(--paper);font-size:11px;padding:1px 6px;margin-right:6px;text-transform:uppercase}
@media(max-width:640px){.pages{grid-template-columns:1fr}.panel,.panel.wide{grid-column:span 1}.panel.wide .art{aspect-ratio:4/3}}
`;

function imgDataUri(dir, n) {
  const p = path.join(dir, `${String(n).padStart(2, "0")}.jpg`);
  return "data:image/jpeg;base64," + fs.readFileSync(p).toString("base64");
}

function panelHTML(p, tier, defTier, dir) {
  const t = (p.text && (p.text[tier] || p.text[defTier])) || {};
  const bubs = (t.bubbles || [])
    .map((b) => `<div class="bub ${b.pos}">${b.text}<span class="tail"></span></div>`)
    .join("");
  const labels = (t.labels || [])
    .map((l) => `<div class="label ${l.pos || "bl"}">${l.text}</div>`)
    .join("");
  const quote = t.quote
    ? `<div class="quote">&ldquo;${t.quote}&rdquo;<span class="qby">&mdash; ${t.quote_by || "SOURCE"}</span></div>`
    : "";
  const nar = t.narration ? `<div class="nar">${t.narration}</div>` : "";
  return `<figure class="panel${p.wide ? " wide" : ""}">
  <div class="art"><img src="${imgDataUri(dir, p.n)}" alt="">${bubs}${labels}</div>
  <div class="cap">${nar}${quote}</div>
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

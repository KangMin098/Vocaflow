// scripts/comic/schema.mjs
// Comic-adaptation script schema + structural validator.
// The script JSON is the single source of truth for the whole pipeline
// (image generation, lettering, age tiers, validation all read from it).

export const AGE_TIERS = ["child", "teen", "adult"];
export const BUBBLE_POS = ["tl", "tr", "bl", "br"];

/**
 * Shape (informational — validateStructure enforces the required parts):
 *
 * {
 *   book:       { id, title, author, source:"gutenberg"|"file", ref, total_words },
 *   adaptation: { style, panel_count, default_tier, tiers:[...], target_v_level,
 *                 source_span:[startChar,endChar], art_shared_across_tiers:bool },
 *   cast:  [ { id, name, role, canonical, anchor, seed_role } ],
 *   panels:[ {
 *     n, wide,
 *     beat_offset:[a,b],           // char range in source (coverage/contiguity)
 *     scene,                       // visual description for image gen
 *     composition,                 // wide|medium|close; multi-char -> distance
 *     characters:[castId,...],
 *     text: { <tier>: { narration, bubbles:[{speaker,text,pos}],
 *                       quote|null, labels:[{text,pos}] } }
 *   } ]
 * }
 */

export function validateStructure(s) {
  const errors = [];
  const req = (cond, msg) => { if (!cond) errors.push(msg); };

  req(s && typeof s === "object", "script must be an object");
  if (!s || typeof s !== "object") return { ok: false, errors };

  req(s.book && s.book.title, "book.title missing");
  req(s.book && (s.book.source === "gutenberg" || s.book.source === "file"),
    "book.source must be 'gutenberg' or 'file'");
  req(s.book && s.book.ref, "book.ref missing (gutenberg id or file path)");

  req(s.adaptation && s.adaptation.style, "adaptation.style missing");
  const defTier = s.adaptation && s.adaptation.default_tier;
  req(AGE_TIERS.includes(defTier), `adaptation.default_tier must be one of ${AGE_TIERS}`);

  req(Array.isArray(s.cast), "cast must be an array");
  const castIds = new Set((s.cast || []).map((c) => c.id));
  (s.cast || []).forEach((c, i) => {
    req(c.id, `cast[${i}].id missing`);
    req(c.canonical, `cast[${i}].canonical (visual description) missing`);
    req(Number.isInteger(c.seed_role), `cast[${i}].seed_role must be an integer`);
  });

  req(Array.isArray(s.panels) && s.panels.length > 0, "panels must be a non-empty array");
  (s.panels || []).forEach((p, i) => {
    req(Number.isInteger(p.n), `panels[${i}].n must be an integer`);
    req(p.scene, `panels[${i}].scene missing`);
    req(p.composition, `panels[${i}].composition missing`);
    req(Array.isArray(p.beat_offset) && p.beat_offset.length === 2,
      `panels[${i}].beat_offset must be [start,end]`);
    (p.characters || []).forEach((cid) =>
      req(castIds.has(cid), `panels[${i}] references unknown character '${cid}'`));
    req(p.text && typeof p.text === "object", `panels[${i}].text missing`);
    if (p.text && defTier && !p.text[defTier])
      errors.push(`panels[${i}].text missing default tier '${defTier}'`);
    Object.entries(p.text || {}).forEach(([tier, t]) => {
      req(AGE_TIERS.includes(tier), `panels[${i}].text has invalid tier '${tier}'`);
      (t.bubbles || []).forEach((b, j) => {
        req(typeof b.text === "string", `panels[${i}].text.${tier}.bubbles[${j}].text missing`);
        req(BUBBLE_POS.includes(b.pos), `panels[${i}].text.${tier}.bubbles[${j}].pos invalid`);
      });
    });
  });

  return { ok: errors.length === 0, errors };
}

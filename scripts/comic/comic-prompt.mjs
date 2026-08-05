// scripts/comic/comic-prompt.mjs
// Backend-neutral prompt construction shared by every comic image adapter (gen-qwen,
// gen-comfy, gen-nanobanana, gen-openai). SINGLE SOURCE OF TRUTH for the Vision-QC-tuned
// house-style clauses, the display-size tiers, the close-up→t2i routing, and the ref/panel
// prompt text — so all backends draw the same flat-ink Gonick style with the same fixes.
//
// Pure module: no argv, no fs. Adapters pass their own flags in and format sizes for their
// API (Qwen wants "W*H" strings; ComfyUI wants integer width/height).

// Vision-QC-tuned clauses (Carol Stave1 defects → fixes):
// INK = bold Gonick ink w/ SOLID BLACK fills · HARDBW = force B&W, ignore colour words ·
// BLANK = no writing on papers/signs · NOTEXT = no lettering · NEG = negatives Qwen honours.
export const INK = "Bold flat black-and-white hand-inked cartoon in the style of a Larry Gonick history comic: thick confident black ink outlines with SOLID BLACK ink fills and strong high contrast, simple flat shapes, light cross-hatching for shade, caricatured expressive faces. Strictly black, white and grey ink only — NO colour. Not thin uniform coloring-book outlines, not photorealistic, not 3D.";
export const HARDBW = "Render the ENTIRE image in black and white ink ONLY — no colour anywhere. Ignore any colour words in the description (blue, red, white, brown, ruddy, etc.); depict those things only as black, white and grey ink.";
export const BLANK = "Any papers, books, ledgers, letters or signs must be completely BLANK with no writing or lettering on them.";
export const NOTEXT = "A single clean illustration with no text, no words, no letters, no readable signs, no speech bubbles, no caption boxes, no panel borders.";
// NEG is actively honoured by SDXL (verified) and ignored by Qwen (harmless there). It holds
// only ALWAYS-unwanted things (never character-specific — e.g. NOT "beard", since some
// characters have one; clean-shaven is set per-character via the canonical description). The
// ornate-frame / decorative-background terms fix an SDXL base-model tendency found in testing.
export const NEG = "colour, coloured, tinted, blue, red, green, brown skin, gradient, soft shading, photorealistic, 3d render, thin uniform outlines, dense cross-hatching, text, words, letters, numbers, writing on paper, scribbled glyphs, signboards, labels, speech bubbles, empty speech balloon, blank speech bubble, caption boxes, panel borders, ornate frame, decorative border, background pattern, floral, checkerboard, transparency grid, isolated on plain white background, sticker, cutout, duplicate character, second face, twin, extra person, bystander, extra heads, multiple views, expression sheet, extra limbs, deformed hands, modern objects, cars";

// Display-size tiers in px (see gen-qwen for the phone-floor rationale): full = 4:3 splash,
// half/third = 3:4, floored so panels stay crisp at phone full-width. Reference sheets use
// the full (landscape) tier.
export const SIZES = { full: { w: 1024, h: 768 }, half: { w: 704, h: 939 }, third: { w: 640, h: 853 } };
export function panelDims(p) {
  const role = p.size && SIZES[p.size] ? p.size : (p.wide ? "full" : "half");
  return { ...SIZES[role], role };
}

// tight FACE close-ups / caricature portraits reliably make a multi-view sheet leak (a 6-up
// head grid). The regex is deliberately TIGHT — a bare "close" shot note is common on
// full-body medium shots, and over-routing to t2i would forfeit the reference identity lock.
const CLOSEUP_RE = /\b(caricature|portrait|head-and-shoulders|bust shot|extreme close|tight close|face fills)\b/i;
export function isCloseup(p) { return CLOSEUP_RE.test(`${p.composition || ""} ${p.scene || ""}`); }
// route to t2i (no reference) when: forced, per-panel noref flag, no ref available, or a
// close-up under auto-routing. t2i gives full compositional freedom + zero sheet-leak.
export function useNoref(p, charCount, { forceNoref = false, autoNoref = true } = {}) {
  return forceNoref || p.noref === true || charCount === 0 || (autoNoref && isCloseup(p));
}

// reference-sheet prompt: ONE figure, multi-view + expressions, flat ink, no text.
export function refPromptText(c) {
  return `${INK} A character model sheet of ONE single figure — the SAME person shown front view, three-quarter view and side view, plus three facial expressions. ${c.name}: ${c.canonical}, ${c.anchor}. Keep the design simple and iconic with the exact same signature features in every view. ${NOTEXT}`;
}

// panel prompt: scene-dominant, identity from ref (or inline description when noref), with
// the HARDBW / BLANK / solo / anti-sheet / scene-meta-strip fixes.
export function panelPromptText(p, chars, { noref }) {
  const refLines = chars.map((c, i) => `${c.name.toUpperCase()} must have exactly the same FACE and body identity as the person in reference image ${i + 1} (same face, nose, baldness, build) — but their clothing, headwear and pose come from the scene description below, NOT from the reference.`);
  const descLines = chars.map((c) => `${c.name.toUpperCase()} is ${c.canonical}, ${c.anchor}.`);
  let placement = "";
  if (chars.length === 2) placement = ` Place ${chars[0].name} on the left and ${chars[1].name} on the right, clearly apart.`;
  else if (chars.length >= 3) placement = " Show each character as a distinct full figure, spread apart.";
  const solo = chars.length === 1
    ? "There is exactly ONE person in the whole image — no other people, no bystanders, and never draw the same face or figure twice."
    : "";
  // strip the legacy FLUX-era style meta-prefix baked into some scene texts.
  const scene = String(p.scene || "").replace(/^drawn as a[^:]*:\s*/i, "");
  return [INK, HARDBW,
    `Draw ONE finished single-scene comic illustration with a full drawn background — do NOT keep a plain white background, and this is NOT a character model sheet or a grid of head studies. Show each character full-figure (head to feet, with arms and hands), not a floating bust. Scene: ${scene}.`,
    `Composition: ${p.composition}.${placement}`,
    (noref ? descLines.join(" ") : refLines.join(" ")),
    noref ? "" : "The reference images define ONLY each character's appearance. Include exactly ONE instance of each character; do NOT copy the reference layout and do NOT reproduce multiple views, extra heads, busts or an expression row.",
    solo,
    "Fill the frame with the scene, the main subject prominent and fully inside the edges, not cropped.",
    BLANK, NOTEXT].filter(Boolean).join(" ");
}

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
// ── R19 레벨 적응형 아트 레지스터 ──
// 도서 레벨(target_v_level 0~11)에 아트 사실감을 맞추되 "약간 상향"(존중·비유아틱). 낮은 레벨=단순
// 카툰, 높은 레벨=사실적 그래픽노블/에칭. 흑백은 유지 — 사실감은 디테일·해칭·정확한 비례에서 오지 색이 아님.
// 저레벨은 halftone/사실주의를 negExtra 로 막고, 고레벨은 오히려 chibi/big-head(유아틱)를 막는다.
export function styleForLevel(vlevel) {
  const L = Number.isFinite(+vlevel) ? +vlevel : 6;
  const eff = L + 1.5; // 레벨보다 약간 더 사실감
  if (eff <= 4) return { register: "cartoon",
    ink: "Bold flat black-and-white cartoon: thick simple uniform outlines, big friendly rounded shapes, very little detail, cheerful and clear for young readers. Black, white and light grey ink only, no colour.",
    negExtra: "photorealistic, realistic proportions, dense cross-hatching, screentone, benday dots, gritty, semi-realistic" };
  if (eff <= 7) return { register: "comic",
    ink: "Detailed black-and-white pen-and-ink comic illustration: confident varied line weight, expressive faces with normal grown-up proportions (NOT chibi, not big-headed toddlers), light cross-hatching for shade, in the spirit of a classic Larry-Gonick graphic history. Black, white and grey ink only, no colour.",
    negExtra: "chibi, toddler proportions, big-head cartoon, coloring-book flatness, photorealistic, 3d render, heavy screentone" };
  if (eff <= 10) return { register: "graphic-novel",
    ink: "Rich black-and-white literary GRAPHIC-NOVEL illustration with REALISTIC adult human proportions and anatomy, detailed ink cross-hatching and controlled screentone/stipple for depth, light and mood — atmospheric and mature, in the spirit of a serious illustrated classic or a fine wood-engraving. Monochrome ink and grey tone only, no colour.",
    negExtra: "childish cartoon, chibi, big-head, cutesy, flat coloring-book outlines, 3d render, colour photograph" };
  return { register: "realistic",
    ink: "Highly detailed REALISTIC black-and-white illustration and fine etching: lifelike proportions and faces, meticulous hatching and tonal modelling, dramatic chiaroscuro, a sophisticated adult fine-art monochrome plate. No colour.",
    negExtra: "cartoon, childish, chibi, cutesy, simple flat outlines, coloring-book" };
}
export const INK = styleForLevel(6).ink; // 기본(하위호환)
export const HARDBW = "Render the ENTIRE image in black and white ink ONLY — no colour anywhere. Ignore any colour words in the description (blue, red, white, brown, ruddy, etc.); depict those things only as black, white and grey ink.";
export const BLANK = "Any papers, books, ledgers, letters or signs must be completely BLANK with no writing or lettering on them.";
export const NOTEXT = "A single clean illustration with no text, no words, no letters, no readable signs, no speech bubbles, no caption boxes, no panel borders.";
// NEG is actively honoured by SDXL (verified) and ignored by Qwen (harmless there). It holds
// only ALWAYS-unwanted things (never character-specific — e.g. NOT "beard", since some
// characters have one; clean-shaven is set per-character via the canonical description). The
// ornate-frame / decorative-background terms fix an SDXL base-model tendency found in testing.
// 항상 원치 않는 것(색·텍스트·중복·시대착오·기형). 스타일별(halftone vs chibi 등)은 styleForLevel().negExtra 로
// 레벨에 맞춰 붙는다 — 그래서 halftone/semi-realistic 을 BASE 에서 뺐다(고레벨에선 오히려 허용).
const NEG_BASE = "colour, coloured, tinted, blue, red, green, yellow, orange, purple, brown skin, text, words, letters, numbers, writing on paper, scribbled glyphs, signboards, labels, speech bubbles, empty speech balloon, blank speech bubble, caption boxes, panel borders, ornate frame, decorative border, background pattern, floral, checkerboard, transparency grid, isolated on plain white background, sticker, cutout, duplicate character, second face, twin, extra person, bystander, same character twice, two of the same figure, cloned figure, ghostly double of the same person, mirrored duplicate, reflection duplicate, extra heads, multiple views, expression sheet, extra limbs, deformed hands, modern objects, cars, modern kitchen, fitted cabinets, gas stove, electric light, contemporary clothing, cardigan, eyeglasses, wristwatch, floating disembodied head";
export function negForLevel(vlevel, style) { return NEG_BASE + ", " + ((style && style.negExtra) || styleForLevel(vlevel).negExtra); }
export const NEG = negForLevel(6); // 기본(하위호환)

// 웹툰 방향 화풍 — 디테일 리얼리즘 대신 "깨끗·가독·표현력 + 세로스크롤 즉독성". 효율(저품질 티어)과 궁합.
// 일관성(캐릭터 실루엣)·스토리 표현력을 우선하고 파인아트 밀도는 버린다. B&W 유지(HTML 레터링).
export const WEBTOON = { register: "webtoon",
  ink: "Clean modern webtoon / manhwa style: bold clear CONSISTENT line art, simple flat grey tones and light screentone (NOT dense cross-hatching, NOT fine-art realism), expressive readable faces and clear body language, strong recognizable character silhouettes, uncluttered backgrounds that read instantly at a glance while scrolling vertically. Black, white and a few flat greys only, no colour.",
  negExtra: "fine-art realism, dense cross-hatching, wood-engraving, etching, photorealistic, painterly, oil-painting, cluttered detail, muddy heavy shading, chibi, big-head toddler" };

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
export function refPromptText(c, vlevel, style) {
  // 단일뷰 전신 1인 — 다중뷰 모델시트는 edit 조건화 때 2번째 인물/여분 몸을 누출한다(4090 실측).
  // faceless/추상 캐릭터(미래의 유령 등)는 "neutral expression"이 얼굴을 유도하므로 분기(R11 확장).
  const faceless = /faceless|no face|face[^.]*hidden|hidden in (black|darkness|shadow)/i.test(`${c.canonical} ${c.anchor} ${c.distinct_from || ""}`);
  const pose = faceless
    ? "standing straight and facing forward, whole body from head to feet, its face and head COMPLETELY hidden in solid black shadow — NO visible face, no eyes, no nose, no mouth"
    : "standing straight and facing forward, whole body from head to feet, arms at the sides, a calm neutral expression";
  return `${(style && style.ink) || styleForLevel(vlevel).ink} A single full-length character reference of ONE figure ONLY: ${c.name} ${pose}, centred on a plain white background. Exactly ONE person — no second figure, no side or back views, no row of expression heads, no duplicate. ${c.name}: ${c.canonical}, ${c.anchor}. Clear and iconic with the signature features. ${NOTEXT}`;
}

// panel prompt: scene-dominant, identity from ref (or inline description when noref), with
// the HARDBW / BLANK / solo / anti-sheet / scene-meta-strip fixes.
// 전수 게이트(2026-08-06)가 드러낸 4대 체계 결함을 scene 키워드로 자동 강제한다.
// 수동 힌트에 의존하지 않고, 의도가 scene 에 있으면 프롬프트가 스스로 방어한다.
export function sceneClauses(scene) {
  const s = String(scene || ""); const out = [];
  // ① 반투명 유령이 불투명으로 그려지는 문제(Marley 등)
  if (/translucent|see-?through|transparent|semi-?transparent|visible through|through (his|her|its) (transparent |ghostly )?(body|form)/i.test(s))
    out.push("This ghost is genuinely SEE-THROUGH and TRANSLUCENT — the wall, door and objects behind are clearly visible THROUGH the faint spectral body; render it as a pale transparent apparition, NEVER a solid opaque figure.");
  // ② 노화가 확립된 뒤 이후 패널에서 되돌아가는 연속성 붕괴(현재 유령)
  if (/\baged\b|grey hair|gray hair|white beard|white hair|near death|end of (its|his|the)( one)?( night of)? life|elderly|worn with age|old and weary/i.test(s))
    out.push("This character is now VISIBLY OLD and AGED — grey or white hair and beard, deeply wrinkled gaunt face, frail and weary; do NOT draw them young, muscular or dark-haired.");
  // ③ 떠나는/부유하는 영혼 패널에서 같은 인물이 둘로 복제되는 문제
  if (/floating|drifting|fade|departing|through the (door|window|wall)|out (of )?the window|rises? (up|into)|vanish|drift(s|ing)? (away|off)/i.test(s))
    out.push("Show EXACTLY ONE instance of this figure — never draw the same character twice, no second, doubled or duplicate copy of the same ghost or person anywhere in the frame.");
  return out;
}

export function panelPromptText(p, chars, { noref, vlevel, style }) {
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
  // 2차 캐릭터 소품 드리프트 방지: edit 모드에선 anchor(스카프·목발·보조기·쇠사슬 등)가 프롬프트에
  // 안 실려 소품이 탈락했다 → 두 모드 모두 "시그니처 특징/소품"으로 상시 재명시.
  const propLines = chars.map((c) => `${c.name.toUpperCase()} must clearly keep their signature identifying features and props: ${c.anchor}.`);
  const sc = sceneClauses(scene);
  return [((style && style.ink) || styleForLevel(vlevel).ink), HARDBW,
    "Setting: Victorian London around 1843 — everything period-accurate (clothing, furniture, lighting, buildings). Absolutely NO modern objects, no modern clothing, no electric or fluorescent lights, no modern kitchens or furniture.",
    `Draw ONE finished single-scene comic illustration with a full drawn background — do NOT keep a plain white background, and this is NOT a character model sheet or a grid of head studies. Show each character full-figure (head to feet, with arms and hands), not a floating bust. Scene: ${scene}.`,
    `Composition: ${p.composition}.${placement}`,
    (noref ? descLines.join(" ") : refLines.join(" ")),
    propLines.join(" "),
    noref ? "" : "The reference images define ONLY each character's face and build; clothing, headwear and pose come from the scene, but the signature props above must persist. Include exactly ONE instance of each character; do NOT copy the reference layout and do NOT reproduce multiple views, extra heads, busts or an expression row.",
    solo,
    ...sc,
    "Fill the frame with the scene, the main subject prominent and fully inside the edges, not cropped.",
    BLANK, NOTEXT].filter(Boolean).join(" ");
}

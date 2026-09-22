// scripts/design/lib/illo-tines-scenes.mjs
//
// tines 화풍 삽화의 **화풍 · 장면 · 후처리 단일 출처**(DD-68). 생성기 둘이 같이 읽는다:
//   `illo-tines-gen.mjs`(DashScope 무료 API) · `illo-kaggle.mjs`(Kaggle T4 + Qwen-Image GGUF, 무료 GPU 주 30시간).
// 화풍 문장을 한쪽에만 고치면 두 경로의 그림이 갈라진다 — 여기서만 고친다.

/** 화풍 — 참조 사이트에서 관찰한 특징을 글로 옮긴 것. 색은 스킨 토큰(skins/tines.css) 값이다. */
export const PALETTE = 'lavender #c3b5ff, violet #714bd0, deep purple #542f9c, pink #ff87c8, mint green #91d1af, peach #ffbc8a, butter yellow #ffd88c'
export const STYLE_DENSE = `Flat vector illustration, extremely dense decorative floral pattern: hundreds of small stylized flowers, daisies, tulips, leaves and buds packed tightly with no empty space, bold uniform dark purple outlines of equal weight, limited flat palette of ${PALETTE} on a plain cream background #fcf9f5, playful retro screen-print style, crisp shapes, no gradients, no shading, no texture, no text, no letters, no numbers, no watermark`
export const STYLE_SPOT = `Flat vector spot illustration of a single object centered on a plain cream background #fcf9f5 with generous empty margin, a small cluster of stylized flowers and leaves at its base, bold uniform dark purple outlines of equal weight, limited flat palette of ${PALETTE}, playful retro screen-print style, crisp shapes, no gradients, no shading, no texture, no text, no letters, no numbers, no watermark`
export const STYLE_HEADER = `Flat vector illustration filling the whole frame edge to edge, a single clear subject surrounded by densely packed stylized flowers and leaves, bold uniform dark purple outlines of equal weight, limited flat palette of ${PALETTE} with a lavender #ece8fd background, playful retro screen-print style, crisp shapes, no gradients, no shading, no texture, no text, no letters, no numbers, no watermark`
export const STYLE_PATTERN = `Seamless symmetrical kaleidoscope pattern filling the whole square: concentric wavy outlines and stylized flower rosettes radiating from the centre, thin uniform lines in ${PALETTE} on a pale lavender #f5f2fb ground, flat vector, no gradients, no shading, no text, no letters, no watermark`
// ── 3회차(2026-09-21 · tines-mapping §13 — 151페이지 코퍼스) ──────────────────────────────
// 참조 삽화의 대부분은 꽃무늬가 아니라 **굵은 윤곽의 물건 하나**다: 소품(81px 중앙, 페이지당 7.8개)과
// **진한 단색 정사각 면을 꽉 채운 타일**(300×300 · 170×170, 초록 · 자홍 · 주황 · 보라). 꽃무늬는 홈 히어로·마감 띠 전용.
export const PALETTE_OBJ = 'violet #7a56e0, lavender #c3b5ff, emerald green #25a871, mint #91d1af, tangerine #f47e3f, peach #ffcea6, hot pink #e269a4, soft pink #ffc7e5, butter yellow #ffd88c, lime #d6e071, teal #2ac4bc'
export const OBJ_RULES = `bold uniform dark violet outlines #32274b of equal weight, flat fills from the palette ${PALETTE_OBJ} using at least three different palette colours with violet only as one accent, simple flat highlight shapes, chunky slightly isometric three-quarter view, playful retro-tech sticker style, crisp vector shapes, no flowers, no leaves, no gradients, no shading, no texture, no text, no letters, no numbers, no watermark`
export const STYLE_OBJECT = `Flat vector spot illustration of ONE single chunky object centered on a plain cream background #fcf9f5 with generous empty margin around it, isolated and floating on an empty plain cream background that fills the whole image evenly, nothing else in the frame, any mats, papers, signs or labels are completely blank, ${OBJ_RULES}`
/** 타일 — 바탕이 그림의 일부(key:false). 참조 실측 타일 바탕 4색 + 청록 · 짙은 보라. */
// 색 코드만 주면 모델이 바탕을 파랑·보라로 칠한다(2026-09-21 1차: 초록·자홍 8점 전부 파랑·보라) — 이름 + 금지 문구로 못박는다.
export const TILE_BG = {
  green: 'emerald green (#00894f) — the background must be green, not blue, not purple',
  magenta: 'hot magenta pink (#cd3d8b) — the background must be magenta pink, not purple, not blue',
  orange: 'burnt orange (#c75a1a)',
  purple: 'warm violet purple (#7a56e0) — a reddish violet, not blue, not periwinkle',
  teal: 'deep teal (#00807c)',
  ink: 'very dark aubergine (#32274b)',
}
export const STYLE_TILE = (bg) => `Flat vector illustration filling a square: ONE whimsical chunky object or small machine centered on a solid flat background that fills the entire frame edge to edge, background colour: ${bg}, the object occupies about 50 percent of the frame and sits on a simple flat shadow ellipse that is only a slightly darker shade of the background colour, a few tiny floating decorative shapes (dots, small squares, sparkles) around it, ${OBJ_RULES}`
export const STYLE_SCATTER = `Flat vector illustration: dozens of small chunky objects (books, index cards, pencils, headphones, magnifying glasses, alarm clocks, speech bubbles, paper planes, gems, cubes) floating and scattered like confetti around a large completely EMPTY rectangular area in the middle of the frame, the middle 45 percent of the image is empty plain cream background #fcf9f5, objects are small and evenly spread toward the edges, ${OBJ_RULES}`
export const NEG = 'text, letters, words, numbers, watermark, logo, signature, gradient, shading, 3d render, photo, realistic, blurry, noise, grain, frame, border'

/** 장면 — id · 크기(Qwen 지원 비율) · 화풍 · 장면 문장. */
export const SCENES = [
  { id: 'hero-book-field', size: '1664*928', style: STYLE_DENSE,
    scene: 'A giant open book seen from slightly above; its pages burst into a lush dense field of flowers that spills over the edges, while small blank flashcards hang above it like bunting on a string.' },
  { id: 'bed-flowers', size: '1664*928', style: STYLE_DENSE,
    scene: 'A wide low mound of densely packed flowers running along the bottom edge of the frame like a flower bed; the upper half of the image is completely empty plain background.' },
  { id: 'spot-reading', size: '1328*1328', style: STYLE_OBJECT, scene: 'A vintage brass magnifying glass leaning on a small stack of two chunky books.' },
  { id: 'spot-vault', size: '1328*1328', style: STYLE_OBJECT, scene: 'A round glass jar with a cork lid, filled with small blank square word tiles.' },
  { id: 'spot-memory', size: '1328*1328', style: STYLE_OBJECT, scene: 'A round retro alarm clock with two bells sitting on top of a small chunky book.' },
  { id: 'spot-listening', size: '1328*1328', style: STYLE_OBJECT, scene: 'A pair of chunky retro over-ear headphones with a coiled cable.' },
  { id: 'spot-comic', size: '1328*1328', style: STYLE_OBJECT, scene: 'A small stack of three vintage comic books with blank covers and a round paintbrush on top.' },
  // ── 2회차(2026-09-21) — 매핑 §2 · §5 가 필요로 하는 자리 ──
  // 장면(폭 전체)
  { id: 'scene-library', size: '1664*928', style: STYLE_DENSE, scene: 'A tall wooden bookshelf overflowing with books, flowers and vines growing out between the books and spilling onto the floor.' },
  { id: 'scene-comics', size: '1664*928', style: STYLE_DENSE, scene: 'A spread of vintage comic book pages with empty panels and blank speech bubbles, a paintbrush and paint pots, floral vines curling through the panels.' },
  { id: 'scene-csat', size: '1664*928', style: STYLE_DENSE, scene: 'A school exam desk seen from above: a blank answer sheet with empty bubble rows, two pencils, an eraser and a round clock, a border of dense flowers around the desk.' },
  { id: 'scene-teacher', size: '1664*928', style: STYLE_DENSE, scene: 'A friendly classroom: a blank chalkboard, a teacher desk with a stack of notebooks and an apple, small student desks, potted flowers on every windowsill.' },
  { id: 'scene-video', size: '1664*928', style: STYLE_DENSE, scene: 'A vintage film projector casting a beam, its film strip unspooling into a river of flowers.' },
  { id: 'scene-404', size: '1664*928', style: STYLE_DENSE, scene: 'A wooden signpost with several blank arrow signs pointing in different directions, standing in a dense flower meadow.' },
  { id: 'scene-hub', size: '1664*928', style: STYLE_DENSE, scene: 'A cozy reading desk with a desk lamp, an open notebook, a mug and a small stack of books, surrounded by dense potted flowers.' },
  // 소품(카드 구석)
  { id: 'spot-flashcard', size: '1328*1328', style: STYLE_OBJECT, scene: 'A small stack of blank index cards, the top card mid-flip.' },
  { id: 'spot-spellforge', size: '1328*1328', style: STYLE_OBJECT, scene: 'A small blacksmith anvil with two blank square letter tiles on it and a little hammer.' },
  { id: 'spot-wordblitz', size: '1328*1328', style: STYLE_OBJECT, scene: 'A retro stopwatch with a lightning bolt shape on its face.' },
  { id: 'spot-pairflip', size: '1328*1328', style: STYLE_OBJECT, scene: 'Two matching blank playing cards standing side by side, a third card face down.' },
  { id: 'spot-echomatch', size: '1328*1328', style: STYLE_OBJECT, scene: 'A retro studio microphone on a stand with round sound wave rings.' },
  { id: 'spot-dashboard', size: '1328*1328', style: STYLE_OBJECT, scene: 'A chunky bar chart made of three stacked book towers of growing height with a small flag on the tallest.' },
  { id: 'spot-dictionary', size: '1328*1328', style: STYLE_OBJECT, scene: 'A thick open dictionary with a ribbon bookmark and blank pages.' },
  { id: 'spot-teacher', size: '1328*1328', style: STYLE_OBJECT, scene: 'A red apple on a small stack of notebooks next to a brass school bell.' },
  { id: 'spot-empty-vault', size: '1328*1328', style: STYLE_OBJECT, scene: 'An empty round glass jar with a cork lid and a single seed lying at the bottom.' },
  { id: 'spot-review-done', size: '1328*1328', style: STYLE_OBJECT, scene: 'A round rubber stamp next to a blank index card with a big check mark shape.' },
  { id: 'spot-search', size: '1328*1328', style: STYLE_OBJECT, scene: 'A magnifying glass hovering over a single blank index card.' },
  // 카드 머리
  { id: 'card-books', size: '1472*1140', style: STYLE_HEADER, key: false, scene: 'A row of classic hardcover books standing upright, their spines decorated with flowers.' },
  { id: 'card-vocab', size: '1472*1140', style: STYLE_HEADER, key: false, scene: 'A garden bed where blank square word tiles grow like flowers on stems.' },
  // 패턴 타일
  { id: 'pattern-kaleido-1', size: '1328*1328', style: STYLE_PATTERN, key: false, scene: 'Kaleidoscope rosette pattern, violet and mint dominant.' },
  { id: 'pattern-kaleido-2', size: '1328*1328', style: STYLE_PATTERN, key: false, scene: 'Kaleidoscope rosette pattern, pink and peach dominant.' },
  // ── 3회차 — 진한 면 타일(카드 · 히어로 · 모듈 입구, 참조 300×300/170×170) ──
  { id: 'tile-books', size: '1328*1328', style: STYLE_TILE(TILE_BG.green), key: false, scene: 'A stack of three chunky hardcover books with a ribbon bookmark and a tiny brass reading lamp leaning over them.' },
  { id: 'tile-articles', size: '1328*1328', style: STYLE_TILE(TILE_BG.orange), key: false, scene: 'A rolled newspaper tied with string, a paper plane taking off from it.' },
  { id: 'tile-decks', size: '1328*1328', style: STYLE_TILE(TILE_BG.magenta), key: false, scene: 'A fan of blank flashcards held in a small rotating display stand.' },
  { id: 'tile-textbooks', size: '1328*1328', style: STYLE_TILE(TILE_BG.purple), key: false, scene: 'A staircase built from stacked textbooks leading up to a small arched doorway.' },
  { id: 'tile-comics', size: '1328*1328', style: STYLE_TILE(TILE_BG.purple), key: false, scene: 'An open vintage comic book with blank panels and blank speech bubbles popping out of it.' },
  { id: 'tile-read', size: '1328*1328', style: STYLE_TILE(TILE_BG.green), key: false, scene: 'An open book on a small lectern with round reading glasses resting on the pages.' },
  { id: 'tile-vault', size: '1328*1328', style: STYLE_TILE(TILE_BG.magenta), key: false, scene: 'A small treasure chest overflowing with blank square word tiles and a couple of gems.' },
  { id: 'tile-flashcard', size: '1328*1328', style: STYLE_TILE(TILE_BG.purple), key: false, scene: 'A little machine with a crank that flips a blank index card over.' },
  { id: 'tile-wordblitz', size: '1328*1328', style: STYLE_TILE(TILE_BG.orange), key: false, scene: 'A retro stopwatch strapped to a tiny rocket with a lightning bolt on it.' },
  { id: 'tile-pairflip', size: '1328*1328', style: STYLE_TILE(TILE_BG.teal), key: false, scene: 'A three by three grid of blank memory cards, two of them flipped face up showing the same simple star shape.' },
  { id: 'tile-spellforge', size: '1328*1328', style: STYLE_TILE(TILE_BG.orange), key: false, scene: 'A blacksmith anvil with glowing blank letter tiles being hammered, small sparks flying.' },
  { id: 'tile-echo', size: '1328*1328', style: STYLE_TILE(TILE_BG.green), key: false, scene: 'A retro microphone on a stand with a parrot perched on top and round sound wave rings.' },
  { id: 'tile-quiz', size: '1328*1328', style: STYLE_TILE(TILE_BG.magenta), key: false, scene: 'A blank multiple choice answer sheet clipped to a clipboard with a pencil and a small spotlight shining on it.' },
  { id: 'tile-dictation', size: '1328*1328', style: STYLE_TILE(TILE_BG.purple), key: false, scene: 'A pair of headphones plugged into a chunky vintage typewriter with a blank sheet of paper.' },
  { id: 'tile-dashboard', size: '1328*1328', style: STYLE_TILE(TILE_BG.ink), key: false, scene: 'A small garden of four plant pots at different growth stages standing on a stepped wooden shelf, with a watering can.' },
  { id: 'tile-csat', size: '1328*1328', style: STYLE_TILE(TILE_BG.magenta), key: false, scene: 'A blank exam paper on a desk under a hanging lamp, a magnifying glass and two pencils beside it.' },
  { id: 'tile-teacher', size: '1328*1328', style: STYLE_TILE(TILE_BG.green), key: false, scene: 'A small chalkboard on an easel with a red apple and a brass bell on the ledge.' },
  { id: 'tile-hub', size: '1328*1328', style: STYLE_TILE(TILE_BG.purple), key: false, scene: 'A cozy desk lamp shining over an open notebook, a mug and a small stack of books.' },
  // ── 3회차 — 용도별 소품(빈 상태 · 오류 · 로딩 · 잠김 · 환영 · 404 · 계획) ──
  { id: 'spot-error', size: '1328*1328', style: STYLE_OBJECT, scene: 'A small paper plane with a crumpled wing and a bandage patch on it.' },
  { id: 'spot-offline', size: '1328*1328', style: STYLE_OBJECT, scene: 'An unplugged electrical plug with its cable lying next to a wall socket.' },
  { id: 'spot-empty-shelf', size: '1328*1328', style: STYLE_OBJECT, scene: 'A small empty wooden bookshelf with a single book leaning on one side.' },
  { id: 'spot-empty-page', size: '1328*1328', style: STYLE_OBJECT, scene: 'A blank sheet of paper with a sharpened pencil lying on it.' },
  { id: 'spot-loading', size: '1328*1328', style: STYLE_OBJECT, scene: 'A chunky hourglass with sand flowing.' },
  { id: 'spot-locked', size: '1328*1328', style: STYLE_OBJECT, scene: 'A closed book with a round brass padlock on its cover.' },
  { id: 'spot-welcome', size: '1328*1328', style: STYLE_OBJECT, scene: 'An open wooden door with a plain blank round doormat in front of it.' },
  { id: 'spot-lost', size: '1328*1328', style: STYLE_OBJECT, scene: 'A small book floating in the air, lifted by a cone of light from a hovering flying saucer.' },
  { id: 'spot-calendar', size: '1328*1328', style: STYLE_OBJECT, scene: 'A desk calendar page with a ribbon bookmark and a small pencil.' },
  // ── 4회차(Kaggle) — 목록 행 · 분류 칸 소품(참조 소품 81px · 페이지당 7.8 — tines-mapping §18) ──
  { id: 'spot-topic-science', size: '1328*1328', style: STYLE_OBJECT, scene: 'A small brass telescope on a tripod pointed at a ringed planet.' },
  { id: 'spot-topic-talk', size: '1328*1328', style: STYLE_OBJECT, scene: 'Two overlapping chunky speech bubbles, one with three dots.' },
  { id: 'spot-topic-easy', size: '1328*1328', style: STYLE_OBJECT, scene: 'An open picture book with a big star shape popping out of the pages.' },
  { id: 'spot-topic-data', size: '1328*1328', style: STYLE_OBJECT, scene: 'A small bar chart standing upright with a magnifying glass leaning on it.' },
  { id: 'spot-topic-radio', size: '1328*1328', style: STYLE_OBJECT, scene: 'A retro table radio with a round speaker grille and a tuning dial.' },
  { id: 'spot-topic-travel', size: '1328*1328', style: STYLE_OBJECT, scene: 'A small globe on a stand next to a tiny suitcase.' },
  { id: 'spot-cat-high', size: '1328*1328', style: STYLE_OBJECT, scene: 'A small school building with a clock tower.' },
  { id: 'spot-cat-middle', size: '1328*1328', style: STYLE_OBJECT, scene: 'A chunky school backpack with a ruler sticking out.' },
  { id: 'spot-cat-elem', size: '1328*1328', style: STYLE_OBJECT, scene: 'A box of crayons with three crayons standing up.' },
  { id: 'spot-cat-cert', size: '1328*1328', style: STYLE_OBJECT, scene: 'A rolled certificate tied with a ribbon and a round medal.' },
  { id: 'spot-cat-roots', size: '1328*1328', style: STYLE_OBJECT, scene: 'A small tree with a big visible root system spreading under the ground.' },
  { id: 'spot-cat-business', size: '1328*1328', style: STYLE_OBJECT, scene: 'A single chunky leather briefcase with a gold clasp, standing upright.' },
  { id: 'spot-cat-theme', size: '1328*1328', style: STYLE_OBJECT, scene: 'A folded map with three round map pins stuck in it.' },
  { id: 'spot-settings', size: '1328*1328', style: STYLE_OBJECT, scene: 'A chunky gear with a small wrench crossing it.' },
  // ── 3회차 — 흩어진 물건 띠(마감 CTA 둘레, 참조 1240×540) ──
  { id: 'band-scatter', size: '1664*928', style: STYLE_SCATTER, scene: 'Learning objects floating around an empty centre.' },
  { id: 'spot-quiz', size: '1328*1328', style: STYLE_OBJECT, scene: 'A sharpened pencil lying across a blank index card with three empty round checkboxes.' },
]


/**
 * 바탕 빼기 + WebP 인코딩(페이지 안에서). 생성 이미지의 크림 바탕은 장마다 조금씩 달라 페이지 바탕 위에서
 * 상자 테두리가 보인다 — **가장자리에서 이어진** 바탕색 화소만 투명하게 한다(그림 안쪽 크림색은 남는다).
 * 경계는 바탕과의 거리로 알파를 부드럽게 준다(외곽선 주변 계단 방지).
 */
export function keyAndEncode([src, key]) {
  return (async () => {
    const img = new Image(); img.src = src; await img.decode()
    const W = img.naturalWidth, H = img.naturalHeight
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    if (key === false) return c.toDataURL('image/webp', 0.86).split(',')[1] // 바탕이 그림의 일부(카드 머리 · 패턴)
    const id = g.getImageData(0, 0, W, H), d = id.data
    // 바탕색 = 네 모서리 16px 칸의 중앙값
    const samples = []
    for (const [x0, y0] of [[0, 0], [W - 16, 0], [0, H - 16], [W - 16, H - 16]])
      for (let y = y0; y < y0 + 16; y++) for (let x = x0; x < x0 + 16; x++) { const i = (y * W + x) * 4; samples.push([d[i], d[i + 1], d[i + 2]]) }
    const med = [0, 1, 2].map((k) => samples.map((p) => p[k]).sort((a, b) => a - b)[samples.length >> 1])
    const dist = (i) => Math.hypot(d[i] - med[0], d[i + 1] - med[1], d[i + 2] - med[2])
    const HARD = 22, SOFT = 48
    const seen = new Uint8Array(W * H), stack = []
    for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x) }
    for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1) }
    while (stack.length) {
      const p = stack.pop()
      if (seen[p]) continue
      seen[p] = 1
      const i = p * 4, e = dist(i)
      if (e > SOFT) continue
      d[i + 3] = e <= HARD ? 0 : Math.round(255 * (e - HARD) / (SOFT - HARD))
      if (e > HARD) continue // 부드러운 경계에서는 더 퍼지지 않는다
      const x = p % W, y = (p / W) | 0
      if (x > 0) stack.push(p - 1); if (x < W - 1) stack.push(p + 1)
      if (y > 0) stack.push(p - W); if (y < H - 1) stack.push(p + W)
    }
    g.putImageData(id, 0, 0)
    return c.toDataURL('image/webp', 0.86).split(',')[1]
  })()
}


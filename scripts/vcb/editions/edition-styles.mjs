// scripts/vcb/editions/edition-styles.mjs
//
// **에디션 표지 화풍 — 단일 출처.** 참조 shopify.com/editions 서가 표지 9장을 관찰해 글로 옮긴 8 화풍.
// 참조 이미지는 입력으로 넣지 않는다(파생물 금지) — 화풍은 글 설명으로만 준다.
// 표지 제목은 굽지 않는다(no text) — 한글 제목은 HTML 이 표지 위쪽에 얹는다(`VocabEditionCover`).
// 그래서 모든 화풍이 **위쪽 30% 를 조용한 면**으로 비워 둔다(제목이 앉을 자리).
//
// **기본 화풍은 `tines`**(사용자 지시 2026-09-26 「tines 스타일로 전체 변환 — 파이프라인도」) — 앱 스킨(DD-68)의 삽화와
// 같은 손: 진한 단색 면을 꽉 채운 정사각 위에 굵은 보라 윤곽의 통통한 사물 하나. 화풍 문장은 tines 삽화의 단일 출처
// (scripts/design/lib/illo-tines-scenes.mjs)에서 가져온다 — 여기서 다시 쓰면 서가 표지와 앱 삽화가 두 손으로 갈린다.
// 나머지 8 화풍(Editions 관찰)은 남겨 둔다 — 권마다 `style` 로 고를 수 있다.

import { NEG as TINES_NEG, STYLE_TILE, TILE_BG } from '../../design/lib/illo-tines-scenes.mjs'

/** 기본 화풍 */
export const DEFAULT_STYLE = 'tines'
/** tines 면 색 키 — illo-tines-scenes TILE_BG 의 키 */
export const TINES_BG = Object.keys(TILE_BG)

/** 참조 표지 관찰 → 화풍 문장. 키는 prompts.out.json 의 `style` 과 같다. */
export const STYLES = {
  // UNIFIED · FOUNDATIONS — 반투명 유리·크롬 오브젝트가 떠 있는 3D 제품 렌더
  glass3d:
    'high-end 3D product render, glossy translucent glass and chrome objects floating in space, soft studio lighting, subtle iridescent reflections, shallow depth of field, octane render quality',
  // RENAISSANCE — 고전 유화, 명암법, 캔버스 결
  oil:
    'classical Renaissance oil painting, chiaroscuro lighting, rich earthy pigments, visible canvas texture and fine brushwork, museum masterpiece quality',
  // HORIZONS — 신스웨이브 네온, 보라·자홍 하늘과 수평선
  synthwave:
    '1980s synthwave aesthetic, glowing neon lines, deep violet and magenta starry sky, luminous horizon over reflective water, retro-futuristic poster art, cinematic',
  // BUILT TO LAST — 촘촘한 등각 선화, 노랑 하늘, 사람이 가득한 단면도
  isometric:
    'dense detailed isometric line illustration, cutaway cross-section full of tiny busy people and objects, crisp black ink outlines with flat warm colours, bright saturated yellow sky, editorial magazine illustration',
  // CONNECT TO CONSUMER — 파스텔 라일락 바탕의 말랑한 클레이 3D 오브젝트
  clay:
    'playful pastel claymorphism 3D render, soft rounded glossy toy-like objects, lilac and mint and peach pastel palette, soft shadows, gentle gradient lilac background, cute and friendly',
  // IMAGINE MY BUSINESS — 검정 바탕에 늘어선 빛 판들, 주황→자홍→파랑 그라디언트
  prism:
    'abstract dark composition, rows of tall translucent light panels receding in perspective, glowing gradients from orange to magenta to electric blue on pure black, dramatic cinematic lighting, minimal and bold',
  // EVERYWHERE — 안개 낀 숲 사진에 홀로그램 입자
  dreamy:
    'dreamlike misty photograph, soft focus, lush greenery, holographic iridescent glitter particles and chromatic noise overlay, ethereal pastel light leaks, analog film grain',
  // THE BORING EDITION — 흑백 문서 콜라주 위의 레트로 CRT 텔레비전
  collage:
    'retro mixed-media collage, black and white printed document pages and halftone scraps as background, one vintage physical object photographed in the middle as the focal point, bold pop colours only on that object, zine aesthetic',
}

/** 모든 표지 공통 — 정사각, 위쪽 30% 는 제목 자리, 글자 없음. */
// ⚠️ 숫자·「headline」·「title」 같은 말을 쓰지 않는다 — Kaggle 경로(Q3 + Lightning 4스텝, cfg=1 이라 부정 프롬프트가
//    안 먹는다)가 그 말을 **글자로 그렸다**(2026-09-25 1묶음: "top 30 percent … headline" → 10장 중 8장 위쪽에 「30」).
//    빈 자리는 사물로 말한다(열린 하늘 · 빈 벽 · 여백).
export const LAYOUT =
  'Square composition. The upper third of the frame is open empty space — plain sky, bare wall or smooth empty background — with nothing drawn in it. The main subject sits low in the frame. Pure image only, completely wordless, no signage, no printed marks.'

export const NEG =
  'text, letters, words, typography, numbers, caption, logo, watermark, signature, frame, border, collage grid, split panels, low quality, blurry, deformed'

/** 화풍별 제목 글자색 — 위쪽 면의 밝기에 맞춘다(흰 글자가 밝은 면에 앉으면 안 보인다). */
export const TITLE_INK = {
  glass3d: 'light',
  oil: 'light',
  synthwave: 'light',
  isometric: 'dark',
  clay: 'light',
  prism: 'light',
  dreamy: 'light',
  collage: 'dark',
  tines: 'light', // TILE_BG 는 전부 진한 면이다
}

/** 화풍별 부정 프롬프트 */
export const negFor = (style) => (style === 'tines' ? TINES_NEG : NEG)

/** tines — 사물은 아래 3분의 2 에, 위는 면만(제목 자리). 숫자·headline 같은 말은 쓰지 않는다(위 LAYOUT 경고). */
const TINES_LAYOUT = 'The object sits in the lower two thirds of the square; the upper third is only the plain solid background colour with nothing on it.'

export function promptFor({ style = DEFAULT_STYLE, bg, subject }) {
  if (style === 'tines') {
    if (!TILE_BG[bg]) throw new Error(`tines 면 색이 없다(${bg}) — ${TINES_BG.join(' · ')}`)
    return `${subject} ${STYLE_TILE(TILE_BG[bg])}. ${TINES_LAYOUT}`
  }
  const s = STYLES[style]
  if (!s) throw new Error(`모르는 화풍: ${style}`)
  return `${subject}. Style: ${s}. ${LAYOUT}`
}

// apps/web/src/lib/learner/practice-map.ts
//
// 면(facet) ↔ 연습 도구 매핑 — 모듈 4종 + Game Lab 게임.
//
// **왜 게임을 여기 넣나 (조사 근거)**
//   · Quizlet 은 Match(게임)를 Flashcards·Learn·Test 와 **같은 화면**에 둔다 — 같은 콘텐츠를
//     쓰기 때문이다. 우리 게임도 전부 학습자 자기 단어를 쓴다(`source: 'mine'`).
//   · Duolingo Practice Hub 는 도구 이름이 아니라 **기술**(Speak·Listen·Words·Mistakes)로
//     고르게 하고, 상단에 회전하는 추천 하나를 둔다.
//   · 실측: `/practice` 첫 버전은 Sound·Build·Use 에 "아직 전용 연습이 없어요" 라고 말했는데
//     **틀렸다.** Game Lab 에 그 면을 훈련하는 게임이 있다(듣기·형태론·의미망).
//     게임을 사이드바 옆칸에 따로 두는 바람에 화면이 자기 제품을 모르고 있었다.
//
// **매핑은 `GameEntry.layer` 에서 파생한다** — 게임마다 손으로 면을 적으면 반드시 어긋난다.
// layer 는 이미 인지 계층을 말하고 있으므로 그 접두사로 라우팅한다.
// 면이 불분명한 계층(리텐션 · L4+ 시너지 · L2 해독)은 **억지로 붙이지 않는다** — Game Lab
// 전체 목록에서만 만난다. 없는 분류를 지어내는 것이 이 파일이 피하려는 것이다.

import { GAME_CATALOG, gamePlayHref } from '@/lib/game/catalog'
import type { FacetId } from '@/lib/framework/axes'

export interface PracticeTool {
  label: string
  href: string
  /** 게임이면 true — 화면이 모듈과 게임을 구분해 보여줄 수 있게 */
  isGame: boolean
}

/** 모듈 도구 — 전용 허브를 가진 4종. */
const MODULE_TOOLS: Partial<Record<FacetId, PracticeTool[]>> = {
  recognize: [
    { label: 'Flashcard', href: '/flashcard', isGame: false },
    { label: 'PairFlip', href: '/pairflip', isGame: false },
  ],
  spell: [{ label: 'SpellForge', href: '/spellforge', isGame: false }],
  fluency: [{ label: 'WordBlitz', href: '/wordblitz', isGame: false }],
}

/**
 * `layer` 접두사 → 면.
 *
 * 반환이 null 이면 "이 게임은 특정 면으로 라우팅하지 않는다" 는 뜻이다(리텐션·시너지·해독).
 */
function facetOfLayer(layer: string): FacetId | null {
  if (layer.startsWith('L4c')) return 'sound'
  if (layer.startsWith('L5')) return 'use'
  if (layer.startsWith('L4b')) {
    // 생성 = 철자를 만들어 내는 것, 형태론·귀납 = 조각으로 나누고 붙이는 것
    return layer.includes('생성') ? 'spell' : 'build'
  }
  if (layer.startsWith('L4a')) {
    // 자동화·경쟁·전략은 속도 압박이 본질이라 Fluency, 나머지는 재인
    return /자동화|경쟁|전략/.test(layer) ? 'fluency' : 'recognize'
  }
  return null
}

/** 연습에서 연 게임이 끝나고 돌아올 곳. */
export const PRACTICE_HREF = '/practice'

/**
 * 게임 진입 경로.
 *
 * ⚠️ `from` 을 반드시 실어야 한다. 게임 종료는 `resolveSessionReturnHref(scope.from, …, '/arcade')`
 * 로 처리되므로, 맨 경로(`/play/x`)로 열면 **연습에서 시작했는데 Game Lab 으로 튕긴다.**
 * 통합 화면이 자기가 연 문 뒤로 학습자를 되돌리지 못하는 것이라, 통폐합 자체를 무의미하게
 * 만드는 결함이다(영향도 전수 검사에서 발견).
 */
function gameHref(slug: Parameters<typeof gamePlayHref>[0]): string {
  return gamePlayHref(slug, { from: PRACTICE_HREF })
}

/**
 * 면별 도구 전체 = 모듈 + 게임.
 *
 * 게임은 카탈로그에서 파생하므로 게임이 추가되면 여기도 **자동으로** 늘어난다.
 * (베타 게임은 학습 기록에 연동되지 않으므로 연습 목록에서 뺀다 — 연습했는데 안 남으면
 *  그것도 조용한 실패다.)
 */
export function practiceToolsByFacet(): Record<FacetId, PracticeTool[]> {
  const out = {
    recognize: [],
    spell: [],
    sound: [],
    build: [],
    use: [],
    fluency: [],
  } as Record<FacetId, PracticeTool[]>

  for (const [facet, tools] of Object.entries(MODULE_TOOLS)) {
    out[facet as FacetId].push(...(tools ?? []))
  }

  for (const g of GAME_CATALOG) {
    if (g.beta) continue
    if (g.source !== 'mine') continue // 내 단어를 쓰는 게임만 "연습" 이다
    const facet = facetOfLayer(g.layer)
    if (!facet) continue
    // WordBlitz 는 모듈로 이미 들어가 있다 — 중복 금지
    if (out[facet].some((t) => t.label === g.name)) continue
    out[facet].push({ label: g.name, href: gameHref(g.slug), isGame: true })
  }

  return out
}

/** Game Lab 전체 진입 — 면에 매핑되지 않은 게임들이 여기 있다. */
export const GAME_LAB_HREF = '/arcade'

/**
 * Game Lab 이 **실제로 보여주는** 게임 수.
 *
 * `/arcade` 는 베타를 뱃지만 붙이고 걸러내지 않으므로 카탈로그 전량이 맞다.
 * 연습 카드에 매핑된 수(17)를 여기 쓰면 링크를 눌렀을 때 숫자가 어긋난다 —
 * 화면이 자기가 여는 문 뒤를 잘못 말하는 것이 이 프로젝트가 반복해서 밟은 함정이다.
 */
export function gameLabCount(): number {
  return GAME_CATALOG.length
}

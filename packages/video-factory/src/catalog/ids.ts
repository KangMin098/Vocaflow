// packages/video-factory/src/catalog/ids.ts
//
// **영상 id 규칙 — 단일 출처.**
//
// 왜 따로 뺐나: 이 규칙이 **두 곳에서 쓰인다.**
//   · 공장(`build.ts`)이 id 를 **짓고**
//   · 앱(`apps/web/src/lib/video/catalog.ts`)이 그 id 로 **찾는다**
// 두 곳에 각자 적으면 반드시 갈리고, 갈리면 **오류 없이 영상이 안 뜬다** — 이 저장소가
// 이름·경로·수치에서 반복해서 겪은 모양이다(`differentiators.ts` 머리말 참조).
//
// 이 파일에는 Remotion 도 `node:*` 도 없다. 그래서 앱이 안심하고 import 한다
// (`@vocaflow/video-factory/ids`). 무거운 것이 딸려 오면 Next 번들이 통째로 커진다.

export const VIDEO_IDS = {
  intro: 'intro-platform',
  curriculum: 'curriculum-ladder',
  /** 학습방법 총론 — 단어 하나가 거치는 5단계 */
  methodStages: 'method-stages',
} as const

/** 학습방법 — 면 하나를 설명한다(`method-spell`). */
export function methodVideoId(facetId: string): string {
  return `method-${facetId}`
}

/** 권장안 — 한 단계에서 다음 단계로 무엇을 권하는가(`advice-recognized`). */
export function adviceVideoId(fromStageId: string): string {
  return `advice-${fromStageId}`
}

/**
 * 교재 **권별** — 시리즈의 한 계단(`volume-reading-4`).
 *
 * ⚠️ 아직 이 id 를 **만드는 규칙이 없다.** 그래도 여기 있는 이유는 기획(`catalog/plan.ts`)이
 *   「설계도로 표현조차 못 하는 후보」를 화면에 올려야 하기 때문이다 — 없는 것이 목록에
 *   안 보이면 영원히 안 만들어진다.
 */
export function volumeVideoId(seriesId: string, step: number): string {
  return `volume-${seriesId}-${step}`
}

/** 문항 유형 코드는 밑줄(`word_order`), 영상 id 는 하이픈(`type-word-order`). */
export function typeVideoId(typeCode: string): string {
  return `type-${typeCode.replace(/_/g, '-')}`
}

export function seriesVideoId(seriesId: string): string {
  return `series-${seriesId}`
}

export function activityVideoId(activityId: string): string {
  return `module-${activityId}`
}

export function benefitVideoId(slug: string): string {
  return `benefit-${slug}`
}

/**
 * 요청 편 — `req-<대상 슬러그>-<요청 id 앞 6자>`. 같은 대상에 요청이 여럿이어도 갈리지 않는다.
 * 대상 키가 한글·자유 입력이면 슬러그가 비므로 `custom` 으로 둔다.
 */
export function requestVideoId(targetKey: string, requestId: string): string {
  const slug = targetKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  const short = requestId.replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase()
  return `req-${slug || 'custom'}-${short}`
}

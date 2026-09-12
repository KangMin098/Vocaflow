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
} as const

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

// apps/web/src/lib/csat/lecture/types.ts
//
// **하이라이트 동기 강의 — 스키마.** 대본·큐·하이라이트가 이 모양 하나에 묶인다.
//
// 이 모양은 **TTS 엔진과 무관하다.** 지금은 브라우저 Web Speech 가 읽지만, 서버 TTS 로
// 바꾸는 날에도 이 파일은 그대로다(어댑터만 갈아 끼운다 — `tts.ts`). 그래서 여기에는
// 목소리·속도·엔진에 관한 필드가 하나도 없다.
//
// ⚠️ 대본 문자열은 **학습자 화면 HTML 에 실리지 않는다.** 재생을 누른 뒤에만
//    `/api/csat/lecture` 로 받아 엔진에 넣는다(서버 렌더 props 로 넘기면 RSC 페이로드에 박힌다).
// ⚠️ 이 파일은 `@/` 별칭을 쓰지 않는다 — 드레인 스크립트(tsx)가 그대로 import 한다.

/** 강의 한 편을 이루는 역할. **순서가 곧 강의의 뼈대다**(ROLE_ORDER). */
export type LectureRole =
  | 'intro'
  | 'strategy'
  | 'structure'
  | 'evidence'
  | 'eliminate'
  | 'trap'
  | 'vocab'
  | 'wrapup'

export const ROLE_ORDER: readonly LectureRole[] = [
  'intro',
  'strategy',
  'structure',
  'evidence',
  'eliminate',
  'trap',
  'vocab',
  'wrapup',
]

export type SegmentLang = 'ko-KR' | 'en-US'

/** 한 번에 읽히는 단위. 한/영이 섞이면 발음이 무너지므로 언어마다 나눈다. */
export interface LectureSegment {
  lang: SegmentLang
  text: string
}

/**
 * 하이라이트 대상.
 * - `analysis` — 해설 화면의 분석 블록(`head`·`ability`·`intent`·`answer`·`reject:n`·`procedure`·`vocab`·`map`)
 * - `anchor` — 원문 자리(`sentence:k` — 지문 지도의 k번째 막대, 0부터)
 */
export interface LectureTarget {
  kind: 'analysis' | 'anchor'
  id: string
}

export interface LectureCue {
  id: string
  order: number
  target: LectureTarget
  role: LectureRole
  segments: LectureSegment[]
  /** 1.0 배속 기준 추정 초. **적재가 계산해 덮는다** — 쓰는 쪽의 어림을 믿지 않는다. */
  est_sec: number
  /** 이 큐가 끝난 뒤 하이라이트를 붙들고 있는 시간 */
  pause_after_ms: number
  /**
   * 대본이 「N번째 문장」이라고 말한 막대(0부터). 분석 블록을 가리키는 큐에만 적재가 채운다.
   * 지도가 켜려던 문장에 이것이 없으면 지도는 이쪽을 켠다 — 말과 막대를 맞춘다(`focus.ts`).
   */
  focus?: number[]
}

export interface Lecture {
  item_id: string
  version: number
  total_sec_est: number
  generated_by: string
  /** 기계 점수 + 심사 점수(0~100). 적재 시점의 값이다. */
  rubric_score: number
  cues: LectureCue[]
}

/** 회차 파일 한 벌 — `lecture-data/<exam>.json` */
export interface LectureExamFile {
  exam_id: string
  built: string
  lectures: Record<string, Lecture>
}

/** 색인 — 화면이 「강의가 있는가 · 몇 분인가」를 **대본 없이** 알 수 있게 */
export interface LectureIndex {
  built: string
  items: Record<string, { sec: number; cues: number; score: number; type?: string | null }>
}

/**
 * 큐 하나의 **겉모습** — 대본(`segments`) 없이 역할·가리킬 곳·길이만.
 * 해설 극장의 왼쪽 레일이 재생 전에 그릴 수 있는 것이 정확히 이만큼이다(`store.lectureOutline`).
 */
export interface LectureStep {
  id: string
  order: number
  role: LectureRole
  target: LectureTarget
  est_sec: number
  focus?: number[]
}

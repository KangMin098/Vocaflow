// apps/web/src/lib/csat/reflow/types.ts
//
// **문항 reflow 의 모양.** 학습자 PDF 에서 뽑은 글자 조각 → 문항 하나의 발문·지문·선지.
//
// ⚠️ 이 모양의 값(글자)은 **학습자 브라우저 안에서만** 만들어지고 머문다. 서버로 보내는 길이
//    없고, 서버 모듈이 이 파일을 import 해서 원문을 다루는 일도 없다(측정 스크립트 제외 —
//    그건 로컬 원본을 읽고 수치만 남긴다).
// ⚠️ `@/` 별칭을 쓰지 않는다 — 측정 스크립트(tsx)가 그대로 import 한다.

/** 글자 조각 하나 — PDF 좌표계(왼아래 원점 · 1/72 인치). `y` 는 기준선. */
export interface PdfFrag {
  str: string
  x: number
  y: number
  w: number
  h: number
}

/** 가로 선 하나 — PDF 좌표계. 시험지의 **빈칸은 글자가 아니라 이 선으로 그려진다**(blank-probe 실측). */
export interface HLine {
  x0: number
  x1: number
  y: number
}

export interface PageFrags {
  p: number
  w: number
  h: number
  frags: PdfFrag[]
  /** 그리기 명령에서 모은 가로 선 — 없으면(옛 호출) 빈칸을 복원하지 않는다 */
  lines?: HLine[]
}

/** 커밋된 좌표 색인(`anchor-data/<회차>.json`)에서 reflow 가 쓰는 부분 */
export interface ReflowAnchorItem {
  no: number
  p: number
  col: number
  x: number
  y: number
  w: number
  h: number
}

export interface ReflowAnchors {
  form_pages: number
  items: ReflowAnchorItem[]
}

/** 한 줄 — 같은 쪽·같은 단·같은 기준선의 조각들 */
export interface ReflowLine {
  p: number
  col: number
  y: number
  /** 줄 높이(가장 큰 조각) — 크롭 폴백의 상자 계산에 쓴다 */
  h: number
  text: string
}

/** 문항이 종이 위에서 차지한 자리 — 크롭 폴백용. 단마다 한 조각. */
export interface ReflowBox {
  p: number
  col: number
  /** 위 끝(큰 y) */
  top: number
  /** 아래 끝(작은 y) */
  bottom: number
}

export interface ReflowItem {
  no: number
  stem: string
  /** 영어 지문. 기호 선지 유형은 ①~⑤ 가 본문에 박혀 있다. */
  passage: string
  /** 각주(`* word: 뜻`) */
  notes: string[]
  /** 선지 5개. 기호 선지 유형은 빈 배열 — ①~⑤ 가 곧 선지다. */
  choices: string[]
  /** ①~⑤ 가 지문에 박히는 유형인가 */
  inline: boolean
  /** 쓸 만하게 뽑혔나. false 면 화면은 크롭 폴백으로 간다. */
  ok: boolean
  /** ok=false 의 이유(닫힌 목록 — 계측으로 나간다) */
  reason: ReflowFailure | null
  boxes: ReflowBox[]
}

export type ReflowFailure = 'no-anchor' | 'no-start-line' | 'empty-passage' | 'choice-split'

/** 기기에 남기는 회차 한 벌(IndexedDB). **원본 바이트는 없다.** */
export interface CachedPaper {
  exam_id: string
  sha256: string
  /** 추출기 판 — 바뀌면 캐시를 버리고 다시 뽑는다 */
  version: number
  saved_at: string
  items: ReflowItem[]
}

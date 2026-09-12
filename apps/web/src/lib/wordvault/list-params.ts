// apps/web/src/lib/wordvault/list-params.ts
//
// `/wordvault/browse` 의 목록 파라미터(`?q=` · `?level=`) — **읽는 자의 단일 출처.**
//
// ── 왜 생겼나 (실측 2026-08-30) ──────────────────────────────────────
// 허브의 세 자리가 이 파라미터를 걸고 있었는데 **읽는 코드가 저장소에 하나도 없었다.**
//
//   · `WordPeekStrip`     — 단어를 누르면 `?view=browse&q=<단어>`
//   · `FindAndMore`       — 검색창 Enter 로 `?view=browse&q=<검색어>`
//   · `CEFRDistribution`  — 레벨 막대를 누르면 `?view=browse&level=B1`
//
// 세 개 다 목적지에서 조용히 버려졌다. 학습자는 단어를 눌러 놓고 **전체 목록**을 받는다.
// 오류도 경고도 없다 — `filter=state:new` 가 2주 동안 무시되던 것과 **같은 계열**이고
// (`state-filter.ts` 머리말), 그때 세운 규칙을 여기에도 적용한다:
// **파라미터의 읽는 자를 한 파일에 두고, 저장소에 적힌 링크를 훑는 회귀를 함께 낸다.**
//
// ── `level` 이 두 가지 값을 받는 이유 ────────────────────────────────
// 화면의 난이도 셀렉트는 **묶음**(`a`=A1~A2 · `b`=B1~B2 · `c`=C1~C2)으로 고르는데,
// 허브의 레벨 막대는 **낱개 CEFR**(`B1`)로 보낸다. 둘 다 정당한 요청이라 둘 다 받는다 —
// 한쪽으로 강제하면 막대는 자기가 가리키던 칸보다 넓은 결과를 열게 된다.

import type { CefrLevel, LevelClass } from '@/components/wordvault/types'

const CEFR: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const CLASSES: readonly LevelClass[] = ['a', 'b', 'c']

export type LevelParam =
  | { kind: 'class'; value: LevelClass }
  | { kind: 'cefr'; value: CefrLevel }

/**
 * `?level=` 값을 판정한다. 모르는 값이면 `null` —
 * 호출부가 "지정 안 함" 과 "못 알아들음" 을 구별할 수 있어야 한다.
 */
export function parseLevelParam(raw: string | null | undefined): LevelParam | null {
  if (!raw) return null
  const v = raw.trim()
  if (!v || v === 'all') return null
  const lower = v.toLowerCase() as LevelClass
  if ((CLASSES as readonly string[]).includes(lower)) return { kind: 'class', value: lower }
  const upper = v.toUpperCase() as CefrLevel
  if ((CEFR as readonly string[]).includes(upper)) return { kind: 'cefr', value: upper }
  return null
}

/** 화면 셀렉트가 쓰는 묶음 값으로 환산 — 셀렉트의 초기 표시를 맞추는 데 쓴다. */
export function levelParamToClass(p: LevelParam | null): LevelClass | 'all' {
  if (!p) return 'all'
  if (p.kind === 'class') return p.value
  const head = p.value[0]?.toLowerCase()
  return head === 'a' || head === 'b' || head === 'c' ? head : 'all'
}

/** 이 단어가 그 레벨 조건에 걸리는가. */
export function matchesLevel(
  word: { level: CefrLevel; levelClass: LevelClass },
  p: LevelParam | null,
): boolean {
  if (!p) return true
  return p.kind === 'class' ? word.levelClass === p.value : word.level === p.value
}

/**
 * `?q=` — 단어 또는 뜻에 대한 부분 일치.
 *
 * 화면의 검색창과 **같은 규칙**을 쓴다(둘이 갈리면 URL 로 들어온 검색과 손으로 친 검색이
 * 다른 결과를 낸다). 대소문자를 무시하고 양끝 공백을 버린다.
 */
export function normalizeQuery(raw: string | null | undefined): string {
  return (raw ?? '').trim()
}

export function matchesQuery(
  word: { word: string; meaning: string },
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return word.word.toLowerCase().includes(q) || word.meaning.toLowerCase().includes(q)
}

// apps/web/src/lib/csat/scope.ts
//
// **기출 집합 범위 — 평가원 / 학평(학년 하나)을 고르는 유일한 곳.**
// 근거 콘솔(evidence-fold.ts)에만 있던 범위를 모든 로더·화면이 같이 쓰게 옮겼다(2026-10-01 학평 전면 적용).
//
// ── 무엇이 범위를 갖나 ─────────────────────────────────────────────────
//   · 통계(유형 리포트·유형 비중·분석 완결도·함정 지도·출제 지도) — 집합별로 따로 낸다. 섞지 않는다.
//   · 관리자 화면 — `?set=hakpyeong&grade=N` 으로 고른다(기본 평가원).
//   · 학습자 문항 목록 — 범위를 고르지 않고 「평가원 + 발행된 학평」을 함께 보여 준다(출처 필터로 가른다).
//     학습자에게 무엇이 보이는지는 DB 뷰 `csat_items_public` 이 정한다(발행된 학평만).
//
// ── 질의에 범위를 거는 법 ──────────────────────────────────────────────
// 빌더를 감싸는 헬퍼는 쓰지 않는다 — Supabase 빌더의 재귀 제네릭을 다시 풀면 Promise.all 안에서
// TS2589 가 난다(PR #123). 대신 **조건 값**을 돌려주고 호출부가 `.filter(...)`·`.eq(...)` 로 건다:
//   문항·분석  `.filter('<id 칸>', f.op, f.pattern)`   f = itemIdFilter(scope)
//   회차       `.eq('organizer', e.organizer)` (+ 학평이면 `.eq('grade', e.grade)`)   e = examFilter(scope)
//   유형 리포트 `.eq('organizer', r.organizer).eq('grade', r.grade)`   r = reportKey(scope)

import { HAKPYEONG_ID_PREFIX, type ExamOrganizer } from './exam-id'

export type CsatScope = { set: 'kice' } | { set: 'hakpyeong'; grade: 1 | 2 | 3 }
export const KICE_SCOPE: CsatScope = { set: 'kice' }
export const SCOPES: readonly CsatScope[] = [KICE_SCOPE, { set: 'hakpyeong', grade: 1 }, { set: 'hakpyeong', grade: 2 }, { set: 'hakpyeong', grade: 3 }]

type ScopeParams = URLSearchParams | Record<string, string | string[] | undefined>

/** `?set=hakpyeong&grade=N` → 범위. 학평인데 학년이 잘못되면 고3(학평의 주 대상), 그 밖은 평가원 */
export function parseScope(params: ScopeParams = {}): CsatScope {
  const get = (key: string) => {
    const v = params instanceof URLSearchParams ? params.get(key) : params[key]
    return (Array.isArray(v) ? v[0] : v) ?? ''
  }
  if (get('set') !== 'hakpyeong') return KICE_SCOPE
  const g = Number(get('grade'))
  return { set: 'hakpyeong', grade: g === 1 || g === 2 ? g : 3 }
}

/** URL 에 싣는 범위 조각 — 평가원(기본)은 싣지 않는다 */
export function scopeQuery(scope: CsatScope): string {
  return scope.set === 'kice' ? '' : `set=hakpyeong&grade=${scope.grade}`
}

/** 경로에 범위를 붙인다(이미 ? 가 있으면 &) */
export function withScope(href: string, scope: CsatScope): string {
  const q = scopeQuery(scope)
  return q ? `${href}${href.includes('?') ? '&' : '?'}${q}` : href
}

export function scopeLabel(scope: CsatScope): string {
  return scope.set === 'kice' ? '평가원' : `학평 고${scope.grade}`
}

export const sameScope = (a: CsatScope, b: CsatScope): boolean =>
  a.set === b.set && (a.set === 'kice' || (b.set === 'hakpyeong' && a.grade === b.grade))

/** 문항·분석 id 칸에 거는 조건 — 평가원은 학평 접두어 «아님», 학평은 그 학년만(`H____G3%`) */
export function itemIdFilter(scope: CsatScope): { op: 'like' | 'not.like'; pattern: string } {
  return scope.set === 'kice'
    ? { op: 'not.like', pattern: `${HAKPYEONG_ID_PREFIX}%` }
    : { op: 'like', pattern: `${HAKPYEONG_ID_PREFIX}____G${scope.grade}%` }
}

/** 회차 표에 거는 조건 */
export function examFilter(scope: CsatScope): { organizer: ExamOrganizer; grade: 1 | 2 | 3 | null } {
  return scope.set === 'kice' ? { organizer: 'kice', grade: null } : { organizer: 'edu_office', grade: scope.grade }
}

/**
 * 유형 리포트 행의 집합 열 — `csat_type_reports.organizer · grade`(키 확장은 P4). 평가원은 grade 0(전체).
 * 학평 리포트는 학년마다 따로 쌓인다(평가원 리포트를 덮지 않는다).
 */
export function reportKey(scope: CsatScope): { organizer: ExamOrganizer; grade: 0 | 1 | 2 | 3 } {
  return scope.set === 'kice' ? { organizer: 'kice', grade: 0 } : { organizer: 'edu_office', grade: scope.grade }
}

/** id 하나가 이 범위에 드는가 — 받아 온 뒤 거르는 곳(스크립트·구운 파일)용 */
export function inScope(itemOrExamId: string, scope: CsatScope): boolean {
  const f = itemIdFilter(scope)
  const prefix = f.pattern.replace(/%$/, '')
  if (f.op === 'not.like') return !itemOrExamId.startsWith(prefix)
  // `H____G3` — 밑줄은 한 글자 아무거나
  const re = new RegExp(`^${prefix.replace(/_/g, '.')}`)
  return re.test(itemOrExamId)
}

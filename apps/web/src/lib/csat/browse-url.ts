// apps/web/src/lib/csat/browse-url.ts
//
// **기출 탐구(서가) 조건 ↔ 주소.** (v3 M1 · CSAT_LEARNER_UX_V3 §1 · §2 · §7)
//
// 목적 · 유형 · 회차는 메뉴가 아니라 서가의 검색 조건이다. 고른 조건을 주소에 싣는다(새로 고침 · 뒤로가기 · 문항에서 돌아오기).
//   목적(purpose) — killer(킬러 유형만) · evidence(지도 있는 문항 = status=map) · recent(최근 학년도 = from)
//   기존 조건 — type · exam · status · from · q · kind · year · grade
// 파서는 닫힌 값만 받는다(모르는 값 · 범위 밖 숫자는 버린다). 자유 문자열은 q(40자)뿐이다.
// 문항에서 돌아올 주소는 `/csat/browse` 접두 + safeInternalPath 를 통과한 것만 쓴다(`browseReturn`).

import { safeInternalPath } from '@/lib/auth/redirect'

import type { BrowseFilter, ExamKind } from './browse-model'

export type BrowsePurpose = 'killer' | 'evidence' | 'recent'
export const BROWSE_PURPOSES: BrowsePurpose[] = ['killer', 'evidence', 'recent']

export interface BrowseParams {
  type?: string
  exam?: string
  status?: BrowseFilter['status']
  from?: number
  query?: string
  kind?: ExamKind
  year?: number
  grade?: 1 | 2 | 3
  purpose?: BrowsePurpose
}

const KINDS: ExamKind[] = ['suneung', 'mock', 'hakpyeong']
const yearOk = (n: number) => Number.isInteger(n) && n > 2000 && n < 2100
/** 유형 · 회차 id 는 영숫자 · 하이픈 · 밑줄만(실제 존재 여부는 카탈로그가 다시 본다) */
const idOk = (v: string | undefined) => (v && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : undefined)

export function parseBrowseParams(query: Record<string, string | undefined>): BrowseParams {
  const status = query.status === 'map' || query.status === 'lecture' ? query.status : undefined
  const from = Number(query.from)
  const year = Number(query.year)
  const grade = Number(query.grade)
  const purpose = BROWSE_PURPOSES.find((p) => p === query.purpose)
  const kind = KINDS.find((k) => k === query.kind)
  return {
    type: idOk(query.type),
    exam: idOk(query.exam),
    status,
    from: yearOk(from) ? from : undefined,
    query: query.q ? query.q.slice(0, 40) : undefined,
    kind,
    year: yearOk(year) ? year : undefined,
    grade: kind === 'hakpyeong' && (grade === 1 || grade === 2 || grade === 3) ? grade : undefined,
    purpose,
  }
}

/** 지금 조건 → 서가 주소(기본값은 싣지 않는다 · 키 순서 고정) */
export function browseHref(f: BrowseFilter, purpose: BrowsePurpose | null): string {
  const q = new URLSearchParams()
  if (purpose) q.set('purpose', purpose)
  if (f.type !== 'all') q.set('type', f.type)
  if ((f.exam ?? 'all') !== 'all') q.set('exam', String(f.exam))
  if (f.status !== 'all') q.set('status', f.status)
  if ((f.from ?? 'all') !== 'all') q.set('from', String(f.from))
  if (f.kind !== 'all') q.set('kind', f.kind)
  if (f.kind === 'hakpyeong' && (f.grade ?? 'all') !== 'all') q.set('grade', String(f.grade))
  if (f.year !== 'all') q.set('year', String(f.year))
  if (f.query.trim()) q.set('q', f.query.trim().slice(0, 40))
  const s = q.toString()
  return s ? `/csat/browse?${s}` : '/csat/browse'
}

/** 문항에서 서가로 돌아갈 주소 — 내부 경로 · `/csat/browse` 접두일 때만. 아니면 null */
export function browseReturn(raw: string | null | undefined): string | null {
  const p = safeInternalPath(raw)
  if (!p) return null
  return p === '/csat/browse' || p.startsWith('/csat/browse?') ? p : null
}

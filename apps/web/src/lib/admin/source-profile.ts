// apps/web/src/lib/admin/source-profile.ts
//
// **소스 한 곳의 수집 프로필 — 관리자 팝업(SourceProfileDialog)이 보여 주는 것의 형태와 판정.**
//
// 값은 전부 DB 실측이다(`/api/admin/sources/[source]/profile`). 여기에는 **숫자를 만들지 않는다** —
// 형태 · 라벨 · 「가장 먼저 볼 문제」 한 줄을 고르는 규칙만 둔다(DESIGN.md 관리자 A3: 첫 뷰포트에 막힌 단계 한 줄,
// 없으면 줄을 비운다). 표본에서 온 분포(어수·피드·소재)는 표본 크기를 함께 싣는다 — 전량처럼 읽히면 안 된다.

export const ARTICLE_STATUSES = ['ready', 'queued', 'published', 'archived', 'failed'] as const
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number]

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export const V_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const

/** DB 트리거(`acp_apply_license_gate`)가 도출하는 등급 — 2026-09-25 실측 6종. */
export const LICENSE_CLASSES = ['public_domain', 'cc0', 'cc_by', 'cc_by_sa', 'cc_by_nd', 'restricted'] as const

/** 권리 태그를 어떻게 확인했나(`csat_fit.rights.evidence` · docs/source-check/criteria.md §11). */
export const RIGHTS_EVIDENCE = ['page', 'api', 'jats', 'feed', 'collection-default', 'none'] as const

export const RETENTION_STATES = ['keep', 'hold', 'discard'] as const
export const CONTENT_VERDICTS = ['use', 'narrative', 'reject'] as const
export const ELIGIBILITY_GRADES = ['usable', 'blocked', 'unjudged', 'unknown'] as const

export type Counts<K extends string | number> = Record<K, number>

export interface SourceProfileSample {
  id: string
  title: string
  status: string
  vLevel: number | null
  cefr: string | null
  words: number | null
  createdAt: string
  derived: boolean
  url: string | null
}

export interface SourceProfile {
  source: string
  measuredAt: string
  total: number
  firstAt: string | null
  lastAt: string | null
  status: Counts<ArticleStatus>
  /** 원천 대 파생물(발췌·도입부·개작) — criteria.md §1 「파생물은 원천이 아니다」. */
  units: { originals: number; derived: number }
  audio: number
  vLevel: Counts<number> & { unknown: number }
  cefr: Counts<string> & { unknown: number }
  license: Counts<string> & { unknown: number }
  rights: { evidence: Counts<string>; untagged: number; needsResolution: number }
  retention: Counts<string> & { none: number }
  verdict: Counts<string> & { none: number }
  eligibility: Counts<string> & { uncached: number }
  /** 최근 N편 표본에서 센 분포 — `sampleSize` 를 함께 보여 준다. */
  sample: {
    size: number
    words: { p25: number | null; p50: number | null; p75: number | null }
    feeds: Array<{ key: string; count: number }>
    topics: Array<{ key: string; count: number }>
  }
  recent: SourceProfileSample[]
}

export const STATUS_LABEL: Record<ArticleStatus, string> = {
  ready: '준비', queued: '대기', published: '게시', archived: '보관함', failed: '실패',
}
export const LICENSE_LABEL: Record<string, string> = {
  public_domain: 'PD', cc0: 'CC0', cc_by: 'CC BY', cc_by_sa: 'CC BY-SA', cc_by_nd: 'CC BY-ND', restricted: '제한', unknown: '미분류',
}
export const EVIDENCE_LABEL: Record<string, string> = {
  page: '원문 페이지', api: 'API', jats: 'JATS', feed: '피드', 'collection-default': '컬렉션 기본값', none: '표기 없음',
}
export const RETENTION_LABEL: Record<string, string> = { keep: '보관', hold: '보류', discard: '폐기', none: '판정 없음' }
export const VERDICT_LABEL: Record<string, string> = { use: '사용', narrative: '서사', reject: '반려', none: '판정 없음' }
export const GRADE_LABEL: Record<string, string> = { usable: '적격', blocked: '차단', unjudged: '미판정', unknown: '분석 미완', uncached: '캐시 없음' }

export interface ProfileIssue {
  /** 정오표 행 번호(1~) — 권점이 찍힐 행. */
  row: number
  text: string
}

const pct = (x: number, n: number) => (n ? Math.round((x / n) * 100) : 0)

/**
 * **가장 먼저 볼 문제 — 순서가 곧 우선순위다.** 수집이 막힌 것 → 원천이 없는 것 → 판정이 비어 있는 것 → 권리 확인.
 * 빈 배열이면 첫 줄을 비운다(A3).
 */
export function profileIssues(p: SourceProfile): ProfileIssue[] {
  const out: ProfileIssue[] = []
  if (p.status.failed > 0) out.push({ row: 1, text: `수집 실패 ${p.status.failed.toLocaleString()}편 — 파서·원문 주소를 확인하세요` })
  if (p.total > 0 && p.units.derived / p.total >= 0.5) {
    out.push({ row: 1, text: `재고의 ${pct(p.units.derived, p.total)}% 가 파생물(조각)이다 — 원천 단위 판정에는 원천 전문이 필요합니다` })
  }
  const judged = p.retention.keep + p.retention.hold + p.retention.discard
  if (p.units.originals > 0 && judged < p.units.originals) {
    out.push({ row: 2, text: `원천 ${(p.units.originals - judged).toLocaleString()}편이 보관 판정 전이다(${pct(judged, p.units.originals)}% 판정)` })
  }
  if (p.retention.hold > 0) out.push({ row: 2, text: `보류 ${p.retention.hold.toLocaleString()}편 — 기준에 없어 갈린 자리일 수 있습니다` })
  if (p.eligibility.uncached > 0) out.push({ row: 2, text: `적격 캐시가 없는 ${p.eligibility.uncached.toLocaleString()}편 — 판정 캐시를 갱신하세요` })
  if (p.rights.needsResolution > 0) out.push({ row: 4, text: `권리 해소 필요 ${p.rights.needsResolution.toLocaleString()}편(원천별 확인 전 또는 제한 라이선스)` })
  if (p.rights.untagged > 0) out.push({ row: 4, text: `권리 태그 없는 ${p.rights.untagged.toLocaleString()}편 — 원천별 확인이 기록되지 않았다` })
  return out
}

/** 값 배열의 사분위(정렬 후 최근접 순위) — 비면 null. */
export function quartiles(values: number[]): { p25: number | null; p50: number | null; p75: number | null } {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return { p25: null, p50: null, p75: null }
  const at = (q: number) => v[Math.min(v.length - 1, Math.max(0, Math.ceil(q * v.length) - 1))]!
  return { p25: at(0.25), p50: at(0.5), p75: at(0.75) }
}

/** 표본 분포 상위 k — 나머지는 「그 밖」 하나로 합친다. */
export function topCounts(keys: Array<string | null | undefined>, k = 6): Array<{ key: string; count: number }> {
  const m = new Map<string, number>()
  for (const key of keys) m.set(key ?? '(없음)', (m.get(key ?? '(없음)') ?? 0) + 1)
  const all = [...m].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
  if (all.length <= k) return all
  const rest = all.slice(k).reduce((n, x) => n + x.count, 0)
  return [...all.slice(0, k), { key: '그 밖', count: rest }]
}

export const SOURCE_KEY = /^[a-z][a-z0-9_]{1,39}$/

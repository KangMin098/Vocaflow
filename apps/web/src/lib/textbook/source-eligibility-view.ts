// apps/web/src/lib/textbook/source-eligibility-view.ts
//
// **원문 적격 관리 화면이 읽는 것 — 기준(정본)과 최근 판정을 한 벌로 묶는다.**
//
// ── 왜 화면이 다시 계산하지 않나 ─────────────────────────────────────
// 판정은 `judgeSource`(패키지)가 하고, 재고 훑기는 `source-eligibility-scan.mjs` 가 한다.
// 화면이 세 번째로 다시 세면 **셋이 다른 답을 하는 날이 온다** — 이 저장소는 그 사고를
// 이미 겪었다(어수 창 `PASSAGE_WORDS` 가 두 벌이라 100~200 과 120~250 이 공존했다).
//
// ── 왜 스냅샷 파일인가 (그리고 그 한계) ──────────────────────────────
// 실시간 집계를 못 한다. `library_articles`(91,358행)는 본문이 1.3GB 라 어떤 조건부
// `count: 'exact'` 도 **8초 statement timeout** 에 걸린다(실측 2026-09-06 · 오류 message 는
// 빈 문자열로 온다). 커서 페이징으로 전수 훑기는 되지만 **약 130초** 걸려 화면이 매 요청마다
// 할 일이 아니다.
//
// 제대로 된 처방은 이 저장소가 이미 아는 것이다 — **matview + 주기 갱신 + RPC**
// (`textbook_shelf_stats` 가 그 방식이다). 그건 마이그레이션이라 승인이 필요하고,
// 그때까지는 **스캔이 찍은 스냅샷을 읽고 언제 잰 값인지 함께 말한다.**
// 낡은 값을 최신인 척 보이는 것이 가장 나쁘므로, 화면은 경과 일수를 항상 같이 낸다.

import {
  ELIGIBILITY_AXES,
  ELIGIBILITY_SPEC_VERSION,
  GRADE_LABEL,
  GRADE_NEXT_STEP,
  SERIES_SPINE,
  type EligibilityAxisId,
  type EligibilityGrade,
} from '@vocaflow/library-pipeline'

import snapshot from './source-eligibility-snapshot.json'

/** 스냅샷 한 칸의 집계 — 스캔이 찍은 모양 그대로. */
export interface EligibilityTallyJson {
  total: number
  byGrade: Record<EligibilityGrade, number>
  byBlockedAxis: Partial<Record<EligibilityAxisId, number>>
  composable: number
  composablePct: number
  /** 미판정 중 **드레인으로는 못 푸는 것**(미절단 원본). 옛 스냅샷에는 없다. */
  structurallyUnjudged?: number
}

export interface BandRow extends EligibilityTallyJson {
  vLevel: number | null
  /** 학령 이름 — `SERIES_SPINE` 이 정본. 사다리 밖이면 `null`. */
  schoolBand: string | null
  volumeTitle: string | null
}

export interface GradeRow {
  grade: EligibilityGrade
  label: string
  count: number
  pct: number
  nextStep: string
  /** 조판이 받아도 되는 등급인가. */
  composable: boolean
}

export interface AxisRow {
  id: EligibilityAxisId
  label: string
  question: string
  source: string
  recoverable: boolean
  /** 이 축에서 탈락한 편수. 0 이면 지금 걸리는 것이 없다는 뜻. */
  blocked: number
}

export interface SourceEligibilityPanel {
  specVersion: number
  measuredAt: string
  /** 잰 지 며칠 됐나 — **낡은 값을 최신인 척 보이지 않기 위해** 항상 낸다. */
  ageDays: number
  /** 스냅샷이 이 규격 버전으로 매겨졌는가. 다르면 화면이 다시 재라고 말한다. */
  specStale: boolean
  scope: string
  scanSeconds: number
  total: EligibilityTallyJson
  grades: GradeRow[]
  axes: AxisRow[]
  bands: BandRow[]
  blockedBySource: { source: string; count: number }[]
  /** 지금 가장 크게 막고 있는 축 — 화면 맨 위의 "다음 한 걸음". */
  topBlocker: { axis: AxisRow; grade: GradeRow } | null
  /**
   * 문항이 붙은 원문 수 — 조판 풀 밖까지 포함한 전체.
   *
   * 조판 가능 편수와 나란히 두면 격차가 드러난다: **문항은 이미 만들어졌는데
   * 그 원문이 판정을 통과하지 못한 편수**가 곧 "근거 없이 만들어진 문항" 의 분모다.
   */
  articlesWithItems: number | null
  /**
   * 미판정 중 **게이트를 돌려도 안 풀리는 것**(미절단 원본 `purpose='raw'`).
   *
   * 이 수를 숨기면 화면이 "게이트를 돌려라" 라고 말하고 관리자는 돌지 않을 배치를 돌린다.
   * 옛 스냅샷(규격 v1)에는 없어서 `null` 이 될 수 있다 — 0 으로 뭉개지 않는다.
   */
  structurallyUnjudged: number | null
}

/** 등급 표시 순서 — 좋은 것부터 나쁜 것 순. 화면이 이 순서로 읽는다. */
const GRADE_ORDER: EligibilityGrade[] = [
  'usable',
  'excerpt',
  'excerpt-blind',
  'unjudged',
  'unknown',
  'blocked',
]

const COMPOSABLE: EligibilityGrade[] = ['usable', 'excerpt']

/** 등급 → 그 등급을 만드는 탈락 축. 「가장 큰 결손」을 처방과 잇기 위해 필요하다. */
const GRADE_OF_AXIS: Partial<Record<EligibilityAxisId, EligibilityGrade>> = {
  judgement: 'unjudged',
  analysis: 'unknown',
  format: 'excerpt-blind',
  legal: 'blocked',
  safety: 'blocked',
  gate: 'blocked',
  vocabulary: 'blocked',
}

function bandMeta(v: number | null): { schoolBand: string | null; volumeTitle: string | null } {
  const rung = v == null ? undefined : SERIES_SPINE.find((r) => r.vLevels.includes(v))
  return { schoolBand: rung?.schoolBand ?? null, volumeTitle: rung?.volumeTitle ?? null }
}

/**
 * 화면 데이터를 만든다.
 *
 * @param now 경과 일수 계산 기준. 테스트가 시각을 고정할 수 있게 인자로 받는다 —
 *   `new Date()` 를 안에서 부르면 그 값을 검사할 방법이 없다.
 */
export function buildSourceEligibilityPanel(now: Date = new Date()): SourceEligibilityPanel {
  const total = snapshot.total as EligibilityTallyJson
  const measured = new Date(snapshot.measuredAt)
  const ageDays = Math.max(0, Math.floor((now.getTime() - measured.getTime()) / 86_400_000))

  const grades: GradeRow[] = GRADE_ORDER.map((grade) => {
    const count = total.byGrade[grade] ?? 0
    return {
      grade,
      label: GRADE_LABEL[grade],
      count,
      pct: total.total ? +((count / total.total) * 100).toFixed(1) : 0,
      nextStep: GRADE_NEXT_STEP[grade],
      composable: COMPOSABLE.includes(grade),
    }
  })

  const axes: AxisRow[] = ELIGIBILITY_AXES.map((a) => ({
    id: a.id,
    label: a.label,
    question: a.question,
    source: a.source,
    recoverable: a.recoverable,
    blocked: total.byBlockedAxis[a.id] ?? 0,
  }))

  const bands: BandRow[] = (snapshot.byBand as (EligibilityTallyJson & { vLevel: number | null })[]).map(
    (b) => ({ ...b, ...bandMeta(b.vLevel) })
  )

  // 가장 크게 막는 축 — **되돌릴 수 있는 것 중에서** 고른다. 되돌릴 수 없는 탈락은
  // 처방이 "빼는 것" 하나뿐이라 "다음 한 걸음" 에 놓을 것이 아니다.
  const worst = axes
    .filter((a) => a.recoverable && a.blocked > 0)
    .sort((x, y) => y.blocked - x.blocked)[0]
  const worstGrade = worst ? GRADE_OF_AXIS[worst.id] : undefined
  const topBlocker =
    worst && worstGrade
      ? { axis: worst, grade: grades.find((g) => g.grade === worstGrade)! }
      : null

  return {
    specVersion: snapshot.specVersion,
    measuredAt: snapshot.measuredAt,
    ageDays,
    specStale: snapshot.specVersion !== ELIGIBILITY_SPEC_VERSION,
    scope: snapshot.scope,
    scanSeconds: snapshot.elapsedSeconds,
    total,
    grades,
    axes,
    bands,
    blockedBySource: snapshot.blockedBySource,
    topBlocker,
    // 옛 스냅샷에는 없는 열이다 — **0 으로 채우지 않는다.** 0 으로 채우면 화면이
    // "그런 원문은 없다" 고 말하는데, 실제로는 "안 쟀다" 이다.
    articlesWithItems:
      typeof (snapshot as { articlesWithItems?: number }).articlesWithItems === 'number'
        ? (snapshot as { articlesWithItems: number }).articlesWithItems
        : null,
    structurallyUnjudged:
      typeof total.structurallyUnjudged === 'number' ? total.structurallyUnjudged : null,
  }
}

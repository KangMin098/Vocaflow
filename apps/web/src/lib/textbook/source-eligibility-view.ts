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
  FAMILY_SOURCE,
  GRADE_LABEL,
  GRADE_NEXT_STEP,
  SERIES_SPINE,
  buildSourceRequirements,
  type BandRequirements,
  type EligibilityAxisId,
  type EligibilityGrade,
} from '@vocaflow/library-pipeline'

import defectSnapshot from './extraction-defect-snapshot.json'
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
  /**
   * 이 학년이 **지문을 쓰기는 하는가.**
   *
   * ⚠️ 이 열이 없으면 화면이 거짓을 말한다. V1(초등 저학년)은 유형 셋이 전부 `no-passage`
   * (운율·낱말뜻·철자빈칸)라 **지문을 한 편도 안 쓴다.** 그런데 조판 가능 비율은 5/80 = 6.3%
   * 로 찍히고, 그것을 보면 "이 학년은 거의 다 못 쓴다" 로 읽힌다 — 그 학년에서는 애초에
   * 판단 근거가 아닌 수치다. 요건표(`SERIES_SPINE` × `itemWordSpec`)가 정본이므로 거기서 편다.
   */
  needsPassage: boolean
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
  /**
   * 연령 × 유형별 원문 요건 — **DB 를 안 본다.** 정본(`SERIES_SPINE` + `itemWordSpec`)에서
   * 바로 펴므로 스냅샷이 낡아도 이 표는 항상 지금 규격이다.
   *
   * 재고 표가 "지금 몇 편인가" 를 말한다면 이 표는 **"무엇을 갖춰야 하는가"** 를 말한다.
   * 둘이 함께 있어야 "이 지문을 왜 이 학년 이 유형에 썼나" 에 답할 수 있다.
   */
  requirements: BandRequirements[]
  /** 계열별 자의 출처 — 화면이 각주로 쓴다. */
  familySource: Record<string, string>
  /**
   * **본문이 글이 아닌 것** — 적격 판정이 통과시킨 뒤에도 남는 결함.
   *
   * 일곱 축은 「이 원문을 써도 되는가」를 묻고, 그 질문은 **본문이 온전하다는 것을 전제**한다.
   * 전제가 깨진 경우는 축이 못 잡는다 — 장르는 설명문이 맞고, 저작권도 맞고, 어수도 맞는데
   * 본문 첫 문단이 `You are using an outdated browser…` 이거나 초록이 두 번 들어 있다.
   * 그대로 조판하면 **그 문자열이 학생이 읽는 지문에 인쇄된다.**
   *
   * 그래서 적격과 **따로** 잰다(`scripts/textbook/extraction-defect-scan.mjs`).
   */
  defects: DefectPanel
}

/** 결함 한 갈래. */
export interface DefectRow {
  id: string
  label: string
  why: string
  count: number
  pct: number
  /** 가장 많은 원천과 그 몫 — **비율만 말하면 오해를 부른다**(아래 `concentrated` 참조). */
  topSource: { source: string; count: number; share: number } | null
  bySource: { source: string; count: number }[]
  /**
   * 한 원천이 이 결함의 80% 이상을 차지하는가.
   *
   * 실측 2026-09-06: 「문단 통째 중복」이 전체의 59.4% 로 나왔는데 12,917건 중
   * **12,878건(99.7%)이 plos 하나**였고 모양도 하나였다(초록이 두 번). 전체 비율로 읽으면
   * "본문 절반이 깨졌다" 가 되지만 사실은 "한 원천의 수확기가 한 군데서 겹쳐 붙인다" 이다.
   * 처방이 완전히 다르므로 화면이 이 사실을 스스로 말해야 한다.
   */
  concentrated: boolean
  samples: { title: string; source: string; evidence: string }[]
}

export interface DefectPanel {
  measuredAt: string
  ageDays: number
  scope: string
  scanned: number
  /** 결함이 하나라도 걸린 편수. */
  defective: number
  defectivePct: number
  rules: DefectRow[]
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

  // ⚠️ **미판정이 전부 구조적이면 처방이 뒤집힌다.**
  // `GRADE_NEXT_STEP.unjudged` 는 「게이트 드레인을 돌려라」인데, 미절단 원본(`purpose='raw'`)은
  // 게이트가 판정하지 않는다(`PURPOSE_RULE.raw.verdicts` 가 빈 집합). 2026-09-06 기사 5,245편을
  // 전부 판정하고 나니 남은 미판정 13,459편이 **전부** 그것이 되었고, 그 상태에서 화면이
  // 시키는 대로 드레인을 돌리면 **0권**이 나온다. 처방을 여기서 갈라 둔다 —
  // 콜아웃과 등급표가 같은 문자열을 읽으므로 한 곳만 고치면 둘 다 맞는다.
  const structural = typeof total.structurallyUnjudged === 'number' ? total.structurallyUnjudged : null
  const allUnjudgedAreStructural =
    structural != null && (total.byGrade.unjudged ?? 0) > 0 && structural >= (total.byGrade.unjudged ?? 0)

  const grades: GradeRow[] = GRADE_ORDER.map((grade) => {
    const count = total.byGrade[grade] ?? 0
    return {
      grade,
      label: GRADE_LABEL[grade],
      count,
      pct: total.total ? +((count / total.total) * 100).toFixed(1) : 0,
      nextStep:
        grade === 'unjudged' && allUnjudgedAreStructural
          ? '전부 미절단 원본이라 게이트로는 안 풀린다 — 발췌 경로(scripts/csat/plos-extract)로 가야 한다'
          : GRADE_NEXT_STEP[grade],
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

  // **지문을 쓰는 학년인지**는 요건표에서 편다 — 재고가 아니라 규격이 정하는 것이다.
  const requirements = buildSourceRequirements()
  const passageBands = new Set(
    requirements.filter((r) => r.types.some((t) => t.family !== 'no-passage')).map((r) => r.vLevel),
  )
  const bands: BandRow[] = (snapshot.byBand as (EligibilityTallyJson & { vLevel: number | null })[]).map(
    (b) => ({
      ...b,
      ...bandMeta(b.vLevel),
      // 사다리 밖(V8+ · V 없음)은 요건표에 없다 — 요건을 모르는 것을 "안 쓴다" 로 뭉개면
      // 화면이 없는 근거를 지어낸다. 모르면 「쓴다」 쪽으로 두어 수치를 그대로 보인다.
      needsPassage: b.vLevel == null ? true : !requirements.some((r) => r.vLevel === b.vLevel) || passageBands.has(b.vLevel),
    }),
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
    // 스냅샷과 무관하다 — 정본에서 바로 편다. 재고가 낡아도 **요건은 늘 지금 규격**이다.
    requirements,
    familySource: FAMILY_SOURCE,
    defects: buildDefectPanel(now),
  }
}

/**
 * 추출 결함 스냅샷을 화면 모양으로 편다.
 *
 * 적격 판정과 **다른 스캔**이라 잰 시각도 따로다 — 둘을 한 시각으로 뭉개면 하나가 낡았을 때
 * 화면이 그것을 숨긴다.
 */
function buildDefectPanel(now: Date): DefectPanel {
  const measured = new Date(defectSnapshot.measuredAt)
  const scanned = defectSnapshot.scanned
  const rules: DefectRow[] = defectSnapshot.rules.map((r) => {
    const top = r.bySource[0] ?? null
    return {
      id: r.id,
      label: r.label,
      why: r.why,
      count: r.count,
      pct: scanned ? +((r.count / scanned) * 100).toFixed(1) : 0,
      topSource: top ? { ...top, share: r.count ? +((top.count / r.count) * 100).toFixed(1) : 0 } : null,
      bySource: r.bySource,
      // 20건 미만은 한 원천에 몰려 있어도 그것이 뜻을 갖지 않는다 — 표본이 작다.
      concentrated: r.count >= 20 && !!top && top.count / r.count >= 0.8,
      samples: r.samples,
    }
  })
  return {
    measuredAt: defectSnapshot.measuredAt,
    ageDays: Math.max(0, Math.floor((now.getTime() - measured.getTime()) / 86_400_000)),
    scope: defectSnapshot.scope,
    scanned,
    defective: defectSnapshot.defective,
    defectivePct: scanned ? +((defectSnapshot.defective / scanned) * 100).toFixed(1) : 0,
    rules: rules.sort((a, b) => b.count - a.count),
  }
}

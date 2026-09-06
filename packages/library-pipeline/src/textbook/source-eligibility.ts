// packages/library-pipeline/src/textbook/source-eligibility.ts
//
// **교재에 실을 수 있는 원문인가 — 그 판정의 정본.**
//
// ── 왜 이 파일이 필요한가 ────────────────────────────────────────────
// 자는 이미 다 있었다. 문제는 **흩어져 있어서 아무 데서도 한 번에 물어볼 수 없었다**는 것이다:
//
//   법적 안전   `license_class` · `display_only` · `copyright_safe_in_kr`  (컬럼)
//   게시 게이트  `csat_fit.gate.publishable` · `blockedBy`                 (scripts/csat/gate-rules.mjs)
//   학령        `article_v_level` · `READING_LEVEL_BANDS`                  (readability.ts)
//   어휘        `CURRICULUM_GATE` 시중 p90                                 (curriculum.ts)
//   규격        어수창 100~200                                             (readability.ts)
//   발췌        문항 보유(`csat_dcp_items.ref_id`) — 잘린 지문이 이미 있는가    (store-new-types)
//   안전        철회 논문 제목 · 민감 소재                                  (csat-format.ts)
//
// 그래서 조판기(`scripts/textbook/volume-pool.mjs`)는 이 중 **일부만** 보고 원문을 고른다
// (`status` · `display_only` · 제목 두 가지). 실측 2026-09-06: 게이트가 「게시 불가」로
// 판정해 둔 PLOS 논문 전문 **13,515편이 조판 풀에 그대로 있고, 저장된 문항의 83%가
// 거기서 나왔다.** 게이트와 조판이 서로 다른 열을 보고 있었던 것이다.
//
// 이 파일은 **새 기준을 만들지 않는다.** 이미 재서 정한 자들을 한 판정으로 모으고,
// 통과/탈락과 **그 사유를 숫자로** 돌려준다. 사유가 없으면 다시 만들 수가 없다.
//
// ── 등급이 여섯인 이유 ───────────────────────────────────────────────
// "쓸 수 있다/없다" 둘로 가르면 **고칠 수 있는 것과 못 고치는 것이 한 칸에 뭉친다.**
// 어수가 넘치는 글(자르면 된다)과 저작권이 막힌 글(영영 못 쓴다)은 처방이 정반대다.
// 그래서 등급은 **다음에 무엇을 해야 하는가**로 가른다.
//
// ⚠️ `unjudged`(내용 판정 미실시)를 `usable` 로 세지 않는다. 규칙만 통과한 행은
//   "괜찮다고 확인한 것"이 아니라 **아직 안 읽어 본 것**이다. 실측 2026-09-06:
//   전체 91,358편 중 57,420편이 그 상태이고, 초·중 재고 달성률 106.8% 안에도
//   2,957편(30%)이 들어 있었다. 세는 규칙이 관대한 것은 수확을 멈추지 않으려는
//   의도였고 그 자체는 옳지만, **교재에 실을 것을 고르는 자리에서는 아니다.**

import { hasSensitiveTopic } from './csat-format'
import { CURRICULUM_GATE, type SchoolLevel } from './curriculum'
import { PASSAGE_WORDS, READING_LEVEL_BANDS } from './readability'

/** 판정 규격 버전. 자가 바뀌면 올린다 — 적재된 판정이 어느 자로 매겨졌는지 알아야 한다. */
export const ELIGIBILITY_SPEC_VERSION = 2

/**
 * 등급 — **다음에 할 일**로 가른다.
 *
 * | 등급 | 뜻 | 다음에 할 일 |
 * |---|---|---|
 * | `usable` | 그대로 지문이 된다 | 없음 — 조판에 넣는다 |
 * | `excerpt` | 길지만 **규격에 맞게 잘린 지문이 있다** | 조판이 그 문항을 인쇄한다 |
 * | `excerpt-blind` | 길고 **잘린 지문이 없다** | 문항을 만든다(`store-new-types`) |
 * | `unjudged` | 내용 판정을 안 받았다 | 게이트(`gate-make` → `gate-import`)를 돌린다 |
 * | `unknown` | 학령 분석이 없다 | `process-queue` 를 돌린다 |
 * | `blocked` | 못 쓴다 | 없음 — 조판에서 뺀다 |
 */
export type EligibilityGrade =
  | 'usable'
  | 'excerpt'
  | 'excerpt-blind'
  | 'unjudged'
  | 'unknown'
  | 'blocked'

/** **조판이 받아도 되는 등급.** 이 둘만이다 — 나머지는 "지금은 쓸 수 없다". */
export const COMPOSABLE_GRADES: readonly EligibilityGrade[] = ['usable', 'excerpt'] as const

export function isComposable(grade: EligibilityGrade): boolean {
  return COMPOSABLE_GRADES.includes(grade)
}

/** 축 — 판정이 무엇을 봤는지. 화면이 이 순서로 보인다. */
export type EligibilityAxisId =
  | 'legal'
  | 'safety'
  | 'gate'
  | 'analysis'
  | 'judgement'
  | 'format'
  | 'vocabulary'

export interface EligibilityAxis {
  id: EligibilityAxisId
  label: string
  /** 이 축이 무엇을 묻는가 — 화면이 그대로 보인다. */
  question: string
  /** 자의 출처. **짐작으로 정한 값이 하나도 없다는 것을 보이려고** 적는다. */
  source: string
  /** 탈락이 되돌릴 수 있는가. `false` 면 그 원문은 영영 못 쓴다. */
  recoverable: boolean
}

/**
 * 일곱 축 — **순서가 곧 판정 순서**다.
 *
 * 되돌릴 수 없는 것(법적·안전)을 먼저 본다. 그래야 "고치면 되는 문제"와
 * "고칠 수 없는 문제"가 사유에 섞이지 않는다.
 */
export const ELIGIBILITY_AXES: readonly EligibilityAxis[] = [
  {
    id: 'legal',
    label: '법적 안전',
    question: '재배포·파생이 라이선스 안에서 허용되는가',
    source: 'license_class · display_only · copyright_safe_in_kr (수집 시 소스별 확인)',
    recoverable: false,
  },
  {
    id: 'safety',
    label: '게재 안전',
    question: '철회된 연구이거나 교재에 실을 수 없는 소재인가',
    source: 'isRetractedTitle · hasSensitiveTopic (제목 축 — 본문 축은 조판이 따로 본다)',
    recoverable: false,
  },
  {
    id: 'gate',
    label: '게시 게이트',
    question: '용도별 게이트가 게시 가능으로 판정했는가',
    source: 'scripts/csat/gate-rules.mjs — 용도 4종 · 차단 21종',
    recoverable: true,
  },
  {
    id: 'analysis',
    label: '학령 분석',
    question: '학령·어수·문체·구문이 측정돼 있는가',
    source: 'scripts/acp/process-queue.mjs — article_v_level · CEFR · register · syntax_score',
    recoverable: true,
  },
  {
    id: 'judgement',
    label: '내용 판정',
    question: '사람이나 LLM 이 실제로 읽고 장르를 판정했는가',
    source: 'csat_fit.gate.verdict — 규칙만 본 행은 미판정으로 센다',
    recoverable: true,
  },
  {
    id: 'format',
    label: '지문 규격',
    question: `그대로 지문이 되는가 — 어수 ${PASSAGE_WORDS.min}~${PASSAGE_WORDS.max}어, 아니면 잘린 지문이 있는가`,
    source:
      'readability.PASSAGE_WORDS (시중 79종 실측) + csat_dcp_items 문항 보유 — ' +
      '긴 글은 문항 생성 시 itemWordSpec(유형·학년별 시중 창)을 통과해 잘린다',
    recoverable: true,
  },
  {
    id: 'vocabulary',
    label: '어휘 난도',
    question: '교육과정 밖 비율이 그 학교급 시중 분포 안인가',
    source: `curriculum.CURRICULUM_GATE — 시중 p90 (초등 ${CURRICULUM_GATE.elementary.maxOutsidePct}% · 중등 ${CURRICULUM_GATE.middle.maxOutsidePct}%)`,
    recoverable: true,
  },
] as const

export interface AxisVerdict {
  axis: EligibilityAxisId
  /** `null` = 잴 재료가 없어 **판정하지 않았다**. 통과와 구분한다. */
  pass: boolean | null
  /** 사람이 읽을 사유. 통과면 무엇으로 통과했는지, 탈락이면 무엇이 걸렸는지. */
  detail: string
}

/**
 * 판정 입력 — **DB 행에서 뽑은 값 그대로**. 이 모듈은 DB 를 모른다.
 *
 * 값이 없으면 `null` 을 준다. `undefined` 와 구분하지 않는다 —
 * "안 실었다" 와 "비어 있다" 를 가르는 것은 부르는 쪽 몫이 아니다.
 */
export interface SourceEligibilityInput {
  title: string | null
  status: string | null
  articleVLevel: number | null
  wordCount: number | null
  register: string | null
  cefrLevel: string | null
  syntaxScore: number | null
  displayOnly: boolean | null
  licenseClass: string | null
  copyrightSafeInKr: boolean | null
  /** `csat_fit.gate.publishable` */
  gatePublishable: boolean | null
  /** `csat_fit.gate.blockedBy` */
  gateBlockedBy: string | null
  /** `csat_fit.gate.verdict` — `null` 이면 내용 판정을 안 받았다. */
  gateVerdict: string | null
  /** `csat_fit.gate.purpose` */
  gatePurpose: string | null
  /**
   * `csat_fit.make.windows` 개수 — 긴 글에서 지문으로 자를 자리.
   *
   * ⚠️ **이 열을 읽는 코드가 저장소에 하나도 없다**(실측 2026-09-06: `score-articles` 가 쓰고
   *   아무도 안 읽는다). 그래서 이것 하나로 「자를 수 있다」를 판정하면 안 된다 —
   *   조판이 실제로 인쇄하는 것은 **문항에 저장된 지문**이고, 그것이 `hasItems` 다.
   *   보조 신호로만 쓴다.
   */
  excerptWindows: number | null
  /**
   * 이 원문에 **문항이 붙어 있는가** (`csat_dcp_items.ref_id`).
   *
   * 긴 글이 교재에 실리는 실제 경로다 — 문항 생성기(`store-new-types`)가 문단을 잘라
   * `passage_text` 로 저장하고, 그 지문은 그때 **유형·학년별 시중 어수창**(`itemWordSpec`)을
   * 통과한다. 조판(`composeUnits`)은 그 문항을 골라 인쇄한다.
   *
   * 즉 문항이 붙었다는 것은 **이미 규격에 맞게 잘린 지문이 존재한다**는 뜻이다.
   * `null` 이면 못 쟀다는 뜻이고, 통과로 세지 않는다.
   */
  hasItems?: boolean | null
  /** 교육과정 밖 % — 본문을 재야 나온다. 없으면 `null`(미측정). */
  outsidePct?: number | null
}

export interface SourceEligibility {
  grade: EligibilityGrade
  /** 탈락 축. 통과면 `null`. */
  blockedBy: EligibilityAxisId | null
  /** 한 줄 사유 — 화면과 로그가 그대로 쓴다. */
  reason: string
  /** 되돌릴 수 있는 탈락인가. `blocked` 중에서도 법적/안전은 `false`. */
  recoverable: boolean
  axes: AxisVerdict[]
  specVersion: number
}

/** 파생·문항 제작이 허용되는 라이선스. 그 밖은 읽기 전용이거나 불가다. */
const DERIVABLE_LICENSE = new Set(['public_domain', 'cc0', 'cc_by', 'cc_by_sa'])

/**
 * 철회 논문 — 제목에서 막는 수밖에 없다.
 *
 * 지문 자체는 멀쩡히 읽히므로 자동 검수로는 절대 안 걸린다. 실측 2026-08-31:
 * 재고에 `RETRACTED:` 로 시작하는 원글이 16편 있었고 그중 10편에 이미 문항 268개가
 * 붙어 있었다(한 편은 120개).
 *
 * ⚠️ `volume-pool.mjs` 에 같은 판정이 있다. 여기로 옮기지 않고 **둔 채로 둔다** —
 *   돌고 있는 조판을 깨는 값이 중복을 없애는 값보다 크다. 대신 두 곳이 같은 정규식을
 *   쓰는지 회귀가 지킨다(`source-eligibility.test.ts`).
 */
const RETRACTED = /^\s*(RETRACTED|WITHDRAWN|EXPRESSION OF CONCERN)\b/i

function isRetracted(title: string | null): boolean {
  return !!title && RETRACTED.test(title)
}

/** V-Level → 학교급. 어휘 문턱이 학교급마다 다르므로 이 매핑이 필요하다. */
export function schoolOfVLevel(v: number | null): SchoolLevel | null {
  if (v == null) return null
  if (v <= 2) return 'elementary'
  if (v <= 4) return 'middle'
  return null // 고등은 교육과정 3,000 밖 비율 자를 쓰지 않는다 — 시중 분포를 안 쟀다
}

/**
 * 이 원문을 교재에 실을 수 있는가.
 *
 * **순서가 있다.** 되돌릴 수 없는 것부터 본다 — 법적 → 안전 → 게이트 → 분석 →
 * 내용 판정 → 규격 → 어휘. 앞에서 막히면 뒤는 재지 않는다(잴 필요가 없고,
 * 재면 "왜 떨어졌나" 에 사유가 여럿 붙어 처방이 흐려진다).
 */
export function judgeSource(row: SourceEligibilityInput): SourceEligibility {
  const axes: AxisVerdict[] = []
  const done = (
    grade: EligibilityGrade,
    blockedBy: EligibilityAxisId | null,
    reason: string,
    recoverable: boolean
  ): SourceEligibility => ({ grade, blockedBy, reason, recoverable, axes, specVersion: ELIGIBILITY_SPEC_VERSION })

  // ── ① 법적 ────────────────────────────────────────────────────────
  if (row.displayOnly === true) {
    axes.push({ axis: 'legal', pass: false, detail: '표시 전용 — 파생·문항 불가' })
    return done('blocked', 'legal', '표시 전용(display_only) — 문항을 만들 수 없다', false)
  }
  if (row.copyrightSafeInKr === false) {
    axes.push({ axis: 'legal', pass: false, detail: '국내 이용 불가로 표시됨' })
    return done('blocked', 'legal', '국내 저작권 불가(copyright_safe_in_kr=false)', false)
  }
  if (row.licenseClass && !DERIVABLE_LICENSE.has(row.licenseClass)) {
    axes.push({ axis: 'legal', pass: false, detail: `${row.licenseClass} — 파생 불허` })
    return done('blocked', 'legal', `라이선스 ${row.licenseClass} 는 파생을 허용하지 않는다`, false)
  }
  axes.push({
    axis: 'legal',
    pass: true,
    detail: row.licenseClass ? `${row.licenseClass} — 파생 허용` : '라이선스 미기재(수집 시 확인분)',
  })

  // ── ② 안전 ────────────────────────────────────────────────────────
  if (isRetracted(row.title)) {
    axes.push({ axis: 'safety', pass: false, detail: '철회된 연구' })
    return done('blocked', 'safety', '철회된 연구 — 지문으로 실으면 교재 신뢰가 깎인다', false)
  }
  if (row.title && hasSensitiveTopic(row.title)) {
    axes.push({ axis: 'safety', pass: false, detail: '제목에 드러난 민감 소재' })
    return done('blocked', 'safety', '민감 소재 — 출처 줄이 문항마다 인쇄된다', false)
  }
  axes.push({ axis: 'safety', pass: true, detail: '철회·민감 소재 아님(제목 축)' })

  // ── ③ 게시 게이트 ──────────────────────────────────────────────────
  // ⚠️ `oversize-raw` 는 **차단이 아니라 갈래**다. "자르기 전에는 게시 불가" 라는 뜻이지
  //   "못 쓴다" 가 아니다 — 자를 자리가 적혀 있으면 조판이 쓸 수 있다.
  //   이 구분이 없으면 PLOS 논문 전문 36,337편이 통째로 blocked 가 되고,
  //   지금 저장된 문항의 83%가 근거 없이 만들어진 것이 되어 버린다.
  const rawOversize = row.gateBlockedBy === 'oversize-raw' || row.gatePurpose === 'raw'
  if (row.gatePublishable === false && !rawOversize) {
    const why = row.gateBlockedBy ?? '사유 미기재'
    axes.push({ axis: 'gate', pass: false, detail: `차단 ${why}` })
    return done('blocked', 'gate', `게시 게이트 차단 — ${why}`, true)
  }
  axes.push({
    axis: 'gate',
    pass: true,
    detail: rawOversize ? '미절단 원본 — 자르면 쓸 수 있다' : `게시 가능${row.gateBlockedBy ? ` (${row.gateBlockedBy} 해제됨)` : ''}`,
  })

  // ── ④ 학령 분석 ────────────────────────────────────────────────────
  const missing: string[] = []
  if (row.articleVLevel == null) missing.push('V-Level')
  if (row.wordCount == null) missing.push('어수')
  if (!row.register) missing.push('문체')
  if (!row.cefrLevel) missing.push('CEFR')
  if (row.syntaxScore == null) missing.push('구문')
  if (missing.length) {
    axes.push({ axis: 'analysis', pass: false, detail: `없음: ${missing.join(' · ')}` })
    return done('unknown', 'analysis', `학령 분석 미완 — ${missing.join(' · ')}`, true)
  }
  axes.push({
    axis: 'analysis',
    pass: true,
    detail: `V${row.articleVLevel} · ${row.wordCount}어 · ${row.register} · ${row.cefrLevel}`,
  })

  // ── ⑤ 내용 판정 ────────────────────────────────────────────────────
  if (!row.gateVerdict) {
    // ⚠️ **미절단 원본은 게이트를 돌려도 판정이 안 붙는다.** `gate-rules.mjs` 의
    //   `PURPOSE_RULE.raw.verdicts` 가 빈 집합이라 `decide()` 가 판정 전에 되돌아온다
    //   ("자르기 전에는 무엇도 게시 불가"). 실측 2026-09-06: `purpose='raw'` 36,337편이
    //   **전부** 판정자 `rule` · verdict 없음이다. 그러니 이 행들에 "게이트를 돌려라" 라고
    //   말하면 관리자가 돌지 않을 배치를 돌린다 — **처방이 다르다.** 발췌 경로로 가야 한다.
    if (row.gatePurpose === 'raw') {
      axes.push({ axis: 'judgement', pass: false, detail: '미절단 원본 — 게이트가 판정하지 않는다' })
      return done(
        'unjudged',
        'judgement',
        '미절단 원본(purpose=raw) — 게이트를 돌려도 판정이 안 붙는다. 발췌 경로(plos-extract)로 가야 한다',
        true
      )
    }
    axes.push({ axis: 'judgement', pass: false, detail: '규칙만 통과 — 장르 판정 없음' })
    return done('unjudged', 'judgement', '내용 판정 미실시 — 아직 아무도 읽지 않았다', true)
  }
  axes.push({ axis: 'judgement', pass: true, detail: `판정 ${row.gateVerdict}` })

  // ── ⑥ 규격 ────────────────────────────────────────────────────────
  const words = row.wordCount ?? 0
  if (words < PASSAGE_WORDS.min) {
    axes.push({ axis: 'format', pass: false, detail: `${words}어 — 창 하한 ${PASSAGE_WORDS.min} 미만` })
    // 짧은 글은 자를 수도 이을 수도 없다. 되돌릴 수는 있다(다시 수확하면 된다).
    return done('blocked', 'format', `${words}어 — 지문으로 쓰기에 짧다`, true)
  }
  if (words > PASSAGE_WORDS.max) {
    // ⚠️ **순서가 중요하다.** 문항 보유를 먼저 본다 — 그것이 조판이 실제로 인쇄하는 것이고,
    //   그 지문은 만들 때 유형·학년별 시중 어수창(`itemWordSpec`)을 이미 통과했다.
    //   `make.windows` 는 아무도 안 읽는 열이라 **혼자서는 근거가 못 된다.**
    if (row.hasItems === true) {
      axes.push({ axis: 'format', pass: true, detail: `${words}어 — 규격에 맞게 잘린 문항 보유` })
      return done('excerpt', null, `${words}어 · 문항이 붙어 있다 — 잘린 지문이 이미 있다`, true)
    }
    const w = row.excerptWindows ?? 0
    if (w > 0) {
      axes.push({ axis: 'format', pass: true, detail: `${words}어 — 발췌창 ${w}개(문항 없음)` })
      return done('excerpt', null, `${words}어 · 발췌창 ${w}개 — 자를 자리는 적혀 있다`, true)
    }
    axes.push({ axis: 'format', pass: false, detail: `${words}어 — 잘린 지문도 자를 자리도 없다` })
    return done(
      'excerpt-blind',
      'format',
      `${words}어인데 문항도 발췌창도 없다 — 어디를 자를지 아무도 정하지 않았다`,
      true
    )
  }
  axes.push({ axis: 'format', pass: true, detail: `${words}어 — 창 안` })

  // ── ⑦ 어휘 ────────────────────────────────────────────────────────
  // 본문을 재야 나오는 값이라 대개 없다. **없으면 통과가 아니라 미측정으로 적는다.**
  const school = schoolOfVLevel(row.articleVLevel)
  if (row.outsidePct == null || school == null) {
    axes.push({
      axis: 'vocabulary',
      pass: null,
      detail: school == null ? '고등 밴드 — 시중 어휘 분포 미측정' : '밖% 미측정',
    })
    return done('usable', null, '규격 안 — 어휘 축은 미측정', true)
  }
  const max = CURRICULUM_GATE[school].maxOutsidePct
  if (row.outsidePct > max) {
    axes.push({ axis: 'vocabulary', pass: false, detail: `밖 ${row.outsidePct}% > 시중 p90 ${max}%` })
    return done('blocked', 'vocabulary', `교육과정 밖 ${row.outsidePct}% — 그 학년이 못 읽는다`, true)
  }
  axes.push({ axis: 'vocabulary', pass: true, detail: `밖 ${row.outsidePct}% ≤ 시중 p90 ${max}%` })
  return done('usable', null, '일곱 축 전부 통과', true)
}

/** 등급 표기 — 화면·CLI 가 같은 말을 쓰게 한다. */
export const GRADE_LABEL: Record<EligibilityGrade, string> = {
  usable: '그대로 사용',
  excerpt: '발췌해 사용',
  'excerpt-blind': '발췌 자리 없음',
  unjudged: '내용 판정 없음',
  unknown: '분석 없음',
  blocked: '사용 불가',
}

/** 등급별 다음 한 걸음 — 빈 상태에 처방이 없으면 화면이 막다른 곳이 된다. */
export const GRADE_NEXT_STEP: Record<EligibilityGrade, string> = {
  usable: '조판에 넣는다',
  excerpt: '조판이 그 문항을 인쇄한다',
  'excerpt-blind': 'scripts/textbook/store-new-types.mjs 로 문항을 만든다 — 그때 규격에 맞게 잘린다',
  unjudged: 'scripts/csat/gate-make.mjs → gate-import.mjs 로 내용을 판정한다',
  unknown: 'scripts/acp/process-queue.mjs 로 학령 분석을 붙인다',
  blocked: '조판에서 뺀다 — 되돌릴 수 있는 사유면 그 축을 고친다',
}

export interface EligibilityTally {
  total: number
  byGrade: Record<EligibilityGrade, number>
  byBlockedAxis: Partial<Record<EligibilityAxisId, number>>
  /** 조판이 받아도 되는 편수. */
  composable: number
  /** 조판 가능 비율 % (소수 한 자리). */
  composablePct: number
  /**
   * 미판정 중 **드레인으로는 못 푸는 것** — 미절단 원본(`purpose='raw'`).
   *
   * 게이트를 아무리 돌려도 판정이 안 붙는다(`PURPOSE_RULE.raw.verdicts` 가 빈 집합).
   * 이 수를 따로 내지 않으면 화면이 "게이트를 돌려라" 라고 말하고, 관리자는
   * **돌지 않을 배치를 돌린다.**
   */
  structurallyUnjudged: number
}

const EMPTY_BY_GRADE = (): Record<EligibilityGrade, number> => ({
  usable: 0,
  excerpt: 0,
  'excerpt-blind': 0,
  unjudged: 0,
  unknown: 0,
  blocked: 0,
})

/** 판정 결과를 센다 — 스크립트와 화면이 같은 집계를 쓰도록 여기서만 정한다. */
export function tallyEligibility(rows: readonly SourceEligibility[]): EligibilityTally {
  const byGrade = EMPTY_BY_GRADE()
  const byBlockedAxis: Partial<Record<EligibilityAxisId, number>> = {}
  let structurallyUnjudged = 0
  for (const r of rows) {
    byGrade[r.grade] += 1
    if (r.blockedBy) byBlockedAxis[r.blockedBy] = (byBlockedAxis[r.blockedBy] ?? 0) + 1
    // 사유 문자열로 세지 않는다 — 사유는 사람이 읽는 글이라 바뀐다. 축 + 등급 + 표지로 센다.
    if (r.grade === 'unjudged' && r.axes.some((a) => a.axis === 'judgement' && a.detail.startsWith('미절단 원본'))) {
      structurallyUnjudged += 1
    }
  }
  const composable = byGrade.usable + byGrade.excerpt
  return {
    total: rows.length,
    byGrade,
    byBlockedAxis,
    composable,
    composablePct: rows.length ? +((composable / rows.length) * 100).toFixed(1) : 0,
    structurallyUnjudged,
  }
}

/** 밴드 목록 — 화면이 학령 순서를 여기서 받는다(정본은 `READING_LEVEL_BANDS`). */
export const ELIGIBILITY_BAND_LABELS = READING_LEVEL_BANDS.map((b) => b.id)

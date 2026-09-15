// apps/web/src/lib/csat/evidence-fold.ts
//
// **기출 원천 콘솔의 계산 정본 — 문항 집합 하나를 축으로 접는 순수 함수들.**
//
// ── 왜 탭도 렌즈 목록도 아닌가 ────────────────────────────────────────
// 이 화면은 같은 802문항을 회차·유형·함정·절차·어휘·난이도·연도·결함 여덟 각도에서 본다.
// 각도마다 표를 하나씩 두면(탭 4장이 그랬다) **두 각도를 겹칠 방법이 없다** — 「2025학년도의
// R-BLANK 중 지문이 잘린 것」을 물으려면 표 세 장을 눈으로 대조해야 한다. 각도를 화면으로
// 만들면 조합 수만큼 화면이 필요하고(8축이면 교차 28), 그건 만들 수 없다.
//
// 그래서 **각도를 값으로 내린다.** 행 축과 열 축을 고르는 드롭다운 둘이면 64 조합이 한 화면에서
// 나오고, 화면 수는 1로 고정된다. 「렌즈를 왼쪽에 세로로 세우는」 안은 **탭을 90° 돌린 것**이라
// 같은 결함을 갖는다 — 여전히 한 번에 한 축이다.
//
// ── 합산 무결성을 테스트가 아니라 화면이 증명한다 ──────────────────
// 어느 축으로 접어도 **서로 다른 문항 수의 합은 802**여야 한다. 이 파일은 그래서 칸마다
// 숫자를 세지 않고 **문항 id 집합**을 들고 있다가 마지막에 크기를 잰다. 한 문항이 여러 칸에
// 들어가는 축(함정·결함)에서도 총합이 부풀지 않는 이유가 그것이다 — 그런 축은 칸 합(`cellSum`)과
// 서로 다른 문항 수(`grand`)를 **둘 다** 내고, 화면이 둘을 나란히 적는다.
//
// ⚠️ **평가원 지문 원문은 이 파일에 들어오지 않는다.** 인용이 지문에 실제로 있는지는 서버가
//    판정해 `EvidenceItem.quoteLocated` 불리언 하나로 넘긴다. 원문은 서버 밖으로 안 나간다.

import { detectAnalystMeta, foldTrapFamilies, type TrapFamily } from './guide-fold'

export type { TrapFamily } from './guide-fold'

// ── 결함 ────────────────────────────────────────────────────────────────

/**
 * 「채워졌다」와 「쓸 수 있다」는 다르다.
 *
 * 문항 서술은 802/802 가 채워져 있다(실측 2026-09-15 — 빈 항목 0). 그런데 그중 703문항이
 * 아래 결함 중 최소 하나에 걸려 하류 공정이 **그대로 가져갈 수 없다.** 옛 콘솔은 앞의 사실만
 * 세고 뒤의 사실을 한 자리도 세지 않아, 초록 눈금 넉 장을 띄운 채로 막혀 있었다.
 */
export type DefectCode = 'body' | 'quote' | 'scoring' | 'answerKey' | 'reportText' | 'reportCount'

export interface DefectDef {
  code: DefectCode
  /** 화면에 그대로 쓰는 이름. */
  label: string
  /** 이 결함이 막는 하류 공정 — 왜 고쳐야 하는지가 여기 있다. */
  blocks: string
  /** 라벨이 말하지 않는 것: 무엇이 어긋났나. */
  why: string
  /**
   * 이 결함이 막는 **가장 이른 공정**의 번호(①~⑧, 학습자 쪽은 9).
   *
   * 고치는 순서가 여기서 나온다 — 이른 공정을 막는 결함일수록 그 뒤 판단 전부를 오염시킨다.
   * 배점이 어긋나면 커버리지 숫자가 틀리고, 틀린 커버리지 위에서 고른 다음 드레인은 헛일이다.
   */
  stageOrd: number
  /** 이걸 고치려면 무엇을 돌리나. 라벨이 말하지 않는 「다음 한 걸음」. */
  fix: string
}

export const DEFECTS: readonly DefectDef[] = [
  {
    code: 'body',
    label: '지문 잘림',
    blocks: '④소재 · ⑥해설',
    why: '단 나누기가 깨져 지문 일부만 적재됐다. 그 위에 선 분석은 안 잘린 부분만 보고 쓴 것이다',
    stageOrd: 4,
    fix: '추출기를 고쳐 코퍼스를 다시 만든 뒤, 지문이 바뀐 문항을 `analysis-drain-export.mjs --redo` 로 지목해 다시 분석한다',
  },
  {
    code: 'quote',
    label: '인용 미정착',
    blocks: '⑥해설(오버레이 좌표)',
    why: '분석이 근거로 든 문장을 지문에서 찾을 수 없다 — 좌표를 못 찍어 해설이 문장을 가리키지 못한다',
    stageOrd: 6,
    fix: '**지문이 새로 뽑히면 그 지문으로 쓰인 분석의 인용이 죽는다** — 실측 2026-09-16: 40건 중 36이 지문이 온전한 문항이다(추출기를 고친 직후 11 → 40 으로 늘었다). 그 문항들은 `analysis-drain-export.mjs --redo` 로 다시 분석한다',
  },
  {
    code: 'scoring',
    label: '배점 모순',
    blocks: '①커버리지',
    why: '3점 표시와 실제 배점이 어긋난다 — 사정권 배점 합이 틀어진다',
    stageOrd: 1,
    fix: '원본 문제지에서 그 문항의 배점을 확인하고 `corpus-sync.mjs` 로 다시 맞춘다. 한 문항이라도 커버리지 전체가 틀어진다',
  },
  {
    code: 'answerKey',
    label: '복수 정답',
    blocks: '채점',
    why: '정답이 둘 이상인데 단일 정답 칸으로 채점된다',
    stageOrd: 9,
    fix: '평가원 정답표에서 복수 정답이 맞는지 확인한다. 맞으면 채점이 두 답을 다 받아야 한다',
  },
  {
    code: 'reportText',
    label: '리포트 작업 로그',
    blocks: '학습자 배포',
    why: '유형 리포트의 학습자 노출 서술에 분석자끼리 쓴 말이 남아 있다 — 그대로 학습자 화면에 나간다',
    stageOrd: 9,
    fix: '`locus-refold` 드레인. ⚠️ `--commit` 이 `answer_locus_pattern` 을 덮어쓰고 재실행 안전하지 않다 — 백업 파일을 확인하고 한 번만 올린다',
  },
  {
    code: 'reportCount',
    label: '리포트 계수 불일치',
    blocks: '①커버리지 · ③설계',
    why: '유형 리포트가 적은 분석 문항 수가 그 유형의 실제 문항 수와 다르다',
    stageOrd: 1,
    fix: '리포트의 `n_analyzed` 를 그 유형의 실제 문항 수로 맞춘다. 어긋난 채로는 「어느 유형이 덜 됐나」를 이 화면이 못 말한다',
  },
] as const

const DEFECT_BY_CODE = new Map(DEFECTS.map((d) => [d.code, d]))

export function defectDef(code: DefectCode): DefectDef {
  const d = DEFECT_BY_CODE.get(code)
  if (!d) throw new Error(`알 수 없는 결함 코드: ${code}`)
  return d
}

// ── 문항 한 줄 ──────────────────────────────────────────────────────────

/** 화면으로 내려보내는 문항 한 줄. **지문·선지 원문은 없다.** */
export interface EvidenceItem {
  id: string
  examId: string
  examLabel: string
  /** 학년도. `csat_exams.year`. */
  year: number
  kind: 'suneung' | 'mock'
  no: number
  typeId: string
  typeName: string
  points: number
  /** 3점 표시(`high_score`). `points === 3` 과 어긋나면 `scoring` 결함이다. */
  highScore: boolean
  /** 정답 번호. 정답표가 없으면 null. */
  answer: number | null
  /** 복수 정답이면 2 이상. */
  answerCount: number
  /** 풀이 절차 단계 수. */
  steps: number
  /** 필수 어휘 수. */
  vocab: number
  /** 오답 선지에 달린 함정 라벨 (중복 제거). */
  traps: string[]
  /** 분석자 예측 정답률 0~1. */
  predicted: number
  /** 권장 풀이 시간(초). */
  timeSec: number
  /** 정답 근거 길이(자). */
  whyLen: number
  /** 배제 근거가 적힌 오답 수 / 오답 총수. */
  rejected: number
  distractors: number
  /** 지문이 온전한가 (`csat_items.body_ok`). */
  bodyOk: boolean
  /** 근거 인용을 지문에서 찾았나. 서버가 판정한다. */
  quoteLocated: boolean
  /** 서로 다른 페르소나 3인이 pass 를 준 최신 판인가. */
  reviewed3: boolean
  /** 이 문항이 걸린 결함 (없으면 빈 배열). */
  defects: DefectCode[]
}

/** 회차 메타 — **문항이 0인 회차도 사라지지 않게** 별도로 넘긴다. */
export interface EvidenceExam {
  id: string
  label: string
  kind: 'suneung' | 'mock'
  year: number
  month: number
  items: number
}

/** 유형 메타 — 유형 리포트의 상태를 함께 갖는다. */
export interface EvidenceType {
  id: string
  name: string
  status: 'active' | 'retired'
  items: number
  /** 리포트가 적은 분석 문항 수. */
  reportN: number | null
  /** 학습자 화면에 나가는 세 필드에서 발견된 작업 로그 표지. 비어야 배포 가능하다. */
  analystMeta: string[]
}

export interface EvidenceData {
  items: EvidenceItem[]
  exams: EvidenceExam[]
  types: EvidenceType[]
  generatedAt: string
  loadError: string | null
}

// ── 유형 리포트 오염 판정 ───────────────────────────────────────────────

/** 학습자 화면(`/csat/[typeId]`)이 상위 6개만 그리므로, 그 6개 안의 오염만 배포를 막는다. */
export const LEARNER_FAILURE_MODES = 6

/**
 * 유형 리포트가 **학습자에게 그대로 나갈 수 있나**.
 *
 * ⚠️ 옛 콘솔은 `answer_locus_pattern` **한 필드만** 보고 「13/26 배포 가능」이라 적었다.
 *    그런데 학습자 화면은 세 필드를 그린다 — 근거 서술 · 상위 6개 미끄러지는 자리 · 풀이 절차.
 *    셋을 다 보면 **10/26** 이다(실측 2026-09-15). 한 필드만 재면 나머지 둘의 오염이
 *    「배포 가능」 초록 뒤에 숨는다.
 *
 * `open_questions` 는 세지 않는다 — 학습자 화면이 그리지 않는 내부 필드다(478항목 중 291이
 * 오염돼 있지만 그것은 이 게이트의 대상이 아니다).
 */
export function detectTypeReportMeta(report: {
  answer_locus_pattern: string | null
  failure_modes: readonly string[]
  procedure_steps: readonly { step?: string }[]
}): string[] {
  const found = new Set<string>()
  for (const m of detectAnalystMeta(report.answer_locus_pattern)) found.add(m)
  for (const m of report.failure_modes.slice(0, LEARNER_FAILURE_MODES)) {
    for (const x of detectAnalystMeta(m)) found.add(x)
  }
  for (const s of report.procedure_steps) {
    for (const x of detectAnalystMeta(s?.step ?? null)) found.add(x)
  }
  return [...found]
}

// ── 커버리지 매트릭스 ───────────────────────────────────────────────────

/**
 * 필수 필드 = **하류 공정이 실제로 읽는 것**만. 읽는 곳이 없는 칸은 세지 않는다(F1·F2).
 *
 * 화면 맨 위 한 줄이 이 표의 요약이고, 그 줄의 모든 숫자가 문항 목록으로 내려간다.
 * 옛 눈금 넉 장(29/29 · 802/802 · 9207 · 0)은 전부 여기 흡수됐다 — 셋은 「이상 없음」만
 * 말했고 하나(검수 기록 9,207)는 **옛 판을 세고 있었다**(최신 판은 2,406 = 802×3).
 */
export interface FieldDef {
  key: string
  label: string
  /** 이 칸을 읽는 하류 공정. */
  stage: string
  /** 이 칸이 걸릴 수 있는 결함. 없으면 채움/비움만 있다. */
  defect: DefectCode | null
}

export const FIELDS: readonly FieldDef[] = [
  { key: 'ability', label: '재는 능력', stage: '⑥해설', defect: null },
  { key: 'intent', label: '출제 의도', stage: '⑥해설', defect: null },
  { key: 'quote', label: '근거 인용', stage: '⑥해설·오버레이', defect: 'quote' },
  { key: 'reasoning', label: '근거 설명', stage: '⑥해설', defect: null },
  { key: 'whyCorrect', label: '정답 근거', stage: '학습자', defect: null },
  { key: 'reject', label: '오답 배제', stage: '학습자', defect: null },
  { key: 'trap', label: '함정 라벨', stage: '③설계', defect: null },
  { key: 'procedure', label: '풀이 절차', stage: '학습자·⑥해설', defect: null },
  { key: 'vocab', label: '필수 어휘', stage: '어휘 드레인', defect: null },
  { key: 'time', label: '권장 시간', stage: '/csat/plan', defect: null },
  { key: 'predicted', label: '예측 정답률', stage: '⑤집필', defect: null },
  { key: 'body', label: '지문 본문', stage: '④소재·⑥해설', defect: 'body' },
  { key: 'review3', label: '3인 검수', stage: '⑦검수', defect: null },
  { key: 'scoring', label: '배점 정합', stage: '①커버리지', defect: 'scoring' },
  { key: 'answerKey', label: '정답 단일성', stage: '채점', defect: 'answerKey' },
  { key: 'reportText', label: '유형 근거 서술', stage: '학습자 배포', defect: 'reportText' },
  { key: 'reportCount', label: '유형 계수 정합', stage: '①커버리지·③설계', defect: 'reportCount' },
] as const

/** 셀 하나의 상태. 색만으로 구별하지 않는다 — 화면이 기호·글자를 함께 쓴다. */
export type CellState = 'fill' | 'empty' | 'fail' | 'conflict'

/** 정답 근거가 「있다」고 치는 최소 길이 — `items-fold.ts` 의 `MIN_WHY` 와 같은 잣대다. */
export const MIN_WHY = 40

export function cellState(item: EvidenceItem, field: FieldDef): CellState {
  switch (field.key) {
    case 'quote':
      return item.quoteLocated ? 'fill' : 'conflict'
    case 'body':
      return item.bodyOk ? 'fill' : 'conflict'
    case 'scoring':
      return item.highScore === (item.points === 3) ? 'fill' : 'conflict'
    case 'answerKey':
      return item.answerCount > 1 ? 'conflict' : item.answer == null ? 'empty' : 'fill'
    case 'review3':
      return item.reviewed3 ? 'fill' : 'fail'
    case 'whyCorrect':
      return item.whyLen >= MIN_WHY ? 'fill' : 'empty'
    case 'reject':
      return item.distractors > 0 && item.rejected >= item.distractors ? 'fill' : 'empty'
    case 'trap':
      return item.traps.length > 0 ? 'fill' : 'empty'
    case 'procedure':
      return item.steps > 0 ? 'fill' : 'empty'
    case 'vocab':
      return item.vocab > 0 ? 'fill' : 'empty'
    case 'time':
      return item.timeSec > 0 ? 'fill' : 'empty'
    case 'predicted':
      return item.predicted > 0 ? 'fill' : 'empty'
    case 'reportText':
      return item.defects.includes('reportText') ? 'conflict' : 'fill'
    case 'reportCount':
      return item.defects.includes('reportCount') ? 'conflict' : 'fill'
    // 서술 네 칸은 드레인이 NOT NULL 로 채우므로 언제나 fill 이다. 그래도 세는 이유는
    // **분모가 줄어들면 「모순 1,076」이 작아 보이기** 때문이다 — 분모는 읽는 칸 전부다.
    default:
      return 'fill'
  }
}

export interface Coverage {
  items: number
  fields: number
  cells: number
  fill: number
  empty: number
  fail: number
  conflict: number
  /** 최소 하나의 결함에 걸린 문항 수 — U3(「내보내도 되나」)의 답이 이 숫자다. */
  blockedItems: number
  /** 결함별 문항 수. 많은 것 먼저. */
  byDefect: { code: DefectCode; items: number }[]
  /**
   * 필드별 칸 상태.
   *
   * 맨 윗줄에 「채움 12,558」을 적어 두었더니 **아무 행동으로도 이어지지 않았다** — 어느 필드가
   * 멀쩡한지는 고칠 것이 없다는 뜻이고, 관리자는 못 쓰는 칸만 본다. 그래서 윗줄에서 빼고
   * 여기로 내렸다(펴면 어느 필드가 몇 칸을 막는지, 그 칸을 **누가 읽는지**가 함께 나온다).
   */
  byField: { key: string; label: string; stage: string; defect: DefectCode | null; bad: number }[]
}

export function coverageOf(items: readonly EvidenceItem[]): Coverage {
  let fill = 0
  let empty = 0
  let fail = 0
  let conflict = 0
  const byDefect = new Map<DefectCode, number>()
  const badPerField = new Map<string, number>()
  let blocked = 0

  for (const it of items) {
    for (const f of FIELDS) {
      const s = cellState(it, f)
      if (s === 'fill') fill += 1
      else {
        badPerField.set(f.key, (badPerField.get(f.key) ?? 0) + 1)
        if (s === 'empty') empty += 1
        else if (s === 'fail') fail += 1
        else conflict += 1
      }
    }
    if (it.defects.length) blocked += 1
    for (const d of it.defects) byDefect.set(d, (byDefect.get(d) ?? 0) + 1)
  }

  return {
    items: items.length,
    fields: FIELDS.length,
    cells: items.length * FIELDS.length,
    fill,
    empty,
    fail,
    conflict,
    blockedItems: blocked,
    byDefect: DEFECTS.map((d) => ({ code: d.code, items: byDefect.get(d.code) ?? 0 })).sort(
      (a, b) => b.items - a.items,
    ),
    byField: FIELDS.map((f) => ({
      key: f.key,
      label: f.label,
      stage: f.stage,
      defect: f.defect,
      bad: badPerField.get(f.key) ?? 0,
    })).sort((a, b) => b.bad - a.bad),
  }
}

// ── 축 ──────────────────────────────────────────────────────────────────

export type AxisId = 'exam' | 'type' | 'trap' | 'steps' | 'vocab' | 'band' | 'year' | 'defect'

export interface Bucket {
  key: string
  label: string
  /** 짧은 열 머리용 — 없으면 `label`. */
  short?: string
}

export interface AxisDef {
  id: AxisId
  label: string
  /** 한 문항이 여러 칸에 들어가는 축인가. 그러면 칸 합 > 문항 수가 **정상**이다. */
  multi: boolean
  /** 라벨이 말하지 않는 것 — 이 축이 무엇을 가르는지. */
  hint: string
}

export const AXES: readonly AxisDef[] = [
  { id: 'exam', label: '회차', multi: false, hint: '학년도 × 월. 문항이 0인 회차도 행으로 남는다' },
  { id: 'type', label: '유형', multi: false, hint: '평가원 유형 26종. 미분류는 0이다' },
  { id: 'trap', label: '함정', multi: true, hint: '오답 선지에 달린 라벨. 한 문항이 오답 4개에 각각 달고 있다' },
  { id: 'steps', label: '절차 단계', multi: false, hint: '풀이 절차가 몇 단인가' },
  { id: 'vocab', label: '어휘 수', multi: false, hint: '이 문항을 풀려면 알아야 하는 낱말 수' },
  { id: 'band', label: '난이도 사정권', multi: false, hint: '배점 × 예측 정답률 — 학습자가 미끄러지는 자리' },
  { id: 'year', label: '연도', multi: false, hint: '출제 학년도. 유형의 등장·퇴장이 여기서 보인다' },
  { id: 'defect', label: '결함', multi: true, hint: '한 문항이 여러 결함에 걸릴 수 있다' },
] as const

const AXIS_BY_ID = new Map(AXES.map((a) => [a.id, a]))

export function axisDef(id: AxisId): AxisDef {
  const a = AXIS_BY_ID.get(id)
  if (!a) throw new Error(`알 수 없는 축: ${id}`)
  return a
}

/**
 * 함정 축의 「함정이 안 달린 문항」 칸.
 *
 * 실측으로는 802문항 전부가 오답 선지에 라벨을 달고 있어 비어 있지만, **칸 자체를 없애면
 * 나중에 라벨 없는 문항이 하나 들어왔을 때 축에서 조용히 사라진다**(B3 누락 0).
 */
export const TRAP_NONE = '__notrap__'
export const NO_DEFECT = '__clean__'

/**
 * **함정 축은 라벨이 아니라 계열이다.**
 *
 * 오답 선지에 달린 라벨은 문항 단위로 **513종**이다(실측 2026-09-16 · 오답 슬롯 3,208개).
 * 그것을 그대로 행으로 세우면 표가 513줄이 되어 훑을 수 없고, 상위 N개만 남기면 나머지가
 * 「그 밖」 한 칸으로 뭉개져 **가장 많은 정보가 가장 안 보이는 칸**에 들어간다.
 *
 * 그래서 축은 `foldTrapFamilies` 가 접은 **계열**로 세우고, 라벨은 축 패널의 트리에서 편다.
 * 접는 규칙은 유형 리포트의 함정을 접을 때와 같은 함수다 — 두 곳이 다른 규칙을 쓰면 같은
 * 함정이 화면마다 다른 이름을 갖는다.
 *
 * ⚠️ 이 병합은 **라벨 문자열 휴리스틱**이지 의미 판정이 아니다. 그래서 트리가 계열 아래에
 *    원 라벨을 언제나 함께 보여 준다 — 확정 분류는 사람이 한다.
 */
export interface TrapAxis {
  families: TrapFamily[]
  /** 원 라벨 → 그 라벨이 들어간 계열 대표 라벨. */
  familyOf: Map<string, string>
}

export function foldItemTraps(items: readonly EvidenceItem[]): TrapAxis {
  const count = new Map<string, number>()
  for (const it of items) for (const t of it.traps) count.set(t, (count.get(t) ?? 0) + 1)

  const families = foldTrapFamilies([...count.entries()].map(([trap, n]) => ({ trap, count: n })))

  const familyOf = new Map<string, string>()
  for (const f of families) for (const l of f.labels) familyOf.set(l, f.key)
  return { families, familyOf }
}

/** 예측 정답률 구간 — 경계는 배점 구분(2점 평균 .745 · 3점 평균 .503)에서 왔다. */
function predBand(p: number): { key: string; label: string } {
  if (p < 0.4) return { key: 'p0', label: '~39%' }
  if (p < 0.6) return { key: 'p1', label: '40~59%' }
  if (p < 0.8) return { key: 'p2', label: '60~79%' }
  return { key: 'p3', label: '80%~' }
}

/**
 * 한 문항이 그 축에서 들어가는 칸들. 빈 배열을 돌려주지 않는다 — 누락 0(B3).
 *
 * 함정 축만 `ctx` 가 필요하다(라벨 → 계열 대조). 다른 축은 문항 한 줄로 결정된다.
 */
export function keysOf(item: EvidenceItem, axis: AxisId, ctx?: AxisContext): string[] {
  switch (axis) {
    case 'exam':
      return [item.examId]
    case 'type':
      return [item.typeId || '—']
    case 'year':
      return [String(item.year)]
    case 'steps':
      return [String(item.steps)]
    case 'vocab':
      return [String(item.vocab)]
    case 'band':
      return [`${item.points}:${predBand(item.predicted).key}`]
    case 'trap': {
      if (!item.traps.length) return [TRAP_NONE]
      const fam = ctx?.trap.familyOf
      // 대조표가 없으면 라벨 그대로 — 계열을 **지어내지 않는다**(틀린 묶음보다 안 묶은 게 낫다).
      if (!fam) return [...new Set(item.traps)]
      return [...new Set(item.traps.map((t) => fam.get(t) ?? t))]
    }
    case 'defect':
      return item.defects.length ? item.defects : [NO_DEFECT]
    default:
      return ['—']
  }
}

export interface AxisContext {
  exams: readonly EvidenceExam[]
  types: readonly EvidenceType[]
  /**
   * 함정 계열 — **전체 집합 기준으로 한 번** 접는다. 필터가 바뀔 때마다 다시 접으면
   * 조건을 좁혔을 뿐인데 행의 이름과 자리가 바뀌어, 좁히기 전후를 견줄 수 없게 된다.
   */
  trap: TrapAxis
}

/** 화면이 넘겨받는 문항 전량으로 축 문맥을 만든다. */
export function axisContext(
  items: readonly EvidenceItem[],
  exams: readonly EvidenceExam[],
  types: readonly EvidenceType[],
): AxisContext {
  return { exams, types, trap: foldItemTraps(items) }
}

/**
 * 축의 칸 목록 — **비어 있어도 나온다.**
 *
 * 문항에서만 칸을 뽑으면 문항 0인 회차가 표에서 통째로 사라진다. 옛 콘솔이 정확히 그랬다 —
 * `csat_coverage()` 가 `join csat_items` 라 **M2009(2020학년도 9월)** 가 행 자체로 증발했고,
 * 화면은 남은 29를 세어 「29/29 완료」라고 적었다(실측 2026-09-15: DB 회차는 30이다).
 */
export function bucketsOf(axis: AxisId, ctx: AxisContext): Bucket[] {
  switch (axis) {
    case 'exam':
      return [...ctx.exams]
        .sort((a, b) => b.year - a.year || b.month - a.month || a.id.localeCompare(b.id))
        .map((e) => ({ key: e.id, label: e.label, short: e.id }))
    case 'type':
      return [...ctx.types]
        .sort((a, b) => b.items - a.items || a.id.localeCompare(a.id))
        .map((t) => ({ key: t.id, label: t.name, short: t.id }))
    case 'year': {
      const years = [...new Set(ctx.exams.map((e) => e.year))].sort((a, b) => b - a)
      return years.map((y) => ({ key: String(y), label: `${y}학년도`, short: String(y) }))
    }
    case 'steps':
      return [4, 5, 6, 7].map((n) => ({ key: String(n), label: `${n}단계`, short: `${n}단` }))
    case 'vocab':
      return [3, 4, 5, 6, 7, 8].map((n) => ({ key: String(n), label: `어휘 ${n}`, short: String(n) }))
    case 'band': {
      const out: Bucket[] = []
      for (const pt of [2, 3]) {
        for (const b of [
          { key: 'p0', label: '~39%' },
          { key: 'p1', label: '40~59%' },
          { key: 'p2', label: '60~79%' },
          { key: 'p3', label: '80%~' },
        ]) {
          out.push({ key: `${pt}:${b.key}`, label: `${pt}점 · ${b.label}`, short: `${pt}점 ${b.label}` })
        }
      }
      return out
    }
    case 'trap':
      return [
        ...ctx.trap.families.map((f) => ({
          key: f.key,
          label: f.labels.length > 1 ? `${f.key} 외 ${f.labels.length - 1}` : f.key,
          short: f.key,
        })),
        { key: TRAP_NONE, label: '함정 라벨 없음', short: '없음' },
      ]
    case 'defect':
      return [
        ...DEFECTS.map((d) => ({ key: d.code, label: d.label })),
        { key: NO_DEFECT, label: '결함 없음', short: '없음' },
      ]
    default:
      return []
  }
}

// ── 피벗 ────────────────────────────────────────────────────────────────

export type Measure = 'items' | 'blocked' | 'points' | 'time'

export const MEASURES: readonly { id: Measure; label: string; unit: string }[] = [
  { id: 'items', label: '문항 수', unit: '문항' },
  { id: 'blocked', label: '막힌 문항', unit: '문항' },
  { id: 'points', label: '배점 합', unit: '점' },
  { id: 'time', label: '권장 시간', unit: '초' },
] as const

function measureOf(items: readonly EvidenceItem[], m: Measure): number {
  switch (m) {
    case 'items':
      return items.length
    case 'blocked':
      return items.filter((i) => i.defects.length > 0).length
    case 'points':
      return items.reduce((s, i) => s + i.points, 0)
    case 'time':
      return items.reduce((s, i) => s + i.timeSec, 0)
    default:
      return 0
  }
}

export interface PivotCell {
  rowKey: string
  colKey: string
  value: number
  /** 이 칸의 문항 수 — 값이 배점·시간일 때도 「몇 문항인가」를 함께 적는다. */
  items: number
}

export interface Pivot {
  rows: Bucket[]
  cols: Bucket[]
  /** `cells[rowKey][colKey]`. 0인 칸은 없다(희소). */
  cells: Map<string, Map<string, PivotCell>>
  rowTotal: Map<string, number>
  colTotal: Map<string, number>
  rowItems: Map<string, number>
  colItems: Map<string, number>
  /** 서로 다른 문항 수 — **어느 조합에서도 모집단과 같아야 한다.** */
  grand: number
  /** 칸 값의 합. 다중 축에서는 `grand` 보다 크고, 그것이 정상이다. */
  cellSum: number
  measure: Measure
  multi: boolean
}

/**
 * 문항 집합을 두 축으로 접는다.
 *
 * **칸마다 수를 세지 않고 문항 id 집합을 모은다.** 다중 축(함정·결함)에서 한 문항이 여러 칸에
 * 들어가도 행 합계·열 합계·총합이 각각 「서로 다른 문항 수」로 나와야 하기 때문이다. 칸에서
 * 세어 더하면 총합이 3,208 이 되고, 그 수는 화면이 약속한 「802」와 다르다.
 */
export function pivot(
  items: readonly EvidenceItem[],
  rowAxis: AxisId,
  colAxis: AxisId,
  measure: Measure,
  ctx: AxisContext,
): Pivot {
  const rows = bucketsOf(rowAxis, ctx)
  const cols = bucketsOf(colAxis, ctx)

  const grouped = new Map<string, Map<string, EvidenceItem[]>>()
  const rowSet = new Map<string, EvidenceItem[]>()
  const colSet = new Map<string, EvidenceItem[]>()

  const known = { row: new Set(rows.map((b) => b.key)), col: new Set(cols.map((b) => b.key)) }

  for (const it of items) {
    const rk = keysOf(it, rowAxis, ctx).map((k) => (known.row.has(k) ? k : fallbackKey(rowAxis)))
    const ck = keysOf(it, colAxis, ctx).map((k) => (known.col.has(k) ? k : fallbackKey(colAxis)))
    for (const r of new Set(rk)) {
      let m = grouped.get(r)
      if (!m) grouped.set(r, (m = new Map()))
      for (const c of new Set(ck)) {
        const arr = m.get(c)
        if (arr) arr.push(it)
        else m.set(c, [it])
      }
      const ra = rowSet.get(r)
      if (ra) ra.push(it)
      else rowSet.set(r, [it])
    }
    for (const c of new Set(ck)) {
      const ca = colSet.get(c)
      if (ca) ca.push(it)
      else colSet.set(c, [it])
    }
  }

  const cells = new Map<string, Map<string, PivotCell>>()
  let cellSum = 0
  for (const [rk, byCol] of grouped) {
    const line = new Map<string, PivotCell>()
    for (const [ck, arr] of byCol) {
      const value = measureOf(arr, measure)
      if (value === 0 && arr.length === 0) continue
      line.set(ck, { rowKey: rk, colKey: ck, value, items: arr.length })
      cellSum += value
    }
    cells.set(rk, line)
  }

  const rowTotal = new Map<string, number>()
  const rowItems = new Map<string, number>()
  for (const [k, arr] of rowSet) {
    rowTotal.set(k, measureOf(arr, measure))
    rowItems.set(k, arr.length)
  }
  const colTotal = new Map<string, number>()
  const colItems = new Map<string, number>()
  for (const [k, arr] of colSet) {
    colTotal.set(k, measureOf(arr, measure))
    colItems.set(k, arr.length)
  }

  return {
    rows,
    cols,
    cells,
    rowTotal,
    colTotal,
    rowItems,
    colItems,
    grand: measureOf(items, measure),
    cellSum,
    measure,
    multi: axisDef(rowAxis).multi || axisDef(colAxis).multi,
  }
}

/** 축 목록에 없는 값이 오면 버리지 않고 여기로 모은다 — 누락 0(B3). */
function fallbackKey(axis: AxisId): string {
  if (axis === 'trap') return TRAP_NONE
  if (axis === 'defect') return NO_DEFECT
  return '—'
}

// ── 필터 ────────────────────────────────────────────────────────────────

/** 축 → 고른 칸 키들. 같은 축 안은 OR, 축끼리는 AND. */
export type Filter = Partial<Record<AxisId, string[]>>

export function applyFilter(items: readonly EvidenceItem[], filter: Filter, ctx: AxisContext): EvidenceItem[] {
  const entries = Object.entries(filter).filter(([, v]) => v && v.length) as [AxisId, string[]][]
  if (!entries.length) return [...items]
  return items.filter((it) =>
    entries.every(([axis, want]) => {
      const known = new Set(bucketsOf(axis, ctx).map((b) => b.key))
      const keys = keysOf(it, axis, ctx).map((k) => (known.has(k) ? k : fallbackKey(axis)))
      return keys.some((k) => want.includes(k))
    }),
  )
}

/** 필터를 URL 쿼리로 — 공정 담당자가 「이 조건의 근거」를 링크로 넘길 수 있어야 한다. */
export function filterToQuery(filter: Filter): URLSearchParams {
  const sp = new URLSearchParams()
  for (const a of AXES) {
    const v = filter[a.id]
    if (v && v.length) sp.set(a.id, v.join('|'))
  }
  return sp
}

export function filterFromQuery(sp: URLSearchParams | Record<string, string | string[] | undefined>): Filter {
  const get = (k: string): string | undefined => {
    if (sp instanceof URLSearchParams) return sp.get(k) ?? undefined
    const v = sp[k]
    return Array.isArray(v) ? v[0] : v
  }
  const out: Filter = {}
  for (const a of AXES) {
    const raw = get(a.id)
    if (!raw) continue
    const parts = raw.split('|').filter(Boolean)
    if (parts.length) out[a.id] = parts
  }
  return out
}

/** 칩 한 줄에 쓸 이름 — 키가 아니라 사람이 읽는 라벨로 적는다. */
export function labelOf(axis: AxisId, key: string, ctx: AxisContext): string {
  return bucketsOf(axis, ctx).find((b) => b.key === key)?.label ?? key
}

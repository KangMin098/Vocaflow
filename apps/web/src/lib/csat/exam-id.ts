// apps/web/src/lib/csat/exam-id.ts
//
// **회차 id 를 읽는 유일한 곳.** 회차 id 로 종류·연도·월·학년을 알아내는 코드는 전부 여기를 부른다.
//
// ── 왜 한곳인가 ───────────────────────────────────────────────────────
// 수능과 평가원 모평 두 종류뿐이던 시절에는 `startsWith('M')` 이 곧 «모평» 이었고, 그 판정이
// 스무 군데에 흩어졌다. 교육청 학력평가(학평)가 들어오면 그 스무 곳이 **조용히** 학평을
// 모평으로 읽는다(원본 링크가 평가원으로 가고, 연도가 한 해 어긋난다). 그래서 판정을 모으고
// `__tests__/exam-id-guard.test.ts` 가 흩어진 판정이 다시 생기는 것을 막는다.
//
// ── id 문법 ──────────────────────────────────────────────────────────
//   `2026` · `2014A`  수능 — 학년도(+ 2014 A/B형). 시행은 그 전해 11월.
//   `M2706`           평가원 모평 — `M` + 학년도 YY + 시행월 MM. 시행은 학년도 전해.
//   `H2503G1`         교육청 학평 — `H` + **시행연도** YY + 시행월 MM + `G` + 학년.
//
// 학평만 시행연도로 적는 이유: 학평은 고1·고2 도 치르고 사람들이 «2025년 3월 고1» 로 부른다.
// 학년도는 고3 에게만 뜻이 있다. 대신 정렬·연도 비교는 모두 `schoolYear`(= 시행연도 + 1)로
// 맞춰서 수능·모평과 한 줄에 선다. 정본 로직은 `scripts/csat/lib-exam-id.mjs` 와 같아야 한다
// (`__tests__/exam-id.test.ts` 가 두 구현을 같은 표로 대조한다).

export type ExamKind = 'suneung' | 'mock' | 'hakpyeong'
export type ExamOrganizer = 'kice' | 'edu_office'

export interface ExamIdParts {
  id: string
  kind: ExamKind
  /** 평가원(수능·모평) 또는 교육청(학평). 근거 집합을 가르는 축이다 */
  organizer: ExamOrganizer
  /** 학년도 — 그 회차가 겨누는 수능의 해. 정렬·«최근 N개년» 비교는 이것으로 한다 */
  schoolYear: number
  /** 실제로 시험을 치른 해 */
  examYear: number
  month: number
  grade: 1 | 2 | 3
  /** 2014학년도 수능의 A/B형. 나머지는 null */
  form: 'A' | 'B' | null
}

const SUNEUNG = /^(\d{4})([AB])?$/
const MOCK = /^M(\d{2})(\d{2})$/
const HAKPYEONG = /^H(\d{2})(\d{2})G([123])$/

/** 회차 id 를 푼다. 문법에 맞지 않으면 null — 추측하지 않는다 */
export function parseExamId(id: string): ExamIdParts | null {
  const s = SUNEUNG.exec(id)
  if (s) {
    const schoolYear = Number(s[1])
    return {
      id,
      kind: 'suneung',
      organizer: 'kice',
      schoolYear,
      examYear: schoolYear - 1,
      month: 11,
      grade: 3,
      form: (s[2] as 'A' | 'B' | undefined) ?? null,
    }
  }
  const m = MOCK.exec(id)
  if (m) {
    const schoolYear = 2000 + Number(m[1])
    const month = Number(m[2])
    if (month < 1 || month > 12) return null
    return { id, kind: 'mock', organizer: 'kice', schoolYear, examYear: schoolYear - 1, month, grade: 3, form: null }
  }
  const h = HAKPYEONG.exec(id)
  if (h) {
    const examYear = 2000 + Number(h[1])
    const month = Number(h[2])
    if (month < 1 || month > 12) return null
    return {
      id,
      kind: 'hakpyeong',
      organizer: 'edu_office',
      schoolYear: examYear + 1,
      examYear,
      month,
      grade: Number(h[3]) as 1 | 2 | 3,
      form: null,
    }
  }
  return null
}

/** 문항 id(`2026#31`)나 회차 id 에서 회차 부분만 */
export function examIdOf(itemOrExamId: string): string {
  return itemOrExamId.split('#')[0] ?? ''
}

/** 종류. 못 읽는 id 는 null */
export function examKindOf(id: string): ExamKind | null {
  return parseExamId(examIdOf(id))?.kind ?? null
}

/** 평가원 회차(수능·모평)인가 — 본 근거 집합. 학평은 보조·검증 집합이라 false */
export function isKiceExam(id: string): boolean {
  return parseExamId(examIdOf(id))?.organizer === 'kice'
}

/** 학년도. 못 읽는 id 는 NaN — 0 을 돌려주면 «아주 옛 회차» 로 조용히 섞인다 */
export function schoolYearOf(id: string): number {
  return parseExamId(examIdOf(id))?.schoolYear ?? Number.NaN
}

/**
 * 정렬 열쇠(클수록 최근). `학년도 × 100 + 월`, 같은 달의 학평은 학년 순, 2014 B형은 A형 뒤.
 * 못 읽는 id 는 0 이라 맨 뒤(가장 오래된 쪽)로 간다.
 */
export function examOrder(id: string): number {
  const p = parseExamId(examIdOf(id))
  if (!p) return 0
  return p.schoolYear * 100 + p.month + (p.form === 'B' ? 0.5 : 0) + (p.kind === 'hakpyeong' ? p.grade / 10 : 0)
}

/** 사람이 읽는 이름. DB 의 `csat_exams.label` 과 같은 규칙으로 만든다 */
export function examLabelOf(id: string): string | null {
  const p = parseExamId(examIdOf(id))
  if (!p) return null
  if (p.kind === 'suneung') return `${p.schoolYear}학년도 수능${p.form ? ` ${p.form}형` : ''}`
  if (p.kind === 'mock') return `${p.schoolYear}학년도 ${p.month}월 모의평가`
  return `${p.examYear}년 ${p.month}월 고${p.grade} 학력평가`
}

/** 문제지 조판의 듣기 마지막 번호. 2014학년도 수능만 22번까지 듣기다 */
export function listeningEndOf(id: string): number {
  return parseExamId(examIdOf(id))?.kind === 'suneung' && id.startsWith('2014') ? 22 : 17
}

// ── DB 질의 범위 ─────────────────────────────────────────────────────
//
// 학평은 **보조·검증 집합**이라 평가원 통계(유형 비중·분석 완결도·유형 가이드)에 섞이면 안 된다.
// 학습자 뷰 `csat_items_public` 과 `csat_coverage()` 는 DB 가 걸러 준다(마이그레이션
// `20260927153152`). `csat_items` · `csat_exams` · `csat_item_analyses` · `csat_analysis_reviews` 를
// **직접** 훑는 질의는 조건을 그 자리에 적는다:
//   문항·분석  `.not('<id 칸>', 'like', `${HAKPYEONG_ID_PREFIX}%`)`   (문항 id 는 회차 id 로 시작한다)
//   회차       `.eq('organizer', 'kice')`
//   검수       `.select('…, csat_item_analyses!inner(item_id)').not('csat_item_analyses.item_id', 'like', …)`
// 헬퍼 함수로 감싸지 않는 이유: Supabase 빌더의 재귀 제네릭을 헬퍼가 다시 풀면 Promise.all 안에서
// TS2589(Type instantiation is excessively deep)가 난다 — PR #123 리뷰에서 CI 가 그걸로 떨어졌다.
// `__tests__/exam-id.test.ts` 가 직접 훑는 질의마다 이 조건이 있는지 검사한다.

/** 학평 회차 id 접두어 — 문항 id 도 회차 id 로 시작하므로 같은 접두어로 거른다 */
export const HAKPYEONG_ID_PREFIX = 'H'

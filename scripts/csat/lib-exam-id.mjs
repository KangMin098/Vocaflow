// scripts/csat/lib-exam-id.mjs
//
// **회차 id 를 읽는 스크립트 쪽 유일한 곳.** 웹의 `apps/web/src/lib/csat/exam-id.ts` 와 규칙이 같다
// (그 파일 머리말이 문법·이유의 정본이다). 두 구현은 `apps/web/src/lib/csat/__tests__/exam-id.test.ts`
// 가 같은 표로 대조한다 — 한쪽만 고치면 그 테스트가 떨어진다.
//
//   `2026` · `2014A`  수능          `M2706`  평가원 모평(학년도 YY + 월)
//   `H2503G1`         교육청 학평(시행연도 YY + 월 + 학년)

const SUNEUNG = /^(\d{4})([AB])?$/
const MOCK = /^M(\d{2})(\d{2})$/
const HAKPYEONG = /^H(\d{2})(\d{2})G([123])$/

export function parseExamId(id) {
  const s = SUNEUNG.exec(id)
  if (s) {
    const schoolYear = Number(s[1])
    return { id, kind: 'suneung', organizer: 'kice', schoolYear, examYear: schoolYear - 1, month: 11, grade: 3, form: s[2] ?? null }
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
    return { id, kind: 'hakpyeong', organizer: 'edu_office', schoolYear: examYear + 1, examYear, month, grade: Number(h[3]), form: null }
  }
  return null
}

export const examIdOf = (id) => String(id).split('#')[0] ?? ''
export const examKindOf = (id) => parseExamId(examIdOf(id))?.kind ?? null
export const isKiceExam = (id) => parseExamId(examIdOf(id))?.organizer === 'kice'
export const isSuneung = (id) => examKindOf(id) === 'suneung'
export const schoolYearOf = (id) => parseExamId(examIdOf(id))?.schoolYear ?? Number.NaN

export function examOrder(id) {
  const p = parseExamId(examIdOf(id))
  if (!p) return 0
  return p.schoolYear * 100 + p.month + (p.form === 'B' ? 0.5 : 0) + (p.kind === 'hakpyeong' ? p.grade / 10 : 0)
}

export function examLabelOf(id) {
  const p = parseExamId(examIdOf(id))
  if (!p) return null
  if (p.kind === 'suneung') return `${p.schoolYear}학년도 수능${p.form ? ` ${p.form}형` : ''}`
  if (p.kind === 'mock') return `${p.schoolYear}학년도 ${p.month}월 모의평가`
  return `${p.examYear}년 ${p.month}월 고${p.grade} 학력평가`
}

export function listeningEndOf(id) {
  return examKindOf(id) === 'suneung' && String(id).startsWith('2014') ? 22 : 17
}

/** DB `csat_exams` 행의 회차 메타 — build-corpus · corpus-sync 가 같은 값을 쓴다 */
export function examMetaOf(id) {
  const p = parseExamId(id)
  if (!p) throw new Error(`회차 id 문법 밖: ${id}`)
  return {
    kind: p.kind,
    organizer: p.organizer,
    grade: p.grade,
    year: p.schoolYear,
    exam_year: p.examYear,
    month: p.month,
    form: p.form,
    label: examLabelOf(id),
  }
}

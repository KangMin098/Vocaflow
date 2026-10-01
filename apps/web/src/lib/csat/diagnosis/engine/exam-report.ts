// apps/web/src/lib/csat/diagnosis/engine/exam-report.ts
//
// **시험 기록만으로 나오는 진단** — 학습자는 학평·모평·수능 회차를 골라 자기 답만 적는다.
// 관리자 태깅·프로필·설문 없이, 이미 있는 데이터로만 계산한다:
//   · 정답·배점: csat_dx_answer_key(45문항)          → 점수 · 등급 · 시계열
//   · 문항 유형: csat_items.type_id(18~45, 1~17 = 듣기) → 유형별 정답률 · 최근 변화
//   · 선지 함정: csat_dx_option_trap(분석된 문항만)      → 틀린 답이 끌려간 함정
// 순수 함수 — DB·시계를 모른다. 서버가 표를 읽어 넘긴다.

export const LISTENING_TYPE = 'LISTEN'

export interface ReportItem {
  /** 문항 번호 1~45 */
  no: number
  itemId: string | null
  typeId: string
  /** 선지 번호 → 함정 라벨 */
  traps: Partial<Record<number, string>>
}

export interface ReportSession {
  id: string
  examId: string
  examLabel: string
  takenAt: string
  createdAt: string
  mode: 'live' | 'retake'
  raw: number
  grade: number | null
  answers: { no: number; chosen: number | null; correct: boolean }[]
}

export interface TypeStat {
  typeId: string
  answered: number
  correct: number
  rate: number
  /** 가장 최근 시험에서의 정답률(그 시험에 이 유형이 있을 때) */
  latest: number | null
  /** 그 전 시험들의 정답률 */
  before: number | null
}

export interface WrongItem {
  sessionId: string
  examLabel: string
  takenAt: string
  no: number
  itemId: string | null
  typeId: string
  chosen: number | null
  trap: string | null
  /** 함정 계열(C1~C9) — 라벨에 계열이 없으면 null */
  family: string | null
}

export interface ExamReport {
  trend: { sessionId: string; examId: string; label: string; takenAt: string; raw: number; grade: number | null; mode: 'live' | 'retake'; wrong: number; listening: number; reading: number; answers: ReportSession['answers'] }[]
  latest: { sessionId: string; label: string; raw: number; grade: number | null; delta: number | null } | null
  sections: { listening: number | null; reading: number | null }
  types: TypeStat[]
  weakest: TypeStat[]
  wrongLatest: WrongItem[]
  /** 모든 기록의 틀린 문항(최근 시험부터) */
  wrongAll: WrongItem[]
  /** 실제 응시의 등급별 횟수 */
  gradeCounts: Record<number, number>
  traps: { family: string; count: number }[]
  totalAnswered: number
}

const rate = (c: number, n: number) => (n > 0 ? Math.round((c / n) * 1000) / 1000 : 0)

function chrono(a: ReportSession, b: ReportSession) {
  return a.takenAt.localeCompare(b.takenAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

/**
 * @param items 회차 id → 번호 → 문항 정보
 * @param trapFamily 함정 라벨 → 계열(C1~C9) — 없으면 그 라벨은 함정 집계에서 빠진다
 * @param minAnswered 유형 약점 판정의 최소 응답 수(그 아래는 「약점」으로 부르지 않는다)
 */
export function buildExamReport(
  sessions: ReportSession[],
  items: Record<string, Record<number, ReportItem>>,
  trapFamily: Record<string, string | null>,
  minAnswered = 3,
): ExamReport {
  const ordered = [...sessions].sort(chrono)
  const lives = ordered.filter((s) => s.mode === 'live')
  const last = lives.at(-1) ?? ordered.at(-1) ?? null
  const prevLive = last ? lives.filter((s) => s.id !== last.id).at(-1) ?? null : null

  const acc = new Map<string, { n: number; c: number; ln: number; lc: number; bn: number; bc: number }>()
  let listenN = 0
  let listenC = 0
  let readN = 0
  let readC = 0
  const trapCount = new Map<string, number>()

  for (const s of ordered) {
    const map = items[s.examId] ?? {}
    // 다시 푼 기출은 점수 흐름에는 보이되 유형 진단에는 넣지 않는다 — 이미 본 문항이라 실력이 부풀려진다
    if (s.mode === 'retake') continue
    for (const a of s.answers) {
      const it = map[a.no]
      const typeId = it?.typeId ?? (a.no <= 17 ? LISTENING_TYPE : null)
      if (!typeId) continue
      const t = acc.get(typeId) ?? { n: 0, c: 0, ln: 0, lc: 0, bn: 0, bc: 0 }
      t.n += 1
      t.c += a.correct ? 1 : 0
      if (last && s.id === last.id) {
        t.ln += 1
        t.lc += a.correct ? 1 : 0
      } else {
        t.bn += 1
        t.bc += a.correct ? 1 : 0
      }
      acc.set(typeId, t)
      if (a.no <= 17) {
        listenN += 1
        listenC += a.correct ? 1 : 0
      } else {
        readN += 1
        readC += a.correct ? 1 : 0
      }
      if (!a.correct && a.chosen !== null) {
        const fam = it?.traps[a.chosen] ? trapFamily[it.traps[a.chosen] as string] : null
        if (fam) trapCount.set(fam, (trapCount.get(fam) ?? 0) + 1)
      }
    }
  }

  const types: TypeStat[] = [...acc.entries()].map(([typeId, t]) => ({
    typeId,
    answered: t.n,
    correct: t.c,
    rate: rate(t.c, t.n),
    latest: t.ln > 0 ? rate(t.lc, t.ln) : null,
    before: t.bn > 0 ? rate(t.bc, t.bn) : null,
  }))
  types.sort((a, b) => a.rate - b.rate || b.answered - a.answered || a.typeId.localeCompare(b.typeId))

  const wrongsOf = (sess: ReportSession): WrongItem[] => {
    const map = items[sess.examId] ?? {}
    return sess.answers
      .filter((a) => !a.correct)
      .map((a) => {
        const it = map[a.no]
        return {
          sessionId: sess.id,
          examLabel: sess.examLabel,
          takenAt: sess.takenAt,
          no: a.no,
          itemId: it?.itemId ?? null,
          typeId: it?.typeId ?? (a.no <= 17 ? LISTENING_TYPE : ''),
          chosen: a.chosen,
          trap: a.chosen !== null ? it?.traps[a.chosen] ?? null : null,
          family: a.chosen !== null && it?.traps[a.chosen] ? trapFamily[it.traps[a.chosen] as string] ?? null : null,
        }
      })
  }
  const wrongLatest: WrongItem[] = last ? wrongsOf(last) : []
  const wrongAll: WrongItem[] = [...ordered].reverse().flatMap(wrongsOf)
  const gradeCounts: Record<number, number> = {}
  for (const s of lives) if (s.grade !== null) gradeCounts[s.grade] = (gradeCounts[s.grade] ?? 0) + 1
  const share = (s: ReportSession, lo: number, hi: number) => {
    const xs = s.answers.filter((a) => a.no >= lo && a.no <= hi)
    return xs.length ? rate(xs.filter((a) => a.correct).length, xs.length) : 0
  }

  return {
    trend: ordered.map((s) => ({
      sessionId: s.id, examId: s.examId, label: s.examLabel, takenAt: s.takenAt, raw: s.raw, grade: s.grade, mode: s.mode,
      wrong: s.answers.filter((a) => !a.correct).length, listening: share(s, 1, 17), reading: share(s, 18, 45),
      answers: s.answers,
    })),
    latest: last
      ? { sessionId: last.id, label: last.examLabel, raw: last.raw, grade: last.grade, delta: prevLive && last.mode === 'live' ? last.raw - prevLive.raw : null }
      : null,
    sections: { listening: listenN > 0 ? rate(listenC, listenN) : null, reading: readN > 0 ? rate(readC, readN) : null },
    types,
    weakest: types.filter((t) => t.answered >= minAnswered && t.rate < 1).slice(0, 3),
    wrongLatest,
    wrongAll,
    gradeCounts,
    traps: [...trapCount.entries()].map(([family, count]) => ({ family, count })).sort((a, b) => b.count - a.count),
    totalAnswered: listenN + readN,
  }
}

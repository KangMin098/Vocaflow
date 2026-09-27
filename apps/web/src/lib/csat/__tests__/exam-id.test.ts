// apps/web/src/lib/csat/__tests__/exam-id.test.ts
//
// 회차 id 문법 — 웹(`exam-id.ts`)과 스크립트(`lib-exam-id.mjs`) 두 구현을 같은 표로 대조하고,
// `startsWith('M')` 식의 흩어진 판정이 다시 생기지 않게 막는다.

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  examLabelOf,
  examOrder,
  isKiceExam,
  listeningEndOf,
  parseExamId,
  schoolYearOf,
} from '../exam-id'
import * as mjs from '../../../../../../scripts/csat/lib-exam-id.mjs'

const IDS = ['2026', '2014A', '2014B', 'M2706', 'M1809', 'H2503G1', 'H2510G3', 'H1811G2', 'H2505G3', '', 'nope', 'M27', 'H2513G1', 'H2503G4']

describe('parseExamId', () => {
  it('수능 — 학년도, 전해 11월 시행', () => {
    expect(parseExamId('2026')).toMatchObject({ kind: 'suneung', organizer: 'kice', schoolYear: 2026, examYear: 2025, month: 11, grade: 3, form: null })
    expect(parseExamId('2014B')?.form).toBe('B')
  })
  it('모평 — M + 학년도 YY + 월', () => {
    expect(parseExamId('M2706')).toMatchObject({ kind: 'mock', organizer: 'kice', schoolYear: 2027, examYear: 2026, month: 6 })
  })
  it('학평 — H + 시행연도 YY + 월 + 학년, 교육청', () => {
    expect(parseExamId('H2503G1')).toMatchObject({ kind: 'hakpyeong', organizer: 'edu_office', examYear: 2025, schoolYear: 2026, month: 3, grade: 1 })
  })
  it('문법 밖은 null — 추측하지 않는다', () => {
    for (const id of ['', 'nope', 'M27', 'H2513G1', 'H2503G4', 'H2503', '20261']) expect(parseExamId(id)).toBeNull()
  })
})

describe('정렬·연도·이름', () => {
  it('학평은 학년도 축에서 수능·모평과 한 줄에 선다', () => {
    // 2025년 10월 고3 학평(학년도 2026) → 2026 수능(2025년 11월) 앞, 2026년 3월 학평 뒤
    expect(examOrder('2026')).toBeGreaterThan(examOrder('H2510G3'))
    expect(examOrder('H2510G3')).toBeGreaterThan(examOrder('M2609'))
    expect(examOrder('H2603G3')).toBeGreaterThan(examOrder('2026'))
    expect(examOrder('H2503G3')).toBeGreaterThan(examOrder('H2503G1'))
  })
  it('기존 값은 그대로다', () => {
    expect(examOrder('M2706')).toBe(202706)
    expect(examOrder('2026')).toBe(202611)
    expect(examOrder('2014B')).toBe(201411.5)
    expect(schoolYearOf('M2309#31')).toBe(2023)
    expect(schoolYearOf('nope')).toBeNaN()
  })
  it('이름과 듣기 끝 번호', () => {
    expect(examLabelOf('H2503G1')).toBe('2025년 3월 고1 학력평가')
    expect(examLabelOf('M2706')).toBe('2027학년도 6월 모의평가')
    expect(examLabelOf('2014A')).toBe('2014학년도 수능 A형')
    expect(listeningEndOf('2014A')).toBe(22)
    expect(listeningEndOf('H2503G1')).toBe(17)
  })
  it('학평은 평가원 근거 집합이 아니다', () => {
    expect(isKiceExam('2026#31')).toBe(true)
    expect(isKiceExam('M2706')).toBe(true)
    expect(isKiceExam('H2503G1#31')).toBe(false)
  })
})

describe('스크립트 구현과 같다', () => {
  it.each(IDS)('%s', (id) => {
    expect(mjs.parseExamId(id)).toEqual(parseExamId(id))
    expect(mjs.examOrder(id)).toBe(examOrder(id))
    expect(mjs.examLabelOf(id)).toBe(examLabelOf(id))
  })
})

describe('흩어진 판정 금지', () => {
  // 학평이 들어온 뒤 `startsWith('M')` 은 «모평» 이 아니라 «평가원 모평만» 이고, 부정형
  // `!startsWith('M')` 은 학평을 수능으로 읽는다. 판정은 exam-id 한곳에서만 한다.
  const ROOT = path.resolve(__dirname, '../../../../../..')
  const DIRS = ['apps/web/src', 'scripts/csat']
  const BANNED = [/startsWith\(\s*['"]M['"]\s*\)/, /\/\^M\??\(\\d\{2\}\)/]
  const ALLOW = new Set(['apps/web/src/lib/csat/exam-id.ts', 'scripts/csat/lib-exam-id.mjs'])

  function walk(dir: string, out: string[]) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '__tests__' || e.name.startsWith('.')) continue
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p, out)
      else if (/\.(ts|tsx|mjs|mts)$/.test(e.name)) out.push(p)
    }
    return out
  }

  it('회차 id 를 직접 파싱하는 곳이 없다', () => {
    const hits: string[] = []
    for (const d of DIRS) {
      const abs = path.join(ROOT, d)
      if (!fs.existsSync(abs)) continue
      for (const f of walk(abs, [])) {
        const rel = path.relative(ROOT, f).split(path.sep).join('/')
        if (ALLOW.has(rel)) continue
        const lines = fs.readFileSync(f, 'utf8').split('\n')
        lines.forEach((l, i) => {
          if (BANNED.some((re) => re.test(l))) hits.push(`${rel}:${i + 1}`)
        })
      }
    }
    expect(hits).toEqual([])
  })
})

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

  // 학평은 보조·검증 집합이다. 문항·회차·분석·검수 표를 **직접 훑는** 질의가 범위를 안 좁히면
  // 학평이 유형 가이드·분석 완결도·검수 총계·지형 분모에 조용히 섞인다(학습자 뷰는 DB 가 거른다).
  // 이미 고른 id 로 짚는 조회(`.eq/.in` id)와 수능만 고르는 조회는 범위가 정해져 있어 통과시킨다.
  // 창은 **그 질의 하나**로 자른다(다음 `.from(` 전까지) — 옆 질의의 조건으로 통과하지 않게.
  // (PR #123 리뷰: 처음 가드는 문항·회차만 봐서 분석·검수 총계 누락을 못 잡았다)
  it('평가원 표 직접 질의는 평가원으로 좁힌다', () => {
    const SCOPED = [
      'HAKPYEONG_ID_PREFIX',
      'idPattern', // evidence 의 범위(평가원 · 학평 학년) 분기
      ".eq('organizer', 'kice')",
      ".eq('organizer', 'edu_office')",
      ".eq('kind', 'suneung')",
      ".eq('id',",
      ".eq('item_id',",
      ".in('id',",
      ".in('item_id',",
      ".in('analysis_id',",
    ]
    const hits: string[] = []
    for (const f of walk(path.join(ROOT, 'apps/web/src'), [])) {
      const rel = path.relative(ROOT, f).split(path.sep).join('/')
      const src = fs.readFileSync(f, 'utf8')
      for (const m of src.matchAll(/\.from\(\s*['"](csat_items|csat_exams|csat_item_analyses|csat_analysis_reviews)['"]\s*\)/g)) {
        const at = m.index ?? 0
        const next = src.indexOf('.from(', at + 6)
        const window = src.slice(Math.max(0, at - 40), next < 0 ? at + 600 : Math.min(next, at + 600))
        if (!SCOPED.some((k) => window.includes(k))) hits.push(`${rel}:${src.slice(0, at).split('\n').length} ${m[1]}`)
      }
    }
    expect(hits).toEqual([])
  })

  // 스크립트는 받아 온 뒤 거르는 경우가 많아 **파일 단위**로 본다: `csat_items` 를 읽는 스크립트는
  // `isKiceExam` 으로 거르거나(측정·드레인), 집합을 명시적으로 고르거나(`--set`) 해야 한다.
  it('csat_items 를 읽는 스크립트는 집합을 가른다', () => {
    const hits: string[] = []
    for (const d of ['scripts']) {
      for (const f of walk(path.join(ROOT, d), [])) {
        const src = fs.readFileSync(f, 'utf8')
        if (!/\.from\(\s*['"]csat_items['"]\s*\)/.test(src)) continue
        if (src.includes('isKiceExam') || src.includes("'--set'")) continue
        hits.push(path.relative(ROOT, f).split(path.sep).join('/'))
      }
    }
    expect(hits).toEqual([])
  })
})

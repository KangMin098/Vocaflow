// apps/web/src/lib/textbook/__tests__/source-pipeline.test.ts
//
// **원천별 작업 진행표 — 칸 판정 · 회차 읽기 · 하는 법의 명령이 실제로 있는가.**

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { PIPELINE_STAGES, cellOf, howTo, roundsReady, rowDone, type PipelineRow } from '../source-pipeline'
import { foldRounds } from '../source-rounds'

const ROOT = resolve(__dirname, '..', '..', '..', '..', '..', '..')

const PLOS: PipelineRow = {
  source: 'plos', total: 47939, pieces: 11602, keep: 0, keepPending: 4077, hold: 0, discard: 1040, undecided: 31220,
  levelled: 47939, judged: 16719, lastGet: '2026-09-06T00:19:03Z', usable: 10461, harvestCmd: 'node scripts/csat/harvest-plos.mjs',
}
const VOA: PipelineRow = {
  source: 'voa', total: 10663, pieces: 17, keep: 9437, keepPending: 0, hold: 0, discard: 1202, undecided: 7,
  levelled: 10654, judged: 10656, lastGet: null, usable: 5309, harvestCmd: null,
}

describe('칸 판정', () => {
  it('PLOS — 원문 점검은 판정 전 31,220 이 남아 주황, 발췌는 대기 4,077', () => {
    const r = cellOf(PLOS, 'retain')
    expect(r.value).toBe('5,117 / 36,337')
    expect(r.note).toBe('31,220 판정 전')
    expect(r.tone).toBe('pile')
    const x = cellOf(PLOS, 'extract')
    expect(x.note).toBe('4,077 발췌 대기')
    expect(x.tone).toBe('pile')
  })

  it('남은 몫이 1% 이하면 「끝」이되 남은 수는 적는다 — 몇 편 때문에 줄을 주황으로 칠하지 않는다', () => {
    const r = cellOf(VOA, 'retain')
    expect(r.tone).toBe('ok')
    expect(r.note).toBe('7 판정 전')
    // VOA 는 adapted 피드 조각이 17편 있다 — 잘라 둔 것이 있고 대기는 없으니 「끝」이다.
    expect(cellOf(VOA, 'extract')).toMatchObject({ value: '17', tone: 'ok', note: '끝' })
    expect(cellOf({ ...VOA, pieces: 0 }, 'extract').tone).toBe('na')
  })

  it('하나도 안 된 단계는 막힘 · 원본이 없으면 해당 없음', () => {
    const fresh: PipelineRow = { ...VOA, source: 'olh', total: 21, pieces: 0, keep: 0, discard: 0, undecided: 21, levelled: 0, judged: 0, usable: 0 }
    expect(cellOf(fresh, 'retain').tone).toBe('stop')
    expect(cellOf(fresh, 'level').tone).toBe('stop')
    const piecesOnly: PipelineRow = { ...VOA, total: 50, pieces: 50, undecided: 0, keep: 0, discard: 0 }
    expect(cellOf(piecesOnly, 'retain').tone).toBe('na')
  })

  it('못 센 usable 은 0 이 아니라 「못 셈」', () => {
    expect(cellOf({ ...VOA, usable: null }, 'usable').note).toBe('못 셈')
  })

  it('끝난 원천만 접힌다', () => {
    expect(rowDone(PLOS)).toBe(false)
    expect(rowDone(VOA)).toBe(true)
  })
})

describe('회차 — 대량 판정 가능 여부', () => {
  it('기록이 없으면 불가 · 한 번만 쟀으면 불가 · 두 번 연속 0.6 이상이면 가능', () => {
    expect(roundsReady(undefined).ready).toBe(false)
    expect(roundsReady({ kappas: [{ round: 'round-2', n: 20, kappa: 0.643 }], keepPct: 95, keepRound: 'round-2' }).ready).toBe(false)
    expect(
      roundsReady({ kappas: [{ round: 'round-2', n: 20, kappa: 0.64 }, { round: 'round-3', n: 20, kappa: 0.7 }], keepPct: 90, keepRound: 'round-3' }).ready,
    ).toBe(true)
    expect(
      roundsReady({ kappas: [{ round: 'round-2', n: 20, kappa: 0.8 }, { round: 'round-3', n: 20, kappa: 0.5 }], keepPct: 90, keepRound: 'round-3' }).ready,
    ).toBe(false)
  })

  it('실제 회차 문서를 읽는다 — PLOS 는 round-2 κ 0.643 · round-3 κ 0.847 로 대량 판정 가능', () => {
    const dir = resolve(ROOT, 'docs/source-check')
    const files = readdirSync(dir)
      .filter((n) => /^round-\d+/.test(n))
      .map((name) => ({ name, md: readFileSync(resolve(dir, name), 'utf8') }))
    const rounds = foldRounds(files)
    // 회차 순서대로 쌓인다 — 이름 순서가 곧 회차 순서다.
    expect(rounds.plos?.kappas.slice(0, 2)).toEqual([
      { round: 'round-2', n: 20, kappa: 0.643 },
      { round: 'round-3', n: 30, kappa: 0.847 },
    ])
    // 보관 비율은 **가장 최근 회차**의 것이다.
    expect(rounds.plos?.keepPct).toBe(80)
    expect(rounds.plos?.keepRound).toBe('round-3')
    expect(roundsReady(rounds.plos).ready).toBe(true)
    expect(Object.keys(rounds).length).toBeGreaterThan(10)
  })
})

describe('하는 법 — 화면이 내미는 명령은 저장소에 실제로 있다', () => {
  const rows = [PLOS, VOA, { ...VOA, source: 'olh', total: 21, pieces: 0, undecided: 21, levelled: 0, judged: 0 }]
  const scripts = new Set<string>()
  for (const r of rows)
    for (const s of PIPELINE_STAGES) {
      const h = howTo(r, s.key, 3)
      for (const step of h?.steps ?? []) for (const m of step.cmd.matchAll(/scripts\/[\w./-]+\.(?:mjs|mts|ts)/g)) scripts.add(m[0])
      for (const m of (h?.claude ?? '').matchAll(/(?:scripts|docs)\/[\w./-]+\.(?:mjs|mts|ts|md)/g)) scripts.add(m[0])
    }

  it('명령을 실제로 모았다', () => {
    expect(scripts.size).toBeGreaterThan(6)
  })

  it.each([...scripts])('%s 가 있다', (p) => {
    expect(existsSync(resolve(ROOT, p)), p).toBe(true)
  })

  it('예행이 먼저다 — 기록하는 줄은 맨 앞에 오지 않는다', () => {
    for (const r of rows)
      for (const s of PIPELINE_STAGES) {
        const h = howTo(r, s.key, 3)
        if (h && h.steps.length > 1) expect(h.steps[0]!.writes, `${r.source} ${s.key}`).toBe(false)
      }
  })

  it('원문 점검 지시문은 DB 에 쓰지 말라고 적는다 — 대량 적재는 회차 안정 뒤 승인', () => {
    expect(howTo(PLOS, 'retain', 3)?.claude).toContain('DB 에는 쓰지 마')
    expect(howTo({ ...VOA, source: 'olh', total: 21, pieces: 0, undecided: 21 }, 'retain', 3)?.claude).toContain('DB 에는 쓰지 말고')
  })
})

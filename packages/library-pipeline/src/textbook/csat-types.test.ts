// packages/library-pipeline/src/textbook/csat-types.test.ts
//
// 커버리지 분모의 계약. **분모가 흔들리면 "100%" 가 아무 뜻이 없다.**

import { describe, expect, it } from 'vitest'

import { CSAT_READING_TYPES, measureCoverage } from './csat-types'
import { PRODUCTION_STAGES, measureClaudeStages, measureStages } from './production-stages'

describe('CSAT_READING_TYPES', () => {
  it('읽기 28문항을 빠짐없이 덮는다 — 18~45번', () => {
    const nums = CSAT_READING_TYPES.flatMap((t) => t.numbers).sort((a, b) => a - b)
    expect(nums).toHaveLength(28)
    expect(nums[0]).toBe(18)
    expect(nums[nums.length - 1]).toBe(45)
    // 번호가 겹치면 커버리지 분모가 부풀려진다.
    expect(new Set(nums).size).toBe(28)
  })

  it('번호에 빠진 자리가 없다', () => {
    const nums = new Set(CSAT_READING_TYPES.flatMap((t) => t.numbers))
    for (let n = 18; n <= 45; n++) expect(nums.has(n), `${n}번`).toBe(true)
  })

  it('모든 유형이 근거를 남긴다 — "쉬워 보이는데 왜 없지" 를 막는다', () => {
    for (const t of CSAT_READING_TYPES) {
      expect(t.note.length, t.key).toBeGreaterThan(20)
      expect(t.key).toMatch(/^[a-z_]+$/)
    }
  })

  it('구현된 것은 결정론 다섯이다 — 실측 기준선', () => {
    // 흐름 무관은 2026-08-21 추가(`buildIrrelevant`). 늘어날 때마다 여기를 고친다 —
    // 커버리지 숫자가 조용히 바뀌면 어디서 늘었는지 알 수 없다.
    const impl = CSAT_READING_TYPES.filter((t) => t.implemented).map((t) => t.key)
    expect(impl.sort()).toEqual(['grammar', 'insert', 'irrelevant', 'order', 'vocabulary'])
  })
})

describe('measureCoverage', () => {
  it('유형 수와 문항 수를 둘 다 낸다 — 빈칸 4문항과 목적 1문항은 무게가 다르다', () => {
    const c = measureCoverage()
    expect(c.types.total).toBe(18)
    expect(c.types.implemented).toBe(5)
    expect(c.questions.total).toBe(28)
    expect(c.questions.implemented).toBe(7) // 순서 2 + 삽입 2 + 흐름무관 1 + 어휘 1 + 어법 1
    expect(c.questions.ratio).toBeCloseTo(7 / 28, 5)
  })

  it('결정론으로 가능한 것은 이제 다 만들었다 — 남은 13유형은 생성형·외부재료다', () => {
    const gap = measureCoverage().deterministicGap.map((t) => t.key)
    // 2026-08-21 에 비었다. 남은 것을 만들려면 지문을 새로 **써야** 하거나
    // (요지·주제·빈칸 …) 도표·안내문 같은 지문 밖 재료가 있어야 한다.
    // 여기가 다시 채워진다면 새 결정론 유형을 발견한 것이므로 반드시 알아야 한다.
    expect(gap).toEqual([])
  })

  it('생성 방식별 집계가 총계와 맞는다', () => {
    const c = measureCoverage()
    const sum = Object.values(c.byGeneration).reduce((n, g) => n + g.total, 0)
    expect(sum).toBe(c.types.total)
  })
})

describe('PRODUCTION_STAGES', () => {
  it('출판 실무 8단계를 순서대로 담는다', () => {
    expect(PRODUCTION_STAGES).toHaveLength(8)
    expect(PRODUCTION_STAGES.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('없는 단계는 대응물이 비어 있고 사유가 있다', () => {
    for (const s of PRODUCTION_STAGES) {
      if (s.state === 'missing') {
        expect(s.ours, s.label).toHaveLength(0)
        expect(s.gap, s.label).not.toBeNull()
      }
      if (s.state === 'done') expect(s.gap, s.label).toBeNull()
      if (s.state !== 'done') expect(s.gap, s.label).toBeTruthy()
    }
  })

  it('**Claude Code 몫이 단계마다 적혀 있다** — "LLM 필요" 는 차단이 아니라 시작 신호다', () => {
    // 이 저장소의 다른 파이프라인은 단계·탭마다 드레인을 따로 둔다(VCB 3 · PDCP 2).
    // 교재만 전부를 묶은 드레인 하나로 두면 "지금 어느 단계를 돌려야 하나" 를 알 수 없다.
    const r = measureClaudeStages()
    expect(r.stages.length).toBeGreaterThan(1)
    for (const s of r.stages) {
      expect(s.claude, s.label).not.toBeNull()
      expect(s.claude!.role.length, s.label).toBeGreaterThan(20)
      expect(s.claude!.progress.length, s.label).toBeGreaterThan(5)
    }
    // `claude` 가 아닌 단계는 몫이 비어 있어야 한다 — 섞이면 목록이 거짓말이 된다.
    for (const s of PRODUCTION_STAGES.filter((x) => x.worker !== 'claude')) {
      expect(s.claude, s.label).toBeNull()
    }
  })

  it('드레인이 이미 있는 단계와 아직 없는 단계를 나눠 낸다 — 없는 쪽이 할 일 목록이다', () => {
    const r = measureClaudeStages()
    expect(r.wired.length + r.unwired.length).toBe(r.stages.length)
    // 해답·해설은 2026-08-21 에 드레인이 생겼다.
    expect(r.wired.map((s) => s.label)).toContain('해답·해설')
    // 나머지는 아직 없다 — 늘어나면 여기를 고친다.
    expect(r.unwired.length).toBeGreaterThan(0)
  })

  it('없는 단계는 이제 없다 — 다만 **다섯**이 아직 반쪽이다', () => {
    // 2026-08-21 에 셋이 `missing` → `partial` 로 옮겨 갔다.
    //   해답·해설  결정론 해설 (실측 커버리지 6.9%)
    //   교정        인쇄 불가 자국 판정 + 낡은 문항 감지 + 조사 자동 선택
    //   평가·개정   문항 건강 점검 (쏠림·규격·밴드). **관측 0건이라 난이도·변별도는 아직 없다**
    //
    // ⚠️ `partial` 을 `done` 으로 착각하지 않기 위해 여기서 함께 못 박는다 —
    //   "없는 단계가 없다" 는 "다 됐다" 가 아니다.
    const report = measureStages()
    expect(report.missingStages).toEqual([])
    expect(report.partial).toBe(5) // 집필 · 문항제작 · 교정 · 해답해설 · 평가개정
    expect(report.done).toBe(3) // 기획 · 원고검토 · 내부검수
  })
})

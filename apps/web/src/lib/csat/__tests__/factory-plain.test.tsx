// apps/web/src/lib/csat/__tests__/factory-plain.test.tsx
//
// **공장 지도 · 걸음 머리띠 · 용어집 — 쉬운 말 층의 회귀.**
//
// 이 층이 지키는 약속은 넷이다:
//   ① 걸음마다 실측 공정을 **실제로** 읽는다 — 눈금 라벨이 바뀌면 숫자가 조용히 사라진다.
//   ② 못 센 것은 0 이 아니라 「아직 못 셈」이다.
//   ③ 맨 위 카드는 흐름에서 **가장 앞선** 막힌 걸음이다.
//   ④ 화면에 나가는 문장에 개발 말(`JARGON`)이 없다 — 원래 말은 용어집의 「예전 말」에만 산다.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { FactoryMap } from '@/components/admin/factory/FactoryMap'
import { LabHeader, StepHeader } from '@/components/admin/factory/StepHeader'
import { HELP_REGISTRY } from '@/lib/admin/help'

import { GLOSSARY, JARGON } from '../factory-glossary'
import { FACTORY_STAGES, type StageState } from '../factory-model'
import {
  PLAIN_LAB,
  PLAIN_STATUS,
  PLAIN_STEPS,
  WHO_KO,
  firstThing,
  gaugeText,
  neighbours,
  pickStatus,
  readStep,
  stepByHref,
  stepOfStage,
  todoText,
  type PickSnapshot,
} from '../factory-plain'
import { STAGES_REAL } from './fixtures'

const PICK: PickSnapshot = {
  measuredAt: '2026-09-23T01:43:28.769Z',
  total: 87720,
  usable: 13730,
  unjudged: 43477,
  blocked: 16074,
}

/** 태그를 걷어 낸 보이는 글자. 용어집 「예전 말」 칸은 일부러 옛 말을 싣는 자리라 뺀다. */
function visibleText(html: string): string {
  return html
    .replace(/<dd[^>]*>예전 말[\s\S]*?<\/dd>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/g, ' ')
}

function jargonIn(text: string): string[] {
  return JARGON.filter((w) => text.includes(w))
}

describe('① 걸음마다 실측을 실제로 읽는다', () => {
  it('걸음이 가리키는 공정이 정본에 있다', () => {
    for (const s of PLAIN_STEPS) {
      if (!s.stage) continue
      expect(FACTORY_STAGES.some((f) => f.id === s.stage), `${s.name} → ${s.stage}`).toBe(true)
    }
    for (const l of PLAIN_LAB) {
      expect(FACTORY_STAGES.some((f) => f.id === l.stage), `${l.name} → ${l.stage}`).toBe(true)
    }
  })

  it('걸음이 읽는 눈금 라벨을 실측 조회가 실제로 낸다 — 라벨이 바뀌면 여기서 떨어진다', () => {
    // ⚠️ 표본(`STAGES_REAL`)이 아니라 **조회 코드**에 대 본다. 표본은 2026-09-05 밀집도용이라 라벨이
    //   옛것이다(「게이트가 있는 밴드 중 …」). 표본에 맞추면 조회가 라벨을 바꿔도 이 회귀가 모른다 —
    //   `factory-model.ts` 머리말의 ④ 소재 「못 잼」 사고가 바로 그 어긋남이었다.
    const loader = readFileSync(resolve(__dirname, '..', 'factory.ts'), 'utf8')
    for (const s of PLAIN_STEPS) {
      if (!s.gauge) continue
      expect(loader.includes(`label: '${s.gauge}`), `${s.name} → 「${s.gauge}」 눈금을 조회가 안 낸다`).toBe(true)
    }
  })

  it('걸음이 읽는 눈금이 있으면 숫자를 그린다', () => {
    const stages: StageState[] = STAGES_REAL.map((s) =>
      s.def.id === 'explain'
        ? { ...s, status: 'short', gauges: [{ label: '해설 보유', num: 875618, den: 880337, unit: 'ratio' }] }
        : s,
    )
    const r = readStep(PLAIN_STEPS.find((s) => s.key === 'explain')!, stages)
    expect(gaugeText(r.gauge)).toBe('875,618 / 880,337')
    expect(todoText(r, stages)).toContain('해설이 없는 문제가 4,719개')
  })

  it('재료 공정 아홉 칸이 모두 지도 어딘가에 걸린다 — 빠진 칸은 아무도 안 본다', () => {
    const covered = new Set([
      ...PLAIN_STEPS.flatMap((s) => (s.stage ? [s.stage] : [])),
      ...PLAIN_LAB.map((l) => l.stage),
    ])
    for (const f of FACTORY_STAGES) expect(covered.has(f.id), `${f.name}(${f.id})`).toBe(true)
  })

  it('화면 경로로 자기 걸음을 찾는다 — 쿼리가 붙어도', () => {
    for (const s of PLAIN_STEPS) {
      const found = stepByHref(s.href)
      expect(found, s.href).not.toBeNull()
    }
    expect(stepByHref('/admin/csat/sources?view=eligibility')?.key).toBe('gather')
    expect(stepOfStage('source')?.key).toBe('passage')
    expect(stepOfStage('evidence')).toBeNull()
  })

  it('앞뒤가 이어지고, 마지막 다음은 처음이다 — 공장은 돈다', () => {
    const first = PLAIN_STEPS[0]!
    const last = PLAIN_STEPS[PLAIN_STEPS.length - 1]!
    expect(neighbours(first).prev).toBeNull()
    expect(neighbours(last).next?.key).toBe(first.key)
  })
})

describe('② 못 센 것은 0 이 아니다', () => {
  it('눈금 분자가 null 이면 「아직 못 셈」', () => {
    expect(gaugeText({ label: 'x', num: null, den: 10, unit: 'ratio' })).toBe('아직 못 셈')
    expect(gaugeText({ label: 'x', num: 0, den: 10, unit: 'ratio' })).toBe('0 / 10')
  })

  it('판정 스냅샷이 없으면 글감 고르기는 「아직 못 셈」이다', () => {
    expect(pickStatus(null)).toBe('unmeasured')
  })

  it('안 본 글감이 있어도 실어도 되는 글감이 있으면 뒤를 막지 않는다', () => {
    expect(pickStatus(PICK)).toBe('pass')
    expect(pickStatus({ ...PICK, usable: 0 })).toBe('blocked')
  })

  it('확인하기 — 한 겹이라도 못 셌으면 숫자 전체가 「아직 못 셈」', () => {
    const stages: StageState[] = STAGES_REAL.map((s) =>
      s.def.id === 'review'
        ? { ...s, gauges: s.gauges.map((g, i) => (i === 1 ? { ...g, num: null } : g)) }
        : s,
    )
    const r = readStep(PLAIN_STEPS.find((s) => s.key === 'check')!, stages)
    expect(gaugeText(r.gauge)).toBe('아직 못 셈')
  })
})

describe('③ 가장 먼저 할 일', () => {
  it('흐름에서 가장 앞선, 순조롭지 않은 걸음을 고른다', () => {
    const first = firstThing(STAGES_REAL, PICK)
    const expected = PLAIN_STEPS.find((s) => {
      const r = readStep(s, STAGES_REAL, PICK)
      return r.status != null && r.status !== 'pass'
    })
    expect(first?.step.key).toBe(expected?.key)
  })

  it('다 순조로우면 카드는 비고 지도는 「무엇을 만들까」로 안내한다', () => {
    const allPass: StageState[] = STAGES_REAL.map((s) => ({ ...s, status: 'pass' }))
    expect(firstThing(allPass, PICK)).toBeNull()
    const html = renderToString(<FactoryMap stages={allPass} pick={PICK} loadError={null} />)
    expect(html).toContain('막힌 걸음이 없어요')
    expect(html).toContain('href="/admin/csat/new"')
  })

  it('낸 책 중 사람 결재가 빠진 수를 숫자로 말한다', () => {
    const after = PLAIN_STEPS.find((s) => s.key === 'after')!
    const r = readStep(after, STAGES_REAL, PICK)
    if (r.gauge?.num != null && r.gauge.den != null && r.gauge.num < r.gauge.den) {
      expect(todoText(r, STAGES_REAL)).toContain(`${(r.gauge.den - r.gauge.num).toLocaleString('ko-KR')}권이 사람 결재 없이`)
    }
  })
})

describe('④ 화면에 개발 말이 없다', () => {
  it('걸음 · 연구 칸 · 상태 · 누가 — 정의 문장', () => {
    const texts = [
      ...PLAIN_STEPS.flatMap((s) => [
        s.name,
        s.says,
        s.takes,
        s.gives,
        s.decides ?? '',
        s.countLabel ?? '',
        s.example?.caption ?? '',
        s.example?.before.label ?? '',
        s.example?.after.label ?? '',
        s.example?.after.text ?? '',
      ]),
      ...PLAIN_LAB.flatMap((l) => [l.name, l.says]),
      ...Object.values(WHO_KO),
      ...Object.values(PLAIN_STATUS).map((p) => p.label),
    ]
    const bad = texts.filter((t) => jargonIn(t).length)
    expect(bad, bad.join('\n')).toEqual([])
  })

  it('용어집의 쉬운 칸(낱말 · 설명 · 예)에는 개발 말이 없다 — 옛 말은 「예전 말」에만', () => {
    const bad = Object.entries(GLOSSARY).filter(([, t]) =>
      jargonIn(`${t.word} ${t.plain} ${'example' in t ? t.example : ''}`).length,
    )
    expect(bad.map(([id]) => id)).toEqual([])
  })

  it('용어 설명은 한두 문장이다', () => {
    const long = Object.entries(GLOSSARY).filter(([, t]) => (t.plain.match(/[.요다]\s|[.요다]$/g) ?? []).length > 3)
    expect(long.map(([id]) => id)).toEqual([])
  })

  it('지도 전체를 그려도 보이는 글자에 개발 말이 없다 — 「가장 먼저 할 일」 문장 포함', () => {
    const html = renderToString(<FactoryMap stages={STAGES_REAL} pick={PICK} loadError={null} />)
    expect(jargonIn(visibleText(html))).toEqual([])
    for (const s of PLAIN_STEPS) expect(html).toContain(s.name)
  })

  it('걸음 머리띠마다 한 줄 설명이 있고 개발 말이 없다', () => {
    for (const s of PLAIN_STEPS) {
      const html = renderToString(<StepHeader step={s} status="pass" />)
      expect(html, s.name).toContain(s.says)
      expect(jargonIn(visibleText(html)), s.name).toEqual([])
    }
    for (const l of PLAIN_LAB) {
      const html = renderToString(<LabHeader lab={l} status="pass" />)
      expect(html, l.name).toContain(l.says)
      expect(jargonIn(visibleText(html)), l.name).toEqual([])
    }
  })
})

describe('도움말이 있는 화면만 세운다', () => {
  it('공장 지도 · 용어집의 화면도움말이 있다', () => {
    expect(HELP_REGISTRY['csat-map']).toBeDefined()
    expect(HELP_REGISTRY['csat-glossary']).toBeDefined()
  })

  it('지도 도움말에도 개발 말이 없다', () => {
    const h = HELP_REGISTRY['csat-map']!
    expect(jargonIn(JSON.stringify(h))).toEqual([])
  })
})

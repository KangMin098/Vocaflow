// apps/web/src/lib/csat/__tests__/factory.integration.test.ts
//
// 공정 현황판을 **실 DB 로** 한 번 세워 보고 세 가지를 못 박는다.
//
//   ① **눈금이 실제로 채워지는가** — 조회 하나가 조용히 깨지면 그 공정이 영원히 「못 잼」이 되고,
//      관리자는 있지도 않은 결함을 고치러 간다. 공정 8칸 중 눈금이 하나도 없는 칸이 없어야 한다.
//   ② **셈이 DB 와 같은가** — 화면의 「해설 보유」와 「사다리 칸」은 직접 센 수와 일치해야 한다.
//      TBP 콘솔은 65만 행을 1,000행씩 656번 끌어와 센다. 여기는 서버 count 를 쓰므로 **두 길이
//      같은 답을 내는지** 확인해야 의미가 있다.
//   ③ **속도** — 현황판이 분 단위로 걸리면 아무도 안 본다(이 저장소는 잠긴 화면을 아무도 안 봐서
//      이틀간 결함이 남은 적이 있다). 상한을 테스트로 박아 둔다.
//
// SERVICE_ROLE_KEY 없으면 자동 skip (CI).

import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { loadFactoryLine, MARKET_TARGET_INDEX } from '../factory'
import { FACTORY_STAGES } from '../factory-model'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const skip = !SUPABASE_URL || !SERVICE_KEY

describe.skipIf(skip)('교재 공장 공정 현황판 (실 DB)', () => {
  it('공정 8칸이 모두 서고, 눈금 없는 칸이 없다', async () => {
    const t0 = Date.now()
    const line = await loadFactoryLine()
    const elapsed = Date.now() - t0

    expect(line.stages).toHaveLength(FACTORY_STAGES.length)
    expect(line.stages.map((s) => s.def.ord)).toEqual([...FACTORY_STAGES].map((s) => s.ord))

    for (const s of line.stages) {
      expect(s.gauges.length, `${s.def.name} 에 눈금이 없다`).toBeGreaterThan(0)
      expect(s.nextCommands.length, `${s.def.name} 에 다음 명령이 없다`).toBeGreaterThan(0)
    }

    // 현황판은 사람이 기다릴 수 있는 시간 안에 서야 한다. 칸 count 를 병렬로 던지는 설계가
    // 무너져 순차가 되면 여기서 먼저 걸린다.
    expect(elapsed, `현황판 조회가 ${elapsed}ms 걸렸다`).toBeLessThan(30_000)
  })

  it('해설 보유 눈금이 DB 직접 셈과 같다', async () => {
    const svc = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    // ⚠️ **순차로 센다.** 65만 행 전수 count 둘을 병렬로 던지면 하나가 `count=null` 로 돌아온다
    //   (실측 2026-09-05 — 차가운 첫 호출 8.5초 뒤 빈 오류). 대조군이 그러면 테스트가 본체를
    //   검증하는 게 아니라 같은 결함을 두 번 밟는 것이다. 본체는 재시도(`headCount`)로 막는다.
    const { count: total } = await svc
      .from('csat_dcp_items')
      .select('id', { count: 'exact', head: true })
    const { count: done } = await svc
      .from('csat_dcp_items')
      .select('id', { count: 'exact', head: true })
      .not('answer_key->>explanation_ko', 'is', null)

    // ⚠️ 먼저 **직접 센 값이 실제로 있는지** 확인한다. 이걸 빼면 두 쪽이 다 null 일 때
    //   `toBe` 가 통과해 「셈이 맞다」고 초록이 뜬다 — 실제로 2026-09-05 에 그 거짓 초록이
    //   났다(한 물결에 다 던져 전수 count 가 경합으로 null 이었다).
    expect(total, '직접 센 총 문항이 null 이다 — 이 테스트가 아무것도 안 지킨다').toBeGreaterThan(0)
    expect(done, '직접 센 해설 보유가 null 이다').toBeGreaterThan(0)

    const line = await loadFactoryLine()
    const explain = line.stages.find((s) => s.def.id === 'explain')!
    const gauge = explain.gauges.find((g) => g.label === '해설 보유')!
    expect(gauge.den).toBe(total)
    expect(gauge.num).toBe(done)
  })

  it('검수 L2 는 분석 **행**이 아니라 **문항**을 센다 — 통과율이 100%를 넘을 수 없다', async () => {
    const line = await loadFactoryLine()
    const l2 = line.stages.find((s) => s.def.id === 'review')!.gauges[1]!
    expect(l2.num).not.toBeNull()
    expect(l2.den).not.toBeNull()
    // 분석은 버전을 올려 새 행으로 쌓이므로 행을 세면 분모를 훌쩍 넘는다(실측 2,234 / 830).
    expect(l2.num!).toBeLessThanOrEqual(l2.den!)
  })

  it('공정 눈금 중 「못 잼」이 남아 있으면 그 이유가 반드시 적혀 있다', async () => {
    const line = await loadFactoryLine()
    for (const s of line.stages) {
      for (const g of s.gauges) {
        if (g.num == null) {
          expect(g.unmeasuredReason, `${s.def.name} / ${g.label} 이 이유 없이 못 잼이다`).toBeTruthy()
        }
      }
    }
  })

  it('사다리 칸은 초등 3종을 빼고 센다 — 넣으면 초등 계단이 거짓으로 비어 보인다', async () => {
    const line = await loadFactoryLine()
    const pure = ['rhyme', 'word_meaning', 'spell_blank']
    expect(line.cells.some((c) => pure.includes(c.type))).toBe(false)
    expect(line.cells.length).toBeGreaterThan(0)
  })

  it('기획 눈금은 목표 1.200 을 들고 있고, 못 읽었으면 0 이 아니라 null 이다', async () => {
    const line = await loadFactoryLine()
    const market = line.stages.find((s) => s.def.id === 'market')!
    const binding = market.gauges[0]!
    expect(binding.unit).toBe('index')
    expect(binding.target).toBe(MARKET_TARGET_INDEX)
    if (line.bench.volume == null && line.bench.warehouse == null) {
      expect(binding.num).toBeNull()
      expect(binding.unmeasuredReason).toBeTruthy()
    } else {
      expect(typeof binding.num).toBe('number')
    }
  })

  it('검수는 층이 넷이다 — 한 층만 통과한 것을 통과라고 부르지 않는다', async () => {
    const line = await loadFactoryLine()
    const review = line.stages.find((s) => s.def.id === 'review')!
    expect(review.gauges.map((g) => g.label.slice(0, 2))).toEqual(['L1', 'L2', 'L3', 'L4'])
  })
})

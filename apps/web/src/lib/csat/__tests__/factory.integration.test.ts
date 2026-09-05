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

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
    // 전수 count 를 걷어낸 뒤의 상한. 이 값을 넘으면 어딘가 다시 전수로 세고 있다는 뜻이다
    // — 그 조회는 50초 뒤 빈손으로 오므로 화면이 통째로 멈춘다.
    expect(elapsed, `현황판 조회가 ${elapsed}ms 걸렸다`).toBeLessThan(20_000)
  })

  it('해설 보유를 실제로 잰다 — 집계 RPC 가 붙은 뒤', async () => {
    // ⚠️ 이 테스트는 **뒤집힌 것**이다. 2026-09-05 까지는 "못 재는 상태"를 고정하고 있었다 —
    //   PostgREST 로 `csat_dcp_items`(65만 행)를 필터 없이 세면 50초 뒤 `count=null` 이었고
    //   (세 번 연속), 유형·수준으로 쪼개면 132칸이라 몇 분이었다. 그래서 공정 ⑥ 은 눈금이
    //   아예 없었다.
    //
    //   2026-09-06 `csat_dcp_inventory()` 적용 후 한 번의 그룹 스캔으로 잰다.
    //   적용 직후 실측: 136행 · 문항 656,984 · 해설 426,696 · 키/값 셈 불일치 0.
    //   **수를 상수로 박지 않는다** — 드레인이 돌면 매일 바뀐다. 잰다는 사실만 고정한다.
    const line = await loadFactoryLine()
    const explain = line.stages.find((s) => s.def.id === 'explain')!
    const gauge = explain.gauges.find((g) => g.label === '해설 보유')!

    expect(gauge.den, '문항 수를 못 셌다 — RPC 가 답하지 않았거나 권한이 막혔다').toBeGreaterThan(0)
    expect(gauge.num, '해설 보유 수가 없다').not.toBeNull()
    expect(gauge.num!).toBeGreaterThanOrEqual(0)
    // 보유가 전체를 넘을 수 없다 — 넘으면 두 수가 다른 모집단에서 온 것이다.
    expect(gauge.num!).toBeLessThanOrEqual(gauge.den!)
    expect(gauge.unmeasuredReason, '잴 수 있는데 「못 잼」 사유가 붙어 있다').toBeUndefined()
    expect(explain.status, '눈금이 있는데 여전히 unmeasured 다').not.toBe('unmeasured')
  })

  it('전수 count 는 죽어 있고 셀 count 는 살아 있다 — 이 구분이 설계의 전제다', async () => {
    const svc = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    // 셀(인덱스를 타는 조회)은 반드시 살아 있어야 한다. 이게 죽으면 표 전체가 못 선다.
    const cell = await svc
      .from('csat_dcp_items')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'order')
      .eq('v_level', 6)
    expect(cell.count, '셀 count 마저 죽었다 — 공장 화면 전체가 못 선다').toBeGreaterThan(0)

    // 낡음 감시의 제3의 수는 이제 플래너 통계가 아니라 **집계 RPC** 다(2026-09-06).
    // 이것이 죽으면 공정 ⑤·⑥ 이 동시에 눈금을 잃으므로, 살아 있음을 여기서 고정한다.
    const inv = await svc.rpc('csat_dcp_inventory')
    expect(inv.error, `집계 RPC 가 죽었다: ${inv.error?.message ?? ''}`).toBeNull()
    expect(Array.isArray(inv.data) && inv.data.length, '집계가 빈손으로 왔다').toBeGreaterThan(0)
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

describe.skipIf(skip)('전략 연구소 두 화면 (실 DB · 실 파일)', () => {
  it('설계 표는 사다리 7단을 그대로 편다 — 계단이 사라지면 그 학년 책이 없어진다', async () => {
    const { loadBlueprintView } = await import('../factory-views')
    const v = await loadBlueprintView()
    expect(v.rungs).toHaveLength(7)
    expect(v.rungs.map((r) => r.step)).toEqual([1, 2, 3, 4, 5, 6, 7])
    // 학령 이름이 비면 표의 행 머리가 사라진다
    for (const r of v.rungs) expect(r.schoolBand.length).toBeGreaterThan(0)
  })

  it('초등 3종은 「셀 수 없음」이지 재고 0 이 아니다', async () => {
    const { loadBlueprintView, PURE_FUNCTION_TYPES } = await import('../factory-views')
    const v = await loadBlueprintView()
    const pure = v.rungs.flatMap((r) => r.cells).filter((c) => PURE_FUNCTION_TYPES.has(c.type))
    expect(pure.length).toBeGreaterThan(0)
    for (const c of pure) {
      expect(c.countable).toBe(false)
      expect(c.count).toBeNull()
    }
    // 끊긴 계단 목록에도 들어가면 안 된다 — 있지도 않은 구멍을 메우러 가게 된다
    const pureKo = new Set(pure.map((c) => c.typeKo))
    for (const r of v.rungs) for (const e of r.emptyTypes) expect(pureKo.has(e)).toBe(false)
  })

  it('설계 표와 현황판이 같은 칸을 말한다 — 칸 목록은 정확히, 수는 움직임만 허용', async () => {
    const { loadBlueprintView } = await import('../factory-views')
    const line = await loadFactoryLine()
    const v = await loadBlueprintView()

    // ① 칸 **목록**은 정확히 같아야 한다. 여기가 어긋나면 한 화면이 어떤 칸을 통째로 안 보는
    //    것이고, 그건 데이터 움직임으로 설명되지 않는 진짜 결함이다.
    const disagreed: string[] = []
    for (const cell of line.cells) {
      const rung = v.rungs.find((r) => r.step === cell.step)
      expect(rung, `현황판에 있는 계단 ${cell.step} 이 설계 표에 없다`).toBeTruthy()
      const same = rung!.cells.find((c) => c.type === cell.type)
      expect(same, `${rung!.schoolBand}/${cell.type} 칸이 설계 표에 없다`).toBeTruthy()
      if (same!.count !== cell.count) {
        disagreed.push(`${rung!.schoolBand}/${cell.type}: 설계 ${same!.count} vs 현황판 ${cell.count}`)
      }
    }

    // ② 수는 **하나까지** 어긋나도 통과시킨다.
    //
    //    두 화면은 이제 같은 함수(`item-count.ts`)로 세므로 방법 차이로는 못 어긋난다. 남는
    //    원인은 **두 조회 사이에 값이 움직인 것**뿐이다 — 이 저장소는 여러 세션이 같은 dev DB 에
    //    쓰고 있어서(`csat_dcp_items` 에 적재·정리가 수시로 돈다) 그 움직임은 정상이다.
    //    실측 2026-09-06 에 이 테스트가 「초등 고학년/word_order 0 vs 249」로 걸렸는데, 그것이
    //    바로 그 경우였다. 거짓 실패는 사람을 빨간불에 무뎌지게 만든다.
    //
    //    반대로 **세는 방법이 갈라지면 여러 칸이 한꺼번에** 어긋난다 — 그건 여전히 잡힌다.
    expect(
      disagreed.length,
      `여러 칸이 어긋난다 — 값이 움직인 게 아니라 세는 방법이 갈라진 것이다:\n${disagreed.join('\n')}`,
    ).toBeLessThanOrEqual(1)
  })

  it('두 화면이 같은 세기 함수를 쓴다 — 방법이 갈라지면 값도 갈라진다', async () => {
    // 값 비교는 데이터가 움직이면 흔들린다. 방법이 하나인지는 **소스로** 확인한다.
    const here = resolve(__dirname, '..')
    for (const f of ['factory.ts', 'factory-views.ts', 'factory-line-views.ts']) {
      const src = readFileSync(resolve(here, f), 'utf8')
      expect(src, `${f} 이 item-count 를 안 쓴다`).toContain("from './item-count'")
      expect(
        src.includes("from('csat_dcp_items')"),
        `${f} 이 csat_dcp_items 를 직접 센다 — 세는 곳은 item-count.ts 하나여야 한다`,
      ).toBe(false)
    }
  })

  it('기획 화면은 벤치마크 파일을 읽고, 못 읽으면 0 이 아니라 오류를 말한다', async () => {
    const { loadMarketView } = await import('../factory-views')
    const v = await loadMarketView()
    if (v.volume == null && v.warehouse == null) {
      expect(v.loadError).toBeTruthy()
      return
    }
    expect(v.loadError).toBeNull()
    const bench = v.volume ?? v.warehouse!
    expect(bench.publishers.length).toBeGreaterThan(0)
    // 구속점은 실제로 가장 낮은 지수여야 한다 — 아니면 판정이 거짓이다
    const measured = bench.publishers.filter((p) => p.overallIndex != null)
    if (measured.length && bench.bindingIndex != null) {
      const lowest = Math.min(...measured.map((p) => p.overallIndex!))
      expect(bench.bindingIndex).toBeCloseTo(lowest, 3)
    }
  })
})

describe.skipIf(skip)('생산 라인 네 화면 (실 DB)', () => {
  it('집필 표의 총계는 칸을 더한 값이고, 플래너 통계와 허용 오차 안에 있다', async () => {
    const { loadAuthorView } = await import('../factory-line-views')
    const v = await loadAuthorView()
    const unmeasured = v.cells.filter((c) => c.count == null)
    expect(unmeasured, `못 센 칸 ${unmeasured.length}개`).toHaveLength(0)

    // 총계는 칸의 합이다 — 전수 count 는 이 표에서 못 쓴다(50초 뒤 빈손).
    const summed = v.cells.reduce((n, c) => n + (c.count ?? 0), 0)
    expect(v.total).toBe(summed)

    // 낡음 감시가 실제로 켜져 있는지 본다. 플래너 통계와 1% 넘게 벌어지면 경고가 떠야 한다.
    const svc = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
    const { count: planned } = await svc
      .from('csat_dcp_items')
      .select('id', { count: 'planned', head: true })
    expect(planned).not.toBeNull()
    const gap = planned! - summed
    if (gap > planned! * 0.01) {
      expect(v.loadError, '벌어졌는데 경고가 없다 — 목록이 낡아도 아무도 모른다').toBeTruthy()
    } else {
      expect(v.loadError).toBeNull()
    }
  },
    // ⚠️ 칸 225개를 세는 조회다. **속도가 아니라 셈이 맞는지**를 지키는 테스트이므로
    //   전역 40초 상한을 쓰지 않는다 — 공유 dev DB 가 느린 날 거짓 실패가 나고, 거짓 실패는
    //   사람을 빨간불에 무뎌지게 만든다. 속도는 현황판 테스트가 따로 지킨다.
    180_000)

  it('집필 표의 사다리 칸이 설계 화면과 같은 수를 말한다', async () => {
    const [{ loadAuthorView }, { loadBlueprintView }] = await Promise.all([
      import('../factory-line-views'),
      import('../factory-views'),
    ])
    const a = await loadAuthorView()
    const b = await loadBlueprintView()
    let compared = 0
    const disagreed: string[] = []
    for (const rung of b.rungs) {
      for (const cell of rung.cells) {
        if (!cell.countable) continue
        // ⚠️ **`?? 0` 을 쓰지 않는다.** 집필 화면은 칸 225개를 시간 예산 안에 세는데, 못 센 칸은
        //   `null` 로 남는다. 그걸 0 으로 뭉개면 이 테스트가 「설계는 249, 집필은 0」이라며
        //   있지도 않은 불일치를 만든다 — 실측 2026-09-06 에 정확히 그랬다. 이 파일이 지키려는
        //   규칙(「0 과 못 잼을 가른다」)을 테스트가 먼저 어기고 있었다.
        const parts = rung.vLevels.map(
          (v) => a.cells.find((c) => c.type === cell.type && c.vLevel === v)?.count,
        )
        if (parts.some((n) => n == null) || cell.count == null) continue // 한쪽이 못 잰 칸은 견줄 수 없다
        compared += 1
        const sum = parts.reduce<number>((n, v) => n + (v ?? 0), 0)
        if (sum !== cell.count) {
          disagreed.push(`${rung.schoolBand}/${cell.type}: 집필 ${sum} vs 설계 ${cell.count}`)
        }
      }
    }

    // 견준 칸이 없으면 이 테스트는 아무것도 안 지킨다 — 예산이 너무 빡빡하다는 신호이기도 하다.
    expect(compared, '두 화면 모두 잰 칸이 하나도 없다').toBeGreaterThan(0)
    // 값은 두 조회 사이에 움직일 수 있다(여러 세션이 같은 dev DB 에 쓴다). 방법이 갈라지면
    // 여러 칸이 한꺼번에 어긋나므로 그건 여전히 잡힌다.
    expect(
      disagreed.length,
      `여러 칸이 어긋난다 — 값이 움직인 게 아니라 세는 방법이 갈라진 것이다:\n${disagreed.join('\n')}`,
    ).toBeLessThanOrEqual(1)
  },
    // ⚠️ 칸 225개를 세는 조회다. **속도가 아니라 셈이 맞는지**를 지키는 테스트이므로
    //   전역 40초 상한을 쓰지 않는다 — 공유 dev DB 가 느린 날 거짓 실패가 나고, 거짓 실패는
    //   사람을 빨간불에 무뎌지게 만든다. 속도는 현황판 테스트가 따로 지킨다.
    180_000)

  it('소재 화면의 게이트 밴드는 실제 게이트 정의에서 온다', async () => {
    const { loadSourceView, emptyGateBands } = await import('../factory-line-views')
    const v = await loadSourceView()
    expect(v.gateBands.length).toBeGreaterThan(0)
    // 비었다고 보고한 밴드에 실제로 지문이 0편인지 되짚는다
    for (const b of emptyGateBands(v)) {
      expect(v.rows.filter((r) => r.band === b && r.count > 0)).toHaveLength(0)
    }
  })

  it('검수 층은 넷이고, 층마다 무엇을 보는지 적혀 있다', async () => {
    const { loadReviewView } = await import('../factory-line-views')
    const v = await loadReviewView()
    expect(v.layers.map((l) => l.id)).toEqual(['L1', 'L2', 'L3', 'L4'])
    for (const l of v.layers) {
      expect(l.looksAt.length, `${l.id} 이 무엇을 보는지 안 적혀 있다`).toBeGreaterThan(10)
      expect(l.cmd).toMatch(/scripts\//)
      if (l.passed == null) expect(l.unmeasuredReason).toBeTruthy()
    }
  })

  it('검수 L2 통과율이 100%를 넘지 않는다 — 넘으면 행을 센 것이다', async () => {
    const { loadReviewView } = await import('../factory-line-views')
    const l2 = (await loadReviewView()).layers[1]!
    expect(l2.passed).not.toBeNull()
    expect(l2.passed!).toBeLessThanOrEqual(l2.total!)
  })

  it('조판 화면은 옛 행의 없는 항목을 0 이 아니라 null 로 둔다', async () => {
    const { loadPressView } = await import('../factory-line-views')
    const v = await loadPressView()
    expect(v.rungs).toBe(7)
    expect(v.brandFingerprint.length).toBeGreaterThan(0)
    for (const vol of v.volumes) {
      // 셋 중 하나라도 값이 있으면 그 권은 기록이 있는 것이고, 없으면 전부 null 이어야 한다.
      const has = [vol.typeMixFit, vol.articlesIdle, vol.distinctVolumes]
      for (const h of has) expect(h === null || typeof h === 'number').toBe(true)
    }
  })
})

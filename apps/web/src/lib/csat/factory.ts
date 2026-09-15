// apps/web/src/lib/csat/factory.ts
//
// **교재 공장 실측** — `factory-model.ts` 의 공정 8칸에 DB·리포트에서 잰 수를 꽂는다.
//
// ── 왜 조회를 이렇게 쪼개나 ──────────────────────────────────────────
// `csat_dcp_items` 는 65만 행이다. TBP 콘솔은 이 표를 **1,000행씩 656번** 끌어와 메모리에서 센다.
// 같은 짓을 여기서 또 하면 현황판 한 번 여는 데 분 단위가 걸린다. 그래서 이 파일은 **행을 받지
// 않는다** — 재고는 미리 계산된 집계표에서 한 번에 읽는다(`item-count.ts`).
//
// ⚠️ PostgREST 집계 함수는 이 프로젝트에서 **꺼져 있다**(`PGRST123: Use of aggregate functions is
//   not allowed`). 그래서 `select=type,v_level,count()` 한 방으로는 못 접는다 — 실측으로 확인했다.
//   2026-09-06 부터 그 자리는 **이미 있던 집계표**(`textbook_shelf_inventory_mv` · 30분 갱신)가
//   대신한다 — 읽기 1.2초에 (유형 × 수준) 132칸의 문항 수와 해설 보유 수가 함께 온다.
//   그 전에는 칸마다 조회를 따로 던져 15초 예산을 넘기면 회색으로 남았고(실측 29~133칸),
//   **화면마다 다른 수를 말할 수 있었다.** 공정 ⑥ 해설이 눈금을 갖게 된 것도 이것 덕이다.
//   (새 집계 RPC 를 만들었다가 버린 경위는 `item-count.ts` 의 `loadDcpInventory` 주석.)
//
// ⚠️ **없는 것과 0 을 가른다.** `head:true` 는 없는 테이블에도 204/count=null 을 돌려준다
//   (이 저장소가 이미 당한 함정). 그래서 count 가 null 이면 눈금을 `num: null` 로 두고
//   화면이 "못 잼" 이라고 말하게 한다 — 0 으로 뭉개면 "재고 없음" 이라는 거짓 경보가 된다.

import 'server-only'

import { SERIES_SPINE, brandFingerprint, type SeriesItemType } from '@vocaflow/library-pipeline'
import {
  bandStock,
  emptyPassageBands,
  type SourceRollup,
  type StageGateRow,
} from '@vocaflow/library-pipeline/source-rollup'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'

import { countItemCells, inventoryFreshnessNote, loadDcpInventory } from './item-count'

import {
  BENCH_FILES,
  MARKET_TARGET_INDEX,
  readBench,
  withTimeout,
  type BenchFile,
} from './factory-bench'

// 화면·테스트가 목표 지수를 이 파일에서 함께 읽어 온다 — 정본은 `factory-bench.ts` 다.
export { MARKET_TARGET_INDEX } from './factory-bench'

import {
  FACTORY_STAGES,
  judgeStage,
  type StageCommand,
  type StageDef,
  type StageGauge,
  type StageId,
  type StageState,
} from './factory-model'

/**
 * 초등 3종은 **DB 에 없다** — 사전의 순수 함수라 저장할 이유가 없다(`series.ts` 주석).
 * 재고를 셀 때 이 셋을 빼지 않으면 초등 계단이 거짓으로 "재고 0" 이 되고, 관리자는 있지도 않은
 * 구멍을 메우러 간다.
 */
const PURE_FUNCTION_TYPES: ReadonlySet<string> = new Set(['rhyme', 'word_meaning', 'spell_blank'])

/** 사다리가 실제로 DB 에서 세야 하는 유형 — 중복 없이. */
function dbBackedTypes(): SeriesItemType[] {
  const out = new Set<SeriesItemType>()
  for (const rung of SERIES_SPINE) {
    for (const t of rung.types) if (!PURE_FUNCTION_TYPES.has(t)) out.add(t)
  }
  return [...out]
}

/** 사다리 계단 × 유형 칸 — DB 로 셀 수 있는 것만. */
interface Cell {
  step: number
  schoolBand: string
  vLevel: number
  type: SeriesItemType
  count: number | null
}

/** 사다리 칸 전부를 **병렬로** 센다. 순차로 던지면 30칸이 30번의 왕복이 된다. */
async function loadLadderCells(db: SupabaseClient): Promise<Cell[]> {
  const specs: Omit<Cell, 'count'>[] = []
  for (const rung of SERIES_SPINE) {
    // 한 계단이 여러 V-Level 을 쓰는 경우는 지금 없지만(전부 1:1), 규격이 배열이므로 그대로 편다.
    for (const v of rung.vLevels) {
      for (const t of rung.types) {
        if (PURE_FUNCTION_TYPES.has(t)) continue
        specs.push({ step: rung.step, schoolBand: rung.schoolBand, vLevel: v, type: t })
      }
    }
  }
  // 세는 방법은 `item-count.ts` 하나뿐이다 — 화면마다 따로 세면 같은 칸을 다른 수로 말한다.
  const counts = await countItemCells(db, specs)
  return specs.map((s, i) => ({ ...s, count: counts[i] ?? null }))
}

export interface FactoryLine {
  stages: StageState[]
  /** 사다리 칸 실측 — 설계·집필 화면이 다시 안 재도 되게 같이 내려보낸다. */
  cells: Cell[]
  /** 두 벤치마크(창고·권). 못 읽었으면 null. */
  bench: { warehouse: BenchFile | null; volume: BenchFile | null }
  /** 조회 자체가 깨졌을 때만. 개별 눈금의 "못 잼" 과 다르다. */
  loadError: string | null
}

/* ───────────────────────── 공정별 실측 ───────────────────────── */

function defOf(id: StageId): StageDef {
  const d = FACTORY_STAGES.find((s) => s.id === id)
  if (!d) throw new Error(`공정 정의가 없다: ${id}`)
  return d
}

/**
 * 공정 하나를 세운다 — **게이트가 요구한 눈금이 빠져 있으면 통과시키지 않는다.**
 *
 * ⚠️ 실측 2026-09-05: ⑧ 조판의 게이트는 「최신 규격으로 조판된 권이 있는가」인데 눈금은 규격을
 * 안 보고 계단 수만 세어, 7단이 전부 옛 규격이어도 「7/7 통과」 초록이 떴다. 게이트는 문장이라
 * 무엇이든 약속할 수 있고 눈금은 코드라 따로 논다 — 그 어긋남이 **초록**으로 나오는 것이 최악이다.
 *
 * 그래서 `def.gateGauges` 에 적힌 라벨의 눈금이 없으면 여기서 **「못 잼」 눈금을 대신 꽂는다.**
 * 빠뜨린 자리가 통과가 아니라 회색으로 보이고, 화면이 "무엇을 안 재고 있는지" 를 말한다.
 * 지우는 것이 아니라 더하는 이유는, 눈금을 실수로 빼도 **조용해지지 않게** 하기 위해서다.
 */
function state(
  id: StageId,
  gauges: StageGauge[],
  blocker: string | null,
  nextCommands: StageCommand[],
): StageState {
  const def = defOf(id)
  const missing = def.gateGauges.filter((want) => !gauges.some((g) => g.label.includes(want)))
  const withGate: StageGauge[] = [
    ...gauges,
    ...missing.map<StageGauge>((want) => ({
      label: want,
      num: null,
      den: null,
      unit: 'ratio',
      unmeasuredReason: `게이트가 요구하는 눈금인데 실측이 없다 — 「${def.gate}」를 아무도 안 재고 있다`,
    })),
  ]
  const status = judgeStage(withGate)
  return {
    def,
    status,
    gauges: withGate,
    blocker: status === 'pass' ? null : blocker,
    nextCommands,
  }
}

export async function loadFactoryLine(): Promise<FactoryLine> {
  const db = createAdminClient() as unknown as SupabaseClient

  // ── 조회를 두 물결로 나눈다 ────────────────────────────────────────
  // 한 물결에 다 던졌더니 **65만 행 전수 count 두 개가 조용히 null 로 돌아왔다**
  // (실측 2026-09-05: 따로 던지면 8.3초·7.7초에 정상, 같이 던지면 null). 그 상태로
  // 화면은 「집필 · 해설 못 잼」이라고 적었고, 그것은 사실이 아니라 **경합의 흔적**이었다.
  // 가벼운 조회 + 사다리 칸(26개)이 1물결, 무거운 전수 count 둘이 2물결이다.
  const [coverage, gates, snapshot, cells, renders, warehouse, volume] =
    await Promise.all([
      withTimeout(db.rpc('csat_coverage'), 8_000, {
        data: null,
        error: { message: '8초 안에 안 돌아왔다' },
      } as Awaited<ReturnType<typeof db.rpc>>),
      db.from('csat_stage_gates').select('stage, metric, threshold, is_locked'),
      // ④ 소재의 분모 — **발행분 뷰가 아니라 재고 스냅샷이다.**
      //   `csat_stage_catalog` 는 양쪽 갈래가 다 `status = published` 라, 그것으로 세던
      //   562편은 출고분이었다(실측 2026-09-13: 조판 풀은 87,556편). 같은 공장 안에서
      //   ④ 화면과 이 눈금이 서로 다른 수를 말하지 않도록 **한 스냅샷을 같이 읽는다.**
      db
        .from('csat_source_snapshots')
        .select('taken_at, payload')
        .order('taken_at', { ascending: false })
        .limit(1),
      loadLadderCells(db),
      // 검수 기록은 별도 컬럼이 아니라 `colophon.review` 안에 있다 — 조판기가 찍은 그 값이어야
      // 화면과 손에 쥔 책이 같은 것을 말한다(`lib/textbook/console-stats.ts` 와 같은 규약).
      db.from('textbook_volume_renders').select('band, colophon, brand_fingerprint'),
      readBench(BENCH_FILES.warehouse),
      readBench(BENCH_FILES.volume),
    ])

  // ⚠️ 여기 있던 것: 저장 문항은 `count: 'planned'` 추정치로, 해설 보유는 **「못 잼」**으로.
  //   필터 없는 전수 count 가 65만 행에서 50초 뒤 `count=null` 로 돌아왔기 때문이다
  //   (실측 2026-09-05, 세 번 연속). 유형·수준으로 쪼개면 셀마다는 되지만 재고가 있는 칸이
  //   132개라 다 돌면 몇 분이었다. 그래서 공정 ⑥ 은 눈금 자체가 없었다.
  //
  //   2026-09-06 — **이미 있던 집계표**(`textbook_shelf_inventory_mv`, 30분 주기 갱신)를
  //   읽는 것으로 끝났다. 새로 만든 `csat_dcp_inventory()` 는 값은 맞았지만 앱 경로로
  //   60초에도 안 왔고, 그 처방으로 적은 "matview 를 만들자" 는 것이 **이미 있었다**.
  //   읽기 1.2초 · 136행 · 문항 656,984(실측). 추정치가 아니라 실측이고, 저장 문항과
  //   해설 보유를 **함께** 준다 — 공정 ⑥ 이 눈금을 갖게 된 것이 이것 덕이다.
  const inventory = await loadDcpInventory(db)
  const itemsTotal = inventory.ok ? inventory.items : null

  const stages: StageState[] = []

  /* ① 기출 원천 — 회차별 사정권 배점을 덮었는가. */
  {
    const rows = (coverage.data ?? []) as { covers_99: boolean; scope_points: number }[]
    const scored = rows.filter((r) => r.scope_points > 0)
    const covered = scored.filter((r) => r.covers_99).length
    const failed = coverage.error != null
    stages.push(
      state(
        'evidence',
        [
          {
            label: '독해 실점 0 회차',
            num: failed ? null : covered,
            den: failed ? null : scored.length,
            unit: 'ratio',
            unmeasuredReason: failed ? `커버리지 RPC 실패: ${coverage.error?.message}` : undefined,
          },
        ],
        `배점이 있는 ${scored.length}회차 중 ${scored.length - covered}회차가 아직 사정권을 다 못 덮었다`,
        [
          {
            cmd: 'node scripts/csat/analysis-drain-export.mjs --limit 6',
            why: '남은 몫을 청크로 뽑는다 — 이미 3인 검수를 통과한 문항은 안 나온다(재실행 안전)',
          },
          {
            cmd: 'Claude Code: csat-item-analyst 서브에이전트로 청크를 채운다',
            why: '분석은 LLM 이 쓴다. 명세는 scripts/csat/analysis-drain/_PROMPT.md',
            claudeCode: true,
          },
          {
            cmd: 'node scripts/csat/analysis-drain-validate.mjs',
            why: '인용이 지문에 문자 그대로 있는지·정답이 평가원 정답표와 같은지 기계가 먼저 막는다',
          },
          {
            cmd: 'node scripts/csat/analysis-drain-import.mjs --commit',
            why: '게이트가 exit 0 일 때만 적재한다',
            writes: true,
          },
        ],
      ),
    )
  }

  /* ② 기획 — 구속 출판사 지수가 1.200 에 닿았는가. 창고가 아니라 **권**이 출간물 기준이다. */
  {
    const b = volume ?? warehouse
    stages.push(
      state(
        'market',
        [
          {
            label: `구속 출판사 지수${b?.bindingPublisher ? ` (${b.bindingPublisher})` : ''}`,
            num: b?.bindingIndex ?? null,
            den: null,
            unit: 'index',
            target: MARKET_TARGET_INDEX,
            unmeasuredReason: b ? undefined : '벤치마크 리포트를 못 읽었다 — market-benchmark 를 돌린다',
          },
          {
            label: '합본 지수',
            num: b?.pooledIndex ?? null,
            den: null,
            unit: 'index',
            target: MARKET_TARGET_INDEX,
            unmeasuredReason: b ? undefined : '벤치마크 리포트 없음',
          },
        ],
        b
          ? `구속점은 ${b.bindingPublisher ?? '미상'} ${b.bindingIndex?.toFixed(3) ?? '—'} — 합본 평균이 이걸 감춘다`
          : '벤치마크를 아직 안 쟀다',
        [
          {
            cmd: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/market-benchmark.mjs --per-publisher',
            why: '출판사별로 따로 잰다 — 합본 평균은 쪽수 가중이라 특정 출판사에 지는 것을 감춘다',
          },
          {
            cmd: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/gen-benchmark-report.mjs',
            why: '리포트의 생성 블록을 갱신한다 — 문서에 숫자를 손으로 적지 않기 위해서',
            writes: true,
          },
        ],
      ),
    )
  }

  /* ③ 설계 — 사다리가 선언한 유형을 생산 라인이 실제로 만들 수 있는가. */
  {
    const gateRows = (gates.data ?? []) as { stage: string }[]
    const gateStages = new Set(gateRows.map((r) => r.stage))
    const declared = dbBackedTypes()
    const producible = declared.filter((t) => cells.some((c) => c.type === t && (c.count ?? 0) > 0))
    stages.push(
      state(
        'blueprint',
        [
          {
            label: '사다리가 선언한 유형 중 생산 가능',
            num: producible.length,
            den: declared.length,
            unit: 'ratio',
          },
          {
            label: '단계 게이트 임계 정의 (S1~S5)',
            num: gates.error ? null : gateStages.size,
            den: gates.error ? null : 5,
            unit: 'ratio',
            unmeasuredReason: gates.error ? `게이트 조회 실패: ${gates.error.message}` : undefined,
          },
        ],
        declared.length === producible.length
          ? '단계 게이트 임계가 덜 정의됐다'
          : `분류표가 선언했는데 아무도 못 만드는 유형: ${declared.filter((t) => !producible.includes(t)).join(' · ')}`,
        [
          {
            cmd: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/series-report.mjs',
            why: '학령 7단이 다 찼는지 본다 — 초등 3종은 그 자리에서 생성해 세므로 DB 에 없어도 나온다',
          },
          {
            cmd: 'node scripts/csat/build-blueprint.mjs',
            why: '기출 분석에서 유형별 설계도를 다시 접는다',
          },
        ],
      ),
    )
  }

  /* ④ 소재 — 지문으로 채우는 밴드에 재고가 있는가.

     ⚠️ 밴드 판정을 **게이트의 metric** 에 맡긴다. 예전에는 「합격선이 있는데 지문 0편」
        하나로 판정해서 S5 가 늘 빨갛게 서 있었는데, S5 의 합격선은 `listening` 하나뿐이라
        **지문을 수확해서 채우는 칸이 아니다.** 수확을 아무리 해도 안 꺼지는 경보는 소음이고,
        소음은 옆의 진짜 경보까지 안 보이게 만든다. 셈법은 `source-rollup.ts` §6 한 벌. */
  {
    const gateRows = (gates.data ?? []) as StageGateRow[]
    const snapRow = ((snapshot.data ?? []) as { payload: SourceRollup }[])[0] ?? null
    const rollup = snapRow?.payload ?? null
    const stock = rollup ? bandStock(rollup, gateRows) : []
    const passage = stock.filter((b) => b.gated)
    const filled = passage.filter((b) => b.n > 0)
    const empty = emptyPassageBands(stock)
    const failed = snapshot.error != null || gates.error != null || rollup == null
    const why = snapshot.error
      ? `재고 스냅샷 조회 실패: ${snapshot.error.message}`
      : gates.error
        ? `게이트 조회 실패: ${gates.error.message}`
        : rollup == null
          ? '스냅샷이 아직 한 번도 안 떠졌다 — ④ 소재의 「지금 다시 잰다」'
          : undefined
    stages.push(
      state(
        'source',
        [
          {
            label: '지문으로 채우는 밴드 중 재고 보유',
            num: failed ? null : filled.length,
            den: failed ? null : passage.length,
            unit: 'ratio',
            unmeasuredReason: why,
          },
          {
            label: '조판 풀',
            num: rollup ? rollup.pool.n : null,
            den: null,
            unit: 'count',
            unmeasuredReason: why,
          },
        ],
        empty.length
          ? `${empty.join(' · ')} 밴드에 지문이 0편 — 그 단계 책은 지금 못 만든다`
          : '지문으로 채우는 밴드를 재고가 덮었다',
        [
          {
            cmd: 'node scripts/csat/harvest-plos.mjs',
            why: '학술 개방 접근에서 상위 밴드 지문을 수확한다 (커서가 남아 재실행 안전)',
            writes: true,
          },
          {
            cmd: 'node scripts/textbook/harvest-gutenberg-kid.mjs',
            why: '아래 밴드(초·중등) 지문을 수확한다',
            writes: true,
          },
          {
            cmd: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/graded-source-probe.mjs',
            why: '수확한 것이 그 밴드 규격(어휘 커버리지·문장 수)에 드는지 먼저 잰다 — 읽기만 한다',
          },
        ],
      ),
    )
  }

  /* ⑤ 집필 — 사다리 칸 중 재고 0인 자리. */
  {
    const measurable = cells.filter((c) => c.count != null)
    const filled = measurable.filter((c) => (c.count ?? 0) > 0)
    const emptyCells = measurable.filter((c) => c.count === 0)
    stages.push(
      state(
        'author',
        [
          {
            label: '사다리 칸 중 재고 있음',
            num: measurable.length ? filled.length : null,
            den: measurable.length ? measurable.length : null,
            unit: 'ratio',
            unmeasuredReason: measurable.length ? undefined : '칸 조회가 전부 실패했다',
          },
          {
            label: '저장 문항 (추정)',
            num: itemsTotal,
            den: null,
            unit: 'count',
            approx: true,
            unmeasuredReason:
              itemsTotal == null
                ? `문항 수를 못 셌다: ${inventory.ok ? '' : inventory.error}`
                : '플래너 통계값이다 — 정확한 수는 집필 화면이 칸을 더해서 낸다',
          },
        ],
        emptyCells.length
          ? `빈 칸 ${emptyCells.length}개 — ${emptyCells
              .slice(0, 4)
              .map((c) => `${c.schoolBand}/${c.type}`)
              .join(' · ')}${emptyCells.length > 4 ? ' 외' : ''}`
          : itemsTotal == null
            ? '칸은 다 찼는데 총계를 못 셌다 — 재고가 있다는 근거가 반쪽이다'
            : '사다리 칸이 모두 찼다',
        [
          {
            cmd: 'pnpm dlx tsx scripts/textbook/store-new-types.mjs',
            why: '인자 없이 돌리면 아무것도 쓰지 않고 새로 넣을 몫과 낡은 문항만 센다',
          },
          {
            cmd: 'pnpm dlx tsx scripts/textbook/store-new-types.mjs --band 5 --commit',
            why: '이미 쓰여 있는 원글에 문항을 붙인다 — 새 글을 쓰기 전에 이것이 먼저다 (재실행 안전)',
            writes: true,
          },
          {
            cmd: 'pnpm dlx tsx scripts/textbook/write-drain-export.mjs --band 3 --size 6',
            why: '문항이 아니라 원글이 모자란 밴드는 여기서 슬롯을 뽑아 Claude Code 가 쓴다',
            claudeCode: true,
          },
        ],
      ),
    )
  }

  /* ⑥ 해설 — 문항마다 해설이 붙었는가. */
  {
    // 2026-09-06 부터 잰다 — 30분마다 갱신되는 집계표에서 읽는다.
    // **수를 상수로 박지 않는다.** 드레인이 돌면 매일 바뀌고, 박으면 화면이 낡은 수를
    // 현재 사실처럼 말하게 된다.
    const total: number | null = inventory.ok ? inventory.items : null
    const done: number | null = inventory.ok ? inventory.explained : null
    stages.push(
      state(
        'explain',
        [
          {
            label: '해설 보유',
            num: done,
            den: total,
            unit: 'ratio',
            target: 1,
            unmeasuredReason:
              done == null || total == null
                ? `집계표를 못 읽었다 — ${inventory.ok ? '' : inventory.error}`
                : undefined,
            // 30분마다 갱신되는 집계표라 **지금 값이 아닐 수 있다.** 그 사실을 눈금이 말한다 —
            // 드레인을 막 돌린 직후에는 아직 반영되지 않았을 수 있다.
            note: inventory.ok ? inventoryFreshnessNote(inventory.refreshedAt) : undefined,
          },
        ],
        total != null && done != null
          ? `해설 없는 문항 ${(total - done).toLocaleString()}개 — 이 상태로 조판하면 해설 빠진 책이 나온다`
          : '해설 보유율을 못 잰다 — 집계 RPC 가 붙기 전까지는 이 칸이 통과인지 아닌지 알 수 없다',
        [
          {
            cmd: 'pnpm dlx tsx scripts/textbook/explain-fill.mjs --commit',
            why: '규칙으로 쓸 수 있는 해설을 먼저 채운다 — 건너뛰면 다음 단계가 "쓸 몫 0" 이라고 거짓말한다 (재실행 안전)',
            writes: true,
          },
          {
            cmd: 'pnpm dlx tsx scripts/textbook/explain-drain-export.mjs --band 6 --volume 20 --size 12',
            why: '그 권에 실제로 실릴 문항 중 해설 없는 것만 청크로 뽑는다 (읽기만 · 재실행 안전)',
          },
          {
            cmd: 'Claude Code: chunk-NN.json 을 읽어 chunk-NN.out.json 으로 채운다',
            why: '해설은 LLM 이 쓴다 — API 키를 기다리지 않는다',
            claudeCode: true,
          },
          {
            cmd: 'pnpm dlx tsx scripts/textbook/explain-drain-import.mjs --band 6 --commit',
            why: 'answer_key 에 explanation_ko 키 하나만 더한다 — 통째로 덮으면 정답 키가 날아간다',
            writes: true,
          },
        ],
      ),
    )
  }

  /* ⑦ 검수 — 다층. 한 층만 통과한 것은 통과가 아니다. */
  const renderRows = (renders.data ?? []) as {
    band: number
    colophon: {
      review?: {
        answerBias?: unknown
        proofread?: unknown
        /** 조판기가 그 권을 찍을 때 잰 3인 페르소나 검수. 옛 행에는 없다(null 로 남는다). */
        personaReview?: { items?: number; passed?: number } | null
      }
    } | null
    brand_fingerprint: string | null
  }[]
  {
    // ── L2 는 **교재 문항**을 센다 ─────────────────────────────────────
    //
    // ⚠️ 이 눈금은 두 번 틀렸고, 두 번째는 **고쳤다고 적어 둔 뒤에도 여기만 안 고쳐져** 있었다.
    //
    //   ① 처음에는 `csat_item_analyses` 의 published **행 수**를 썼다. 그 표는 분석을 덮지 않고
    //      버전을 올려 새 행으로 넣으므로 "검수 통과 2,234 / 사정권 830" 이라는 270% 짜리
    //      눈금이 나왔다 — 통과율이 아니라 버전 수였다.
    //   ② 그래서 `csat_coverage()`(문항 단위)로 옮겼다. 수는 맞았지만 **모집단이 틀렸다** —
    //      그것은 **기출 분석**이고 학습자에게 가지 않는다. 2026-09-13 에 검수 화면
    //      (`loadReviewView`)이 이 사실을 발견해 교재 문항으로 옮겼고 그 경위를 주석에 적었다.
    //      **그런데 현황판인 여기는 안 옮겼다.** 실측 2026-09-16: 같은 라벨
    //      「L2 3인 페르소나」가 현황판에서 **802/802(100%)**, 검수 화면에서 **4/408(0.98%)** 로
    //      **동시에** 떠 있었다. 관리자는 어느 쪽을 믿을지 정할 방법이 없었고, 위쪽 화면이
    //      먼저 읽히므로 **검수 안 한 책이 통과로 보였다.**
    //
    // 세는 곳은 조판기 하나다 — 어느 문항이 그 권에 실렸는지는 조판기만 안다. 화면은 그 권이
    // 조판될 때 잰 값을 읽을 뿐 다시 세지 않는다. 검수 화면과 **같은 셈법**이어야 하므로
    // 분자·분모를 그쪽과 똑같이 접는다(`factory-line-views.ts` 의 L2).
    //
    // 기출 쪽 수(802/802)는 없어지지 않는다 — **① 기출 원천**의 눈금으로 살아 있다.
    // 여기서 빼는 것이지 지우는 것이 아니다.
    const personaRows = renders.error
      ? []
      : renderRows.filter((r) => r.colophon?.review?.personaReview != null)
    const personaPassed = personaRows.length
      ? personaRows.reduce((n, r) => n + (r.colophon!.review!.personaReview!.passed ?? 0), 0)
      : null
    const personaItems = personaRows.length
      ? personaRows.reduce((n, r) => n + (r.colophon!.review!.personaReview!.items ?? 0), 0)
      : null
    const withBias = renders.error ? null : renderRows.filter((r) => r.colophon?.review?.answerBias != null).length
    const withProof = renders.error ? null : renderRows.filter((r) => r.colophon?.review?.proofread != null).length
    const bench = volume ?? warehouse
    stages.push(
      state(
        'review',
        [
          {
            label: 'L1 기계 게이트 — 조판 교정 기록',
            num: withProof,
            den: renders.error ? null : renderRows.length,
            unit: 'ratio',
            target: 1,
            unmeasuredReason: renders.error ? `조판 기록 조회 실패: ${renders.error.message}` : undefined,
          },
          {
            // 라벨에 **모집단을 박는다.** 기출 쪽 수와 한 화면에 함께 뜨므로, 이름만으로
            // 무엇을 센 값인지 갈리지 않으면 같은 사고가 되풀이된다.
            label: 'L2 3인 페르소나 — 조판된 권의 교재 문항',
            num: personaPassed,
            den: personaItems,
            unit: 'ratio',
            target: 1,
            unmeasuredReason: renders.error
              ? `조판 기록 조회 실패: ${renders.error.message}`
              : personaRows.length === 0
                ? renderRows.length
                  ? '조판 기록에 3인 검수 실측이 없다 — 이 눈금이 붙기 전에 찍힌 권이다. 다시 조판하면 채워진다'
                  : '조판된 권이 없다'
                : undefined,
          },
          {
            label: 'L3 교차 대조 — 정답 번호 쏠림 검정',
            num: withBias,
            den: renders.error ? null : renderRows.length,
            unit: 'ratio',
            target: 1,
            unmeasuredReason: renders.error ? '조판 기록 없음' : undefined,
          },
          {
            label: 'L4 외부 대조 — 시중 대비 잰 축',
            num: bench ? bench.publishers.reduce((s, p) => s + p.axesMeasured, 0) : null,
            den: bench ? bench.publishers.reduce((s, p) => s + p.axesTotal, 0) : null,
            unit: 'ratio',
            target: 1,
            unmeasuredReason: bench ? undefined : '벤치마크 리포트 없음',
          },
        ],
        '층이 하나라도 비면 그 책은 검수를 받은 것이 아니다 — 층마다 보는 것이 다르다',
        [
          {
            cmd: 'node scripts/csat/analysis-drain-validate.mjs',
            why: 'L1 — 인용 대조·정답 대조·순환논법 거부. 읽기만 한다',
          },
          // ⚠️ L2 가 이 공정의 병목인데 **그것을 푸는 명령이 없었다.** 눈금이 기출 수를 읽어
          //   늘 통과였으므로 아무도 아쉬워하지 않았다 — 눈금을 고치자 비로소 빈자리가 보였다.
          //   검수 화면과 **같은 명령**을 둔다(두 화면이 다른 길을 가리키면 그 자체가 다음 어긋남이다).
          {
            cmd: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/item-review-drain-export.mjs --band 5',
            why: 'L2 — 그 권에 실릴 문항 중 3인 검수가 안 된 것만 뽑는다. 읽기만 하고 재실행 안전',
          },
          {
            cmd: 'Claude Code: chunk-NN.json 을 읽어 3인 판정을 chunk-NN.out.json 으로 채운다',
            why: '명세는 scripts/textbook/item-review-drain/_PROMPT.md 가 정본이다',
            claudeCode: true,
          },
          {
            cmd: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/item-review-drain-import.mjs --band 5 --commit',
            why: 'L2 — --commit 없이는 거를 것만 찍는다. 재실행 안전(unique (item_id, persona) upsert)',
            writes: true,
          },
          {
            cmd: 'pnpm dlx tsx scripts/textbook/item-health-report.mjs',
            why: 'L3 — 정답 번호 쏠림(χ²·Cramér V)·지문 규격·밴드 분포. 읽기만 한다',
          },
          {
            cmd: 'pnpm dlx tsx scripts/textbook/proofread-report.mjs',
            why: 'L1 — 초·재·삼교에 해당하는 규칙 교정. 무엇을 고칠지 규칙별로 낸다',
          },
          {
            cmd: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/market-benchmark.mjs --per-publisher',
            why: 'L4 — 시중과 대 본다. 안 재면 "우위" 는 주장일 뿐이다',
          },
        ],
      ),
    )
  }

  /* ⑧ 조판 — 사다리 계단마다 최신 규격의 권이 있는가. */
  {
    const bands = new Set(renderRows.map((r) => r.band))
    // ⚠️ **게이트가 「최신 규격」을 말하는데 눈금이 규격을 안 보고 있었다.** 실측 2026-09-05:
    //   계단 7단이 전부 조판돼 「7/7 통과」로 떴는데, 그중 **6단이 옛 규격**이었다(조판 화면의
    //   사다리 띠가 그걸 드러냈다). 옛 규격으로 찍힌 책은 지금 규격의 책이 아니므로, 그 초록은
    //   "조판 끝났다" 는 거짓 안심이었다. 두 눈금을 나란히 두어 **찍혔는가**와
    //   **지금 규격인가**를 가른다 — 둘은 할 일이 다르다(전자는 조판, 후자는 재조판).
    const current = brandFingerprint()
    const currentBands = new Set(
      renderRows.filter((r) => r.brand_fingerprint === current).map((r) => r.band),
    )
    const rungs = SERIES_SPINE.length
    stages.push(
      state(
        'press',
        [
          {
            label: '조판된 계단',
            num: renders.error ? null : bands.size,
            den: renders.error ? null : rungs,
            unit: 'ratio',
            target: 1,
            unmeasuredReason: renders.error ? `조판 기록 조회 실패: ${renders.error.message}` : undefined,
          },
          {
            label: '최신 규격으로 찍힌 계단',
            num: renders.error ? null : currentBands.size,
            den: renders.error ? null : rungs,
            unit: 'ratio',
            target: 1,
            unmeasuredReason: renders.error ? '조판 기록 없음' : undefined,
          },
        ],
        bands.size < rungs
          ? `계단 ${rungs}단 중 ${bands.size}단만 조판됐다 — 빈 계단에서 학습자는 다른 출판사로 간다`
          : `${rungs}단이 다 찍혔지만 ${rungs - currentBands.size}단이 옛 규격이다 — 그대로 내면 지금 규격의 책이 아니다`,
        [
          {
            cmd: 'pnpm dlx tsx scripts/textbook/build-volume.mjs --band 6 --units 20',
            why: '그 밴드로 한 권을 조합해 3관점 채점표를 낸다. 읽기만 한다',
          },
          {
            cmd: 'pnpm dlx tsx scripts/textbook/render-volume.mjs --band 6 --units 20 --out volume-v6.html',
            why: '문제편·정답편·해설을 한 HTML 로 낸다 — 해설 누락·자동 검수 미통과면 **거절한다**(파일도 기록도 안 남는다). 통과하면 지정한 파일을 덮어쓴다',
            writes: true,
          },
        ],
      ),
    )
  }

  return {
    stages: stages.sort((a, b) => a.def.ord - b.def.ord),
    cells,
    bench: { warehouse, volume },
    loadError: coverage.error ? `기출 커버리지를 못 읽었다: ${coverage.error.message}` : null,
  }
}

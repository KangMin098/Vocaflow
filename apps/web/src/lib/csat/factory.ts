// apps/web/src/lib/csat/factory.ts
//
// **교재 공장 실측** — `factory-model.ts` 의 공정 8칸에 DB·리포트에서 잰 수를 꽂는다.
//
// ── 왜 조회를 이렇게 쪼개나 ──────────────────────────────────────────
// `csat_dcp_items` 는 65만 행이다. TBP 콘솔은 이 표를 **1,000행씩 656번** 끌어와 메모리에서 센다.
// 같은 짓을 여기서 또 하면 현황판 한 번 여는 데 분 단위가 걸린다. 그래서 이 파일은 **행을 안 받고
// 세기만 한다**(`head:true` + `count:'exact'`) — 서버가 세므로 네트워크에 실리는 것은 헤더뿐이고,
// 필요한 칸만 병렬로 던진다(실측 2026-09-05: 15칸 병렬 1.9초).
//
// ⚠️ PostgREST 집계 함수는 이 프로젝트에서 **꺼져 있다**(`PGRST123: Use of aggregate functions is
//   not allowed`). 그래서 `select=type,v_level,count()` 한 방으로는 못 접는다 — 실측으로 확인했다.
//   칸 단위 count 를 병렬로 던지는 지금 방식이 마이그레이션 없이 쓸 수 있는 가장 싼 길이다.
//
// ⚠️ **없는 것과 0 을 가른다.** `head:true` 는 없는 테이블에도 204/count=null 을 돌려준다
//   (이 저장소가 이미 당한 함정). 그래서 count 가 null 이면 눈금을 `num: null` 로 두고
//   화면이 "못 잼" 이라고 말하게 한다 — 0 으로 뭉개면 "재고 없음" 이라는 거짓 경보가 된다.

import 'server-only'

import { SERIES_SPINE, type SeriesItemType } from '@vocaflow/library-pipeline'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'

import {
  BENCH_FILES,
  MARKET_TARGET_INDEX,
  QUERY_TIMEOUT_MS,
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

/**
 * 서버 count 한 번 — **null 이면 한 번 더 물어본다.**
 *
 * 실측 2026-09-05: `csat_dcp_items` 65만 행 전수 count 의 **첫 호출이 8.5초 만에
 * `count=null` + 빈 오류 메시지**로 돌아왔다(2·3회차는 1.0초·0.5초). 차가운 첫 호출이
 * 게이트웨이 쪽에서 잘린 것이다. 재시도를 안 하면 그 순간 화면이 「해설 못 잼」이라고 적고,
 * 관리자는 있지도 않은 결함을 보게 된다 — 그런데 새로고침하면 멀쩡히 나오므로
 * **재현이 안 되는 유령 결함**이 된다. 그래서 여기서 한 번 삼킨다.
 *
 * 두 번째도 null 이면 그때는 진짜 못 잰 것이다. 오류 메시지를 그대로 올려 화면이 이유를 적는다.
 */
const TIMED_OUT = { count: null, error: { message: `${QUERY_TIMEOUT_MS / 1000}초 안에 안 돌아왔다` } }

async function headCount(
  run: () => PromiseLike<{ count: number | null; error: { message: string } | null }>,
  timeoutMs = QUERY_TIMEOUT_MS,
): Promise<{ count: number | null; message: string | null }> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { count, error } = await withTimeout(run(), timeoutMs, TIMED_OUT)
    if (count != null) return { count, message: null }
    // 상한에 걸린 것은 **다시 물어도 같다** — 재시도는 대기 시간만 두 배로 만든다.
    if (error?.message === TIMED_OUT.error.message) return { count: null, message: error.message }
    if (attempt === 1) return { count: null, message: error?.message || '서버가 수를 돌려주지 않았다' }
  }
  return { count: null, message: '서버가 수를 돌려주지 않았다' }
}

async function countCell(db: SupabaseClient, type: string, vLevel: number): Promise<number | null> {
  const { count } = await headCount(() =>
    db
      .from('csat_dcp_items')
      .select('id', { count: 'exact', head: true })
      .eq('type', type)
      .eq('v_level', vLevel),
  )
  return count
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
  // ⚠️ **한꺼번에 다 던지지 않는다.** PostgREST 커넥션 풀이 포화되면 전부 줄을 서서
  //   오히려 느려진다(실측 2026-09-05: idle 백엔드로 가득 찬 채 페이지가 39초). 그리고
  //   예산을 넘기면 남은 칸을 포기한다 — 현황판이 몇 분 멈추느니 「?」 몇 칸이 낫다.
  const WAVE = 6
  const deadline = Date.now() + 10_000
  const counts: (number | null)[] = []
  for (let i = 0; i < specs.length; i += WAVE) {
    if (Date.now() > deadline) {
      counts.push(...new Array<null>(specs.length - counts.length).fill(null))
      break
    }
    counts.push(
      ...(await Promise.all(specs.slice(i, i + WAVE).map((s) => countCell(db, s.type, s.vLevel)))),
    )
  }
  return specs.map((s, i) => ({ ...s, count: counts[i] ?? null }))
}

export interface FactoryLine {
  stages: StageState[]
  /** 사다리 칸 실측 — 설계·집필 화면이 다시 안 재도 되게 같이 내려보낸다. */
  cells: Cell[]
  /** 단계 밴드별 지문 재고 — 소재 화면의 원자료. */
  passageBands: { band: string; vLevel: number | null; count: number; displayOnly: number }[]
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

function state(
  id: StageId,
  gauges: StageGauge[],
  blocker: string | null,
  nextCommands: StageCommand[],
): StageState {
  const status = judgeStage(gauges)
  return { def: defOf(id), status, gauges, blocker: status === 'pass' ? null : blocker, nextCommands }
}

export async function loadFactoryLine(): Promise<FactoryLine> {
  const db = createAdminClient() as unknown as SupabaseClient

  // ── 조회를 두 물결로 나눈다 ────────────────────────────────────────
  // 한 물결에 다 던졌더니 **65만 행 전수 count 두 개가 조용히 null 로 돌아왔다**
  // (실측 2026-09-05: 따로 던지면 8.3초·7.7초에 정상, 같이 던지면 null). 그 상태로
  // 화면은 「집필 · 해설 못 잼」이라고 적었고, 그것은 사실이 아니라 **경합의 흔적**이었다.
  // 가벼운 조회 + 사다리 칸(26개)이 1물결, 무거운 전수 count 둘이 2물결이다.
  const [coverage, gates, passages, cells, renders, warehouse, volume] =
    await Promise.all([
      withTimeout(db.rpc('csat_coverage'), 8_000, {
        data: null,
        error: { message: '8초 안에 안 돌아왔다' },
      } as Awaited<ReturnType<typeof db.rpc>>),
      db.from('csat_stage_gates').select('stage, metric, threshold, is_locked'),
      db.from('csat_stage_catalog').select('stage_band, v_level, display_only'),
      loadLadderCells(db),
      // 검수 기록은 별도 컬럼이 아니라 `colophon.review` 안에 있다 — 조판기가 찍은 그 값이어야
      // 화면과 손에 쥔 책이 같은 것을 말한다(`lib/textbook/console-stats.ts` 와 같은 규약).
      db.from('textbook_volume_renders').select('band, colophon'),
      readBench(BENCH_FILES.warehouse),
      readBench(BENCH_FILES.volume),
    ])

  // ⚠️ **필터 없는 전수 count 는 이 표에서 더는 안 된다.**
  //   실측 2026-09-05: `csat_dcp_items`(65만 행)를 PostgREST 로 전수 세면 **50초 뒤
  //   `count=null`** 로 돌아온다(세 번 연속). 같은 count 를 직접 SQL 로는 즉시 낸다 —
  //   DB 가 아니라 PostgREST 쪽 한계다. 예전엔 8.5초에 되던 것이라 재시도로 삼키고 있었는데,
  //   이제는 재시도가 **50초를 100초로 만들 뿐**이다. 그 상태로 두면 현황판이 3분씩 멈춘다.
  //
  //   그래서 둘을 이렇게 가른다:
  //     · 저장 문항 → `count: 'planned'`(2.4초). **추정이므로 화면이 ≈ 를 붙인다.**
  //     · 해설 보유 → **못 잰다.** 유형·수준으로 쪼개면 셀마다는 되지만(4.1초) 재고가 있는
  //       칸이 132개라 다 돌면 몇 분이다. 집계 RPC 가 있어야 한다(승인 대기).
  //   0 으로 뭉개지 않고 「못 잼」 + 이유로 남긴다.
  const itemsTotal = await headCount(
    () => db.from('csat_dcp_items').select('id', { count: 'planned', head: true }),
    6_000,
  )

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

  /* ④ 소재 — 게이트가 정의된 단계 밴드에 지문이 있는가. */
  const passageBands = (() => {
    const rows = (passages.data ?? []) as {
      stage_band: string | null
      v_level: number | null
      display_only: boolean | null
    }[]
    const m = new Map<string, { band: string; vLevel: number | null; count: number; displayOnly: number }>()
    for (const r of rows) {
      const band = r.stage_band ?? '미분류'
      const k = `${band}|${r.v_level}`
      const cur = m.get(k) ?? { band, vLevel: r.v_level, count: 0, displayOnly: 0 }
      cur.count += 1
      if (r.display_only) cur.displayOnly += 1
      m.set(k, cur)
    }
    return [...m.values()].sort((a, b) => a.band.localeCompare(b.band) || (a.vLevel ?? 0) - (b.vLevel ?? 0))
  })()
  {
    const gateRows = (gates.data ?? []) as { stage: string }[]
    const gateBands = [...new Set(gateRows.map((r) => r.stage))].sort()
    const filled = gateBands.filter((b) => passageBands.some((p) => p.band === b && p.count > 0))
    const empty = gateBands.filter((b) => !filled.includes(b))
    stages.push(
      state(
        'source',
        [
          {
            label: '게이트가 있는 밴드 중 지문 보유',
            num: passages.error || gates.error ? null : filled.length,
            den: passages.error || gates.error ? null : gateBands.length,
            unit: 'ratio',
            unmeasuredReason: passages.error
              ? `지문 재고 조회 실패: ${passages.error.message}`
              : gates.error
                ? `게이트 조회 실패: ${gates.error.message}`
                : undefined,
          },
          {
            label: '지문 재고',
            num: passages.error ? null : passageBands.reduce((s, p) => s + p.count, 0),
            den: null,
            unit: 'count',
          },
        ],
        empty.length
          ? `${empty.join(' · ')} 밴드에 지문이 0편 — 그 단계 책은 지금 못 만든다`
          : '지문 재고가 게이트 밴드를 덮었다',
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
            num: itemsTotal.count,
            den: null,
            unit: 'count',
            approx: true,
            unmeasuredReason:
              itemsTotal.count == null
                ? `문항 수를 못 셌다: ${itemsTotal.message}`
                : '플래너 통계값이다 — 정확한 수는 집필 화면이 칸을 더해서 낸다',
          },
        ],
        emptyCells.length
          ? `빈 칸 ${emptyCells.length}개 — ${emptyCells
              .slice(0, 4)
              .map((c) => `${c.schoolBand}/${c.type}`)
              .join(' · ')}${emptyCells.length > 4 ? ' 외' : ''}`
          : itemsTotal.count == null
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
    // 지금은 잴 수 없다. 마지막으로 잰 값(2026-09-05 · 426,696 / 655,092)은 마이그레이션
    // 제안서에 적어 두었다 — **코드에 상수로 박지 않는다.** 박으면 화면이 낡은 수를
    // 현재 사실처럼 말하게 된다.
    const total: number | null = null
    const done: number | null = null
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
                ? 'PostgREST 가 이 표를 전수로 못 센다 — 필터 없는 count 가 50초 뒤 빈손으로 온다(실측 2026-09-05). ' +
                  '유형·수준으로 쪼개면 셀마다는 되지만 132칸이라 몇 분이 걸린다. ' +
                  '집계 RPC 승인 후에 잰다 — supabase/migrations/_pending_csat_dcp_inventory.sql'
                : undefined,
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
    colophon: { review?: { answerBias?: unknown; proofread?: unknown } } | null
  }[]
  {
    // ⚠️ **행이 아니라 문항을 센다.** 처음에는 `csat_item_analyses` 의 published 행 수를 썼는데
    //   그 표는 분석을 **덮지 않고 버전을 올려 새 행**으로 넣는다(옛 분석을 남기려고). 그래서
    //   "검수 통과 2,234 / 사정권 830" 이라는 270% 짜리 눈금이 나왔다 — 통과율이 아니라
    //   버전 수였다. 회차 커버리지 RPC 는 문항 단위로 세므로 그것을 합한다.
    const covRows = (coverage.data ?? []) as { in_scope_items: number; published: number }[]
    const kice = coverage.error ? null : covRows.reduce((n, r) => n + r.in_scope_items, 0)
    const pub = coverage.error ? null : covRows.reduce((n, r) => n + r.published, 0)
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
            label: 'L2 3인 페르소나 — 검수 통과 문항',
            num: pub,
            den: kice,
            unit: 'ratio',
            target: 1,
            unmeasuredReason:
              pub == null || kice == null
                ? `검수 기록을 못 셌다${coverage.error ? `: ${coverage.error.message}` : ''}`
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
        ],
        `계단 ${rungs}단 중 ${bands.size}단만 조판됐다 — 빈 계단에서 학습자는 다른 출판사로 간다`,
        [
          {
            cmd: 'pnpm dlx tsx scripts/textbook/build-volume.mjs --band 6 --units 20',
            why: '그 밴드로 한 권을 조합해 3관점 채점표를 낸다. 읽기만 한다',
          },
          {
            cmd: 'pnpm dlx tsx scripts/textbook/render-volume.mjs --band 6 --units 20 --out volume-v6.html',
            why: '문제편·정답편·해설을 한 HTML 로 낸다 — 지정한 파일을 덮어쓴다',
            writes: true,
          },
        ],
      ),
    )
  }

  return {
    stages: stages.sort((a, b) => a.def.ord - b.def.ord),
    cells,
    passageBands,
    bench: { warehouse, volume },
    loadError: coverage.error ? `기출 커버리지를 못 읽었다: ${coverage.error.message}` : null,
  }
}

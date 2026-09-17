// scripts/audit/factory-sources.mts
//
// **교재 공장이 같은 수를 몇 군데서 다르게 말하는가** — 공정 8칸 · 화면 10개의 출처 대조.
//
// ── 왜 이 자를 만드나 (감사 2026-09-16) ─────────────────────────────────
// `/admin/csat` 한 화면 안에서 같은 양(量)을 **다른 출처**로 재는 코드가 최소 다섯 갈래다:
//
//   ① DB 집계표  `textbook_shelf_inventory()` (mv · 30분 갱신)  — ⑤집필 ⑥해설 카탈로그 발주
//   ② DB 스냅샷표 `csat_source_snapshots`     (6시간 · cron 18)  — ④소재
//   ③ DB RPC     `csat_coverage()`                              — ①기출 ⑦검수L2(현황판)
//   ④ 저장소 JSON `apps/web/src/lib/textbook/*-snapshot.json`   — 원문적격 자유도
//   ⑤ 리포트 JSON `docs/reports/textbook-*.json`                — ②기획 ⑦검수L4 발주
//
// 다섯이 갱신 주기도, 모집단도, 갱신 주체(cron / 사람이 돌리는 스크립트 / 커밋)도 다르다.
// 그래서 **두 화면이 같은 이름으로 다른 수를 말할 수 있다.** 이 저장소는 이미 그 사고를
// 두 번 겪었다(`factory-line-views.ts` 의 묘비명 · `item-count.ts` 머리말).
//
// 이 스크립트는 고치지 않는다 — **어긋난 자리를 세기만 한다.** 손으로 센 수는 반드시 낡는다.
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/audit/factory-sources.mts
//       (읽기 전용 · 재실행 안전 · --json 이면 표를 안 찍고 파일만 쓴다)

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'scripts/audit/factory-sources.result.json')

/* ───────── env — 저장소 규약(`scripts/csat/*.mjs`)과 같은 방식 ───────── */
for (const f of ['apps/web/.env.local', '.env.local']) {
  const p = path.join(ROOT, f)
  if (!existsSync(p)) continue
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '')
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다')
  process.exit(1)
}
const db: SupabaseClient = createClient(url, key, { auth: { persistSession: false } })

/* ───────── 정본 상수는 **화면이 읽는 그 파일에서** 읽는다 ─────────
   여기에 베껴 적으면 저쪽이 바뀌어도 이 자는 옛 기준으로 "일치" 라고 답한다. */
const { SERIES_SPINE } = (await import('../../packages/library-pipeline/src/textbook/series.ts')) as any
const { GENERATED_TYPES, INVENTORY_LEVELS } = (await import(
  '../../apps/web/src/lib/csat/factory-line-model.ts'
)) as any
// `factory-model.ts` 는 `server-only` 를 안 쓰는 순수 모듈이라 여기서 그대로 읽을 수 있다.
const { FACTORY_STAGES, judgeStage } = (await import(
  '../../apps/web/src/lib/csat/factory-model.ts'
)) as any

/** 사전의 순수 함수 3종 — DB 에 없는 것이 정상이다(`factory.ts` 의 `PURE_FUNCTION_TYPES`). */
const PURE = new Set(['rhyme', 'word_meaning', 'spell_blank'])

const readJson = (rel: string): any | null => {
  const p = path.join(ROOT, rel)
  if (!existsSync(p)) return null
  try {
    return { ...JSON.parse(readFileSync(p, 'utf8')), __mtime: statSync(p).mtime.toISOString() }
  } catch {
    return null
  }
}

const hoursAgo = (iso: string | null | undefined): number | null =>
  iso ? Math.round(((Date.now() - Date.parse(iso)) / 36e5) * 10) / 10 : null

/* ───────── ① DB 집계표 ───────── */
const mv = await db.rpc('textbook_shelf_inventory')
type MvRow = { item_type: string; v_level: number | null; item_count: number; explained_count: number }
const mvRows: MvRow[] = (mv.data ?? []) as MvRow[]
const mvTotal = mvRows.reduce((n, r) => n + r.item_count, 0)
const mvExplained = mvRows.reduce((n, r) => n + r.explained_count, 0)

/** 사다리가 실제로 쓰는 (유형 × V) 칸. 순수 함수 3종은 DB 밖이라 뺀다. */
const ladderKeys = new Set<string>()
for (const rung of SERIES_SPINE as any[])
  for (const v of rung.vLevels) for (const t of rung.types) if (!PURE.has(t)) ladderKeys.add(`${t}|${v}`)

const inLadder = mvRows
  .filter((r) => ladderKeys.has(`${r.item_type}|${r.v_level}`))
  .reduce((n, r) => n + r.item_count, 0)

/** 집필 화면의 표(25유형 × V1~9)가 덮는 몫 — 여기서 새면 관리자가 못 보는 재고가 된다. */
const genSet = new Set(GENERATED_TYPES as readonly string[])
const lvlSet = new Set(INVENTORY_LEVELS as readonly number[])
const inAuthorTable = mvRows
  .filter((r) => genSet.has(r.item_type) && r.v_level != null && lvlSet.has(r.v_level))
  .reduce((n, r) => n + r.item_count, 0)

/* ───────── ② DB 스냅샷표 ───────── */
const snap = await db
  .from('csat_source_snapshots')
  .select('taken_at, payload')
  .order('taken_at', { ascending: false })
  .limit(1)
const snapRow = (snap.data ?? [])[0] as { taken_at: string; payload: any } | undefined

/* ───────── ③ DB RPC ───────── */
const cov = await db.rpc('csat_coverage')
type CovRow = { in_scope_items: number; published: number; scope_points: number; covers_99: boolean }
const covRows: CovRow[] = (cov.data ?? []) as CovRow[]
const covScored = covRows.filter((r) => r.scope_points > 0)

const renders = await db
  .from('textbook_volume_renders')
  .select('band, items, colophon, brand_fingerprint')
type RenderRow = { band: number; items: number; colophon: any; brand_fingerprint: string | null }
const renderRows: RenderRow[] = (renders.data ?? []) as RenderRow[]
const persona = renderRows.filter((r) => r.colophon?.review?.personaReview != null)

/**
 * ⑦ 검수 각 층의 분자 — **앱과 같은 셈법(JS)으로 센다.**
 *
 * ⚠️ 감사 1회차가 여기서 틀렸다. SQL 로 `(colophon->'review'->'answerBias') is not null` 을 물어
 *   L3 를 19/19 라 적었는데 화면은 **16/19** 였다. jsonb 의 `null` 은 **SQL NULL 이 아니다** —
 *   `'null'::jsonb is not null` 은 **참**이다. 앱은 JS 로 읽어 `null` 을 없는 것으로 세므로 셋이 갈린다.
 *
 *   SQL 로 앱 수치를 검증할 때는 `jsonb_typeof(x) <> 'null'` 을 함께 봐야 한다.
 *   이 자는 supabase-js 로 읽으므로 **앱과 같은 쪽**이다 — 그래서 여기가 정답 쪽이다.
 */
const reviewLayers = {
  L1_proofread: renderRows.filter((r) => r.colophon?.review?.proofread != null).length,
  L2_personaVolumes: persona.length,
  L3_answerBias: renderRows.filter((r) => r.colophon?.review?.answerBias != null).length,
  volumes: renderRows.length,
  note: 'JS 셈법(앱과 동일). SQL 의 `is not null` 은 jsonb null 을 「있음」으로 세어 더 크게 나온다',
}

/* ───────── ④ 저장소 JSON ───────── */
const S = 'apps/web/src/lib/textbook/'
const eligibility = readJson(S + 'source-eligibility-snapshot.json')
const typeInv = readJson(S + 'type-inventory-snapshot.json')
const srcInv = readJson(S + 'source-inventory-snapshot.json')
const fillPlan = readJson(S + 'item-fill-plan.json')
const defects = readJson(S + 'extraction-defect-snapshot.json')

/* ───────── ⑤ 리포트 JSON ───────── */
const benchVolume = readJson('docs/reports/textbook-publisher-benchmark-volume.json')
const benchWarehouse = readJson('docs/reports/textbook-publisher-benchmark.json')

/* ───────── 대조 — 같은 양을 두 곳이 다르게 말하는가 ───────── */
interface Pair {
  id: string
  quantity: string
  a: { source: string; value: number | null; at: string | null }
  b: { source: string; value: number | null; at: string | null }
  deltaPct: number | null
  verdict: 'same' | 'diverged' | 'unmeasurable'
  note: string
  /**
   * **화면이 아직 이 두 출처를 섞어 읽는가.** 고쳐진 짝은 값이 계속 갈려도(한쪽 출처가 남아 있으므로)
   * 화면 어긋남이 아니다 — 그 사실을 적지 않으면 이 자는 고친 뒤에도 영원히 「어긋남」을 센다.
   */
  resolvedBy?: string
}

const pct = (a: number | null, b: number | null): number | null =>
  a == null || b == null || b === 0 ? null : Math.round(((a - b) / b) * 1000) / 10

function pair(p: Omit<Pair, 'deltaPct' | 'verdict'> & { tolPct?: number }): Pair {
  const d = pct(p.a.value, p.b.value)
  const tol = p.tolPct ?? 0.5
  return {
    ...p,
    deltaPct: d,
    verdict: d == null ? 'unmeasurable' : Math.abs(d) <= tol ? 'same' : 'diverged',
  }
}

const pairs: Pair[] = [
  pair({
    id: 'P1-items',
    quantity: '교재 문항 총 재고',
    a: { source: 'DB mv textbook_shelf_inventory()', value: mvTotal, at: null },
    b: {
      source: 'repo JSON type-inventory-snapshot.json:totalItems',
      value: typeInv?.totalItems ?? null,
      at: typeInv?.measuredAt ?? null,
    },
    note: '⑤집필·⑥해설은 mv 를, 자유도 패널은 JSON 을 읽었다 — 같은 /admin/csat 한 화면 안이었다',
    resolvedBy:
      'T3(2026-09-16) — 자유도 패널이 mv 를 읽는다(freedom-load.ts). 이 짝은 이제 고정 표본 JSON 의 낡음만 잰다',
  }),
  // ⚠️ 여기 있던 P2(사다리 밖 재고 vs 스냅샷 `orphanItems`)는 **지웠다** — 스냅샷의 `orphanItems` 는
  //   「원글이 사라진 문항」(댕글링 참조)이고 「사다리 밖」(어느 권에도 안 실리는 칸)과 **다른 개념**이다.
  //   다른 것을 견주고 「어긋남」이라 셌다(감사 2026-09-16 정정). 사다리 밖 수 자체는 `db.orphanItems` 에 남는다.
  pair({
    id: 'P3-pool',
    quantity: '조판에 쓸 수 있는 원문 수',
    a: {
      source: 'DB csat_source_snapshots.payload.pool.n',
      value: snapRow?.payload?.pool?.n ?? null,
      at: snapRow?.taken_at ?? null,
    },
    b: {
      source: 'repo JSON source-eligibility-snapshot.json:total.composable',
      value: eligibility?.total?.composable ?? null,
      at: eligibility?.measuredAt ?? null,
    },
    note: '④소재의 「조판 풀」과 원문적격의 「조판 가능」이 **다른 것을 센다** — 이름이 같아 관리자가 같은 수로 읽었다',
    resolvedBy:
      'T4(2026-09-16) — ④는 「조판 후보 원문 (적격 판정 전)」으로 부르고 조판기가 싣는 수를 노트로 옆에 적는다. 조판기(STRICT)가 싣는 것은 B 쪽이다. 옛 이름의 복귀는 pool-vocabulary.test 가 막는다',
  }),
  pair({
    id: 'P4-articles',
    quantity: '원문 모집단 (status in ready/published)',
    a: {
      source: 'DB csat_source_snapshots.payload.pool.n',
      value: snapRow?.payload?.pool?.n ?? null,
      at: snapRow?.taken_at ?? null,
    },
    b: {
      source: 'repo JSON source-eligibility-snapshot.json:total.total',
      value: eligibility?.total?.total ?? null,
      at: eligibility?.measuredAt ?? null,
    },
    tolPct: 0.5,
    note: '분모가 같아야 두 화면의 백분율이 비교 가능하다',
  }),
  pair({
    id: 'P5-L2',
    quantity: '⑦검수 L2 「3인 페르소나」 통과 문항',
    a: {
      source: '현황판 factory.ts → csat_coverage() (기출 분석)',
      value: cov.error ? null : covRows.reduce((n, r) => n + r.published, 0),
      at: null,
    },
    b: {
      source: '검수 화면 loadReviewView → colophon.review.personaReview (교재 문항)',
      value: persona.length
        ? persona.reduce((n, r) => n + (r.colophon.review.personaReview.passed ?? 0), 0)
        : null,
      at: null,
    },
    note: '두 수의 **모집단이 다르다** — 같은 라벨 「L2 3인 페르소나」로 한 화면과 그 하위 화면에 동시에 떴다',
    resolvedBy:
      'T1(2026-09-16) — 현황판 L2 가 personaReview 를 읽는다. 두 화면 일치는 factory.integration.test 가 잠근다',
  }),
  pair({
    id: 'P6-L2-den',
    quantity: '⑦검수 L2 분모',
    a: {
      source: '현황판 → csat_coverage().in_scope_items 합 (기출 802)',
      value: cov.error ? null : covRows.reduce((n, r) => n + r.in_scope_items, 0),
      at: null,
    },
    b: {
      source: '검수 화면 → personaReview.items 합 (조판된 권의 문항)',
      value: persona.length
        ? persona.reduce((n, r) => n + (r.colophon.review.personaReview.items ?? 0), 0)
        : null,
      at: null,
    },
    note: '분모까지 다르므로 두 백분율이 같은 질문의 답이 아니었다',
    resolvedBy: 'T1(2026-09-16) — P5 와 같은 수정',
  }),
]

/* ───────── ② 기획 게이트 — 「막힘」의 정체 ───────── */
const bench = benchVolume ?? benchWarehouse
const TARGET = 1.2
const gate2Market = bench
  ? {
      file: benchVolume
        ? 'textbook-publisher-benchmark-volume.json'
        : 'textbook-publisher-benchmark.json',
      generatedAt: bench.generatedAt,
      ageHours: hoursAgo(bench.generatedAt),
      bindingPublisher: bench.bindingPublisher,
      bindingIndex: bench.bindingIndex,
      target: TARGET,
      publishers: (bench.publishers ?? []).map((p: any) => ({
        publisher: p.publisher,
        docs: p.profile?.docs ?? null,
        overallIndex: p.overallIndex,
        reachableMax: p.reachableMax,
        /** 못 잰 축을 다 이겨도 목표에 닿는가 — 닿지 못하면 막는 것은 **생산이 아니라 증거**다. */
        targetReachable: p.targetReachable === true,
        axes: `${p.axesMeasured}/${p.axesTotal}`,
        gaps: p.gaps ?? [],
      })),
      /** 현황판 ②가 판정에 쓰는 값은 bindingIndex 하나다 — reachableMax 를 안 본다. */
      screenUsesReachableMax: false,
      unreachablePublishers: (bench.publishers ?? [])
        .filter((p: any) => p.reachableMax != null && p.reachableMax < TARGET)
        .map((p: any) => `${p.publisher} (최대 ${p.reachableMax})`),
    }
  : null

/* ───────── 게이트 정렬 — **이름이 어긋나면 그 공정은 화면에서 「못 잼」이다** ─────────
   ⚠️ 감사 1회차(2026-09-16)가 여기서 틀렸다. ④ 소재의 눈금이 4/4 로 차 있는 것만 보고
      「통과」라 적었는데, 화면은 「못 잼」이었다 — `factory.ts` 의 `state()` 가
      `def.gateGauges` 에 적힌 라벨의 눈금이 없으면 **「못 잼」 눈금을 대신 꽂기** 때문이다.
      눈금을 직접 읽어 판정하면 그 주입을 통째로 못 본다.

      `state()` 는 `factory.ts` 안의 비공개 함수이고 그 파일은 `server-only` 라 여기서 못 부른다.
      그래서 **그 판정을 가르는 조건 하나**(이름이 맞는가)를 여기서 따로 잰다 — 어긋난 공정은
      눈금이 아무리 차 있어도 화면에서 회색이다. 판정 자체는 `factory-model.test.ts` 가 잠근다. */
const factorySrc = readFileSync(path.join(ROOT, 'apps/web/src/lib/csat/factory.ts'), 'utf8')
const gateAlignment = (FACTORY_STAGES as any[]).map((def) => {
  const missing = (def.gateGauges as string[]).filter(
    (want) => !new RegExp(`label:\\s*[\`'"].*${want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(factorySrc),
  )
  return {
    id: def.id,
    ord: def.ord,
    name: def.name,
    gate: def.gate,
    gateGauges: def.gateGauges,
    missing,
    /** 어긋나면 `state()` 가 「못 잼」을 꽂아 이 공정은 통과할 수 없다. */
    forcedUnmeasured: missing.length > 0,
    /** 어긋나지 않았을 때 「못 잼」 주입 없이 판정했다면 — 확인용(실측 눈금은 화면이 낸다). */
    judgeOfMissing: missing.length
      ? judgeStage(missing.map((l: string) => ({ label: l, num: null, den: null, unit: 'ratio' })))
      : null,
  }
})

/* ───────── 갱신 주기 — 어느 출처가 가장 낡았는가 ───────── */
const freshness = [
  {
    source: 'DB mv textbook_shelf_inventory_mv',
    cadence: 'cron 14 · 30분',
    owner: 'cron',
    ageHours: null as number | null,
  },
  {
    source: 'DB csat_source_snapshots',
    cadence: 'cron 18 · 6시간',
    owner: 'cron',
    ageHours: hoursAgo(snapRow?.taken_at),
  },
  { source: 'DB csat_coverage()', cadence: '질의 시점', owner: 'live', ageHours: 0 },
  {
    source: 'repo source-eligibility-snapshot.json',
    cadence: '사람이 스캔을 돌려야 갱신 (실측 212초)',
    owner: 'human',
    ageHours: hoursAgo(eligibility?.measuredAt),
  },
  {
    source: 'repo type-inventory-snapshot.json',
    cadence: '사람이 스캔을 돌려야 갱신',
    owner: 'human',
    ageHours: hoursAgo(typeInv?.measuredAt),
  },
  {
    source: 'repo source-inventory-snapshot.json',
    cadence: '사람이 스캔을 돌려야 갱신',
    owner: 'human',
    ageHours: hoursAgo(srcInv?.measuredAt),
  },
  {
    source: 'repo item-fill-plan.json',
    cadence: '사람이 스캔을 돌려야 갱신',
    owner: 'human',
    ageHours: hoursAgo(fillPlan?.computedAt),
  },
  {
    source: 'repo extraction-defect-snapshot.json',
    cadence: '사람이 스캔을 돌려야 갱신',
    owner: 'human',
    ageHours: hoursAgo(defects?.measuredAt),
  },
  {
    source: 'docs/reports/textbook-publisher-benchmark-volume.json',
    cadence: '사람이 market-benchmark 를 돌려야 갱신',
    owner: 'human',
    ageHours: hoursAgo(benchVolume?.generatedAt),
  },
  {
    source: 'docs/reports/textbook-publisher-benchmark.json',
    cadence: '사람이 market-benchmark 를 돌려야 갱신',
    owner: 'human',
    ageHours: hoursAgo(benchWarehouse?.generatedAt),
  },
]

const result = {
  measuredAt: new Date().toISOString(),
  db: {
    mvItems: mvTotal,
    mvExplained,
    mvCells: mvRows.length,
    mvUnexplained: mvTotal - mvExplained,
    ladderItems: inLadder,
    orphanItems: mvTotal - inLadder,
    authorTableCoverage: inAuthorTable,
    authorTableLeak: mvTotal - inAuthorTable,
    coverageExams: covRows.length,
    coverageScored: covScored.length,
    coverageCovered: covScored.filter((r) => r.covers_99).length,
    coverageItems: covRows.reduce((n, r) => n + r.in_scope_items, 0),
    coveragePublished: covRows.reduce((n, r) => n + r.published, 0),
    renders: renderRows.length,
    rendersWithPersona: persona.length,
    personaPassed: persona.reduce((n, r) => n + (r.colophon.review.personaReview.passed ?? 0), 0),
    personaItems: persona.reduce((n, r) => n + (r.colophon.review.personaReview.items ?? 0), 0),
    distinctFingerprints: new Set(renderRows.map((r) => r.brand_fingerprint)).size,
    reviewLayers,
    sourceSnapshotAt: snapRow?.taken_at ?? null,
    sourcePool: snapRow?.payload?.pool ?? null,
  },
  repoJson: {
    eligibility: eligibility
      ? {
          measuredAt: eligibility.measuredAt,
          ...eligibility.total,
          extractBacklog: eligibility.extractBacklog,
        }
      : null,
    typeInventory: typeInv
      ? { measuredAt: typeInv.measuredAt, totalItems: typeInv.totalItems, orphanItems: typeInv.orphanItems }
      : null,
    sourceInventory: srcInv
      ? { measuredAt: srcInv.measuredAt, scanned: srcInv.scanned, sources: srcInv.sources?.length ?? null }
      : null,
    fillPlan: fillPlan
      ? {
          computedAt: fillPlan.computedAt,
          totalChunks: fillPlan.totalChunks,
          readyChunks: fillPlan.readyChunks,
          staleItems: fillPlan.staleItems,
        }
      : null,
    defects: defects
      ? { measuredAt: defects.measuredAt, scanned: defects.scanned, defective: defects.defective }
      : null,
  },
  gate2Market,
  gateAlignment,
  pairs,
  freshness,
  divergedCount: pairs.filter((p) => p.verdict === 'diverged').length,
  /** **화면에 아직 남은** 어긋남 — 이 자가 답하려는 질문은 이것이다. */
  openDivergedCount: pairs.filter((p) => p.verdict === 'diverged' && !p.resolvedBy).length,
}

writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n', 'utf8')

if (!process.argv.includes('--json')) {
  const r = result
  console.log('\n═══ 교재 공장 출처 대조 ═══  ' + r.measuredAt)
  console.log(
    `\nDB 집계표  문항 ${r.db.mvItems.toLocaleString()} · 해설 ${r.db.mvExplained.toLocaleString()} (미보유 ${r.db.mvUnexplained})`,
  )
  console.log(
    `           사다리 안 ${r.db.ladderItems.toLocaleString()} · 사다리 밖 ${r.db.orphanItems.toLocaleString()} (${((r.db.orphanItems / r.db.mvItems) * 100).toFixed(1)}%)`,
  )
  console.log(
    `           집필 표가 덮는 몫 ${r.db.authorTableCoverage.toLocaleString()} · 새는 몫 ${r.db.authorTableLeak}`,
  )
  console.log(
    `기출 RPC   배점 보유 회차 ${r.db.coverageScored}/${r.db.coverageExams} · 사정권 덮음 ${r.db.coverageCovered} · 문항 ${r.db.coveragePublished}/${r.db.coverageItems}`,
  )
  console.log(
    `조판 기록  권 ${r.db.renders} · 페르소나 기록 보유 ${r.db.rendersWithPersona} · 통과 ${r.db.personaPassed}/${r.db.personaItems}`,
  )

  console.log('\n─── 같은 양을 두 출처가 다르게 말하는가 ───')
  for (const p of r.pairs) {
    const mark = p.resolvedBy ? '✓' : p.verdict === 'diverged' ? '✗' : p.verdict === 'same' ? '·' : '?'
    console.log(`${mark} ${p.id}  ${p.quantity}`)
    console.log(`    A ${p.a.value?.toLocaleString() ?? '—'}  ${p.a.source}`)
    console.log(`    B ${p.b.value?.toLocaleString() ?? '—'}  ${p.b.source}`)
    console.log(`    Δ ${p.deltaPct == null ? '못 잼' : p.deltaPct + '%'}   ${p.note}`)
    if (p.resolvedBy) console.log(`    해소 ${p.resolvedBy}`)
  }

  if (r.gate2Market) {
    console.log(
      `\n─── ② 기획 게이트 (목표 ${r.gate2Market.target}) ───  ${r.gate2Market.file}  ${r.gate2Market.ageHours}시간 전`,
    )
    for (const p of r.gate2Market.publishers) {
      console.log(
        `  ${p.publisher.padEnd(8)} 지수 ${String(p.overallIndex ?? '못 잼').padEnd(6)} 도달가능최대 ${String(p.reachableMax ?? '—').padEnd(6)} 축 ${p.axes}  ${p.targetReachable ? '' : '← 목표에 구조적으로 못 닿는다'}  ${p.gaps.join(' / ')}`,
      )
    }
    if (r.gate2Market.unreachablePublishers.length)
      console.log(`  ⚠ 증거가 막는 출판사: ${r.gate2Market.unreachablePublishers.join(' · ')}`)
  }

  console.log('\n─── 게이트 정렬 (이름이 어긋나면 그 공정은 눈금이 차 있어도 화면에서 「못 잼」) ───')
  for (const g of r.gateAlignment)
    console.log(
      `  ${g.forcedUnmeasured ? '✗' : '·'} ${g.ord}. ${g.name.padEnd(10)} ${
        g.forcedUnmeasured ? '어긋남 → 못 잼 강제: ' + g.missing.join(' · ') : '정렬됨'
      }`,
    )

  const rl = r.db.reviewLayers
  console.log(
    `\n─── ⑦ 검수 층 (JS 셈법 = 앱과 동일) ───  L1 ${rl.L1_proofread}/${rl.volumes} · L2 기록 보유 권 ${rl.L2_personaVolumes}/${rl.volumes} · L3 ${rl.L3_answerBias}/${rl.volumes}`,
  )
  console.log(`  ⚠ SQL 의 \`is not null\` 로 세면 jsonb null 까지 세어 더 크게 나온다 — 앱과 갈린다`)

  console.log('\n─── 출처별 낡음 ───')
  for (const f of [...r.freshness].sort((a, b) => (b.ageHours ?? -1) - (a.ageHours ?? -1)))
    console.log(
      `  ${String(f.ageHours ?? '—').padStart(7)}시간  ${f.owner.padEnd(6)} ${f.source}  (${f.cadence})`,
    )

  console.log(
    `\n화면에 남은 어긋남 ${r.openDivergedCount} / ${r.pairs.length}  (값이 갈리는 짝 ${r.divergedCount} — 해소된 짝은 한쪽 출처가 남아 있어 계속 갈린다)`,
  )
  console.log(`→ ${path.relative(ROOT, OUT)}\n`)
}

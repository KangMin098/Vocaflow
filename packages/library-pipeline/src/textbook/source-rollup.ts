// packages/library-pipeline/src/textbook/source-rollup.ts
//
// **원문 재고 집계의 읽는 법 — 한 벌뿐인 정본.**
//
// `csat_source_rollup()` 이 내는 payload 는 **날것의 칸 배열**이다. 「조판 풀이 몇 편인가」
// 「초3~4 칸이 몫을 채웠나」 「분석이 안 붙은 큐가 어디인가」는 그 배열에서 **파생**된다.
//
// ── 왜 파생을 여기에 두나 ────────────────────────────────────────────────
// 같은 파생을 화면(`lib/csat/source-console.ts`)과 CLI(`scripts/csat/source-*.mjs`)가
// 각자 하면 **두 답이 갈리는 날이 온다.** 이 저장소는 그 사고를 이미 두 번 겪었다 —
// 어수 창 `PASSAGE_WORDS` 가 두 벌이라 100~200 과 120~250 이 공존했고,
// 초·중 재고 셈법이 스크립트와 화면에 따로 있었다(`kid-source.ts` 머리말).
//
// ── 세는 법이 곧 정의다 (`kid-source.ts` 와 같은 규칙) ───────────────────
// **게시 가능 = 적재분 − 명시적으로 격리된 것.**
// `publishable = true` 만 세면 아직 판정 안 받은 행이 통째로 빠져 방금 담은 칸이 영영
// 안 찬 것으로 보인다. 그래서 집계 함수가 `pub`(true)와 `notpub`(false)를 **따로** 세고,
// 여기서 `held - notpub` 을 쓴다. 미판정은 격리가 아니다.

/* ─────────────────────────── payload 모양 ─────────────────────────── */

/** `(source, feed_id, feed_label, status)` 한 칸. 이 배열 하나가 관문·원천·충전율·목표를 다 답한다. */
export interface SourceFeedCell {
  src: string
  fid: string
  lab: string
  st: string
  n: number
  dio: number
  /** 아래 여덟은 **채워진 행 수**다 — 분모는 `n`. */
  v: number
  cefr: number
  wc: number
  reg: number
  syn: number
  vrl: number
  noise: number
  pass: number
  topic: number
  win: number
  gate: number
  /** 게이트가 명시적으로 통과시킨 것 / 막은 것. 둘의 합이 `n` 보다 작으면 그만큼 미판정이다. */
  pub: number
  notpub: number
  /** 규칙만 보고 지나간 행 — 「통과」가 아니라 「아직 안 읽어 본 것」이다. */
  ruleOnly: number
  /** 시중 지문 어수창(40–250어) 안. */
  inMarket: number
}

export interface SourceRow {
  src: string
  n: number
  queued: number
  ready: number
  published: number
  archived: number
  failed: number
  dio: number
  lics: string[]
}

export interface SourceRollup {
  v: number
  rows: number
  byStatus: Record<string, number>
  pool: { n: number; inMarket: number; inRepo: number; wcMedian: number | null }
  feeds: SourceFeedCell[]
  sources: SourceRow[]
  licenses: { lic: string; n: number; dio: number; unsafe: number }[]
  vlevels: { v: number | null; n: number; wcMed: number | null; inMarket: number; inRepo: number }[]
  registers: { reg: string; n: number }[]
  cefrs: { cefr: string; n: number }[]
  topics: { topic: string; n: number }[]
  purposes: { purpose: string; n: number; archived: number; pub: number; notpub: number }[]
  blockedBy: { code: string; n: number }[]
  codes: { code: string; n: number }[]
  verdicts: { verdict: string; n: number }[]
  judges: { by: string; n: number }[]
}

/* ─────────────────────────── ① 네 관문 ─────────────────────────── */

/**
 * 원문 한 편이 교재에 실리기까지의 네 관문. **어느 하나라도 비면 뒤 단계가 그 원문을 못 본다.**
 *
 * ⚠️ 관문 사이의 뺄셈을 「손실」이라 부르지 않는다. ①→② 의 격리는 파편·편향·교리를 걷어낸
 *   **성과**이고 되돌릴 수 있다(`status='archived'`). 화면이 둘을 같은 색으로 그리면
 *   관리자가 성과를 사고로 읽는다.
 */
export interface StageGate {
  key: 'harvest' | 'gate' | 'analyze' | 'spec'
  label: string
  n: number
  /** 이 관문에서 다음으로 못 간 수. */
  lost: number
  lostLabel: string
  detail: string
}

export function stageGates(p: SourceRollup): StageGate[] {
  const total = p.rows
  const archived = p.byStatus.archived ?? 0
  const queued = p.byStatus.queued ?? 0
  const pool = p.pool.n
  return [
    {
      key: 'harvest',
      label: '① 수확',
      n: total,
      lost: archived,
      lostLabel: `− ${archived.toLocaleString()} 격리(archived)`,
      detail: '원천에서 받아 적재. 본문·출처·라이선스가 이때 붙는다.',
    },
    {
      key: 'gate',
      label: '② 게이트',
      n: total - archived,
      lost: queued,
      lostLabel: `− ${queued.toLocaleString()} 큐에서 대기`,
      detail: '용도를 먼저 정하고 기준을 따로 건다. 남은 것이 게시 가능분.',
    },
    {
      key: 'analyze',
      label: '③ 분석',
      n: pool,
      lost: Math.max(0, pool - p.pool.inMarket),
      lostLabel: `− ${Math.max(0, pool - p.pool.inMarket).toLocaleString()} 잘라야 함`,
      detail: 'V-Level·CEFR·register·구문·어수를 붙인다. 이걸 받아야 ready 가 된다.',
    },
    {
      key: 'spec',
      label: '④ 규격',
      n: p.pool.inMarket,
      lost: 0,
      lostLabel: '',
      detail: '시중 지문 어수창(40–250어) 안에 드는 것. 나머지는 조판이 잘라 써야 한다.',
    },
  ]
}

/* ─────────────────────────── ② 구간 ─────────────────────────── */

/**
 * 재고를 「지금 무엇을 해야 하나」로 갈라 놓은 구간.
 *
 * 구간은 `(feed_id, status)` 로 정의된다 — 그것이 파이프라인이 실제로 나눠 놓은 축이기
 * 때문이다. 화면이 임의로 다시 나누면 스크립트가 미는 큐와 화면이 보는 칸이 어긋난다.
 */
export interface SegmentSpec {
  key: string
  label: string
  match: (c: SourceFeedCell) => boolean
  /** 이 구간을 앞으로 미는 명령 — 화면이 그대로 보여 준다. */
  advance?: string
}

export const SOURCE_SEGMENTS: SegmentSpec[] = [
  {
    key: 'pool',
    label: '조판 풀',
    match: (c) => c.st === 'ready' || c.st === 'published',
  },
  {
    key: 'kid-queue',
    label: '초·중 발췌 큐',
    match: (c) => c.fid === 'kid-excerpt' && c.st === 'queued',
    advance: 'node scripts/acp/process-queue.mjs --feed kid-excerpt --commit',
  },
  {
    key: 'plos-extract',
    label: 'PLOS 발췌 큐',
    match: (c) => c.fid === 'plos-extract' && c.st === 'queued',
    advance: 'node scripts/acp/process-queue.mjs --feed plos-extract --commit',
  },
  {
    key: 'plos-raw',
    label: 'PLOS 원본 큐',
    match: (c) => c.src === 'plos' && c.fid !== 'plos-extract' && c.st === 'queued',
    advance: 'node scripts/csat/plos-extract.mjs',
  },
  {
    key: 'gutenberg-csat',
    label: 'Gutenberg 수능 큐',
    match: (c) => c.src === 'gutenberg' && c.fid === 'harvest' && c.st === 'queued',
    advance: 'node scripts/acp/process-queue.mjs --feed harvest --commit',
  },
  {
    key: 'compose',
    label: '작문 큐(우리 저작)',
    match: (c) => c.fid === 'compose-drain' && c.st === 'queued',
    advance: 'node scripts/csat/compose-drain-import.mjs --commit',
  },
  {
    key: 'archived',
    label: '격리분',
    match: (c) => c.st === 'archived',
  },
]

/** 한 구간의 충전율 — 무엇이 채워졌고 무엇이 비었나. 분모는 그 구간의 편수다. */
export interface SegmentFill {
  key: string
  label: string
  n: number
  advance?: string
  /** 0~1. `n` 이 0이면 null(0% 와 「해당 없음」은 다른 말이다). */
  fill: Record<'v' | 'cefr' | 'wc' | 'reg' | 'syn' | 'pass' | 'topic' | 'win' | 'gate', number | null>
}

const FILL_KEYS = ['v', 'cefr', 'wc', 'reg', 'syn', 'pass', 'topic', 'win', 'gate'] as const

export function segmentFills(p: SourceRollup): SegmentFill[] {
  return SOURCE_SEGMENTS.map((seg) => {
    const cells = p.feeds.filter(seg.match)
    const n = cells.reduce((a, c) => a + c.n, 0)
    const fill = {} as SegmentFill['fill']
    for (const k of FILL_KEYS) {
      fill[k] = n ? cells.reduce((a, c) => a + (c[k] ?? 0), 0) / n : null
    }
    return { key: seg.key, label: seg.label, n, advance: seg.advance, fill }
  })
}

/* ─────────────────────────── ③ 목표 ─────────────────────────── */

/** DB `csat_source_targets` 한 행. */
export interface SourceTarget {
  key: string
  label: string
  scope: 'kid' | 'high' | 'custom'
  match: { feedId?: string; feedLabel?: string; source?: string; status?: string[] }
  mode: 'fixed' | 'ratio_of_pool'
  target_value: number
  basis: { vMin?: number; vMax?: number } | null
  sort_order: number
  active: boolean
  note: string | null
}

export interface TargetProgress {
  key: string
  label: string
  scope: SourceTarget['scope']
  /** 적재된 행 수. */
  held: number
  /** 명시적으로 격리된 행 수. */
  quarantined: number
  /** 적재 − 격리. 미판정은 여기 들어간다. */
  publishable: number
  /** 게이트를 아직 사람·LLM 이 안 본 행 수 — 달성률을 인용할 때 함께 말해야 하는 수다. */
  unjudged: number
  goal: number
  /** 0~1+. goal 이 0이면 null. */
  pct: number | null
  left: number
  mode: SourceTarget['mode']
  /** ratio 목표의 분모가 무엇이었는지 — 「고등 재고 20,280 의 10%」. */
  basisLabel: string | null
  note: string | null
}

/** V-Level 구간의 조판 풀 재고 — ratio 목표의 분모. */
export function poolStock(p: SourceRollup, vMin: number, vMax: number): number {
  return p.vlevels
    .filter((r) => r.v != null && r.v >= vMin && r.v <= vMax)
    .reduce((a, r) => a + r.n, 0)
}

function matches(c: SourceFeedCell, m: SourceTarget['match']): boolean {
  if (m.feedId && c.fid !== m.feedId) return false
  if (m.feedLabel && c.lab !== m.feedLabel) return false
  if (m.source && c.src !== m.source) return false
  if (m.status?.length && !m.status.includes(c.st)) return false
  return true
}

export function targetProgress(p: SourceRollup, targets: SourceTarget[]): TargetProgress[] {
  return targets
    .filter((t) => t.active)
    .sort((a, b) => a.sort_order - b.sort_order || a.key.localeCompare(b.key))
    .map((t) => {
      const cells = p.feeds.filter((c) => matches(c, t.match))
      const held = cells.reduce((a, c) => a + c.n, 0)
      const quarantined = cells.reduce((a, c) => a + c.notpub, 0)
      const judged = cells.reduce((a, c) => a + c.pub + c.notpub, 0)
      const publishable = held - quarantined

      let goal = t.target_value
      let basisLabel: string | null = null
      if (t.mode === 'ratio_of_pool') {
        const vMin = t.basis?.vMin ?? 5
        const vMax = t.basis?.vMax ?? 9
        const stock = poolStock(p, vMin, vMax)
        goal = Math.round(stock * t.target_value)
        basisLabel = `V${vMin}~V${vMax} 재고 ${stock.toLocaleString()} × ${t.target_value}`
      }

      return {
        key: t.key,
        label: t.label,
        scope: t.scope,
        held,
        quarantined,
        publishable,
        unjudged: Math.max(0, held - judged),
        goal,
        pct: goal > 0 ? publishable / goal : null,
        left: Math.max(0, goal - publishable),
        mode: t.mode,
        basisLabel,
        note: t.note,
      }
    })
}

/* ─────────────────────────── ④ 증감 ─────────────────────────── */

/**
 * 두 스냅샷의 차이 — **평가는 차이에서 나온다.**
 * 「지금 21,769편」보다 「어제보다 +312, 초3~4 는 −14」가 관리자에게 쓸모 있다.
 */
export interface RollupDelta {
  rows: number
  pool: number
  inMarket: number
  byStatus: Record<string, number>
  /** 원천별 증감 — 0 인 원천은 넣지 않는다(움직인 것만 보여 준다). */
  sources: { src: string; d: number }[]
}

export function rollupDelta(cur: SourceRollup, prev: SourceRollup | null): RollupDelta | null {
  if (!prev) return null
  const byStatus: Record<string, number> = {}
  for (const k of new Set([...Object.keys(cur.byStatus), ...Object.keys(prev.byStatus)])) {
    const d = (cur.byStatus[k] ?? 0) - (prev.byStatus[k] ?? 0)
    if (d !== 0) byStatus[k] = d
  }
  const prevSrc = new Map(prev.sources.map((s) => [s.src, s.n]))
  const sources = cur.sources
    .map((s) => ({ src: s.src, d: s.n - (prevSrc.get(s.src) ?? 0) }))
    .filter((s) => s.d !== 0)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
  return {
    rows: cur.rows - prev.rows,
    pool: cur.pool.n - prev.pool.n,
    inMarket: cur.pool.inMarket - prev.pool.inMarket,
    byStatus,
    sources,
  }
}

/* ─────────────────────────── ⑤ 등록부 대조 ─────────────────────────── */

export interface SourceRegistryRow {
  source: string
  label: string
  license_class: string | null
  homepage: string | null
  role_note: string | null
  harvest_cmd: string | null
  feed_ids: string[]
  active: boolean
  note: string | null
}

/**
 * 등록부와 실재고의 어긋남 — **이것이 등록부를 두는 유일한 이유다.**
 *
 * · `unregistered` — 적재는 됐는데 등록부에 없다. 누가 언제 왜 넣었는지 아무도 모른다.
 * · `empty` — 등록은 됐는데 한 편도 없다. 수확이 안 돌았거나 죽었다.
 * · `licenseMismatch` — 등록부의 등급과 실제 행의 등급이 다르다. **법적 표기가 틀어진다.**
 */
export interface RegistryAudit {
  unregistered: { src: string; n: number }[]
  empty: { src: string; label: string }[]
  licenseMismatch: { src: string; registered: string; actual: string[] }[]
}

export function auditRegistry(p: SourceRollup, reg: SourceRegistryRow[]): RegistryAudit {
  const regBySrc = new Map(reg.map((r) => [r.source, r]))
  const liveBySrc = new Map(p.sources.map((s) => [s.src, s]))

  const unregistered = p.sources
    .filter((s) => !regBySrc.has(s.src))
    .map((s) => ({ src: s.src, n: s.n }))
    .sort((a, b) => b.n - a.n)

  const empty = reg
    .filter((r) => r.active && !liveBySrc.has(r.source))
    .map((r) => ({ src: r.source, label: r.label }))

  const licenseMismatch: RegistryAudit['licenseMismatch'] = []
  for (const r of reg) {
    const live = liveBySrc.get(r.source)
    if (!r.license_class || !live) continue
    // `restricted` 는 개별 행의 국내 판정이라 원천 등급과 달라도 어긋남이 아니다 —
    // 실측: 18곳 중 12곳이 자기 등급과 restricted 를 함께 갖는다.
    const actual = live.lics.filter((l) => l !== 'restricted' && l !== '—')
    if (actual.length && !actual.includes(r.license_class)) {
      licenseMismatch.push({ src: r.source, registered: r.license_class, actual })
    }
  }

  return { unregistered, empty, licenseMismatch }
}

/* ─────────────────────────── ⑥ 단계 밴드 ─────────────────────────── */

/**
 * **지문 재고로 채울 수 없는 밴드가 있다.**
 *
 * ── 왜 이 함수가 생겼나 (2026-09-15) ────────────────────────────────
 * ④ 소재 화면이 오래 「S5 는 지금 책을 못 만든다 — 문항을 더 만들어도 안 된다」를 빨갛게
 * 띄우고 있었다. 사실이 아니었다. `csat_stage_gates` 에서 S5 가 가진 합격선은 **`listening`
 * 하나**(BYO 병행 듣기 정합 0.80)뿐이다 — S5 는 지문을 새로 수확해 채우는 칸이 아니라
 * **같은 지문에 오디오 정합을 얹는 축**이다. 그런데 화면은 「게이트가 있는데 지문 0편」이라는
 * 한 가지 규칙으로 밴드를 판정했고, 그래서 **수확을 아무리 해도 안 움직이는 빨간불**이 섰다.
 * 관리자가 그 문구를 믿으면 하지 않아도 될 수확을 하고, 만들어도 되는 문항을 안 만든다.
 *
 * ── 왜 목록이 아니라 metric 인가 ────────────────────────────────────
 * `['S5']` 라고 적어 두면 **S5 에 `coverage` 게이트가 붙는 날 아무도 이 줄을 안 고친다.**
 * 판정 근거를 게이트 자체에 두면 그날 자동으로 지문 밴드가 된다 — 목록은 낡고 규칙은 안 낡는다.
 */
export const AUDIO_ONLY_METRICS = new Set(['listening'])

/** `csat_stage_gates` 한 행 중 밴드 판정에 필요한 두 열. */
export interface StageGateRow {
  stage: string
  metric: string
}

/** 지문 재고로 채우는 밴드 — 오디오 전용 합격선 말고 다른 것을 하나라도 가진 단계. */
export function passageGateBands(gates: StageGateRow[]): string[] {
  const bands = new Set<string>()
  for (const g of gates) if (!AUDIO_ONLY_METRICS.has(g.metric)) bands.add(g.stage)
  return [...bands].sort()
}

/** 오디오 축으로만 채우는 밴드 — 지문 0편이어도 **막힌 것이 아니다**. */
export function audioOnlyGateBands(gates: StageGateRow[]): string[] {
  const passage = new Set(passageGateBands(gates))
  const bands = new Set<string>()
  for (const g of gates) if (!passage.has(g.stage)) bands.add(g.stage)
  return [...bands].sort()
}

/**
 * V-Level → 단계 밴드.
 *
 * 경계는 `csat_stage_catalog` 뷰가 쓰던 것과 **같다** — 여기서 다르게 자르면 같은 재고가
 * 화면마다 다른 밴드에 서고, 그 차이를 「재고가 움직였다」로 읽게 된다.
 *
 * ⚠️ 딱 한 가지를 바꿨다: 뷰는 `v_level IS NULL` 을 **조용히 S2 로 넣었다.** 수준을 모르는
 * 글이 자동화 다독 재고로 세어지는 것인데, 그러면 「S2 는 차 있다」가 거짓이 될 수 있다.
 * 모르는 것은 모른다고 적는다.
 */
export function bandForVLevel(v: number | null): string {
  if (v == null) return '미분류'
  if (v <= 2) return 'S1'
  if (v <= 4) return 'S2'
  if (v <= 6) return 'S3'
  return 'S4'
}

/** 한 밴드의 조판 풀 재고. **화면 전용은 이미 빠져 있다** — 집계의 `in_pool` 이 걸러 낸다. */
export interface BandStock {
  band: string
  /** 이 밴드에 지문 합격선이 걸려 있는가. */
  gated: boolean
  /** 오디오 축으로만 채우는 밴드인가 — 지문 0편이 결함이 아닌 자리. */
  audioOnly: boolean
  n: number
  /** 시중 지문 어수창(40–250어) 안. */
  inMarket: number
  /** 사내 규격창(100–200어) 안. */
  inRepo: number
}

/**
 * 밴드별 조판 풀 재고 — `vlevels`(집계의 `in_pool` 기준)에서 접는다.
 *
 * ⚠️ **중앙 어수는 접지 않는다.** 중앙값의 평균은 중앙값이 아니다. 밴드 단위로 그 값이
 * 필요하면 집계 함수가 밴드별로 내야 한다.
 */
export function bandStock(p: SourceRollup, gates: StageGateRow[]): BandStock[] {
  const passage = new Set(passageGateBands(gates))
  const audio = new Set(audioOnlyGateBands(gates))
  const m = new Map<string, BandStock>()
  const ensure = (band: string): BandStock => {
    const cur =
      m.get(band) ??
      { band, gated: passage.has(band), audioOnly: audio.has(band), n: 0, inMarket: 0, inRepo: 0 }
    m.set(band, cur)
    return cur
  }
  // 합격선이 있는 밴드는 재고가 0이어도 칸을 세운다 — 빈 칸이 곧 할 일이다.
  for (const b of [...passage, ...audio]) ensure(b)
  for (const r of p.vlevels) {
    const cur = ensure(bandForVLevel(r.v))
    cur.n += r.n
    cur.inMarket += r.inMarket
    cur.inRepo += r.inRepo
  }
  return [...m.values()].sort((a, b) => a.band.localeCompare(b.band))
}

/** 지문으로 채워야 하는데 0편인 밴드 — **그 단계 책은 지금 못 만든다.** */
export function emptyPassageBands(stock: BandStock[]): string[] {
  return stock.filter((b) => b.gated && b.n === 0).map((b) => b.band)
}

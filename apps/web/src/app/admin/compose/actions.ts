// apps/web/src/app/admin/compose/actions.ts
// ACP §20 재저작 콘솔 — 서버 액션 (피드 등록 · 취재 묶음 · 발주 큐).
//
// 권한은 RLS 가 본다(article_compose_* 정책 = is_admin_or_curator). 요청 스코프 클라이언트를
// 쓰므로 서비스 키로 우회하지 않는다 — 관리자가 아니면 INSERT 가 정책에서 막힌다.
//
// 검증은 화면이 아니라 **레지스트리**가 한다. buildJobSpec 이 유형·레벨·글유형·어휘기능의
// 정합을 이미 판정하므로 여기서 규칙을 다시 적지 않는다(적으면 두 벌이 갈린다).

'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  COMPOSE_USER_AGENT,
  CrawlGate,
  FACT_SOURCES,
  MIN_ARTICLE_WORDS,
  buildFingerprint,
  extractArticle,
  buildJobSpec,
  clusterStories,
  collectStories,
  discoverFeeds,
  isPublisherHost,
  primeRobots,
  readStoryForFacts,
  verifyFeedUrl,
  type DiscoveredFeed,
  type FactSourceSpec,
  type FeedSkip,
  type FetchDeps,
  type LearningTrack,
  type LexicalSkill,
  type Register,
} from '@vocaflow/library-pipeline'

import { createClient } from '@/lib/supabase/server'

import { planContentGateScan } from './publish-gate'
import {
  BATCH_ACTIONS,
  JOB_ACTIONS,
  type BatchActionKey,
  type JobActionKey,
} from './transitions'

export interface ActionResult {
  ok: boolean
  error?: string
}

const PATH = '/admin/compose'

async function db(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient
}

// ── 피드 자동 발견 ───────────────────────────────────────────────────

const DISCOVERY_TIMEOUT_MS = 12_000

/** 실 네트워크 어댑터. 패키지는 순수하게 두고 환경 의존은 여기서만 갖는다. */
function nodeFetchDeps(): FetchDeps {
  return {
    async fetchText(url, headers) {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), DISCOVERY_TIMEOUT_MS)
      try {
        const res = await fetch(url, { headers, signal: ctrl.signal, redirect: 'follow' })
        const text = res.ok ? await res.text() : ''
        return { ok: res.ok, status: res.status, text }
      } finally {
        clearTimeout(timer)
      }
    },
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  }
}

export interface DiscoverResult extends ActionResult {
  feeds?: DiscoveredFeed[]
  /** 실패마다 유형·사유·다음 행동 — 운영자가 "안 되네" 에서 멈추지 않게 한다 */
  skipped?: FeedSkip[]
  requests?: number
}

/**
 * 자동 발견이 실패한 발행사의 주소를 직접 확인한다 — **백스톱**.
 *
 * 자동 발견이 기본 경로이고 이것은 대안이다. 다만 검증은 똑같이 한다 —
 * robots 를 보고, 열어서 항목이 파싱되는지 확인한 뒤에만 인정한다.
 */
export async function verifyFeedUrlAction(
  sourceKey: string,
  url: string,
): Promise<DiscoverResult> {
  const spec = FACT_SOURCES[sourceKey]
  if (!spec) return { ok: false, error: `알 수 없는 소스 키: ${sourceKey}` }
  try {
    const r = await verifyFeedUrl(spec, url, new CrawlGate(), nodeFetchDeps())
    if ('fail' in r) {
      return { ok: false, error: `${r.fail.reason} — ${r.fail.nextAction}`, skipped: [r.fail] }
    }
    return { ok: true, feeds: [r.feed] }
  } catch (e) {
    return { ok: false, error: `확인 실패: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/**
 * 발행사의 피드를 찾아 확인까지 마쳐 돌려준다.
 *
 * **관리자가 주소를 찾아 오지 않게 하는 것이 이 액션의 목적이다.** 발행사가 스스로 알린
 * 피드(autodiscovery)를 먼저 보고, 없을 때만 관습 경로를 최소로 두드린다.
 * robots·요청 간격은 패키지 게이트가 지킨다.
 */
export async function discoverFeedsForSource(sourceKey: string): Promise<DiscoverResult> {
  const spec = FACT_SOURCES[sourceKey]
  if (!spec) return { ok: false, error: `알 수 없는 소스 키: ${sourceKey}` }

  try {
    const r = await discoverFeeds(spec, new CrawlGate(), nodeFetchDeps())
    if (r.feeds.length === 0) {
      return {
        ok: false,
        error:
          r.skipped[0]?.reason ??
          `${spec.publisher} 에서 피드를 찾지 못했습니다. 발행사가 피드를 공개하지 않았을 수 있습니다.`,
        feeds: [],
        skipped: r.skipped,
        requests: r.requests,
      }
    }
    return { ok: true, feeds: r.feeds, skipped: r.skipped, requests: r.requests }
  } catch (e) {
    return { ok: false, error: `조회 실패: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ── 피드 ─────────────────────────────────────────────────────────────

/**
 * 피드 등록. **항상 꺼진 상태로 들어온다** — 등록과 수집 시작은 다른 결정이고,
 * 주소를 붙여 넣자마자 외부 요청이 나가면 되돌릴 수 없다.
 */
export async function addFeed(input: {
  sourceKey: string
  url: string
  label: string
}): Promise<ActionResult> {
  const spec = FACT_SOURCES[input.sourceKey]
  if (!spec) return { ok: false, error: `알 수 없는 소스 키: ${input.sourceKey}` }
  if (!spec.access.termsReviewed) {
    return { ok: false, error: `${spec.publisher}: 이용약관 확인 전에는 등록하지 않습니다` }
  }

  let parsed: URL
  try {
    parsed = new URL(input.url)
  } catch {
    return { ok: false, error: '피드 주소 형식이 올바르지 않습니다' }
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'https 주소만 등록합니다' }
  }
  // 발행사와 무관한 호스트를 등록하면 그 소스의 접근 정책·계통 표시가 거짓이 된다.
  // 다만 피드는 별도 호스트에서 서비스되는 일이 흔하므로(BBC → feeds.bbci.co.uk)
  // 레지스트리의 feedHosts 도 함께 인정한다.
  if (!isPublisherHost(spec, parsed.host)) {
    return {
      ok: false,
      error: `${spec.publisher} 의 피드가 아닙니다 (입력 호스트: ${parsed.host})`,
    }
  }
  const label = input.label.trim()
  if (label.length < 2) return { ok: false, error: '피드 이름을 2자 이상 적어 주세요' }

  const { error } = await (await db())
    .from('article_compose_feeds')
    .insert({ source_key: spec.key, url: parsed.toString(), label, enabled: false })

  if (error) {
    if (error.code === '23505') return { ok: false, error: '이미 등록된 피드 주소입니다' }
    return { ok: false, error: error.message }
  }
  revalidatePath(PATH)
  return { ok: true }
}

/** 활성/비활성. 켜는 순간부터 다음 수집에 포함된다. */
export async function setFeedEnabled(id: string, enabled: boolean): Promise<ActionResult> {
  const { error } = await (await db())
    .from('article_compose_feeds')
    .update({ enabled })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}

export async function deleteFeed(id: string): Promise<ActionResult> {
  const { error } = await (await db()).from('article_compose_feeds').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}

// ── ③ 발견 ───────────────────────────────────────────────────────────

export interface ClusterView {
  headline: string
  earliestAt: string
  independentLines: number
  members: Array<{
    sourceKey: string
    publisher: string
    wire: string | null
    title: string
    url: string
    published_at: string | null
  }>
}

export interface DiscoveryRunResult extends ActionResult {
  pursue?: ClusterView[]
  singleLine?: ClusterView[]
  holdingCount?: number
  skipped?: Array<{ url: string; reason: string }>
  requests?: number
}

/**
 * 등록된 활성 피드를 훑어 사건 묶음을 제안한다.
 *
 * **본문을 읽지 않는다** — 피드와 robots 만 묻는다. 후보가 수십 건이어도 실제로 읽는 것은
 * 관리자가 "취재 시작"을 누른 묶음뿐이다.
 */
export async function runDiscovery(): Promise<DiscoveryRunResult> {
  const client = await db()
  const { data, error } = await client
    .from('article_compose_feeds')
    .select('id, source_key, url, label, enabled')
    .eq('enabled', true)
  if (error) return { ok: false, error: error.message }

  const feeds = (data ?? []) as Array<{
    id: string
    source_key: string
    url: string
    label: string
    enabled: boolean
  }>
  if (feeds.length === 0) {
    return { ok: false, error: '활성 피드가 없습니다. ② 피드에서 먼저 켜 주세요.' }
  }

  // 수집은 외부 네트워크를 탄다 — 예외가 밖으로 나가면 화면에서 "반응 없음" 으로 보인다.
  let report: Awaited<ReturnType<typeof collectStories>>
  try {
    report = await collectStories(
      feeds.map((f) => ({ sourceKey: f.source_key, url: f.url, label: f.label, enabled: true })),
      nodeFetchDeps(),
    )
  } catch (e) {
    return {
      ok: false,
      error: `수집 중 오류가 났습니다 — ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  // 피드별 결과를 표에 남긴다 — 조용한 0건과 차단을 구별할 수 있어야 한다.
  // 기록 실패가 수집 결과를 통째로 날리면 안 되므로 개별로 삼킨다.
  const now = new Date().toISOString()
  await Promise.allSettled(
    feeds.map((f) => {
      const host = (() => {
        try {
          return new URL(f.url).host.toLowerCase()
        } catch {
          return ''
        }
      })()
      const note = report.skipped.find((s) => s.url === f.url)?.reason ?? null
      // 이 피드가 실제로 내놓은 항목 수 — **보류분 포함**. 묶음에 들어간 것만 세면
      //   갓 올라온 기사가 48시간 보류에 걸려 빠져서 잘 도는 피드가 0 으로 보인다.
      const found = report.perFeed[f.url] ?? 0
      return client
        .from('article_compose_feeds')
        .update({
          robots_status: report.robots[host] ?? null,
          robots_at: now,
          last_polled_at: now,
          last_found: found,
          last_note: note,
        })
        .eq('id', f.id)
    }),
  )

  // 후보를 보관한다 — 피드는 최근분만 싣고 I15 는 48시간을 요구하므로, 저장하지 않으면
  // 오늘 보류된 기사가 이틀 뒤엔 피드에서 내려가 영영 못 쓴다. 저장해 두면 저절로 익는다.
  const seen = [
    ...report.pursue.flatMap((c) => c.members),
    ...report.singleLine.flatMap((c) => c.members),
    ...report.holding,
  ]
  if (seen.length > 0) {
    await client.from('article_compose_candidates').upsert(
      seen
        .filter((m) => m.published_at)
        .map((m) => ({
          source_key: m.sourceKey,
          publisher: m.publisher,
          wire: m.wire,
          title: m.title,
          url: m.url,
          published_at: m.published_at,
        })),
      { onConflict: 'url', ignoreDuplicates: true },
    )
  }

  // 이번에 받은 것만이 아니라 **보관된 후보 전체**에서 48시간이 지난 것을 다시 묶는다.
  const { data: ripeRows } = await client
    .from('article_compose_candidates')
    .select('source_key, publisher, wire, title, url, published_at')
    .eq('status', 'open')
    .lt('published_at', new Date(Date.now() - 48 * 3_600_000).toISOString())
    .order('published_at', { ascending: false })
    .limit(400)

  const ripe = ((ripeRows ?? []) as Array<{
    source_key: string
    publisher: string
    wire: string | null
    title: string
    url: string
    published_at: string
  }>).map((r) => ({
    sourceKey: r.source_key,
    publisher: r.publisher,
    wire: r.wire,
    title: r.title,
    url: r.url,
    published_at: r.published_at,
    holdMs: 0,
  }))

  const storedClusters = clusterStories(ripe)

  const toView = (c: (typeof report.pursue)[number]): ClusterView => ({
    headline: c.headline,
    earliestAt: c.earliestAt,
    independentLines: c.independentLines,
    members: c.members.map((m) => ({
      sourceKey: m.sourceKey,
      publisher: m.publisher,
      wire: m.wire,
      title: m.title,
      url: m.url,
      published_at: m.published_at,
    })),
  })

  revalidatePath(PATH)
  return {
    ok: true,
    // 보관 후보에서 다시 묶은 결과가 실질 목록이다(이번 수집분만 보면 거의 늘 0이다).
    pursue: storedClusters.filter((c) => c.worthPursuing).map(toView),
    singleLine: storedClusters.filter((c) => !c.worthPursuing).slice(0, 30).map(toView),
    holdingCount: report.holding.length,
    skipped: report.skipped,
    requests: report.requests,
  }
}

/**
 * 취재 시작 — 여기서 **처음으로** 기사 본문을 읽는다.
 *
 * 읽는 즉시 7-gram 지문만 남기고 본문은 버린다. 저장되는 것은 서지 정보와 지문뿐이라
 * 나중에 원문을 다시 열어 볼 수 없다 — 그래서 사실 원장을 이때 성실히 채워야 한다.
 */
export async function startCoverage(cluster: ClusterView): Promise<ActionResult & { id?: string }> {
  if (cluster.independentLines < 2) {
    return { ok: false, error: '독립 취재 계통이 2개 미만이라 취재를 시작할 수 없습니다' }
  }
  const client = await db()

  const { data: batch, error: batchErr } = await client
    .from('article_compose_batches')
    .insert({
      topic: cluster.headline,
      event_occurred_at: cluster.earliestAt || null,
      status: 'collecting',
    })
    .select('id')
    .single()
  if (batchErr) return { ok: false, error: batchErr.message }
  const batchId = (batch as { id: string }).id

  // ACP 와 소스가 9곳 겹친다 — 같은 기사를 ACP 가 이미 본문으로 발행해 뒀다면
  // 재저작할 이유가 없다(그냥 가져올 수 있는 것에 LLM 비용과 게이트를 쓰는 일이다).
  const urls = cluster.members.map((m) => m.url)
  const { data: already } = await client
    .from('library_articles')
    .select('source_url, title')
    .in('source_url', urls)
  const taken = new Set(((already ?? []) as Array<{ source_url: string }>).map((a) => a.source_url))

  const gate = new CrawlGate()
  const deps = nodeFetchDeps()
  const failures: string[] = []
  let saved = 0

  for (const m of cluster.members) {
    if (taken.has(m.url)) {
      failures.push(`${m.publisher}: ACP 가 이미 본문으로 가져간 기사입니다`)
      continue
    }
    const spec = FACT_SOURCES[m.sourceKey]
    if (!spec) {
      failures.push(`${m.publisher}: 알 수 없는 소스`)
      continue
    }
    const host = new URL(m.url).host
    await primeRobots(host, gate, deps)
    const read = await readStoryForFacts(spec, m.url, gate, deps, () => null)
    if (!read.ok) {
      failures.push(`${m.publisher}: ${read.reason}`)
      continue
    }
    const { error } = await client.from('article_compose_sources').insert({
      batch_id: batchId,
      publisher: read.row.publisher,
      url: read.row.url,
      published_at: m.published_at,
      fingerprint: read.row.fingerprint,
      access_basis: read.row.access_basis,
      robots_checked_at: read.row.robots_checked_at,
      wire: read.row.wire,
    })
    if (error) failures.push(`${m.publisher}: ${error.message}`)
    else saved++
  }

  if (saved < 2) {
    // 독립 2계통을 못 채웠으면 빈 묶음을 남기지 않는다.
    await client.from('article_compose_batches').delete().eq('id', batchId)
    return {
      ok: false,
      error: `읽어 온 소스가 ${saved}건뿐이라 취재를 시작하지 않았습니다. ${failures.join(' · ')}`,
    }
  }

  await client
    .from('article_compose_batches')
    .update({ status: 'ledger_ready' })
    .eq('id', batchId)
  revalidatePath(PATH)
  return { ok: true, id: batchId }
}

// ── ④ 원장 ───────────────────────────────────────────────────────────

export async function addFactCard(input: {
  batchId: string
  claim: string
  kind: 'event' | 'figure' | 'utterance' | 'background'
  quote?: string
  quoteIsPublic?: boolean
}): Promise<ActionResult> {
  const claim = input.claim.trim()
  if (claim.length < 5) return { ok: false, error: '사실을 5자 이상 적어 주세요' }
  if (input.kind === 'utterance') {
    if (!input.quote?.trim()) return { ok: false, error: '발언 카드는 인용문이 필요합니다' }
    if (input.quoteIsPublic === undefined) {
      return { ok: false, error: '공개 발언 여부를 지정해 주세요' }
    }
  }

  const { error } = await (await db()).from('article_fact_ledger').insert({
    batch_id: input.batchId,
    claim,
    kind: input.kind,
    quote: input.kind === 'utterance' ? input.quote!.trim() : null,
    quote_is_public: input.kind === 'utterance' ? input.quoteIsPublic! : null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}

/** 확인 표시 — 이 사실을 어느 소스의 몇 번째 자리에서 봤는가. */
export async function addAttestation(input: {
  factId: string
  sourceId: string
  ordinal: number
}): Promise<ActionResult> {
  if (!Number.isInteger(input.ordinal) || input.ordinal < 0) {
    return { ok: false, error: '등장 순서는 0 이상의 정수입니다' }
  }
  const { error } = await (await db()).from('article_fact_attestation').insert({
    fact_id: input.factId,
    source_id: input.sourceId,
    ordinal: input.ordinal,
  })
  if (error) {
    if (error.code === '23505') return { ok: false, error: '이미 표시된 소스입니다' }
    return { ok: false, error: error.message }
  }
  revalidatePath(PATH)
  return { ok: true }
}

export async function deleteFactCard(id: string): Promise<ActionResult> {
  const { error } = await (await db()).from('article_fact_ledger').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}

// ── ⑦ 발행 ───────────────────────────────────────────────────────────

/**
 * 발행 — 되돌릴 수 없다.
 *
 * 게이트 통과는 DB 트리거가 강제하므로 여기서 다시 검사하지 않는다(두 벌이 갈린다).
 * 실패하면 트리거의 메시지를 그대로 보여 준다 — 무엇이 막았는지가 거기 적혀 있다.
 */
export async function publishComposedArticle(articleId: string): Promise<ActionResult> {
  const client = await db()
  const { error } = await client
    .from('library_articles')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', articleId)
    .eq('source', 'original')

  if (!error) {
    revalidatePath(PATH)
    return { ok: true }
  }

  // 발행을 막는 게이트는 두 종류다 — 재저작 게이트(I12~I17)와 **콘텐츠 품질 게이트**.
  // 후자가 막으면 트리거가 "품질 게이트 FAIL" 이라고만 말해서, 화면에서 재저작 게이트가
  // 전부 통과로 보이는데 발행만 안 되는 상황이 된다(2026-08-17 E2E 점검에서 재현).
  // 그래서 실패하면 어느 불변식이 막았는지 조회해 그대로 알려 준다.
  const { data } = await client.rpc('run_content_quality_gates', {
    p_scope: 'article',
    p_id: articleId,
  })
  const failed = ((data ?? []) as Array<{ invariant: string; severity: string; verdict: string }>)
    .filter((g) => g.severity === 'critical' && g.verdict === 'FAIL')
    .map((g) => g.invariant)

  if (failed.length > 0) {
    return {
      ok: false,
      error: `콘텐츠 품질 게이트가 막았습니다 — ${failed.join(' · ')}. ${
        failed.some((f) => f.includes('추출'))
          ? '어휘 추출이 아직 안 됐습니다. 드레인의 처리 단계를 먼저 실행하세요.'
          : '해당 항목을 고친 뒤 다시 시도하세요.'
      }`,
    }
  }
  return { ok: false, error: error.message }
}

/** ⑦ 발행 화면이 "왜 아직 못 내보내는지" 를 보여 주기 위한 조회. */
export interface ContentGateRow {
  article_id: string
  invariant: string
  severity: string
  verdict: string
}

/**
 * 조회 결과 — **무엇을 못 읽었는지까지** 돌려준다.
 *
 * 예전에는 판정 행만 돌려줬다. 그래서 조회하지 않은 글(상한 밖)과 조회가 실패한 글이
 * "FAIL 행이 없는 글" 과 구별되지 않았고, 화면은 그것을 통과로 그렸다 — 그리고 발행을
 * 누르면 서버가 거부했다(2026-09-06). 읽은 것과 못 읽은 것을 갈라 담는다.
 */
export interface ContentGateScan {
  rows: ContentGateRow[]
  /** RPC 가 실제로 판정을 돌려준 글 — 이 목록에 없으면 '미확인' 이다 */
  checked: string[]
  /** 상한을 넘겨 아예 조회하지 않은 글 */
  skipped: string[]
  /** RPC 가 오류를 낸 글 — 조회는 시도했으나 답을 못 받았다 */
  failed: string[]
}

/**
 * 판정 1건마다 RPC 1회다. 전량을 한 줄로 돌리면 화면이 열리지 않으므로 묶음 병렬로 돌리고,
 * 상한을 넘긴 것은 **조용히 자르지 않고** skipped 로 말한다.
 */
export async function fetchContentGates(articleIds: string[]): Promise<ContentGateScan> {
  const plan = planContentGateScan(articleIds)
  if (plan.scanned.length === 0) {
    return { rows: [], checked: [], skipped: plan.skipped, failed: [] }
  }

  const client = await db()
  const rows: ContentGateRow[] = []
  const checked: string[] = []
  const failed: string[] = []

  for (const group of plan.chunks) {
    const results = await Promise.all(
      group.map(async (id) => {
        const { data, error } = await client.rpc('run_content_quality_gates', {
          p_scope: 'article',
          p_id: id,
        })
        return { id, data, error }
      }),
    )
    for (const r of results) {
      // 오류난 글을 checked 에 넣으면 "판정 0건 = 통과" 가 되어 처음 결함이 되돌아온다.
      if (r.error) {
        failed.push(r.id)
        continue
      }
      checked.push(r.id)
      for (const g of (r.data ?? []) as Array<{
        invariant: string
        severity: string
        verdict: string
      }>) {
        rows.push({
          article_id: r.id,
          invariant: g.invariant,
          severity: g.severity,
          verdict: g.verdict,
        })
      }
    }
  }

  return { rows, checked, skipped: plan.skipped, failed }
}

// ── 취재 묶음 ────────────────────────────────────────────────────────

/**
 * 취재 묶음 수동 개설.
 *
 * ③ 발견이 생기기 전까지의 경로다. 사건 시각은 I15(48시간)의 재료이므로
 * **비워 두지 않는다** — 비면 게이트가 "검증 불가" 로 차단한다.
 */
export async function createBatch(input: {
  topic: string
  eventOccurredAt: string | null
}): Promise<ActionResult & { id?: string }> {
  const topic = input.topic.trim()
  if (topic.length < 4) return { ok: false, error: '사건/주제를 4자 이상 적어 주세요' }

  let occurred: string | null = null
  if (input.eventOccurredAt) {
    const t = Date.parse(input.eventOccurredAt)
    if (Number.isNaN(t)) return { ok: false, error: '사건 시각을 읽을 수 없습니다' }
    if (t > Date.now()) return { ok: false, error: '사건 시각이 미래입니다' }
    occurred = new Date(t).toISOString()
  }

  const { data, error } = await (await db())
    .from('article_compose_batches')
    .insert({ topic, event_occurred_at: occurred, status: 'collecting' })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true, id: (data as { id: string }).id }
}

// ── 발주 ─────────────────────────────────────────────────────────────

/**
 * 발주 생성. 사양은 레지스트리(buildJobSpec)가 채운다 — 화면이 길이·문장길이·지시를
 * 직접 적지 않는다. 그래야 유형 정의를 고치면 이후 발주가 자동으로 따라온다.
 */
export async function createComposeJob(input: {
  batchId: string
  track: LearningTrack
  targetVLevel: number
  register?: Register
  skillFocus?: LexicalSkill
}): Promise<ActionResult> {
  const spec = buildJobSpec(input.track, input.targetVLevel, {
    register: input.register,
    skillFocus: input.skillFocus,
  })
  if ('error' in spec) return { ok: false, error: spec.error }

  const { error } = await (await db()).from('article_compose_jobs').insert({
    batch_id: input.batchId,
    track: spec.track,
    register: spec.register,
    target_v_level: spec.targetVLevel,
    skill_focus: spec.skillFocus,
    words_min: spec.words.min,
    words_max: spec.words.max,
    avg_sentence_words: spec.avgSentenceWords,
    directives: [...spec.directives],
    activities: [...spec.activities],
  })

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: '이 취재 묶음에 같은 유형·레벨 발주가 이미 있습니다' }
    }
    return { ok: false, error: error.message }
  }
  revalidatePath(PATH)
  return { ok: true }
}

/**
 * 발주 상태를 바꾸거나 지운다 — 취소 · 회수 · 재시도 · 삭제.
 *
 * 허용 전이는 화면과 **같은 표**(transitions.ts)에서 읽는다. 예전에는 화면이 `pending`·
 * `claimed` 만 그리고 서버가 `.eq('status','pending')` 을 따로 적고 있어서, 스키마가
 * 허용하는 `failed`·`drafted` 발주는 사유만 보인 채 큐에 영원히 남았다(2026-09-06).
 *
 * 재실행 안전: 같은 동작을 두 번 눌러도 두 번째는 출발 상태가 아니라서 **0행**이 되고,
 * 0행은 성공이 아니라 "그 사이에 바뀌었다" 로 알린다 — 조용한 무동작이 가장 나쁘다.
 */
export async function runComposeJobAction(
  id: string,
  action: JobActionKey,
): Promise<ActionResult> {
  const spec = JOB_ACTIONS[action]
  if (!spec) return { ok: false, error: `알 수 없는 발주 동작: ${String(action)}` }

  const table = (await db()).from('article_compose_jobs')
  const { data, error } =
    spec.to === null
      ? await table.delete().eq('id', id).in('status', spec.from).select('id')
      : await table
          .update(
            // 재시도·회수 모두 잡은 흔적을 지운다. **attempts 와 last_error 는 남긴다** —
            // 몇 번 실패했고 무엇에 막혔는지를 지우면 언제 그만둘지 판단할 수 없다.
            { status: spec.to, claimed_by: null, claimed_at: null },
          )
          .eq('id', id)
          .in('status', spec.from)
          .select('id')

  if (error) return { ok: false, error: error.message }
  if ((data ?? []).length === 0) {
    return {
      ok: false,
      error: `${spec.label} 할 수 없는 상태입니다 (${spec.from.join(' · ')} 일 때만 가능). 그 사이에 드레인이 상태를 바꿨을 수 있으니 화면을 새로 고쳐 확인하세요.`,
    }
  }
  revalidatePath(PATH)
  return { ok: true }
}

// ── 취재 묶음 정리 ───────────────────────────────────────────────────

/**
 * 취재 묶음 폐기 · 복구 · 삭제.
 *
 * 묶음은 만들기만 하고 치우는 길이 없어 목록이 늘기만 했다. 스키마에는 이미 `abandoned`
 * 가 있었는데 화면이 쓰지 않았다.
 *
 * 삭제는 소스·사실·발주를 CASCADE 로 함께 지운다. 그래서 **이 묶음에서 나온 지문이
 * 하나라도 있으면 먼저 막는다** — DB 제약(chk_original_needs_batch)이 어차피 거부하는데,
 * 그때 나오는 것은 제약 이름뿐이라 무엇이 문제인지 알 수 없다.
 */
export async function runBatchAction(
  id: string,
  action: BatchActionKey,
): Promise<ActionResult> {
  const spec = BATCH_ACTIONS[action]
  if (!spec) return { ok: false, error: `알 수 없는 묶음 동작: ${String(action)}` }
  const client = await db()

  if (spec.to === null) {
    const { count, error: countError } = await client
      .from('library_articles')
      .select('id', { count: 'exact', head: true })
      .eq('compose_batch_id', id)
    // count 가 null 이면 "0건" 이 아니라 **모름** 이다. 모르는 채로 지우지 않는다.
    if (countError || count === null) {
      return {
        ok: false,
        error: '이 묶음에서 나온 지문이 있는지 확인하지 못했습니다. 확인 전에는 지우지 않습니다.',
      }
    }
    if (count > 0) {
      return {
        ok: false,
        error: `이 묶음에서 나온 지문이 ${count}편 있어 지울 수 없습니다. 목록에서만 치우려면 폐기를 쓰세요.`,
      }
    }
  }

  const table = client.from('article_compose_batches')
  const { data, error } =
    spec.to === null
      ? await table.delete().eq('id', id).in('status', spec.from).select('id')
      : await table.update({ status: spec.to }).eq('id', id).in('status', spec.from).select('id')

  if (error) return { ok: false, error: error.message }
  if ((data ?? []).length === 0) {
    return {
      ok: false,
      error: `${spec.label} 할 수 없는 상태입니다 (${spec.from.join(' · ')} 일 때만 가능). 화면을 새로 고쳐 확인하세요.`,
    }
  }
  revalidatePath(PATH)
  return { ok: true }
}

// ── ③-B URL 직접 취재 ────────────────────────────────────────────────
//
// 피드가 없거나(AP·CBC) 최근분만 실어(대부분) 발견으로 안 잡히는 사건이 많다.
// 운영자가 아는 기사 주소를 넣으면 그 자리에서 취재를 시작한다.
//
// ⚠ 규율은 피드 경로와 **완전히 같다** — robots 를 보고, 간격을 지키고, 본문은 저장하지
//   않는다(지문만 남는다). URL 입력은 검증을 건너뛰는 뒷문이 아니다.

export interface ScrapedSource {
  url: string
  publisher: string
  /** 레지스트리에 있는 발행사인가 — 없으면 계통·약관을 우리가 보증하지 못한다 */
  known: boolean
  wire: string | null
  title: string | null
  wordCount: number
  /** 어디서 건졌는가 — density 는 신뢰도가 낮다 */
  via: string
  publishedAt: string | null
  /** 사실 카드를 적을 때 훑을 문장 목록. **저장하지 않는다** */
  sentences: string[]
}

export interface ScrapeResult extends ActionResult {
  sources?: ScrapedSource[]
  failed?: Array<{ url: string; reason: string }>
  independentLines?: number
  batchId?: string
}

/** 호스트로 레지스트리 소스를 찾는다. 없으면 미등록으로 처리한다. */
function specForUrl(host: string): { spec: FactSourceSpec | null; publisher: string; wire: string | null } {
  for (const s of Object.values(FACT_SOURCES)) {
    if (isPublisherHost(s, host)) return { spec: s, publisher: s.publisher, wire: s.wire }
  }
  return { spec: null, publisher: host, wire: null }
}

/**
 * 기사 URL 목록 → 취재 묶음.
 *
 * 독립 계통 2개를 못 채우면 **묶음을 만들지 않는다** — 빈 껍데기를 남기면 나중에
 * "왜 사실이 확인 안 되지" 를 원장에서 다시 묻게 된다.
 */
export async function startCoverageFromUrls(input: {
  urls: string[]
  topic: string
  eventOccurredAt: string | null
}): Promise<ScrapeResult> {
  const topic = input.topic.trim()
  if (topic.length < 4) return { ok: false, error: '사건/주제를 4자 이상 적어 주세요' }

  const urls = [...new Set(input.urls.map((u) => u.trim()).filter(Boolean))]
  if (urls.length < 2) {
    return { ok: false, error: '서로 다른 발행사의 기사 주소가 2개 이상 필요합니다 (독립 확인)' }
  }

  const gate = new CrawlGate()
  const deps = nodeFetchDeps()
  const ok: ScrapedSource[] = []
  const failed: Array<{ url: string; reason: string }> = []

  for (const url of urls) {
    let host: string
    try {
      const u = new URL(url)
      if (u.protocol !== 'https:') {
        failed.push({ url, reason: 'https 주소만 읽습니다' })
        continue
      }
      host = u.host.toLowerCase()
    } catch {
      failed.push({ url, reason: '주소 형식이 올바르지 않습니다' })
      continue
    }

    const { spec, publisher, wire } = specForUrl(host)
    const robots = await primeRobots(host, gate, deps)
    if (robots === 'failed') {
      failed.push({ url, reason: `${host} robots.txt 를 가져오지 못했습니다 — 읽지 않습니다` })
      continue
    }
    const decision = gate.check(url, Date.now())
    if (!decision.allowed) {
      failed.push({ url, reason: decision.reason ?? '접근이 허용되지 않습니다' })
      continue
    }
    if (decision.waitMs > 0) await deps.sleep(decision.waitMs)

    let html = ''
    try {
      gate.markFetched(url, Date.now())
      const res = await deps.fetchText(url, {
        'User-Agent': COMPOSE_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      })
      if (res.status === 403) {
        failed.push({ url, reason: '발행사가 우리 수집기를 거절했습니다(403). 우회하지 않습니다.' })
        continue
      }
      if (!res.ok) {
        failed.push({ url, reason: `응답 ${res.status}` })
        continue
      }
      html = res.text
    } catch (e) {
      failed.push({ url, reason: `요청 실패: ${e instanceof Error ? e.message : String(e)}` })
      continue
    }

    const art = extractArticle(html)
    if (art.wordCount < MIN_ARTICLE_WORDS) {
      failed.push({
        url,
        reason: `본문을 찾지 못했습니다(${art.wordCount}어). 기사 페이지가 맞는지 확인하세요.`,
      })
      continue
    }

    ok.push({
      url,
      publisher,
      known: spec !== null,
      wire,
      title: art.title,
      wordCount: art.wordCount,
      via: art.via,
      publishedAt: art.publishedAt,
      sentences: art.sentences.slice(0, 40),
    })
  }

  const lines = new Set(ok.map((s) => s.wire ?? s.publisher.toLowerCase()))
  if (lines.size < 2) {
    return {
      ok: false,
      error: `독립 취재 계통이 ${lines.size}개뿐입니다 — 서로 다른 발행사의 기사가 2곳 이상 필요합니다.`,
      sources: ok,
      failed,
      independentLines: lines.size,
    }
  }

  // 여기서부터 저장 — 본문이 아니라 **지문과 서지 정보만** 남긴다.
  const client = await db()
  const { data: batch, error: batchErr } = await client
    .from('article_compose_batches')
    .insert({
      topic,
      event_occurred_at: input.eventOccurredAt,
      status: 'ledger_ready',
    })
    .select('id')
    .single()
  if (batchErr) return { ok: false, error: batchErr.message, sources: ok, failed }
  const batchId = (batch as { id: string }).id

  for (const s of ok) {
    const html = '' // 본문은 이미 스코프를 벗어났다 — 지문은 아래에서 문장으로 다시 뜬다
    void html
    const { error } = await client.from('article_compose_sources').insert({
      batch_id: batchId,
      publisher: s.publisher,
      url: s.url,
      published_at: s.publishedAt,
      fingerprint: buildFingerprint(s.sentences.join(' ')),
      access_basis: 'page-fetch',
      robots_checked_at: new Date().toISOString(),
      wire: s.wire,
    })
    if (error) failed.push({ url: s.url, reason: `저장 실패: ${error.message}` })
  }

  revalidatePath(PATH)
  return { ok: true, sources: ok, failed, independentLines: lines.size, batchId }
}

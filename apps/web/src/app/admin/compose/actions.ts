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
  CrawlGate,
  FACT_SOURCES,
  buildJobSpec,
  collectStories,
  discoverFeeds,
  primeRobots,
  readStoryForFacts,
  type DiscoveredFeed,
  type FetchDeps,
  type LearningTrack,
  type LexicalSkill,
  type Register,
} from '@vocaflow/library-pipeline'

import { createClient } from '@/lib/supabase/server'

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
  skipped?: Array<{ url: string; reason: string }>
  requests?: number
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
  // 발행사와 다른 호스트를 등록하면 그 소스의 접근 정책·계통 표시가 거짓이 된다.
  if (!parsed.host.toLowerCase().endsWith(spec.publisher.toLowerCase())) {
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

  const report = await collectStories(
    feeds.map((f) => ({ sourceKey: f.source_key, url: f.url, label: f.label, enabled: true })),
    nodeFetchDeps(),
  )

  // 피드별 결과를 표에 남긴다 — 조용한 0건과 차단을 구별할 수 있어야 한다.
  const now = new Date().toISOString()
  await Promise.all(
    feeds.map((f) => {
      const host = (() => {
        try {
          return new URL(f.url).host.toLowerCase()
        } catch {
          return ''
        }
      })()
      const note = report.skipped.find((s) => s.url === f.url)?.reason ?? null
      const found = [...report.pursue, ...report.singleLine]
        .flatMap((c) => c.members)
        .filter((m) => m.sourceKey === f.source_key).length
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
    pursue: report.pursue.map(toView),
    singleLine: report.singleLine.map(toView),
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
  const { error } = await (await db())
    .from('library_articles')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', articleId)
    .eq('source', 'original')
  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true }
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

/** 대기 중인 발주만 취소한다 — 진행 중이면 드레인 세션이 이미 비용을 쓰고 있다. */
export async function deleteComposeJob(id: string): Promise<ActionResult> {
  const { error } = await (await db())
    .from('article_compose_jobs')
    .delete()
    .eq('id', id)
    .eq('status', 'pending')
  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}

/**
 * 진행 중 발주를 대기로 되돌린다 — 드레인 세션이 죽어 30분을 기다리기 싫을 때.
 * 살아 있는 세션의 작업을 되돌리면 같은 발주를 둘이 쓰게 되므로 확인하고 쓴다.
 */
export async function releaseComposeJob(id: string): Promise<ActionResult> {
  const { error } = await (await db())
    .from('article_compose_jobs')
    .update({ status: 'pending', claimed_by: null, claimed_at: null })
    .eq('id', id)
    .eq('status', 'claimed')
  if (error) return { ok: false, error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}

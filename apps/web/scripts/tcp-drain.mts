// apps/web/scripts/tcp-drain.mts
//
// TCP 운영 CLI — 주제 적재 → 수확 드레인 → 승격 미리보기.
//
// Admin 화면(`/admin/topic-corpus`)과 **같은 라이브러리**를 쓴다. 다른 것은 HTTP/인증 계층뿐이라,
// 여기서 통과한 것은 화면에서도 통과한다 (반대로 여기서 깨지면 화면도 깨진다).
// 화면은 브라우저를 열어 둬야 하고 한 번에 10편씩이라, 수백 편 규모는 이쪽이 현실적이다.
//
// 원문은 저장하지 않는다 — `harvestTedTalk` 이 카운트로 바꾼 즉시 버린다. 이 스크립트도
// 자막을 파일로 쓰지 않는다.
//
// 사용:
//   pnpm --filter web tcp:enqueue          # 15 주제 큐 적재
//   pnpm --filter web tcp:drain            # 큐가 마를 때까지 수확
//   pnpm --filter web tcp:promote          # 승격 미리보기 (dry-run)
//   pnpm --filter web tcp:promote -- --apply
//
// 환경: apps/web/.env.local 의 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { harvestTedTalk } from '../src/lib/topic-corpus/harvest'
import { harvestLocalArticle, type LocalArticle } from '../src/lib/topic-corpus/local-corpus'
import { discoverTedTopic } from '../src/lib/topic-corpus/ted-discover'

config({ path: resolve(process.cwd(), '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 누락 (.env.local)')
  process.exit(1)
}

const db: SupabaseClient = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** 외부 사이트 예의 — 편당 최소 간격 */
const POLITE_MS = 1200
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface SourceRow {
  id: string
  provider: string
  topic_key: string
  label_ko: string
  category_id: string | null
}

async function sources(provider?: string): Promise<SourceRow[]> {
  let q = db
    .from('topic_corpus_sources')
    .select('id, provider, topic_key, label_ko, category_id')
    .eq('is_active', true)
  if (provider) q = q.eq('provider', provider)
  const { data, error } = await q.order('sort_order')
  if (error) throw new Error(`소스 조회 실패: ${error.message}`)
  return (data ?? []) as SourceRow[]
}

/**
 * 로컬 코퍼스 수확 — `library_articles` 에서 바로 센다.
 *
 * 큐를 쓰지 않는다: 네트워크를 타지 않으므로 claim·재시도·politeness 가 필요 없고,
 * 재실행 안전성은 `ingest_topic_corpus_doc` 이 (source, external_id) 중복을 막는 것으로 이미 확보된다.
 */
async function cmdIngestLocal() {
  const rows = await sources('library_articles')
  if (rows.length === 0) {
    console.log('provider=library_articles 소스가 없습니다 — 시드 마이그레이션을 먼저 적용하세요.')
    return
  }

  let harvested = 0
  let skipped = 0
  let truncatedDocs = 0

  for (const s of rows) {
    // topic_key = library_articles.source
    const { data, error } = await db
      .from('library_articles')
      .select('id, title, source_url, published_at, content')
      .eq('source', s.topic_key)
      .not('content', 'is', null)
    if (error) {
      console.log(`✗ ${s.id} — ${error.message}`)
      continue
    }

    const articles = (data ?? []) as LocalArticle[]
    let ok = 0
    let gaps = 0
    let words = 0

    for (const a of articles) {
      const out = await harvestLocalArticle(db, s.id, a)
      if (out.ok) {
        ok += 1
        gaps += out.gapWords
        words += out.runningWords
        if (out.truncated > 0) {
          truncatedDocs += 1
          // 상한에 걸린 문서는 조용히 넘기지 않는다 — 통계가 그만큼 덜 반영됐다는 뜻이다.
          console.log(`  ⚠ ${a.title ?? a.id} — unique 상한 초과로 ${out.truncated}개 누락`)
        }
      } else {
        skipped += 1
        // 사유를 삼키지 않는다 — 건너뜀이 조용하면 52% 손실도 "성공" 으로 보인다(실측 2026-08-16).
        console.log(`  ✗ ${(a.title ?? a.id).slice(0, 60)} — ${out.reason}`)
      }
    }
    harvested += ok
    console.log(
      `· ${s.id.padEnd(28)} ${String(ok).padStart(3)}/${String(articles.length).padEnd(3)} 편 · ` +
        `${String(words).padStart(6)}어 · 갭 ${gaps}`,
    )
  }
  console.log(`\n수확 ${harvested}편 · 건너뜀 ${skipped} · 상한 초과 문서 ${truncatedDocs}`)
}

async function cmdEnqueue() {
  let totalNew = 0
  let totalGap = 0
  for (const s of await sources()) {
    try {
      const found = await discoverTedTopic(s.topic_key)
      const docs = found.talks.map((t) => ({
        external_id: t.externalId,
        url: t.url,
        title: t.title,
      }))
      const { data, error } = await db.rpc('enqueue_topic_corpus_docs', {
        p_source_id: s.id,
        p_docs: docs,
      })
      if (error) {
        console.log(`✗ ${s.id} — ${error.message}`)
        continue
      }
      totalNew += Number(data ?? 0)
      totalGap += found.coverageGap ?? 0
      console.log(
        `· ${s.id.padEnd(20)} 발견 ${String(found.talks.length).padStart(3)} / TED 총 ${String(
          found.totalCount ?? '?',
        ).padStart(4)}  신규 ${String(data ?? 0).padStart(3)}  미수집 ${found.coverageGap ?? '?'}`,
      )
    } catch (err) {
      console.log(`✗ ${s.id} — ${err instanceof Error ? err.message : String(err)}`)
    }
    await sleep(POLITE_MS)
  }
  // 미수집을 합계로도 남긴다 — "다 모았다" 로 오독되지 않게.
  console.log(`\n신규 적재 ${totalNew}편 · 아직 미수집 합계 ${totalGap}편`)
}

async function cmdDrain() {
  let harvested = 0
  let skipped = 0
  let failed = 0

  for (let round = 1; round <= 500; round += 1) {
    const { data, error } = await db.rpc('claim_topic_corpus_batch', {
      p_source_id: null,
      p_limit: 5,
    })
    if (error) throw new Error(`claim 실패: ${error.message}`)
    const rows = (data ?? []) as Array<{ id: string; source_id: string; url: string }>
    if (rows.length === 0) break

    for (const row of rows) {
      const out = await harvestTedTalk(db, row.source_id, row.url)
      if (out.ok) {
        harvested += 1
        console.log(
          `✓ ${out.sourceId.padEnd(20)} ${String(out.runningWords).padStart(5)}어 · ` +
            `표제어 ${String(out.resolvedWords).padStart(4)} · 갭 ${String(out.gapWords).padStart(3)}` +
            (out.alreadyIngested ? ' (중복)' : '') +
            `  ${out.title ?? out.externalId}`,
        )
      } else {
        if (out.permanent) skipped += 1
        else failed += 1
        await db.rpc('release_topic_corpus_claim', {
          p_id: row.id,
          p_status: out.permanent ? 'skipped' : 'pending',
          p_error: out.reason,
        })
        console.log(`${out.permanent ? '–' : '✗'} ${out.sourceId.padEnd(20)} ${out.reason}`)
      }
      await sleep(POLITE_MS)
    }
  }
  console.log(`\n수확 ${harvested} · 건너뜀 ${skipped} · 실패 ${failed}`)
}

async function cmdPromote(apply: boolean) {
  for (const s of await sources()) {
    const { data, error } = await db.rpc('apply_topic_categories', {
      p_source_id: s.id,
      p_min_doc_freq: 3,
      p_min_salience: 1.0,
      p_max_words: 500,
      p_dry_run: !apply,
    })
    if (error) {
      console.log(`✗ ${s.id} — ${error.message}`)
      continue
    }
    const r = data as Record<string, unknown>
    console.log(
      `· ${s.id.padEnd(20)} → ${String(r.category_id ?? '—').padEnd(34)} ` +
        `대상 ${String(r.eligible).padStart(4)}${apply ? ` · 적용 ${r.applied}` : ' (미적용)'}`,
    )
  }
}

const cmd = process.argv[2]
const apply = process.argv.includes('--apply')

try {
  if (cmd === 'enqueue') await cmdEnqueue()
  else if (cmd === 'drain') await cmdDrain()
  else if (cmd === 'ingest-local') await cmdIngestLocal()
  else if (cmd === 'promote') await cmdPromote(apply)
  else {
    console.error('사용: tcp-drain.mts <enqueue|drain|ingest-local|promote> [--apply]')
    process.exit(1)
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}

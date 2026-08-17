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

import { detectBoilerplateLines } from '../src/lib/topic-corpus/boilerplate'
import { tokenizeText } from '../src/lib/text-extract/tokenize'
import { contentHash } from '../src/lib/topic-corpus/harvest'
import { curlFetcher } from '../src/lib/topic-corpus/http-fetch'
import { fetchAllTedTalkSlugs, fetchTedTalkSlugsByYear } from '../src/lib/topic-corpus/ted-sitemap'
import { harvestTedTalk } from '../src/lib/topic-corpus/harvest'
import { harvestLocalArticle, type LocalArticle } from '../src/lib/topic-corpus/local-corpus'
import { discoverTedTopic, talkUrlFromSlug } from '../src/lib/topic-corpus/ted-discover'
import { fetchTedTranscript, TedTranscriptError } from '../src/lib/topic-corpus/ted-transcript'

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
async function cmdIngestLocal(reset: boolean) {
  const rows = await sources('library_articles')
  if (rows.length === 0) {
    console.log('provider=library_articles 소스가 없습니다 — 시드 마이그레이션을 먼저 적용하세요.')
    return
  }

  if (reset) {
    // 같은 문서는 중복 방지로 건너뛰므로, 재계산하려면 관측치를 비워야 한다.
    // 지우는 것은 **이 파이프라인이 만든 집계**뿐이다 — 원문(library_articles)도,
    // 사전 갭(pending_words)도 건드리지 않는다. 갭은 이미 백로그로서 독립적 가치가 있고,
    // 재수확이 같은 단어를 다시 넣지도 않는다.
    const ids = rows.map((r) => r.id)
    const del1 = await db.from('topic_word_stats').delete().in('source_id', ids)
    const del2 = await db.from('topic_corpus_docs').delete().in('source_id', ids)
    if (del1.error || del2.error) {
      throw new Error(`reset 실패: ${del1.error?.message ?? del2.error?.message}`)
    }
    console.log('· 기존 로컬 관측치 초기화 (원문·사전 갭은 보존)\n')
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

    // 출처별로 상용구를 먼저 검출한다 — 한 문서만 봐서는 "반복" 을 알 수 없다.
    const boilerplate = detectBoilerplateLines(articles.map((a) => a.content ?? ''))
    if (boilerplate.size > 0) {
      console.log(`  · 상용구 ${boilerplate.size}줄 검출 — 토큰화 전 제거`)
    }

    for (const a of articles) {
      const out = await harvestLocalArticle(db, s.id, a, boilerplate)
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

/** TED 주제명("Personal Growth") → 소스 topic_key("personal-growth") */
function normalizeTopic(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_]+/g, '-')
}

/**
 * 사이트맵으로 전체 강연을 큐에 넣는다 (`ted:catalog`).
 *
 * 주제 페이지는 16편만 노출하고 나머지는 `/api/`·`/graphql`·`/_next/data/` 로 불러오는데,
 * robots.txt 가 `Claude-User` 에 대해 그 셋을 금지한다. 사이트맵은 사이트가 크롤러용으로
 * 직접 발행하는 파일이라 전량 열거의 정공법이 이쪽이다.
 */
async function cmdEnqueueCatalog(limit: number | null) {
  console.log('사이트맵 열거 중...')
  const slugs = await fetchAllTedTalkSlugs((d, t, n) =>
    console.log(`  · 사이트맵 ${d}/${t} · 누적 slug ${n.toLocaleString('ko-KR')}`),
  )
  const target = limit ? slugs.slice(0, limit) : slugs
  console.log(`\n고유 강연 ${slugs.length.toLocaleString('ko-KR')}편 · 이번 적재 대상 ${target.length.toLocaleString('ko-KR')}편`)

  // 한 번에 다 넣으면 페이로드가 과대해진다. 1,000편씩 끊어 넣는다(중복은 RPC 가 무시).
  let queued = 0
  for (let i = 0; i < target.length; i += 1000) {
    const chunk = target.slice(i, i + 1000).map((slug) => ({
      external_id: slug,
      url: talkUrlFromSlug(slug),
      title: null,
    }))
    const { data, error } = await db.rpc('enqueue_topic_corpus_docs', {
      p_source_id: 'ted:catalog',
      p_docs: chunk,
    })
    if (error) throw new Error(`적재 실패: ${error.message}`)
    queued += Number(data ?? 0)
    console.log(`  · ${Math.min(i + 1000, target.length).toLocaleString('ko-KR')} / ${target.length.toLocaleString('ko-KR')} — 신규 누적 ${queued.toLocaleString('ko-KR')}`)
  }
  console.log(`\n신규 적재 ${queued.toLocaleString('ko-KR')}편 (이미 있던 것은 세지 않는다)`)
}

/**
 * 카탈로그 드레인 — 강연 1편을 **TED 자신의 주제 태그**가 가리키는 모든 주제에 적재한다.
 *
 * 주제 페이지를 긁어 주제를 정하는 것보다 정확하다: 출처가 TED 의 메타데이터 자신이고,
 * 한 강연이 여러 주제에 속하는 경우도 그대로 반영된다.
 * `ted:catalog` 에도 함께 넣어 **전 카탈로그 배경 분포**를 만든다 — 배경이 클수록
 * salience 대비가 정확해진다(어디서나 흔한 단어가 주제어로 오인되지 않는다).
 */
async function cmdDrainCatalog(limit: number) {
  const topicRows = await sources('ted')
  const byTopic = new Map<string, string>()
  for (const r of topicRows) {
    if (r.category_id && r.topic_key !== '__catalog__') byTopic.set(r.topic_key, r.id)
  }

  let harvested = 0
  let skipped = 0
  let failed = 0
  let attributed = 0

  while (harvested + skipped + failed < limit) {
    const { data, error } = await db.rpc('claim_topic_corpus_batch', {
      p_source_id: 'ted:catalog',
      p_limit: Math.min(5, limit - (harvested + skipped + failed)),
    })
    if (error) throw new Error(`claim 실패: ${error.message}`)
    const rows = (data ?? []) as Array<{ id: string; source_id: string; external_id: string; url: string }>
    if (rows.length === 0) {
      console.log('큐가 비었습니다.')
      break
    }

    for (const row of rows) {
      // 자막은 **한 번만** 받는다. 주제마다 harvestTedTalk 을 다시 부르면 같은 페이지를
      // N 번 재요청하게 된다 — 느린 것보다 남의 서버에 불필요한 부하를 주는 게 문제다.
      let transcript
      try {
        transcript = await fetchTedTranscript(row.url, undefined, curlFetcher)
      } catch (err) {
        const permanent =
          err instanceof TedTranscriptError &&
          (err.reason === 'no-transcript' || err.reason === 'too-short')
        if (permanent) skipped += 1
        else failed += 1
        const reason = err instanceof Error ? err.message : String(err)
        await db.rpc('release_topic_corpus_claim', {
          p_id: row.id,
          p_status: permanent ? 'skipped' : 'pending',
          p_error: reason,
        })
        // 건너뜀을 조용히 넘기지 않는다. 250편 배치에서 218편이 말없이 사라지자
        // 화면상으로는 "성공" 처럼 보였다 — 내가 앞서 지적한 실패 방식을 그대로 반복했다.
        if ((skipped + failed) % 25 === 0 || !permanent) {
          console.log(`– 건너뜀 누적 ${skipped + failed} · 최근: ${reason.slice(0, 70)}`)
        }
        await sleep(POLITE_MS)
        continue
      }

      // 여기서 원문은 카운트로 바뀌고 버려진다 — DB 로 가는 것은 숫자뿐이다.
      const tokens = tokenizeText(transcript.text)
      const hash = contentHash(transcript.text)
      const matched = [
        ...new Set(transcript.tedTopics.map(normalizeTopic).filter((t) => byTopic.has(t))),
      ]

      // 카탈로그(배경) + 매칭된 주제들에 **같은 카운트**를 적재한다. 네트워크 재요청 없음.
      const targets = ['ted:catalog', ...matched.map((t) => byTopic.get(t)!)]
      let first: { resolved_words: number; gap_words: number } | null = null
      for (const sourceId of targets) {
        const { data: res, error: ingErr } = await db.rpc('ingest_topic_corpus_doc', {
          p_source_id: sourceId,
          p_external_id: transcript.externalId,
          p_url: transcript.url,
          p_content_hash: hash,
          p_counts: tokens.counts,
          p_running_words: tokens.totalWords,
          p_truncated: tokens.diagnostics.truncated,
          p_title: transcript.title,
          p_speaker: transcript.speaker,
          p_published_at: transcript.publishedAt,
        })
        if (ingErr) {
          failed += 1
          console.log(`✗ ${sourceId} — ${ingErr.message}`)
          continue
        }
        const payload = res as { resolved_words: number; gap_words: number }
        if (sourceId === 'ted:catalog') first = payload
        else attributed += 1
      }

      harvested += 1
      console.log(
        `✓ ${String(tokens.totalWords).padStart(5)}어 · 표제어 ${String(first?.resolved_words ?? 0).padStart(4)} · ` +
          `갭 ${String(first?.gap_words ?? 0).padStart(3)} · 주제 ${matched.length}  ${transcript.title ?? transcript.externalId}`,
      )
      await sleep(POLITE_MS)
    }
  }
  console.log(`\n수확 ${harvested} · 주제 배정 ${attributed} · 건너뜀 ${skipped} · 실패 ${failed}`)
}

/**
 * 연도별 수율 실측 — 연도마다 N 편씩만 돌려 "자막 보유율이 연도에 따라 다른가" 를 잰다.
 *
 * 전량 실측(4,000편)에서 수율 4.1% · 건너뜀 전부 "영어 자막 없음" 이었다. 96%가 헛도는데,
 * 최근 강연일수록 자막이 많다는 것은 **아직 가정일 뿐**이다. 57시간을 감으로 태우기 전에
 * 연도별로 재서 근거를 만든다. 표본은 각 연도의 앞에서 자르지 않고 **균등 간격**으로 뽑는다
 * (사이트맵 정렬이 알파벳순이라 앞부분만 보면 특정 화자·행사에 쏠린다).
 */
async function cmdProbeYears(sample: number) {
  const topicRows = await sources('ted')
  const byTopic = new Map<string, string>()
  for (const r of topicRows) {
    if (r.category_id && r.topic_key !== '__catalog__') byTopic.set(r.topic_key, r.id)
  }

  console.log('사이트맵 열거 중...')
  const byYear = await fetchTedTalkSlugsByYear()
  const years = [...byYear.keys()].sort((a, b) => b - a)
  console.log(`연도 ${years.length}개 · 표본 연도당 ${sample}편\n`)

  const table: Array<{ year: number; tried: number; got: number; words: number }> = []

  for (const year of years) {
    const slugs = byYear.get(year)!
    // 균등 간격 표본 — 앞에서 자르면 알파벳 앞쪽에 쏠린다.
    const step = Math.max(1, Math.floor(slugs.length / sample))
    const picked = slugs.filter((_, i) => i % step === 0).slice(0, sample)

    let got = 0
    let words = 0
    for (const slug of picked) {
      const url = talkUrlFromSlug(slug)
      let transcript
      try {
        transcript = await fetchTedTranscript(url, undefined, curlFetcher)
      } catch (err) {
        const permanent =
          err instanceof TedTranscriptError &&
          (err.reason === 'no-transcript' || err.reason === 'too-short')
        await db
          .from('topic_corpus_queue')
          .update({
            status: permanent ? 'skipped' : 'pending',
            last_error: err instanceof Error ? err.message : String(err),
            claimed_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('source_id', 'ted:catalog')
          .eq('external_id', slug)
        await sleep(POLITE_MS)
        continue
      }

      const tokens = tokenizeText(transcript.text)
      const hash = contentHash(transcript.text)
      const matched = [
        ...new Set(transcript.tedTopics.map(normalizeTopic).filter((t) => byTopic.has(t))),
      ]
      for (const sourceId of ['ted:catalog', ...matched.map((t) => byTopic.get(t)!)]) {
        await db.rpc('ingest_topic_corpus_doc', {
          p_source_id: sourceId,
          p_external_id: transcript.externalId,
          p_url: transcript.url,
          p_content_hash: hash,
          p_counts: tokens.counts,
          p_running_words: tokens.totalWords,
          p_truncated: tokens.diagnostics.truncated,
          p_title: transcript.title,
          p_speaker: transcript.speaker,
          p_published_at: transcript.publishedAt,
        })
      }
      got += 1
      words += tokens.totalWords
      await sleep(POLITE_MS)
    }

    table.push({ year, tried: picked.length, got, words })
    const pct = picked.length ? ((100 * got) / picked.length).toFixed(1) : '0.0'
    console.log(
      `${year}  전체 ${String(slugs.length).padStart(6)}편 · 표본 ${String(picked.length).padStart(3)} · ` +
        `수확 ${String(got).padStart(3)} · 수율 ${pct.padStart(5)}% · ${words.toLocaleString('ko-KR')}어`,
    )
  }

  console.log('\n── 연도별 수율 (높은 순) ──')
  for (const r of [...table].sort((a, b) => b.got / (b.tried || 1) - a.got / (a.tried || 1))) {
    const pct = r.tried ? ((100 * r.got) / r.tried).toFixed(1) : '0.0'
    console.log(`  ${r.year}  ${pct.padStart(5)}%  (${r.got}/${r.tried})`)
  }
}

async function cmdEnqueue() {
  let totalNew = 0
  let totalGap = 0
  // provider 로 반드시 좁힌다. 좁히지 않았더니 `local:nasa`·`local:wikipedia` 가 TED 의
  // **동명 주제**(/topics/nasa · /topics/wikipedia)에 우연히 매칭돼 TED 강연 15편이
  // 로컬 코퍼스 소스로 적재됐다(실측 2026-08-16). 404 가 난 나머지 로컬 소스 덕분에
  // 눈에 띄었을 뿐, 이름이 겹치는 조합에서는 **조용히 두 코퍼스가 섞인다.**
  for (const s of await sources('ted')) {
    try {
      const found = await discoverTedTopic(s.topic_key, undefined, curlFetcher)
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
      const out = await harvestTedTalk(db, row.source_id, row.url, undefined, curlFetcher)
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
const limitFlag = process.argv.find((a) => a.startsWith('--limit='))
const limitArg = limitFlag ? Number(limitFlag.split('=')[1]) : null

try {
  if (cmd === 'enqueue') await cmdEnqueue()
  else if (cmd === 'drain') await cmdDrain()
  else if (cmd === 'enqueue-catalog') await cmdEnqueueCatalog(limitArg)
  else if (cmd === 'probe-years') await cmdProbeYears(limitArg ?? 200)
  else if (cmd === 'drain-catalog') await cmdDrainCatalog(limitArg ?? 100)
  else if (cmd === 'ingest-local') await cmdIngestLocal(process.argv.includes('--reset'))
  else if (cmd === 'promote') await cmdPromote(apply)
  else {
    console.error('사용: tcp-drain.mts <enqueue|drain|ingest-local|promote> [--apply]')
    process.exit(1)
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}

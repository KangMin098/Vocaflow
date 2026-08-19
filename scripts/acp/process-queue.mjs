// scripts/acp/process-queue.mjs
//
// ACP — **큐에 쌓인 글을 처리해 검수 대기로 올리는 헤드리스 경로.**
//
// ── 왜 필요한가 (실측 2026-08-19) ─────────────────────────────────────
// 수집을 헤드리스로 뚫었더니 32편이 `queued` 로 쌓였는데 **처리 경로가 dev 전용 라우트뿐**
// 이었다(`/api/acp/dev-process` 는 `NODE_ENV='production'` 에서 403). 즉 담아도 사람이
// dev 서버를 띄워야만 앞으로 나갔다.
//
// 이 저장소에서 같은 공백을 네 번째로 만난다 — Compose 드레인 5단계 · ACP 수집 · ACP 처리.
// 규칙으로 적어 둔다: **화면(또는 dev 라우트)에만 있는 단계는 배치가 못 돌리고, 배치가 못
// 돌리는 단계는 결국 아무도 안 돌린다.**
//
// 하는 일은 dev-process 라우트와 **같다**: 정규화 → 분석(어휘 추출·CEFR) → VRL/구문 산출 →
// 메타 갱신 + `status='ready'`. 경로가 갈리면 화면으로 처리한 글과 배치로 처리한 글의
// 메타가 달라지므로, 같은 함수를 같은 순서로 부른다.
//
// ⚠️ 분석은 LLM 비용이 든다. 기본 상한을 두고, 넘기려면 `--limit` 을 명시한다.
// 재실행 안전: `queued` 만 집는다. 실패한 글은 `failed` 로 남아 다시 안 집힌다.
//
// 실행:
//   pnpm dlx tsx scripts/acp/process-queue.mjs            # 큐 상태만 본다
//   pnpm dlx tsx scripts/acp/process-queue.mjs --commit [--limit 10]

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const commit = process.argv.includes('--commit')
const LIMIT = Number(arg('limit') ?? 8)

const { createClient } = await import('@supabase/supabase-js')
const {
  analyzeArticle,
  computeLexicalNoise,
  normalizePunctuation,
  reflowSoftHyphens,
  resolveArticleRegister,
  checkAnalysisReadiness,
  assessReadingLoad,
} = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')

// 조용한 저하를 막는 판단은 **라이브러리 한 곳**에 있다(`checkAnalysisReadiness`).
//   스크립트마다 각자 검사하면 한쪽만 고쳐진다 — 이 저장소는 그 사본 문제를 여러 번 겪었다.
// ⚠️ 2026-08-19 정정 — 여기서 키가 없다고 **막던 것을 걷었다.**
//   막은 근거였던 "사전 적중 95%→72%" 는 정확 일치 값이라 학습자가 겪는 값이 아니었고
//   (해소기 통과 후 95.6%), 애초에 키를 넣어도 사전은 안 채워졌다 —
//   `enrich_shared_dictionary` 가 제약이 금지하는 `source='lcp_llm'` 을 하드코딩해
//   103일 동안 한 행도 못 넣었다. 자세한 경위는 `analyze/readiness.ts` 주석.
//
//   사전은 Claude Code 드레인이 채운다. 이 배치는 그 뒤에 돌리는 것이 맞다 —
//   `base_learning_value` 와 CEFR 은 분석 시점의 사전으로 계산돼 행에 박히기 때문이다.
const readiness = checkAnalysisReadiness()
for (const d of readiness.degraded) console.log(`⚠ ${d}`)
if (commit) {
  console.log('먼저 돌릴 것: pnpm dlx tsx scripts/dict/drain-article-lemmas.mjs --export')
  console.log('             (빠진 낱말이 0 이면 그대로 진행하면 된다)\n')
}

const { data: queued, error } = await db
  .from('library_articles')
  .select('id, source, source_id, source_url, title, author, language, license, content, published_at, feed_id')
  .eq('status', 'queued')
  .is('compose_batch_id', null)
  .order('created_at', { ascending: true })
if (error) throw new Error('큐 조회 실패: ' + error.message)

const list = queued ?? []
console.log(`큐 ${list.length}편 ${commit ? `· 이번에 ${Math.min(LIMIT, list.length)}편 처리` : '(읽기 전용)'}\n`)
if (!list.length) {
  console.log('처리할 것이 없다.')
  process.exit(0)
}
for (const a of list.slice(0, 12)) {
  console.log(`  · ${String(a.source).padEnd(18)} ${String(a.title ?? '').slice(0, 60)}`)
}
if (list.length > 12) console.log(`  … 그리고 ${list.length - 12}편`)

if (!commit) {
  console.log('\n--commit 을 붙이면 처리한다. 분석은 LLM 비용이 든다.')
  process.exit(0)
}

let ok = 0
const failures = []

for (const a of list.slice(0, LIMIT)) {
  const setStatus = (s, msg) =>
    db.from('library_articles').update({ status: s, status_message: msg ?? null }).eq('id', a.id)
  try {
    await setStatus('normalizing')
    // 정규화는 라우트와 같은 두 단계 — 구두점 통일 + 소프트하이픈 되돌리기.
    const bodyText = reflowSoftHyphens(normalizePunctuation(a.content ?? ''))
    const norm = {
      raw: {
        source: a.source,
        source_id: a.source_id,
        source_url: a.source_url ?? '',
        title: a.title,
        author: a.author ?? undefined,
        language: a.language ?? 'en',
        license: a.license,
        published_at: a.published_at ? new Date(a.published_at) : null,
        content: a.content,
        estimated_cefr: null,
        fetched_at: new Date(),
      },
      body: bodyText,
      body_hash: sha256(bodyText),
    }

    await setStatus('analyzing')
    const result = await analyzeArticle(a.id, norm)

    // VRL·구문 산출 실패는 치명적이지 않다 — 라우트와 같은 판단이다.
    //   article_v_level 이 NULL 이면 select_article_vocab 가 V4 로 되돌아간다.
    const { error: vrlErr } = await db.rpc('compute_article_vrl', { p_article_id: a.id })
    if (vrlErr) console.warn(`  ⚠ VRL 경고 (${a.id}): ${vrlErr.message}`)
    const { error: synErr } = await db.rpc('compute_article_syntax', { p_article_id: a.id })
    if (synErr) console.warn(`  ⚠ 구문 경고 (${a.id}): ${synErr.message}`)

    const noise = computeLexicalNoise(bodyText)
    const { error: upErr } = await db
      .from('library_articles')
      .update({
        cefr_level: result.cefr_level,
        cefr_confidence: result.cefr_confidence,
        word_count: result.word_count,
        reading_minutes: result.reading_minutes,
        llm_cost_usd: result.llm_cost_usd,
        register: resolveArticleRegister(a.source, a.feed_id ?? null),
        lexical_noise: noise,
        status: 'ready',
        // 표시할 것이 둘 이상일 수 있다 — 앞의 것만 남기면 뒤의 것이 조용히 사라진다.
        //   ① noise > 0.08 이면 발행 트리거가 단어세트를 건너뛴다(읽기용만).
        //   ② 발행분 p90 을 넘는 길이는 검수자에게 알린다(버리지 않는다 — 판단은 사람 몫).
        //   길이 판단은 `assessReadingLoad` 한 곳에 있다 — dev-process 라우트와 같은 답.
        status_message:
          [
            noise > 0.08 ? `lexical_noise ${noise} > 0.08 — 단어세트 미발행(읽기용)` : null,
            assessReadingLoad(result.word_count).note,
          ]
            .filter(Boolean)
            .join(' · ') || null,
        content_hash: norm.body_hash,
      })
      .eq('id', a.id)
    if (upErr) throw new Error(upErr.message)

    ok++
    console.log(`  ✓ ${String(a.source).padEnd(16)} ${result.cefr_level} · ${result.word_count}어 · 어휘 ${result.words.length}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    failures.push(`${a.source} ${a.id}: ${msg}`)
    await setStatus('failed', msg.slice(0, 500))
    console.log(`  ✗ ${String(a.source).padEnd(16)} ${msg.slice(0, 70)}`)
  }
}

console.log(`\n처리 ${ok} / ${Math.min(LIMIT, list.length)} · 남은 큐 ${list.length - ok}`)
if (failures.length) {
  console.log(`\n실패 ${failures.length} (status='failed' 로 남아 다시 집히지 않는다):`)
  for (const f of failures.slice(0, 8)) console.log(`  · ${f}`)
}
console.log('\n검수·발행은 Admin ⑦ 에서 사람이 한다 — 이 스크립트는 검수 대기까지만 올린다.')

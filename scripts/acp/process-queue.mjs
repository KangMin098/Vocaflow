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
//   pnpm dlx tsx scripts/acp/process-queue.mjs --source gutenberg --narrative --commit --limit 200
//   pnpm dlx tsx scripts/acp/process-queue.mjs --shard 0/4 --commit --limit 200   # 4갈래 중 1갈래

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { fetchAllPaged } from '../textbook/volume-pool.mjs'
import { looksNarrative } from '../csat/lib-narrative.mjs'

/**
 * `--shard i/n` — **큐를 n 조각으로 갈라 i 번째만 맡는다.** (인자가 없으면 전량 — 지금과 동일)
 *
 * ⚠️ 왜 (2026-09-07): 발췌 분석 큐 11,601편을 **한 줄기로** 돌리고 있었다. 여러 개를 띄우면
 *   빨라지는데, 이 스크립트는 `status='queued'` 를 앞에서부터 `--limit` 만큼 집을 뿐
 *   **집었다는 표시를 먼저 하지 않는다** — 두 프로세스가 같은 앞머리를 본다. 예약(claim) 컬럼을
 *   DB 에 넣는 쪽이 정공법이지만 마이그레이션이 필요하고, 그동안 돌고 있는 드레인이 멈춘다.
 *   그래서 **DB 를 건드리지 않고 겹침을 없애는 쪽**을 택했다: 조각을 행 자신의 값으로 정한다.
 *
 * 기준은 **`id`(UUID) 의 마지막 8자리를 16진수로 읽어 `% n`**. 왜 목록에서의 위치(index)가
 * 아닌가 — **큐는 처리될수록 줄어든다.** index 로 나누면 다른 샤드가 앞머리를 `ready` 로
 * 바꾸는 순간 남은 행이 통째로 앞으로 밀려 **소속 조각이 바뀐다**: 같은 글을 둘이 잡거나
 * 아무도 안 잡는다(그리고 둘 다 조용하다 — 중복은 비용으로, 누락은 영영 남는 구멍으로 나타난다).
 * `id` 는 행에 박힌 값이라 큐가 어떻게 줄든, `--source`·`--feed`·`--narrative` 어떤 조합으로
 * 좁히든, 몇 번째로 읽히든 **같은 답**이 나온다. 그래서 조각끼리 겹치지 않고, 합치면 전체가 된다.
 */
export function shardIndexOf(id, count) {
  const s = String(id ?? '')
  // UUID 는 16진수 + 하이픈이다. 하이픈을 걷고 뒤 8자리만 읽는다 (≤ 0xFFFFFFFF — 안전 정수).
  const hex = s.replace(/[^0-9a-fA-F]/g, '').slice(-8)
  // ⚠️ id 가 UUID 가 아닐 수도 있다(정수 키·빈 값). 그때도 **답이 하나로 정해져야** 겹침이
  //   안 생기므로 무작위가 아닌 결정론적 문자열 해시로 되돌린다.
  const n = hex.length
    ? Number.parseInt(hex, 16)
    : [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  return ((n % count) + count) % count
}

/** 조각에 속하는 행만 남긴다. `shard` 가 null 이면 손대지 않는다(하위 호환). */
export function applyShard(rows, shard) {
  if (!shard) return rows
  return rows.filter((r) => shardIndexOf(r.id, shard.count) === shard.index)
}

/** `--shard 0/4` → `{ index: 0, count: 4 }`. 인자가 없으면 null. */
export function parseShardArg(argv) {
  const i = argv.indexOf('--shard')
  if (i < 0) return null
  const raw = String(argv[i + 1] ?? '').trim()
  const m = raw.match(/^(\d+)\s*\/\s*(\d+)$/)
  // ⚠️ 잘못 적었을 때 **조용히 전량으로 되돌리지 않는다.** 그러면 네 갈래를 띄운 사람이
  //   전량 처리 네 개를 띄운 것이 되어, 겹침을 막으려던 것이 정반대로 동작한다.
  if (!m) throw new Error(`--shard 는 i/n 꼴이다 (예: --shard 0/4). 받은 값: ${raw || '(없음)'}`)
  const index = Number(m[1])
  const count = Number(m[2])
  if (count < 1) throw new Error(`--shard 의 n 은 1 이상이어야 한다: ${raw}`)
  if (index >= count) throw new Error(`--shard 의 i 는 0 부터 n-1 까지다: ${raw}`)
  return { index, count }
}

async function main() {
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
  const shard = parseShardArg(process.argv)

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

  // ⚠️ 큐는 담은 순서(created_at)로 나온다. 그래서 **적합도가 낮은 소스가 앞을 막는다** —
  //   2026-08-30 실측에서 큐 892편 중 앞머리가 전부 wikipedia(주제 적합률 5~11%)였고,
  //   정작 적합률 52~64% 인 usgs·noaa 812편이 뒤에 있었다. 분석은 어휘 행을 편당 수백 개
  //   만들어 디스크를 쓰므로, **무엇을 먼저 처리할지가 곧 무엇에 돈을 쓸지**다.
  //   `collect-daily` 와 같은 이름의 필터를 둔다(쉼표로 여러 개).
  const onlySources = (arg('source') ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  /**
   * `--fit-only` — **수능 적합 원문만 분석한다.**
   *
   * ⚠️ 왜 (실측 2026-08-30): DB 4.2GB 의 내역을 처음 재 봤더니
   *   library_article_vocabularies 1,565MB(36.6%) 대 library_articles 103MB(2.4%) 였다.
   *   **원문 본문은 거의 공짜고, 비용은 이 단계가 만드는 어휘 연결 행**이다(편당 ~174KB).
   *   그런데 지금은 부적합 원문에도 어휘를 뽑는다 — 적합률이 약 55% 이므로 45% 가 낭비다.
   *
   *   채점(`scripts/csat/score-articles.mjs`)은 `content` 만 있으면 되고 분석 결과가 필요 없다.
   *   그래서 **수집 → 채점 → (적합만) 분석** 순서가 성립한다. 이 플래그가 그 순서를 만든다.
   *
   *   ⚠️ 채점 전 원문은 `csat_fit` 이 null 이라 여기서 빠진다. 먼저 채점을 돌릴 것.
   */
  const fitOnly = process.argv.includes('--fit-only')

  /**
   * `--feed` — **피드까지 좁힌다.** `--source` 만으로는 못 가르는 경우가 생겼다.
   *
   * 실측 2026-09-04: `source='gutenberg'` 큐에 두 갈래가 섞여 있다 —
   * 수능 수확분 8,141편(`feed_id='harvest'`)과 초·중 교재 발췌분(`feed_id='kid-excerpt'`).
   * 둘은 쓰임도 다음 단계도 다른데 `--source gutenberg` 로는 함께 집힌다.
   * **무엇을 먼저 처리할지가 곧 무엇에 돈을 쓸지**라는 `--source` 의 이유가 여기에도 그대로 든다.
   */
  const onlyFeeds = (arg('feed') ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  /**
   * `--narrative` — **사람이 나오고 말을 하는 글만 처리한다.**
   *
   * 실측 2026-09-06: Gutenberg 수확 36,635편 중 **33,052편이 `article_v_level` 없이**
   * 큐에 남아 있었다. V7 심경(mood) 재고가 1편인 이유가 "이야기는 어휘가 평이해 낮은
   * 밴드로 간다" 가 아니라 **아직 처리되지 않았다** 였다 — 짐작으로 수확 질의를 고쳤다면
   * 엉뚱한 곳을 팠다.
   *
   * 큐가 1만 편이 넘으므로 무엇을 **먼저** 처리하느냐가 곧 어느 유형의 재고가 서느냐다.
   * 판정 잣대는 `scripts/csat/lib-narrative.mjs` 정본을 그대로 쓴다.
   */
  const narrativeOnly = process.argv.includes('--narrative')

  // ⚠️ 페이징 없이 읽으면 **1,000행에서 잘린다.** 그대로 "큐 N편" 으로 찍혀 근거로 쓰이고,
  //   `--narrative` 처럼 뒤에서 거르는 옵션은 나머지 큐를 아예 못 본다(실측: gutenberg
  //   queued 13,604편 중 1,000편만 보였다).
  const queued = await fetchAllPaged(db, (q0) => {
    let q = q0
      .from('library_articles')
      .select('id, source, source_id, source_url, title, author, language, license, content, published_at, feed_id, created_at')
      .eq('status', 'queued')
      .is('compose_batch_id', null)
    if (onlySources.length) q = q.in('source', onlySources)
    if (onlyFeeds.length) q = q.in('feed_id', onlyFeeds)
    if (fitOnly) q = q.gt('csat_fit->>pass', '0')
    return q.order('created_at', { ascending: true }).order('id', { ascending: true })
  })

  /**
   * 즉시 process.exit() 하지 않는다.
   *
   * ⚠️ 실측 2026-08-30 (Windows) — 큐가 비었을 때 곧바로 exit 하면 supabase-js 의 열린
   *   커넥션 핸들이 닫히는 중이라 libuv 가 터진다:
   *     Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src/win/async.c, line 76
   *   작업은 정상 완료됐는데 **종료 코드만 1** 이 되어 배치 실패로 오인된다.
   *   실제로 이 크래시 때문에 성공한 배치가 두 번 "실패" 로 보고됐다.
   */
  async function finish(code = 0) {
    await new Promise((r) => setTimeout(r, 100))
    process.exit(code)
  }
  let list = queued ?? []
  if (narrativeOnly) {
    const before = list.length
    list = list.filter((a) => looksNarrative(String(a.content ?? '')))
    console.log(`--narrative — 서사만 남긴다: ${before.toLocaleString()} → ${list.length.toLocaleString()}편`)
  }
  // ⚠️ 자르는 자리는 `--limit` 슬라이스보다 **앞**이어야 한다. 뒤에 두면 네 프로세스가
  //   모두 같은 앞머리 LIMIT 편을 본 다음 각자 걸러내므로, 대부분이 0편을 처리하고
  //   나머지 한 갈래만 일한다 — 빨라지라고 넣은 것이 오히려 느려진다.
  if (shard) {
    const before = list.length
    list = applyShard(list, shard)
    console.log(
      `--shard ${shard.index}/${shard.count} — ${before.toLocaleString()}편 중 ` +
        `${list.length.toLocaleString()}편을 맡는다 (id 끝 8자리 16진수 % ${shard.count} == ${shard.index})`,
    )
  }

  console.log(`큐 ${list.length}편 ${commit ? `· 이번에 ${Math.min(LIMIT, list.length)}편 처리` : '(읽기 전용)'}\n`)
  if (!list.length) {
    console.log('처리할 것이 없다.')
    await finish(0)
  }
  for (const a of list.slice(0, 12)) {
    console.log(`  · ${String(a.source).padEnd(18)} ${String(a.title ?? '').slice(0, 60)}`)
  }
  if (list.length > 12) console.log(`  … 그리고 ${list.length - 12}편`)

  if (!commit) {
    console.log('\n--commit 을 붙이면 처리한다. 분석은 LLM 비용이 든다.')
    await finish(0)
  }

  let ok = 0
  const failures = []

  for (const a of list.slice(0, LIMIT)) {
    const setStatus = (s, msg) =>
      db.from('library_articles').update({ status: s, status_message: msg ?? null }).eq('id', a.id)
    try {
      await setStatus('normalizing')
      // 정규화는 라우트와 같은 두 단계 — 구두점 통일 + 소프트하이픈 되돌리기.
      // ⚠️ 기사는 HTML 이라 줄바꿈 하이픈이 없다(322편 전수 실측 0건). 켜 두면 표가 납작해진
      //   자리에서 bio-+life = biolife 같은 없는 낱말이 생긴다 — reflow.ts 주석 참조.
      const bodyText = reflowSoftHyphens(normalizePunctuation(a.content ?? ''), {
        joinHyphenLineBreaks: false,
      })
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
}

// 위 세 함수는 순수하므로 회귀가 잡을 수 있다 (`scripts/textbook/__tests__/acp-shard.test.mjs`).
// 그러려면 **import 만으로 배치가 돌면 안 된다** — 아래 가드가 그 경계다.
//   판정은 경로 비교로 한다: Windows 에서 드라이브 문자 대소문자가 갈릴 수 있어
//   `import.meta.url` 문자열을 그대로 비교하면 조용히 false 가 되어 **아무 일도 안 하고 종료**한다.
//   argv[1] 이 아예 없으면(비정상 기동) 돌리는 쪽으로 둔다 — 안 도는 실패가 더 나쁘다.
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
const selfPath = fileURLToPath(import.meta.url)
const RUN_AS_SCRIPT =
  !invokedPath || path.normalize(invokedPath).toLowerCase() === path.normalize(selfPath).toLowerCase()

if (RUN_AS_SCRIPT) await main()

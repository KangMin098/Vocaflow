// scripts/compose/drain-adapt.mjs
//
// ACP §20 — 레벨 적응 드레인. 라이선스 보유 글에서 **쉬운 판**을 만든다.
//
// 재저작(drain-process/gates)과 다른 경로다:
//   재저작 — 상업뉴스 사실 → 우리 글. 게이트 I12~I17.
//   적응   — 우리가 이미 쓸 권리가 있는 글 → 같은 내용의 쉬운 판. critical 은 I17 하나.
//
// 세 단계:
//   --plan     원본 글 + 목표 레벨 → 발주(article_compose_jobs.source_article_id)
//   --process  쉬운 판 본문(파일) → 등록 · 출처 표기 · 어휘 · 난이도
//   --gates    I17 + A1 + A2 판정 기록
//
// 실행:
//   pnpm dlx tsx scripts/compose/drain-adapt.mjs --plan --article <uuid> --level 2 [--commit]
//   pnpm dlx tsx scripts/compose/drain-adapt.mjs --process --job <uuid> --body <파일> [--commit]
//   pnpm dlx tsx scripts/compose/drain-adapt.mjs --gates --job <uuid> [--commit]

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (k) => {
  const i = process.argv.indexOf('--' + k)
  return i >= 0 ? process.argv[i + 1] : null
}
const has = (k) => process.argv.includes('--' + k)
const commit = has('commit')

const { createClient } = await import('@supabase/supabase-js')
const lib = await import('@vocaflow/library-pipeline')
const {
  GRADE_BANDS,
  bandForVLevel,
  profileBand,
  tokenizeForBand,
  shelfRecordFrom,
  buildAdaptationAttribution,
  stripAttribution,
  runAdaptationGates,
  isAdaptationPublishable,
  analyzeArticle,
  computeLexicalNoise,
  normalizePunctuation,
  reflowSoftHyphens,
} = lib

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')

const DERIVABLE = ['public_domain', 'cc0', 'cc_by', 'cc_by_sa']

/**
 * 표기에 쓸 발행사 이름 — **원문 주소의 호스트**를 쓴다.
 *
 * 내부 소스 키(nasa·simple_wikipedia)를 그대로 쓰면 학습자에게 내부 어휘가 노출되고
 * ("an article by simple_wikipedia"), 재저작 표기가 호스트를 쓰는 것과도 어긋난다.
 * 호스트면 두 표기가 같은 기준이 되고, 학습자가 실제로 찾아갈 수 있는 이름이기도 하다.
 */
function publisherName(source, url) {
  try {
    return new URL(url).host.replace(/^www./, '')
  } catch {
    return source
  }
}

/** 원본 발행사 표기. 재저작 표기와 문구가 달라야 한다 — 다른 종류의 글이다. */
function withAdaptationNote(body, publisher, url) {
  const line = buildAdaptationAttribution(publisher, url)
  const stripped = stripAttribution(body)
  return line ? stripped + '\n\n' + line : stripped
}

// ── 발주 ───────────────────────────────────────────────────────────
if (has('plan')) {
  const articleId = arg('article')
  const level = Number(arg('level') ?? 'NaN')
  if (!articleId || !Number.isFinite(level)) throw new Error('--article <uuid> --level <n> 필요')

  const { data: src } = await db
    .from('library_articles')
    .select(
      'id,title,source,source_url,register,article_v_level,word_count,license_class,display_only,status',
    )
    .eq('id', articleId)
    .single()
  if (!src) throw new Error('원본 글을 찾을 수 없습니다')

  // 라이선스가 허락하지 않으면 여기서 멈춘다 — 적응의 전제 자체가 무너진다.
  if (src.display_only) throw new Error(src.source + ': 파생 금지(display_only) 글이다')
  if (!DERIVABLE.includes(src.license_class ?? '')) {
    throw new Error(src.source + ': license_class=' + src.license_class + ' — 파생 허용 라이선스가 아니다')
  }
  if (src.status !== 'published') throw new Error('발행된 글에서만 파생한다')
  if (src.article_v_level !== null && level >= src.article_v_level) {
    throw new Error('목표 V' + level + ' 가 원본 V' + src.article_v_level + ' 보다 쉽지 않다 — 적응이 아니다')
  }

  const band = bandForVLevel(level)
  const g = GRADE_BANDS[band]
  console.log('원본: ' + src.title)
  console.log('  ' + src.source + ' · V' + src.article_v_level + ' · ' + src.word_count + '어 · ' + src.license_class)
  console.log('\n쉬운 판 발주: ' + g.label + ' (V' + level + ')')
  console.log('  어수 ' + g.words.min + '~' + g.words.max + ' · 평균 문장 ' + g.avgSentenceWords + '어절')
  console.log('  작성 지시:')
  for (const d of g.directives) console.log('    · ' + d)

  if (!commit) {
    console.log('\n--commit 을 붙이면 발주가 생깁니다.')
    process.exit(0)
  }
  const { data: job, error } = await db
    .from('article_compose_jobs')
    .insert({
      source_article_id: src.id,
      track: 'general_proficiency',
      register: src.register ?? 'expository',
      target_v_level: level,
      skill_focus: 'single_word',
      words_min: g.words.min,
      words_max: g.words.max,
      avg_sentence_words: g.avgSentenceWords,
      directives: [...g.directives],
      activities: ['read', 'word_set'],
      status: 'pending',
    })
    .select('id')
    .single()
  if (error) throw new Error('발주 실패: ' + error.message)
  console.log('\n발주 생성: ' + job.id)
}

// ── 처리 ───────────────────────────────────────────────────────────
if (has('process')) {
  const jobId = arg('job')
  const bodyPath = arg('body')
  if (!jobId || !bodyPath) throw new Error('--job <uuid> --body <파일> 필요')

  const { data: job } = await db
    .from('article_compose_jobs')
    .select('id,source_article_id,target_v_level,register,words_min,words_max,article_id')
    .eq('id', jobId)
    .single()
  if (!job?.source_article_id) throw new Error('적응 발주가 아닙니다')

  const { data: src } = await db
    .from('library_articles')
    .select('id,title,source,source_url,license,license_class,copyright_safe_in_kr')
    .eq('id', job.source_article_id)
    .single()

  const raw = fs.readFileSync(path.resolve(bodyPath), 'utf8').trim()
  const n = raw.split(/\s+/).filter(Boolean).length
  console.log('쉬운 판 ' + n + '어 (발주 ' + job.words_min + '~' + job.words_max + ')')
  if (n < job.words_min || n > job.words_max) console.log('  ⚠ 발주 어수 범위를 벗어났습니다.')

  const body = withAdaptationNote(raw, publisherName(src.source, src.source_url), src.source_url)
  if (!commit) {
    console.log('\n--commit 을 붙이면 등록·처리합니다.')
    process.exit(0)
  }

  const band = bandForVLevel(job.target_v_level)
  let articleId = job.article_id
  if (!articleId) {
    const { data: ins, error } = await db
      .from('library_articles')
      .insert({
        // 출처는 **원본 그대로** — 학습자는 그 발행사 글의 쉬운 판을 읽는 것이지 우리 창작이 아니다.
        source: src.source,
        source_id: 'adapt:' + src.id + ':v' + job.target_v_level,
        source_url: src.source_url,
        // 제목에 학령을 넣는다 — 같은 원본에서 여러 레벨을 파생하면 '(easier)' 만으로는
        //   학습자에게 같은 글 두 개로 보인다(실측으로 확인).
        title: src.title + ' (' + GRADE_BANDS[band].label + ' 쉬운 판)',
        content: body,
        status: 'queued',
        register: job.register,
        // 라이선스 문자열은 원본 것을 그대로 승계한다 — 파생물의 권리는 원본에서 온다.
        license: src.license,
        license_class: src.license_class,
        copyright_safe_in_kr: src.copyright_safe_in_kr,
        display_only: false,
        adapted_from_id: src.id,
        composed_spec: {
          kind: 'adaptation',
          track: 'general_proficiency',
          target_v_level: job.target_v_level,
          grade_band: band,
          // 원본이 지워져도 출처 주장이 거짓이 되지 않도록 여기 박아 둔다.
          adapted_from: { id: src.id, source: src.source, title: src.title, url: src.source_url },
        },
      })
      .select('id')
      .single()
    if (error) throw new Error('등록 실패: ' + error.message)
    articleId = ins.id
    await db.from('article_compose_jobs').update({ article_id: articleId }).eq('id', jobId)
  } else {
    await db.from('library_articles').update({ content: body }).eq('id', articleId)
  }

  // 해시는 발행되는 본문 전체, 분석은 표기를 뺀 본문 — 표기가 단어장에 실리면 안 된다.
  const fullText = reflowSoftHyphens(normalizePunctuation(body))
  const bodyText = stripAttribution(fullText)
  const result = await analyzeArticle(
    articleId,
    {
      raw: {
        source: src.source,
        source_id: 'adapt:' + src.id,
        source_url: src.source_url,
        title: src.title,
        language: 'en',
        license: src.license_class,
        published_at: null,
        content: body,
        estimated_cefr: null,
        fetched_at: new Date(),
      },
      body: bodyText,
      body_hash: sha256(fullText),
    },
    { skipLlm: true },
  )
  await db.rpc('compute_article_vrl', { p_article_id: articleId })
  await db
    .from('library_articles')
    .update({
      cefr_level: result.cefr_level,
      cefr_confidence: result.cefr_confidence,
      word_count: result.word_count,
      reading_minutes: result.reading_minutes,
      llm_cost_usd: result.llm_cost_usd,
      lexical_noise: computeLexicalNoise(bodyText),
      status: 'ready',
      content_hash: sha256(fullText),
    })
    .eq('id', articleId)

  const { data: after } = await db
    .from('library_articles')
    .select('article_v_level')
    .eq('id', articleId)
    .single()
  console.log('\n→ ready · ' + result.word_count + '어 · ' + result.cefr_level + ' · 어휘 ' + result.words.length)
  console.log('→ V ' + after?.article_v_level + ' (얼마나 쉬워졌는지는 게이트 A2 가 잰다)')
  console.log('→ 아티클 ' + articleId)
}

// ── 게이트 ─────────────────────────────────────────────────────────
if (has('gates')) {
  const jobId = arg('job')
  if (!jobId) throw new Error('--job <uuid> 필요')
  const { data: job } = await db
    .from('article_compose_jobs')
    .select('id,source_article_id,article_id,target_v_level')
    .eq('id', jobId)
    .single()
  if (!job?.article_id) throw new Error('아직 아티클이 없습니다 — --process 를 먼저')

  const [{ data: art }, { data: src }] = await Promise.all([
    db.from('library_articles').select('id,title,content,content_hash').eq('id', job.article_id).single(),
    db.from('library_articles').select('id,content').eq('id', job.source_article_id).single(),
  ])

  // 서가 대조군 — 같은 원본에서 이미 낸 다른 레벨 판.
  const { data: siblings } = await db
    .from('library_articles')
    .select('id,title,source,content')
    .eq('adapted_from_id', job.source_article_id)
    .neq('id', art.id)
  const shelf = (siblings ?? []).map((o) => shelfRecordFrom(o))

  // 밴드는 읽는 사람이 만나는 단어로 잰다 — 추출 어휘로 재면 분모가 작아져 부풀고,
  //   외부 플랫폼(News in Levels)과 같은 기준으로 비교할 수 없다.
  const keys = tokenizeForBand(stripAttribution(art.content ?? ''))
  const { data: dict } = keys.length
    ? await db.from('shared_dictionary').select('word,v_level').in('word', keys)
    : { data: [] }
  const vmap = new Map((dict ?? []).map((d) => [d.word, d.v_level]))
  const words = keys.map((w) => ({ word: w, v: vmap.get(w) ?? null }))
  const band = bandForVLevel(job.target_v_level)

  const results = runAdaptationGates({
    text: art.content,
    sourceText: src?.content ?? '',
    shelf,
    band,
    words,
  })

  console.log('▸ ' + art.title + '  (형제 판 ' + shelf.length + ')')
  for (const g of results) {
    const mark = g.verdict === 'PASS' ? ' ' : g.verdict === 'WARN' ? '!' : '✗'
    console.log('  ' + mark + ' ' + g.verdict.padEnd(4) + ' ' + g.invariant + ' — ' + g.detail)
  }
  const p = profileBand(words, band)
  console.log('  밴드 초과 ' + (p.aboveShare * 100).toFixed(1) + '% · 사전에 없음 ' + p.unknown)

  if (!commit) {
    console.log('\n--commit 을 붙이면 판정을 저장합니다.')
    process.exit(0)
  }
  const rows = results.map((g) => ({
    article_id: art.id,
    invariant: g.invariant,
    severity: g.severity,
    verdict: g.verdict,
    detail: g.detail,
    content_hash: art.content_hash,
  }))
  const { error } = await db
    .from('article_compose_gates')
    .upsert(rows, { onConflict: 'article_id,invariant' })
  if (error) throw new Error('게이트 저장 실패: ' + error.message)
  await db.from('article_compose_jobs').update({ status: 'done' }).eq('id', jobId)
  console.log('  → 판정 ' + rows.length + '행 저장 · 발행 가능 ' + isAdaptationPublishable(results))
}

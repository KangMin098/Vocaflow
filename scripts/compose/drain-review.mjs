// scripts/compose/drain-review.mjs
//
// ACP §20 드레인 — 검수 단계. **게이트가 보지 않는 것을 본다.**
//
// 게이트는 법적·구조적 위험만 본다(I12~I17 · A1~A2). 전부 통과해도 학습 자료로 나쁠 수 있다.
// 실제로 첫 산출물 세 편이 게이트를 모두 통과한 채 이런 것을 남겼다:
//   · 수능형 첫 문장 34어절(목표 평균 22) — 가장 무거운 문장으로 글을 연다
//   · 일반형이 같은 사실을 두 번 말한다("about twenty percent" / "One fifth of the country's power")
//   · 적응판이 원문의 의의를 통째로 잃었다
//
// 이 스크립트는 **잴 수 있는 것만 재고**, 나머지는 판단 목록으로 넘긴다. 기계가 못 보는 것을
// 본 척하는 게 가장 나쁘다 — 위 세 가지 중 첫 번째만 기계가 잡는다.
//
// 재실행 안전: 읽기만 한다. 아무것도 쓰지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/compose/drain-review.mjs [--batch <uuid>] [--article <uuid>]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (k) => {
  const i = process.argv.indexOf('--' + k)
  return i >= 0 ? process.argv[i + 1] : null
}

const { createClient } = await import('@supabase/supabase-js')
const { reviewDraft, bandForVLevel, GRADE_BANDS, tokenizeForBand, stripAttribution } =
  await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const batchId = arg('batch')
const articleId = arg('article')

let q = db
  .from('library_articles')
  .select('id,title,content,composed_spec,compose_batch_id,adapted_from_id,word_count')
  .in('status', ['queued', 'ready'])
if (batchId) q = q.eq('compose_batch_id', batchId)
if (articleId) q = q.eq('id', articleId)
if (!batchId && !articleId) q = q.or('compose_batch_id.not.is.null,adapted_from_id.not.is.null')

const { data: arts, error } = await q
if (error) throw new Error('조회 실패: ' + error.message)
if (!arts?.length) {
  console.log('검수할 초안이 없습니다.')
  process.exit(0)
}

let flagged = 0

for (const a of arts) {
  const spec = a.composed_spec ?? {}
  const level = spec.target_v_level ?? null
  if (level === null) {
    console.log('▸ ' + a.title + '\n  목표 레벨을 알 수 없어 검수할 수 없습니다.\n')
    continue
  }
  const band = spec.grade_band ?? bandForVLevel(level)
  const g = GRADE_BANDS[band]

  // 발주 어수 — 적응 발주는 밴드에서, 재저작 발주는 사양에서 온다.
  const { data: job } = await db
    .from('article_compose_jobs')
    .select('words_min,words_max,avg_sentence_words')
    .eq('article_id', a.id)
    .maybeSingle()

  // 밴드는 **읽는 사람이 만나는 단어**로 잰다 — 추출 어휘로 재면 기능어가 빠져 분모가
  //   작아지고 초과 비율이 부풀며(같은 글 26.8% vs 14.8%), 외부 플랫폼과 비교가 안 된다.
  const keys = tokenizeForBand(stripAttribution(a.content ?? ''))
  const { data: dict } = keys.length
    ? await db.from('shared_dictionary').select('word,v_level').in('word', keys)
    : { data: [] }
  const vmap = new Map((dict ?? []).map((d) => [d.word, d.v_level]))

  // 사실 커버리지 — 재저작일 때만 의미가 있다.
  let ledgerIds
  if (a.compose_batch_id) {
    const { data: facts } = await db
      .from('article_fact_ledger')
      .select('id')
      .eq('batch_id', a.compose_batch_id)
    ledgerIds = (facts ?? []).map((f) => f.id)
  }

  const report = reviewDraft({
    text: a.content ?? '',
    spec: {
      words: { min: job?.words_min ?? g.words.min, max: job?.words_max ?? g.words.max },
      avgSentenceWords: job?.avg_sentence_words ?? g.avgSentenceWords,
      band,
    },
    ledgerFactIds: ledgerIds,
    factOrder: Array.isArray(spec.fact_order) ? spec.fact_order : [],
    words: keys.map((w) => ({ word: w, v: vmap.get(w) ?? null })),
  })

  const m = report.metrics
  console.log('▸ ' + a.title)
  console.log(
    '  ' + g.label + ' V' + level + ' · ' + m.words + '어 · ' + m.sentences + '문장 · ' +
      m.paragraphs + '문단 · 평균 ' + m.avgSentenceWords + '어절(목표 ' +
      (job?.avg_sentence_words ?? g.avgSentenceWords) + ')',
  )
  console.log(
    '  첫 문장 ' + m.firstSentenceWords + '어절 · 최장 ' + m.longestSentenceWords +
      ' · 문단별 ' + m.paragraphSentences.join('·') +
      ' · 밴드 초과 ' + (m.band.aboveShare * 100).toFixed(1) + '%',
  )

  if (report.findings.length === 0) {
    console.log('  잰 항목에는 지적 없음.')
  } else {
    flagged++
    for (const f of report.findings) {
      console.log('  ▪ [' + f.code + '] ' + f.label + ' — ' + f.detail)
    }
  }
  console.log()
}

console.log('■ 판단이 필요한 것 — 기계가 못 본다. 초안을 다시 읽고 답한다.')
for (const q2 of (await import('@vocaflow/library-pipeline')).REVIEW_JUDGE_CHECKLIST) {
  console.log('  □ ' + q2)
}
console.log('\n지적이 0건이어도 좋은 글이라는 뜻이 아니다 — 잰 항목에 걸리지 않았다는 뜻뿐이다.')
console.log('수치 지적 ' + flagged + '/' + arts.length + '편.')

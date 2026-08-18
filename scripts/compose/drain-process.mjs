// scripts/compose/drain-process.mjs
//
// ACP §20 재저작 드레인 — ⑦ 처리 단계.
//   재저작으로 쓴 아티클(queued)을 정규화 → 어휘 추출 → VRL 산출 → 검수 대기(ready) 로 올린다.
//
// 왜 스크립트인가: 처리 경로가 `/api/acp/dev-process` 에만 있었는데 그 라우트는
//   `NODE_ENV==='production'` 에서 403 이고 admin 세션(쿠키)을 요구한다. 드레인은
//   Claude Code(헤드리스 CLI)에서 도는데 둘 다 없다 — 즉 **드레인의 처리 단계에 실행 경로가
//   없었다**. 이 스크립트가 그 경로다. ACP seed 발행 스크립트와 같은 파이프라인을 쓴다.
//
// 재실행 안전: 같은 아티클을 다시 돌려도 어휘는 재추출되어 덮어써지고 상태는 ready 로 수렴한다.
//   이미 published 인 글은 건드리지 않는다(검수자가 낸 결정을 되돌리지 않는다).
//
// 실행: pnpm dlx tsx scripts/compose/drain-process.mjs --batch <uuid> [--commit]
//   --batch 생략 시 재저작(source='original') 중 queued 전체. --commit 없으면 dry-run.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const commit = process.argv.includes('--commit')
const bi = process.argv.indexOf('--batch')
const batchId = bi >= 0 ? process.argv[bi + 1] : null

const { createClient } = await import('@supabase/supabase-js')
const { analyzeArticle, computeLexicalNoise, normalizePunctuation, reflowSoftHyphens, LEARNING_TYPES, withAttribution, stripAttribution, bandForVLevel } =
  await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')

let q = db
  .from('library_articles')
  .select('id,title,content,register,article_v_level,compose_batch_id,composed_spec,status,published_at')
  .eq('source', 'original')
  .eq('status', 'queued')
if (batchId) q = q.eq('compose_batch_id', batchId)

const { data: rows, error } = await q
if (error) throw new Error('조회 실패: ' + error.message)
if (!rows?.length) {
  console.log('처리할 재저작 아티클이 없습니다 (queued 0건).')
  process.exit(0)
}

console.log(`재저작 아티클 ${rows.length}건 ${commit ? '처리' : 'dry-run'}\n`)

for (const a of rows) {
  const spec = a.composed_spec ?? {}
  console.log(`▸ ${a.title}`)
  console.log(`  발주: ${spec.track ?? '?'} · V${spec.target_v_level ?? '?'} · ${spec.register ?? '?'}`)

  if (!a.content?.trim()) {
    console.log('  ⚠ 본문이 비어 있습니다 — 건너뜁니다.\n')
    continue
  }
  if (!commit) {
    console.log(`  (dry-run) 본문 ${a.content.trim().split(/\s+/).length}어절\n`)
    continue
  }

  // 사실 출처를 본문에 박아 넣는다 — 없이 발행되면 재저작 글이 출처 없는 글이 된다.
  const { data: srcRows } = await db
    .from('article_compose_sources')
    .select('publisher')
    .eq('batch_id', a.compose_batch_id)
  const publishers = [...new Set((srcRows ?? []).map((r) => r.publisher))].sort()
  if (publishers.length === 0) {
    console.log(`  ⚠ 취재 소스가 없어 출처를 표기할 수 없습니다 — 건너뜁니다.
`)
    continue
  }
  const withAttr = withAttribution(a.content, publishers)
  if (withAttr !== a.content) {
    const { error: aErr } = await db.from('library_articles').update({ content: withAttr }).eq('id', a.id)
    if (aErr) throw new Error('출처 표기 실패: ' + aErr.message)
    console.log(`  출처 표기: ${publishers.join(", ")}`)
  }
  // 해시는 **발행되는 본문 전체**다 — 출처 표기가 바뀌면 게이트 판정도 낡아야 한다.
  const fullText = reflowSoftHyphens(normalizePunctuation(withAttr))
  // 분석은 표기를 뺀 본문으로 — 표기가 어휘 추출에 들어가면 학습자 단어장에
  //   bbc·com·dw 같은 것이 실린다(실측으로 확인).
  const bodyText = stripAttribution(fullText)
  const norm = {
    raw: {
      source: 'original',
      source_id: a.id,
      // 재저작 글의 출처는 우리 자신이다 — 외부 URL 을 적으면 그 발행사 글로 오인된다.
      source_url: `internal://compose/${a.id}`,
      title: a.title,
      language: 'en',
      license: 'original',
      published_at: null,
      content: withAttr,
      estimated_cefr: null,
      fetched_at: new Date(),
    },
    body: bodyText,
    body_hash: sha256(fullText),
  }

  const result = await analyzeArticle(a.id, norm, { skipLlm: true })
  const { error: vrlErr } = await db.rpc('compute_article_vrl', { p_article_id: a.id })
  if (vrlErr) console.warn(`  vrl warn: ${vrlErr.message}`)

  const noise = computeLexicalNoise(bodyText)
  const { error: upErr } = await db
    .from('library_articles')
    .update({
      cefr_level: result.cefr_level,
      cefr_confidence: result.cefr_confidence,
      word_count: result.word_count,
      reading_minutes: result.reading_minutes,
      llm_cost_usd: result.llm_cost_usd,
      // register 는 발주가 정한다 — 소스별 기본값(ACP)이 재저작에는 없다.
      register: spec.register ?? a.register ?? null,
      lexical_noise: noise,
      status: 'ready',
      // 학령을 사양에 박는다 — 없으면 스크립트마다 다시 유도하다 서로 다른 답을 낸다
      //   (실측: spine-report 는 중등, drain-review 는 초등이라고 했다).
      composed_spec: { ...spec, grade_band: spec.grade_band ?? bandForVLevel(spec.target_v_level) },
      content_hash: sha256(fullText),
    })
    .eq('id', a.id)
  if (upErr) throw new Error('갱신 실패: ' + upErr.message)

  // 측정 난이도 보고.
  //
  // ⚠️ 발주의 `target_v_level` 과 측정된 `article_v_level` 은 **같은 양이 아니다.**
  //   측정치는 `compute_article_vrl` 의 정의상 *서로 다른 lemma 의 v_level P75* 라서
  //   글이 길수록 희귀 lemma 표본이 늘어 자동으로 올라간다 — 발행 아티클 실측에서
  //   같은 CEFR 대(B1·B2) 안에서도 300어 미만 평균 4.00 → 1,500어 이상 평균 4.86 으로
  //   길이만으로 갈렸다. 재저작 글은 설계상 130~320어라 ACP 장문(평균 1,700어)에
  //   맞춰진 점 목표와 직접 비교하면 **구조적으로 낮게 나온다.**
  //
  //   그래서 계약은 점 목표가 아니라 **유형의 밴드**다. 밴드를 벗어날 때만 경고하고
  //   점 목표와의 차이는 참고로만 적는다. (±2 로 경고하던 초판은 첫 실행에서 정상 글을
  //   실패로 불렀다 — 맞추겠다고 어려운 단어를 끼워 넣으면 학습원칙6 을 위반한다.)
  const { data: after } = await db
    .from('library_articles')
    .select('article_v_level, vrl_components')
    .eq('id', a.id)
    .single()
  const measured = after?.article_v_level ?? null
  const target = spec.target_v_level ?? null
  const band = LEARNING_TYPES[spec.track]?.vBand ?? null
  // 사양 조회가 비면 검사가 조용히 안 돈다 — 실제로 그렇게 한 번 놓쳤다(경로를 잘못 적었는데
  //   옵셔널 체이닝이 undefined 로 삼켰고, 출력에 밴드 줄이 없다는 것만으로는 아무도 몰랐다).
  if (spec.track && !band) console.log(`     ⚠ 유형 '${spec.track}' 의 밴드를 찾지 못했습니다 — 밴드 검사를 건너뜁니다.`)
  const outOfBand = measured != null && band != null && (measured < band.min || measured > band.max)
  const c = after?.vrl_components ?? {}

  console.log(
    `  → ready · ${result.word_count}어 · ${result.cefr_level} · 어휘 ${result.words.length} · noise ${noise}`,
  )
  console.log(
    `  → V ${measured ?? '?'} (p50 ${c.p50 ?? '?'} / p90 ${c.p90 ?? '?'} · lemma ${c.matched_lemmas ?? '?'})` +
      (band ? ` · 유형 밴드 ${band.min}~${band.max}` : '') +
      (target != null ? ` · 발주 목표 ${target}` : ''),
  )
  if (outOfBand) {
    console.log('     ⚠ 유형 밴드를 벗어났습니다 — 계약 위반입니다. 본문을 다시 쓰세요.')
  }

  // 본문 해시가 바뀌면 기존 재저작 게이트 판정은 낡은 것이다 — 그대로 두면 낡은 PASS 로 발행된다.
  const { data: stale } = await db
    .from('article_compose_gates')
    .select('invariant')
    .eq('article_id', a.id)
    .neq('content_hash', norm.body_hash)
  if (stale?.length) {
    console.log(`  ⚠ 게이트 ${stale.length}건이 이전 본문 기준입니다 — 게이트를 다시 돌리세요.`)
  }
  console.log()
}

console.log(commit ? '완료.' : '\n--commit 을 붙이면 실제로 처리합니다.')

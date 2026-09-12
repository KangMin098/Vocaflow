// scripts/dict/drain-article-lemmas.mjs
//
// **기사에 나온 낱말 중 사전에 없는 것을 Claude Code 가 채우는 드레인.**
//
// ── 왜 만들었나 (실측 2026-08-19) ─────────────────────────────────────
// 파이프라인에는 이미 LLM 사전 보강이 있다 — `lookupAndEnrich` 가 miss 를 Haiku 로 만들어
// `enrich_shared_dictionary` RPC 로 되돌려 넣는다. **그런데 그 RPC 는 한 행도 넣은 적이 없다.**
//
//   RPC 본문:            source = 'lcp_llm'  (하드코딩, 마이그레이션 20260508120200)
//   테이블 제약:          source IN (oxford5000·cefrj·coca·ngsl·ai-generated·manual·imported…)
//                        (마이그레이션 20260504160708 — RPC 보다 **나흘 먼저**)
//
// 즉 태어날 때부터 `23514 check constraint` 로 실패했고, 호출부는 그 오류를
// `console.warn` 으로 삼켰다(`lookup-enrich.ts`). 103일 동안 조용히 버려졌다.
//
// ⚠️ 그래서 **키를 넣어도 이 구멍은 안 막힌다** — 낱말을 만들어 돈을 쓰고 그대로 버렸을 것이다.
//   `shared_dictionary` 에 `source='lcp_llm'` 행이 0개인 것이 그 증거다.
//
// 이 스크립트는 그 자리를 **Claude Code 배치**로 메운다. 저장소가 이미 쓰는 방식이다
// (ScriptQuiz 1,292문항 · VCB enrichment chunk). RPC 를 고치려면 마이그레이션이 필요한데,
// 여기서는 service-role 로 직접 넣어 **마이그레이션 없이** 같은 일을 한다.
//
//   source        'ai-generated'         — 제약이 허용하는 값 중 뜻이 맞는 것
//   classified_by 'claude_code_opus_5'   — 이 저장소가 Claude Code 산출물에 쓰는 표시
//   verified      false                  — 사람 검수 전
//
// ── 순서가 중요하다 ───────────────────────────────────────────────────
// 뜻은 `library_article_vocabularies` 에 복사되지 않고 읽을 때 `shared_dictionary` 를 본다
// (그 테이블에 뜻 컬럼이 없다 — 실측). 그래서 **나중에 채워도 이미 처리된 기사에 반영된다.**
// 다만 `base_learning_value` 와 CEFR 은 분석 시점의 사전으로 계산돼 행에 박히므로,
// **사전을 먼저 채우고 처리**하는 편이 낫다. 이미 처리한 기사는 재분석하면 따라온다.
//
// 재실행 안전: 내보내기는 읽기만 한다. 들여오기는 이미 있는 낱말을 건너뛴다(word 유일).
//
// 실행:
//   pnpm dlx tsx scripts/dict/drain-article-lemmas.mjs --export              # 빠진 낱말을 청크로 뽑는다
//   pnpm dlx tsx scripts/dict/drain-article-lemmas.mjs --export --status ready
//   … 여기서 Claude Code 가 chunk-NN.json 을 읽고 chunk-NN.out.json 을 쓴다 …
//   pnpm dlx tsx scripts/dict/drain-article-lemmas.mjs --import              # 검증만 (읽기 전용)
//   pnpm dlx tsx scripts/dict/drain-article-lemmas.mjs --import --commit     # 넣는다

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const OUT_DIR = path.resolve(arg('dir') ?? 'scripts/dict/article-lemmas')
const CHUNK_SIZE = Number(arg('chunk') ?? 60)
const STATUSES = (arg('status') ?? 'queued,ready').split(',').map((s) => s.trim())
const commit = process.argv.includes('--commit')

const { createClient } = await import('@supabase/supabase-js')
const { extractBookLemmas, normalizePunctuation, reflowSoftHyphens } = await import(
  '@vocaflow/library-pipeline'
)

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

/** 제약이 허용하는 CEFR 값. 여기 없는 값이 오면 그 낱말만 거른다(전체 실패 방지). */
const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
/** 통째로 넣기 전에 확인하는 품사 — 오타가 사전에 그대로 남는 것을 막는다. */
// 사전에 **이미 쓰이고 있는 값**만 허용한다(실측 16종). 새 값을 만들면 기존 45,292행과
//   섞여 조회·통계가 갈린다.
const POS = [
  'noun', 'adjective', 'verb', 'adverb', 'idiom', 'phrasal_verb', 'abbreviation',
  'interjection', 'preposition', 'determiner', 'pronoun', 'conjunction',
  'prefix', 'auxiliary', 'number', 'other',
]

// ─────────────────────────────────────────────────────────────────────
// 내보내기 — 기사에서 낱말을 뽑아 사전에 없는 것만 청크로 쓴다.
// ─────────────────────────────────────────────────────────────────────
async function doExport() {
  const { data: articles, error } = await db
    .from('library_articles')
    .select('id, source, title, content, status')
    .in('status', STATUSES)
    .order('created_at', { ascending: true })
  if (error) throw new Error('기사 조회 실패: ' + error.message)

  const list = (articles ?? []).filter((a) => (a.content ?? '').trim().length > 0)
  console.log(`대상 기사 ${list.length}편 (status: ${STATUSES.join(' · ')})\n`)
  if (!list.length) {
    console.log('뽑을 것이 없다.')
    return
  }

  // 파이프라인과 **같은 추출기**를 쓴다 — 다르면 드레인이 채운 낱말을 파이프라인이 못 찾는다.
  const seen = new Map() // lemma → { count, sample }
  for (const a of list) {
    const body = reflowSoftHyphens(normalizePunctuation(a.content ?? ''))
    const idx = extractBookLemmas([
      {
        chapter_idx: 1,
        content: body,
        word_count: body.split(/\s+/).length,
        paragraph_offsets: [0],
        sentence_offsets: [0],
      },
    ])
    for (const [lemma, freq] of idx.bookFrequency) {
      const prev = seen.get(lemma)
      const occ = idx.occurrences?.get(lemma)?.[0]
      seen.set(lemma, {
        count: (prev?.count ?? 0) + freq,
        sample: prev?.sample ?? occ?.first_sentence_in_chapter ?? null,
      })
    }
  }
  console.log(`서로 다른 낱말 ${seen.size}`)

  // 사전에 이미 있는 것 빼기 — IN 제약을 피해 나눠 묻는다.
  const all = [...seen.keys()]
  const have = new Set()
  for (let i = 0; i < all.length; i += 500) {
    const { data, error: e } = await db
      .from('shared_dictionary')
      .select('word, meaning_ko')
      .in('word', all.slice(i, i + 500))
    if (e) throw new Error('사전 조회 실패: ' + e.message)
    // 행은 있는데 뜻이 비어 있으면 **없는 것과 같다** — 학습자에게는 똑같이 안 보인다.
    for (const r of data ?? []) if (r.meaning_ko) have.add(r.word)
  }

  const exact = all.filter((w) => !have.has(w))
  const hit = ((100 * (all.length - exact.length)) / all.length).toFixed(1)
  console.log(`정확 일치 ${all.length - exact.length}/${all.length} = ${hit}%`)

  // ⚠️ 여기서 멈추면 **없는 구멍을 메우게 된다.**
  //   추출기는 본문에 표제어가 없으면 표면형을 그대로 남긴다
  //   (`keepLemmaOnlyIfInText` · v06.35 유령 어휘 차단). 짧은 기사에서는 단수형이 본문에
  //   안 나오는 일이 흔해 countries·years·hours 같은 굴절형이 통째로 "미등재"로 보인다.
  //   그러나 학습자 경로(`select_article_vocab` → `resolve_dict_headword`)는 그걸 푼다.
  //   실제로 이 첫 실측에서 정확 일치 64.2% 였는데, 그 차이의 대부분이 굴절형이었다.
  //
  //   그래서 **해소기를 한 번 더 통과시킨 뒤 남는 것만** Claude Code 에게 맡긴다.
  //   안 그러면 사전에 countries·years 같은 굴절형을 중복 등재해 품질을 되레 깎는다
  //   (`ops.ts` 도움말: "철자 변이가 뜨면 사전에 넣지 마라 — 해석기를 고쳐라").
  const unresolved = []
  for (let i = 0; i < exact.length; i += 400) {
    const { data, error: e2 } = await db.rpc('unresolved_dict_words', {
      p_words: exact.slice(i, i + 400),
    })
    if (e2) throw new Error('해소기 조회 실패: ' + e2.message)
    for (const r of data ?? []) unresolved.push(typeof r === 'string' ? r : r.word)
  }
  const missingRaw = unresolved
    .filter((w) => seen.has(w))
    .sort((a, b) => seen.get(b).count - seen.get(a).count)

  // ⚠️ 이미 "등재 대상 아님" 으로 판정된 것을 다시 내보내지 않는다.
  //   `skip: true` 는 **어디에도 기록되지 않는다** — 고치기 전에는 URL 조각(`fishusa`)·
  //   학명 종소명(`macrochirus`)·중세 영어(`shoures`)가 export 마다 그대로 다시 나왔고,
  //   판정하는 쪽은 그것이 "아직 안 본 것" 인지 "보고 뺀 것" 인지 알 수 없었다
  //   (2026-08-26 실측: 450건 중 **133건**이 그런 재출현이었다).
  //   자매 드레인(`drain-pending-words.mjs`)이 채우는 두 목록을 그대로 재사용한다 —
  //   같은 낱말을 두 파이프라인이 각자 판정하던 중복도 함께 사라진다
  //   (같은 날 실측: article-lemmas 잔여 1,010건 중 **747건(74%)** 이 pending_words 와 겹쳤다).
  const judged = new Set()
  for (const table of ['noise_blacklist', 'proper_noun_forms']) {
    for (let i = 0; i < missingRaw.length; i += 500) {
      const { data, error: e3 } = await db
        .from(table)
        .select('form')
        .in('form', missingRaw.slice(i, i + 500))
      if (e3) throw new Error(`${table} 조회 실패: ` + e3.message)
      for (const r of data ?? []) judged.add(String(r.form).toLowerCase())
    }
  }
  const missing = missingRaw.filter((w) => !judged.has(w))

  // 적중률은 **거르기 전** 기준으로 적는다 — 걸러도 학습자가 뜻을 못 보는 사실은 그대로다.
  const realHit = ((100 * (all.length - missingRaw.length)) / all.length).toFixed(1)
  console.log(`해소기가 푼 것 ${exact.length - missingRaw.length} (굴절·철자 변이)`)
  console.log(`실제 적중 ${all.length - missingRaw.length}/${all.length} = ${realHit}%  ← 학습자가 겪는 값`)
  if (judged.size > 0) {
    console.log(`이미 판정된 것 ${judged.size} 제외 (노이즈·고유명사 목록)`)
  }
  console.log(`진짜 빠진 낱말 ${missing.length}\n`)
  if (!missing.length) {
    console.log('채울 것이 없다.')
    return
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  // 앞선 드레인의 잔재가 섞이면 이미 넣은 것을 또 채우게 된다.
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/^chunk-\d+\.(out\.)?json$/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f))
  }

  let n = 0
  for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
    const rows = missing.slice(i, i + CHUNK_SIZE).map((w) => ({
      word: w,
      // 문맥을 같이 준다 — 다의어의 어느 뜻인지는 예문 없이 정할 수 없다.
      seen_in: seen.get(w).sample ? seen.get(w).sample.slice(0, 180) : null,
      article_freq: seen.get(w).count,
    }))
    const file = path.join(OUT_DIR, `chunk-${String(n).padStart(2, '0')}.json`)
    fs.writeFileSync(file, JSON.stringify(rows, null, 1) + '\n')
    n++
  }
  fs.writeFileSync(path.join(OUT_DIR, '_PROMPT.md'), PROMPT)
  console.log(`청크 ${n}개 → ${path.relative(process.cwd(), OUT_DIR)}`)
  console.log(`\nClaude Code 가 chunk-NN.json 을 읽고 chunk-NN.out.json 을 쓴다.`)
  console.log(`형식·규칙은 ${path.relative(process.cwd(), path.join(OUT_DIR, '_PROMPT.md'))} 참조.`)
}

const PROMPT = `# 기사 낱말 사전 드레인 — Claude Code 작업 지시

\`chunk-NN.json\` 을 읽고 **같은 폴더에** \`chunk-NN.out.json\` 을 쓴다.

## 입력 한 줄
\`\`\`json
{ "word": "corticosteroid", "seen_in": "…문장…", "article_freq": 3 }
\`\`\`

## 출력 한 줄 (입력과 **같은 개수·같은 순서**)
\`\`\`json
{ "word": "corticosteroid", "meaning_ko": "코르티코스테로이드(부신피질호르몬제)",
  "pos": "noun", "cefr_level": "C1",
  "example_en": "The doctor prescribed a corticosteroid to reduce the swelling." }
\`\`\`

## 규칙
- \`meaning_ko\` — 한국 학습자용 뜻. **\`seen_in\` 문맥의 뜻을 먼저** 적고, 다른 흔한 뜻은 쉼표로.
- \`pos\` — noun · verb · adjective · adverb · pronoun · preposition · conjunction ·
  determiner · interjection · idiom · phrasal_verb · abbreviation · number · other 중
  하나(소문자). 사전에 이미 쓰이는 값이라 새로 만들지 않는다.
- \`cefr_level\` — A1·A2·B1·B2·C1·C2 중 하나. **그 낱말 자체의 난이도**이지 기사 난이도가 아니다.
- \`example_en\` — 짧고 자연스러운 한 문장. **\`seen_in\` 을 그대로 옮기지 않는다**(원문 복제 금지).
- 고유명사·오탈자·영어가 아닌 것은 그 줄을 **빼지 말고** \`"skip": true\` 를 붙인다.
  빼면 개수가 어긋나 들여오기가 거부한다.

## 되돌리기
들여오기는 이미 있는 낱말을 건너뛴다. 잘못 넣었으면
\`delete from shared_dictionary where classified_by='claude_code_opus_5' and source='ai-generated' and created_at > '…'\`
로 지운다 — **다른 출처 행은 건드리지 않는다.**
`

// ─────────────────────────────────────────────────────────────────────
// 들여오기 — 채워진 청크를 검증하고 사전에 넣는다.
// ─────────────────────────────────────────────────────────────────────
async function doImport() {
  if (!fs.existsSync(OUT_DIR)) {
    console.error(`${OUT_DIR} 가 없다. 먼저 --export 를 돌린다.`)
    process.exit(2)
  }
  const chunks = fs.readdirSync(OUT_DIR).filter((f) => /^chunk-\d+\.json$/.test(f)).sort()
  if (!chunks.length) {
    console.error('청크가 없다. 먼저 --export 를 돌린다.')
    process.exit(2)
  }

  const rows = []
  const problems = []
  let pending = 0

  for (const c of chunks) {
    const outFile = path.join(OUT_DIR, c.replace(/\.json$/, '.out.json'))
    if (!fs.existsSync(outFile)) {
      pending++
      continue
    }
    const input = JSON.parse(fs.readFileSync(path.join(OUT_DIR, c), 'utf8'))
    let output
    try {
      output = JSON.parse(fs.readFileSync(outFile, 'utf8'))
    } catch (e) {
      problems.push(`${c}: 출력이 JSON 이 아니다 — ${e.message}`)
      continue
    }
    if (!Array.isArray(output) || output.length !== input.length) {
      // 개수가 다르면 어느 낱말이 빠졌는지 알 수 없다 — 통째로 거부한다.
      problems.push(`${c}: 개수 불일치 (입력 ${input.length} · 출력 ${output?.length ?? '배열 아님'})`)
      continue
    }
    for (let i = 0; i < output.length; i++) {
      const o = output[i]
      const want = input[i].word
      if (o?.skip === true) continue
      if (!o || String(o.word ?? '').toLowerCase() !== want) {
        problems.push(`${c}[${i}]: 낱말이 어긋난다 (기대 "${want}" · 실제 "${o?.word}")`)
        continue
      }
      if (!o.meaning_ko || !String(o.meaning_ko).trim()) {
        problems.push(`${c}[${i}] ${want}: meaning_ko 가 비었다`)
        continue
      }
      if (o.cefr_level && !CEFR.includes(o.cefr_level)) {
        problems.push(`${c}[${i}] ${want}: cefr_level "${o.cefr_level}" 은 제약 밖`)
        continue
      }
      if (o.pos && !POS.includes(String(o.pos).toLowerCase())) {
        problems.push(`${c}[${i}] ${want}: pos "${o.pos}" 는 목록 밖`)
        continue
      }
      rows.push({
        word: want,
        meaning_ko: String(o.meaning_ko).trim(),
        cefr_level: o.cefr_level ?? null,
        pos: o.pos ? String(o.pos).toLowerCase() : null,
        example_en: o.example_en ? String(o.example_en).trim() : null,
        // RPC 가 쓰는 'lcp_llm' 은 제약이 막는다 — 허용값을 쓰고 출처는 classified_by 로 남긴다.
        source: 'ai-generated',
        classified_by: 'claude_code_opus_5',
        verified: false,
      })
    }
  }

  console.log(`청크 ${chunks.length} · 채워진 것 ${chunks.length - pending} · 남은 것 ${pending}`)
  console.log(`넣을 수 있는 낱말 ${rows.length}`)
  if (problems.length) {
    console.log(`\n거른 것 ${problems.length}:`)
    for (const p of problems.slice(0, 15)) console.log(`  · ${p}`)
    if (problems.length > 15) console.log(`  … 그리고 ${problems.length - 15}건`)
  }
  if (!commit) {
    console.log('\n--commit 을 붙이면 넣는다. (읽기 전용으로 돌았다)')
    return
  }
  if (!rows.length) return

  // 이미 있는 낱말은 건드리지 않는다 — 검수된 뜻을 드레인이 덮으면 품질이 내려간다.
  const words = rows.map((r) => r.word)
  const existing = new Set()
  for (let i = 0; i < words.length; i += 500) {
    const { data } = await db
      .from('shared_dictionary')
      .select('word')
      .in('word', words.slice(i, i + 500))
    for (const r of data ?? []) existing.add(r.word)
  }
  const fresh = rows.filter((r) => !existing.has(r.word))
  console.log(`\n이미 있는 것 ${rows.length - fresh.length} 건너뜀 · 새로 넣을 것 ${fresh.length}`)

  let saved = 0
  for (let i = 0; i < fresh.length; i += 200) {
    const batch = fresh.slice(i, i + 200)
    const { error } = await db.from('shared_dictionary').insert(batch)
    if (error) {
      console.log(`  ✗ ${i}~${i + batch.length}: ${error.message}`)
      continue
    }
    saved += batch.length
  }
  console.log(`넣은 낱말 ${saved}`)
  console.log('\n뜻은 읽을 때 조회되므로 이미 처리된 기사에도 바로 반영된다.')
  console.log('base_learning_value·CEFR 까지 맞추려면 그 기사를 재분석한다.')
}

if (process.argv.includes('--export')) await doExport()
else if (process.argv.includes('--import')) await doImport()
else {
  console.log('사용법:')
  console.log('  pnpm dlx tsx scripts/dict/drain-article-lemmas.mjs --export [--status queued,ready] [--chunk 60]')
  console.log('  pnpm dlx tsx scripts/dict/drain-article-lemmas.mjs --import [--commit]')
}

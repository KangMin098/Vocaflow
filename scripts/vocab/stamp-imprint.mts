// scripts/vocab/stamp-imprint.mts
//
// **판권면 각인 — 발행 단어장에 "누가 언제 무엇을 확인했는가" 를 남긴다.**
//
// ── 왜 필요한가 (실측 2026-08-30) ───────────────────────────────────
// 선택 지수(`vocab/choice-benchmark.mts`) 기준선이 **0.83** 이었다. 시중 어휘 교재는 한 권당
// 선택 근거 8.50개를 주는데 우리는 7.06개다. 못 준 것 중 둘은 **재료가 없어서가 아니라
// 세어 둔 적이 없어서**였다:
//
//   · `proofread` (감수) 0/70 — 화면이 검수 수치를 갖고 있지 않아 판권면이 그 줄을 뺐다.
//     (`VocabColophon.tsx` 가 `autoPassed: 0, autoTotal: 0` 을 넘기고 있었다.)
//   · `targetGrade` (대상 수준) 59/70 — 사다리 **밖**(성인 수준) 세트는 계단이 없어
//     아무 수준도 못 적었다. "학령 밖" 은 수준이 없다는 뜻이 아니다.
//
// 그래서 이 스크립트가 **한 번 세어 세트에 각인한다.** 화면이 매 요청마다 3만 행을 세지
// 않게 하려는 것이기도 하다.
//
// ── 무엇을 각인하는가 ──────────────────────────────────────────────
// `curation_query` jsonb 에 키를 **더한다**(마이그레이션 불필요):
//
//   · `qa`    — 자동 검수. 표제어가 뜻·예문·발음·품사 **넷을 다 갖췄는가**. 시중 어휘 교재의
//               표제어 칸이 싣는 것과 같은 넷이다(`market-spec.json` 의 FIELD_PROBES).
//   · `level` — 표제어 `v_level` 의 중앙값·최소·최대. 사다리 밖 권의 **대상 수준**이 된다.
//               왜 중앙값인가는 `reconcile-ladder.mts` 머리 주석과 같다(평균은 꼬리에 끌린다).
//   · `imprint` — 각인 시각. 낡았는지 볼 수 있어야 한다.
//
// 그리고 `brand_fingerprint` 를 현재 규격의 지문으로 적는다. 단어장은 교재와 달리 **화면이
// 토큰에서 live 로 그리므로**, 각인은 "이 권이 이 규격으로 서가에 선다" 는 뜻이다. 나중에
// 토큰이 바뀌면 값이 달라져 옛 각인을 가려낼 수 있다.
//
// ── 안전 ────────────────────────────────────────────────────────────
// · **jsonb 를 통째로 덮지 않는다.** 기존 값을 읽어 키만 더한다 — 덮으면 컴포저가 남긴
//   레시피·점수표가 날아간다(CLAUDE.md §드레인 규칙).
// · 표제어가 없는 세트는 건너뛴다 — 0/0 을 적으면 "검수 0 통과" 로 읽힌다.
// · 기본은 드라이런. 실제로 쓰려면 `--commit`.
// · **재실행 안전** — 몇 번을 돌려도 같은 값이 나온다(같은 재고라면).
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/vocab/stamp-imprint.mts [--commit] [--set <uuid>]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const { vocabBrandFingerprint } = await import('@vocaflow/library-pipeline/vocab-brand')

const COMMIT = process.argv.includes('--commit')
const ONLY_SET = (() => {
  const i = process.argv.indexOf('--set')
  return i >= 0 ? process.argv[i + 1] : null
})()

/** 학습자의 공용 서가에 뜨지 않는 칸 — `lib/library/vocab/queries.ts` 와 같아야 한다. */
const HIDDEN = ['library_book', 'library_article']

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const FINGERPRINT = vocabBrandFingerprint()

let q = supabase
  .from('shared_word_sets')
  .select('id, title, curation_query, brand_fingerprint')
  .eq('is_published', true)
  .not('category', 'in', `(${HIDDEN.join(',')})`)
if (ONLY_SET) q = q.eq('id', ONLY_SET)
const { data: sets, error: setErr } = await q
if (setErr) throw new Error(`shared_word_sets: ${setErr.message}`)

/**
 * 한 세트의 표제어를 전부 읽어 검수 수치와 수준을 낸다.
 *
 * ⚠️ 세트별로 부른다 — `shared_words` 는 8만 행이라 한 번에 훑으면 statement timeout 이다
 *    (`market-benchmark.mjs` 와 같은 이유).
 */
async function measure(setId) {
  let checked = 0
  let passed = 0
  const levels = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('shared_words')
      .select('meaning_ko, example_en, pronunciation, part_of_speech, v_level')
      .eq('set_id', setId)
      .order('word')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`shared_words(${setId}): ${error.message}`)
    for (const r of data) {
      checked += 1
      // 시중 어휘 교재의 표제어 칸이 싣는 넷. 하나라도 없으면 통과가 아니다.
      if (r.meaning_ko && r.example_en && r.pronunciation && r.part_of_speech) passed += 1
      if (typeof r.v_level === 'number') levels.push(r.v_level)
    }
    if (data.length < PAGE) break
  }
  levels.sort((a, b) => a - b)
  const level = levels.length === 0
    ? null
    : {
        // 짝수 개면 아래쪽 — 계단과 같은 규칙(틀리면 아래로).
        median: levels[Math.floor((levels.length - 1) / 2)],
        min: levels[0],
        max: levels[levels.length - 1],
        measured: levels.length,
      }
  return { checked, passed, level }
}

let stamped = 0
let skipped = 0

for (const s of sets) {
  const { checked, passed, level } = await measure(s.id)
  if (checked === 0) {
    console.info(`  ${s.title.slice(0, 30).padEnd(32)} 표제어 0 — 건너뜀`)
    skipped += 1
    continue
  }

  const rate = ((passed / checked) * 100).toFixed(1)
  console.info(
    `  ${s.title.slice(0, 30).padEnd(32)} 검수 ${String(passed).padStart(5)}/${String(checked).padEnd(5)}`
    + ` (${rate.padStart(5)}%)  수준 ${level ? `V${level.median}` : '—'}`,
  )

  if (!COMMIT) continue

  // **기존 jsonb 를 읽어 키만 더한다** — 통째로 덮으면 레시피·점수표가 날아간다.
  const next = {
    ...(s.curation_query ?? {}),
    qa: { checked, passed, at: new Date().toISOString() },
    ...(level ? { level } : {}),
    imprint: { at: new Date().toISOString(), spec: FINGERPRINT },
  }
  const { error } = await supabase
    .from('shared_word_sets')
    .update({ curation_query: next, brand_fingerprint: FINGERPRINT })
    .eq('id', s.id)
  if (error) throw new Error(`각인 실패(${s.id}): ${error.message}`)
  stamped += 1
}

console.info('')
console.info(`세트 ${sets.length} · 규격 지문 ${FINGERPRINT}`)
console.info(COMMIT ? `  각인함 ${stamped} · 건너뜀 ${skipped}` : `  드라이런 — --commit 으로 실제 각인 (건너뜀 ${skipped})`)

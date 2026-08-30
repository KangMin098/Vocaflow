// scripts/textbook/adapt-drain-import.mjs
//
// **레벨 적응 드레인 ③/③ — 쉬운 판을 게이트에 걸어 서가에 넣는다.**
//
// ── 무엇을 막는가 ────────────────────────────────────────────────────
// `compose/adaptation.ts` 의 게이트를 그대로 돌린다. critical 은 **I17 서가 중복** 하나다 —
// 같은 내용이 서가에 두 번 오르면 서가가 부풀어 보일 뿐 배울 것은 늘지 않는다.
// A1(원문 재작성) · A2(목표 레벨)는 경고다 — 라이선스가 허락한 일이라 막지 않고, 대신
// **몇 편이 경고를 달고 들어갔는지 반드시 찍는다.**
//
// 규격 밖(어수·평균 문장 길이)은 여기서 막는다 — 게이트가 아니라 학령 규격이고,
// 규격 밖 글은 그 학년 교재에 못 싣는다.
//
// ── 넣지 않는 것 ─────────────────────────────────────────────────────
// 제목·본문이 빈 것 · 어수가 규격 밖인 것 · 원본과 통째로 겹치는 것 · I17 FAIL.
// **건너뛴 수와 이유를 반드시 출력한다** — 조용히 빠지면 다음 실행이 "완료" 로 세어
// 구멍이 영영 남는다(루트 CLAUDE.md §🤖).
//
// 재실행 안전: 같은 원본에 같은 밴드의 각색본이 이미 있으면 건너뛴다.
//
// 실행:
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/adapt-drain-import.mjs --band elementary
//   ... --band elementary --commit

import fs from 'node:fs'
import path from 'node:path'

import { loadEnv, fetchAllIn } from './volume-pool.mjs'

loadEnv()
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const commit = process.argv.includes('--commit')
const BAND = arg('band') ?? 'elementary'
// export 와 **같은 규칙**으로 폴더를 찾는다. 어긋나면 채운 청크를 못 읽고
// "out.json 이 없다" 로 끝난다 — 그 자리에서 원인을 알기 어렵다.
const DIR = path.resolve(
  arg('dir') ?? `scripts/textbook/adapt-drain/${BAND}${arg('v-level') ? `-v${arg('v-level')}` : ''}`,
)

const { createClient } = await import('@supabase/supabase-js')
const { GRADE_BANDS, buildFingerprint, isAdaptationPublishable, runAdaptationGates } = await import(
  '@vocaflow/library-pipeline'
)

const spec = GRADE_BANDS[BAND]
if (!spec) {
  console.error(`모르는 밴드: ${BAND}`)
  process.exit(1)
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

if (!fs.existsSync(DIR)) {
  console.error(`폴더가 없다: ${DIR} — 먼저 adapt-drain-export.mjs 를 돌린다.`)
  process.exit(1)
}
const outFiles = fs.readdirSync(DIR).filter((f) => f.endsWith('.out.json')).sort()
if (!outFiles.length) {
  console.error(`${DIR} 에 .out.json 이 없다 — 청크를 채운 뒤 다시 돌린다.`)
  process.exit(1)
}

const rows = []
for (const f of outFiles) rows.push(...JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')))

const words = (t) => (t.match(/[A-Za-z][A-Za-z'-]*/g) || []).length
const sentences = (t) => t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)

// ── 사전에서 낱말 레벨을 끌어온다 — A2(목표 레벨) 판정의 근거다 ──────────
const allWords = [
  ...new Set(rows.flatMap((r) => ((r.text ?? '').toLowerCase().match(/[a-z][a-z'-]*/g) || []))),
]
const dict = new Map()
for (const d of await fetchAllIn(db, 'shared_dictionary', 'word, v_level', 'word', allWords, ['word'])) {
  dict.set(d.word.toLowerCase(), d.v_level ?? null)
}

// ── 서가 — 같은 원본에서 이미 나온 다른 판 ──────────────────────────────
const sourceIds = [...new Set(rows.map((r) => r.adapted_from_id).filter(Boolean))]
const siblings = await fetchAllIn(
  db,
  'library_articles',
  'id, title, content, source, source_url, published_at, adapted_from_id, article_v_level',
  'adapted_from_id',
  sourceIds,
  ['adapted_from_id'],
)
const shelfBySource = new Map()
for (const s of siblings) {
  if (!shelfBySource.has(s.adapted_from_id)) shelfBySource.set(s.adapted_from_id, [])
  shelfBySource.get(s.adapted_from_id).push({
    id: s.id,
    publisher: s.source ?? 'vocaflow',
    url: s.source_url ?? '',
    published_at: s.published_at ?? new Date().toISOString(),
    fingerprint: buildFingerprint(s.content ?? ''),
  })
}

const stats = { scanned: 0, ready: 0, skipped: 0, warned: 0, already: 0 }
const reasons = {}
const skip = (why) => { stats.skipped += 1; reasons[why] = (reasons[why] ?? 0) + 1 }
const inserts = []

for (const r of rows) {
  stats.scanned += 1
  const text = (r.text ?? '').trim()
  const title = (r.title ?? '').trim()
  if (!title || !text) { skip('제목 또는 본문이 비었다'); continue }

  // 우리가 쓴 글은 각색 대상이 아니다 — `chk_original_needs_batch` 가 `source='original'` 에
  // compose 배치 정보를 요구하는데, 원본의 spec 은 각색본을 설명하지 않는다.
  // export 가 이미 걸러 내지만 **낡은 청크가 남아 있을 수 있어** 여기서도 막는다.
  // 한 행 때문에 배치 전체가 터지는 것보다 세어서 건너뛰는 편이 낫다.
  if (r.source_feed === 'original') { skip("우리가 쓴 글(source='original')은 각색하지 않는다"); continue }

  // 같은 원본 · 같은 레벨의 판이 이미 있으면 건너뛴다 — 재실행 안전.
  const sibs = shelfBySource.get(r.adapted_from_id) ?? []
  if (siblings.some((s) => s.adapted_from_id === r.adapted_from_id && s.article_v_level === r.target_v_level)) {
    stats.already += 1
    continue
  }

  const w = words(text)
  if (w < spec.words.min || w > spec.words.max) { skip(`어수 규격 밖 (${spec.words.min}~${spec.words.max})`); continue }
  const ss = sentences(text)
  const avg = ss.length ? w / ss.length : 0
  // 평균 문장 길이는 학령의 뼈대다. 1.5배를 넘으면 그 학년 글이 아니다.
  if (avg > spec.avgSentenceWords * 1.5) { skip(`문장이 길다 (평균 ${avg.toFixed(1)}어 · 목표 ${spec.avgSentenceWords})`); continue }

  const results = runAdaptationGates({
    text,
    sourceText: r.source_text ?? '',
    shelf: sibs,
    band: BAND,
    words: [...new Set((text.toLowerCase().match(/[a-z][a-z'-]*/g) || []))].map((word) => ({
      word,
      v: dict.get(word) ?? null,
    })),
  })

  if (!isAdaptationPublishable(results)) {
    const bad = results.find((x) => x.severity === 'critical' && x.verdict === 'FAIL')
    skip(`게이트 ${bad?.invariant ?? 'critical'} 실패`)
    continue
  }
  const warns = results.filter((x) => x.verdict === 'WARN')
  if (warns.length) stats.warned += 1

  stats.ready += 1
  inserts.push({
    row: {
      // 원본의 발행처를 그대로 쓴다 — `library_articles_source_check` 가 실제 피드만
      // 허용하고, 각색해도 귀속은 원 발행처다. 각색이라는 사실은 `adapted_from_id` 와
      // `feed_id='adapted'` 가 나른다.
      source: r.source_feed,
      source_id: `adapt:${r.adapted_from_id}:${r.target_v_level}`,
      source_url: r.source_url ?? null,
      title,
      content: text,
      language: 'en',
      license: r.source_license ?? 'public_domain',
      license_class: r.source_license ?? 'public_domain',
      copyright_safe_in_kr: true,
      status: 'ready',
      article_v_level: r.target_v_level,
      word_count: w,
      reading_minutes: Math.max(1, Math.round(w / 100)),
      display_only: false,
      adapted_from_id: r.adapted_from_id,
      feed_id: 'adapted',
      feed_label: `레벨 적응 (${spec.label})`,
    },
    warns: warns.map((x) => `${x.invariant}: ${x.detail}`),
  })
}

// ⚠️ 목표 단수는 **청크가 들고 온다**(`target_v_level`) — 밴드의 최소값이 아니다.
//    머리말에 `spec.vRange.min` 을 찍던 동안 V2 로 적재하면서 화면에는 "V1" 이라고
//    나왔다. 넣은 곳과 찍힌 곳이 다르면 로그를 믿을 수 없게 된다.
const targetLevels = [...new Set(rows.map((r) => r.target_v_level).filter((v) => v != null))].sort()
console.log(
  `\n레벨 적응 적재 — ${spec.label} ` +
    `(V${targetLevels.join('·V') || spec.vRange.min} · ${spec.words.min}~${spec.words.max}어)`,
)
console.log(`  모드: ${commit ? '적재' : '보기만 (--commit 으로 실제 적재)'}`)
console.log(`  훑음 ${stats.scanned} · 넣을 수 있음 ${stats.ready} · 이미 있음 ${stats.already} · **건너뜀 ${stats.skipped}**`)
for (const [why, n] of Object.entries(reasons)) console.log(`    · ${why}: ${n}건`)
if (stats.warned) console.log(`  ⚠️ 경고를 달고 통과한 것 ${stats.warned}건 — 사람이 본다`)

for (const it of inserts.slice(0, 2)) {
  console.log(`\n  표본: ${it.row.title} (${it.row.word_count}어)`)
  console.log(`    ${it.row.content.slice(0, 160)}…`)
  for (const w of it.warns) console.log(`    ⚠️ ${w}`)
}

if (!commit) {
  console.log('\n적재 안 함 — `--commit` 을 붙여야 실제로 쓴다.\n')
  process.exit(0)
}

let wrote = 0
for (let i = 0; i < inserts.length; i += 100) {
  const batch = inserts.slice(i, i + 100).map((x) => x.row)
  const { error } = await db.from('library_articles').insert(batch)
  if (error) throw new Error(`적재 실패: ${error.message}`)
  wrote += batch.length
}
console.log(`\n적재 완료 ${wrote}편`)
console.log('이어서 확인할 것:')
console.log('  npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/render-volume.mjs --band 1 --units 20\n')

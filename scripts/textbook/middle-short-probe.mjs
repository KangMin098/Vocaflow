// scripts/textbook/middle-short-probe.mjs
//
// **중등 단답 두 유형이 실제 지문에서 몇 개나 나오는지** 잰다.
//
// ── 왜 (이 저장소가 여기서 여러 번 틀렸다) ──────────────────────────
// 생성기가 테스트를 통과한다고 재고가 생기는 것이 아니다. 조건을 다 걸고 나면
// 실제 문장의 대부분이 탈락한다 — 영작 배열이 그랬다(28,455문장 → 9.0%).
// 그러니 "구현했다" 와 "쓸 수 있다" 사이를 **수율로** 메운다.
//
// 재실행 안전: 읽기만 한다. 문항을 저장하지 않는다.
//
// 실행: pnpm dlx tsx scripts/textbook/middle-short-probe.mjs

import fs from 'node:fs'
import { fetchAllPaged } from './volume-pool.mjs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
const { buildBlankWord, buildGrammarFix } = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// 사전 — 빈칸 단서(우리말 뜻)를 여기서 얻는다. 뜻이 없으면 그 낱말은 못 쓴다.
const dict = new Map()
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('shared_dictionary')
    .select('word, meaning_ko')
    .not('meaning_ko', 'is', null)
    .range(from, from + 999)
  if (error) throw new Error('사전 조회 실패: ' + error.message)
  if (!data?.length) break
  for (const r of data) {
    const w = (r.word ?? '').toLowerCase()
    if (w && !dict.has(w)) dict.set(w, String(r.meaning_ko).split(/[;,·/]/)[0].trim())
  }
  if (data.length < 1000) break
}
console.log(`사전 ${dict.size.toLocaleString()} 낱말\n`)
const meaningOf = (w) => dict.get(w) ?? null
// 단서 유일성 — 같은 첫 글자·같은 첫 뜻 낱말이 사전에 하나뿐인가.
// 이 검사가 없으면 생성분의 9.88% 가 채점이 갈린다(실측 2026-08-22).
const hintIdx = new Map()
for (const [w, m] of dict) hintIdx.set(`${w[0]}|${m}`, (hintIdx.get(`${w[0]}|${m}`) ?? 0) + 1)
const hintUnique = (w, m) => (hintIdx.get(`${w[0]}|${m}`) ?? 0) <= 1

// 중등 밴드(V2~V4)를 겨냥하되, 비교를 위해 전 밴드를 함께 센다.
// ⚠️ 페이징 없이 읽으면 1,000행에서 잘려 **리포트 수치가 조용히 틀린다**(원글 6,633편).
const arts = await fetchAllPaged(db, (q) =>
  q
    .from('library_articles')
    .select('id, title, article_v_level, display_only, content')
    .not('content', 'is', null)
    .order('id'))

const stat = new Map()
const bump = (band, key) => {
  if (!stat.has(band)) stat.set(band, { sentences: 0, blank: 0, fix: 0 })
  stat.get(band)[key]++
}
const samples = { blank: [], fix: [] }

for (const a of arts ?? []) {
  if (a.display_only) continue // ND 는 본문을 못 쓴다
  const band = a.article_v_level ?? 0
  // 문단 → 문장. 축약형 마침표까지 다루지 않는다 — 수율 추정에는 영향이 작다.
  const sentences = String(a.content)
    .split(/\n+/)
    .flatMap((p) => p.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter(Boolean)

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i]
    const ctx = i > 0 ? sentences[i - 1] : null
    bump(band, 'sentences')

    const b = buildBlankWord(s, ctx, meaningOf, hintUnique)
    if (b) {
      bump(band, 'blank')
      if (samples.blank.length < 4) samples.blank.push({ band, ...b })
    }
    const f = buildGrammarFix(s, ctx)
    if (f) {
      bump(band, 'fix')
      if (samples.fix.length < 4) samples.fix.push({ band, ...f })
    }
  }
}

const pad = (s, n) => String(s).padEnd(n)
console.log(pad('밴드', 8) + pad('문장', 10) + pad('빈칸', 16) + '어법 고쳐쓰기')
console.log('─'.repeat(56))
let tS = 0
let tB = 0
let tF = 0
for (const [band, v] of [...stat].sort((a, b) => a[0] - b[0])) {
  tS += v.sentences
  tB += v.blank
  tF += v.fix
  const pct = (n) => `${n} (${((100 * n) / Math.max(1, v.sentences)).toFixed(1)}%)`
  console.log(pad(`V${band}`, 8) + pad(v.sentences.toLocaleString(), 10) + pad(pct(v.blank), 16) + pct(v.fix))
}
console.log('─'.repeat(56))
console.log(
  pad('합계', 8) +
    pad(tS.toLocaleString(), 10) +
    pad(`${tB.toLocaleString()} (${((100 * tB) / tS).toFixed(1)}%)`, 16) +
    `${tF.toLocaleString()} (${((100 * tF) / tS).toFixed(1)}%)`,
)

for (const [kind, list] of Object.entries(samples)) {
  console.log(`\n── ${kind} 표본 ──`)
  for (const s of list) {
    console.log(`  V${s.band} ${s.stem}`)
    console.log(`     정답 "${s.answerText}"${s.hint ? ` · 단서 ${s.hint}` : ''}`)
  }
}

fs.writeFileSync(
  'scripts/textbook/middle-short-yield.json',
  JSON.stringify(
    {
      measured_at: new Date().toISOString(),
      dict: dict.size,
      byBand: [...stat].map(([band, v]) => ({ band, ...v })),
      total: { sentences: tS, blank: tB, fix: tF },
    },
    null,
    2,
  ),
)
console.log('\n→ scripts/textbook/middle-short-yield.json')

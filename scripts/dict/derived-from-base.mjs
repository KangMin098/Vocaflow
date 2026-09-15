// scripts/dict/derived-from-base.mjs
//
// **`base_word` 를 뒤집어 `derived_forms` 를 채운다** — 판단 없이, 규칙 없이.
//
// ── 왜 이 방향인가 (실측 2026-09-01) ────────────────────────────────
// 카탈로그 표제어 11,704 중 **4,985 가 파생어 결측**이고, 두 경로가 이미 막혔다:
//
//   · WordNet — 결측 4,985 중 **0건** 을 메운다(이 추출본의 `der` 이 비어 있다).
//   · 접미사 결합(`base + -ment` 가 사전에 있으면 파생어로 인정) — 수율 4%(210)에
//     **오탐 33%**. `apart`+`-ment`→`apartment` · `cent`→`center` · `mast`→`master` ·
//     `arch`→`archive`. 학습자에게 파생어라고 보여 줄 수 없어 접었다.
//     (`base-word-backfill.mjs` 가 같은 교훈을 "abashederness" 로 적어 두었다.)
//
// 그런데 사전은 **반대 방향의 답을 이미 갖고 있다.** `base_word` 가 10,400행에 차 있다
// (`w0830-family.mjs` 배치 + `base-word-backfill.mjs`). `happiness.base_word = happy` 라면
// `happy.derived_forms` 에 `happiness` 가 있어야 한다 — **같은 관계의 양방향**이다.
//
// 그러니 여기서 할 일은 생성이 아니라 **역인덱스**다. 새 사실을 만들지 않으므로 환각이 없다.
// 실측: 사전 전체 487행 · 그중 카탈로그 표제어 **284** 가 이렇게 채워진다.
//
// ── 게이트 ──────────────────────────────────────────────────────────
// · 파생어는 **사전에 등재된 낱말**이다(역인덱스의 출처가 사전 행이므로 자동 충족).
// · 자기 자신은 넣지 않는다(`base_word` 가 자기를 가리키는 행이 있다).
// · **빈 칸만 채운다.** 이미 값이 있으면 손대지 않는다 — WordNet 값이든 우리 값이든
//   출처가 기록된 저작물이고, 역인덱스가 그것보다 낫다고 볼 근거가 없다.
// · cap 12 — `wordnet-enrich.mjs` 의 `derived_forms` cap 과 같은 값.
// · 출처를 **반드시 남긴다**(`field_provenance.derived_forms = 'base-word-inverse'`).
//   2026-09-01 에 출처를 안 남긴 533행이 "출처 불명" 으로 보여 하마터면 purge 될 뻔했다.
//
// 재실행 안전: 빈 칸만 채우므로 두 번째 실행은 "채울 것 0" 을 낸다.
//
// 실행: node scripts/dict/derived-from-base.mjs [--commit] [--catalog-only]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')

const COMMIT = process.argv.includes('--commit')
/** 발행 카탈로그에 실린 표제어만 — 지수에 잡히는 몫만 먼저 보고 싶을 때. */
const CATALOG_ONLY = process.argv.includes('--catalog-only')

/** `wordnet-enrich.mjs` 의 derived_forms cap 과 같은 값. */
const CAP = 12
const PAGE = 1000
const WRITE_CHUNK = 40
const RETRIES = 4

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

/** 공유 DB 라 조회가 끊긴다 — 다른 세션의 큰 배치와 겹치면 특히. 지수 백오프로 다시 묻는다. */
async function withRetry(label, fn) {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fn()
    if (!res.error) return res
    if (attempt >= RETRIES) throw new Error(`${label}: ${res.error.message}`)
    const waitMs = 400 * 2 ** attempt
    console.warn(`  ! ${label} 끊김 — ${waitMs}ms 뒤 재시도 (${attempt + 1}/${RETRIES})`)
    await new Promise((r) => setTimeout(r, waitMs))
  }
}

async function pageAll(label, build) {
  const out = []
  for (let from = 0; ; from += PAGE) {
    const { data } = await withRetry(label, () => build().range(from, from + PAGE - 1))
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

// ── ① base_word 를 가진 행 전부 → base → [파생어] 역인덱스 ──────────
const forms = await pageAll('base_word rows', () =>
  supabase
    .from('shared_dictionary')
    .select('word, base_word')
    .not('base_word', 'is', null)
    .order('word'),
)
const inverse = new Map()
for (const r of forms) {
  const base = (r.base_word ?? '').toLowerCase()
  const w = r.word
  if (!base || base === w.toLowerCase()) continue // 자기 자신은 파생어가 아니다
  if (!inverse.has(base)) inverse.set(base, new Set())
  inverse.get(base).add(w)
}
console.info(`base_word 보유 ${forms.length.toLocaleString()}행 → 기본형 ${inverse.size.toLocaleString()}개`)

// ── ② 카탈로그 표제어 (선택) ────────────────────────────────────────
let catalog = null
if (CATALOG_ONLY) {
  const { data: sets } = await withRetry('sets', () =>
    supabase
      .from('shared_word_sets')
      .select('id')
      .eq('is_published', true)
      .not('category', 'in', '(library_book,library_article)'),
  )
  catalog = new Set()
  for (const s of sets) {
    const rows = await pageAll(`words(${s.id})`, () =>
      supabase.from('shared_words').select('word').eq('set_id', s.id).order('word'),
    )
    for (const r of rows) catalog.add(r.word.toLowerCase())
  }
  console.info(`카탈로그 표제어 ${catalog.size.toLocaleString()}`)
}

// ── ③ 파생어가 빈 표제어 중 역인덱스가 답을 가진 것 ────────────────
const bases = [...inverse.keys()].filter((b) => !catalog || catalog.has(b))
const patches = []
const CHUNK = 200
for (let i = 0; i < bases.length; i += CHUNK) {
  const slice = bases.slice(i, i + CHUNK)
  const { data } = await withRetry('shared_dictionary', () =>
    supabase
      .from('shared_dictionary')
      .select('word, derived_forms, field_provenance')
      .in('word', slice),
  )
  for (const d of data) {
    if (Array.isArray(d.derived_forms) && d.derived_forms.length > 0) continue // 빈 칸만
    const derived = [...(inverse.get(d.word.toLowerCase()) ?? [])]
      .filter((x) => x.toLowerCase() !== d.word.toLowerCase())
      .sort()
      .slice(0, CAP)
    if (derived.length === 0) continue
    patches.push({
      word: d.word,
      derived,
      // 출처를 남긴다 — 안 남기면 다음 정리 배치가 "출처 불명" 으로 보고 지운다.
      provenance: { ...(d.field_provenance ?? {}), derived_forms: 'base-word-inverse' },
    })
  }
}

for (const p of patches.slice(0, 12)) {
  console.info(`  ${p.word.padEnd(20)} → ${p.derived.slice(0, 4).join(' / ')}`)
}
if (patches.length > 12) console.info(`  … 외 ${patches.length - 12}`)

let written = 0
if (COMMIT) {
  for (let i = 0; i < patches.length; i += WRITE_CHUNK) {
    const batch = patches.slice(i, i + WRITE_CHUNK)
    await Promise.all(
      batch.map((p) =>
        withRetry('update', () =>
          supabase
            .from('shared_dictionary')
            .update({ derived_forms: p.derived, field_provenance: p.provenance })
            .eq('word', p.word),
        ),
      ),
    )
    written += batch.length
  }
}

console.info('')
console.info(`${CATALOG_ONLY ? '카탈로그' : '사전 전체'} · 채울 표제어 ${patches.length.toLocaleString()}`)
console.info(COMMIT ? `  기록함 ${written.toLocaleString()}` : '  드라이런 — --commit 으로 실제 기록')

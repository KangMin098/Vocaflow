// scripts/dict/derived-adjudicate.mjs
//
// **파생어 후보를 뽑아 사람(=Claude Code)이 가려낸다** — 3단 드레인.
//
// ── 왜 이 모양인가 (실측 2026-09-01) ────────────────────────────────
// 카탈로그 파생어 결측에 세 경로를 시도했고 둘이 막혔다:
//
//   1. WordNet — 결측의 **0%** 를 메운다(추출본의 `der` 이 비어 있다).
//   2. 접미사 결합 자동 채움 — 수율 4%, **오탐 33%**(`apart`+`-ment`→`apartment` ·
//      `cent`→`center` · `mast`→`master` · `arch`→`archive`). 자동으로는 못 쓴다.
//   3. `base_word` 역인덱스(`derived-from-base.mjs`) — 487 표제어. **환각 없음**.
//      다만 `base_word` 가 있는 만큼만 닿는다(사전의 21%).
//
// 남은 4,050 낱말에는 **판단**이 필요하다. 그런데 판단이 필요한 것은 "무엇이 파생어인가" 가
// 아니라 **"이 후보가 진짜인가"** 다 — 후보는 기계가 뽑을 수 있다. 그래서 둘을 나눈다:
//
//   기계: 표제어를 **통째로 접두**로 갖는 더 긴 사전 표제어를 후보로 올린다
//         (2번의 접미사 결합보다 엄격하다 — `cent`+`er`=`center` 는 여기서도 후보로 오지만,
//          그 판정을 자동으로 하지 않는 것이 요점이다)
//   Claude Code: 후보마다 파생어인지 **가려낸다**. 아니면 버린다.
//
// 실측 후보 규모: 카탈로그 결측 4,050 중 **803 낱말 · 후보 2,496개**.
//
// ── 가려내는 기준 (out.json 을 쓸 때 지킬 것) ───────────────────────
// · 그 낱말에서 **문법적·의미적으로 갈라져 나온 말**만 파생어다.
//   `arch → archly` ⭕ · `arch → archive` ❌(어원이 다르다)
//   `apart → apartment` ❌ · `cent → center` ❌ · `mast → master` ❌
// · 굴절형(복수·과거형)은 파생어가 아니다 — `cat → cats` ❌.
//   (굴절은 `inflected_forms` 의 몫이고, 표지에 파생어로 실으면 학습자가 속는다.)
// · 확신이 없으면 **버린다.** 빈칸이 틀린 값보다 낫다.
//
// ── 안전 ────────────────────────────────────────────────────────────
// · export 는 이미 채워진 표제어를 건너뛴다 — **재실행 안전**.
// · apply 는 빈 배열을 넣지 않고, 후보 목록에 없는 낱말은 **거부**한다(지어낸 값 차단).
// · 출처를 남긴다(`field_provenance.derived_forms = 'adjudicated'`).
// · apply 기본은 드라이런. 실제로 쓰려면 `--commit`.
//
// 실행:
//   node scripts/dict/derived-adjudicate.mjs export [--dir D] [--size 60]
//   → chunk-NN.json 을 읽어 chunk-NN.out.json 으로 저장 (Claude Code)
//   node scripts/dict/derived-adjudicate.mjs apply [--dir D] [--commit]
//   node scripts/dict/derived-adjudicate.mjs status [--dir D]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')

const MODE = process.argv[2]
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const DIR = arg('--dir', 'scripts/dict/derived-adjudicate-w1')
const SIZE = Number(arg('--size', '60'))
const COMMIT = process.argv.includes('--commit')
const CAP = 12
const RETRIES = 4

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

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
  for (let from = 0; ; from += 1000) {
    const { data } = await withRetry(label, () => build().range(from, from + 999))
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

/** 발행 카탈로그의 표제어 — 지수에 잡히는 몫이라 여기부터 채운다. */
async function catalogWords() {
  const { data: sets } = await withRetry('sets', () =>
    supabase.from('shared_word_sets').select('id')
      .eq('is_published', true).not('category', 'in', '(library_book,library_article)'))
  const words = new Set()
  for (const s of sets) {
    const rows = await pageAll(`words(${s.id})`, () =>
      supabase.from('shared_words').select('word').eq('set_id', s.id).order('word'))
    for (const r of rows) words.add(r.word.toLowerCase())
  }
  return words
}

if (MODE === 'export') {
  const cat = await catalogWords()
  console.info(`카탈로그 표제어 ${cat.size.toLocaleString()}`)

  // 결측 표제어
  const list = [...cat].filter((w) => /^[a-z]+$/.test(w) && w.length >= 4)
  const gaps = []
  for (let i = 0; i < list.length; i += 200) {
    const { data } = await withRetry('dict', () =>
      supabase.from('shared_dictionary')
        .select('word, meaning_ko, primary_pos, pos, derived_forms')
        .in('word', list.slice(i, i + 200)))
    for (const d of data) {
      if (Array.isArray(d.derived_forms) && d.derived_forms.length > 0) continue
      gaps.push({ word: d.word, meaning_ko: d.meaning_ko, pos: d.primary_pos || d.pos || null })
    }
  }
  console.info(`파생어 결측 ${gaps.length.toLocaleString()}`)

  // 후보 — 표제어를 통째로 접두로 갖는 더 긴 사전 표제어
  const targets = []
  for (const g of gaps) {
    const { data } = await withRetry(`cand(${g.word})`, () =>
      supabase.from('shared_dictionary')
        .select('word')
        .like('word', `${g.word}%`)
        .neq('word', g.word)
        .limit(20))
    const cands = (data ?? [])
      .map((r) => r.word)
      .filter((x) => x.length > g.word.length && x.length <= g.word.length + 6)
      .sort()
    if (cands.length > 0) targets.push({ ...g, candidates: cands })
  }

  fs.mkdirSync(path.resolve(DIR), { recursive: true })
  let n = 0
  for (let i = 0; i < targets.length; i += SIZE) {
    n += 1
    const p = path.join(DIR, `chunk-${String(n).padStart(2, '0')}.json`)
    fs.writeFileSync(p, `${JSON.stringify(targets.slice(i, i + SIZE), null, 1)}\n`)
  }
  console.info(`후보 보유 표제어 ${targets.length.toLocaleString()} · 청크 ${n} (size ${SIZE}) → ${DIR}/chunk-NN.json`)
  console.info('각 chunk-NN.json 을 읽고 파생어만 골라 chunk-NN.out.json 으로 저장할 것.')
  console.info('형식: [{ "word": "...", "derived": ["...", ...] }]  — 파생어가 없으면 그 낱말은 빼거나 derived: []')
}

if (MODE === 'status' || MODE === 'apply') {
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => /^chunk-\d+\.json$/.test(f)) : []
  const outs = files.filter((f) => fs.existsSync(path.join(DIR, f.replace('.json', '.out.json'))))
  console.info(`청크 ${files.length} · 채워진 것 ${outs.length} · 남음 ${files.length - outs.length}`)

  if (MODE === 'apply') {
    let ok = 0, rejected = 0, empty = 0
    const patches = []
    for (const f of outs) {
      const src = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
      const out = JSON.parse(fs.readFileSync(path.join(DIR, f.replace('.json', '.out.json')), 'utf8'))
      const allowed = new Map(src.map((s) => [s.word, new Set(s.candidates)]))
      for (const o of out) {
        const cands = allowed.get(o.word)
        if (!cands) { rejected += 1; continue } // 후보 목록에 없는 표제어 — 지어낸 값
        const derived = [...new Set(o.derived ?? [])].filter((x) => cands.has(x)).sort().slice(0, CAP)
        if (derived.length === 0) { empty += 1; continue } // 빈 값은 넣지 않는다
        if ((o.derived ?? []).some((x) => !cands.has(x))) rejected += 1
        patches.push({ word: o.word, derived })
        ok += 1
      }
    }
    console.info(`채택 ${ok} · 파생어 없음(건너뜀) ${empty} · 후보 밖 값 거부 ${rejected}`)
    for (const p of patches.slice(0, 10)) console.info(`  ${p.word.padEnd(18)} → ${p.derived.join(' / ')}`)

    if (COMMIT && patches.length > 0) {
      let written = 0
      for (let i = 0; i < patches.length; i += 40) {
        const batch = patches.slice(i, i + 40)
        await Promise.all(batch.map(async (p) => {
          const { data } = await withRetry('read prov', () =>
            supabase.from('shared_dictionary').select('field_provenance').eq('word', p.word).maybeSingle())
          const prov = { ...(data?.field_provenance ?? {}), derived_forms: 'adjudicated' }
          await withRetry('update', () =>
            supabase.from('shared_dictionary')
              .update({ derived_forms: p.derived, field_provenance: prov })
              .eq('word', p.word))
        }))
        written += batch.length
      }
      console.info(`  기록함 ${written}`)
    } else if (!COMMIT) {
      console.info('  드라이런 — --commit 으로 실제 기록')
    }
  }
}

if (!['export', 'apply', 'status'].includes(MODE)) {
  console.error('MODE 필요: export | apply | status')
  process.exit(1)
}

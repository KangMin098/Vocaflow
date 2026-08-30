// scripts/vocab/example-ko-drain-import.mjs
//
// **예문 번역 드레인 ③/③ — 채운 청크를 DB 에 적재한다.**
//
// ── 반드시 지키는 것 (CLAUDE.md §🤖) ────────────────────────────────
//
// ① **빈 값·너무 짧은 값을 넣지 않는다.** 빈 값이 들어가면 다음 export 가 그 뜻을 "완료" 로
//    세어 **구멍이 영영 남는다.** 건너뛴 수를 반드시 출력한다.
//
// ② **jsonb 를 통째로 덮지 않는다.** `senses` 를 읽어 그 뜻의 `examples_ko` **키 하나만**
//    더한다. 통째로 쓰면 `sense_ko`·`v_level`·`register` 가 날아간다.
//
// ③ **길이가 맞아야 넣는다.** `examples_ko` 는 `examples` 와 같은 길이여야 인덱스로 짝이
//    맞는다. 하나라도 모자라면 그 뜻은 건너뛴다 — 어긋난 짝은 틀린 번역보다 나쁘다
//    (학습자가 다른 문장의 번역을 읽게 된다).
//
// ④ **읽은 뒤 쓰기까지 사이에 낱말이 바뀌었으면 건너뛴다.** 여러 세션이 같은 DB 를 쓰므로,
//    내가 읽은 `examples` 와 지금 DB 의 `examples` 가 다르면 짝이 어긋난 것이다.
//
// 기본은 **드라이런**이다. 실제로 쓰려면 `--commit`.
//
// 실행:
//   node scripts/vocab/example-ko-drain-import.mjs            (드라이런 — 무엇이 들어갈지만)
//   node scripts/vocab/example-ko-drain-import.mjs --commit

import fs from 'node:fs'
import path from 'node:path'

import { exampleTexts } from './_example-shape.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')

const COMMIT = process.argv.includes('--commit')
const DIR = path.resolve('scripts/vocab/example-ko-drain')

/** 이보다 짧으면 번역으로 보지 않는다. 한국어 한 문장의 하한. */
const MIN_KO_CHARS = 4

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

if (!fs.existsSync(DIR)) {
  console.error(`청크 디렉터리가 없다: ${DIR}\n먼저 export 를 돌릴 것.`)
  process.exit(1)
}
const outFiles = fs.readdirSync(DIR).filter((f) => f.endsWith('.out.json')).sort()
if (outFiles.length === 0) {
  console.error('채워진 청크(*.out.json)가 없다.')
  process.exit(1)
}

const stats = { items: 0, ok: 0, skipEmpty: 0, skipLen: 0, skipDrift: 0, skipMissing: 0, wrote: 0 }
/** 한 낱말의 여러 뜻을 모아 **한 번에** 쓴다 — 뜻마다 쓰면 마지막 것만 남는다. */
const byWord = new Map()

for (const f of outFiles) {
  const payload = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
  for (const item of payload.items ?? []) {
    stats.items += 1
    const ex = Array.isArray(item.examples) ? item.examples : []
    const ko = Array.isArray(item.examples_ko) ? item.examples_ko : []

    const clean = ko.map((s) => (typeof s === 'string' ? s.trim() : ''))
    if (clean.length === 0 || clean.every((s) => s.length === 0)) {
      stats.skipEmpty += 1
      continue
    }
    if (clean.length !== ex.length || clean.some((s) => s.length < MIN_KO_CHARS)) {
      stats.skipLen += 1
      continue
    }

    // 대표 예문(`example_ko` 컬럼)은 문장이 하나뿐이다. 여럿이면 어느 것의 번역인지 모른다.
    const target = item.target === 'top' ? 'top' : 'sense'
    if (target === 'top' && clean.length !== 1) {
      stats.skipLen += 1
      continue
    }

    if (!byWord.has(item.word)) byWord.set(item.word, [])
    byWord.get(item.word).push({
      target,
      sense_idx: item.sense_idx,
      examples: ex,
      examples_ko: clean,
    })
    stats.ok += 1
  }
}

console.log(`청크 ${outFiles.length}개 · 항목 ${stats.items} · 적재 후보 ${stats.ok}`)
console.log(`  건너뜀 — 빈 값 ${stats.skipEmpty} · 길이 불일치/너무 짧음 ${stats.skipLen}`)

const words = [...byWord.keys()]
for (let i = 0; i < words.length; i += 200) {
  const batch = words.slice(i, i + 200)
  const { data, error } = await supabase
    .from('shared_dictionary')
    .select('word, senses, example_en')
    .in('word', batch)
  if (error) throw new Error(`읽기 실패: ${error.message}`)

  const current = new Map(data.map((r) => [r.word, r]))

  for (const word of batch) {
    const row = current.get(word)
    if (!row) {
      stats.skipMissing += (byWord.get(word) ?? []).length
      continue
    }
    const senses = Array.isArray(row.senses) ? row.senses : []
    let touched = 0
    let topKo = null

    for (const patch of byWord.get(word) ?? []) {
      if (patch.target === 'top') {
        // ④ 대표 예문도 읽은 뒤 바뀌었는지 본다 — 문장이 다르면 짝이 어긋난 것이다.
        const nowTop = typeof row.example_en === 'string' ? row.example_en.trim() : ''
        if (nowTop !== patch.examples[0]) {
          stats.skipDrift += 1
          continue
        }
        topKo = patch.examples_ko[0]
        touched += 1
        continue
      }

      const idx = senses.findIndex((se, n) =>
        (typeof se.sense_idx === 'number' ? se.sense_idx : n) === patch.sense_idx)
      if (idx < 0) {
        stats.skipDrift += 1
        continue
      }
      // ④ 내가 읽은 예문과 지금 DB 의 예문이 다르면 짝이 어긋난 것이다.
      //    ⚠️ **모양이 아니라 문장으로 견준다** — `examples` 원소가 문자열이기도 하고
      //    `{ en: '…' }` 객체이기도 하다(실측 89/5,205). 원소를 그대로 비교하면
      //    객체인 것은 언제나 "바뀌었다" 로 잡혀 영영 적재되지 않는다.
      const nowEx = exampleTexts(senses[idx].examples)
      if (nowEx.length !== patch.examples.length
        || nowEx.some((s, k) => s !== patch.examples[k])) {
        stats.skipDrift += 1
        continue
      }
      // ② 키 **하나만** 더한다 — 뜻 객체를 통째로 바꾸지 않는다.
      senses[idx] = { ...senses[idx], examples_ko: patch.examples_ko }
      touched += 1
    }

    if (touched === 0) continue
    if (COMMIT) {
      // 한 낱말의 뜻별 번역과 대표 예문 번역을 **한 번에** 쓴다 — 두 번 쓰면 뒤엣것이
      // 앞엣것의 `senses` 를 덮어쓸 수 있다.
      const patchRow = topKo != null ? { senses, example_ko: topKo } : { senses }
      const { error: uErr } = await supabase
        .from('shared_dictionary')
        .update(patchRow)
        .eq('word', word)
      if (uErr) throw new Error(`쓰기 실패(${word}): ${uErr.message}`)
    }
    stats.wrote += touched
  }
}

console.log(`  건너뜀 — 사전에 없는 낱말 ${stats.skipMissing} · 읽은 뒤 바뀜 ${stats.skipDrift}`)
console.log(COMMIT ? `적재 완료 — 뜻 ${stats.wrote}개에 번역을 더했다.` : `드라이런 — ${stats.wrote}개가 들어갈 예정. 실제 적재는 --commit.`)

/**
 * 적재를 마친 청크를 `done/` 으로 물린다.
 *
 * ⚠️ **이걸 안 하면 다음 export 가 덮어쓴 `chunk-00.json` 옆에 옛 `chunk-00.out.json` 이
 *   남는다.** 같은 번호인데 내용이 다른 두 파일이 나란히 있게 되고, 다음 사람이(또는
 *   다음 세션의 내가) 어느 쪽이 아직 안 들어간 몫인지 알 수 없다.
 *   번호는 export 가 매번 0 부터 다시 매기므로 **파일 이름으로는 구별되지 않는다.**
 *
 * 드라이런에서는 옮기지 않는다 — 아무것도 안 들어갔는데 몫을 치우면 안 된다.
 */
if (COMMIT && stats.wrote > 0) {
  const doneDir = path.join(DIR, 'done')
  fs.mkdirSync(doneDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  for (const f of outFiles) {
    fs.renameSync(path.join(DIR, f), path.join(doneDir, `${stamp}--${f}`))
  }
  console.log(`  적재한 청크 ${outFiles.length}개를 done/ 으로 옮겼다 — 다음 export 와 섞이지 않게.`)
}

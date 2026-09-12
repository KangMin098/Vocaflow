// scripts/dict/w0830-sensesync.mjs
// D0830-T1 — `senses` ↔ `meanings_ko` 어긋남 해소. **LLM 불필요 · 기계 배치.**
//
// 왜 필요한가:
//   학습자 화면(CardBack "품사별 뜻")은 `meanings_ko` 를 읽고, VCB 컴포저의 다의어 블루프린트
//   (B17 polysemy)는 `senses` 를 읽는다(resolve.ts `sense_count: senseCount(row.senses)`).
//   두 컬럼이 갈라져 있어서 **meanings_ko 로는 다의어인데 senses 로는 단의어**인 낱말이 8,184개다.
//   그중 2,101개가 top3k 빈도 구간이라, 컴포저가 `missing:senses_multi` 로 2,242건을 걸러
//   "다의어 정복" 세트가 모집단 부족으로 쪼그라들고 있었다(docs/reports/vcb-compose-eval.md).
//   즉 데이터는 이미 있는데 통로가 막혀 있었다.
//
// ⚠️ 덮어쓰기 금지 원칙:
//   기존 `senses` 항목이 들고 있는 `sense_en` · `register` · `examples` 는 meanings_ko 에 없다.
//   통째로 갈아엎으면 그 값이 날아간다. 그래서 **sense_ko 문자열로 매칭해 부가 키를 이월**하고,
//   `jsonb_array_length(meanings_ko) > jsonb_array_length(senses)` 인 행만 손댄다.
//   재실행 안전 — 두 번 돌려도 결과가 같다(이미 같은 길이면 대상에서 빠진다).
//
// 실행: node scripts/dict/w0830-sensesync.mjs plan
//       node scripts/dict/w0830-sensesync.mjs apply --commit
import { db } from './w0815-pubvocab.mjs'

const MODE = process.argv[2]
const COMMIT = process.argv.includes('--commit')
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const LIMIT = parseInt(arg('--limit', '100000'), 10)

const norm = (s) => (s ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ')

/** meanings_ko + 기존 senses → 새 senses. 부가 키는 sense_ko 매칭으로 이월. */
function buildSenses(meanings, oldSenses) {
  const prior = new Map()
  for (const s of oldSenses ?? []) {
    const k = norm(s?.sense_ko)
    if (k) prior.set(k, s)
  }
  const out = []
  let idx = 0
  for (const m of meanings) {
    const meaning = (m?.meaning ?? '').toString().trim()
    if (!meaning) continue
    const p = prior.get(norm(meaning)) ?? {}
    const examples = Array.isArray(p.examples) && p.examples.length ? p.examples : []
    const ex = (m?.example ?? '').toString().trim()
    if (ex && !examples.includes(ex)) examples.push(ex)
    out.push({
      sense_idx: idx++,
      sense_ko: meaning,
      sense_en: p.sense_en ?? null,
      pos: (m?.pos ?? p.pos ?? '').toString().trim() || null,
      register: p.register ?? 'neutral',
      examples,
      ...(m?.v_level != null ? { v_level: m.v_level } : {}),
    })
  }
  return out
}

async function targets() {
  const rows = []
  let cursor = ''
  for (;;) {
    const { data, error } = await db.from('shared_dictionary')
      .select('word, meanings_ko, senses, frequency_band, frequency_rank, list_tags')
      .gt('word', cursor).order('word').limit(1000)
    if (error) throw new Error(error.message)
    if (!data.length) break
    for (const r of data) {
      const mk = Array.isArray(r.meanings_ko) ? r.meanings_ko : []
      const sn = Array.isArray(r.senses) ? r.senses : []
      const valid = mk.filter((m) => (m?.meaning ?? '').toString().trim())
      if (valid.length < 2) continue
      if (valid.length <= sn.length) continue
      rows.push(r)
    }
    cursor = data[data.length - 1].word
    if (data.length < 1000) break
  }
  return rows
}

const rows = await targets()
const bands = {}
for (const r of rows) bands[r.frequency_band ?? '(none)'] = (bands[r.frequency_band ?? '(none)'] ?? 0) + 1
console.log(`대상: ${rows.length} 낱말 (meanings_ko 가 senses 보다 김)`)
console.log('빈도대별:', JSON.stringify(bands))
console.log('예시:', rows.slice(0, 8).map((r) => `${r.word}(${(r.senses ?? []).length}→${r.meanings_ko.length})`).join(' · '))

if (MODE === 'apply') {
  if (!COMMIT) { console.log('\n--commit 없음 — 쓰지 않았다.'); process.exit(0) }
  let ok = 0, skip = 0, fail = 0
  const slice = rows.slice(0, LIMIT)
  for (const r of slice) {
    const next = buildSenses(r.meanings_ko, r.senses)
    if (next.length < 2) { skip++; continue }
    const { error } = await db.from('shared_dictionary').update({ senses: next }).eq('word', r.word)
    if (error) { fail++; if (fail < 5) console.warn('fail', r.word, error.message) } else ok++
    if ((ok + skip + fail) % 500 === 0) console.log(`  ...${ok + skip + fail}/${slice.length}`)
  }
  console.log(`\n적용 ${ok} · 건너뜀(뜻 2개 미만) ${skip} · 실패 ${fail}`)
}

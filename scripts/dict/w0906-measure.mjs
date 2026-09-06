// scripts/dict/w0906-measure.mjs
//
// **사전 4칸 채움률을 전수로 잰다** — 드레인 진척을 말이 아니라 숫자로 확인하는 자.
//
// `w0906-fill.mjs apply` 가 찍는 「이미 있음」은 **드레인 대상 청크 안에서만** 센 값이라
// 전체 채움률이 아니다. 그 수를 진척으로 읽으면 과대평가한다 — 그래서 별도로 둔다.
//
// archived 행은 학습자에게 안 가므로 분모에서 뺀다(211행). ⚠️ `.eq('archived', false)`
// 를 서버에 보내면 인덱스가 없어 statement timeout 이 난다 — 받아서 여기서 거른다.
//
// 실행: node scripts/dict/w0906-measure.mjs
import { db } from './w0815-pubvocab.mjs'

async function retry(fn, tries = 8) {
  let last
  for (let i = 0; i < tries; i += 1) {
    let r
    try { r = await fn() } catch (e) { r = { error: e } }
    if (!r.error) return r
    last = r
    await new Promise((res) => setTimeout(res, Math.min(20_000, 700 * 2 ** i)))
  }
  return last
}

/** 페이지 250 — 1,000행은 16.5초가 걸려 자주 timeout 이 난다 */
async function allRows() {
  const out = []
  let cursor = ''
  for (;;) {
    const { data, error } = await retry(() =>
      db
        .from('shared_dictionary')
        .select('word, collocations, korean_learner_note, synonyms, ipa, archived')
        .gt('word', cursor)
        .order('word')
        .limit(250),
    )
    if (error) throw new Error(String(error.message ?? error))
    if (!data.length) break
    for (const r of data) if (!r.archived) out.push(r)
    cursor = data[data.length - 1].word
    process.stdout.write(`\r  훑음 ${out.length}`)
  }
  process.stdout.write('\n')
  return out
}

const has = {
  collocations: (r) => Array.isArray(r.collocations) && r.collocations.length > 0,
  korean_learner_note: (r) => !!r.korean_learner_note && r.korean_learner_note.trim().length > 5,
  synonyms: (r) => Array.isArray(r.synonyms) && r.synonyms.length > 0,
  ipa: (r) => !!r.ipa && !!r.ipa.trim(),
}

async function main() {
  const rows = await allRows()
  const n = rows.length
  console.log(`\n  분모 ${n} (archived 제외)\n`)
  for (const f of Object.keys(has)) {
    const k = rows.filter(has[f]).length
    console.log(`  ${f.padEnd(20)} ${String(k).padStart(6)} / ${n}  ${((k / n) * 100).toFixed(1)}%`)
  }
}
main()

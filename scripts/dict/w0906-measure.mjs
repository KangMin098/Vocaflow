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

/** 「비어 있지 않다」 — 결손 판정(`w0906-fill` missing)이 쓰는 느슨한 기준 */
const has = {
  collocations: (r) => Array.isArray(r.collocations) && r.collocations.length > 0,
  korean_learner_note: (r) => !!r.korean_learner_note && r.korean_learner_note.trim().length > 5,
  synonyms: (r) => Array.isArray(r.synonyms) && r.synonyms.length > 0,
  ipa: (r) => !!r.ipa && !!r.ipa.trim(),
}

/**
 * 「게이트를 통과할 값이다」 — 적재기(`w0906-fill` gate*)가 실제로 요구하는 기준.
 *
 * ⚠️ **두 기준이 어긋나 있었다.** 게이트는 유의어 2~5개를 요구해 1개짜리를 반려하는데
 * 결손 판정과 채움률은 `length > 0` 이라 1개짜리를 완료로 셌다. 그래서 유의어가 하나뿐인
 * 행은 **다시 안 잡히면서 채움률에는 들어간다** — 실측 2026-09-06: 68.3% 대 38.9%.
 * 그 차이(1개 7,997 · 6개 이상 6,430)를 숫자 하나로 감추지 않으려고 둘 다 찍는다.
 */
const strict = {
  collocations: (r) => Array.isArray(r.collocations) && r.collocations.length >= 2 && r.collocations.length <= 5,
  korean_learner_note: (r) => {
    const n = r.korean_learner_note
    return !!n && n.trim().length >= 12 && n.trim().length <= 160 && /[가-힣]/.test(n)
  },
  synonyms: (r) => Array.isArray(r.synonyms) && r.synonyms.length >= 2 && r.synonyms.length <= 5,
  ipa: (r) => !!r.ipa && !!r.ipa.trim() && !/[가-힣0-9[\]]/.test(r.ipa),
}

async function main() {
  const rows = await allRows()
  const n = rows.length
  console.log(`\n  분모 ${n} (archived 제외)\n`)
  console.log('  칸                     비어있지 않음        게이트 통과')
  console.log('  ' + '─'.repeat(56))
  for (const f of Object.keys(has)) {
    const loose = rows.filter(has[f]).length
    const tight = rows.filter(strict[f]).length
    const pct = (k) => `${((k / n) * 100).toFixed(1)}%`.padStart(6)
    console.log(
      `  ${f.padEnd(20)} ${String(loose).padStart(6)} ${pct(loose)}     ${String(tight).padStart(6)} ${pct(tight)}`,
    )
  }
  console.log('\n  왼쪽은 「칸이 찼는가」, 오른쪽은 「적재기가 지금 넣어도 통과할 값인가」다.')
}
main()

// scripts/dict/w0906-gap-shape.mjs
//
// **남은 결손이 어디에 쏠려 있는지 본다** — 빈도순 구간별로.
//
// ── 왜 ────────────────────────────────────────────────────────────────
// 채움률 한 숫자는 "학습자가 실제로 만나는 낱말이 채워졌는가" 를 말하지 않는다.
// 49,033개를 고르게 채운 73%와, 자주 쓰는 5,000개를 다 채운 73%는 학습자에게
// 완전히 다른 값이다. 앞선 세션에서 **지표는 올랐는데 학습자가 못 느끼는** 일이
// 실제로 있었고(결손이 저빈도 낱말에 몰려 있었다), 그래서 드레인 대상 순서를
// 「결손 많은 순 → 빈도순」으로 정했다. 그 정렬이 실제로 먹었는지 확인하는 자다.
//
// ⚠️ 이 스크립트는 **읽기만 한다.** 아무것도 고치지 않는다.
//
// 실행: node scripts/dict/w0906-gap-shape.mjs
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

async function allRows() {
  const out = []
  let cursor = ''
  for (;;) {
    const { data, error } = await retry(() =>
      db
        .from('shared_dictionary')
        .select('word, collocations, korean_learner_note, synonyms, ipa, frequency_rank, archived')
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
  colloc: (r) => Array.isArray(r.collocations) && r.collocations.length > 0,
  note: (r) => !!r.korean_learner_note && r.korean_learner_note.trim().length > 5,
  syn: (r) => Array.isArray(r.synonyms) && r.synonyms.length > 0,
  ipa: (r) => !!r.ipa && !!r.ipa.trim(),
}

/** 학습자가 실제로 만나는 순서대로 자른다 — 상위 구간일수록 도달 빈도가 높다 */
const BANDS = [
  ['     ~2,000', 0, 2000],
  ['2,000~5,000', 2000, 5000],
  ['5,000~1만', 5000, 10000],
  ['  1만~2만', 10000, 20000],
  ['  2만~3만', 20000, 30000],
  ['     3만~', 30000, Infinity],
  ['   빈도 없음', null, null],
]

async function main() {
  const rows = await allRows()
  console.log(`\n  분모 ${rows.length} (archived 제외)\n`)
  console.log('  빈도 구간        낱말    colloc    note     syn      ipa')
  console.log('  ' + '─'.repeat(62))
  for (const [label, lo, hi] of BANDS) {
    const band =
      lo === null
        ? rows.filter((r) => r.frequency_rank == null)
        : rows.filter((r) => r.frequency_rank != null && r.frequency_rank >= lo && r.frequency_rank < hi)
    if (!band.length) continue
    const pct = (f) => `${((band.filter(has[f]).length / band.length) * 100).toFixed(1)}%`.padStart(7)
    console.log(
      `  ${label.padEnd(12)} ${String(band.length).padStart(6)}  ${pct('colloc')}  ${pct('note')}  ${pct('syn')}  ${pct('ipa')}`,
    )
  }
  console.log(
    '\n  위 칸이 아래 칸보다 높아야 정렬이 먹은 것이다 — 학습자는 위 구간을 훨씬 자주 만난다.',
  )
}
main()

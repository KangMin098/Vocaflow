// scripts/dict/w0830-cefrj-reconcile.mjs
// D0830-T7 — `cefr_level` 을 CEFR-J Wordlist 와 화해시킨다. **LLM 불필요 · 기계 배치.**
//
// 무엇이 있었나:
//   `scripts/cefrj-import.mjs` 머리말이 스스로 적어 두었다 —
//     "사후 단계 (별도 SQL): UPDATE shared_dictionary FROM _staging_cefrj_wordlist"
//   그 사후 단계가 **실행된 적이 없다.** 권위 있는 밴드는 `cefrj_wordlist_band` 라는 옆 칸에
//   6,098행 들어와 앉아 있고, 학습자와 컴포저가 읽는 `cefr_level` 은 그것과 무관하게 남았다.
//
// 그래서 어떻게 됐나 (2026-08-30 실측, CEFR-J 근거가 있는 6,098 낱말 기준):
//   · 일치 2,236 (36.7%)
//   · **우리가 더 어렵게 매김 3,279 (53.8%)** — 방향이 한쪽으로 쏠려 있다
//   · 우리가 더 쉽게 매김 583 (9.6%)
//   실물: `chocolate`=B2 · `notebook`=B2 · `bath`=B2 · `temple`=C1 · `cop`=C1 · `sunny`=C1
//   (전부 CEFR-J A1). 그리고 이 행들의 `cefr_confidence` 는 **0.90** 이었다 —
//   확신 수치가 근거 없는 값에 붙어 있으면 없느니만 못하다.
//
//   사전 전체로는 C1+C2 가 **38,235행(78%)** 이다. 등급이 아니라 **쓰레기통**으로 쓰이고 있었다.
//
// 왜 CEFR-J 를 정본으로 삼나:
//   CEFR-J Wordlist 는 **아시아권 EFL 학습자**를 위해 만들어진 공개 표준 목록이고,
//   우리가 이미 v1.6 을 통째로 들여와 두었다. 우리 `cefr_level` 은 출처가 아예 없다
//   (`field_provenance` 에 `cefr_level` 키가 없다 — ipa·synonyms 는 있는데).
//   근거 있는 값과 근거 없는 값이 다투면 근거 있는 쪽이 이긴다.
//
// 손대지 않는 것:
//   `cefrj_wordlist_band` 가 **없는** 42,864행. 그쪽은 대조할 근거가 없다.
//   "C1/C2 78%" 라는 더 큰 문제는 여기서 풀지 않는다 — 근거를 먼저 구해야 한다.
//
// 가드: 바꾼 행에 `field_provenance.cefr_level = 'cefrj-wordlist-1.6'` 를 남긴다.
//   다음 배치가 이 값을 다시 추측하지 않게 하는 표식이고, 되돌릴 때의 손잡이다.
//   재실행 안전 — 두 번 돌리면 두 번째는 0건이다.
//
// 실행: node scripts/dict/w0830-cefrj-reconcile.mjs plan
//       node scripts/dict/w0830-cefrj-reconcile.mjs apply --commit
import { db } from './w0815-pubvocab.mjs'

const MODE = process.argv[2]
const COMMIT = process.argv.includes('--commit')
const ORDER = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 }

const rows = []
let cursor = ''
for (;;) {
  const { data, error } = await db.from('shared_dictionary')
    .select('word, cefr_level, cefrj_wordlist_band, cefr_confidence, field_provenance, frequency_rank')
    .not('cefrj_wordlist_band', 'is', null)
    .gt('word', cursor).order('word').limit(1000)
  if (error) { console.error(error.message); process.exit(1) }
  if (!data.length) break
  rows.push(...data)
  cursor = data[data.length - 1].word
  if (data.length < 1000) break
}

const diff = rows.filter((r) => r.cefr_level !== r.cefrj_wordlist_band)
const easier = diff.filter((r) => (ORDER[r.cefrj_wordlist_band] ?? 0) < (ORDER[r.cefr_level] ?? 0))
const harder = diff.filter((r) => (ORDER[r.cefrj_wordlist_band] ?? 0) > (ORDER[r.cefr_level] ?? 0))
const big = easier.filter((r) => (ORDER[r.cefr_level] ?? 0) - (ORDER[r.cefrj_wordlist_band] ?? 0) >= 2)

console.log(`CEFR-J 근거 보유 ${rows.length} · 불일치 ${diff.length} (${(100 * diff.length / rows.length).toFixed(1)}%)`)
console.log(`  우리가 더 어렵게 매김 ${easier.length} (그중 2단계 이상 ${big.length}) · 더 쉽게 매김 ${harder.length}`)
console.log('  2단계 이상 어긋난 예:', big.slice(0, 10).map((r) => `${r.word} ${r.cefr_level}→${r.cefrj_wordlist_band}`).join(' · '))

if (MODE === 'apply') {
  if (!COMMIT) { console.log('\n--commit 없음 — 쓰지 않았다.'); process.exit(0) }
  let ok = 0, fail = 0
  for (const r of diff) {
    const prov = { ...(r.field_provenance ?? {}), cefr_level: 'cefrj-wordlist-1.6' }
    const { error } = await db.from('shared_dictionary')
      .update({ cefr_level: r.cefrj_wordlist_band, cefr_confidence: 0.95, field_provenance: prov })
      .eq('word', r.word)
    if (error) { fail++; if (fail < 5) console.warn('fail', r.word, error.message) } else ok++
    if (ok % 500 === 0) console.log(`  ...${ok}/${diff.length}`)
  }
  console.log(`\n적용 ${ok} · 실패 ${fail}`)
}

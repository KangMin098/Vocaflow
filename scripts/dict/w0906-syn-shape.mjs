// scripts/dict/w0906-syn-shape.mjs
//
// **`synonyms` 배열의 길이 분포를 본다** — 「채워졌다」의 기준이 두 개인 것을 드러낸다.
//
// ── 왜 ────────────────────────────────────────────────────────────────
// 전수 검증(`w0906-verify`)에서 위반 15,891건 중 **14,427건이 `syn:개수`** 였다.
// 원인은 데이터가 아니라 **자가 어긋남**이다:
//
// | 곳 | 「채워졌다」의 뜻 |
// |---|---|
// | 드레인 게이트 (`w0906-fill` gateSynonyms) | **2~5개** — 1개는 반려 |
// | 결손 판정 (`missing.synonyms`) | `length > 0` — **1개도 완료** |
// | 채움률 측정 (`w0906-measure`) | `length > 0` — **1개도 완료** |
//
// 그래서 유의어가 1개뿐인 행은 **다시 안 잡히면서 채움률에는 들어간다.**
// 게이트가 반려할 값을 지표는 완료로 센다 — 그 차이만큼 채움률이 부풀어 있다.
//
// ⚠️ 그렇다고 1개짜리가 전부 결함인 것은 아니다. 진짜 유의어가 하나뿐인 낱말이 있고
//    (`hydrochloric` → `muriatic`), 그건 지어내지 않은 정직한 값이다. 그래서 이 자는
//    **판정하지 않고 분포만 보여준다** — 어느 쪽으로 고칠지는 별도 결정이다.
//
// 실행: node scripts/dict/w0906-syn-shape.mjs
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
      db.from('shared_dictionary').select('word, synonyms, frequency_rank, archived').gt('word', cursor).order('word').limit(250),
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

async function main() {
  const rows = await allRows()
  const n = rows.length
  const len = (r) => (Array.isArray(r.synonyms) ? r.synonyms.length : 0)

  const dist = new Map()
  for (const r of rows) {
    const k = Math.min(len(r), 9)
    dist.set(k, (dist.get(k) ?? 0) + 1)
  }
  console.log(`\n  분모 ${n} (archived 제외)\n`)
  console.log('  유의어 개수   행수      비율')
  console.log('  ' + '─'.repeat(34))
  for (let k = 0; k <= 9; k += 1) {
    const c = dist.get(k) ?? 0
    if (!c) continue
    const label = k === 9 ? '9개 이상' : `${k}개`
    console.log(`  ${label.padEnd(10)} ${String(c).padStart(7)}  ${((c / n) * 100).toFixed(1).padStart(6)}%`)
  }

  const one = rows.filter((r) => len(r) === 1)
  const over = rows.filter((r) => len(r) > 5)
  const ok = rows.filter((r) => len(r) >= 2 && len(r) <= 5)
  console.log('\n  ── 두 기준의 차이 ──')
  console.log(`  length > 0 (지표 기준)      ${String(n - (dist.get(0) ?? 0)).padStart(7)}  ${(((n - (dist.get(0) ?? 0)) / n) * 100).toFixed(1)}%`)
  console.log(`  2~5개 (게이트 기준)         ${String(ok.length).padStart(7)}  ${((ok.length / n) * 100).toFixed(1)}%`)
  console.log(`  → 부풀림 = 1개 ${one.length} + 6개 이상 ${over.length}`)

  // 1개짜리가 저빈도에 몰려 있으면 「진짜 유의어가 하나뿐」쪽 설명이 힘을 얻는다
  const band = (r) => (r.frequency_rank == null ? '없음' : r.frequency_rank < 10000 ? '1만 이내' : '1만 밖')
  const bandCount = new Map()
  for (const r of one) bandCount.set(band(r), (bandCount.get(band(r)) ?? 0) + 1)
  console.log('\n  1개짜리의 빈도 분포:')
  for (const [k, v] of bandCount) console.log(`    ${k.padEnd(8)} ${String(v).padStart(6)}`)
  console.log(`\n  표본(1개): ${one.slice(0, 8).map((r) => `${r.word}→${r.synonyms[0]}`).join(' · ')}`)
  console.log(`  표본(6+):  ${over.slice(0, 5).map((r) => `${r.word}(${r.synonyms.length})`).join(' · ')}`)
  console.log('\n  ⚠️ 읽기 전용이다 — 아무것도 고치지 않았다.')
}
main()

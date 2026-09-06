// scripts/dict/w0906-ceiling.mjs
//
// **네 칸의 실질 상한을 잰다** — "목표에 못 닿았다"와 "닿을 수 없다"는 다른 말이다.
//
// ── 왜 ────────────────────────────────────────────────────────────────
// 드레인 에이전트 여럿이 독립적으로 같은 보고를 했다: 어떤 표제어는 그 칸을
// **채우는 것이 불가능**하다. 지어내지 않으면 영원히 빈다. 그것을 세어 두지 않으면
// 남은 결손이 전부 "게으름" 으로 읽히고, 반대로 세어 두면 어디까지가 진짜 일인지 보인다.
//
// ── 구조적으로 못 채우는 것 ──────────────────────────────────────────
// **collocations** — 게이트가 「연어는 표제어 문자열을 그대로 포함해야 한다」를 강제한다.
//   표제어에 `/`·`(`·`)`·`,` 가 들어 있으면(`change your/somebody's mind`,
//   `(every) now and then`) 그 문자열을 담은 실재 결합이 존재할 수 없다.
//   또 표제어가 이미 5낱말이면 2~5낱말 상한 안에 표제어+α 가 안 들어간다.
//   ⚠️ 이건 데이터 결손이 아니라 **게이트의 정의**다. 게이트를 푸는 쪽이 더 나쁘다 —
//      표제어를 안 담은 문자열은 연어가 아니다.
//
// **ipa** — 철자 낭독형 약어(`cfc`·`cjd`)와 슬래시 변이형은 단일 발음기호가 성립하지 않는다.
//
// **synonyms** — 여기는 문자열로 못 가른다. 상위어만 있고 진짜 유의어가 없는 희소
//   전문어(`mesophyll`·`chromite`)가 원인인데 그건 표제어 모양으로 판별되지 않는다.
//   그래서 이 스크립트는 synonyms 의 상한을 **주장하지 않는다** — 셀 수 있는 것만 센다.
//
// 실행: node scripts/dict/w0906-ceiling.mjs
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
        .select('word, collocations, ipa, archived')
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

/** 게이트가 요구하는 「표제어 문자열 그대로 포함」을 만족시킬 수 있는 표제어인가 */
function collocationPossible(word) {
  const w = word.trim()
  // 슬래시·괄호·쉼표가 든 표제어는 그 문자열을 담은 실재 결합이 없다
  if (/[/(),]/.test(w)) return false
  // 연어는 2~5낱말인데 표제어가 이미 5낱말이면 표제어+α 가 안 들어간다
  if (w.split(/\s+/).length >= 5) return false
  return true
}

/** 단일 발음기호가 성립하는 표제어인가 */
function ipaPossible(word) {
  const w = word.trim()
  if (/[/(),]/.test(w)) return false // 슬래시 변이형
  // 모음 없는 3자 이하 = 철자 낭독형 약어(cfc·cjd·cgi). 모음이 있으면 낱말로 읽힌다
  if (w.length <= 3 && !/[aeiouy]/i.test(w)) return false
  return true
}

async function main() {
  const rows = await allRows()
  const n = rows.length
  console.log(`\n  분모 ${n} (archived 제외)\n`)

  const noColloc = rows.filter((r) => !Array.isArray(r.collocations) || r.collocations.length === 0)
  const collocBlocked = noColloc.filter((r) => !collocationPossible(r.word))
  const collocCeiling = ((n - collocBlocked.length) / n) * 100

  const noIpa = rows.filter((r) => !r.ipa || !r.ipa.trim())
  const ipaBlocked = noIpa.filter((r) => !ipaPossible(r.word))
  const ipaCeiling = ((n - ipaBlocked.length) / n) * 100

  console.log(`  collocations 결손 ${noColloc.length}`)
  console.log(`    그중 게이트상 채울 수 없음 ${collocBlocked.length} — 실질 상한 ${collocCeiling.toFixed(1)}%`)
  console.log(`    표본: ${collocBlocked.slice(0, 6).map((r) => r.word).join(' · ')}`)
  console.log(`\n  ipa 결손 ${noIpa.length}`)
  console.log(`    그중 단일 발음기호 불성립 ${ipaBlocked.length} — 실질 상한 ${ipaCeiling.toFixed(1)}%`)
  console.log(`    표본: ${ipaBlocked.slice(0, 6).map((r) => r.word).join(' · ')}`)
  console.log('\n  ⚠️ synonyms 는 표제어 모양으로 판별되지 않아 여기서 상한을 주장하지 않는다.')
}
main()

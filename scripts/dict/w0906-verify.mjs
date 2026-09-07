// scripts/dict/w0906-verify.mjs
//
// **DB 에 실제로 들어간 값이 게이트 규칙을 지키는지 되짚는다.**
//
// ── 왜 ────────────────────────────────────────────────────────────────
// 드레인은 채움률만 보고해 왔다. 그런데 채움률은 **칸이 비었는지**만 말하지
// **무엇이 들어갔는지**는 말하지 않는다. 적재기의 게이트가 통과시킨 값이라도
// ① 게이트에 없던 규칙(중복·자기참조·표제어 단독)을 어겼거나
// ② 적재 뒤 다른 경로가 덮어썼을 수 있다.
// 「들어갔을 것」은 들어간 것이 아니다 — 읽어서 확인한다.
//
// ⚠️ **읽기만 한다.** 위반을 찾아도 고치지 않는다 — 고치는 것은 별도 결정이다.
//    (같은 턴에 재면서 고치면 측정이 오염된다.)
//
// ── 검사 항목 ────────────────────────────────────────────────────────
// collocations  2~5개 · 각 2~5낱말 · 표제어 문자열 포함 · 표제어 단독 금지 ·
//               중복 금지 · 영문/공백/하이픈/아포스트로피만
// synonyms      2~5개 · 각 3낱말 이하 · 자기 자신 금지 · 중복 금지
// note          12~160자 · 한글 포함 · meaning_ko 되풀이 금지
// ipa           슬래시·대괄호·한글·숫자 금지 · IPA 전용 기호 1개 이상
//               (조립본 `w0906-ipa-compose` 는 일부러 `/…/` 로 감싸므로 예외)
//
// 실행: node scripts/dict/w0906-verify.mjs
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
        .select('word, meaning_ko, collocations, korean_learner_note, synonyms, ipa, archived')
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

const norm = (s) => String(s).toLowerCase().trim()
/** 게이트와 같은 판정 — 표제어 또는 끝 글자 하나 뗀 어간이 문자열에 들어 있는가 */
function holdsWord(phrase, word) {
  const p = norm(phrase)
  const w = norm(word)
  return p.includes(w) || (w.length > 3 && p.includes(w.slice(0, -1)))
}

const bad = []
const note = (word, kind, detail) => bad.push({ word, kind, detail })

function checkColloc(r) {
  const c = r.collocations
  if (!Array.isArray(c) || c.length === 0) return
  if (c.length < 2) note(r.word, 'colloc:개수', `${c.length}개`)
  if (c.length > 5) note(r.word, 'colloc:개수', `${c.length}개`)
  if (new Set(c.map(norm)).size !== c.length) note(r.word, 'colloc:중복', c.join(' | '))
  for (const x of c) {
    if (typeof x !== 'string') { note(r.word, 'colloc:타입', String(x)); continue }
    const n = x.trim().split(/\s+/).length
    if (n < 2 || n > 5) note(r.word, 'colloc:길이', x)
    if (!holdsWord(x, r.word)) note(r.word, 'colloc:표제어없음', x)
    if (norm(x) === norm(r.word)) note(r.word, 'colloc:표제어단독', x)
    if (!/^[A-Za-z' -]+$/.test(x)) note(r.word, 'colloc:문자', x)
  }
}

function checkSyn(r) {
  const y = r.synonyms
  if (!Array.isArray(y) || y.length === 0) return
  if (y.length < 2) note(r.word, 'syn:개수', `${y.length}개`)
  if (y.length > 5) note(r.word, 'syn:개수', `${y.length}개`)
  if (new Set(y.map(norm)).size !== y.length) note(r.word, 'syn:중복', y.join(' | '))
  for (const x of y) {
    if (typeof x !== 'string') { note(r.word, 'syn:타입', String(x)); continue }
    if (norm(x) === norm(r.word)) note(r.word, 'syn:자기자신', x)
    if (x.trim().split(/\s+/).length > 3) note(r.word, 'syn:길이', x)
  }
}

function checkNote(r) {
  const n = r.korean_learner_note
  if (!n || !n.trim()) return
  if (n.length < 12 || n.length > 160) note(r.word, 'note:길이', `${n.length}자`)
  if (!/[가-힣]/.test(n)) note(r.word, 'note:한글없음', n.slice(0, 40))
  const m = String(r.meaning_ko ?? '').replace(/\s+/g, '')
  if (m && n.replace(/\s+/g, '').includes(m) && n.length < m.length + 20) {
    note(r.word, 'note:뜻되풀이', n.slice(0, 40))
  }
}

function checkIpa(r) {
  const p = r.ipa
  if (!p || !p.trim()) return
  if (/[가-힣0-9]/.test(p)) note(r.word, 'ipa:한글숫자', p)
  if (/\[/.test(p)) note(r.word, 'ipa:대괄호', p)
  // 조립본은 `/…/` 로 감싼다(w0906-ipa-compose). 안쪽에 또 슬래시가 있으면 잘못이다
  const inner = p.replace(/^\/+|\/+$/g, '')
  if (inner.includes('/')) note(r.word, 'ipa:내부슬래시', p)
  if (!/[ˈˌəɪʊɛæɑɔʌʃʒθðŋɹɜː]/.test(p)) note(r.word, 'ipa:기호없음', p)
}

async function main() {
  const rows = await allRows()
  console.log(`\n  검사 대상 ${rows.length} (archived 제외)\n`)
  for (const r of rows) {
    checkColloc(r)
    checkSyn(r)
    checkNote(r)
    checkIpa(r)
  }
  const byKind = new Map()
  for (const b of bad) byKind.set(b.kind, (byKind.get(b.kind) ?? 0) + 1)
  if (!bad.length) {
    console.log('  위반 0 — 적재된 값이 게이트 규칙을 전부 지킨다.')
    return
  }
  console.log(`  위반 ${bad.length}건\n`)
  for (const [k, n] of [...byKind].sort((a, b) => b[1] - a[1])) {
    const ex = bad.filter((b) => b.kind === k).slice(0, 3)
    console.log(`  ${k.padEnd(20)} ${String(n).padStart(6)}`)
    for (const e of ex) console.log(`      ${e.word} → ${e.detail}`)
  }
  console.log('\n  ⚠️ 읽기 전용이다 — 아무것도 고치지 않았다.')
}
main()

// scripts/dict/w0906-ipa-compose.mjs
//
// **다어절 표제어의 발음을 부분에서 조립한다** — 지어내지 않고, LLM 없이.
//
// ── 왜 ────────────────────────────────────────────────────────────────
// `ipa` 결손 10,714 중 **5,370(50.1%)이 다어절·관용구·약어**다. 에이전트에 맡기면
// 「모르면 비운다」 규칙에 따라 대부분 비워서 돌려준다(파일럿 실측: ipa 110/250 = 44%).
// 그게 옳은 판단이다 — 지어낸 발음은 학습자를 반대로 훈련시킨다.
//
// 그런데 `airplane mode` 의 발음은 **이미 사전 안에 있다** — `airplane` 과 `mode` 의
// 발음을 이어 붙이면 된다. 새로 만드는 것이 아니라 **가지고 있던 값을 옮겨 적는 것**이라
// 이 세션의 `pronunciation ← ipa` 백필과 같은 성격이고, 같은 이유로 안전하다.
//
// 실측 2026-09-06: 다어절 결손 4,648개 중 **3,969개(85.4%)** 는 모든 부분이 사전에 있고
// 그 부분들이 전부 ipa 를 갖고 있다.
//
// ── 조립 규칙 ────────────────────────────────────────────────────────
// 부분 발음을 공백으로 잇는다. 그 이상 손대지 않는다 — 연음·강세 재배치는 음운론이지
// 문자열 조작이 아니고, 어설프게 건드리면 틀린 발음을 만든다.
//   `airplane mode` → `ˈeərpleɪn moʊd`
//
// ⚠️ **부분이 하나라도 비면 통째로 건너뛴다.** 반쪽 발음은 없는 것보다 나쁘다 —
//    학습자가 그 부분만 읽고 나머지를 자기 식으로 채운다.
// ⚠️ 이미 `ipa` 가 있는 행은 **건드리지 않는다.** 덮어쓰기 경로가 없다.
//
// 실행:
//   node scripts/dict/w0906-ipa-compose.mjs            (미리보기)
//   node scripts/dict/w0906-ipa-compose.mjs --commit
import { db } from './w0815-pubvocab.mjs'

const COMMIT = process.argv.includes('--commit')

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

/** 페이지 250 — 1,000행은 16.5초가 걸려 자주 timeout 이 난다(같은 폴더 w0906-fill 주석) */
async function allRows() {
  const out = []
  let cursor = ''
  for (;;) {
    const { data, error } = await retry(() =>
      db.from('shared_dictionary').select('word, ipa, archived').gt('word', cursor).order('word').limit(250),
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

/**
 * **동철이음어(heteronym) — 철자가 같고 발음이 다른 낱말.**
 *
 * 조립의 유일한 진짜 위험이다. 사전은 표제어 하나에 발음 하나만 들고 있으므로,
 * 그 낱말이 두 발음을 가지면 **조립이 절반의 확률로 틀린다.**
 *
 * 실측 2026-09-06 — 미리보기에서 바로 걸렸다:
 *   `a following wind` → `/wˈaɪnd/`  (시계를 감는 wind. 바람은 /wɪnd/ 다)
 *
 * 이런 낱말이 하나라도 들어 있으면 **그 표제어는 통째로 건너뛴다.** 반쯤 맞는 발음을
 * 넣는 것보다 비워 두는 편이 낫다 — 비어 있으면 화면이 그 줄을 안 그리지만,
 * 틀리면 학습자가 그것을 외운다.
 */
const HETERONYMS = new Set([
  'wind', 'read', 'lead', 'live', 'bow', 'tear', 'close', 'record', 'use', 'present',
  'object', 'subject', 'contract', 'conduct', 'content', 'desert', 'produce', 'project',
  'refuse', 'permit', 'progress', 'protest', 'rebel', 'convert', 'console', 'increase',
  'decrease', 'insult', 'suspect', 'address', 'attribute', 'combine', 'compound', 'digest',
  'entrance', 'escort', 'excuse', 'export', 'import', 'invalid', 'minute', 'moderate',
  'perfect', 'polish', 'primer', 'putting', 'resume', 'row', 'sewer', 'sow', 'separate',
  'number', 'wound', 'bass', 'buffet', 'dove', 'does', 'axes', 'close', 'appropriate',
  'associate', 'delegate', 'duplicate', 'elaborate', 'estimate', 'graduate', 'intimate',
  'alternate', 'animate', 'articulate', 'deliberate', 'advocate', 'aggregate', 'approximate',
])

async function main() {
  const rows = await allRows()
  const ipaOf = new Map()
  for (const r of rows) if (r.ipa && r.ipa.trim()) ipaOf.set(r.word.toLowerCase(), r.ipa.trim())

  const updates = []
  const skipped = { partMissing: 0, notPlainMultiword: 0, heteronym: 0 }
  for (const r of rows) {
    if (r.ipa && r.ipa.trim()) continue
    const w = r.word.trim()
    // 순수 다어절만 — 괄호·슬래시·생략부호가 든 관용구는 조립 대상이 아니다
    if (!/^[a-zA-Z]+( [a-zA-Z]+)+$/.test(w)) { skipped.notPlainMultiword += 1; continue }
    const parts = w.toLowerCase().split(' ')
    if (parts.some((p) => HETERONYMS.has(p))) { skipped.heteronym += 1; continue }
    const got = parts.map((p) => ipaOf.get(p))
    if (got.some((g) => !g)) { skipped.partMissing += 1; continue }
    // 부분마다 붙어 있는 슬래시를 떼고 **한 번만** 감싼다 — 안 그러면 `/ə/ /bˈoʊn/` 이 된다
    const body = got.map((g) => g.replace(/^\/+|\/+$/g, '').trim()).filter(Boolean).join(' ')
    if (!body) { skipped.partMissing += 1; continue }
    updates.push({ word: r.word, ipa: `/${body}/` })
  }

  console.log(`\n  전체 ${rows.length} · ipa 결손 ${rows.filter((r) => !r.ipa || !r.ipa.trim()).length}`)
  console.log(`  조립 가능 ${updates.length}`)
  console.log(`  건너뜀 — 부분 발음 없음 ${skipped.partMissing} · 동철이음어 포함 ${skipped.heteronym} · 순수 다어절 아님 ${skipped.notPlainMultiword}`)
  console.log('\n  ── 표본 ──')
  for (const u of updates.slice(0, 10)) console.log(`    ${u.word.padEnd(26)} ${u.ipa}`)

  if (!COMMIT) {
    console.log('\n  미리보기다 — 아무것도 쓰지 않았다. 반영하려면 --commit')
    return
  }
  let done = 0
  for (let i = 0; i < updates.length; i += 4) {
    await Promise.all(updates.slice(i, i + 4).map(async (u) => {
      const { error } = await retry(() => db.from('shared_dictionary').update({ ipa: u.ipa }).eq('word', u.word))
      if (error) throw new Error(`${u.word}: ${String(error.message ?? error)}`)
      done += 1
    }))
    process.stdout.write(`\r  반영 ${done}/${updates.length}`)
  }
  console.log('\n→ 반영 완료')
}
main()

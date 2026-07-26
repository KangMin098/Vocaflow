// scripts/dict/dict-selfheal-gate.mjs
// 3R-Ⓒ 온디맨드 자기치유 게이트 (오프라인 검수) — 잔여 not_found 中 "진짜 희귀·전문 실단어"만
// Wiktionary(영어 섹션 + register 게이트)로 정확히 해소해 KO 글로스 후보 생성.
// 게이트/번역 로직은 dict-selfheal-core.mjs 공유(자동 배선 dict-selfheal-drain.mjs 와 동일).
// 이 스크립트는 후보 JSONL 만 만들고 DB 적재는 안 함(검수 후 dict-selfheal-load.mjs 로 적재).
//
// 입력: scratchpad-foreign/nf.json  [{w,occ,b}]  (잔여 not_found)
// 게이트 임계: MINOCC(기본3) · MINBOOKS(기본2) — (occ>=MINOCC OR b>=MINBOOKS)
// 실행: node scripts/dict/dict-selfheal-gate.mjs
// 출력: scratchpad-foreign/selfheal-candidates.jsonl + 요약
import fs from 'node:fs'
import { FRAGMENTS, resolveGloss, translateKo, sleep } from './dict-selfheal-core.mjs'

const MINOCC = parseInt(process.env.MINOCC || '3')
const MINBOOKS = parseInt(process.env.MINBOOKS || '2')

const nf = JSON.parse(fs.readFileSync('scratchpad-foreign/nf.json', 'utf8'))
let cands = nf.filter(x => (x.occ >= MINOCC || x.b >= MINBOOKS) && !FRAGMENTS.has(x.w) && /^[a-z]{3,}$/.test(x.w))
console.error(`게이트 후보: ${cands.length} (occ>=${MINOCC} OR books>=${MINBOOKS}, 파편/단문 제외)`)

const out = fs.createWriteStream('scratchpad-foreign/selfheal-candidates.jsonl')
const tally = { ok: 0, 'no-en': 0, 'reject-dialect': 0, 'reject-tag': 0, 'no-def': 0, thin: 0, notrans: 0 }
let done = 0
for (const c of cands) {
  const r = await resolveGloss(c.w)
  let ko = null
  if (r.en) { ko = await translateKo(r.en); if (!ko) tally.notrans++ }
  const status = r.en ? 'ok' : r.status.split('→')[0]
  tally[status] = (tally[status] || 0) + 1
  if (r.en && ko) out.write(JSON.stringify({ w: c.w, occ: c.occ, b: c.b, en: r.en, ko, via: r.status, base: r.base || null, dialect: !!r.dialect }) + '\n')
  if (++done % 40 === 0) console.error(`  ${done}/${cands.length} · ok=${tally.ok}`)
  await sleep(120)
}
out.end()
console.error('\n=== 게이트 결과 ===')
console.error(JSON.stringify(tally, null, 0))
const accepted = fs.readFileSync('scratchpad-foreign/selfheal-candidates.jsonl', 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
const pure = accepted.filter(x => !x.dialect), dial = accepted.filter(x => x.dialect)
const occ = a => a.reduce((s, x) => s + x.occ, 0)
console.error(`\n통과 총 ${accepted.length} lemma / ${occ(accepted)} occ`)
console.error(`  · 순수 전문·희귀어: ${pure.length} / ${occ(pure)} occ`)
console.error(`  · 방언·구어(register 태그): ${dial.length} / ${occ(dial)} occ`)
console.error('\n순수 예시:')
for (const a of pure.sort((x, y) => y.occ - x.occ).slice(0, 30)) console.error(`  ${a.w}(${a.occ}) → ${a.ko}  [${a.en.slice(0, 55)}]`)

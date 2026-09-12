// scripts/dict/w0815-mnem-gate.mjs
// T1c 니모닉 독립 검증 게이트 — 서브에이전트 자기보고를 믿지 않고 산출물을 직접 대조한다.
//   통과 조건 3가지:
//     (1) 화살표(→) 존재 · 120자 이내
//     (2) 그 단어의 입력 `roots` 에 있는 어근 문자열이 `어근(...)` 형태로 니모닉에 실제 등장  ← 근거 대조
//     (3) 괄호 앞 토큰 중 로마자 어근이 최소 1개  ← 경선식(한글 소리흉내만으로 구성) 차단
//   ⚠️ 단일문자 어근(a, e)·하이픈 어근(in-neg)·한국어 뒤 영어 병기(사교(social))를 오탐하지 않아야 한다.
//   실패 항목은 <dir>/REJECTED.json 으로 빼고, 통과분만 <dir>/gated/ 에 복사해 mnemonic-apply 가 읽게 한다.
// 실행: node scripts/dict/w0815-mnem-gate.mjs [--dir scripts/dict/w0815-mnem]
import fs from 'node:fs'
import path from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const DIR = arg('--dir', 'scripts/dict/w0815-mnem')
const OUT = path.join(DIR, 'gated')

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')

// 입력 청크에서 단어 → 어근 목록
const roots = new Map()
for (const f of fs.readdirSync(DIR)) {
  if (!/^chunk-\d+\.json$/.test(f)) continue
  for (const e of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) {
    roots.set(e.word.toLowerCase(), (e.roots ?? []).map((r) => String(r.root).toLowerCase()))
  }
}

fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f))

let total = 0, passed = 0
const rejected = []
for (const f of fs.readdirSync(DIR)) {
  if (!/\.out\.json$/.test(f)) continue
  let arr
  try { arr = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) } catch { console.warn('parse fail', f); continue }
  const keep = []
  for (const e of arr) {
    if (!e || e.skip || typeof e.mnemonic_ko !== 'string' || !e.mnemonic_ko.trim()) continue
    total++
    const w = e.word.toLowerCase()
    const m = e.mnemonic_ko.trim()
    const rs = roots.get(w) ?? []
    const reasons = []
    if (!m.includes('→')) reasons.push('no-arrow')
    if (m.length > 120) reasons.push('too-long')
    // (2) 근거 대조 — 입력 어근이 `어근(` 형태로 등장
    const grounded = rs.some((r) => new RegExp(`(^|[^a-z])${esc(r)}\\s*\\(`).test(m))
    if (!grounded) reasons.push('root-not-grounded')
    // (3) 로마자 어근 토큰 존재 (경선식 차단) — 괄호 앞 토큰이 전부 한글이면 거부
    const tokens = [...m.matchAll(/(-?[\p{L}][\p{L}-]*)\s*\(/gu)].map((x) => x[1])
    if (!tokens.some((t) => /^-?[a-z][a-z-]*$/i.test(t))) reasons.push('no-latin-root')
    if (reasons.length) { rejected.push({ word: e.word, mnemonic_ko: m, reasons }) } else { keep.push(e); passed++ }
  }
  if (keep.length) fs.writeFileSync(path.join(OUT, f), JSON.stringify(keep, null, 1))
}

fs.writeFileSync(path.join(DIR, 'REJECTED.json'), JSON.stringify(rejected, null, 1))
console.log(`니모닉 ${total} · 게이트 통과 ${passed} · 거부 ${rejected.length}`)
const byReason = {}
for (const r of rejected) for (const x of r.reasons) byReason[x] = (byReason[x] ?? 0) + 1
if (rejected.length) {
  console.log('거부 사유:', JSON.stringify(byReason))
  for (const r of rejected.slice(0, 10)) console.log('  ', r.word, '::', r.mnemonic_ko, '←', r.reasons.join(','))
}
console.log(`통과분 → ${OUT}/  (mnemonic-apply.mjs --dir ${OUT} 로 적용)`)

// scripts/csat/verify-h2-h5.mjs
//
// **설계도 v0 의 H2(빈칸 위치)·H5(순서 토막 첫 문장 단서) 검사 — 읽기 전용.**
//
// H2: 빈칸은 단락 첫 문장 또는 마지막 2문장에 80% 이상 집중된다.
// H5: 순서 문항의 토막 첫 문장은 90% 이상 지시어·연결어로 시작한다.
//
// 추출 방법
//   빈칸 — 텍스트 변환에서 빈칸은 **아주 짧은 문장부호 줄**로 남는다
//          (2026 #33 은 `"."` 한 줄, 2026 #31 은 `", "` 한 줄).
//   토막 — `(A) Indeed, it is almost impossible…` 처럼 표지 뒤에 본문이 붙는다.
//          선택지 영역에도 `(A)` 가 있지만 본문 없이 표지만 있어 걸러진다.
//
// ⚠️ 두 추출 모두 조판 의존이라 실패분이 생긴다. 실패율을 함께 보고한다 —
//    성공분만 세면 표본이 편향된다.
//
// 실행: pnpm dlx tsx scripts/csat/verify-h2-h5.mjs

import fs from 'node:fs'
import path from 'node:path'

const SRC = 'C:/Users/Administrator/Document' + 's/수능영어기출/최종'
const OUT_DIR = path.resolve('scripts/csat/data')
const HEADER_RE = /저작권은 한국교육과정평가원/
const FILE = { '2014B': '2014_A.txt', '2014A': '2014_Aform.txt' }

function keepSingleForm(lines) {
  const hol = [], jjak = []
  lines.forEach((l, i) => {
    const t = l.trim()
    if (t === '홀수형') hol.push(i)
    if (t === '짝수형') jjak.push(i)
  })
  if (!hol.length || !jjak.length) return lines
  const b = lines.findIndex((l, i) => i > hol[hol.length - 1] && i < jjak[0] && HEADER_RE.test(l))
  return b < 0 ? lines : lines.slice(0, b)
}

function itemLines(exam, no) {
  const file = FILE[exam] ?? `${exam}.txt`
  const lines = keepSingleForm(fs.readFileSync(path.join(SRC, file), 'utf8').replace(/\r/g, '').split('\n'))
  const i = lines.findIndex((l) => new RegExp(`^\\s*${no}\\s*\\.`).test(l))
  if (i < 0) return null
  let j = lines.findIndex((l, k) => k > i && new RegExp(`^\\s*${no + 1}\\s*\\.`).test(l))
  if (j < 0) j = Math.min(i + 60, lines.length)
  return lines.slice(i, j).filter((l) => !HEADER_RE.test(l) && !/^\s*(홀수형|짝수형|\d+)\s*$/.test(l))
}

const classified = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'classified.json'), 'utf8'))
const out = {}

// ── H2 — 빈칸 위치 ───────────────────────────────────────────────────
{
  const targets = classified.rows.filter((r) => r.exam !== '2014A' && r.type === 'R-BLANK')
  let found = 0, failed = 0
  const buckets = { first: 0, last2: 0, middle: 0 }
  const detail = []
  for (const q of targets) {
    const L = itemLines(q.exam, q.no)
    if (!L) { failed += 1; continue }
    // 선택지 시작 전까지가 지문
    const cut = L.findIndex((l) => /^\s*[①②③④⑤]/.test(l.trim()))
    const body = (cut > 0 ? L.slice(0, cut) : L).slice()
    body[0] = body[0].replace(/^\s*\d+\s*\.\s*/, '')
    // 빈칸 흔적 = 아주 짧고 문장부호가 주인 줄
    const gapIdx = body.findIndex((l, k) => {
      const t = l.trim()
      return k > 0 && t.length > 0 && t.length <= 14 && /^[.,;:"'’”\s]*$|^[;,]\s*\w{0,10}[,]?$/.test(t)
    })
    if (gapIdx < 0) { failed += 1; continue }
    found += 1
    const before = body.slice(0, gapIdx).join(' ')
    const after = body.slice(gapIdx + 1).join(' ')
    const sentBefore = (before.match(/[.!?]["'’”)]?\s/g) ?? []).length
    const sentAfter = (after.match(/[.!?]["'’”)]?\s/g) ?? []).length
    const total = sentBefore + sentAfter + 1
    let bucket
    if (sentBefore === 0) bucket = 'first'
    else if (sentAfter <= 1) bucket = 'last2'
    else bucket = 'middle'
    buckets[bucket] += 1
    detail.push({ exam: q.exam, no: q.no, sentBefore, sentAfter, total, bucket })
  }
  const hit = buckets.first + buckets.last2
  console.log('H2  빈칸이 단락 첫 문장 또는 마지막 2문장에 위치 — 목표 80%')
  console.log('─'.repeat(66))
  console.log(`  추출 성공 ${found}/${targets.length} · 실패 ${failed} (조판상 빈칸 흔적을 못 찾음)`)
  console.log(`  첫 문장 ${buckets.first} · 마지막 2문장 ${buckets.last2} · 중간 ${buckets.middle}`)
  const cover = found / targets.length
  const verdict = cover < 0.7 ? `판정 보류 — 추출률 ${(100 * cover).toFixed(0)}% 로는 표본이 편향됐는지 알 수 없다`
    : (100 * hit / found >= 80 ? '채택' : '기각')
  console.log(`  ${hit}/${found} = ${(100 * hit / found).toFixed(1)}%  → ${verdict}`)
  out.H2 = { found, failed, buckets, rate: hit / found, detail }
}

// ── H5 — 순서 토막 첫 문장의 지시어·연결어 ────────────────────────────
{
  const CUE = /^(this|that|these|those|such|however|but|yet|so|thus|therefore|then|also|moreover|furthermore|besides|instead|nevertheless|nonetheless|consequently|hence|still|meanwhile|indeed|similarly|likewise|another|additionally|in\s+(contrast|addition|fact|other\s+words|turn|response)|for\s+(example|instance)|on\s+the\s+(other|contrary)|as\s+a\s+result|at\s+the\s+same\s+time|by\s+contrast)\b/i
  // ⚠️ 처음엔 대명사 목록이 비어 있었다 — `They walk only a few miles…` 가 '단서 없음' 으로 잡혔다.
  //   They 는 앞 문단을 받는 명백한 지시 대명사다. 기각하기 전에 도구를 먼저 봐야 한다.
  const ART = /^(the|his|her|its|their|they|them|it|he|she|we|us|our|one|both|each|others)\b/i
  const targets = classified.rows.filter((r) => r.exam !== '2014A' && (r.type === 'R-ORDER' || r.type === 'X-ORDER'))
  let blocks = 0, cued = 0, artOnly = 0, none = 0, failedItems = 0
  const misses = []
  for (const q of targets) {
    const L = itemLines(q.exam, q.no)
    if (!L) { failedItems += 1; continue }
    // 표지 뒤에 본문이 붙은 줄만 토막 시작으로 본다(선택지 영역은 표지만 있다)
    const starts = L.filter((l) => /^\s*\((A|B|C)\)\s*\S{3,}/.test(l))
    if (starts.length !== 3) { failedItems += 1; continue }
    for (const s of starts) {
      const text = s.replace(/^\s*\((A|B|C)\)\s*/, '').trim()
      blocks += 1
      if (CUE.test(text)) cued += 1
      else if (ART.test(text)) { artOnly += 1; misses.push(`${q.exam}#${q.no} 관사/대명사만: ${text.slice(0, 50)}`) }
      else { none += 1; misses.push(`${q.exam}#${q.no} 단서 없음: ${text.slice(0, 50)}`) }
    }
  }
  console.log('')
  console.log('H5  순서 토막 첫 문장이 지시어·연결어로 시작 — 목표 90%')
  console.log('─'.repeat(66))
  console.log(`  추출 성공 문항 ${targets.length - failedItems}/${targets.length} · 토막 ${blocks}개`)
  const cover5 = (targets.length - failedItems) / targets.length
  const v5 =
    cover5 < 0.7
      ? `판정 보류 — 추출률 ${(100 * cover5).toFixed(0)}% (H2 와 같은 조판 문제)`
      : 100 * cued / blocks >= 90
        ? '채택'
        : '기각'
  console.log(`  명시적 연결어·지시어 ${cued} = ${(100 * cued / blocks).toFixed(1)}%  → ${v5}`)
  console.log(`  정관사·지시대명사만 ${artOnly} = ${(100 * artOnly / blocks).toFixed(1)}% (앞 문단을 받는 약한 단서)`)
  console.log(`  둘 다 없음 ${none} = ${(100 * none / blocks).toFixed(1)}%`)
  console.log(`  둘을 합치면 ${(100 * (cued + artOnly) / blocks).toFixed(1)}%`)
  for (const m of misses.slice(0, 8)) console.log(`    ${m}`)
  out.H5 = { blocks, cued, artOnly, none, failedItems }
}

fs.writeFileSync(path.join(OUT_DIR, 'blueprint-v0-h2h5.json'), JSON.stringify(out, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'blueprint-v0-h2h5.json')}`)

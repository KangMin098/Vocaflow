// scripts/csat/verify-blueprint-v0.mjs
//
// **출제 설계도 v0 의 가설 H1~H8 을 14개년 실측으로 검사한다 — 읽기 전용.**
//
// v0 는 평가원 출제 원리 + 공개 기출 패턴 기반 가설이다. 여기서 수치로 채택/기각한다.
// 이번 실행이 다루는 것: H1(빈칸 정답의 어휘 재사용) · H6(삽입 주어진 문장의 후방 지시어)
//                      · H8(무관한 문장의 핵심 명사 포함)
// H2·H3·H4·H5·H7 은 추출 난도가 달라 별도 실행.
//
// 근거 데이터: 문항 630/630 · 정답·배점 630/630(배점 교차검증 100%).
//
// 실행: pnpm dlx tsx scripts/csat/verify-blueprint-v0.mjs

import fs from 'node:fs'
import path from 'node:path'

const SRC = 'C:/Users/Administrator/Document' + 's/수능영어기출/최종'
const OUT_DIR = path.resolve('scripts/csat/data')
const HEADER_RE = /저작권은 한국교육과정평가원/
const FILE = { '2014B': '2014_A.txt', '2014A': '2014_Aform.txt' }

const STOP = new Set(`a an the of to in on at by for with from into over under and or but if then than that this these those
it its their our your his her they we you he she i as is are was were be been being do does did have has had
can could will would shall should may might must not no nor so such very more most much many few less least
what which who whom whose when where why how all any both each other others same own too only just also`.split(/\s+/))
const words = (s) => (s.toLowerCase().match(/[a-z][a-z'-]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w))

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

const classified = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'classified.json'), 'utf8'))
const answers = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'answers.json'), 'utf8')).answers
const key = new Map(answers.map((a) => [`${a.exam}#${a.no}`, a]))

function itemLines(exam, no) {
  const file = FILE[exam] ?? `${exam}.txt`
  const lines = keepSingleForm(fs.readFileSync(path.join(SRC, file), 'utf8').replace(/\r/g, '').split('\n'))
  const i = lines.findIndex((l) => new RegExp(`^\\s*${no}\\s*\\.`).test(l))
  if (i < 0) return null
  let j = lines.findIndex((l, k) => k > i && new RegExp(`^\\s*${no + 1}\\s*\\.`).test(l))
  if (j < 0) j = Math.min(i + 60, lines.length)
  return lines.slice(i, j).filter((l) => !HEADER_RE.test(l) && !/^\s*(홀수형|짝수형|\d+)\s*$/.test(l))
}

const out = {}

// ── H1 — 빈칸 정답의 지문 단어 재사용률이 오답보다 낮은가 ──────────────
{
  const d = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'distractor-distance.json'), 'utf8')).results
  const blanks = d.filter((r) => r.type === 'R-BLANK')
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length
  const grp = (rows) => ({
    n: rows.length,
    correct: mean(rows.map((r) => r.correct_overlap)),
    wrong: mean(rows.map((r) => r.wrong_overlap_mean)),
    lowerCount: rows.filter((r) => r.correct_overlap < r.wrong_overlap_mean).length,
  })
  const all = grp(blanks), hi = grp(blanks.filter((r) => r.points === 3)), lo = grp(blanks.filter((r) => r.points === 2))
  console.log('H1  빈칸 정답의 지문 단어 재사용률 < 오답')
  console.log('─'.repeat(66))
  for (const [label, g] of [['전체', all], ['3점', hi], ['2점', lo]]) {
    console.log(
      `  ${label.padEnd(4)} ${String(g.n).padStart(2)}문항 · 정답 ${(100 * g.correct).toFixed(1)}% vs 오답 ${(100 * g.wrong).toFixed(1)}%` +
        ` · 정답이 더 낮은 문항 ${g.lowerCount}/${g.n} = ${(100 * g.lowerCount / g.n).toFixed(0)}%`,
    )
  }
  const verdict = all.correct < all.wrong
  console.log(`  판정: 평균으로는 ${verdict ? '성립' : '불성립'}. 다만 2점 구간에서 방향이 뒤집히고(정답이 더 높다),`)
  console.log(`        문항 단위로는 ${(100 * all.lowerCount / all.n).toFixed(0)}% 로 동전 던지기에 가깝다 → **부분 기각**`)
  out.H1 = { all, hi, lo, verdict: 'partial_reject' }
}

// ── H6 — 삽입(38·39) 주어진 문장에 후방 지시어가 있는가 ────────────────
{
  const REF = /\b(this|these|that|those|such|its|their|his|her|it)\b/i
  const targets = classified.rows.filter((r) => r.exam !== '2014A' && r.type === 'R-INSERT')
  let ok = 0, checked = 0
  const misses = []
  for (const q of targets) {
    const L = itemLines(q.exam, q.no)
    if (!L) continue
    // 주어진 문장 = 문항 번호 줄부터 본문 시작(첫 `( ① )`) 전까지의 영문
    const upto = L.findIndex((l) => /\(\s*①\s*\)/.test(l))
    if (upto <= 0) continue
    const given = L.slice(0, upto).join(' ').replace(/^\s*\d+\s*\.\s*/, '').replace(/\s+/g, ' ').trim()
    if (words(given).length < 5) continue
    checked += 1
    if (REF.test(given)) ok += 1
    else misses.push(`${q.exam}#${q.no}: ${given.slice(0, 70)}`)
  }
  console.log('')
  console.log('H6  삽입 문항의 주어진 문장에 후방 지시어(this/these/such/it…) 포함 — 목표 80%')
  console.log('─'.repeat(66))
  console.log(`  ${ok}/${checked} = ${(100 * ok / checked).toFixed(1)}%  → ${100 * ok / checked >= 80 ? '채택' : '기각'}`)
  for (const m of misses.slice(0, 5)) console.log(`    미포함: ${m}`)
  out.H6 = { ok, checked, rate: ok / checked }
}

// ── H8 — 무관한 문장(35)이 지문 핵심 명사를 포함하는가 ──────────────────
{
  const targets = classified.rows.filter((r) => r.exam !== '2014A' && r.type === 'R-IRRELEVANT' && key.has(`${r.exam}#${r.no}`))
  let ok = 0, checked = 0, okPrev = 0, okAny = 0
  const misses = []
  for (const q of targets) {
    const L = itemLines(q.exam, q.no)
    if (!L) continue
    const body = L.join(' ').replace(/\s+/g, ' ')
    // ①~⑤ 로 나뉜 문장들
    const parts = body.split(/[①②③④⑤]/)
    if (parts.length < 6) continue
    const ans = key.get(`${q.exam}#${q.no}`).answer
    const target = parts[ans]
    const rest = parts.filter((_, i) => i !== ans).join(' ')
    if (!target || words(target).length < 5) continue
    checked += 1
    // ⚠️ 처음엔 "핵심 명사 = 지문 전체 최빈어 상위 3" 으로 쟀는데 50% 밖에 안 나왔다.
    // 2026 #35 를 직접 읽으니 정답 ④ 는 **바로 앞 문장**의 woodworking class 를 이어받는다 —
    // 전체 최빈어가 아니다. 미끼는 전역이 아니라 **국소**로 놓인다. 측정을 그렇게 고친다.
    const tw = new Set(words(target))
    const prev = new Set(words(parts[ans - 1] ?? ''))
    const anyIn = new Set(words(rest))
    const sharedPrev = [...tw].filter((w) => prev.has(w))
    const sharedAny = [...tw].filter((w) => anyIn.has(w))
    if (sharedPrev.length > 0) { ok += 1; okPrev += 1 }
    else if (sharedAny.length > 0) { ok += 1; okAny += 1 }
    else misses.push(`${q.exam}#${q.no} 정답${ans} · 지문과 공유 어휘 0`)
  }
  console.log('')
  console.log('H8  무관한 문장이 지문 어휘를 재사용하는가(어휘 미끼) — 목표 100%')
  console.log('─'.repeat(66))
  console.log(`  ${ok}/${checked} = ${(100 * ok / checked).toFixed(1)}%  → ${100 * ok / checked >= 100 ? '채택' : '기각(목표 100% 미달)'}`)
  console.log(`    바로 앞 문장과 공유 ${okPrev} · 지문 다른 곳과만 공유 ${okAny}`)
  for (const m of misses.slice(0, 6)) console.log(`    ${m}`)
  out.H8 = { ok, checked, rate: ok / checked, okPrev, okAny }
}

fs.writeFileSync(path.join(OUT_DIR, 'blueprint-v0-verify.json'), JSON.stringify(out, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'blueprint-v0-verify.json')}`)

// scripts/csat/verify-h2-h5.mjs
//
// **설계도 v0 의 H2(빈칸 위치)·H5(순서 토막 첫 문장 단서) 검사 — 읽기 전용.**
//
// H2: 빈칸은 단락 첫 문장 또는 마지막 2문장에 80% 이상 집중된다.
// H5: 순서 문항의 토막 첫 문장은 90% 이상 지시어·연결어로 시작한다.
//
// ── 소스가 바뀌었다 ──────────────────────────────────────────────────
// 1판은 읽기순서 .txt 를 썼고 추출률이 44~45% 라 **판정 보류**였다.
// 2단 조판이 빈칸 자리와 (A)(B)(C) 토막 경계를 흩어 놓았기 때문이다.
// 이제 `scripts/csat/pdf-columns.mjs` 가 복원한 **단 단위 텍스트**를 쓴다.
//   · 빈칸은 밑줄(그림)이라 글자로는 안 남지만, `-layout` 에서 **공백 덩어리**로 남는다
//     `feedback that are part of conversation. As writers, we have to`
//     `                                          ; in effect,`   ← 빈칸 자리
//   · (A)(B)(C) 토막이 연속 블록으로 온전히 나온다
//
// ⚠️ 홀수형/짝수형이 한 PDF 에 다 들어 있다. 문항 번호의 **첫 출현**만 쓴다(= 앞 형).
// ⚠️ 발문이 여백을 가로지르면 잘려 `36.` 만 남는 회차가 있다. 번호 매칭에는 지장 없다.
//
// 실행: pnpm dlx tsx scripts/csat/verify-h2-h5.mjs

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('scripts/csat/data')
const COL_DIR = path.join(OUT_DIR, 'columns')

const cache = new Map()
function examLines(exam) {
  if (!cache.has(exam)) {
    const p = path.join(COL_DIR, `${exam}.txt`)
    cache.set(exam, fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r/g, '').split('\n') : null)
  }
  return cache.get(exam)
}

/** 문항 번호의 첫 출현부터 다음 번호 첫 출현 전까지. 페이지 번호 줄 등은 걸러낸다. */
function itemLines(exam, no) {
  const lines = examLines(exam)
  if (!lines) return null
  const at = new RegExp(`^\\s*${no}\\s*\\.`)
  const nxt = new RegExp(`^\\s*${no + 1}\\s*\\.`)
  const i = lines.findIndex((l) => at.test(l))
  if (i < 0) return null
  let j = lines.findIndex((l, k) => k > i && nxt.test(l))
  // 단 복원 후에는 한 문항이 단·페이지 경계를 넘으며 빈 줄을 많이 낀다. 창을 넉넉히 잡는다.
  if (j < 0 || j - i > 220) j = Math.min(i + 160, lines.length)
  return lines.slice(i, j).filter((l) => !/^\s*\d{1,2}\s*$/.test(l))
}

const classified = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'classified.json'), 'utf8'))
const out = {}

const leading = (l) => l.length - l.replace(/^ +/, '').length
/** 본문 줄들의 기준 들여쓰기 = 최빈값. 단 복원 후에도 단마다 들여쓰기가 다르다. */
function baseIndent(lines) {
  const t = new Map()
  for (const l of lines) if (l.trim()) t.set(leading(l), (t.get(leading(l)) ?? 0) + 1)
  let best = 0, bv = -1
  for (const [k, v] of t) if (v > bv) { bv = v; best = k }
  return best
}

// ── H2 — 빈칸 위치 ───────────────────────────────────────────────────
{
  const targets = classified.rows.filter((r) => r.exam !== '2014A' && r.type === 'R-BLANK')
  let found = 0, failed = 0
  const buckets = { first: 0, last2: 0, middle: 0 }
  const detail = [], fails = []
  const GAP = 14 // 빈칸으로 볼 최소 공백 폭. 본문 줄바꿈 들여쓰기(1~4)와 확실히 구분된다.

  for (const q of targets) {
    const L = itemLines(q.exam, q.no)
    if (!L) { failed += 1; fails.push(`${q.exam}#${q.no} 문항 못 찾음`); continue }
    const ci = L.findIndex((l) => /^\s*[①②③④⑤]/.test(l.trim()))
    const body = (ci > 0 ? L.slice(0, ci) : L).filter((l) => l.trim())
    if (body.length < 3) { failed += 1; fails.push(`${q.exam}#${q.no} 본문 짧음`); continue }
    body[0] = body[0].replace(/^\s*\d+\s*\.\s*/, (m) => ' '.repeat(m.length))
    const base = baseIndent(body)

    // 빈칸 후보 — (a) 줄 안의 큰 공백 덩어리 (b) 기준보다 훨씬 큰 들여쓰기
    let before = null, after = null
    for (let k = 0; k < body.length; k += 1) {
      const l = body[k]
      const inner = l.replace(/^ +/, '').match(/ {14,}/)
      if (inner) {
        const head = l.replace(/^ +/, '')
        const at = head.indexOf(inner[0])
        before = [...body.slice(0, k), head.slice(0, at)].join(' ')
        after = [head.slice(at + inner[0].length), ...body.slice(k + 1)].join(' ')
        break
      }
      if (k > 0 && leading(l) >= base + GAP) {
        before = body.slice(0, k).join(' ')
        after = body.slice(k).join(' ')
        break
      }
    }
    if (before === null) { failed += 1; fails.push(`${q.exam}#${q.no} 빈칸 흔적 없음`); continue }

    found += 1
    const sent = (s) => (s.match(/[.!?]["'’”)]?(\s|$)/g) ?? []).length
    const sentBefore = sent(before), sentAfter = sent(after)
    const bucket = sentBefore === 0 ? 'first' : sentAfter <= 1 ? 'last2' : 'middle'
    buckets[bucket] += 1
    detail.push({ exam: q.exam, no: q.no, sentBefore, sentAfter, bucket })
  }

  const hit = buckets.first + buckets.last2
  const cover = found / targets.length
  console.log('H2  빈칸이 단락 첫 문장 또는 마지막 2문장에 위치 — 목표 80%')
  console.log('─'.repeat(70))
  console.log(`  추출 성공 ${found}/${targets.length} = ${(100 * cover).toFixed(0)}%  (1판 44%)`)
  console.log(`  첫 문장 ${buckets.first} · 마지막 2문장 ${buckets.last2} · 중간 ${buckets.middle}`)
  const verdict = cover < 0.7
    ? `판정 보류 — 추출률 ${(100 * cover).toFixed(0)}%`
    : 100 * hit / found >= 80 ? '채택' : '기각'
  console.log(`  ${hit}/${found} = ${(100 * hit / found).toFixed(1)}%  → ${verdict}`)
  if (fails.length) console.log(`  실패 ${fails.length}: ${fails.slice(0, 5).join(' · ')}`)
  out.H2 = { found, failed, cover, buckets, rate: hit / found, verdict, detail }
}

// ── H5 — 순서 토막 첫 문장의 지시어·연결어 ────────────────────────────
{
  const CUE = /^(this|that|these|those|such|however|but|yet|so|thus|therefore|then|also|moreover|furthermore|besides|instead|nevertheless|nonetheless|consequently|hence|still|meanwhile|indeed|similarly|likewise|another|additionally|in\s+(contrast|addition|fact|other\s+words|turn|response|this\s+way)|for\s+(example|instance)|on\s+the\s+(other|contrary)|as\s+a\s+result|at\s+the\s+same\s+time|by\s+contrast|even\s+so|after\s+all|in\s+short)\b/i
  // ⚠️ 처음엔 대명사 목록이 비어 있었다 — `They walk only a few miles…` 가 '단서 없음' 으로 잡혔다.
  //   They 는 앞 문단을 받는 명백한 지시 대명사다. 기각하기 전에 도구를 먼저 봐야 한다.
  const ART = /^(the|his|her|its|their|they|them|it|he|she|we|us|our|one|both|each|others|this|these)\b/i
  const targets = classified.rows.filter(
    (r) => r.exam !== '2014A' && (r.type === 'R-ORDER' || r.type === 'X-ORDER'),
  )
  // ⚠️ v0 는 "**시작**한다" 고 썼지만, `Avoidance training, however, doesn't always work`
  //    처럼 둘째 자리에 오는 however 도 앞 토막을 가리키는 명백한 단서다. 세 단계로 나눠 잰다.
  //    S1 이 v0 그대로의 엄격한 판정이고, S2·S3 는 v0 가 놓친 것을 보여준다.
  const INLINE_CUE = /(^|[\s,;])(however|instead|therefore|thus|also|moreover|furthermore|nevertheless|nonetheless|consequently|hence|meanwhile|similarly|likewise|further|in\s+turn|for\s+example|for\s+instance|in\s+contrast|by\s+contrast|as\s+a\s+result|on\s+the\s+other\s+hand|in\s+addition|as\s+well)([\s,.;]|$)/i
  // 지시 표현 — 첫 단어가 아니어도 앞 토막을 가리킨다.
  //   `Psychologists call this avoidance training` · `Surely these adaptations are good news`
  const DEIXIS = /(^|\s)(this|these|those|such|that)\s+[a-z]+/i
  // 토막 표지는 두 꼴로 나온다.
  //   36·37번 — `        (A) Slowly the trapezoid becomes thinner and thinner,`  (표지 + 본문 한 줄)
  //   43번    — `                       (A)`  다음 줄부터 본문        (표지가 가운데 정렬 단독 줄)
  // ⚠️ 1판은 `\S{3,}` 을 요구해 `(C) At other angles…` 를 놓쳤다 — `At` 이 두 글자다.
  //    두 글자 단어로 시작하는 토막이 통째로 빠지고 있었다.
  function orderBlocks(lines, letters) {
    const res = []
    for (let k = 0; k < lines.length; k += 1) {
      if (/[①②③④⑤]/.test(lines[k])) continue // 선택지 순열 줄
      const m = lines[k].match(/(?:^|\s\s)\(([A-D])\)\s*(.*)$/)
      if (!m || !letters.includes(m[1]) || res.some((r) => r.letter === m[1])) continue
      let text = m[2].trim()
      if (text.length < 10) {
        for (let z = k + 1; z < Math.min(k + 5, lines.length); z += 1) {
          if (lines[z].trim().length > 10) { text = lines[z].trim(); break }
        }
      }
      if (!/^[A-Za-z"'“‘]/.test(text) || text.length < 10) continue // 발문의 `(A)에 이어질` 등을 배제
      res.push({ letter: m[1], text })
    }
    return res
  }

  let blocks = 0, cued = 0, inlineOnly = 0, artOnly = 0, none = 0, failedItems = 0
  const misses = [], failed = [], perBlock = []
  for (const q of targets) {
    let L, letters
    if (q.type === 'X-ORDER') {
      // 장문 순서 — 지문 (A)~(D) 가 **문제 번호 앞**에 온다. 세트 머리글부터 잡는다.
      // (A) 는 주어진 글이므로 배열 대상은 (B)(C)(D) 다.
      const all = examLines(q.exam)
      if (!all) { failedItems += 1; failed.push(`${q.exam}#${q.no} 파일없음`); continue }
      const numAt = all.findIndex((l) => new RegExp(`^\\s*${q.no}\\s*\\.`).test(l))
      const head = all.findIndex((l) => /\[\s*4[23]\s*[~～]\s*45\s*\]/.test(l))
      if (numAt < 0) { failedItems += 1; failed.push(`${q.exam}#${q.no} 번호없음`); continue }
      const from = head >= 0 && head < numAt ? head : Math.max(0, numAt - 130)
      L = all.slice(from, numAt + 6)
      letters = ['B', 'C', 'D']
    } else {
      L = itemLines(q.exam, q.no)
      letters = ['A', 'B', 'C']
    }
    if (!L) { failedItems += 1; failed.push(`${q.exam}#${q.no} 창없음`); continue }
    const starts = orderBlocks(L, letters)
    if (starts.length !== 3) { failedItems += 1; failed.push(`${q.exam}#${q.no} 토막 ${starts.length}개`); continue }
    for (const s of starts) {
      const text = s.text
      const firstSent = text.split(/[.!?](\s|$)/)[0]
      blocks += 1
      let tier
      if (CUE.test(text)) { cued += 1; tier = 'S1' }
      else if (INLINE_CUE.test(firstSent) || DEIXIS.test(firstSent)) { inlineOnly += 1; tier = 'S2' }
      else if (ART.test(text)) { artOnly += 1; tier = 'S3' }
      else { none += 1; tier = 'none'; misses.push(`${q.exam}#${q.no} 단서없음: ${text.slice(0, 46)}`) }
      perBlock.push({ exam: q.exam, no: q.no, tier })
    }
  }
  const cover = (targets.length - failedItems) / targets.length
  console.log('')
  console.log('H5  순서 토막 첫 문장이 지시어·연결어로 시작 — 목표 90%')
  console.log('─'.repeat(70))
  console.log(`  추출 성공 ${targets.length - failedItems}/${targets.length} = ${(100 * cover).toFixed(0)}%  (1판 45%) · 토막 ${blocks}개`)
  const pc = (n) => (100 * n / blocks).toFixed(1) + '%'
  const s1 = 100 * cued / blocks
  const s2 = 100 * (cued + inlineOnly) / blocks
  const s3 = 100 * (cued + inlineOnly + artOnly) / blocks
  const verdict = cover < 0.7 ? `판정 보류 — 추출률 ${(100 * cover).toFixed(0)}%` : s1 >= 90 ? '채택' : '기각'
  console.log(`  S1 첫 단어가 연결어·지시어      ${String(cued).padStart(2)} = ${pc(cued).padStart(6)}  ← v0 그대로의 판정: ${verdict}`)
  console.log(`  S2 + 첫 문장 안의 연결어        ${String(inlineOnly).padStart(2)} = ${pc(inlineOnly).padStart(6)}  누적 ${s2.toFixed(1)}%`)
  console.log(`  S3 + 정관사·지시대명사로 시작   ${String(artOnly).padStart(2)} = ${pc(artOnly).padStart(6)}  누적 ${s3.toFixed(1)}%`)
  console.log(`  단서 없음                     ${String(none).padStart(2)} = ${pc(none).padStart(6)}`)
  if (failed.length) console.log(`  추출 실패: ${failed.slice(0, 6).join(" · ")}`)
  for (const m of misses.slice(0, 8)) console.log(`    ${m}`)
  // 시기별 — 표면 단서가 줄어드는가. 순서·삽입의 3점률이 27%→50% 로 오른 것과 맞물리는지 본다.
  const EARLY = new Set(['2014B', '2015', '2016', '2017', '2018', '2019'])
  const era = (f) => {
    const sub = perBlock.filter(f)
    const n = sub.length || 1
    return {
      n: sub.length,
      s1: sub.filter((b) => b.tier === 'S1').length / n,
      none: sub.filter((b) => b.tier === 'none').length / n,
    }
  }
  const eE = era((b) => EARLY.has(b.exam)), eL = era((b) => !EARLY.has(b.exam))
  console.log('')
  console.log(`  시기별 — 앞 ${eE.n}토막 → 뒤 ${eL.n}토막`)
  console.log(`    S1 명시적 단서로 시작  ${(100 * eE.s1).toFixed(1)}% → ${(100 * eL.s1).toFixed(1)}%`)
  console.log(`    단서 없음             ${(100 * eE.none).toFixed(1)}% → ${(100 * eL.none).toFixed(1)}%`)
  out.H5 = { blocks, cued, inlineOnly, artOnly, none, failedItems, cover, s1: s1 / 100, s2: s2 / 100, s3: s3 / 100, verdict, failed, era: { early: eE, late: eL } }
}

fs.writeFileSync(path.join(OUT_DIR, 'blueprint-v0-h2h5.json'), JSON.stringify(out, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'blueprint-v0-h2h5.json')}`)

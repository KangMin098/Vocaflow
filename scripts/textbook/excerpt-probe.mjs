// scripts/textbook/excerpt-probe.mjs
//
// **초5~6 칸이 비어 있는 것은 발췌로 메울 수 있는가** — 짐작하지 않고 잰다.
//
// ── 무엇이 문제였나 (실측 2026-09-02) ────────────────────────────────
// 학년 밴드(FK)와 어수창을 **동시에** 만족하는 후보를 세니 초5~6 이 표본 400건 중 **0건**이었다.
//
//     초3~4 1,056 · **초5~6 0** · 초6~중1 7,493 · 중1~2 65,313 · 중3 59,427
//
// 왜 0인지 열어 보니 원인이 **두 갈래**였고 둘 다 난이도가 아니라 **길이**였다:
//
//     이야기(StoryWeaver·ASB)  FK 3.5~5.5 인 글이 137~2,787어 — **너무 길다**
//     백과(Vikidia·SimpleWiki) 같은 FK 대의 도입부가 10~39어  — **너무 짧다**
//
// 즉 "그 학년 난이도의 글" 은 이미 있다. 없는 것은 **그 학년 난이도이면서 그 길이인 덩어리**다.
// 그림책은 쪽마다 문단이 나뉘어 있으므로 앞쪽 몇 쪽만 쓰면 자연스러운 덩어리가 된다.
//
// ── 그런데 발췌가 난이도를 바꾼다 ────────────────────────────────────
// FK 는 문장 길이의 평균이라 **앞부분만 떼면 값이 달라진다.** 도입부는 대개 짧은 문장이라
// FK 가 내려가고, 그러면 초5~6 을 노려 잘랐는데 초3~4 가 나올 수 있다.
// **그래서 자른 뒤 다시 재야 한다** — 원본 FK 로 판정하면 틀린 칸에 넣게 된다.
//
// 이 프로브가 답하는 것은 하나다: **앞에서부터 쪽을 더해 창(44~121어)에 들 때,
// 그 조각의 FK 가 여전히 3.5~5.5 인가.**
//
// 재실행 안전: 읽기만 한다. 외부에 GET 만 하고 DB 는 건드리지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/excerpt-probe.mjs
//   pnpm dlx tsx scripts/textbook/excerpt-probe.mjs --level 3 --sample 24

import fs from 'node:fs'
import path from 'node:path'

import { syllables } from '../textbook-corpus/analyze.mjs'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const LEVELS = (arg('level') ?? '2,3').split(',')
const SAMPLE = Number(arg('sample') ?? 20)
const outPath = arg('out') ?? 'docs/reports/excerpt-probe.json'

/** 초5~6 — 시중 실측 FK 4.42(초5~6) · 4.57(초6) 을 감싸는 창. */
const TARGET = { id: '초5~6', fkMin: 3.5, fkMax: 5.5, wMin: 44, wMax: 121 }

const UA = 'Vocaflow-SourceProbe/1.0 (+https://vocaflow.app; educational corpus research)'
const API = 'https://storyweaver.org.in/api/v1'

const strip = (h) =>
  String(h ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, d) => String.fromCharCode(parseInt(d, 16)))
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const depaginate = (t) =>
  t
    .replace(/\b\d+\s*\/\s*\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const wordsOf = (t) => (t.match(/[A-Za-z][A-Za-z'-]*/g) || []).length
const fkGrade = (t) => {
  const sents = (t.match(/[.!?]["')\]]*(\s|$)/g) || []).length
  const ws = t.match(/[A-Za-z][A-Za-z'-]*/g) || []
  if (!sents || !ws.length) return null
  let syl = 0
  for (const w of ws) syl += syllables(w.toLowerCase())
  return +(0.39 * (ws.length / sents) + 11.8 * (syl / ws.length) - 15.59).toFixed(2)
}

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } })
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 3_000))
    return get(url)
  }
  if (!res.ok) return null
  return res.json()
}

const results = []
for (const level of LEVELS) {
  const list = await get(
    `${API}/books-search?page=1&per_page=24&languages%5B%5D=English&levels%5B%5D=${level}`
  )
  const books = (list?.data ?? []).slice(0, SAMPLE)
  console.log(`\n▶ Level ${level} — ${books.length}권\n`)

  for (const b of books) {
    const read = await get(`${API}/stories/${b.slug}/read`)
    const pages = (read?.data?.pages ?? []).filter((p) => p.pageType === 'StoryPage')
    if (!pages.length) continue
    const texts = pages.map((p) => depaginate(strip(p.html)))
    const full = texts.join(' ')

    // **앞에서부터 쪽을 더해 창에 처음 드는 지점.** 쪽 경계에서만 자른다 —
    //   문장 중간에서 자르면 지문이 아니라 조각이 된다.
    let acc = ''
    let usedPages = 0
    let excerpt = null
    for (const t of texts) {
      if (!t) {
        usedPages++
        continue
      }
      const next = acc ? `${acc} ${t}` : t
      usedPages++
      const w = wordsOf(next)
      if (w >= TARGET.wMin) {
        // 창을 넘어 버렸으면 이 쪽은 넣지 않는다(직전까지가 최선).
        excerpt = w <= TARGET.wMax ? { text: next, pages: usedPages } : null
        if (!excerpt && wordsOf(acc) >= TARGET.wMin) excerpt = { text: acc, pages: usedPages - 1 }
        break
      }
      acc = next
    }

    const fullFk = fkGrade(full)
    const exFk = excerpt ? fkGrade(excerpt.text) : null
    const exW = excerpt ? wordsOf(excerpt.text) : null
    const inBand = exFk != null && exFk >= TARGET.fkMin && exFk <= TARGET.fkMax
    results.push({
      level,
      slug: b.slug,
      title: b.title,
      fullWords: wordsOf(full),
      fullFk,
      pages: pages.length,
      excerptWords: exW,
      excerptPages: excerpt?.pages ?? null,
      excerptFk: exFk,
      inTargetBand: inBand,
    })
    console.log(
      `  ${inBand ? '✓' : '·'} L${level} ${String(wordsOf(full)).padStart(5)}어/FK${String(fullFk).padStart(6)} → ` +
        `발췌 ${String(exW ?? '—').padStart(4)}어(${excerpt?.pages ?? '-'}쪽)/FK${String(exFk ?? '—').padStart(6)}  ${b.title.slice(0, 34)}`
    )
    await new Promise((r) => setTimeout(r, 1_100))
  }
}

// ── 정리 ─────────────────────────────────────────────────────────────
const withExcerpt = results.filter((r) => r.excerptWords != null)
const inBand = withExcerpt.filter((r) => r.inTargetBand)
const drift = withExcerpt.filter((r) => r.fullFk != null && r.excerptFk != null)

console.log(`\n${'─'.repeat(64)}`)
console.log(`표본 ${results.length}권 · 창(${TARGET.wMin}~${TARGET.wMax}어)에 드는 발췌를 만든 것 ${withExcerpt.length}`)
console.log(`그중 FK 가 ${TARGET.id}(${TARGET.fkMin}~${TARGET.fkMax}) 인 것 **${inBand.length}**`)
if (drift.length) {
  const d = drift.map((r) => r.excerptFk - r.fullFk)
  const avg = d.reduce((a, b) => a + b, 0) / d.length
  console.log(
    `\n발췌가 FK 를 얼마나 움직이나 — 평균 ${avg >= 0 ? '+' : ''}${avg.toFixed(2)} ` +
      `(최소 ${Math.min(...d).toFixed(2)} · 최대 ${Math.max(...d).toFixed(2)})`
  )
  console.log('원본 FK 로 칸을 정하면 이만큼 틀린 칸에 넣게 된다 — 자른 뒤 다시 재야 하는 이유다.')
}

fs.writeFileSync(
  path.resolve(outPath),
  JSON.stringify({ measuredAt: new Date().toISOString(), target: TARGET, results }, null, 2)
)
console.log(`\n기록 → ${outPath}`)

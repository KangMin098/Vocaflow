// scripts/textbook/curriculum-propernoun-probe.mjs
//
// **어휘 게이트가 고유명사 때문에 백과 글을 버리고 있는가 — 크기를 잰다.**
//
// ── 왜 재는가 (2026-09-05) ──────────────────────────────────────────
// MediaWiki 도입부를 V1~V3 로 조준해 300건을 돌린 대조 실험:
//
//   어휘 게이트 켬  수율 **0.7%** (2/300)
//   어휘 게이트 끔  수율 **9.7%** (29/300)   ← 14배
//
// 게이트가 지배적 병목이다. 그런데 `curriculum.ts:30` 이 이미 경고해 뒀다 —
// **"원문 목록에 고유명사·숫자·파생형이 없다."** `curriculumCoverage` 는 낱말을 전부
// 소문자로 바꿔 목록과 대조하므로, `M*A*S*H`·`Maple Meadows` 같은 이름은 그대로
// "교육과정 밖" 으로 센다. 백과 도입부는 이름 덩어리다.
//
// 즉 이 게이트는 **틀린 게 아니라 이 소스에 안 맞게 쓰이고 있을 수 있다**
// (시중 교재 지문으로 눈금을 잡았는데, 그 지문에는 이름이 이만큼 안 나온다).
//
// 그래서 끄기 전에 **얼마나 그런지 먼저 잰다.** 고유명사를 뺐을 때 `outsidePct` 가
// 얼마나 내려가고 몇 편이 통과로 바뀌는지가 곧 이 게이트를 손볼 근거다.
//
// ── 고유명사를 어떻게 알아보는가 ─────────────────────────────────────
// 품사 분석기가 없으므로 **문장 첫 자리가 아닌데 대문자로 시작하는 토큰**을 고유명사로
// 본다. 완전하지 않다(문장 첫 고유명사는 못 잡고, 강조 대문자는 잘못 잡는다).
// 그래서 이 값은 **하한**이다 — 실제 효과는 이보다 크다.
//
// 재실행 안전: 읽기만 한다. 아무것도 쓰지 않는다.
//
// 실행:
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/curriculum-propernoun-probe.mjs --limit 80

import fs from 'node:fs'
import path from 'node:path'

import { mediawikiAllpages, mediawikiLead } from './_mediawiki.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const LIMIT = Number(arg('limit') ?? 80)
const SCHOOL = arg('school') ?? 'elementary'

const { curriculumCoverage, curriculumFit, PASSAGE_WORDS } = await import(
  '../../packages/library-pipeline/src/index.ts'
)

const countWords = (s) => s.split(/\s+/).filter(Boolean).length

function trimToWindow(text, min, max) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  let out = ''
  for (const s of sentences) {
    const next = out ? `${out} ${s}` : s
    if (countWords(next) > max) break
    out = next
    if (countWords(out) >= min) return out
  }
  return null
}

/**
 * 문장 첫 자리가 아닌 대문자 시작 토큰을 지운다 — 고유명사 대용.
 * **하한 추정**이다: 문장 첫 고유명사는 못 잡는다.
 */
function stripProperNouns(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      const toks = sentence.split(/\s+/)
      return toks
        .filter((t, i) => i === 0 || !/^[A-Z][A-Za-z'-]*[.,;:)]?$/.test(t))
        .join(' ')
    })
    .join(' ')
}

const sample = await mediawikiAllpages('https://simple.wikipedia.org/w/api.php', LIMIT, {
  minSize: 2000,
})
if (sample.error) {
  console.error(`표집 실패 — ${sample.error}`)
  process.exit(1)
}

let n = 0
let passBefore = 0
let passAfter = 0
let flipped = 0
const drops = []

for (const item of sample.items) {
  const lead = await mediawikiLead('https://simple.wikipedia.org/w/api.php', item.id, {
    intro: false,
  })
  await new Promise((z) => setTimeout(z, 120))
  const raw = (lead.body ?? '').trim()
  if (!raw) continue
  const words = countWords(raw)
  const content =
    words > PASSAGE_WORDS.max ? trimToWindow(raw, PASSAGE_WORDS.min, PASSAGE_WORDS.max) : raw
  if (!content || countWords(content) < PASSAGE_WORDS.min) continue

  const before = curriculumCoverage(content)
  const stripped = stripProperNouns(content)
  const after = curriculumCoverage(stripped)
  if (!before || !after) continue

  const fitBefore = curriculumFit(content, SCHOOL)
  const fitAfter = curriculumFit(stripped, SCHOOL)

  n++
  if (fitBefore.pass) passBefore++
  if (fitAfter.pass) passAfter++
  if (!fitBefore.pass && fitAfter.pass) flipped++
  drops.push(before.outsidePct - after.outsidePct)

  if (n <= 12) {
    console.log(
      `  ${fitBefore.pass ? '통과' : '차단'} → ${fitAfter.pass ? '통과' : '차단'}  ` +
        `밖 ${String(before.outsidePct).padStart(5)}% → ${String(after.outsidePct).padStart(5)}%  ` +
        `(내용어 ${before.contentWords} → ${after.contentWords})  ${item.title.slice(0, 34)}`,
    )
  }
}

const mean = drops.length ? drops.reduce((a, b) => a + b, 0) / drops.length : 0
console.log(
  `\n표본 ${n} (${SCHOOL}) · 고유명사 제거 전후\n` +
    `통과 ${passBefore} → ${passAfter} (뒤집힘 ${flipped}, ${n ? ((flipped / n) * 100).toFixed(1) : 0}%)\n` +
    `교육과정 밖 비율 평균 낙폭 ${mean.toFixed(1)}%p`,
)
console.log(
  '\n※ 문장 첫 고유명사는 못 잡으므로 이 값은 **하한**이다 — 실제 효과는 이보다 크다.',
)

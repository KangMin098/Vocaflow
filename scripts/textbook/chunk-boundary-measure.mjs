// scripts/textbook/chunk-boundary-measure.mjs
//
// **경계에서 멈추게 하면 발췌 수율이 얼마나 깎이는가.**
//
// 2026-09-15 `excerpt-chunks.ts` 가 두 가지를 고쳤다 — ① 본문도 표제도 아닌 줄을
// 경계로 적고 ② 조각을 모으다 경계를 만나면 멈춘다. ①은 짧은 대사 한 줄
// (`"Killy-killy-killy-goat!"`)까지 경계로 세므로 **수율을 깎는다.** 얼마나 깎이는지는
// 짐작할 일이 아니라 잴 일이다 — 이 스크립트가 그것을 잰다.
//
// ── 어떻게 재는가 ────────────────────────────────────────────────────
// 실제 Gutenberg 책을 받아 같은 정제를 걸고, **옛 구현과 새 구현에 같은 문단을 준다.**
// 옛 구현은 아래에 **그날의 모습 그대로 얼려 둔 사본**이다(2026-09-15 이전).
// 사본이라 앞으로 바뀌지 않는다 — 비교 기준이 움직이면 비교가 아니다.
//
// ⚠️ 책은 `curl` 로 받는다. 이 저장소가 세 번 겪었듯 node fetch 로는 gutenberg.org 에
//   못 붙는다. DB 는 쓰지 않는다 — **읽기만 하고 아무것도 적재하지 않는다.**
//
// 실행:
//   node scripts/textbook/chunk-boundary-measure.mjs            # 기본 책 8권
//   node scripts/textbook/chunk-boundary-measure.mjs 26177 11   # 책 번호를 직접

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const run = promisify(execFile)

const ROOT = path.resolve(import.meta.dirname, '../..')
const { cleanBookText } = await import(pathToFileURL(path.join(ROOT, 'scripts/csat/lib-clean.mjs')).href)
const { PASSAGE_WORDS } = await import(
  pathToFileURL(path.join(ROOT, 'packages/library-pipeline/src/textbook/readability.ts')).href
)
const { disjointChunks } = await import(
  pathToFileURL(path.join(ROOT, 'packages/library-pipeline/src/textbook/excerpt-chunks.ts')).href
)
// 조각이 **실제로** 경계를 넘었는지 세는 자 — 같은 결함을 DB 쪽에서 세던 것과 같은 규칙.
const { storySeam } = await import(
  pathToFileURL(path.join(ROOT, 'packages/library-pipeline/src/textbook/story-seam.ts')).href
)

/**
 * 기본 표본. **결함이 나온 책(26177)을 반드시 넣는다** — 고친 것이 그 책에서
 * 실제로 멈추는지 보지 않으면 고친 줄 모른다. 나머지는 성격이 갈리게 골랐다:
 * 선집 둘 · 한 편짜리 이야기 둘 · 대화가 많은 아동물 둘 · 설명문 하나.
 */
const DEFAULT_BOOKS = [
  [26177, 'The Book of Stories for the Story-teller (결함이 나온 책)'],
  [503, 'The Aesop for Children (선집)'],
  [11, "Alice's Adventures in Wonderland (대화 많음)"],
  [289, 'The Wind in the Willows'],
  [2591, "Grimm's Fairy Tales (선집)"],
  [16, 'Peter Pan'],
  [19033, 'A Little Princess'],
  [45, 'Anne of Green Gables'],
]

// ── 옛 구현 — 2026-09-15 이전의 `harvest-gutenberg-kid.mjs` 그대로 ──────
//   ⚠️ **고치지 말 것.** 비교 기준이다. 새 구현이 바뀌면 이 사본과의 차이가 바뀐다.
//
//   ⚠️⚠️ `looksLikeHeading` 도 **사본이라야 한다.** 처음에 패키지에서 가져다 썼는데,
//     같은 사이클에 그 함수의 검사 순서를 고쳤으므로(로마숫자 `IV.`) 옛 구현이
//     새 표제 판정을 쓰게 된다 — 그러면 비교가 아니라 반쪽 비교가 된다.
function looksLikeHeadingOld(p) {
  const t = p.trim()
  if (!t || t.length > 70) return false
  if (/[.!?][")\]]?$/.test(t) && !/^(?:CHAPTER|BOOK|PART|SECTION)\b/i.test(t)) return false
  if (/^(?:CHAPTER|BOOK|PART|SECTION)\b/i.test(t)) return true
  if (/^[IVXLC]+\.?$/.test(t)) return true
  const letters = t.replace(/[^A-Za-z]/g, '')
  if (letters.length >= 3 && letters === letters.toUpperCase()) return true
  return false
}

function disjointChunksOld(units, bounds) {
  const paras = []
  const opensChapter = []
  let afterHeading = false
  for (const u of units) {
    if (u.wasDropped || (u.text && looksLikeHeadingOld(u.text))) {
      afterHeading = true
      continue
    }
    const p = u.text
    if (p && p.length > 80 && /[.!?]/.test(p)) {
      paras.push(p)
      opensChapter.push(afterHeading)
      afterHeading = false
    }
    // ← 여기에 아무것도 없었다. 본문도 표제도 아닌 줄이 경계를 안 남기고 사라졌다.
  }
  const out = []
  let i = 0
  while (i < paras.length) {
    let acc = ''
    let end = -1
    for (let j = i; j < paras.length; j++) {
      // ← 여기에도 아무것도 없었다. 모으다 경계를 만나도 멈추지 않았다.
      acc = acc ? `${acc} ${paras[j]}` : paras[j]
      const w = (acc.match(/[A-Za-z][A-Za-z'-]*/g) || []).length
      if (w < bounds.min) continue
      if (w > bounds.max) break
      end = j
      break
    }
    if (end < 0) {
      i++
      continue
    }
    out.push({ text: acc, opensChapter: opensChapter[i] === true })
    i = end + 1
  }
  return out
}

function stripBoilerplate(t) {
  let body = t
  const s = body.indexOf('*** START OF')
  const e = body.indexOf('*** END OF')
  if (s > 0) body = body.slice(body.indexOf('\n', s) + 1)
  if (e > 0) body = body.slice(0, body.lastIndexOf('*** END OF'))
  return body
}

function cleanByParagraph(body) {
  const out = []
  for (const p of body.split(/\n\s*\n/)) {
    const cleaned = cleanBookText(p).replace(/\s+/g, ' ').trim()
    out.push({ text: cleaned, wasDropped: !cleaned && Boolean(p.trim()) })
  }
  return out
}

async function fetchBook(id) {
  for (const url of [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
  ]) {
    try {
      const { stdout } = await run('curl', ['-sL', '-m', '90', url], { maxBuffer: 64 * 1024 * 1024 })
      if (stdout && stdout.length > 20000) return stdout
    } catch {
      /* 다음 주소로 */
    }
  }
  return null
}

const argv = process.argv.slice(2).filter((a) => /^\d+$/.test(a))
const books = argv.length ? argv.map((n) => [Number(n), `#${n}`]) : DEFAULT_BOOKS

const bounds = { min: PASSAGE_WORDS.min, max: PASSAGE_WORDS.max }
console.log(`어수창 ${bounds.min}~${bounds.max}어 · 책 ${books.length}권\n`)
console.log(
  '책'.padEnd(44) + '옛'.padStart(6) + '새'.padStart(6) + '차이'.padStart(8) + '   장머리 옛→새' + '    경계넘음 옛→새',
)
console.log('─'.repeat(100))

let totalOld = 0
let totalNew = 0
let totalOpenOld = 0
let totalOpenNew = 0
let totalSeamOld = 0
let totalSeamNew = 0
const failed = []

for (const [id, label] of books) {
  const raw = await fetchBook(id)
  if (!raw) {
    failed.push(label)
    continue
  }
  const units = cleanByParagraph(stripBoilerplate(raw))
  const a = disjointChunksOld(units, bounds)
  const b = disjointChunks(units, bounds)
  const oa = a.filter((c) => c.opensChapter).length
  const ob = b.filter((c) => c.opensChapter).length
  // **조각 안에서** 이야기가 바뀐 것. 지난 사이클에 DB 쪽에서 쓰던 자를 그대로 쓴다.
  const sa = a.filter((c) => storySeam(c.text)).length
  const sb = b.filter((c) => storySeam(c.text)).length
  totalOld += a.length
  totalNew += b.length
  totalOpenOld += oa
  totalOpenNew += ob
  totalSeamOld += sa
  totalSeamNew += sb
  const pct = a.length ? Math.round(((b.length - a.length) / a.length) * 1000) / 10 : 0
  console.log(
    label.slice(0, 42).padEnd(44) +
      String(a.length).padStart(6) +
      String(b.length).padStart(6) +
      `${pct > 0 ? '+' : ''}${pct}%`.padStart(8) +
      `   ${oa} → ${ob}`.padEnd(17) +
      `   ${sa} → ${sb}`,
  )
}

console.log('─'.repeat(100))
const pct = totalOld ? Math.round(((totalNew - totalOld) / totalOld) * 1000) / 10 : 0
console.log(
  '합계'.padEnd(44) +
    String(totalOld).padStart(6) +
    String(totalNew).padStart(6) +
    `${pct > 0 ? '+' : ''}${pct}%`.padStart(8) +
    `   ${totalOpenOld} → ${totalOpenNew}`.padEnd(17) +
    `   ${totalSeamOld} → ${totalSeamNew}`,
)
if (failed.length) console.log(`\n못 받은 책 ${failed.length} — ${failed.join(' · ')}`)
console.log(
  '\n「장머리」는 장·이야기가 시작하는 자리에서 시작하는 조각 — 발췌를 고를 때 먼저 쓴다.\n' +
    '「경계넘음」은 조각 **안에서** 이야기가 바뀐 것(`storySeam`). 0 이 아니면 아직 새는 데가 있다.\n' +
    '⚠️ `storySeam` 은 여는 정형구를 쓴 경계만 본다 — 0 이어도 「경계가 없다」는 뜻은 아니다.',
)

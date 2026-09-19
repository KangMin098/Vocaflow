// scripts/csat/build-anchor-data.mjs
//
// **오버레이가 읽을 앵커 데이터를 만든다 — 좌표만, 글자는 한 자도 담지 않는다.**
//
// 산출: `apps/web/src/lib/csat/anchor-data/<회차>.json` + `index.json`
//
// ⚠️ **여기 담는 것은 좌표뿐이다.** 지문·선지 글자를 담으면 그 순간 평가원 저작물의 사본이
//    되고, `csat_items` 의 RLS 로 막아 둔 경계를 우회하는 셈이 된다. 담는 것은
//    `{page, x, y, w, h}` 와 문항 번호·선지 번호다 — 어느 좌표에 상자를 그릴지의 정보이고
//    그것만으로는 원문이 복원되지 않는다.
//
// ⚠️ **PDF 를 저장소에 두지 않는다.** 이 스크립트는 사용자 폴더의 원본을 읽어 좌표만 뽑는다.
//    원본이 없는 기계에서는 아무것도 만들지 않고 그대로 끝난다(만들어 둔 JSON 은 커밋돼 있다).
//
// 회차 식별은 **SHA-256** 이다. 학습자가 평가원에서 받은 파일이 어느 회차인지 이름이 아니라
// 내용으로 판정한다 — 실측 2026-09-13: 평가원에서 방금 받은 2026 영어 문제지가 이 폴더의
// 원본과 해시까지 같았다(`788830081bb2a3ad…`). 이름은 사람이 바꿀 수 있고 해시는 못 바꾼다.
//
// 실행: node scripts/csat/build-anchor-data.mjs [--commit]
//   `--commit` 없이는 무엇을 쓸지만 찍는다.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

import { extractAnchors, grade, firstFormPages, columnsOf, realItems, assignMarks } from './pdf-anchors.mjs'

const COMMIT = process.argv.includes('--commit')
const OUT = path.resolve('apps/web/src/lib/csat/anchor-data')

// 원본 위치는 옮겨진 적이 있다 — 후보를 훑는다(`ingest-listening.mjs` 와 같은 방식)
const DIRS = [
  'C:/Users/Administrator/Documents/영어/수능영어기출/수능기출',
  'C:/Users/Administrator/Documents/영어/모의평가',
].filter((d) => fs.existsSync(d))

/**
 * 파일 이름 → 회차 id. 수능은 앞 네 자리가 학년도(`2014_영어A…` → `2014A`),
 * 모평은 `YYYYMM…` → `MYYMM`.
 *
 * ⚠️ **이름으로 회차를 정하는 것은 여기(빌드)뿐이다.** 학습자 쪽 판정은 해시로 한다 —
 *    이름 규칙이 회차마다 흔들려 온 전력이 있다(`_정답표.pdf` 인데 듣기 대본인 회차 7개).
 */
function examIdOf(file) {
  const mock = file.match(/^(\d{4})(\d{2})_/)
  if (mock) return `M${mock[1].slice(2)}${mock[2]}`
  const sn = file.match(/^(\d{4})/)
  if (!sn) return null
  const year = sn[1]
  if (/영어\s*A/.test(file)) return `${year}A`
  if (/영어\s*B/.test(file)) return `${year}B`
  return year
}

/**
 * 사정권 문항이 있는 회차만 담는다.
 *
 * `csat_items` 에 없는 회차를 담으면 오버레이가 상자는 그리는데 **누를 것이 없다** —
 * 분석이 0건이므로 옆 패널이 영원히 빈다. 그러면 학습자는 우리가 안 만든 것을
 * 「고장」으로 읽는다.
 */
const inScopeExams = new Set(
  JSON.parse(fs.readFileSync(path.resolve('scripts/csat/data/corpus.json'), 'utf8')).items
    .filter((i) => i.in_scope)
    .map((i) => i.exam),
)

const index = []
const wrote = []
const candidates = []
let skipped = 0
// 해시 → 회차. **한 해시가 두 회차를 가리키면 둘 다 담지 않는다.**
// 실측 2026-09-13: M2009 와 M2106 의 문제지가 md5·sha256 까지 같다(원본 중복 — 2020학년도
// 9월 모평 문제지는 원본이 없고, 코퍼스는 소유를 M2106 으로 판정했다). 담아 두면 학습자가
// 문제지를 떨어뜨렸을 때 어느 회차인지 **동전 던지기**가 되고, 틀린 쪽 분석이 조용히 뜬다.
const byHash = new Map()

for (const dir of DIRS) {
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf') && !f.includes('정답표'))
  for (const file of files.sort()) {
    const examId = examIdOf(file)
    if (!examId) { console.log(`  ⏭ ${file} — 회차를 못 읽었다`); skipped += 1; continue }

    if (!inScopeExams.has(examId)) {
      console.log(`  ⏭ ${file} — ${examId} 은 사정권 문항이 0이다(코퍼스 기준) → 제외`)
      skipped += 1
      continue
    }

    const full = path.join(dir, file)
    const bytes = fs.readFileSync(full)
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')

    byHash.set(sha256, [...(byHash.get(sha256) ?? []), examId])

    const extracted = await extractAnchors(full)
    const g = grade(extracted)

    // **듣기 대본이 `_문제지.pdf` 로 이름 붙은 파일이 있다**(201906·201909). 내용으로 가른다.
    if (g.numbersFound <= 20) {
      console.log(`  ⏭ ${file} — 문항 번호 ${g.numbersFound}/45 · 듣기 대본이다(문제지가 아니다)`)
      skipped += 1
      continue
    }
    // 앵커가 온전하지 않은 회차는 **담지 않는다.** 담으면 오버레이가 엉뚱한 자리에 상자를
    // 그리고, 학습자는 그것이 우리 분석의 자리라고 믿는다. 없는 것이 틀린 것보다 낫다.
    if (g.fiveMarks !== g.reading || g.orphans) {
      console.log(`  ✗ ${file} — 앵커 불완전(5기호 ${g.fiveMarks}/${g.reading} · 고아 ${g.orphans}) → 제외`)
      skipped += 1
      continue
    }

    const pages = firstFormPages(extracted.data)
    const cols = columnsOf(pages)
    const items = realItems(pages, cols)
    const { owner } = assignMarks(pages, cols, items)

    const round = (n) => Math.round(n * 10) / 10
    const box = (b) => ({ p: b.page, x: round(b.x), y: round(b.y), w: round(b.w), h: round(b.h) })

    const payload = {
      exam_id: examId,
      sha256,
      // 쪽 크기는 화면 배율을 맞추는 데 필요하다 — 쪽마다 다를 수 있으니 쪽마다 적는다
      pages: pages.map((p) => ({ p: p.page, w: round(p.width), h: round(p.height) })),
      // 형이 둘 든 PDF 는 앞 절반만 쓴다. 몇 쪽까지가 첫 형인지 적어 둔다
      form_pages: pages.length,
      total_pages: extracted.pages,
      items: items.map((i) => ({
        no: i.no,
        col: i.col,
        ...box(i),
        marks: (owner.get(`${i.page}|${i.col}|${i.no}`) ?? [])
          .slice()
          .sort((a, b) => a.n - b.n)
          .map((m) => ({ n: m.n, ...box({ ...m, page: i.page }) })),
      })),
    }

    // **모아 두고 나중에 쓴다.** 중복 해시는 나중에 나타나므로, 그 자리에서 쓰면 먼저 쓴
    // 쪽을 되돌릴 수 없다 — 「둘 다 제외」가 말만 되고 실제로는 하나가 남는다.
    candidates.push({ file, payload })
  }
}

// ── 중복 해시를 **양쪽 다** 떨어뜨린다 ────────────────────────────────
for (const { file, payload } of candidates) {
  const twins = byHash.get(payload.sha256) ?? []
  if (twins.length > 1) {
    console.log(`  ✗ ${file} — 해시가 ${twins.filter((e) => e !== payload.exam_id).join('·')} 과 같다(원본 중복) → 제외`)
    skipped += 1
    continue
  }
  index.push({ exam_id: payload.exam_id, sha256: payload.sha256, items: payload.items.length, form_pages: payload.form_pages })
  wrote.push({ file, examId: payload.exam_id, sha256: payload.sha256.slice(0, 12), items: payload.items.length })
  if (COMMIT) {
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(path.join(OUT, `${payload.exam_id}.json`), JSON.stringify(payload))
  }
}

index.sort((a, b) => (a.exam_id < b.exam_id ? -1 : 1))
if (COMMIT && index.length) {
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), exams: index }, null, 1))
}

console.log(`\n  원본 폴더 ${DIRS.length} · 담은 회차 ${wrote.length} · 제외 ${skipped}`)
for (const w of wrote) console.log(`    ${w.examId.padEnd(6)} ${w.sha256}…  문항 ${w.items}  (${w.file})`)
if (!DIRS.length) console.log('  ⏭ 원본 폴더가 없다 — 아무것도 만들지 않았다(커밋된 JSON 이 정본이다)')
console.log(COMMIT ? `\n→ ${OUT}` : '\n  미리보기다 — 쓰려면 --commit')

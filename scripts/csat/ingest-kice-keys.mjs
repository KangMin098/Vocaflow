// scripts/csat/ingest-kice-keys.mjs
//
// **평가원이 공개한 정답표 PDF 에서 모의평가 정답을 뽑는다.**
//
// 왜 필요했나 — 사용자 폴더의 `_정답표.pdf` 7개가 실제로는 **듣기 대본**이었다(실측).
// 원인은 평가원 게시판의 파일명이 회차마다 다르다는 것이다:
//   `정답표.pdf` · `3교시_영어영역_정답표.pdf` · `3교시_영어_정답표.pdf` · **`3교시_영어영역_정답지.pdf`**
// 영어만 첨부가 넷(문제지·듣기파일·정답표·듣기대본)이라, 이름 규칙으로 받으면 대본이 딸려 온다.
//
// ## 이 파일이 하는 일이 아닌 것
//
// **정답을 손으로 옮겨 적지 않는다.** 45개 중 한 자리만 틀려도 학습자를 반대로 훈련시키고,
// 틀린 줄 알 방법이 없다. `pdf-cid-text.mjs` 가 PDF 안의 ToUnicode 표로 기계 해독한다.
//
// ## 검산 — 넷을 다 통과해야 받는다
//
//   ① 45문항이 빠짐없이 나왔나
//   ② 정답이 1~5, 배점이 2 또는 3인가
//   ③ **배점 합이 정확히 100인가** (평가원 영어는 100점 만점이다)
//   ④ **문제지의 `[3점]` 표시가 정답표의 3점 집합에 들어 있는가** — 이 회차의 정답표가 맞는지를
//      회차 자신의 문제지로 확인하는 것이다. 남의 회차 정답표를 붙이는 사고(2020학년도 9월 ·
//      2021학년도 6월 문제지 md5 동일 건)를 여기서 막는다.
//
// 넷 중 하나라도 어긋나면 **그 회차는 받지 않는다.** 반쯤 맞는 정답표가 들어가는 것보다
// 없는 편이 낫다 — 없으면 `answer_unknown` 으로 정직하게 막히지만, 틀리면 조용히 퍼진다.
//
// 실행:
//   node scripts/csat/ingest-kice-keys.mjs <PDF들이 있는 디렉터리>          (미리보기)
//   node scripts/csat/ingest-kice-keys.mjs <디렉터리> --commit               (mock-answers-kice.json 갱신)

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const DIR = path.resolve('scripts/csat/data')
const SRC = process.argv[2]
const COMMIT = process.argv.includes('--commit')
if (!SRC || !fs.existsSync(SRC)) {
  console.error('사용법: node scripts/csat/ingest-kice-keys.mjs <PDF 디렉터리> [--commit]')
  process.exit(1)
}

const corpus = JSON.parse(fs.readFileSync(path.join(DIR, 'corpus.json'), 'utf8'))

/** `2024학년도 … 9월 모의평가` → `M2409` */
function examIdOf(head) {
  const m = head.match(/(\d{4})\s*학년도[\s\S]{0,40}?(\d{1,2})\s*월/)
  if (!m) return null
  return `M${String(m[1]).slice(2)}${String(m[2]).padStart(2, '0')}`
}

const CIRCLED = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 }

/**
 * 해독된 표에서 `번호 + 동그라미정답 + 배점` 을 훑는다.
 * 한 줄에 네 벌이 붙어 나오므로(`1⑤213③325④237③3`) 줄이 아니라 **패턴**으로 읽는다.
 */
function parseTable(text) {
  const rows = new Map()
  for (const m of text.matchAll(/(\d{1,2})\s*([①②③④⑤])\s*([23])/g)) {
    const no = Number(m[1])
    if (no < 1 || no > 45) continue
    // 같은 번호가 두 번 나오면 앞의 것을 믿는다 — 뒤엣것은 다음 칸의 번호가 붙어 읽힌 것이다
    if (!rows.has(no)) rows.set(no, { answer: CIRCLED[m[2]], points: Number(m[3]) })
  }
  return rows
}

const results = []
for (const f of fs.readdirSync(SRC).filter((x) => x.toLowerCase().endsWith('.pdf')).sort()) {
  const p = path.join(SRC, f)
  let text
  try {
    text = execFileSync(process.execPath, ['scripts/csat/pdf-cid-text.mjs', p], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 16 * 1024 * 1024,
    })
  } catch {
    results.push({ file: f, exam: null, ok: false, why: 'PDF 해독 실패 (ToUnicode 없음)' })
    continue
  }

  const exam = examIdOf(text)
  if (!exam) {
    results.push({ file: f, exam: null, ok: false, why: '머리글에서 학년도·월을 못 읽었다' })
    continue
  }

  // ⚠️ **문제지가 없는 회차의 정답표는 받지 않는다.**
  //    실측: `M2009` 는 문제지 PDF 가 `M2106` 것과 md5 동일이라 회차를 통째로 무효화했다.
  //    그 회차의 진짜 정답표를 넣으면 **엉뚱한 문제지에 옳은 정답을 붙이는** 셈이 되고,
  //    화면에는 「정답 있음」으로 보인다. 없는 편이 낫다.
  if (!corpus.items.some((it) => it.exam === exam)) {
    results.push({ file: f, exam, ok: false, why: '이 회차의 문제지가 원장에 없다 — 정답만 붙일 수 없다' })
    continue
  }

  const rows = parseTable(text)
  const fails = []
  if (rows.size !== 45) fails.push(`문항 ${rows.size}/45`)
  const sum = [...rows.values()].reduce((a, r) => a + r.points, 0)
  if (sum !== 100) fails.push(`배점 합 ${sum}/100`)
  if ([...rows.values()].some((r) => r.answer < 1 || r.answer > 5)) fails.push('정답이 1~5 밖')

  // ④ 문제지의 [3점] 표시가 정답표의 3점 집합 안에 있는가
  const paperThree = corpus.items
    .filter((it) => it.exam === exam && it.high_score)
    .map((it) => it.no)
    .sort((a, b) => a - b)
  const keyThree = new Set([...rows].filter(([, r]) => r.points === 3).map(([n]) => n))
  const missing = paperThree.filter((n) => !keyThree.has(n))
  if (paperThree.length && missing.length) fails.push(`문제지 [3점] ${missing.join(',')} 이 정답표에 없다`)

  results.push({
    file: f,
    exam,
    ok: fails.length === 0,
    why: fails.join(' · '),
    paperThree: paperThree.length,
    rows: [...rows].sort((a, b) => a[0] - b[0]).map(([no, r]) => ({ no, ...r })),
  })
}

// ── 보고 ──────────────────────────────────────────────────────────────
const known = new Set(
  JSON.parse(fs.readFileSync(path.join(DIR, 'mock-answers.json'), 'utf8')).answers.map((a) => a.exam),
)
console.log('')
for (const r of results.sort((a, b) => String(a.exam).localeCompare(String(b.exam)))) {
  const mark = r.ok ? '✓' : '✗'
  const dup = r.exam && known.has(r.exam) ? ' (이미 있음 — 대조용)' : ''
  console.log(`  ${mark} ${String(r.exam ?? '?').padEnd(7)} ${r.file.slice(0, 12)}  ${r.ok ? `문제지 [3점] ${r.paperThree}개 대조 통과` : r.why}${dup}`)
}

const fresh = results.filter((r) => r.ok && r.exam && !known.has(r.exam))
console.log(`\n  검증 통과 ${results.filter((r) => r.ok).length} · 그중 **새로 채울 회차 ${fresh.length}**`)
if (!fresh.length) {
  console.log('  새로 채울 것이 없다.')
  process.exit(0)
}

const out = {
  why:
    '평가원 공개 정답표 PDF 에서 기계로 해독한 모의평가 정답. 사용자 폴더의 `_정답표.pdf` 가 ' +
    '듣기 대본이었던 7회차를 메운다(파일명 규칙이 회차마다 달라 잘못 받혔다). ' +
    '`ingest-kice-keys.mjs` 가 넷을 검산해 통과한 것만 적는다 — 45문항 · 정답 1~5 · 배점 합 100 · ' +
    '문제지의 [3점] 표시가 정답표의 3점 집합에 들어 있을 것. build-corpus 는 `mock-answers.json` 에 ' +
    '없는 회차만 여기서 가져간다(주 파이프라인을 덮지 않는다).',
  source: 'https://www.suneung.re.kr/boardCnts/list.do?boardID=1500236&m=0403&s=suneung (한국교육과정평가원)',
  built_at: new Date().toISOString().slice(0, 10),
  answers: fresh.flatMap((r) =>
    r.rows.map((x) => ({ exam: r.exam, no: x.no, answer: x.answer, answers: [x.answer], points: x.points, multi: false })),
  ),
}

if (!COMMIT) {
  console.log('\n  미리보기다 — 아무것도 쓰지 않았다. 반영하려면 --commit')
  process.exit(0)
}
fs.writeFileSync(path.join(DIR, 'mock-answers-kice.json'), JSON.stringify(out, null, 1))
console.log(`→ mock-answers-kice.json (${out.answers.length}행 · ${fresh.length}회차)`)

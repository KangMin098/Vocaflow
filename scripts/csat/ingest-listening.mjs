// scripts/csat/ingest-listening.mjs
//
// **듣기 대본을 코퍼스에 넣는다 — 설계도의 가장 큰 구멍.**
//
// 지금까지 이 설계도는 **읽기 23문항 + 장문 5문항**만 다뤘다.
// 듣기 17문항은 "음성이라 지면에 없다" 는 이유로 통째로 빠져 있었다.
// **배점으로는 34점, 회차의 38%** 다. 대본 PDF 가 저장소 밖에 있었다.
//
// 대본 형식은 읽기 문제지보다 훨씬 단순하다 — 1단 조판에
//   `N. <한글 발문>` 다음 `M:` / `W:` 발화가 이어진다.
// 그래서 2단 복원이 필요 없다.
//
// 2026-09-07 재작업 — 수능 7개년(119문항)에서 **수능 + 평가원 모의평가**로. 알아낸 것 셋:
//   ① **경로가 두 겹으로 낡아 있었다.** 원본이 `Documents/수능영어기출` →
//      `Documents/영어/수능영어기출` 로 옮겨졌고, 그 안에서 다시 `BACKUP/` 이 끼었다.
//      하드코딩 하나였으므로 이 스크립트는 **돌리면 그냥 죽는 상태**였다(0회분이 아니라 예외).
//      `ingest-mock.mjs` 는 같은 사고를 겪고 후보 훑기로 고쳤는데 이 파일에는 반영되지 않았다.
//   ② **모의평가 대본 9회차가 놀고 있었다.** 읽기 파이프라인이 "문제지가 아니다" 로
//      걸러낸 파일들이 실은 대본이다 — 버릴 것이 아니라 **이 스크립트의 입력**이었다.
//   ③ 그래서 **파일명을 믿지 않는다.** `..._정답표.pdf` 인데 대본인 것이 7,
//      `..._문제지.pdf` 인데 대본인 것이 2. 1쪽을 읽어 대본인지 판정하고,
//      회차 번호도 파일명이 아니라 **표제에서** 뽑는다(`202009_문제지` 는 실제로 2021학년도 6월이다).
//
// 실행: pnpm dlx tsx scripts/csat/ingest-listening.mjs

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'

const PDFTOTEXT = 'C:/Program Files/Git/mingw64/bin/pdftotext.exe'
const DIR = path.resolve('scripts/csat/data')
const OUT = path.join(DIR, 'listening')

/**
 * 원본 뿌리를 **후보로** 훑는다 — §① 참조. 하드코딩 하나만 두면 폴더가 움직인 날
 * 스크립트가 죽거나(이 파일이 그랬다) 조용히 0회분을 넣는다.
 */
function resolveRoot(label, candidates) {
  const hit = candidates.filter(Boolean).find((d) => fs.existsSync(d))
  if (!hit) throw new Error(`${label} 원본 폴더를 못 찾았다: ${candidates.filter(Boolean).join(' · ')}`)
  return hit
}

const SUNEUNG_ROOT = resolveRoot('수능 기출', [
  process.env.CSAT_SUNEUNG_DIR,
  'C:/Users/Administrator/Documents/영어/수능영어기출/BACKUP',
  'C:/Users/Administrator/Documents/영어/수능영어기출',
  'C:/Users/Administrator/Documents/수능영어기출',
])
const MOCK_ROOT = resolveRoot('모의평가', [
  process.env.CSAT_MOCK_DIR,
  'C:/Users/Administrator/Documents/영어/모의평가',
  'C:/Users/Administrator/Documents/수능영어기출/모의평가',
])

function pdfText(abs, { firstPageOnly = false } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lis-'))
  const src = path.join(tmp, 'in.pdf'), dst = path.join(tmp, 'out.txt')
  try {
    fs.copyFileSync(abs, src)
    const args = ['-layout', '-enc', 'UTF-8']
    if (firstPageOnly) args.push('-f', '1', '-l', '1')
    execFileSync(PDFTOTEXT, [...args, src, dst], { stdio: 'pipe' })
    return fs.readFileSync(dst, 'utf8').replace(/\r/g, '')
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
}

/**
 * **1쪽만 읽어 대본인지 판정하고 회차를 뽑는다** — §③ 참조.
 * 파일명은 회차도 종류도 말해 주지 않는다. 표제가 정본이다.
 * 반환: `{ isScript, exam }` — `exam` 은 수능이면 `'2023'`, 모평이면 `'M2306'`.
 */
function identify(abs) {
  let head
  try { head = pdfText(abs, { firstPageOnly: true }) } catch { return { isScript: false, exam: null } }
  const flat = head.replace(/\s+/g, ' ')
  const isScript = /듣기\s*평가\s*대본/.test(flat)
  const m = flat.match(/(20\d\d)\s*학년도\s*대학수학능력시험\s*(?:(\d{1,2})\s*월\s*모의평가)?/)
  if (!m) return { isScript, exam: null }
  const year = m[1]
  const exam = m[2] ? `M${year.slice(2)}${String(+m[2]).padStart(2, '0')}` : year
  return { isScript, exam }
}

/** 수능 대본 — 회차마다 폴더·파일명이 달라 손으로 적는다. 회차 번호는 그래도 표제에서 확인한다. */
const SUNEUNG_FILES = [
  '3교시_영어영역_문제지/3교시_영어영역_듣기평가대본.pdf',
  '3교시_영어영역_문제지_2017/영어_듣기대본.pdf',
  '3교시_영어영역_문제지_2018/영어_듣기대본.pdf',
  '3교시_영어영역_문제지_2019/영어_듣기대본.pdf',
  '3교시_영어영역_문제지_2020/영어_듣기대본.pdf',
  '3교시_영어영역_문제지_2021/영어_듣기대본.pdf',
  '3교시_영어영역_문제지_2022/영어_듣기대본.pdf',
]

/**
 * **유형을 발문에서 붙인다** — `ingest-mock.mjs` 의 `classify` 와 같은 표·같은 정규화를 쓴다.
 *
 * ⚠️ 이것은 `classified.json` 을 **덮지 않는다.** 거기 행이 있으면 그것이 정본이고,
 *    여기 것은 행이 없는 회차(= 모의평가 듣기)의 구멍만 메운다. 덮게 두면 손으로 들여온 것이
 *    파이프라인의 퇴행을 가린다. 계측 쪽(`measure-listening.mjs`)이 그 우선순위를 지킨다.
 */
const TYPES = JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8')).types
  .filter((t) => t.id.startsWith('L-'))
  .map((t) => ({ id: t.id, re: new RegExp(t.match.replace(/^\/|\/$/g, '')) }))

function classifyStem(stem) {
  const norm = String(stem ?? '').replace(/\s+/g, '')
  return TYPES.filter((t) => t.re.test(norm)).map((t) => t.id)
}

/** 소스 목록을 **내용으로** 만든다. 대본이 아닌 것은 조용히 버리지 말고 세어서 보고한다. */
const SRC = []
const rejected = []
for (const rel of SUNEUNG_FILES) {
  const abs = path.join(SUNEUNG_ROOT, rel)
  if (!fs.existsSync(abs)) { rejected.push({ file: rel, why: '파일 없음' }); continue }
  const { isScript, exam } = identify(abs)
  if (!isScript) { rejected.push({ file: rel, why: '대본 아님' }); continue }
  if (!exam) { rejected.push({ file: rel, why: '표제에서 회차를 못 뽑음' }); continue }
  SRC.push({ exam, abs, origin: '수능' })
}
for (const f of fs.readdirSync(MOCK_ROOT).filter((x) => x.toLowerCase().endsWith('.pdf')).sort()) {
  const abs = path.join(MOCK_ROOT, f)
  const { isScript, exam } = identify(abs)
  if (!isScript) continue                                    // 문제지·정답표 — 읽기 파이프라인 소관
  if (!exam) { rejected.push({ file: f, why: '표제에서 회차를 못 뽑음' }); continue }
  if (SRC.some((s) => s.exam === exam)) { rejected.push({ file: f, why: `회차 중복 — ${exam}` }); continue }
  SRC.push({ exam, abs, origin: '모평' })
}
// **순서는 취향이 아니라 diff 다.** 뒤에 붙는 계측 산출물(`response-modes.json` 등)이
// 값이 같은 문항을 만난 순서로 가르므로, 회차 순서를 건드리면 내용이 그대로인데도 파일이
// 통째로 흔들리고 그 잡음이 진짜 변화를 덮는다. 그래서 **수능은 원래 적힌 순서 그대로**
// 두고(`SUNEUNG_FILES` 의 배열 순서 — 2023 이 맨 앞인 것도 그 때문이다) 모평만 뒤에 붙인다.
const ORDER = { 수능: 0, 모평: 1 }
SRC.sort((a, b) => (ORDER[a.origin] - ORDER[b.origin]) || (ORDER[a.origin] === 1 ? a.exam.localeCompare(b.exam) : 0))

/**
 * 대본을 문항으로 가른다.
 * ⚠️ 쪽 번호(`-1-`)·머리글을 걷어내야 한다. 그것들이 발화에 섞이면 낱말 수가 부풀려진다.
 */
function parseScript(raw, exam) {
  const lines = raw.split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => !/^\s*-\s*\d+\s*-\s*$/.test(l))              // 쪽 번호
    .filter((l) => !/대학수학능력시험|듣기평가\s*대본|영어\s*영역/.test(l))  // 머리글

  const items = []
  let cur = null
  let setOf = null      // `[16~17]` 세트 — 담화 하나를 두 문항이 나눠 쓴다
  for (const l of lines) {
    // ⚠️ 16·17 은 **담화를 공유**한다. 세트 머리글을 따로 잡지 않으면
    //    두 문항이 통째로 빠진다(첫 판에서 7회차 전부 15/17 이었다).
    const ms = l.match(/^\s*\[\s*(\d{1,2})\s*[~～∼〜–—-]\s*(\d{1,2})\s*\]\s*(.*)$/)
    if (ms) {
      if (cur) items.push(cur)
      cur = null
      setOf = { from: +ms[1], to: +ms[2], stem: ms[3].trim(), turns: [] }
      continue
    }
    const m = l.match(/^\s*(\d{1,2})\s*[.．]\s*(.*[가-힣].*)$/)
    if (m && +m[1] >= 1 && +m[1] <= 17) {
      // 세트 안의 문항 번호면 발문만 갈아 끼우고 담화는 세트 것을 쓴다
      if (setOf && +m[1] >= setOf.from && +m[1] <= setOf.to) {
        items.push({ exam, no: +m[1], stem: m[2].trim(), turns: setOf.turns, fromSet: `${setOf.from}~${setOf.to}` })
        cur = null
        continue
      }
      if (cur) items.push(cur)
      cur = { exam, no: +m[1], stem: m[2].trim(), turns: [] }
      continue
    }
    if (!cur && !setOf) continue
    if (!cur && setOf) {
      // 세트 담화를 모으는 중
      const t2 = l.trim()
      if (t2) {
        const sp2 = t2.match(/^([MWGB])\s*:\s*(.*)$/)
        if (sp2) setOf.turns.push({ who: sp2[1], text: sp2[2].trim() })
        else if (setOf.turns.length) setOf.turns[setOf.turns.length - 1].text += ' ' + t2
        else setOf.turns.push({ who: '?', text: t2 })
      }
      continue
    }
    const t = l.trim()
    if (!t) continue
    const sp = t.match(/^([MWGB])\s*:\s*(.*)$/)               // M/W (+ 일부 회차 G/B)
    if (sp) cur.turns.push({ who: sp[1], text: sp[2].trim() })
    else if (cur.turns.length) cur.turns[cur.turns.length - 1].text += ' ' + t
    else cur.turns.push({ who: '?', text: t })                 // 발화 표시 없는 담화(1·9번 등)
  }
  if (cur) items.push(cur)

  for (const it of items) {
    for (const t of it.turns) t.text = t.text.replace(/\s+/g, ' ').trim()
    it.turns = it.turns.filter((t) => t.text.length > 1)
    it.script = it.turns.map((t) => t.text).join(' ')
    it.words = (it.script.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length
    it.nTurns = it.turns.length
    it.speakers = [...new Set(it.turns.map((t) => t.who))].filter((w) => w !== '?')
    it.isDialogue = it.speakers.length >= 2
    const hits = classifyStem(it.stem)
    it.typeGuess = hits.length === 1 ? hits[0] : null   // 여러 개 걸리면 판정하지 않는다
    it.typeGuessAll = hits
  }
  return items.filter((it) => it.words >= 20)
}

fs.mkdirSync(OUT, { recursive: true })
const all = []
console.log('듣기 대본 편입')
console.log('='.repeat(72))
console.log(`  수능 ${SUNEUNG_ROOT}`)
console.log(`  모평 ${MOCK_ROOT}`)
console.log(`  대본으로 판정된 회차 ${SRC.length} (수능 ${SRC.filter((s) => s.origin === '수능').length} · 모평 ${SRC.filter((s) => s.origin === '모평').length})`)
console.log('='.repeat(72))
console.log('  출처  회차     문항   낱말 중앙값   턴 중앙값   대화형/담화형')
console.log('  ' + '-'.repeat(68))
const failed = []
for (const s of SRC) {
  let items
  try { items = parseScript(pdfText(s.abs), s.exam) } catch (e) {
    console.log(`  ${s.origin}  ${s.exam}  실패: ${String(e.message).slice(0, 40)}`)
    failed.push({ exam: s.exam, why: String(e.message).slice(0, 80) })
    continue
  }
  fs.writeFileSync(path.join(OUT, `${s.exam}.json`), JSON.stringify(items, null, 1))
  all.push(...items)
  const med = (a) => { const x = [...a].sort((p, q) => p - q); return x[Math.floor(x.length / 2)] }
  const dlg = items.filter((i) => i.isDialogue).length
  console.log(
    `  ${s.origin}  ${s.exam.padEnd(6)} ${String(items.length).padStart(4)} ${String(med(items.map((i) => i.words))).padStart(12)} ` +
    `${String(med(items.map((i) => i.nTurns))).padStart(11)}   ${dlg}/${items.length - dlg}`,
  )
}
console.log()
console.log(`  전체 ${all.length}문항 · 낱말 합계 ${all.reduce((s, i) => s + i.words, 0).toLocaleString()}`)

// ⚠️ **분모를 적는다.** 2014학년도만 듣기가 22번까지고 그 외는 17번까지인데, 여기 들어오는
//    회차는 전부 후자다. "전부" 라고 쓰려면 회차 수를 세어서 함께 적어야 한다.
const PER_EXAM = 17
const miss = []
for (const s of SRC) {
  const got = new Set(all.filter((i) => i.exam === s.exam).map((i) => i.no))
  const m = []
  for (let n = 1; n <= PER_EXAM; n += 1) if (!got.has(n)) m.push(n)
  if (m.length) miss.push(`${s.exam}: ${m.join(',')}`)
}
console.log(
  miss.length
    ? `  ⚠️ 누락 — ${miss.join(' · ')}`
    : `  누락 0 — ${SRC.length}회차 × ${PER_EXAM}문항 전부 (${SRC.length * PER_EXAM})`,
)
if (rejected.length) {
  console.log(`\n  대본이 아니어서 뺀 것 ${rejected.length}:`)
  for (const r of rejected) console.log(`    ${r.file} — ${r.why}`)
}

fs.writeFileSync(path.join(DIR, 'listening-all.json'), JSON.stringify({
  n: all.length,
  exams: SRC.map((s) => ({ exam: s.exam, origin: s.origin })),
  rejected,
  failed,
  items: all,
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'listening-all.json')} · listening/<exam>.json`)

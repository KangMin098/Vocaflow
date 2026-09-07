// scripts/csat/ingest-listening.mjs
//
// **듣기 대본 7개년을 코퍼스에 넣는다 — 설계도의 가장 큰 구멍.**
//
// 지금까지 이 설계도는 **읽기 23문항 + 장문 5문항**만 다뤘다.
// 듣기 17문항은 "음성이라 지면에 없다" 는 이유로 통째로 빠져 있었다.
// **배점으로는 34점, 회차의 38%** 다. 대본 PDF 가 저장소 밖에 7개년 있었다.
//
// 대본 형식은 읽기 문제지보다 훨씬 단순하다 — 1단 조판에
//   `N. <한글 발문>` 다음 `M:` / `W:` 발화가 이어진다.
// 그래서 2단 복원이 필요 없다.
//
// 실행: pnpm dlx tsx scripts/csat/ingest-listening.mjs

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'

const BASE = 'C:/Users/Administrator/Document' + 's/수능영어기출'
const PDFTOTEXT = 'C:/Program Files/Git/mingw64/bin/pdftotext.exe'
const DIR = path.resolve('scripts/csat/data')
const OUT = path.join(DIR, 'listening')

const SRC = [
  { exam: '2023', file: '3교시_영어영역_문제지/3교시_영어영역_듣기평가대본.pdf' },
  { exam: '2017', file: '3교시_영어영역_문제지_2017/영어_듣기대본.pdf' },
  { exam: '2018', file: '3교시_영어영역_문제지_2018/영어_듣기대본.pdf' },
  { exam: '2019', file: '3교시_영어영역_문제지_2019/영어_듣기대본.pdf' },
  { exam: '2020', file: '3교시_영어영역_문제지_2020/영어_듣기대본.pdf' },
  { exam: '2021', file: '3교시_영어영역_문제지_2021/영어_듣기대본.pdf' },
  { exam: '2022', file: '3교시_영어영역_문제지_2022/영어_듣기대본.pdf' },
]

function pdfText(rel) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lis-'))
  const src = path.join(tmp, 'in.pdf'), dst = path.join(tmp, 'out.txt')
  try {
    fs.copyFileSync(path.join(BASE, rel), src)
    execFileSync(PDFTOTEXT, ['-layout', '-enc', 'UTF-8', src, dst], { stdio: 'pipe' })
    return fs.readFileSync(dst, 'utf8').replace(/\r/g, '')
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
}

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
  }
  return items.filter((it) => it.words >= 20)
}

fs.mkdirSync(OUT, { recursive: true })
const all = []
console.log('듣기 대본 편입')
console.log('='.repeat(64))
console.log('  회차   문항   낱말 중앙값   턴 중앙값   대화형/담화형')
console.log('  ' + '-'.repeat(60))
for (const s of SRC) {
  let items
  try { items = parseScript(pdfText(s.file), s.exam) } catch (e) {
    console.log(`  ${s.exam}  실패: ${String(e.message).slice(0, 40)}`); continue
  }
  fs.writeFileSync(path.join(OUT, `${s.exam}.json`), JSON.stringify(items, null, 1))
  all.push(...items)
  const med = (a) => { const x = [...a].sort((p, q) => p - q); return x[Math.floor(x.length / 2)] }
  const dlg = items.filter((i) => i.isDialogue).length
  console.log(
    `  ${s.exam}  ${String(items.length).padStart(4)} ${String(med(items.map((i) => i.words))).padStart(12)} ` +
    `${String(med(items.map((i) => i.nTurns))).padStart(11)}   ${dlg}/${items.length - dlg}`,
  )
}
console.log()
console.log(`  전체 ${all.length}문항 · 낱말 합계 ${all.reduce((s, i) => s + i.words, 0).toLocaleString()}`)
const miss = []
for (const s of SRC) {
  const got = new Set(all.filter((i) => i.exam === s.exam).map((i) => i.no))
  const m = []
  for (let n = 1; n <= 17; n += 1) if (!got.has(n)) m.push(n)
  if (m.length) miss.push(`${s.exam}: ${m.join(',')}`)
}
console.log(miss.length ? `  ⚠️ 누락 — ${miss.join(' · ')}` : '  누락 0 — 7회차 × 17문항 전부')

fs.writeFileSync(path.join(DIR, 'listening-all.json'), JSON.stringify({ n: all.length, items: all }, null, 1))
console.log(`\n→ ${path.join(DIR, 'listening-all.json')} · listening/<exam>.json`)

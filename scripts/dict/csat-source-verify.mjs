// scripts/dict/csat-source-verify.mjs
//
// **원본 .txt 가 정말 그 이름의 시험지인지 PDF 로 대조한다 — 읽기 전용.**
//
// 왜: 2014 에서 `2014_A.txt`·`2014_B.txt` 가 **둘 다 B형**이었다(2026-08-22 실측).
// 어휘 일치도로 재니 기존 txt ↔ B형 PDF 99.8% · ↔ A형 PDF 25.3% 였고, A형은 추출된 적이 없었다.
// 이름이 내용과 반대인 사례가 실제로 나왔으므로 **나머지 연도도 이름을 믿지 않고 대조한다.**
// 코퍼스 전체가 이 .txt 들 위에 서 있어서, 한 해가 틀리면 빈도·연도 통계가 조용히 틀린다.
//
// 방법: 각 PDF 를 `pdftotext` 로 뽑아 어휘 집합을 만들고, 각 .txt 의 어휘 집합과
// Jaccard 일치도를 잰다. txt 마다 **가장 잘 맞는 PDF** 가 이름이 가리키는 그 PDF 인지 본다.
// 한글은 pdftotext 가 Adobe-Korea1 CMap 을 못 찾아 유실되지만 어휘 대조는 영문만 쓴다.
//
// 전제: `pdftotext` (poppler). Git for Windows 에 함께 온다.
//
// 실행: pnpm dlx tsx scripts/dict/csat-source-verify.mjs [--dir <기출 폴더>]

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const SRC = arg('dir') ?? 'C:/Users/Administrator/Documents/수능영어기출/최종'
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'csatverify-'))

/** 영문 낱말 집합 — 대조에 쓰는 유일한 신호(한글은 PDF 추출에서 유실된다). */
const vocab = (text) => new Set(text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [])
const jaccard = (a, b) => {
  const inter = [...a].filter((v) => b.has(v)).length
  const union = a.size + b.size - inter
  return union ? inter / union : 0
}

const pdfs = fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.pdf')).sort()
const txts = fs.readdirSync(SRC).filter((f) => /^\d{4}(_[A-Za-z]+)?\.txt$/.test(f)).sort()

console.log(`PDF ${pdfs.length} · TXT ${txts.length}`)

const pdfVocab = new Map()
for (const p of pdfs) {
  const out = path.join(TMP, p.replace(/[^\w.]/g, '_') + '.txt')
  try {
    execFileSync('pdftotext', ['-enc', 'UTF-8', path.join(SRC, p), out], { stdio: 'ignore' })
  } catch {
    // 한글 CMap 경고로 0 이 아닌 코드를 낼 수 있으나 영문은 나온다 — 파일이 생겼으면 계속한다.
  }
  if (!fs.existsSync(out)) {
    console.log(`  ⚠️ ${p} — 추출 실패, 건너뜀`)
    continue
  }
  pdfVocab.set(p, vocab(fs.readFileSync(out, 'utf8')))
}

/** 파일명에서 연도와 형(A/B·홀/짝)을 뽑아 "이름이 가리키는 PDF" 를 고른다. */
function expectedPdf(txt) {
  const year = txt.slice(0, 4)
  const form = (txt.match(/^\d{4}_([A-Za-z]+)\.txt$/) ?? [])[1] ?? null
  const sameYear = pdfs.filter((p) => p.startsWith(year))
  if (sameYear.length === 1) return sameYear
  if (form) {
    const letter = form[0].toUpperCase() // A / B
    const hit = sameYear.filter((p) => new RegExp(`영어${letter}`).test(p))
    if (hit.length) return hit
  }
  return sameYear
}

const rows = []
for (const t of txts) {
  const tv = vocab(fs.readFileSync(path.join(SRC, t), 'utf8'))
  const scored = [...pdfVocab.entries()]
    .map(([p, pv]) => ({ pdf: p, score: jaccard(tv, pv) }))
    .sort((a, b) => b.score - a.score)
  const best = scored[0]
  const expected = expectedPdf(t)
  const ok = expected.includes(best.pdf)
  rows.push({ txt: t, best: best.pdf, score: best.score, expected, ok, runnerUp: scored[1] })
}

console.log('')
console.log('TXT                 가장 잘 맞는 PDF                              일치도   2위    판정')
console.log('─'.repeat(104))
for (const r of rows) {
  console.log(
    `${r.txt.padEnd(19)} ${r.best.slice(0, 42).padEnd(43)} ${(r.score * 100).toFixed(1).padStart(5)}%  ` +
      `${(r.runnerUp ? r.runnerUp.score * 100 : 0).toFixed(1).padStart(5)}%  ${r.ok ? '✅' : '❌ 이름과 다름'}`,
  )
}

/**
 * 이름은 어긋나지만 **이미 확인하고 빌더가 처리하는** 파일.
 * 원본 파일 이름을 고치는 쪽이 깔끔하지만 사용자 자료를 건드리지 않는다 —
 * 대신 여기에 적어 두어, 새로 생긴 불일치와 구분한다. 지우면 안 되는 목록이다.
 */
const KNOWN = {
  '2014_A.txt': {
    actual: '2014_영어B-홀수형_문제.pdf',
    why: '이름은 A형이나 내용은 B형(어휘 99.8%). A형은 2014_Aform.txt 로 따로 넣었고 빌더가 둘 다 읽는다',
  },
}
const isKnown = (r) => KNOWN[r.txt] && KNOWN[r.txt].actual === r.best
const known = rows.filter((r) => !r.ok && isKnown(r))
const bad = rows.filter((r) => !r.ok && !isKnown(r))
for (const r of known) console.log(`  ℹ️ ${r.txt} — 알려진 불일치(처리됨): ${KNOWN[r.txt].why}`)
const weak = rows.filter((r) => r.ok && r.score < 0.6)
console.log('')
console.log(`새로 발견된 불일치 ${bad.length}건 · 알려진·처리된 불일치 ${known.length}건 · 일치도 60% 미만 ${weak.length}건`)
for (const r of bad) console.log(`  ❌ ${r.txt} — 이름은 [${r.expected.join(', ')}] 인데 내용은 ${r.best} (${(r.score * 100).toFixed(1)}%)`)
for (const r of weak) console.log(`  ⚠️ ${r.txt} — 이름은 맞지만 일치도 ${(r.score * 100).toFixed(1)}% (추출 손실 의심)`)

// PDF 쪽에서도 본다 — 어떤 PDF 도 대응하는 txt 가 없으면 그 회분은 코퍼스에서 통째로 빠진 것이다.
const claimed = new Set(rows.map((r) => r.best))
const orphanPdfs = [...pdfVocab.keys()].filter((p) => !claimed.has(p))
console.log('')
console.log(`대응하는 .txt 가 없는 PDF ${orphanPdfs.length}건 — 있으면 그 회분이 코퍼스에서 빠져 있다`)
for (const p of orphanPdfs) console.log(`  ⚠️ ${p}`)

try { fs.rmSync(TMP, { recursive: true, force: true }) } catch { /* 임시 폴더는 남아도 무해 */ }
process.exit(bad.length === 0 && orphanPdfs.length === 0 ? 0 : 1)

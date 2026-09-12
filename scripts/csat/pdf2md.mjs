// PDF → 구조화 Markdown.
//
// 1판(extract-ko.mjs)은 y좌표를 정수 반올림해 묶어서, 본문보다 작은 글자(문항 번호·각주)가
// 다른 줄로 떨어져 나갔다 — "따라서 번부터 번까지" + 별도 줄의 "1823" 같은 파손이 생긴다.
// 여기서는 **글자 높이에 비례한 허용오차**로 묶고, x 간격이 크면 공백을 넣는다.
//
// 사용: node pdf2md.mjs <in.pdf> <out.md> [password]

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const pdfjsPath = require.resolve('pdfjs-dist/legacy/build/pdf.mjs')
const pdfjs = await import(pathToFileURL(pdfjsPath).href)
const base = path.dirname(pdfjsPath)

const [, , src, out, pw] = process.argv
const doc = await pdfjs.getDocument({
  data: new Uint8Array(fs.readFileSync(src)),
  password: pw || undefined,
  cMapUrl: path.join(base, '../../cmaps/'),
  cMapPacked: true,
  standardFontDataUrl: path.join(base, '../../standard_fonts/'),
}).promise

// 페이지마다 반복되는 머리글·꼬리글을 자동으로 찾아 지운다
const pageLines = []
for (let p = 1; p <= doc.numPages; p += 1) {
  const page = await doc.getPage(p)
  const tc = await page.getTextContent()
  const items = tc.items.filter((i) => i.str && i.str.trim())
  if (!items.length) { pageLines.push([]); continue }

  // 글자 높이 기준 허용오차로 줄 묶기
  const H = items.reduce((s, i) => s + Math.abs(i.height || 10), 0) / items.length
  const tol = Math.max(2, H * 0.55)
  const sorted = [...items].sort((a, b) => b.transform[5] - a.transform[5])
  const groups = []
  for (const it of sorted) {
    const y = it.transform[5]
    const g = groups.find((x) => Math.abs(x.y - y) <= tol)
    if (g) { g.items.push(it); g.y = (g.y * g.items.length + y) / (g.items.length + 1) }
    else groups.push({ y, items: [it] })
  }
  const lines = groups.map((g) => {
    const row = g.items.sort((a, b) => a.transform[4] - b.transform[4])
    let s = ''
    let prevEnd = null
    for (const it of row) {
      const x = it.transform[4]
      // ⚠️ 한글은 어절 사이 간격이 글자폭의 0.3~0.5 배다. 임계 1.2 로는 공백이 통째로 사라진다.
      const cw = (it.width || 0) / Math.max(1, it.str.length)
      if (prevEnd !== null && cw > 0 && x - prevEnd > cw * 0.32 && !s.endsWith(' ') && !it.str.startsWith(' ')) s += ' '
      s += it.str
      prevEnd = x + (it.width || 0)
    }
    return s.replace(/\s+/g, ' ').trim()
  }).filter((l) => l.length)
  pageLines.push(lines)
  if (p % 50 === 0) console.log(`  ${p}/${doc.numPages}`)
}

// 5쪽 이상에서 반복되는 줄 = 머리글/꼬리글
const freq = new Map()
for (const lines of pageLines) for (const l of new Set(lines)) freq.set(l, (freq.get(l) ?? 0) + 1)
const boiler = new Set([...freq].filter(([l, n]) => n >= 5 && l.length < 90).map(([l]) => l))
console.log(`반복 줄(머리글·꼬리글) ${boiler.size}종 제거`)

// 구조 인식
const isPart = (l) => /^PART\s*0?\d/.test(l) || /^(발문|문장|단락|실전)\s*독해\s*$/.test(l)
const isPattern = (l) => /^Pattern\s*\d{1,2}\b/.test(l)
const isTypeHead = (l) => /^(대의파악|세부사항|빈칸추론|간접쓰기|어휘|문법어휘)\s*유형\s*$/.test(l)
const isExample = (l) => /^\d{4}\s*년\s*수능\s*\d{1,2}\s*번\s*문제/.test(l)

const md = ['# 수능 영어영역 기출분석의 절대적 코드 — 전문 변환', '',
  '> 장진우 지음 · 지식과감성 · 2016. 사용자 제공 PDF를 이 프로젝트 분석용으로 변환한 것이다.',
  '> **저작권은 저자와 출판사에 있다. 재배포 금지.** 저장소에 커밋하지 않는다.',
  '', '---', '']

for (let p = 0; p < pageLines.length; p += 1) {
  const lines = pageLines[p].filter((l) => !boiler.has(l))
  if (!lines.length) continue
  md.push(`<!-- p.${p + 1} -->`)
  for (const l of lines) {
    if (isPart(l)) md.push('', `## ${l}`, '')
    else if (isPattern(l)) md.push('', `### ${l}`, '')
    else if (isTypeHead(l)) md.push('', `### ${l}`, '')
    else if (isExample(l)) md.push('', `**${l}**`, '')
    else md.push(l)
  }
  md.push('')
}

const text = md.join('\n').replace(/\n{4,}/g, '\n\n\n')
fs.writeFileSync(out, text)
const ko = (text.match(/[가-힣]/g) || []).length
const en = (text.match(/[A-Za-z]/g) || []).length
console.log(`한글 ${ko} · 영문 ${en} · ${(text.length / 1024).toFixed(0)}KB → ${out}`)

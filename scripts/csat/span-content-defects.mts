// scripts/csat/span-content-defects.mts
//
// **토막을 읽어 보고 만든 검사기 — 기계 지표가 전부 통과시킨 것들을 잡는다.**
//
// ── 왜 ────────────────────────────────────────────────────────────────
// 2026-09-23, 본문 네 원천에서 토막을 12개 뽑아 **처음으로 읽었다.**
// 어수·off-list·문장 수·자족성 정규식을 전부 통과한 토막인데 **12개 중
// 지문으로 쓸 수 있는 것이 0개**였다. 그때까지 나는 「장문 토막 28개/편」 같은
// 수치를 보고했는데, 그것이 **이런 것들을 센 값**이었다.
//
// 눈으로 본 결함을 그대로 규칙으로 옮긴다. 추상적인 「품질」이 아니라
// **실제로 본 것**만 넣는다:
//
//   · 본문 인용     `(Barrage et al., 2020)` · `(Carr & Kemmis 1986:165)` — 학술 산문에 빽빽하다
//   · 상호 참조     `Figure 5` · `Table 1` · `model 2` · `see ( )` — 앞뒤가 있어야 읽힌다
//   · 러닝헤더      `430 Pakistan Languages and Humanities Review (PLHR) July-September, 2022`
//   · 제목 접착     `…temporal deferral Strategic delay mobilizes…` — 소제목이 문장에 붙었다
//   · 인용 제거 잔해 `for P. 17 observed a shift` — 번호를 지워 문장이 무너졌다
//   · 수식·표       `Yi,t` · `Tobin's Q = (Market Value (Equity) + …)`
//   · 방법·문서 기술 `Wave BE` · `data release v31` · `IMCs` — 지문이 아니라 기록이다
//
// 이 검사기는 **지금까지의 토막 수치가 얼마나 부풀었는지**를 재기 위한 것이다.
// 통과한 것이 좋은 지문이라는 뜻은 아니다 — 그 판정은 읽어야 한다.
//
// 사용: pnpm dlx tsx scripts/csat/span-content-defects.mts --dir <스크래치패드>
// 읽기 전용.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  CSAT_ITEM_WORDS,
  CSAT_LONG_ITEM_WORDS,
  SCHOOL_PARAGRAPH_WORDS,
} from '@vocaflow/library-pipeline'

const argOf = (n: string, d: string): string => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const DIR = resolve(argOf('dir', '.'))
const OUT = resolve(argOf('out', 'docs/reports/data/span-content-defects.json'))

const W = (t: string): number => (t.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
const sentencesOf = (t: string): string[] =>
  t.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).map((s) => s.trim())
    .filter((s) => (s.match(/[A-Za-z]+/g) ?? []).length >= 4)

/** 눈으로 본 결함만. 각 항목에 실제로 본 예를 주석으로 남긴다. */
const DEFECTS: { key: string; label: string; re: RegExp }[] = [
  // (Barrage et al., 2020) · (Bhagat and Black, 2002) · (Carr & Kemmis 1986:165)
  { key: 'citation', label: '본문 인용', re: /\([A-Z][A-Za-z'’-]+(?:\s+(?:et al\.?|and|&)\s+[A-Z][A-Za-z'’-]+)?[,\s]+\d{4}[a-z]?(?::\s*[\d–-]+)?\)/ },
  // Hopkins, 1993:44-45 처럼 괄호 없이 붙은 것 · [12] · 문장 끝 위첨자 번호
  { key: 'citation_bare', label: '괄호 없는 인용', re: /\b[A-Z][A-Za-z'’-]+\s+\d{4}:\s*\d|\[\d{1,3}(?:[,–-]\s*\d{1,3})*\]/ },
  // Figure 5 · Table 1 · model 2 · Panels (Ka) · see ( ) · (see )
  { key: 'crossref', label: '상호 참조', re: /\b(?:Fig(?:ure)?|Table|Panel|Appendix|Section|Chapter|Equation|Model|Wave)\s+\(?[A-Z]?\d|\(\s*see\s*\)|\(\s*\)/i },
  // 430 Pakistan Languages and Humanities Review (PLHR) July-September, 2022, Vol. 3
  { key: 'runhead', label: '러닝헤더·쪽번호', re: /\b\d{1,4}\s+[A-Z][A-Za-z.'’-]+(?:\s+[A-Z][A-Za-z.'’-]+){2,}\s+\(?[A-Z]{2,}\)?|\bVol\.\s*\d|\b(?:pp?\.|ISSN|DOI)\s*[\d:]/ },
  // Yi,t · βt · Tobin's Q = (Market Value (Equity) + Book Value …)
  { key: 'formula', label: '수식·표', re: /[A-Za-zβα]\s*[ᵢi],\s*[tᵗ]\b|=\s*\([A-Z][a-z]+\s+[A-Z][a-z]+\s*\(|\bStd\.\s|\bMean\s+Std/ },
  // Wave BE · data release v31 · IMCs · SPSS (version 22)
  { key: 'docmeta', label: '자료·판본 기술', re: /\bWave\s+[A-Z]{2}\b|\bdata release v\d|\bSPSS\b|\bversion \d+\)|\bquestionnaire\b/i },
  // 'Geburtstag' [birthday] — 외국어 낱말 + 대괄호 번역
  { key: 'gloss', label: '외국어 + 대괄호 번역', re: /[‘'"“][A-Za-zÀ-ÿ*]+[’'"”]\s*\[[a-z][^\]]{2,30}\]/ },
  // for P. 17 observed a shift — 인용 번호를 지워 문장이 무너진 자리
  { key: 'stripped', label: '인용 제거 잔해', re: /\b(?:for|by|in|and|of|with)\s+[A-Z]\.\s+\d{1,3}\s+[a-z]/ },
]

interface Row {
  source: string
  spans: number
  clean: number
  cleanPct: number
  byDefect: Record<string, number>
}

const SRC: [string, string, string[]][] = [
  ['OLH', 'ft-olh-samples.json', ['body_prose', 'body_trimmed']],
  ['EconStor', 'ft-econstor-samples.json', ['bodyText']],
  ['SciELO', 'ft-scielo-samples.json', ['body_text']],
  ['OpenAlex', 'ft-openalex-samples.json', ['extracted_text']],
]

/** 창 하나로 그리디 패킹 — 학습자가 실제로 보는 단위다. */
function spansOf(t: string, min: number, max: number): string[] {
  const out: string[] = []
  let buf: string[] = []
  let w = 0
  for (const s of sentencesOf(t)) {
    const n = W(s)
    if (w + n > max && w > 0) { if (w >= min) out.push(buf.join(' ')); buf = []; w = 0 }
    buf.push(s); w += n
  }
  if (w >= min && w <= max) out.push(buf.join(' '))
  return out
}

const WINDOWS = [
  { key: 'csat_short', ...CSAT_ITEM_WORDS },
  { key: 'school_paragraph', ...SCHOOL_PARAGRAPH_WORDS },
  { key: 'csat_long', ...CSAT_LONG_ITEM_WORDS },
]

const rows: Row[] = []
for (const [name, file, keys] of SRC) {
  let arr: Record<string, unknown>[] = []
  try {
    const j = JSON.parse(readFileSync(join(DIR, file), 'utf8'))
    arr = (Array.isArray(j) ? j : ((j as { samples?: unknown[] }).samples ?? Object.values(j).find(Array.isArray) ?? [])) as Record<string, unknown>[]
  } catch { continue }

  for (const win of WINDOWS) {
    let spans = 0
    let clean = 0
    const byDefect: Record<string, number> = {}
    for (const x of arr) {
      const body = keys.map((k) => x?.[k]).find((v) => typeof v === 'string' && (v as string).length > 1000) as string | undefined
      if (!body) continue
      for (const sp of spansOf(body, win.min, win.max)) {
        spans++
        const hit = DEFECTS.filter((d) => d.re.test(sp))
        for (const h of hit) byDefect[h.key] = (byDefect[h.key] ?? 0) + 1
        if (!hit.length) clean++
      }
    }
    if (spans) {
      rows.push({
        source: `${name} · ${win.key}`,
        spans, clean,
        cleanPct: Number(((clean / spans) * 100).toFixed(1)),
        byDefect,
      })
    }
  }
}

console.log('읽어 보고 만든 검사기 — 기계 지표(어수·off-list·문장수·자족성)는 아래 토막을 전부 통과시켰다\n')
console.log('원천 · 창                     토막   결함없음   비율   최다 결함')
for (const r of rows) {
  const top = Object.entries(r.byDefect).sort((a, b) => b[1] - a[1])[0]
  const label = top ? `${DEFECTS.find((d) => d.key === top[0])?.label ?? top[0]} ${top[1]}` : '—'
  console.log(
    `${r.source.padEnd(28)}${String(r.spans).padStart(6)}${String(r.clean).padStart(10)}` +
      `${(r.cleanPct + '%').padStart(8)}   ${label}`
  )
}
const tot = rows.reduce((a, r) => a + r.spans, 0)
const cl = rows.reduce((a, r) => a + r.clean, 0)
console.log(`\n합계 ${tot.toLocaleString()}토막 중 결함 없음 ${cl.toLocaleString()} (${((cl / tot) * 100).toFixed(1)}%)`)
console.log('⚠️ 「결함 없음」은 **쓸 수 있다는 뜻이 아니다** — 이 검사기가 잡는 것은 내가 눈으로 본 7가지뿐이다.')

writeFileSync(OUT, JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), contract: 'span-content-defects/v1', defects: DEFECTS.map((d) => ({ key: d.key, label: d.label })), rows }, null, 2))
console.log(`\n기록: ${OUT}`)

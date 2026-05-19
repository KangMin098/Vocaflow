// scripts/lexicon-v2.2/kice-csat-parse.ts
//
// Phase 1 — PARSE + NORMALIZE (v2 — multi-sheet aware)
//
// 입력: data/seed/kice-csat/YYYY_수능영어*.xlsx (15개)
// 출력: data/import/kice-csat-staging.csv
//
// 처리 (v2 refactor — inspect 결과 반영):
//   1. 시트 화이트리스트: 이름이 '요약'/'Summary' 제외, 또는 헤더 자동 탐지 성공한 시트만
//   2. 헤더 row 자동 탐지: row0~3 중 (단어|word) AND (품사|pos) AND (뜻|meaning) 포함 row
//   3. 컬럼 인덱스 자동 매핑: 단어/품사/뜻/문항 헤더 텍스트로 인덱스 결정
//   4. 품사 정규화: 'n','n.','v/n','v./n.' 모두 처리
//   5. 출제 문항 multi-parse: "1번/40번" → [1, 40]
//   6. phr. 분기: pos='phr'|'phrase' OR word 에 공백 → pos='phrase'
//   7. 파일 + 시트 내 dedup (lemma, pos) — question_nos 합집합

import * as XLSX from 'xlsx'
import * as fs from 'node:fs'
import * as path from 'node:path'

const DATA_DIR = 'data/seed/kice-csat'
const OUT_FILE = 'data/import/kice-csat-staging.csv'

const POS_MAP: Record<string, string> = {
  n: 'n', 'n.': 'n',
  v: 'v', 'v.': 'v',
  a: 'adj', adj: 'adj', 'a.': 'adj', 'adj.': 'adj',
  ad: 'adv', adv: 'adv', 'ad.': 'adv', 'adv.': 'adv',
  prep: 'prep', 'prep.': 'prep',
  conj: 'conj', 'conj.': 'conj',
  pron: 'pron', 'pron.': 'pron',
  det: 'det', 'det.': 'det',
  interj: 'interj', 'interj.': 'interj',
  phr: 'phrase', 'phr.': 'phrase', phrase: 'phrase',
}

interface ParsedRow {
  year: number
  lemma: string
  pos: string
  meaning_ko: string
  question_nos: number[]
  kice_difficulty: string
}

interface ColumnMap {
  word: number
  pos: number
  meaning: number
  question: number | null
  difficulty: number | null
}

function normalizePosToken(t: string): string {
  const k = t.trim().toLowerCase()
  return POS_MAP[k] ?? k.replace(/\.+$/, '')
}

function normalizePos(raw: string): string[] {
  if (raw.includes('/')) {
    return raw.split('/').map(normalizePosToken).filter(Boolean)
  }
  return [normalizePosToken(raw)]
}

function parseQuestionNos(raw: string): number[] {
  if (!raw) return []
  const out: number[] = []
  // "1번/40번", "1번", "(맥락)", "24번" 등
  const parts = raw.split(/[\/,;]/).map(p => p.trim())
  for (const p of parts) {
    const m = p.match(/(\d+)/)
    if (m) out.push(parseInt(m[1], 10))
  }
  return Array.from(new Set(out))
}

function findHeaderRow(rows: unknown[][]): { headerIdx: number; cols: ColumnMap } | null {
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i]
    if (!row) continue
    const cells = row.map(c => String(c ?? '').toLowerCase())
    const cm: Partial<ColumnMap> = {}
    cells.forEach((cell, idx) => {
      if (cm.word === undefined && (cell.includes('단어') || cell.includes('word'))) cm.word = idx
      if (cm.pos === undefined && (cell.includes('품사') || cell === 'pos')) cm.pos = idx
      if (cm.meaning === undefined && (cell.includes('뜻') || cell.includes('meaning') || cell === '의미')) cm.meaning = idx
      if (cm.question === undefined && (cell.includes('문항') || cell.includes('출제') || cell.includes('출처'))) cm.question = idx
      if (cm.difficulty === undefined && (cell.includes('난이도') || cell.includes('difficulty'))) cm.difficulty = idx
    })
    if (cm.word !== undefined && cm.pos !== undefined && cm.meaning !== undefined) {
      return {
        headerIdx: i,
        cols: {
          word: cm.word,
          pos: cm.pos,
          meaning: cm.meaning,
          question: cm.question ?? null,
          difficulty: cm.difficulty ?? null,
        },
      }
    }
  }
  return null
}

function isSummarySheet(name: string): boolean {
  const n = name.toLowerCase()
  return n.includes('요약') || n.includes('summary') || n.includes('통계') || n.includes('전체')
}

function parseSheet(rows: unknown[][], year: number, buckets: Map<string, ParsedRow>): number {
  const hdr = findHeaderRow(rows)
  if (!hdr) return 0
  const { headerIdx, cols } = hdr
  let added = 0
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r) continue
    const word = String(r[cols.word] ?? '').toLowerCase().trim()
    const posRaw = String(r[cols.pos] ?? '').trim()
    const meaning = String(r[cols.meaning] ?? '').trim()
    if (!word || !posRaw || !meaning) continue
    // 부제목/구분 row skip (단어 칸에 'No.' 같은 게 다시 등장)
    if (word === 'no.' || word === 'no' || word.length > 60) continue

    const qNos = cols.question !== null ? parseQuestionNos(String(r[cols.question] ?? '')) : []
    const diff = cols.difficulty !== null ? String(r[cols.difficulty] ?? '').trim() : ''

    // phr. 분기 — 공백 포함 또는 pos 가 phr
    const posLower = posRaw.toLowerCase().replace(/\./g, '')
    if (posLower === 'phr' || posLower === 'phrase' || word.includes(' ')) {
      const key = `${word}|phrase`
      const existing = buckets.get(key)
      if (existing) {
        existing.question_nos.push(...qNos)
        existing.question_nos = Array.from(new Set(existing.question_nos))
      } else {
        buckets.set(key, {
          year, lemma: word, pos: 'phrase',
          meaning_ko: meaning, question_nos: qNos, kice_difficulty: diff,
        })
        added++
      }
      continue
    }

    const posList = normalizePos(posRaw)
    const meaningParts = meaning.split(',').map(m => m.trim())

    for (let p = 0; p < posList.length; p++) {
      const pos = posList[p]
      if (!pos) continue
      const meaningForPos = posList.length === meaningParts.length
        ? meaningParts[p]
        : meaning
      const key = `${word}|${pos}`
      const existing = buckets.get(key)
      if (existing) {
        existing.question_nos.push(...qNos)
        existing.question_nos = Array.from(new Set(existing.question_nos))
      } else {
        buckets.set(key, {
          year, lemma: word, pos,
          meaning_ko: meaningForPos, question_nos: qNos, kice_difficulty: diff,
        })
        added++
      }
    }
  }
  return added
}

function parseFile(filepath: string, year: number): ParsedRow[] {
  const wb = XLSX.readFile(filepath)
  const buckets = new Map<string, ParsedRow>()
  let processed = 0
  const skipped: string[] = []
  for (const sn of wb.SheetNames) {
    if (isSummarySheet(sn)) { skipped.push(`${sn}(summary)`); continue }
    const ws = wb.Sheets[sn]
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
    const before = buckets.size
    parseSheet(rows, year, buckets)
    const added = buckets.size - before
    if (added === 0) skipped.push(`${sn}(no-header)`)
    else processed++
  }
  if (processed === 0) {
    console.warn(`  ⚠️ ${path.basename(filepath)}: no data sheet processed (skipped: ${skipped.join(', ')})`)
  }
  return Array.from(buckets.values())
}

function main(): void {
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.xlsx'))
    .sort()

  console.log(`[Phase 1 v2] Found ${files.length} xlsx files\n`)

  const allRows: ParsedRow[] = []
  const perYear = new Map<number, number>()

  for (const f of files) {
    const match = f.match(/(\d{4})/)
    if (!match) {
      console.warn(`⚠️ Cannot extract year from ${f}, skipping`)
      continue
    }
    const year = parseInt(match[1], 10)
    const rows = parseFile(path.join(DATA_DIR, f), year)
    console.log(`  ${f} → year=${year}, rows=${rows.length}`)
    allRows.push(...rows)
    perYear.set(year, (perYear.get(year) ?? 0) + rows.length)
  }

  const header = 'year,lemma,pos,meaning_ko,question_nos,kice_difficulty'
  const csv = [header, ...allRows.map(r => {
    const meaning = r.meaning_ko.replace(/"/g, '""')
    const qs = r.question_nos.join(';')
    return `${r.year},"${r.lemma}",${r.pos},"${meaning}","${qs}",${r.kice_difficulty}`
  })].join('\n')

  fs.writeFileSync(OUT_FILE, csv, 'utf-8')
  console.log(`\n✅ Wrote ${allRows.length} rows to ${OUT_FILE}`)
  console.log(`  Unique (lemma, pos) across all years: ${new Set(allRows.map(r => `${r.lemma}|${r.pos}`)).size}`)
  console.log(`\n  Per-year row counts (after intra-file dedup):`)
  for (const y of Array.from(perYear.keys()).sort()) {
    console.log(`    ${y}: ${perYear.get(y)}`)
  }
}

main()

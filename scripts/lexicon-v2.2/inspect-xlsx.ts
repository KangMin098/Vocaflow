// scripts/lexicon-v2.2/inspect-xlsx.ts
// 진단용 — 의심 파일들의 시트 구조 + 첫 10 row 출력
import * as XLSX from 'xlsx'
import * as fs from 'node:fs'
import * as path from 'node:path'

const DATA_DIR = 'data/seed/kice-csat'
const SUSPECT = [
  '2014_수능영어A_어휘목록.xlsx',
  '2014_수능영어B_어휘목록.xlsx',
  '2015_수능영어_어휘목록.xlsx',
  '2018_수능영어_어휘목록.xlsx',
  '2018_수능영어_어휘분류.xlsx',
  '2019_수능영어_단어목록.xlsx', // 비교용 (정상)
]

for (const f of SUSPECT) {
  const fp = path.join(DATA_DIR, f)
  if (!fs.existsSync(fp)) continue
  const wb = XLSX.readFile(fp)
  console.log(`\n===== ${f} =====`)
  console.log(`  sheets:`, wb.SheetNames)
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn]
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
    console.log(`  [sheet "${sn}"] total rows = ${rows.length}`)
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      console.log(`    row${i}:`, JSON.stringify(rows[i]).slice(0, 200))
    }
  }
}

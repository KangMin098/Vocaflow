// scripts/csat/extract-questions.mjs
//
// **수능 영어 기출에서 문항을 프로그램으로 뽑는다 — 읽기 전용.**
//
// 왜 프로그램으로 뽑나: 뒤에서 "설계도가 모든 기출에 100% 맞는다" 를 주장하려면
// 분모(전체 문항)가 **손으로 센 숫자가 아니어야** 한다. 손으로 세면 검증할 수 없다.
//
// 원본의 함정은 `scripts/dict/csat-corpus-build.mjs` 와 같다:
//   · 2023·2024·2026 은 홀수형+짝수형이 한 파일 → 앞 블록만 쓴다(안 가르면 문항이 두 배)
//   · 2014 는 수준별 A/B 두 회분 · `2014_A.txt` 는 이름과 달리 **B형**이다(어휘 99.8% 대조)
//     A형은 `2014_Aform.txt` (PDF 재추출). 둘 다 별개 회분으로 센다.
//
// 산출: scripts/csat/data/questions.json
// 실행: pnpm dlx tsx scripts/csat/extract-questions.mjs [--dir <기출 폴더>]

import fs from 'node:fs'
import path from 'node:path'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const SRC = arg('dir') ?? 'C:/Users/Administrator/Documents/수능영어기출/최종'
const OUT_DIR = path.resolve(arg('out') ?? 'scripts/csat/data')

const HEADER_RE = /저작권은 한국교육과정평가원/
const HANGUL = /[가-힣]/

/** 홀수형+짝수형이 한 파일이면 앞 블록만 남긴다. */
function keepSingleForm(lines, file) {
  const hol = [], jjak = []
  lines.forEach((l, i) => {
    const t = l.trim()
    if (t === '홀수형') hol.push(i)
    if (t === '짝수형') jjak.push(i)
  })
  if (!hol.length || !jjak.length) return lines
  const lastHol = hol[hol.length - 1]
  const firstJjak = jjak[0]
  if (firstJjak < lastHol) throw new Error(`${file}: 홀/짝 순서가 예상과 다르다`)
  const boundary = lines.findIndex((l, i) => i > lastHol && i < firstJjak && HEADER_RE.test(l))
  if (boundary < 0) throw new Error(`${file}: 홀/짝 경계를 못 찾았다`)
  return lines.slice(0, boundary)
}

/**
 * 지시문은 줄바꿈으로 끊긴다 — 종결 표지가 나올 때까지 이어 붙인다.
 * 종결: `고르시오.` · `것은?` · `것을?` · `?` 로 끝나는 줄.
 */
const ENDS = /(고르시오\.|것은\?|것을\?|무엇인가\?|\?)\s*(\[3점\])?\s*$/

/**
 * 지시문이 문항마다 있지 않다 — 빈칸추론·순서·삽입·장문은 **블록 머리글**로 한 번만 준다:
 *   `[31～34] 다음 빈칸에 들어갈 말로 가장 적절한 것을 고르시오.`
 * ⚠️ 물결표가 **전각 `～`(U+FF5E)** 다. 반각 `~` 만 찾으면 하나도 안 잡힌다(실측).
 * 이걸 모르면 31~34·36~39 가 통째로 누락돼 분모가 20% 비게 된다.
 */
function blockStems(lines) {
  const map = new Map() //  문항번호 → 지시문
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*\[\s*(\d{1,2})\s*[~～∼－-]\s*(\d{1,2})\s*\]\s*(.*)$/)
    if (!m) continue
    const [from, to] = [Number(m[1]), Number(m[2])]
    if (!(from >= 1 && to <= 45 && from <= to)) continue
    let stem = m[3].trim()
    let j = i
    while (!ENDS.test(stem) && j + 1 < lines.length && j - i < 5) {
      j += 1
      const nxt = lines[j].trim()
      if (!nxt || /^\s*\d{1,2}\s*\./.test(nxt)) break
      stem += ' ' + nxt
    }
    stem = stem.replace(/\s+/g, ' ').trim()
    if (!ENDS.test(stem)) continue
    for (let n = from; n <= to; n++) map.set(n, stem)
  }
  return map
}

function extractOne(text, file, examId) {
  const lines = text.split('\n')
  const blocks = blockStems(lines)
  const found = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*(\d{1,2})\s*\.\s*(.*)$/)
    if (!m) continue
    const n = Number(m[1])
    if (n < 1 || n > 45) continue
    // 이미 같은 번호를 잡았으면 건너뛴다(지문 안의 숫자 오탐 방지)
    if (found.some((f) => f.n === n)) continue
    let stem = m[2].trim()
    let j = i
    // 지시문은 한글이다 — **한글 없는 줄이 나오면 멈춘다.** 안 그러면 뒤따르는 영어 지문을
    // 계속 이어 붙여 종결 표지를 영영 못 만난다(실측: 2015#24 · 2021#26 · 2022#30 …).
    while (!ENDS.test(stem) && j + 1 < lines.length && j - i < 6) {
      j += 1
      const nxt = lines[j].trim()
      if (/^\s*\d{1,2}\s*\./.test(nxt)) break //  다음 문항이 시작되면 멈춘다
      if (!nxt || !HANGUL.test(nxt)) break
      stem += ' ' + nxt
    }
    stem = stem.replace(/\s+/g, ' ').trim()
    if (!ENDS.test(stem)) {
      // 한글 지시문이 남아 있으면 **원문 변환에서 '것은?' 이 잘린 것**이다(내 파싱 문제가 아니다).
      // 유형 판정에는 충분하므로 받되 잘림을 표시해 나중에 구분할 수 있게 한다.
      if (HANGUL.test(stem) && stem.replace(/\s/g, '').length >= 6) {
        found.push({ n, stem, from_block: false, stem_truncated: true })
        continue
      }
      // 문항 자체 지시문이 없으면 블록 머리글에서 받는다(빈칸추론·순서·삽입·장문).
      const fromBlock = blocks.get(n)
      if (!fromBlock) continue
      found.push({ n, stem: fromBlock, from_block: true })
      continue
    }
    found.push({ n, stem, from_block: false })
  }
  // 번호 오름차순 + 1~45 만
  found.sort((a, b) => a.n - b.n)
  return found.map((f) => ({
    exam: examId,
    no: f.n,
    stem: f.stem.replace(/\s*\[3점\]\s*$/, '').trim(),
    high_score: /\[3점\]/.test(f.stem),
    section: f.n <= 17 ? '듣기' : '독해',
    from_block: f.from_block === true,
    stem_truncated: f.stem_truncated === true,
  }))
}

const files = fs.readdirSync(SRC).filter((f) => /^\d{4}(_[A-Za-z]+)?\.txt$/.test(f)).sort()

// 2014_B.txt 가 2014_A.txt 와 바이트 동일이면 같은 회분이므로 하나만 센다.
const usable = []
for (const f of files) {
  if (f === '2014_B.txt') {
    const a = fs.readFileSync(path.join(SRC, '2014_A.txt'))
    const b = fs.readFileSync(path.join(SRC, f))
    if (a.equals(b)) continue
  }
  usable.push(f)
}

const all = []
const perExam = []
for (const f of usable) {
  const year = Number(f.slice(0, 4))
  // `2014_A.txt` 는 이름과 달리 B형이다 — 회분 이름을 내용 기준으로 붙인다.
  const examId =
    f === '2014_A.txt' ? '2014B' : f === '2014_Aform.txt' ? '2014A' : String(year)
  const raw = fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\r/g, '')
  const text = keepSingleForm(raw.split('\n'), f).join('\n')
  const qs = extractOne(text, f, examId)
  all.push(...qs)
  const nums = new Set(qs.map((q) => q.no))
  const missing = []
  for (let i = 1; i <= 45; i++) if (!nums.has(i)) missing.push(i)
  perExam.push({ exam: examId, file: f, extracted: qs.length, missing })
  console.log(
    `${examId.padEnd(6)} ${f.padEnd(16)} 문항 ${String(qs.length).padStart(2)}/45` +
      (missing.length ? `  ⚠️ 누락 ${missing.join(',')}` : ''),
  )
}

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(
  path.join(OUT_DIR, 'questions.json'),
  JSON.stringify({ exams: perExam, total: all.length, questions: all }, null, 1),
)

const totalMissing = perExam.reduce((s, e) => s + e.missing.length, 0)
console.log('')
console.log(`회분 ${perExam.length} · 문항 ${all.length} / 기대 ${perExam.length * 45} · 누락 ${totalMissing}`)
console.log(`→ ${path.join(OUT_DIR, 'questions.json')}`)
process.exit(totalMissing === 0 ? 0 : 1)

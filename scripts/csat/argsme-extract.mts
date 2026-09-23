// scripts/csat/argsme-extract.mts
//
// **args.me 덤프에서 교재 지문 후보를 뽑는다 — 길이 다음에 품질 게이트를 둔다.**
//
// ── 왜 게이트가 필요한가 ──────────────────────────────────────────────
// args.me 382,545편 중 140~200어가 31,334편이다. 길이만 보면 조사 전체 1위다.
// 그런데 출처가 **debate.org 87%**(333,473편)다 — 인터넷 토론 게시글이다.
// 이 저장소는 같은 함정을 이미 기록해 두었다: PERSUADE 학생 글의 140~200어 대역이
// **가장 못 쓴 슬라이스**였다(소문자 시작 10.3% vs 400~600어 3.4%).
// 그리고 토론 게시글은 구조적으로 **남의 글에 대한 답변**이라 자족하지 않는다.
//
// 그래서 세 게이트를 **싼 것부터** 둔다 — 31,334편에 LLM 판정을 돌리기 전에 기계로 건다.
//   G1 자족성   대화 상대를 가리키는 표현이 있으면 지문이 될 수 없다
//   G2 표기 품질 소문자 시작 · 문장부호 누락 · 대문자 절규
//   G3 어휘 난이도 NGSL+NAWL 밖 비율 (기출 중앙 8.4% · p75 13.0% → 상한 13%)
//
// **통과율 자체가 이 원천의 판정이다.**
//
// 사용: pnpm dlx tsx scripts/csat/argsme-extract.mts --zip <경로> [--out <디렉터리>] [--chunk 300]
// 읽기 전용(DB 접속 없음) · 재실행 안전(같은 입력 → 같은 출력, id 정렬).

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, openSync, readSync, closeSync, statSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { resolve, join } from 'node:path'

const argOf = (n: string, d: string): string => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const ZIP = resolve(argOf('zip', ''))
const OUT = resolve(argOf('out', 'scripts/csat/argsme-drain'))
const CHUNK = Number(argOf('chunk', '300'))
if (!ZIP) throw new Error('--zip 이 필요하다')

// ── 어휘 목록 ─────────────────────────────────────────────────────────
/** NGSL/NAWL CSV 는 주석(#)과 헤더가 섞여 있다. 첫 칸이 낱말이다. */
function loadList(path: string): string[] {
  const out: string[] = []
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const w = line.split(',')[0]?.trim().toLowerCase()
    if (w && /^[a-z][a-z'-]*$/.test(w)) out.push(w)
  }
  return out
}
const DATA = 'packages/library-pipeline/data/ngsl'
const KNOWN = new Set<string>([
  ...loadList(join(DATA, 'NGSL_1.2_lemmatized_for_research.csv')),
  ...loadList(join(DATA, 'NAWL_1.2_lemmatized_for_research.csv')),
])
console.log(`어휘 목록 ${KNOWN.size.toLocaleString()}낱말 (NGSL + NAWL)`)

// ── G1: 자족성 ────────────────────────────────────────────────────────
/** 상대를 가리키는 글은 혼자 읽히지 않는다 — 어느 하나라도 걸리면 탈락. */
const NOT_SELF_CONTAINED: RegExp[] = [
  /\bopponent/i, /\bcon('s)?\s+(argument|case|point|claim|side)/i,
  /\bpro('s)?\s+(argument|case|point|claim|side)/i,
  /\bround\s*[1-5]\b/i, /\b(first|next|final|last) round\b/i,
  /\bvote (pro|con|for me)\b/i, /\bforfeit/i, /\brebuttal/i,
  /\byou (said|claimed|stated|argued|mentioned)\b/i,
  /\bthe resolution\b/i, /\bresolved\s*:/i, /\bi (accept|negate|affirm)\b/i,
  /\bthank(s)?\s+(you\s+)?(to\s+)?(my opponent|for (the debate|accepting))/i,
  /\bcontention\s*[1-5]\b/i, /\bsub-?point\b/i,
  /\bdrop(ped)?\s+(the|this|my)\s+(argument|point|contention)\b/i,
  /^\s*(pro|con)\s*[:.]/i, /\bdebate\.org\b/i, /\bin this debate\b/i,
  /\bas (i|we) (said|stated) (earlier|above|before)\b/i, /\bmy (argument|case)\b/i,
]

// ── G2: 표기 품질 ─────────────────────────────────────────────────────
const sentencesOf = (t: string): string[] =>
  t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => (s.match(/[A-Za-z]+/g) ?? []).length >= 4)

function quality(t: string): { sentences: number; lowerStartPct: number; noEndPunctPct: number; shoutPct: number; avgSentWords: number } {
  const sents = sentencesOf(t)
  if (!sents.length) return { sentences: 0, lowerStartPct: 100, noEndPunctPct: 100, shoutPct: 0, avgSentWords: 0 }
  let lower = 0, noEnd = 0, shout = 0, words = 0
  for (const s of sents) {
    const first = s.match(/[A-Za-z]/)?.[0] ?? ''
    if (first && first === first.toLowerCase()) lower++
    if (!/[.!?]["')\]]?$/.test(s)) noEnd++
    if ((s.match(/\b[A-Z]{3,}\b/g) ?? []).length >= 2) shout++
    words += (s.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
  }
  return {
    sentences: sents.length,
    lowerStartPct: (lower / sents.length) * 100,
    noEndPunctPct: (noEnd / sents.length) * 100,
    shoutPct: (shout / sents.length) * 100,
    avgSentWords: words / sents.length,
  }
}

// ── G3: 어휘 난이도 ───────────────────────────────────────────────────
function offListPct(t: string): number {
  const toks = (t.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).filter((w) => w.length > 1)
  if (!toks.length) return 100
  let off = 0
  for (const w of toks) {
    if (KNOWN.has(w)) continue
    // 목록에 원형만 있는 경우가 많다 — 흔한 굴절을 벗겨 한 번 더 본다.
    const stems = [w.replace(/ies$/, 'y'), w.replace(/(es|s)$/, ''), w.replace(/(ed|ing)$/, ''), w.replace(/(ed|ing)$/, 'e')]
    if (stems.some((s) => s.length > 2 && KNOWN.has(s))) continue
    off++
  }
  return (off / toks.length) * 100
}

// ── 덤프 읽기 ─────────────────────────────────────────────────────────
/** zip 안에 단일 엔트리(888MB JSON). 로컬 헤더에서 압축 스트림 위치를 찾아 inflate. */
function readSingleEntry(zipPath: string): Buffer {
  const fd = openSync(zipPath, 'r')
  const head = Buffer.alloc(30)
  readSync(fd, head, 0, 30, 0)
  if (head.readUInt32LE(0) !== 0x04034b50) throw new Error('zip local header 아님')
  const start = 30 + head.readUInt16LE(26) + head.readUInt16LE(28)
  const size = statSync(zipPath).size
  const comp = Buffer.alloc(size - start)
  readSync(fd, comp, 0, comp.length, start)
  closeSync(fd)
  console.log(`압축 스트림 ${(comp.length / 1e6).toFixed(0)}MB inflate …`)
  return inflateRawSync(comp, { maxOutputLength: 1024 * 1024 * 1024 })
}

interface ArgRecord {
  id?: string
  premises?: { text?: string }[]
  context?: { sourceUrl?: string; sourceTitle?: string; discussionTitle?: string }
}

/**
 * **버퍼에서 최상위 배열 원소를 하나씩 잘라 파싱한다.**
 *
 * 888MB 는 Node 문자열 상한(0x1fffffe8 ≈ 512MB)을 넘어 `toString()` 이 던진다.
 * 그래서 전체를 문자열로 만들지 않고 **바이트로 브레이스 깊이를 세어** 레코드 경계를
 * 찾고, 레코드 하나씩만 문자열로 바꿔 파싱한다. 문자열 안의 브레이스에 속지 않도록
 * 따옴표·이스케이프 상태를 함께 추적한다.
 */
function* iterRecords(buf: Buffer): Generator<ArgRecord> {
  const QUOTE = 0x22, BACKSLASH = 0x5c, OPEN = 0x7b, CLOSE = 0x7d, LBRACKET = 0x5b
  // 덤프는 `{"arguments": [ {...}, … ]}` 다. 래퍼를 건너뛰지 않으면 깊이가 0 으로
  // 돌아오지 않아 레코드가 **한 건도** 안 나온다(실측: 0건).
  let from = 0
  for (let i = 0; i < Math.min(buf.length, 4096); i++) {
    if (buf[i] === LBRACKET) { from = i + 1; break }
  }
  if (from === 0) throw new Error('최상위 배열 시작 `[` 을 못 찾았다')
  let depth = 0
  let start = -1
  let inStr = false
  let esc = false
  for (let i = from; i < buf.length; i++) {
    const c = buf[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === BACKSLASH) esc = true
      else if (c === QUOTE) inStr = false
      continue
    }
    if (c === QUOTE) { inStr = true; continue }
    if (c === OPEN) {
      if (depth === 0) start = i
      depth++
    } else if (c === CLOSE) {
      depth--
      if (depth === 0 && start >= 0) {
        try {
          yield JSON.parse(buf.toString('utf8', start, i + 1)) as ArgRecord
        } catch {
          // 최상위 래퍼 객체(`{"arguments": [ … ]`)는 통째로 깊이 0 에서 열린다 —
          // 그 경우 여기 오지 않고, 오더라도 파싱 실패는 건너뛴다.
        }
        start = -1
      }
    }
  }
}

const buf = readSingleEntry(ZIP)
console.log(`JSON ${(buf.length / 1e6).toFixed(0)}MB — 레코드 단위로 훑는다`)

// ── 게이트 ────────────────────────────────────────────────────────────
const stats = {
  total: 0, band: 0, g1_self: 0, g2_quality: 0, g3_offlist: 0, passed: 0,
  bySource: {} as Record<string, number>, passedBySource: {} as Record<string, number>,
  offListOfPassed: [] as number[],
}
interface Item {
  id: string; source_url: string; topic: string; words: number
  off_list_pct: number; avg_sent_words: number; sentences: number
  sha256: string; text: string
}
const kept: Item[] = []

for (const r of iterRecords(buf)) {
  stats.total++
  const text = (r.premises ?? []).map((p) => p.text ?? '').join(' ').replace(/\s+/g, ' ').trim()
  const words = (text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
  if (words < 140 || words > 200) continue
  stats.band++
  let host = '(불명)'
  try { host = new URL(r.context?.sourceUrl ?? '').hostname.replace(/^www\./, '') } catch { /* 불명 유지 */ }
  stats.bySource[host] = (stats.bySource[host] ?? 0) + 1

  if (NOT_SELF_CONTAINED.some((re) => re.test(text))) { stats.g1_self++; continue }
  const q = quality(text)
  if (q.sentences < 4 || q.lowerStartPct > 5 || q.noEndPunctPct > 10 || q.shoutPct > 5) { stats.g2_quality++; continue }
  const off = offListPct(text)
  if (off > 13) { stats.g3_offlist++; continue }

  stats.passed++
  stats.passedBySource[host] = (stats.passedBySource[host] ?? 0) + 1
  stats.offListOfPassed.push(off)
  kept.push({
    id: r.id ?? '', source_url: r.context?.sourceUrl ?? '',
    topic: r.context?.discussionTitle ?? r.context?.sourceTitle ?? '',
    words, off_list_pct: Number(off.toFixed(1)),
    avg_sent_words: Number(q.avgSentWords.toFixed(1)), sentences: q.sentences,
    sha256: createHash('sha256').update(text).digest('hex'), text,
  })
}

const pc = (n: number): string => `${((n / Math.max(1, stats.band)) * 100).toFixed(1)}%`
console.log(`
전체              ${stats.total.toLocaleString()}
140~200어         ${stats.band.toLocaleString()}
  G1 자족성 탈락    ${stats.g1_self.toLocaleString()}  (${pc(stats.g1_self)})
  G2 표기 탈락      ${stats.g2_quality.toLocaleString()}  (${pc(stats.g2_quality)})
  G3 어휘 탈락      ${stats.g3_offlist.toLocaleString()}  (${pc(stats.g3_offlist)})
  ── 통과          ${stats.passed.toLocaleString()}  (${pc(stats.passed)})`)

const off = [...stats.offListOfPassed].sort((a, b) => a - b)
if (off.length) {
  const q = (x: number): string => (off[Math.floor(off.length * x)] ?? 0).toFixed(1)
  console.log(`통과분 off-list  p25 ${q(0.25)}% · 중앙 ${q(0.5)}% · p75 ${q(0.75)}%   (기출 중앙 8.4% · p75 13.0%)`)
}
console.log('\n140~200어 출처 분포 → 통과 후')
for (const [h, n] of Object.entries(stats.bySource).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${h.padEnd(22)} ${String(n).padStart(7)} → ${String(stats.passedBySource[h] ?? 0).padStart(6)}`)
}

// ── 청크 내보내기 ─────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true })
kept.sort((a, b) => a.id.localeCompare(b.id)) // 재실행 안전: 순서 고정
let n = 0
for (let i = 0; i < kept.length; i += CHUNK) {
  n++
  const items = kept.slice(i, i + CHUNK)
  writeFileSync(
    join(OUT, `chunk-${String(n).padStart(3, '0')}.json`),
    JSON.stringify({ contract: 'argsme-textbook/v1', chunk: String(n).padStart(3, '0'), count: items.length, items }, null, 2)
  )
}
writeFileSync(
  join(OUT, 'manifest.json'),
  JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), stats: { ...stats, offListOfPassed: undefined }, chunks: n, chunkSize: CHUNK }, null, 2)
)
console.log(`\n청크 ${n}개 · ${OUT}`)

// scripts/textbook/harvest-gutenberg-kid.mjs
//
// **초·중 교재 지문을 PD 장문에서 발췌해 적재한다.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// `longform-pd-probe.mjs` 가 "책당 비중복 182편 · 목표 9,160편은 51권으로 닿는다" 를
// 실측했지만(2026-09-04), probe 는 **세기만 한다.** 세는 것과 갖는 것은 다르다 —
// 재고를 늘리는 것은 이 스크립트다.
//
// ── 자를 새로 만들지 않는다 ──────────────────────────────────────────
// 판정은 네 축을 **동시에** 통과해야 하고, 넷 다 이미 정본이 있다:
//
//   ① 어수창   `readability.PASSAGE_WORDS`     100~200어 (출판사 선언 어수 실측 n=59)
//   ② FK 밴드  `READING_LEVEL_BANDS`           초3~4 1.5~4.0 … 중3 8.5~12.0 (시중 79종)
//   ③ 어휘     `curriculumFit`                 시중 p90 (초등 43.3% · 중등 44.0%, 196쪽)
//
// 여기서 다시 구현하면 **probe 가 잰 수와 적재된 수가 조용히 갈린다.**
//
// ── 정제도 새로 만들지 않는다 ────────────────────────────────────────
// 수능 쪽 `harvest-gutenberg.mjs` 가 이미 갖춘 가드를 그대로 쓴다:
//   · `cleanBookText`        — 줄바꿈·따옴표·각주 표시 정리
//   · `looksLikeBookMatter`  — 목차·판권·색인·서문을 지문으로 세지 않는다
//     (⚠️ probe 에는 이 가드가 없다. 그래서 probe 수치는 이 스크립트보다 **후하다**)
//   · curl 수신 — node fetch 로는 gutenberg.org 에 못 붙는다(이 저장소가 세 번 겪었다)
//
// ── 재실행 안전 ──────────────────────────────────────────────────────
// · 처리한 책 번호를 커서에 적고 다음 실행에서 건너뛴다.
// · 조각의 `source_id` 는 **본문 해시**라 커서를 지우고 다시 돌려도 같은 글이 두 번 안 들어간다.
// · 못 받은 책은 **커서에 적지 않는다** — 상류의 일시적 장애일 수 있다.
// · 칸별 몫(`--quota`)을 넘으면 그 칸은 그만 담는다. 몫이 없는 칸의 조각은 **버린다** —
//   담아 두면 다음 실행이 "그 칸은 찼다" 로 세어 진짜 몫이 안 찬다.
//
// 실행:
//   node scripts/textbook/harvest-gutenberg-kid.mjs --books 3            # 읽기 전용
//   node scripts/textbook/harvest-gutenberg-kid.mjs --books 20 --commit
//   node scripts/textbook/harvest-gutenberg-kid.mjs --plan               # 남은 몫만 본다

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { cleanBookText, looksLikeBookMatter } from '../csat/lib-clean.mjs'
import {
  PASSAGE_WORDS,
  READING_LEVEL_BANDS,
  readability,
} from '../../packages/library-pipeline/src/textbook/readability.ts'
import { curriculumFit } from '../../packages/library-pipeline/src/textbook/curriculum.ts'
// **네 번째 축** — 세 축을 통과하고도 지문이 아닌 글이 있다. 실측 2026-09-04: 이 자를
//   붙이기 전에 적재한 906편 중 **69%(629편)** 가 소설 대화 장면이거나 앞을 가리키며 시작했다.
import { standaloneFit } from '../../packages/library-pipeline/src/textbook/standalone.ts'

const run = promisify(execFile)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const BOOKS = Number(arg('books', 3))
const COMMIT = process.argv.includes('--commit')
const PLAN_ONLY = process.argv.includes('--plan')
const CURSOR_FILE = path.resolve('scripts/textbook/data/gutenberg-kid-cursor.json')

/**
 * 칸별 목표 — 기본은 **목표 9,160편을 다섯 칸에 고르게** 나눈 값이다.
 *
 * 고르게 두는 이유: 학년 사다리는 한 칸이 비면 그 단계에서 끊긴다. 어느 칸이 얼마나
 * 필요한지는 권 편성이 정할 문제이고, 그때까지는 한쪽만 쌓지 않는 편이 안전하다.
 * (수능 쪽에서 배운 것과 같다 — 병목 칸을 안 채우면 전체 수치가 안 움직인다.)
 */
const QUOTA_PER_BAND = Number(arg('quota', 1832))

/**
 * **한 책에서 가져오는 상한.**
 *
 * 없으면 긴 책 하나가 서가를 통째로 채운다 — 실측(2026-09-04 dry-run): 3권에서 815편이
 * 적합인데 그중 **548편이 `Little Women` 한 권**이었다. 그대로 담으면 학습자가 어느 칸을
 * 열어도 같은 이야기를 읽는다. **양은 채워지고 교재는 못 만든다.**
 *
 * 시중 교재는 단원마다 다른 글이다. 그래서 `adapt-drain-export` 가 피드를 돌아가며 뽑는
 * 것과 같은 이유로, 여기서는 책을 돌아가며 뽑는다.
 *
 * 40 은 정한 값이다 — 20단원 책 두 권 분량. 재고가 쌓이면 실측으로 바꿀 자리다.
 */
const PER_BOOK = Number(arg('per-book', 40))

const gate = (text) => {
  const m = readability(text)
  if (!m) return null
  if (m.words < PASSAGE_WORDS.min || m.words > PASSAGE_WORDS.max) return null
  const band = READING_LEVEL_BANDS.find((b) => m.fk >= b.fkMin && m.fk <= b.fkMax)
  if (!band) return null
  const school = band.id.startsWith('초') ? 'elementary' : 'middle'
  const f = curriculumFit(text, school)
  if (!f.pass) return null
  const sa = standaloneFit(text)
  if (!sa.pass) return null
  return { band: band.id, school, fk: m.fk, words: m.words, pctile: f.marketPercentile }
}

/**
 * **DB 호출은 재시도한다.**
 *
 * 실측 2026-09-05: 수확 배치가 `TypeError: fetch failed` 한 줄로 죽었다. 상류가 끊긴 것도
 * 아니고 우리가 틀린 것도 아니다 — 긴 루프를 도는 동안 한 번 흔들린 것뿐이다.
 * 그 한 번에 22권치 작업이 통째로 날아간다.
 *
 * 같은 함정을 이 저장소가 여러 번 밟았고(`gate-import.mjs` 가 같은 이유로 `retry` 를 갖는다),
 * PG 수신 쪽은 이미 재시도가 있는데 **DB 쪽만 없었다.**
 */
async function dbRetry(fn, what, attempt = 0) {
  try {
    const r = await fn()
    if (r?.error) throw new Error(r.error.message)
    return r
  } catch (e) {
    // ⚠️ **4회로는 모자랐다.** 2026-09-05 오후에 DB 가 길게 흔들렸고(다른 세션이 3만 편
    //   전량 게이트를 돌리는 중이었다) 몫 조회 5개가 재시도를 다 쓰고 죽었다.
    //   백오프를 30초에서 멈추고 6회까지 버틴다 — 합계 약 2분이다.
    //   기다리는 비용은 2분이고, 포기하는 비용은 22권치 수확이다.
    if (attempt >= 6) throw new Error(`${what} — ${String(e.message).slice(0, 80)}`)
    const wait = Math.min(30_000, 1500 * 2 ** attempt)
    console.error(`  ↻ ${what} 재시도 ${attempt + 1}/6 (${Math.round(wait / 1000)}s) — ${String(e.message).slice(0, 50)}`)
    await sleep(wait)
    return dbRetry(fn, what, attempt + 1)
  }
}

async function get(u, attempt = 0) {
  try {
    const { stdout } = await run(
      'curl',
      ['-sSL', '--max-time', '120', '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '--fail', u],
      { maxBuffer: 96 * 1024 * 1024 }
    )
    if (!stdout || stdout.length < 200) throw new Error('본문이 너무 짧다')
    return stdout
  } catch (e) {
    if (attempt >= 2) throw new Error(String(e.message).slice(0, 60))
    await sleep(2500 * 2 ** attempt)
    return get(u, attempt + 1)
  }
}

function stripBoilerplate(t) {
  const s = t.indexOf('*** START OF')
  const e = t.indexOf('*** END OF')
  let body = t
  if (s > 0) body = body.slice(body.indexOf('\n', s) + 1)
  if (e > 0) body = body.slice(0, body.lastIndexOf('*** END OF'))
  return body
}

/**
 * 문단을 모아 **비중복** 조각을 만든다.
 *
 * ⚠️ **겹치면 안 된다.** probe 가 처음에 문단을 5칸씩 옮기며 창을 만들었는데, 창 하나가
 *   3~8문단이라 이웃 창이 문단을 나눠 가졌다. 그렇게 세면 수율이 부풀고, 그대로 적재하면
 *   **같은 문단이 두 지문에 실린다.** 그래서 조각을 만들면 그 끝 다음에서 다시 시작한다.
 */
/**
 * 장 머리(`CHAPTER I` · `IV.` · `THE LOST KEY`)인가.
 *
 * 짧고, 문장 부호로 끝나지 않으며, 대문자·로마숫자가 두드러진다. 본문 문단은 이 셋을
 * 동시에 만족하지 않는다.
 */
function looksLikeHeading(p) {
  const t = p.trim()
  if (!t || t.length > 70) return false
  if (/[.!?][")\]]?$/.test(t) && !/^(?:CHAPTER|BOOK|PART|SECTION)\b/i.test(t)) return false
  if (/^(?:CHAPTER|BOOK|PART|SECTION)\b/i.test(t)) return true
  if (/^[IVXLC]+\.?$/.test(t)) return true
  const letters = t.replace(/[^A-Za-z]/g, '')
  if (letters.length >= 3 && letters === letters.toUpperCase()) return true
  return false
}

/**
 * ⚠️ **정제를 먼저 하면 장 경계가 사라진다 — 순서가 중요하다.**
 *
 * 실측 2026-09-05: `cleanBookText` 를 책 전체에 먼저 걸었더니 `CHAPTER` 로 시작하는
 * 문단이 **13개 → 0개**(Alice) · **70개 → 0개**(Tom Sawyer)가 됐다. 정제기가 장 머리를
 * 지우는 것이 그 자체로는 옳다(지문에 표제가 섞이면 안 된다). 그런데 **지우기 전에
 * 그 자리를 기억해 두지 않으면** 장이 어디서 시작하는지 영영 모른다.
 *
 * 그래서 **문단으로 먼저 나누고 문단마다 정제한다.** 정제 후 빈 문단이 곧 장 경계다 —
 * 버리는 것에서 신호를 얻는다.
 */
function cleanByParagraph(body) {
  const out = []
  for (const p of body.split(/\n\s*\n/)) {
    const cleaned = cleanBookText(p).replace(/\s+/g, ' ').trim()
    // 원문에는 있었는데 정제가 통째로 지운 문단 = 표제·판권·장 머리.
    out.push({ text: cleaned, wasDropped: !cleaned && Boolean(p.trim()) })
  }
  return out
}

function disjointChunks(units) {

  // **장 경계를 기억한 채로** 본문 문단만 남긴다.
  //
  // ── 왜 (실측 2026-09-05) ──────────────────────────────────────────
  // 네 축을 통과한 발췌를 손으로 읽으면 **12편 중 2~3편**만 쓸 만하다. 나머지는 장면
  // 한가운데서 시작한다 — `Glen knew that.` · `…past them shot a huge black mass`.
  // 그것을 **사후에 규칙으로 잡으려다 실패했다**(시중 오탐이 3%→13/19%로 뛰었다).
  //
  // 그러면 뽑는 자리를 바꾸는 수밖에 없다. **장이 시작하는 자리의 글은 스스로 선다** —
  // 작가가 거기서 상황을 새로 세우기 때문이다. 그래서 장 머리 바로 뒤 문단을 표시해
  // 두고, 조각을 고를 때 그 자리를 **먼저** 쓴다.
  const paras = []
  const opensChapter = []
  let afterHeading = false
  for (const u of units) {
    // **정제가 지운 문단**(장 머리·표제·판권)이 경계다 — §`cleanByParagraph`.
    //   정제가 남긴 표제(`I. THE RIVER BANK`)도 함께 본다.
    if (u.wasDropped || (u.text && looksLikeHeading(u.text))) {
      afterHeading = true
      continue
    }
    const p = u.text
    if (p && p.length > 80 && /[.!?]/.test(p)) {
      paras.push(p)
      opensChapter.push(afterHeading)
      afterHeading = false
    }
  }

  const out = []
  let i = 0
  while (i < paras.length) {
    let acc = ''
    let end = -1
    for (let j = i; j < paras.length; j++) {
      acc = acc ? `${acc} ${paras[j]}` : paras[j]
      const w = (acc.match(/[A-Za-z][A-Za-z'-]*/g) || []).length
      if (w < PASSAGE_WORDS.min) continue
      if (w > PASSAGE_WORDS.max) break
      end = j
      break
    }
    if (end < 0) {
      i++
      continue
    }
    out.push({ text: acc, opensChapter: opensChapter[i] === true })
    i = end + 1
  }
  return out
}

// ── DB ───────────────────────────────────────────────────────────────
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/**
 * 남은 몫 — **DB 에 있는 것을 세지, 이 실행이 담은 것만 세지 않는다.**
 * 그래야 여러 번 나눠 돌려도 합계가 몫을 넘지 않는다.
 *
 * ⚠️ 칸은 `library_articles` 에 저장하지 않는다(FK 는 본문에서 다시 잰다). 그래서
 *   `feed_label` 에 칸 이름을 적고 그것으로 센다 — 적는 곳이 세는 곳과 같아야 한다.
 */
async function remainingQuota() {
  const have = {}
  // **다섯 칸을 한꺼번에 묻는다.** 순차로 던지면 각 조회가 한 번씩 흔들릴 때마다
  //   재시도 대기가 줄줄이 더해져 시작도 못 하고 끝난다(실측 2026-09-05: 2분 넘게 걸렸다).
  //   병렬로 던지면 흔들려도 전체 시간이 가장 느린 하나에 묶인다.
  await Promise.all(
    READING_LEVEL_BANDS.map(async (b) => {
    // ⚠️ **격리된 것은 몫에서 뺀다.** 적재 수로 세면 그 칸이 영영 안 찬다 —
    //   실측 2026-09-05: 중1~2 가 몫 1,832 를 채웠는데 게시 게이트를 통과한 것은
    //   **1,588편**이었다(244편이 장르·잡물로 격리). 몫이 찼다고 그만 담으면
    //   그 칸은 1,588 에서 멈춘 채 "다 찼다" 고 보고한다.
    //
    //   ⚠️ 그렇다고 `publishable=true` 만 세면 반대로 영영 안 찬다 — 방금 담은 것은
    //   아직 판정 전이라 0 으로 세어져 무한히 더 담게 된다.
    //   그래서 **격리가 확정된 것만** 뺀다: 미판정은 일단 찬 것으로 센다.
    const { count } = await dbRetry(
      () =>
        db
          .from('library_articles')
          .select('id', { count: 'exact', head: true })
          .eq('source', 'gutenberg')
          .eq('feed_id', 'kid-excerpt')
          .eq('feed_label', `PD 발췌 · ${b.id}`)
          .not('csat_fit->gate->>publishable', 'eq', 'false'),
      `몫 조회 ${b.id}`,
      )
      have[b.id] = count ?? 0
    }),
  )
  return have
}

const have = await remainingQuota()
const pad = (s, w) => String(s).padEnd(w)
const lp = (s, w) => String(s).padStart(w)

console.log(`\nPD 발췌 적재 — 칸별 몫 ${QUOTA_PER_BAND.toLocaleString()}편\n`)
console.log('  ' + pad('칸', 10) + lp('보유', 8) + lp('남은 몫', 9))
console.log('  ' + '─'.repeat(27))
let totalRemaining = 0
for (const b of READING_LEVEL_BANDS) {
  const left = Math.max(0, QUOTA_PER_BAND - have[b.id])
  totalRemaining += left
  console.log('  ' + pad(b.id, 10) + lp(have[b.id].toLocaleString(), 8) + lp(left.toLocaleString(), 9))
}
console.log('  ' + '─'.repeat(27))
console.log('  ' + pad('합계', 10) + lp('', 8) + lp(totalRemaining.toLocaleString(), 9) + '\n')

if (PLAN_ONLY) process.exit(0)
if (!totalRemaining) {
  console.log('몫이 다 찼다 — 담을 곳이 없다.')
  process.exit(0)
}

// ── 책 목록 ──────────────────────────────────────────────────────────
const cursor = fs.existsSync(CURSOR_FILE)
  ? JSON.parse(fs.readFileSync(CURSOR_FILE, 'utf8'))
  : { done: [], page: 1 }
const done = new Set(cursor.done ?? [])

/**
 * **주제를 소설에서 설명문 쪽으로 옮긴다.**
 *
 * ── 왜 (실측 2026-09-05, 표본 세 벌) ────────────────────────────────
 * 네 축을 통과한 발췌를 세 번 손으로 읽었고 쓸 만한 것이 **3/12 · 2/12 · 1/12** 였다.
 * 자립성을 사후 규칙으로 잡으려다 실패했고(시중 오탐 3%→13/19%), 장 머리 우선으로
 * 뽑는 자리를 바꿔도 나아지지 않았다.
 *
 * 그런데 **통과한 것들의 성격이 한결같다** — 파리 관찰 · 곤충 설명 · 비버 이야기 ·
 * 흰 쥐. 전부 **설명문이거나 동물 이야기**다. 떨어지는 것은 전부 **소설 장면**이다.
 *
 * 원인은 규칙이 아니라 소스였다. 19세기 아동 **소설** 중간을 잘라 자립적 지문을 얻으려는
 * 것 자체가 어긋나 있다 — 소설은 앞을 받아 쓰는 글이고, 시중 초·중 교재 지문은
 * 그 한 편이 스스로 서는 설명문·짧은 이야기다.
 *
 * 그래서 훑는 주제를 바꾼다. `children` 만 보던 것을 자연·과학·동물·기행으로 넓힌다.
 * ⚠️ `children` 을 빼지는 않는다 — 초3~4 칸의 쉬운 글은 거기서 나온다.
 */
const TOPICS = (arg('topics', 'nature,science,animals,travel,children') ?? '').split(',').map((t) => t.trim()).filter(Boolean)

const picked = []
let page = cursor.page ?? 1
let topicIdx = cursor.topicIdx ?? 0
while (picked.length < BOOKS && page <= 200) {
  const topic = TOPICS[topicIdx % TOPICS.length]
  const listRaw = await get(
    `https://gutendex.com/books/?topic=${encodeURIComponent(topic)}&languages=en&page=${page}`
  )
  const list = JSON.parse(listRaw)
  for (const b of list.results ?? []) {
    if (done.has(b.id)) continue
    picked.push({ id: b.id, title: b.title, topic })
    if (picked.length >= BOOKS) break
  }
  // **주제를 돌아가며 훑는다** — 한 주제를 끝까지 파면 서가가 한 색이 된다.
  topicIdx++
  if (topicIdx % TOPICS.length === 0) page++
  if (!list.next && topicIdx % TOPICS.length === 0) break
}
if (!picked.length) {
  console.log('새로 볼 책이 없다 — 커서를 지우거나 목록을 넓힌다.')
  process.exit(0)
}

// ── 수확 ─────────────────────────────────────────────────────────────
console.log(
  '  ' + pad('책', 34) + lp('조각', 6) + lp('배제', 6) + lp('적합', 6) + lp('적재', 6) + '  칸'
)
console.log('  ' + '─'.repeat(72))

let chunksAll = 0
let droppedAll = 0
let fitAll = 0
let inserted = 0
let dup = 0
let overQuota = 0
let cappedAll = 0
const byBand = {}
const pctiles = []
const failures = []

for (const b of picked) {
  let raw
  try {
    raw = await get(`https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.txt`)
  } catch (e) {
    // 못 받는 책은 **커서에 적지 않는다** — 상류의 일시적 장애일 수 있다.
    failures.push(`#${b.id} — ${e.message}`)
    continue
  }
  const title = ((raw.match(/^Title:\s*(.+)$/m) ?? [])[1] ?? `#${b.id}`).trim()
  const author = ((raw.match(/^Author:\s*(.+)$/m) ?? [])[1] ?? '').trim() || null

  const all = disjointChunks(cleanByParagraph(stripBoilerplate(raw)))
  const kept = all.filter((c) => !looksLikeBookMatter(c.text))

  // 먼저 **전부** 판정한다. 그 다음 책 전체에서 고르게 뽑는다 —
  // 앞에서부터 40편을 자르면 한 책의 **첫 챕터만** 담기고, 뒤로 갈수록 문장이 길어지는
  // 책의 성격상 칸도 한쪽으로 쏠린다(실측: `The Rover Boys` 는 앞이 초3~4, 뒤가 중3).
  const passing = []
  for (const c of kept) {
    const g = gate(c.text)
    if (g) passing.push({ text: c.text, opensChapter: c.opensChapter, g })
  }
  /**
   * **몫이 적게 찬 칸부터 담는다** — 책 순서대로 담으면 상위 칸이 독식한다.
   *
   * ── 왜 (실측 2026-09-04·05) ────────────────────────────────────────
   * 4축 게이트를 붙이고 25권을 돌린 결과가 **중3 226 · 중1~2 147 · 초3~4 17** 이었다.
   * 상위 두 칸이 73%다. 19세기 아동물이라도 문장이 길어 FK 가 위로 쏠리기 때문이고,
   * 책을 훑는 순서대로 담으면 그 쏠림이 그대로 재고가 된다.
   *
   * 그러면 상위 칸은 몫을 채우고 **초등 칸은 영영 안 찬다.** 수능 쪽에서 같은 함정을
   * 이미 겪었다 — 적합 원문을 3,370편 늘렸는데 균형 사정권은 28편 올랐다.
   * **병목 칸을 안 건드리면 수치가 안 움직인다**(`csat-source-fit-20260903.md` §16).
   *
   * 그래서 칸별로 나눈 뒤 **남은 몫이 큰 칸부터 라운드로빈**으로 집는다. 한 책에서
   * 상위 칸이 30편 나와도 초등 칸 3편이 먼저 들어간다.
   *
   * ⚠️ 이것으로 초등 칸이 **채워지지는 않는다** — 공급 자체가 적기 때문이다.
   *   막는 것은 상위 칸의 독식이고, 초등 칸은 각색 드레인이 함께 채워야 한다.
   */
  const byBandPass = new Map()
  for (const p of passing) {
    if (!byBandPass.has(p.g.band)) byBandPass.set(p.g.band, [])
    byBandPass.get(p.g.band).push(p)
  }
  // 각 칸 안에서 **장 머리로 시작하는 조각을 먼저** 쓴다 — 그 자리의 글은 스스로 선다.
  //   장 머리 조각이 모자라면 나머지로 채우되, 책 전체에 고르게 훑는다
  //   (앞에서부터 자르면 첫 챕터만 담긴다).
  for (const [band, list] of byBandPass) {
    const heads = list.filter((x) => x.opensChapter)
    const rest = list.filter((x) => !x.opensChapter)
    const stride = Math.max(1, Math.floor(rest.length / Math.max(1, PER_BOOK - heads.length)))
    const thin = [...heads]
    for (let i = 0; i < rest.length && thin.length < PER_BOOK * 2; i += stride) thin.push(rest[i])
    byBandPass.set(band, thin)
  }
  const spread = []
  for (let round = 0; spread.length < PER_BOOK; round++) {
    // 매 바퀴 남은 몫을 다시 본다 — 이 책에서 담은 것이 몫을 줄이기 때문이다.
    const order = [...byBandPass.keys()].sort(
      (a, b) => QUOTA_PER_BAND - have[b] - (QUOTA_PER_BAND - have[a])
    )
    let took = false
    for (const band of order) {
      const list = byBandPass.get(band)
      if (!list || round >= list.length) continue
      spread.push(list[round])
      took = true
      if (spread.length >= PER_BOOK) break
    }
    if (!took) break
  }
  const capped = passing.length - spread.length

  const rows = []
  const mine = {}
  for (const { text, g } of spread) {
    // 몫이 없는 칸은 **버린다** — 담아 두면 다음 실행이 "찼다" 로 세어 진짜 몫이 안 찬다.
    const left = QUOTA_PER_BAND - (have[g.band] + (mine[g.band] ?? 0))
    if (left <= 0) {
      overQuota++
      continue
    }
    mine[g.band] = (mine[g.band] ?? 0) + 1
    pctiles.push(g.pctile)
    rows.push({
      source: 'gutenberg',
      // 본문 해시 — 커서를 지우고 다시 돌려도 같은 글이 두 번 안 들어간다.
      source_id: `pgkid:${b.id}:${crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)}`,
      title: `${title.slice(0, 80)} (발췌)`,
      author,
      source_url: `https://www.gutenberg.org/ebooks/${b.id}`,
      published_at: null,
      license: 'Public Domain',
      license_class: 'public_domain',
      content: text,
      status: 'queued',
      feed_id: 'kid-excerpt',
      // **칸을 여기에 적는다** — 몫을 세는 곳과 적는 곳이 같아야 한다.
      feed_label: `PD 발췌 · ${g.band}`,
      // ⚠️ `article_v_level` 은 **적지 않는다.** VRL 분석기가 그 값을 소유한다 —
      //   여기서 FK 밴드로 넣어 두면 분석 뒤 값과 어긋난 채 둘 다 살아 있게 되고,
      //   어느 쪽이 맞는지 나중에 알 수 없다. 우리가 잰 칸은 `feed_label` 이 나른다.
    })
  }

  chunksAll += all.length
  droppedAll += all.length - kept.length
  fitAll += passing.length
  cappedAll += capped

  let wrote = 0
  if (COMMIT && rows.length) {
    const { data: exist } = await dbRetry(
      () =>
        db
          .from('library_articles')
          .select('source_id')
          .eq('source', 'gutenberg')
          .in(
            'source_id',
            rows.map((r) => r.source_id)
          ),
      '중복 조회',
    )
    const has = new Set((exist ?? []).map((r) => r.source_id))
    const fresh = rows.filter((r) => !has.has(r.source_id))
    dup += rows.length - fresh.length
    for (let i = 0; i < fresh.length; i += 200) {
      try {
        await dbRetry(
          () => db.from('library_articles').insert(fresh.slice(i, i + 200)),
          `INSERT #${b.id}`,
        )
      } catch (e) {
        failures.push(`#${b.id} INSERT — ${String(e.message).slice(0, 60)}`)
        break
      }
      wrote += fresh.slice(i, i + 200).length
    }
    inserted += wrote
    for (const [k, v] of Object.entries(mine)) have[k] += v
  } else {
    // dry-run 에서도 몫은 세어야 한다 — 안 그러면 한 칸만 계속 적합으로 나온다.
    for (const [k, v] of Object.entries(mine)) have[k] += v
  }
  for (const [k, v] of Object.entries(mine)) byBand[k] = (byBand[k] ?? 0) + v

  done.add(b.id)
  console.log(
    '  ' +
      pad(title.slice(0, 32), 34) +
      lp(all.length, 6) +
      lp(all.length - kept.length, 6) +
      lp(rows.length, 6) +
      lp(COMMIT ? wrote : '·', 6) +
      '  ' +
      Object.entries(mine)
        .map(([k, v]) => `${k} ${v}`)
        .join(' · ')
  )
  await sleep(1500) // PG 서버를 아낀다
}

// ── 요약 ─────────────────────────────────────────────────────────────
console.log('\n  조각 ' + chunksAll + ' · 앞뒤 잡물 배제 ' + droppedAll + ' · 3축 적합 ' + fitAll)
if (cappedAll) console.log(`  책당 상한(${PER_BOOK})을 넘어 안 담은 적합 조각 ${cappedAll} — 다른 책에서 채운다`)
if (overQuota) console.log(`  몫이 찬 칸이라 버린 조각 ${overQuota}`)
if (COMMIT) console.log(`  중복 ${dup} · **적재 ${inserted}편**`)
else console.log('  dry-run 이었다. 실제로 쓰려면 --commit.')

if (Object.keys(byBand).length) {
  console.log('\n  칸별: ' + Object.entries(byBand).map(([k, v]) => `${k} ${v}`).join(' · '))
}
if (pctiles.length) {
  const s = [...pctiles].sort((a, b) => a - b)
  console.log(
    `  시중 자리 p25 ${s[Math.floor(s.length * 0.25)]} · 중앙 ${s[Math.floor(s.length * 0.5)]} · p75 ${s[Math.floor(s.length * 0.75)]}` +
      '   (50 = 시중 중앙)'
  )
}
if (failures.length) {
  console.log(`\n  실패 ${failures.length}건 — 커서에 안 적었다(다음 실행에서 다시 시도한다):`)
  for (const f of failures.slice(0, 5)) console.log('    ' + f)
}

// 커서는 **실제로 처리한 책만** 적는다.
if (COMMIT) {
  fs.mkdirSync(path.dirname(CURSOR_FILE), { recursive: true })
  // ⚠️ `topicIdx` 도 적는다 — 안 적으면 다음 실행이 늘 첫 주제부터 다시 훑어
  //   `nature` 앞머리만 되풀이하고 나머지 주제는 영영 안 본다.
  fs.writeFileSync(
    CURSOR_FILE,
    `${JSON.stringify({ done: [...done], page, topicIdx }, null, 2)}\n`
  )
  console.log(`\n  커서 → ${path.relative(process.cwd(), CURSOR_FILE)} (${done.size}권 처리됨)`)
}

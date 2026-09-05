// scripts/csat/plos-extract.mjs
//
// **논문 전문에서 지문을 잘라낸다. 기본은 예행 — `--commit` 이 있어야 적재한다.**
//
// ── 왜 필요한가 ─────────────────────────────────────────────────────
// `source='plos'` 36,337행은 평균 **36,559자**(최대 231,904)로 지문이 아니라 논문 전문이다.
// 500행 표본 어디에도 수능 지문 크기(700~1,000자)가 없었다 — 최소가 약 10,000자다.
// 대역 채점기는 124~163어 창이 **하나만** 맞으면 통과시키므로 긴 학술문은 전부 통과한다.
// 그래서 "적합 원문"으로 세어졌지만 그중 무엇도 그대로는 지문이 아니다.
// 측정: `docs/reports/plos-extractability-20260905.md`
//
// ── 무엇을 버리는가 (실측 근거) ─────────────────────────────────────
// | 버리는 것 | 왜 | 실측 |
// |---|---|---|
// | Methods·Results | 절차·수치 서술은 논증문이 아니다 | Intro+Disc 만 남기면 원문의 43% |
// | 주어 자리 인용 | `[] used the SERVQUAL to…` — 지우면 주어가 사라진다 | 30.1% 행에 최소 1개 |
// | 도판·표 참조 | 그림 없이 못 읽는다 | Intro+Disc 에도 42.5% 잔존 |
// | 1인칭 자기 연구 | 수능 지문은 저자가 자기 실험을 말하지 않는다 | 창의 39.4% |
//
// ⚠️ **인용 제거가 문장을 깨는 5.9% 는 기계가 못 본다** — 길이도 어휘도 멀쩡해서
//   모든 관문을 통과한다. 그래서 "지우고 통과시키기" 가 아니라 **"깨질 것 같으면 버리기"** 로
//   설계했다. 공급을 잃는 쪽이 깨진 영어를 학생에게 보내는 쪽보다 싸다.
//
// 실행: node scripts/csat/plos-extract.mjs [--limit 200] [--commit] [--curl]

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

import { fitRecord, windowsOf, splitSentences, W } from './lib-fit.mjs'
import { hardReject } from './gate-rules.mjs'
import { classify } from './lib-topic.mjs'
import { curlFetch } from './lib-curl-fetch.mjs'
import { protectAbbr, restoreAbbr, SENT_DROP, cleanSentence } from './lib-plos.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const COMMIT = process.argv.includes('--commit')
const LIMIT = Number(arg('limit', 200))
const SHOW = Number(arg('show', 0))
const TARGET_WORDS = 310 // Gutenberg 조각과 같은 크기로 맞춘다(창이 두 개 들어간다)

// ── 절 나누기 ───────────────────────────────────────────────────────
// ⚠️ **줄바꿈에 기대면 안 된다** — 저장된 행의 45.8% 에 줄바꿈이 하나도 없고 제목이
//   본문에 붙어 온다(`…their decision Results Women made up 90%…`).
// ⚠️ **Discussion 을 뺐다 — 산출물을 읽고 내린 결정이다.**
//   그 절은 "이 연구가 무엇을 발견했는가" 를 논한다. 1인칭과 참가자 지시어를 다 걷어내도
//   남는 것이 여전히 자기 연구 보고였다("personnel had very low subjective norms about…").
//   Introduction 은 반대로 **배경 지식과 일반 주장**을 논증한다 — 수능 지문이 그것이다.
const KEEP_HEAD = /\b(Introduction|Background)\b/g
const DROP_HEAD =
  /\b(Materials and methods|Methods and materials|Methods|Method|Results|Results and discussion|Discussion|General discussion|Conclusions?|Limitations|Implications|Supporting information|Acknowledg(e)?ments?|Author contributions|Funding|Data availability|References|Competing interests|Abstract)\b/g

/** 제목 위치를 찾아 유지 구간만 이어 붙인다. */
function keepSections(text) {
  const marks = []
  for (const re of [KEEP_HEAD, DROP_HEAD]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text))) marks.push({ at: m.index, len: m[0].length, keep: re === KEEP_HEAD })
  }
  marks.sort((a, b) => a.at - b.at)
  if (!marks.length) return ''
  const out = []
  for (let i = 0; i < marks.length; i++) {
    if (!marks[i].keep) continue
    const start = marks[i].at + marks[i].len
    const end = i + 1 < marks.length ? marks[i + 1].at : text.length
    if (end > start) out.push(text.slice(start, end))
  }
  return out.join('\n\n')
}

// 약어 보호·문장 관문·인용 처리는 `lib-plos.mjs` 가 정본이다 — 재검사기와 **같은 표**를 본다.

/** 남은 문장을 목표 어수 근처로 묶는다 — 문장 경계만 쓴다. */
function chop(sents) {
  const out = []
  let acc = []
  let n = 0
  for (const s of sents) {
    acc.push(s)
    n += W(s).length
    if (n >= TARGET_WORDS) {
      out.push(acc.join(' '))
      acc = []
      n = 0
    }
  }
  if (n >= 240) out.push(acc.join(' ')) // 240어 미만은 창이 한 개 반도 안 들어간다
  return out
}

// ── 실행 ────────────────────────────────────────────────────────────
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  ...(process.argv.includes('--curl') ? { global: { fetch: curlFetch } } : {}),
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function retry(fn, what, attempt = 0) {
  try {
    const r = await fn()
    if (r?.error) throw new Error(r.error.message)
    return r
  } catch (e) {
    if (attempt >= 4) throw new Error(`${what} — ${String(e.message).slice(0, 80)}`)
    await sleep(1500 * 2 ** attempt)
    return retry(fn, what, attempt + 1)
  }
}

const CURSOR_FILE = path.resolve('scripts/csat/data/plos-extract-cursor.json')
const cur = fs.existsSync(CURSOR_FILE) ? JSON.parse(fs.readFileSync(CURSOR_FILE, 'utf8')) : { id: '' }

console.log('PLOS 지문 추출' + (COMMIT ? ' — **적재한다**' : ' — 예행'))
console.log('='.repeat(78))
console.log(`  이어서 시작: ${cur.id || '(처음)'} · 이번에 볼 논문 ${LIMIT}편\n`)

const drop = { noSection: 0, sentDrop: {}, structCite: 0, tooShort: 0, gate: 0, band: 0 }
let papers = 0
let made = 0
let inserted = 0
let cursor = cur.id || '00000000-0000-0000-0000-000000000000'

while (papers < LIMIT) {
  const { data } = await retry(
    () =>
      db
        .from('library_articles')
        .select('id,title,source_url,author,license,content')
        .eq('source', 'plos')
        .eq('csat_fit->gate->>purpose', 'raw')
        .gt('id', cursor)
        .order('id')
        .limit(20),
    '조회',
  )
  if (!data?.length) break

  for (const row of data) {
    papers += 1
    cursor = row.id
    const kept = keepSections(String(row.content ?? ''))
    if (!kept) {
      drop.noSection += 1
      continue
    }
    const good = []
    for (const raw of splitSentences(protectAbbr(kept))) {
      const s = restoreAbbr(raw)
      const hit = SENT_DROP.find((d) => d.re.test(s))
      if (hit) {
        drop.sentDrop[hit.id] = (drop.sentDrop[hit.id] ?? 0) + 1
        continue
      }
      const c = cleanSentence(s)
      if (!c.text) {
        drop.sentDrop[c.why] = (drop.sentDrop[c.why] ?? 0) + 1
        continue
      }
      good.push(c.text)
    }
    const pieces = chop(good)
    if (!pieces.length) {
      drop.tooShort += 1
      continue
    }
    for (const text of pieces) {
      const codes = hardReject(text)
      if (codes.length) {
        drop.gate += 1
        continue
      }
      const f = fitRecord(text)
      if (!f.pass) {
        drop.band += 1
        continue
      }
      made += 1
      // ⚠️ 눈으로 읽지 않고 적재하지 않는다 — 이 파이프라인이 막으려는 것이
      //   "기계는 통과하는데 사람이 보면 깨진 영어" 다.
      if (SHOW && made <= SHOW) console.log(`
  ── 지문 ${made} (${W(text).length}어) ──
  ${text}
`)
      if (!COMMIT) continue
      const t = classify(text)
      const wins = windowsOf(text).filter((w) => w.pass).map((w) => ({ s: w.s, e: w.e }))
      const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 32)
      const { error } = await retry(
        () =>
          db.from('library_articles').insert({
            source: 'plos',
            source_id: hash,
            source_url: row.source_url,
            title: `${String(row.title ?? '').slice(0, 120)} — 발췌`,
            author: row.author,
            language: 'en',
            license: row.license ?? 'CC BY 4.0',
            copyright_safe_in_kr: true,
            content: text,
            content_hash: hash,
            word_count: W(text).length,
            status: 'queued',
            feed_id: 'plos-extract',
            feed_label: `PLOS 발췌 · ${t.topic}`,
            csat_fit: {
              ...f,
              topic: t.topic,
              topicMargin: t.margin,
              topicV: 1,
              gate: {
                v: 2,
                publishable: true,
                purpose: 'csat',
                blockedBy: null,
                verdict: 'use',
                genre: 'science',
                why: '논문 서론·논의에서 뗀 설명문 — 절차·수치·1인칭 제거',
                codes: [],
                by: 'extract+rule',
                at: new Date().toISOString(),
              },
              make: {
                v: 1,
                words: W(text).length,
                sents: splitSentences(text).length,
                paras: 1,
                windows: wins,
              },
            },
          }),
        '적재',
      ).catch((e) => ({ error: e }))
      if (!error) inserted += 1
    }
    if (papers >= LIMIT) break
  }
  process.stdout.write(`\r  논문 ${papers} · 지문 ${made} · 적재 ${inserted}`)
}

if (COMMIT) {
  fs.mkdirSync(path.dirname(CURSOR_FILE), { recursive: true })
  fs.writeFileSync(CURSOR_FILE, JSON.stringify({ id: cursor }, null, 2))
}

console.log(`\n\n  논문 **${papers}편** → 지문 **${made}편** (권당 ${(made / Math.max(1, papers)).toFixed(1)})`)
console.log(`  적재 ${inserted}편\n`)
console.log('  버린 자리:')
console.log(`    절 구조 없음        ${drop.noSection}`)
console.log(`    인용이 문장을 깬다  ${drop.structCite}`)
for (const [k, n] of Object.entries(drop.sentDrop).sort((a, b) => b[1] - a[1])) {
  console.log(`    문장 ${k.padEnd(14)} ${n}`)
}
console.log(`    묶을 문장 부족      ${drop.tooShort}`)
console.log(`    기계 규칙           ${drop.gate}`)
console.log(`    대역 미달           ${drop.band}`)
if (!COMMIT) console.log(`\n  예행이었다. 적재하려면 --commit`)

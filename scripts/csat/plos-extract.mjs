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
// ── 창 고르기 (2026-09-24) ──────────────────────────────────────────
// 보관 판정(`gate.retain`)을 받은 원본만 자르고, 창은 **정본 자로 재서 쉬운 것부터** 고른다(`selectWindows`).
// 논문마다 무엇을 냈고 왜 못 냈는지를 원본 행 `csat_fit.extract` 에 남긴다 — 예전에는 콘솔에만 찍혀
// 원본 3만 편에 왜 발췌가 없는지 잴 수 없었다. 보관 판정이 끝난 행만 쓰므로 판정 청크의 CAS 와 부딪치지 않는다.
//
// 실행(TS 패키지 @vocaflow/wlp 를 쓰므로 tsx):
//   pnpm exec tsx scripts/csat/plos-extract.mjs --limit 200 --compare     # 예행 — 옛 끊기와 새 선택을 같은 논문으로 비교
//   pnpm exec tsx scripts/csat/plos-extract.mjs --limit 200 --commit [--curl]
//   pnpm exec tsx scripts/csat/plos-extract.mjs --pending-only --v 7 --limit 300          # 발췌 대기 원본만(V7) — 예행
//   pnpm exec tsx scripts/csat/plos-extract.mjs --pending-only --v 7 --limit 300 --commit # 적재 · 재실행 안전(자른 원본은 다음 목록에서 빠진다)

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

import { fitRecord, windowsOf, splitSentences, W } from './lib-fit.mjs'
import { hardReject, retentionOf, retainValueOf } from './gate-rules.mjs'
import { loadRuler, CEFR } from './lib-cefr-ruler.mts'
import { classify, TOPIC_V } from './lib-topic.mjs'
import { curlFetch } from './lib-curl-fetch.mjs'
import { protectAbbr, restoreAbbr, SENT_DROP, cleanSentence } from './lib-plos.mjs'
const { rightsTag } = await import('../../packages/library-pipeline/src/ingest-article/rights-tag.ts')

/**
 * 발췌는 원본의 권리를 **물려받는다**(DD-75). 원본에 `csat_fit.rights` 가 있으면 그대로 복사하고,
 * 없으면 원본 `license` 를 쓰되 evidence 를 'collection-default' 로 적는다 — 2026-09-24 이전 PLOS 원본은
 * 수확기가 글마다 확인하지 않고 'CC BY 4.0' 을 박아 두었기 때문이다(needsResolution=true).
 */
function inheritedRights(row) {
  const parent = row.csat_fit?.rights
  if (parent && typeof parent === 'object' && parent.v === 1) return parent
  return rightsTag({
    license: row.license ?? 'unknown',
    licenseEvidence: 'collection-default',
    author: row.author ?? null,
    publishedAt: null,
    sourceUrl: row.source_url ?? null,
  })
}

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const COMMIT = process.argv.includes('--commit')
const COMPARE = process.argv.includes('--compare')
const LIMIT = Number(arg('limit', 200))
const SHOW = Number(arg('show', 0))
// ⚠️ **구간을 나눠 여러 프로세스가 동시에 돌 수 있게 한다.** 커서 하나로는 논문 36,340편을
//   순차로만 훑어 몇 시간이 걸린다. `--from`/`--to` 로 UUID 구간을 자르면 서로 겹치지 않고,
//   커서 파일도 구간마다 따로 둔다(같은 파일을 쓰면 마지막에 끝난 쪽이 남의 진척을 덮는다).
const FROM = arg('from', '')
const TO = arg('to', '')
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

/**
 * **창을 난이도로 고른다**(2026-09-24).
 *
 * 예전 `chop()` 은 문장을 앞에서부터 310어가 찰 때마다 끊었다 — 경계가 **어느 창이 쉬운지와 무관하게**
 * 정해졌다. 실측(yield-funnel-20260924): 발췌 2편 이상인 논문 1,560편 중 42%가 발췌끼리 CEFR 이 다르고,
 * 탈락의 99.9%가 `cefr_above_band` 였다. 같은 서론 안에서 쉬운 자리를 고르면 살아날 창이 있었다.
 *
 * 그래서: 모든 문장을 시작점으로 삼아 310어 이상이 되는 가장 짧은 창을 만들고(후보), 기계 규칙·모양을
 * 통과한 후보를 **정본 자(lib-cefr-ruler)로 재서 쉬운 것부터** 겹치지 않게 고른다. 고른 창은 원문 순서로 낸다.
 * 난이도는 **고르는 데만** 쓴다 — 어려운 창도 겹치지 않으면 낸다(버리는 것은 적격 판정이 한다).
 */
function selectWindows(sents, ruler) {
  const words = sents.map((s) => W(s).length)
  const cands = []
  const why = { tooShort: 0, gate: 0, band: 0 }
  for (let s = 0; s < sents.length; s++) {
    let n = 0
    let e = s
    while (e < sents.length && n < TARGET_WORDS) n += words[e++]
    if (n < TARGET_WORDS) {
      why.tooShort += 1
      break // 뒤로 갈수록 더 짧다
    }
    const text = sents.slice(s, e).join(' ')
    if (hardReject(text).length) { why.gate += 1; continue }
    const f = fitRecord(text)
    if (!f.pass) { why.band += 1; continue }
    const m = ruler(text)
    cands.push({ s, e, text, f, cefr: m.level, fre: m.fre, rank: CEFR.indexOf(m.level) })
  }
  // 쉬운 것부터(같으면 Flesch 높은 것), 겹치지 않게.
  cands.sort((a, b) => a.rank - b.rank || b.fre - a.fre || a.s - b.s)
  const taken = []
  for (const c of cands) if (taken.every((t) => c.e <= t.s || c.s >= t.e)) taken.push(c)
  taken.sort((a, b) => a.s - b.s)
  return { picked: taken, candidates: cands.length, why }
}

/** 옛 방식 — `--compare` 에서만 쓴다(새 선택이 실제로 나은지 같은 논문으로 잰다). */
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

const CURSOR_FILE = path.resolve(
  FROM ? `scripts/csat/data/plos-extract-cursor-${FROM.slice(0, 2)}.json` : 'scripts/csat/data/plos-extract-cursor.json',
)
const cur = fs.existsSync(CURSOR_FILE) ? JSON.parse(fs.readFileSync(CURSOR_FILE, 'utf8')) : { id: '' }

console.log('PLOS 지문 추출' + (COMMIT ? ' — **적재한다**' : ' — 예행'))
console.log('='.repeat(78))
// 발췌 대기 모드는 커서를 안 쓴다 — 「이어서 시작」은 커서 모드에만 뜻이 있다.
if (!process.argv.includes('--pending-only')) console.log(`  이어서 시작: ${cur.id || '(처음)'} · 이번에 볼 논문 ${LIMIT}편\n`)

const drop = { notKept: 0, noSection: 0, sentDrop: {}, structCite: 0, tooShort: 0, gate: 0, band: 0 }
let papers = 0
const B2 = CEFR.indexOf('B2')
const cmp = { papers: 0, old: { n: 0, easy: 0 }, new: { n: 0, easy: 0 } }
const ruler = await loadRuler(db)

/**
 * 논문마다 무엇을 냈고 왜 못 냈는지를 **원본 행에 남긴다**(`csat_fit.extract`).
 * jsonb 는 통째로 덮지 않고 읽은 값에 키 하나만 더한다(덮으면 게이트·보관 판정이 날아간다).
 * `updated_at` 으로 CAS — 그 사이 누가 행을 바꿨으면 기록을 건너뛰고 센다(조용히 덮지 않는다).
 */
async function recordExtract(row, rec) {
  if (!COMMIT) return
  const next = { ...(row.csat_fit ?? {}), extract: { v: 1, at: new Date().toISOString(), ruler: 'canonical-no-llm', ...rec } }
  const { data, error } = await db.from('library_articles').update({ csat_fit: next }).eq('id', row.id).eq('updated_at', row.updated_at).select('id')
  if (error || data?.length !== 1) drop.recordFail = (drop.recordFail ?? 0) + 1
}
let made = 0
let inserted = 0
let firstInsertErr = null
let cursor = cur.id || FROM || '00000000-0000-0000-0000-000000000000'

/**
 * `--pending-only [--v 7]` — **발췌 대기 원본만** 고른다(2026-09-25 · 사용자 선택 B).
 *
 * 커서 모드는 원본 36,337편을 id 순서로 훑어서, 예행 200편 중 **187편(94%)이 「보관 판정 없음·폐기」로 건너뛰기**였다
 * (발췌 대기는 4,077편뿐이다). 여기서는 먼저 대상 id 만 가볍게 모으고(본문 없이 · 학년 열로 거른다) 본문은 5편씩 받는다.
 * 보관 상태는 커서 모드와 **같은 함수**(`retentionOf`)로 가른다. 커서 파일은 건드리지 않는다 — 커서 모드의 자리를 흩뜨리지 않게.
 */
const PENDING_ONLY = process.argv.includes('--pending-only')
const V_LEVEL = arg('v', '')
let pendingIds = null
if (PENDING_ONLY) {
  pendingIds = []
  // ⚠️ 옛 발췌로 **이미 조각이 있는 원본**은 대기가 아니다 — 원본에 `csat_fit.extract` 표시가 없어도 조각은 있다.
  //   이걸 안 빼면 대기를 4,077 로 세고 실제로는 262/263 을 건너뛴다(실측 2026-09-25). 진행표 DB 함수와 같은 정의다.
  const extractedUrls = new Set()
  {
    let afterEx = '00000000-0000-0000-0000-000000000000'
    for (;;) {
      const { data } = await retry(
        () => db.from('library_articles').select('id, source_url').eq('feed_id', 'plos-extract').gt('id', afterEx).order('id').limit(1000),
        '기존 조각 목록',
      )
      if (!data?.length) break
      for (const r of data) {
        afterEx = r.id
        if (r.source_url) extractedUrls.add(r.source_url)
      }
      if (data.length < 1000) break
    }
  }
  let after = '00000000-0000-0000-0000-000000000000'
  for (;;) {
    const { data } = await retry(() => {
      let q = db
        .from('library_articles')
        .select('id, source_url, gate:csat_fit->gate, extract:csat_fit->extract')
        .eq('source', 'plos')
        .neq('feed_id', 'plos-extract')
        .gt('id', after)
        .order('id')
        .limit(1000)
      if (V_LEVEL) q = q.eq('article_v_level', Number(V_LEVEL))
      return q
    }, '대상 목록')
    if (!data?.length) break
    for (const r of data) {
      after = r.id
      if (r.extract || (r.source_url && extractedUrls.has(r.source_url))) continue
      if (retentionOf({ purpose: 'raw', verdict: r.gate?.verdict, retain: retainValueOf(r.gate?.retain) }) === 'keep-pending-extraction') pendingIds.push(r.id)
    }
    if (data.length < 1000) break
  }
  console.log(`  발췌 대기만: ${pendingIds.length.toLocaleString()}편${V_LEVEL ? ` (V${V_LEVEL})` : ''} · 이번에 ${Math.min(LIMIT, pendingIds.length)}편\n`)
}

while (papers < LIMIT) {
  if (pendingIds && !pendingIds.length) break
  const batchIds = pendingIds ? pendingIds.splice(0, 5) : null
  const { data } = await retry(
    () =>
      batchIds
        ? db.from('library_articles').select('id,title,source_url,author,license,content,updated_at,csat_fit').in('id', batchIds).order('id')
        : db
        .from('library_articles')
        .select('id,title,source_url,author,license,content,updated_at,csat_fit')
        .eq('source', 'plos')
        // ⚠️ 전에는 `csat_fit->gate->>purpose = 'raw'` 로 걸렀다. 인덱스가 없어서 매 요청마다
        //   75,000행의 jsonb 를 파싱했고, 커서가 뒤로 갈수록 첫 응답이 안 왔다(회차를 여러 번 잃음).
        //   미절단 원본은 `feed_id` 로도 정확히 갈린다 — 추출 산출물만 'plos-extract' 다.
        .neq('feed_id', 'plos-extract')
        .gt('id', cursor)
        // 구간 끝을 주면 그 앞까지만 — 병렬 작업자끼리 겹치지 않게 한다.
        .lt('id', TO || 'ffffffff-ffff-ffff-ffff-ffffffffffff')
        .order('id')
        // ⚠️ 한 편이 최대 **231,904자**다. 20편이면 한 요청에 4 MB 가 넘어 어떤 구간에서는
        //   요청이 통째로 죽고, 재시도도 같은 20편을 다시 받아 같은 자리에서 멈춘다.
        //   실측 2026-09-05: 커서가 한 자리에 붙어 여러 회차를 잃었다.
        .limit(5),
    '조회',
  )
  if (!data?.length) break

  // ⚠️ **이미 발췌가 있는 원본은 다시 자르지 않는다.** 새 선택은 경계가 달라 옛 발췌와 겹치는 창을 낸다 —
  //   그대로 넣으면 같은 문단이 두 번 들어간다. 옛 발췌에는 문항이 붙어 있을 수 있어 지울 수도 없다.
  //   (옛 발췌를 새 선택으로 갈아 끼우는 일은 문항 이관이 필요한 별도 작업이다 · 여기서는 세기만 한다.)
  const extracted = new Set()
  {
    const urls = data.map((r) => r.source_url).filter(Boolean)
    const { data: ex } = await retry(
      () => db.from('library_articles').select('source_url').eq('feed_id', 'plos-extract').in('source_url', urls),
      '기존 발췌 조회',
    )
    for (const r of ex ?? []) extracted.add(r.source_url)
  }

  for (const row of data) {
    papers += 1
    cursor = row.id
    // ⚠️ **보관 판정을 받은 원본만 자른다**(2026-09-24). 예전에는 원본 전량을 잘랐다 — 읽어 보면
    //   버릴 논문(30편 중 13편)에서도 발췌가 나와 판정 드레인이 그것을 다시 읽고 버렸다.
    //   판정 없는 원본은 먼저 `plos-raw-triage-export` 드레인으로 간다.
    const gate = row.csat_fit?.gate
    if (retentionOf({ purpose: 'raw', verdict: gate?.verdict, retain: retainValueOf(gate?.retain) }) !== 'keep-pending-extraction') {
      drop.notKept += 1
      continue
    }
    // 예행 비교(--compare)는 옛 발췌가 있는 논문도 잰다 — 새 선택의 효과는 바로 그 논문들에서 드러난다.
    if (!COMPARE && (row.csat_fit?.extract || extracted.has(row.source_url))) {
      drop.alreadyExtracted = (drop.alreadyExtracted ?? 0) + 1
      continue
    }
    const kept = keepSections(String(row.content ?? ''))
    if (!kept) {
      drop.noSection += 1
      await recordExtract(row, { candidates: 0, emitted: 0, levels: {}, reason: 'no-introduction' })
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
    const sel = selectWindows(good, ruler)
    if (COMPARE) {
      // 같은 논문을 옛 끊기로도 잘라 같은 자로 잰다 — 새 선택이 나은지는 이 비교로만 말한다.
      for (const text of chop(good)) {
        if (hardReject(text).length || !fitRecord(text).pass) continue
        cmp.old.n += 1
        if (CEFR.indexOf(ruler(text).level) <= B2) cmp.old.easy += 1
      }
      for (const p of sel.picked) {
        cmp.new.n += 1
        if (p.rank <= B2) cmp.new.easy += 1
      }
      cmp.papers += 1
    }
    const levels = {}
    for (const p of sel.picked) levels[p.cefr] = (levels[p.cefr] ?? 0) + 1
    await recordExtract(row, {
      candidates: sel.candidates,
      emitted: sel.picked.length,
      levels,
      ...(sel.picked.length ? {} : { reason: sel.why.tooShort && !sel.candidates && !sel.why.gate && !sel.why.band ? 'too-few-sentences' : 'no-valid-window' }),
      rejectedWindows: { gate: sel.why.gate, band: sel.why.band },
    })
    if (!sel.picked.length) {
      if (!sel.candidates && !sel.why.gate && !sel.why.band) drop.tooShort += 1
      else if (sel.why.gate >= sel.why.band) drop.gate += 1
      else drop.band += 1
      continue
    }
    for (const { text, f, cefr } of sel.picked) {
      made += 1
      // ⚠️ 눈으로 읽지 않고 적재하지 않는다 — 이 파이프라인이 막으려는 것이
      //   "기계는 통과하는데 사람이 보면 깨진 영어" 다.
      if (SHOW && made <= SHOW) console.log(`
  ── 지문 ${made} (${W(text).length}어) ──
  ${text}
`)
      if (!COMMIT) continue
      const t = classify(text, { title: String(row.title ?? '') })
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
            // 원본 표기를 그대로 — 없으면 'unknown'(트리거가 restricted 로 막는다). 'CC BY 4.0' 을 지어내지 않는다.
            //   `copyright_safe_in_kr` 는 적지 않는다 — BEFORE INSERT 트리거가 license 로 도출한다.
            license: row.license ?? 'unknown',
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
              topicV: TOPIC_V,
              rights: inheritedRights(row),
              // ⚠️ **판정을 스스로 붙이지 않는다**(2026-09-24). 예전에는 `verdict:'use'` 를 찍어 넣었다 —
              //   아무도 안 읽은 발췌가 「사용」으로 보였고, 나중에 전문 판정이 24%를 버렸다.
              //   verdict 없이 넣으면 `gate-article-export`(발췌 피드는 대상에 든다)가 판정 청크로 뽑는다.
              gate: {
                v: 2,
                publishable: true, // 기계 규칙은 통과 — 판정 없음(verdict 키 없음)이 적격에서 `content_unjudged` 로 읽힌다
                purpose: 'csat',
                blockedBy: null,
                codes: [],
                by: 'extract+rule',
                at: new Date().toISOString(),
              },
              make: {
                v: 2,
                // 고를 때 잰 난이도 — 적격 판정은 분석 단계가 다시 잰 `cefr_level` 로 한다. 둘이 어긋나면 자를 의심한다.
                cefrAtExtract: cefr,
                words: W(text).length,
                sents: splitSentences(text).length,
                paras: 1,
                windows: wins,
              },
            },
          }),
        '적재',
      // ⚠️ 전에는 오류를 통째로 삼켰다 — `적재 0` 이 계속 찍히는데 이유가 안 보였다.
      //   삼킬 거면 **적어도 첫 건은 보여야** 무엇이 막는지 안다.
      ).catch((e) => ({ error: e }))
      const dup = error && /duplicate key/i.test(String(error.message ?? error))
      if (dup) drop.dup = (drop.dup ?? 0) + 1
      else if (error) {
        if (!firstInsertErr) {
          firstInsertErr = String(error.message ?? error).slice(0, 200)
          console.error(`\n  ❌ 적재 실패(첫 건): ${firstInsertErr}`)
        }
        drop.insert = (drop.insert ?? 0) + 1
      } else inserted += 1
    }
    if (papers >= LIMIT) break
  }
  // ⚠️ **커서를 묶음마다 남긴다.** 전에는 루프가 끝난 뒤에만 저장했다. 그래서 타임아웃으로
  //   죽은 회차는 진척이 통째로 사라졌고, 다음 회차가 **같은 논문을 다시 넣어** 중복 키로
  //   실패했다 — 겉으로는 "커서가 안 움직인다" 로만 보였다.
  //   재실행 안전은 "다시 돌리면 이어서 간다" 는 뜻이고, 그러려면 진척이 그때그때 남아야 한다.
  // 발췌 대기 모드는 커서를 안 쓴다 — 자른 원본에 csat_fit.extract 가 남아 다음 목록에서 저절로 빠진다(재실행 안전).
  if (COMMIT && !PENDING_ONLY) {
    fs.mkdirSync(path.dirname(CURSOR_FILE), { recursive: true })
    fs.writeFileSync(CURSOR_FILE, JSON.stringify({ id: cursor }, null, 2))
  }
  process.stdout.write(`\r  논문 ${papers} · 지문 ${made} · 적재 ${inserted}`)
}

if (COMMIT && !PENDING_ONLY) {
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
console.log(`    보관 판정 없음·폐기  ${drop.notKept}`)
console.log(`    이미 발췌 있음(건너뜀) ${drop.alreadyExtracted ?? 0}`)
console.log(`    기계 규칙           ${drop.gate}`)
console.log(`    대역 미달           ${drop.band}`)
if (drop.recordFail) console.log(`    ⚠ 원본 기록 실패     ${drop.recordFail} (행이 그 사이 바뀜 — 다시 돌리면 이어서 간다)`)
if (COMPARE) {
  const pct = (x) => (x.n ? ((x.easy / x.n) * 100).toFixed(1) : '0')
  console.log(`
  비교(같은 논문 ${cmp.papers}편 · 같은 자):`)
  console.log(`    옛 끊기  창 ${cmp.old.n} · B2 이하 ${cmp.old.easy} (${pct(cmp.old)}%)`)
  console.log(`    새 선택  창 ${cmp.new.n} · B2 이하 ${cmp.new.easy} (${pct(cmp.new)}%)`)
}
if (!COMMIT) console.log(`\n  예행이었다. 적재하려면 --commit`)

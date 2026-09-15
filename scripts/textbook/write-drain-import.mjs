// scripts/textbook/write-drain-import.mjs
//
// **집필 드레인 ③/③ — Claude Code 가 쓴 지문을 `library_articles` 에 넣는다.**
//
// ── 넣고 나서 끝이 아니다 ────────────────────────────────────────────
// 적재된 글은 아직 **어휘도 밴드도 없다.** 이어서 두 가지를 돌려야 교재 재료가 된다:
//
//   1. `scripts/acp/reprocess.mjs --missing-vocab --commit`  어휘·CEFR·밴드 계산
//   2. `scripts/textbook/store-new-types.mjs --commit`        문항 생성
//
// 이 스크립트는 그 둘을 대신하지 않는다 — 적재와 분석을 한 스위치에 묶으면
// "무엇이 실패했는지" 를 알 수 없다.
//
// ── 넣지 않는 것 ─────────────────────────────────────────────────────
// 빈 값 · 너무 짧은 글 · 문장이 모자란 글은 **넣지 않는다.** 넣으면 다음 export 가
// "원글이 늘었다" 고 세는데 문항은 안 나와서 구멍이 영영 남는다. 건너뛴 수를 반드시 찍는다.
//
// 재실행 안전: `source_id` 가 유일키다(`original:v<밴드>-<슬롯>`). 이미 있으면 건너뛴다 —
// 몇 번 돌려도 결과가 같다. **덮어쓰지 않는다** — 이미 문항이 붙은 글의 본문을 바꾸면
// 그 문항들의 정답이 조용히 어긋난다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/write-drain-import.mjs --band 3          (미리보기)
//   pnpm dlx tsx scripts/textbook/write-drain-import.mjs --band 3 --commit

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

import { loadEnv, fetchAllPaged } from './volume-pool.mjs'

loadEnv()
const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const commit = process.argv.includes('--commit')
const BAND = Number(arg('band') ?? 3)
const DIR = path.resolve(arg('dir') ?? `scripts/textbook/write-drain/v${BAND}`)

// 문단 나누기·하한은 `repaginate.mjs` 가 정본이다 — 수율 검사기가 같은 함수를 써야
// 검사기가 통과시킨 글이 적재 뒤에 문항 0 으로 남는 일이 없다.
import { MIN_SENTENCES, MIN_WORDS, repaginate } from './repaginate.mjs'
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')
/** 문장 세기 — 마침표·물음표·느낌표 뒤 공백. 약어(Dr. 등)를 완벽히 가르지는 않는다(하한 판정용). */
const countSentences = (t) => t.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 1).length

const { createScriptClient } = await import('../lib/supabase-client.mjs')
const db = createScriptClient()

/**
 * **"너무 쉬움" 도 실패다** — 여기서 재는 자.
 *
 * ── 왜 생겼나 (실측 2026-09-05) ──────────────────────────────────────
 * 소스별로 시중 자리를 처음 재 보니 우리 재고 786편 중 **이 드레인이 쓴 368편(47%)** 이
 * 시중 분포의 **14.7** 번째였다. 외부 소스는 대부분 40~79 다:
 *
 *     original 14.7 · frym 43.1 · storyweaver 53.6 · space_place 68.7 · simple_wikipedia 79.5
 *
 * 밴드를 통제해도 같다 — 초6~중1 칸이 우리 글을 빼면 **16.5 → 72.6** 으로 뛴다.
 * 즉 **소스가 모자란 게 아니라 우리가 시중보다 쉽게 쓰고 있었다.**
 *
 * ⚠️ 원인은 자가 없어서가 아니라 **다른 자를 댔기 때문**이다. 이 드레인은 난이도를
 *   `article_v_level`(우리 V-Level 사다리)로 조준하는데, 그건 **시중과 비교되는 축이 아니다.**
 *   V-Level 목표를 정확히 맞히고도 시중 15번째에 떨어질 수 있고, 실제로 그랬다.
 *
 * 그래서 어휘 게이트에 **하한**을 더한다. 지금까지는 상한(`CURRICULUM_GATE` = 시중 p90)만
 * 있었다 — "너무 어려움" 만 막고 "너무 쉬움" 은 통과시켰다.
 *
 * 기본 하한 **25**: 시중 분포의 아래 1/4 보다 쉬운 글은 지문으로 쓰지 않는다는 뜻이다.
 * `--min-market 0` 으로 끌 수 있다(끄면 왜 껐는지 로그에 남는다).
 */
const { readability, bandOf, gradeBand } =
  await import('../../packages/library-pipeline/src/textbook/readability.ts')
const { curriculumFit } = await import('../../packages/library-pipeline/src/textbook/curriculum.ts')
const MIN_MARKET = Number(arg('min-market') ?? 25)

// ── 이미 넣은 글의 문단 고치기 ──────────────────────────────────────
//
// `--repaginate` 는 **이 드레인이 넣은 글만** 손댄다(`written_by=claude_code_drain`).
// 1문단짜리로 들어간 글은 순서 문항을 한 개도 못 만들기 때문이다.
//
// ⚠️ 본문이 바뀌면 문단 번호가 바뀌므로 **이미 붙은 문항이 낡는다.** 그래서 고친 글을
//   목록으로 찍고, 이어서 `store-new-types.mjs --prune` 으로 낡은 것을 정리하라고 안내한다.
//   되돌릴 수 없는 일이라 `--commit` 없이는 미리보기만 한다.
if (process.argv.includes('--repaginate')) {
  // ⚠️ 페이징 없이 읽으면 1,000행에서 잘린다 — 재조판 대상이 조용히 줄어든다.
  const data = await fetchAllPaged(db, (q) =>
    q
      .from('library_articles')
      .select('id, title, content, source_id')
      .eq('source', 'original')
      .eq('composed_spec->>written_by', 'claude_code_drain')
      .order('id')
  )
  const need = []
  for (const a of data ?? []) {
    const next = repaginate(String(a.content ?? ''))
    if (next !== a.content) need.push({ ...a, next })
  }
  console.log(`드레인 집필분 ${data?.length ?? 0}편 · **문단을 고쳐야 할 것 ${need.length}편**`)
  const paras = (t) => t.split(/\n\s*\n+/).length
  for (const a of need.slice(0, 5))
    console.log(
      `  · ${paras(a.content)}문단 → ${paras(a.next)}문단  ${String(a.title).slice(0, 46)}`
    )
  if (need.length > 5) console.log(`  … 외 ${need.length - 5}편`)
  if (!commit) {
    console.log('\n--commit 을 붙이면 고친다. **문단 번호가 바뀌어 기존 문항이 낡는다.**')
    process.exit(0)
  }
  let fixed = 0
  for (const a of need) {
    const { error: ue } = await db
      .from('library_articles')
      .update({ content: a.next, content_hash: sha256(a.next) })
      .eq('id', a.id)
    if (ue) console.log(`  ✗ ${a.source_id}: ${ue.message}`)
    else fixed++
  }
  console.log(`\n고친 글 ${fixed}편`)
  console.log('이어서 돌릴 것:')
  console.log('  1. pnpm dlx tsx scripts/textbook/store-new-types.mjs --prune   (낡은 문항 정리)')
  console.log(
    '  2. pnpm dlx tsx scripts/textbook/refresh-dcp-items.mjs --commit (순서·삽입 재생성)'
  )
  process.exit(0)
}

if (!fs.existsSync(DIR)) {
  console.log(`청크 디렉터리가 없다: ${path.relative(process.cwd(), DIR)}`)
  process.exit(0)
}
const outFiles = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.out.json'))
  .sort()
if (!outFiles.length) {
  console.log(`채워진 청크(.out.json)가 없다: ${path.relative(process.cwd(), DIR)}`)
  process.exit(0)
}

const rows = []
for (const f of outFiles) rows.push(...JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')))
console.log(`청크 ${outFiles.length}개 · 지문 ${rows.length}편`)

// ── 거르기 ──────────────────────────────────────────────────────────

/**
 * 이 글이 시중 분포의 어디인가(0~100). 못 재면 null —
 * **모름을 "쉬움" 으로도 "어려움" 으로도 바꾸지 않는다.**
 */
function marketPos(content) {
  const m = readability(content)
  if (!m) return null
  const band = gradeBand(bandOf(m.fk))
  if (!band) return null // FK 가 밴드 밖 — 그건 다른 축의 문제라 여기서 판정하지 않는다
  return curriculumFit(content, band.school).marketPercentile
}

/** 하한 미달이면 이유 문자열, 아니면 빈 문자열(= 통과). */
function tooEasy(content) {
  if (MIN_MARKET <= 0) return ''
  const pos = marketPos(content)
  if (pos == null) return ''
  return pos < MIN_MARKET
    ? `시중 자리 ${pos} — 하한 ${MIN_MARKET} 미만이다(시중 지문보다 쉽다)`
    : ''
}

const skipped = []
const ok = []
const seenTitle = new Set()
for (const r of rows) {
  const title = String(r.title ?? '').trim()
  const content = String(r.content ?? '').trim()
  const words = content.split(/\s+/).filter(Boolean).length
  const sentences = countSentences(content)
  const easyWhy = tooEasy(content) // 한 번만 잰다 — 아래 사슬에서 두 번 부르면 두 번 계산한다
  if (!title) skipped.push([r.slot, '제목이 비었다'])
  else if (!content) skipped.push([r.slot, '본문이 비었다'])
  else if (words < MIN_WORDS) skipped.push([r.slot, `${words}어 — ${MIN_WORDS}어 미만`])
  else if (sentences < MIN_SENTENCES)
    skipped.push([r.slot, `${sentences}문장 — ${MIN_SENTENCES}문장 미만이면 문항을 못 만든다`])
  else if (seenTitle.has(title.toLowerCase()))
    skipped.push([r.slot, '같은 청크 안에 제목이 겹친다'])
  else if (easyWhy) skipped.push([r.slot, easyWhy])
  else {
    seenTitle.add(title.toLowerCase())
    // **문단을 여기서 나눈다** — 안 나누면 순서 문항이 0 이 된다(위 `repaginate` 주석 참조).
    ok.push({ ...r, title, content: repaginate(content), words, sentences })
  }
}
console.log(`  넣을 수 있는 것 ${ok.length} · **건너뛴 것 ${skipped.length}**`)
if (MIN_MARKET <= 0)
  console.log('  ⚠️ 시중 하한을 껐다(--min-market 0) — 쉬운 글이 그대로 들어간다')
{
  // **막은 수만 찍지 않는다** — 통과한 것들이 어디 모여 있는지가 다음 지침을 정한다.
  const ps = ok
    .map((r) => marketPos(r.content))
    .filter((x) => x != null)
    .sort((a, b) => a - b)
  if (ps.length) {
    const q = (f) => ps[Math.min(ps.length - 1, Math.floor(ps.length * f))]
    console.log(
      `  통과분 시중 자리: 최소 ${ps[0]} · 중앙 ${q(0.5)} · 최대 ${ps[ps.length - 1]}` +
        `  (50 = 시중 중앙 · 20 이면 시중보다 쉬운 글만 모은 것)`
    )
  }
}
for (const [slot, why] of skipped) console.log(`    · 슬롯 ${slot}: ${why}`)

// ── 밴드를 여기서 다시 잰다 ─────────────────────────────────────────
//
// ⚠️ **집필하는 쪽의 자가 보고를 믿지 않는다.** 배치들이 "자가 검사 5/5" 라고 보고한 묶음이
//   실제로는 13편 중 8편만 적중했다(2026-08-21). 저장된 파일을 직접 재 보니 검사기 예측과
//   DB 실제 배정은 19/19 로 일치했다 — 즉 **검사기는 맞았고 보고가 틀렸다.**
//   앞선 초안을 재고 보고했거나, 재고 나서 손을 더 댄 것이다.
//
// 그래서 적재하는 자리에서 한 번 더 잰다. **막지는 않는다** — 빗나간 글도 다른 계단에
// 쌓이고 그 계단도 비어 있다. 다만 **몇 편이 어디로 갔는지 반드시 찍는다.**
const { extractBookLemmas } = await import('@vocaflow/library-pipeline')
const { fetchAllIn } = await import('./volume-pool.mjs')
{
  const per = ok.map((r) => {
    const c = String(r.content)
    const idx = extractBookLemmas([
      {
        chapter_idx: 1,
        content: c,
        word_count: c.split(/\s+/).filter(Boolean).length,
        paragraph_offsets: [0],
        sentence_offsets: [0],
      },
    ])
    return { r, lemmas: [...idx.bookFrequency.keys()] }
  })
  const all = [...new Set(per.flatMap((d) => d.lemmas))]
  const lv = new Map()
  for (const d of await fetchAllIn(db, 'shared_dictionary', 'word, v_level', 'word', all, [
    'word',
  ])) {
    // 채점기와 같이 v11 을 뺀다(`compute_article_vrl`).
    if (d.v_level != null && Number(d.v_level) !== 11) lv.set(d.word, Number(d.v_level))
  }
  const pct = (s, q) =>
    s.length ? s[Math.max(0, Math.min(s.length - 1, Math.ceil(q * s.length) - 1))] : null
  let hit = 0
  const off = []
  for (const { r, lemmas } of per) {
    const p75 = pct(
      lemmas
        .map((w) => lv.get(w))
        .filter(Number.isFinite)
        .sort((a, b) => a - b),
      0.75
    )
    r.predicted_v_level = p75
    if (p75 === BAND) hit++
    else off.push([r.slot, p75])
  }
  console.log(
    `  **목표 밴드 적중(적재 전 실측) ${hit}/${per.length}** = ${((100 * hit) / Math.max(1, per.length)).toFixed(1)}%`
  )
  if (off.length) {
    console.log(
      `    빗나간 것 — 버리지 않는다(그 계단도 비어 있다). 슬롯: ${off.map(([s, p]) => `${s}→V${p}`).join(' · ')}`
    )
  }
}

// ── 이미 넣었는데 파일이 그 뒤에 고쳐진 것 ──────────────────────────
//
// ⚠️ **집필 배치가 끝나기 전에 적재하면 낡은 판이 DB 에 남는다.** 실제로 그랬다 —
//   적재 시점 실측이 8/13 이라 "배치 보고가 틀렸다" 고 결론냈는데, 배치가 완료 보고를 한 뒤
//   같은 파일을 다시 재니 **13/13** 이었다. 배치는 정직했고 **내가 먼저 적재한 것**이다.
//   `source_id` 유일키가 재적재를 막으므로, 고쳐진 본문은 이 경로로만 반영된다.
//
// 본문이 바뀌면 문단 번호가 바뀌어 **이미 붙은 문항이 낡는다** — 그래서 되돌릴 수 없고,
// `--commit` 없이는 미리보기만 한다. 뒤에 `refresh-dcp-items` 를 다시 돌려야 한다.
if (process.argv.includes('--update-existing')) {
  /**
   * ⚠️ **id 를 조립하지 않는다 — 청크가 실어 온 것을 쓴다.**
   *
   * 예전에는 `original:v${BAND}-${slot}` 로 만들었다. 그런데 `source_id` 의 밴드 번호는
   * **그 글이 처음 쓰인 밴드**이고, `article_v_level` 은 **지금 실측된 밴드**라 서로 다를 수 있다.
   * 개정 드레인(`market-revise-export.mjs`)은 `article_v_level` 로 고르므로
   * `original:v2-32`(실측 V3)가 "슬롯 32" 로 나온다. 그걸 `original:v3-32` 에 쓰면
   * **전혀 다른 글을 덮어쓴다.**
   *
   * 실제로 그렇게 3건을 덮어썼다(2026-09-06): v3-32(실측 V4) · v3-35(V4) · v3-57.
   * 문항 payload 에 원문 문장이 남아 있어 되살렸지만, **되살릴 수 없었을 수도 있었다.**
   *
   * 그래서 청크에 `source_id` 가 있으면 그것을 쓰고, 없으면(집필 드레인) 예전처럼 만든다.
   */
  const idOf = (r) => r.source_id ?? `original:v${BAND}-${r.slot}`
  const ids = ok.map(idOf)
  /**
   * ⚠️ **`source` 를 반드시 함께 건다.** 유일 인덱스가
   * `(source, source_id)` 라 선두 열이 빠지면 인덱스를 **통째로 훑는다.**
   *
   * 실측 2026-09-06 (같은 5개 id · 같은 순간):
   *   source 없이  → Index Scan **16,897ms** · 1,039 페이지 디스크 읽기 → statement timeout
   *   source 함께  → Index Cond 로 들어가 **32ms** · 5 페이지
   *
   * 페이지를 500→250→125 로 줄여도 안 낫는다 — 무거운 것은 행 수가 아니라
   * **인덱스 전체 훑기**라 페이지 크기와 무관하다. 이 파일의 다른 세 질의는
   * 처음부터 `.eq('source','original')` 를 걸고 있었고 여기만 빠져 있었다.
   * (`library_articles` 가 90,485행으로 늘면서 8초 상한을 넘어섰다.)
   */
  const cur = new Map(
    (
      await fetchAllIn(
        db,
        'library_articles',
        'source_id, content',
        'source_id',
        ids,
        ['source_id'],
        (q) => q.eq('source', 'original')
      )
    ).map((d) => [d.source_id, d.content])
  )
  const stale = ok.filter((r) => {
    const c = cur.get(idOf(r))
    if (c == null) return false
    return String(c).replace(/\s+/g, ' ').trim() !== String(r.content).replace(/\s+/g, ' ').trim()
  })
  console.log(
    `\n이미 넣은 것 중 **파일이 더 새로운 것 ${stale.length}편** — 슬롯: ${stale.map((r) => r.slot).join(' · ') || '없음'}`
  )
  if (!commit) {
    console.log('--commit 을 붙이면 본문을 갱신한다. **문단 번호가 바뀌어 기존 문항이 낡는다.**')
    process.exit(0)
  }
  let n = 0
  for (const r of stale) {
    const { error: ue } = await db
      .from('library_articles')
      .update({ content: r.content, content_hash: sha256(r.content) })
      .eq('source', 'original')
      .eq('source_id', idOf(r))
    if (ue) console.log(`  ✗ 슬롯 ${r.slot}: ${ue.message}`)
    else n++
  }
  console.log(`\n갱신 ${n}편. 이어서 돌릴 것:`)
  console.log(
    '  1. pnpm dlx tsx scripts/acp/reprocess.mjs --missing-vocab --commit  (어휘가 비었으면)'
  )
  console.log('  2. pnpm dlx tsx scripts/textbook/refresh-dcp-items.mjs --commit     (문항 재생성)')
  process.exit(0)
}

// ── 이미 있는 것 ────────────────────────────────────────────────────
const sourceIds = ok.map((r) => `original:v${BAND}-${r.slot}`)
const existing = new Set()
// 50개씩 끊어 묻는다 — 한 번에 50행을 넘지 않으므로 1,000행 상한과 무관하다.
// ( 가 여기를 의심으로 내지만 오탐이다.)
for (let i = 0; i < sourceIds.length; i += 50) {
  const { data, error } = await db
    .from('library_articles')
    .select('source_id')
    .eq('source', 'original')
    .in('source_id', sourceIds.slice(i, i + 50))
  if (error) throw new Error('중복 조회 실패: ' + error.message)
  for (const r of data ?? []) existing.add(r.source_id)
}
const fresh = ok.filter((r) => !existing.has(`original:v${BAND}-${r.slot}`))
console.log(`  이미 있음 ${ok.length - fresh.length} · **새로 넣을 것 ${fresh.length}**`)

if (!commit) {
  console.log('\n--commit 을 붙이면 적재한다.')
  process.exit(0)
}

// ── 배치를 먼저 만든다 ──────────────────────────────────────────────
//
// `chk_original_needs_batch` 가 `source='original'` 인 행에 `compose_batch_id` 와
// `composed_spec` 을 **둘 다** 요구한다. 우리가 쓴 글이 어디서 왔는지 추적할 수 없으면
// 나중에 "이 지문 출처가 뭐냐" 에 답할 수 없기 때문이다 — 우회할 이유가 없는 가드다.
//
// 그래서 드레인 실행마다 배치 한 행을 만들고 이번에 넣는 글을 거기 매단다.
// `status='done'` — 이 배치는 이미 다 쓰인 상태로 들어온다(수집 단계를 거치지 않는다).
const batchTopic = `교재 집필 드레인 V${BAND} — ${outFiles.length}청크 ${fresh.length}편`
const { data: batch, error: be } = await db
  .from('article_compose_batches')
  .insert({ topic: batchTopic, status: 'done' })
  .select('id')
  .single()
if (be) throw new Error('배치 생성 실패: ' + be.message)
console.log(`\n배치 ${batch.id} — ${batchTopic}`)

let inserted = 0
for (const r of fresh) {
  const { error } = await db.from('library_articles').insert({
    source: 'original',
    source_id: `original:v${BAND}-${r.slot}`,
    compose_batch_id: batch.id,
    source_url: '',
    title: r.title,
    language: 'en',
    // 창작물이다 — 시중 교재를 입력으로 쓰지 않았다.
    license: 'CC0-1.0 (Vocaflow Original)',
    copyright_safe_in_kr: true,
    content: r.content,
    content_hash: sha256(r.content),
    // ⚠️ `ready` 로 넣는다. **`published` 로 넣지 않는다** — 발행은 사람 판단이다.
    status: 'ready',
    display_only: false,
    llm_cost_usd: 0,
    composed_spec: {
      track: 'csat_korean',
      written_by: 'claude_code_drain',
      target_v_level: BAND,
      topic_axis: r.topic_axis ?? null,
      shape: r.shape ?? null,
      words_min: r.words_min ?? null,
      words_max: r.words_max ?? null,
      // **이번 실행의 어휘 조건.** 밴드 조준은 아직 미해결이라 조건을 바꿔 가며 재고 있다.
      // 이 값이 없으면 "어떤 지침으로 쓴 글인지" 를 알 수 없어 조건별 적중률을 못 낸다.
      tail_min: r.tail_min ?? null,
      tail_max: r.tail_max ?? null,
      at_band_min: r.at_band_min ?? null,
      at_band_max: r.at_band_max ?? null,
      // 적재 직전에 실측한 예측 밴드. 분석이 끝난 뒤 `article_v_level` 과 대조하면
      // **검사기가 여전히 채점기와 맞는지**를 언제든 다시 확인할 수 있다.
      predicted_v_level: r.predicted_v_level ?? null,
    },
  })
  if (error) console.log(`  ✗ 슬롯 ${r.slot}: ${error.message}`)
  else inserted++
}

console.log(`\n적재 완료 ${inserted}편`)
console.log('이어서 돌릴 것:')
console.log(
  '  1. pnpm dlx tsx scripts/acp/reprocess.mjs --missing-vocab --commit   (어휘·CEFR·밴드)'
)
console.log('  2. pnpm dlx tsx scripts/textbook/store-new-types.mjs --commit        (문항 생성)')
console.log('그 다음 write-drain-export 를 다시 돌려 **의도한 밴드에 떨어졌는지** 확인한다.')

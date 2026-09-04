// scripts/csat/compose-drain-import.mjs
//
// **작문 드레인 3단 — 채점해서 붙은 것만 적재한다.**
//
// ── 이 파일이 지키는 계약 ────────────────────────────────────────────
// ① **떨어진 글은 안 넣는다.** 수확 경로와 같은 원칙이다 — 적재된 모든 행이
//    `csat_fit.pass > 0` 이어야 「적합도 100%」가 말이 된다.
// ② **떨어진 글을 버리지도 않는다.** `chunk-NN.reject.json` 으로 빼 두고 왜 떨어졌는지
//    (대역의 어느 축) 함께 적는다. 파일럿에서 떨어진 3편이 **측정-수정 한 바퀴로 붙었다** —
//    버리면 그 한 바퀴를 못 돈다.
// ③ **빈 값·짧은 값은 세지 않는다.** CLAUDE.md §🤖: 빈 값이 들어가면 다음 export 가
//    "완료" 로 세어 **구멍이 영영 남는다.** 건너뛴 수를 반드시 출력한다.
//
// ── 스키마 제약 (실측 2026-09-03) ────────────────────────────────────
// `library_articles.source='original'` 은 CHECK `chk_original_needs_batch` 때문에
// **`compose_batch_id` 와 `composed_spec` 이 둘 다 있어야** 들어간다. 그래서 이 파일이
// `article_compose_batches` 행을 먼저 만든다(`topic` 필수 · `status` 기본 `collecting`).
// 그 제약은 출처 없는 합성 글이 조용히 끼어드는 것을 막는 장치이므로 우회하지 않는다.
//
// ── 재실행 안전 ──────────────────────────────────────────────────────
// `source_id` 를 내용 해시로 만들어 DB 와 대조한다 — 같은 글을 두 번 넣지 않는다.
// 이미 적재된 청크를 다시 돌려도 "중복" 으로 세고 넘어간다.
//
// 실행:
//   node scripts/csat/compose-drain-import.mjs               # 예행 (읽기 전용)
//   node scripts/csat/compose-drain-import.mjs --commit

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { fitRecord, scoreArticle, SHAPE, FLOOR, W, splitSentences } from './lib-fit.mjs'
import { classify } from './lib-topic.mjs'

const COMMIT = process.argv.includes('--commit')
const DIR = path.resolve('scripts/csat/compose-drain')

const CONNECTIVE =
  /\b(however|therefore|thus|hence|moreover|furthermore|nevertheless|nonetheless|consequently|accordingly|meanwhile|instead|rather|although|though|whereas|while|because|since|so that|as a result|for example|for instance|in contrast|on the other hand|in other words|that is|in fact|indeed|by contrast|similarly|likewise|in addition|on the contrary|in short|in sum)\b/gi
const ANAPHORA = /\b(this|these|those|such|its|their|his|her|they|them|it)\b/gi

/**
 * **가장 아깝게 빗나간 창**을 찾아 그 창의 실제 수치를 낸다.
 *
 * ⚠️ 왜 필요한가: 글 전체 평균이 대역 안인데도 창이 하나도 안 잡히는 일이 잦다
 *   (채점은 **창 단위**이므로 평균이 맞아도 모든 창이 벗어날 수 있다). 전체 평균만 보고
 *   "대역은 맞는데 창이 안 잡힌다" 고만 말하면 고칠 방향을 모른 채 다시 쓰게 되고,
 *   실제로 그 추측 수정에 매번 한 바퀴씩 썼다. 창을 직접 열어 보면 어느 축이 얼마나
 *   벗어났는지 나온다.
 */
function nearestWindow(text) {
  const sents = splitSentences(text)
  const wp = sents.map(W)
  let best = null
  for (let i = 0; i < sents.length; i++) {
    let acc = []
    for (let j = i; j < sents.length; j++) {
      acc = acc.concat(wp[j])
      if (acc.length > SHAPE.words.hi) break
      if (acc.length < SHAPE.words.lo) continue
      const sentLen = acc.length / (j - i + 1)
      const wordLen = acc.reduce((s, x) => s + x.length, 0) / acc.length
      // 대역 밖으로 벗어난 정도를 상대값으로 합산 — 가장 작은 것이 「가장 아까운 창」이다.
      const off =
        Math.max(0, SHAPE.sentLen.lo - sentLen, sentLen - SHAPE.sentLen.hi) / SHAPE.sentLen.hi +
        Math.max(0, SHAPE.wordLen.lo - wordLen, wordLen - SHAPE.wordLen.hi) / SHAPE.wordLen.hi
      if (!best || off < best.off) best = { off, sentLen, wordLen, words: acc.length, from: i, to: j }
    }
  }
  return best
}

/** 왜 떨어졌는지 — 다음 판을 어느 쪽으로 고칠지가 여기서 나온다. */
function why(text) {
  const words = W(text)
  const sents = splitSentences(text)
  const sentLen = words.length / Math.max(1, sents.length)
  const wordLen = words.reduce((s, x) => s + x.length, 0) / Math.max(1, words.length)
  const ana = (100 * (text.match(ANAPHORA) ?? []).length) / Math.max(1, words.length)
  const out = []
  if (words.length < SHAPE.words.lo * 1.6) out.push(`글이 짧다 (${words.length}어 — 창이 두 개는 나와야 한다)`)
  if (sentLen < SHAPE.sentLen.lo) out.push(`문장이 짧다 (${sentLen.toFixed(1)} < ${SHAPE.sentLen.lo.toFixed(1)})`)
  if (sentLen > SHAPE.sentLen.hi) out.push(`문장이 길다 (${sentLen.toFixed(1)} > ${SHAPE.sentLen.hi.toFixed(1)})`)
  if (wordLen < SHAPE.wordLen.lo) out.push(`낱말이 짧다 (${wordLen.toFixed(2)} < ${SHAPE.wordLen.lo.toFixed(2)} — 학술어를 더 섞는다)`)
  if (wordLen > SHAPE.wordLen.hi) out.push(`낱말이 길다 (${wordLen.toFixed(2)} > ${SHAPE.wordLen.hi.toFixed(2)} — 쉬운 말로 절반쯤 바꾼다)`)
  if ((text.match(CONNECTIVE) ?? []).length === 0) out.push('연결사가 없다')
  if (ana < FLOOR.ana) out.push(`지시어 부족 (${ana.toFixed(2)} < ${FLOOR.ana.toFixed(2)})`)
  if (!out.length) {
    // 전체 평균은 대역 안이다 — 그러면 **창**을 열어 봐야 한다.
    const w = nearestWindow(text)
    if (!w) {
      out.push(`어수 대역(${SHAPE.words.lo}~${SHAPE.words.hi})에 드는 창이 하나도 없다 — 문장을 더 고르게`)
    } else if (w.off === 0) {
      out.push(
        `모양은 통과했는데 담화에서 떨어졌다 — 그 창(문장 ${w.from + 1}~${w.to + 1})에 ` +
          `연결사와 지시어를 둘 다 넣는다 (지시어 ${FLOOR.ana.toFixed(2)}/100어 이상)`,
      )
    } else {
      const bits = []
      if (w.sentLen < SHAPE.sentLen.lo) bits.push(`문장 ${w.sentLen.toFixed(1)} < ${SHAPE.sentLen.lo.toFixed(1)}`)
      if (w.sentLen > SHAPE.sentLen.hi) bits.push(`문장 ${w.sentLen.toFixed(1)} > ${SHAPE.sentLen.hi.toFixed(1)}`)
      if (w.wordLen < SHAPE.wordLen.lo) bits.push(`낱말 ${w.wordLen.toFixed(2)} < ${SHAPE.wordLen.lo.toFixed(2)}`)
      if (w.wordLen > SHAPE.wordLen.hi) bits.push(`낱말 ${w.wordLen.toFixed(2)} > ${SHAPE.wordLen.hi.toFixed(2)}`)
      out.push(
        `전체 평균은 대역 안인데 **창 단위로는 벗어난다** — 가장 아까운 창(문장 ${w.from + 1}~${w.to + 1}, ` +
          `${w.words}어): ${bits.join(' · ')}`,
      )
    }
  }
  return out
}

const outs = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => /^chunk-\d+\.out\.json$/.test(f)).sort() : []
if (!outs.length) {
  console.log(`채운 청크가 없다 — ${path.relative(process.cwd(), DIR)}/chunk-NN.out.json`)
  process.exit(0)
}

let db = null
if (COMMIT) {
  for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  const { createClient } = await import('@supabase/supabase-js')
  db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

console.log(`작문 드레인 import — 채점해서 붙은 것만 넣는다\n${'='.repeat(78)}`)
console.log(`  청크 ${outs.length}개${COMMIT ? ' · **적재한다**' : ' (예행 — --commit 을 붙이면 쓴다)'}\n`)

let seen = 0
let skipped = 0
let passed = 0
let rejected = 0
let inserted = 0
let dup = 0
const byTopic = {}
const failures = []

for (const f of outs) {
  let items
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
    items = Array.isArray(raw) ? raw : raw.items
  } catch (e) {
    failures.push(`${f}: JSON 파싱 실패 — ${e.message}`)
    continue
  }
  if (!Array.isArray(items)) {
    failures.push(`${f}: items 배열이 없다`)
    continue
  }

  const rows = []
  const rejects = []
  for (const it of items) {
    seen++
    const text = String(it.content ?? '').trim()
    const title = String(it.title ?? '').trim()
    // ⚠️ 빈 값·짧은 값은 **세지 않는다** — 넣으면 다음 export 가 "완료" 로 세어 구멍이 남는다.
    if (!title || text.split(/\s+/).filter(Boolean).length < SHAPE.words.lo) {
      skipped++
      continue
    }
    const sc = scoreArticle(text)
    if (sc.pass <= 0) {
      rejected++
      rejects.push({ ...it, reason: why(text), shape: sc.shape })
      continue
    }
    passed++
    const tp = classify(text.slice(0, 6000))
    const topic = tp.topic
    byTopic[topic] = (byTopic[topic] ?? 0) + 1
    rows.push({
      source: 'original',
      // 내용 해시 — 같은 글을 두 번 넣지 않는다(파일을 다시 돌려도 안전).
      source_id: `composed:${crypto.createHash('sha256').update(text).digest('hex').slice(0, 24)}`,
      title,
      author: null,
      source_url: null,
      published_at: null,
      license: 'CC0 1.0',
      license_class: 'cc0',
      content: text,
      status: 'queued',
      feed_id: 'compose-drain',
      feed_label: `작문 드레인 · ${topic}`,
      // 소재를 적재 시점에 함께 적는다 — 그래야 전수 집계에서 안 빠진다.
      csat_fit: { ...fitRecord(text), topic, topicMargin: tp.margin, topicV: 1 },
      _topic: topic,
      _intended: it.topic ?? null,
      _subject: it.subject ?? null,
    })
  }

  if (rejects.length) {
    const rf = path.join(DIR, f.replace('.out.json', '.reject.json'))
    fs.writeFileSync(rf, JSON.stringify(rejects, null, 1))
  }
  console.log(
    `  ${f} — 붙음 ${rows.length} · 떨어짐 ${rejects.length} · 건너뜀 ${items.length - rows.length - rejects.length}` +
      (rejects.length ? `  → ${f.replace('.out.json', '.reject.json')}` : ''),
  )
  for (const r of rejects.slice(0, 3)) console.log(`      · ${String(r.title || r.subject).slice(0, 40)} — ${r.reason[0]}`)

  if (!COMMIT || !rows.length) continue

  // 중복 확인
  const { data: existing, error: exErr } = await db
    .from('library_articles')
    .select('source_id')
    .eq('source', 'original')
    .in('source_id', rows.map((r) => r.source_id))
  if (exErr) {
    failures.push(`${f}: 중복 확인 실패 — ${exErr.message}`)
    continue
  }
  const have = new Set((existing ?? []).map((r) => r.source_id))
  const fresh = rows.filter((r) => !have.has(r.source_id))
  dup += rows.length - fresh.length
  if (!fresh.length) continue

  // ⚠️ `source='original'` 은 배치가 있어야 들어간다(CHECK chk_original_needs_batch).
  const { data: batch, error: bErr } = await db
    .from('article_compose_batches')
    .insert({ topic: `작문 드레인 ${f.replace('.out.json', '')}`, status: 'collecting' })
    .select('id')
    .single()
  if (bErr || !batch) {
    failures.push(`${f}: 배치 생성 실패 — ${bErr?.message ?? '알 수 없음'}`)
    continue
  }

  const toWrite = fresh.map(({ _topic, _intended, _subject, ...row }) => ({
    ...row,
    compose_batch_id: batch.id,
    composed_spec: { kind: 'csat-slot-fill', slot: _topic, intended: _intended, subject: _subject, band: SHAPE.words },
  }))
  const { error } = await db.from('library_articles').insert(toWrite)
  if (error) failures.push(`${f}: 적재 실패 — ${error.message}`)
  else inserted += toWrite.length
}

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(0) : '0')
console.log('\n  ' + '-'.repeat(74))
console.log(`  항목 ${seen} · **붙음 ${passed} (${pct(passed, seen - skipped)}%)** · 떨어짐 ${rejected} · 빈 값 건너뜀 ${skipped}`)
if (Object.keys(byTopic).length) {
  console.log(`  소재: ${Object.entries(byTopic).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
}
if (COMMIT) console.log(`  중복 ${dup} · **적재 ${inserted}편**`)
else console.log(`  → 적재 가능 ${passed}편 (예행)`)
if (rejected) {
  console.log(`\n  떨어진 ${rejected}편은 \`*.reject.json\` 에 이유와 함께 있다 — 고쳐 써서 out 에 다시 넣는다.`)
  console.log(`  ⚠️ 버리지 말 것. 파일럿에서 떨어진 3편이 측정-수정 한 바퀴로 전부 붙었다.`)
}
if (failures.length) {
  console.log(`\n  실패 ${failures.length}:`)
  for (const x of failures.slice(0, 5)) console.log('    · ' + x)
}
if (COMMIT && inserted > 0) {
  console.log(`\n  다음 export 전에 재고를 다시 잰다:`)
  console.log(`    node scripts/csat/topic-gap.mjs --sample 3000 --out docs/reports/topic-gap.json`)
}

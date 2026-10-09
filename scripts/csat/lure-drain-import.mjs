// scripts/csat/lure-drain-import.mjs
//
// **끌리는 구절 드레인 — 가져오기.** `lure-drain/chunk-NN.out.json` 을 검증해 `csat_item_analyses.choice_analysis`
// 의 해당 오답(n)에 `lure_quote` 키 **하나만** 더한다. 행을 다시 읽어 그 원소에만 키를 넣는다(통째로 덮지 않는다 —
// 덮으면 다른 키가 날아간다). 버전이 바뀐 분석(내보낸 뒤 재분석)은 건너뛴다.
//
// 검증(하나라도 어기면 그 오답은 건너뛰고 사유별로 센다):
//   · 지문 안에 정규화 일치(findQuote)로 있다 · 길이 20–80자 · 정답 근거(answer_locus.quote)와 같은 구절이 아니다
//   · 오답 선지 · 지금 자리 없음(locateChoice null) — 이미 자리가 있으면 건드리지 않는다
//   · null 은 「지문에 끌리는 자리가 없다」는 판정 — 쓰지 않고 센다(빈 값은 넣지 않는다)
//
// 기본은 예행(쓰지 않음). `--commit` 이면 쓴다. 재실행 안전 — 이미 lure_quote 가 있거나 자리를 찾으면 건너뛴다.
//   pnpm exec tsx scripts/csat/lure-drain-import.mjs [--commit]

import fs from 'node:fs'
import path from 'node:path'

import { FRAG_MIN, locateChoice } from './lib-fragments.mjs'

for (const f of ['apps/web/.env.local', '.env.local']) {
  if (!fs.existsSync(f)) continue
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const { createClient } = await import('@supabase/supabase-js')
const { findQuote, normalizeForMatch } = await import('../../apps/web/src/lib/csat/quote-match.ts')

const COMMIT = process.argv.includes('--commit')
const MAX = 80
const DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'lure-drain')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const outs = fs.readdirSync(DIR).filter((f) => /^chunk-\d+\.out\.json$/.test(f)).sort()
const skip = {}
const bump = (k) => (skip[k] = (skip[k] ?? 0) + 1)
let accepted = 0
let written = 0
let noLocus = 0
const samples = []

for (const f of outs) {
  const out = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
  for (const row of out.items ?? []) {
    const { data: a, error } = await db
      .from('csat_item_analyses')
      .select('id, item_id, version, status, answer_locus, choice_analysis')
      .eq('id', row.analysis_id)
      .single()
    if (error || !a) { bump('분석 행 없음'); continue }
    if (a.version !== row.version || a.status !== 'published') { bump('버전 · 상태가 내보낸 때와 다름'); continue }
    const { data: it } = await db.from('csat_items').select('passage').eq('id', a.item_id).single()
    const passage = it?.passage ?? ''
    const answerNorm = a.answer_locus?.quote ? normalizeForMatch(a.answer_locus.quote).text : null

    const next = structuredClone(a.choice_analysis)
    let changed = false
    for (const d of row.distractors ?? []) {
      const ch = next.find((c) => c.n === d.n)
      if (!ch) { bump('선지 번호 없음'); continue }
      if (ch.verdict === 'correct') { bump('정답 선지'); continue }
      if (locateChoice(ch, passage, findQuote)) { bump('이미 자리 있음'); continue }
      const q = typeof d.lure_quote === 'string' ? d.lure_quote.trim() : ''
      if (!q) { noLocus += 1; continue }
      if (q.length < FRAG_MIN || q.length > MAX) { bump(`길이 ${FRAG_MIN}–${MAX} 밖`); continue }
      if (!findQuote(passage, q)) { bump('지문에 없음'); continue }
      if (answerNorm && normalizeForMatch(q).text === answerNorm) { bump('정답 근거와 같은 구절'); continue }
      ch.lure_quote = q
      changed = true
      accepted += 1
      if (samples.length < 8) samples.push(`${a.item_id} ⑤${d.n}: ${q}`.replace('⑤', '#'))
    }
    if (!changed || !COMMIT) continue
    const { error: uerr } = await db
      .from('csat_item_analyses')
      .update({ choice_analysis: next })
      .eq('id', a.id)
      .eq('version', a.version)
    if (uerr) { bump(`쓰기 실패: ${uerr.message}`); continue }
    written += 1
  }
}

console.log(`${COMMIT ? '반영' : '예행'} — 받아들인 끌리는 구절 ${accepted}개 · 「지문에 자리 없음」 판정 ${noLocus}개${COMMIT ? ` · 갱신한 분석 ${written}행` : ''}`)
console.log('건너뜀(사유별):', JSON.stringify(skip))
for (const s of samples) console.log('  ', s)
if (!COMMIT) console.log('예행이다. 쓰려면 --commit. 반영 뒤 node scripts/csat/build-skeleton-data.mjs --write 로 골격을 다시 굽는다.')

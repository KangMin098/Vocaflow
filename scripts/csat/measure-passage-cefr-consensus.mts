// scripts/csat/measure-passage-cefr-consensus.mts
//
// **기출 지문 난이도를 3중 합의 방식으로 잰다 — 읽기 전용 · 집계만 출력.**
//
// `measure-passage-cefr.mjs`(가독성 신호 하나)의 후속이다. 사용자 지시 2026-09-20:
// 「802편을 3중 합의로 재측정, 유형별·연도별 표 갱신」.
//
// ── 무엇을 쓰는가 (정본과 같은 식) ────────────────────────────────────
//   신호 1 어휘 분포 (가중 0.5) — 지문의 lemma 빈도에서 **80 백분위 CEFR**.
//                                 lemma 는 `@vocaflow/wlp`(정본 추출기가 쓰는 것),
//                                 CEFR 은 `shared_dictionary.cefr_level`.
//   신호 2 가독성   (가중 0.3) — Flesch Reading Ease → CEFR(경계 90/80/70/55/40).
//   신호 3 LLM      (가중 0.2) — **쓰지 않는다**(지문 802편을 모델에 보내면 기출 원문이 밖으로 나간다).
//   합의            — `cefr-detect.ts` 의 `aggregate` 와 같은 방식: 가중 평균 후 반올림.
//                     LLM 이 없으면 가중치 합을 0.8 로 재정규화하는 것도 그 함수와 같다.
//
// ⚠️ **저작권**: 본문을 읽어 수치만 낸다. 지문 조각·제목을 출력하지 않는다(docs/CSAT_SOURCE_GATE).
// ⚠️ 신호 1 의 사전 적중률(어휘 중 사전에 있는 비율)을 함께 찍는다 — 낮으면 그 신호는 약하다.
//
// 실행: pnpm exec tsx scripts/csat/measure-passage-cefr-consensus.mts [--json]

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'
import { processText } from '@vocaflow/wlp'

for (const line of readFileSync(resolve('apps/web/.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, '')
}
const req = createRequire(resolve('packages/library-pipeline/package.json'))
const readabilityModule = req('text-readability')
const readability = readabilityModule.default ?? readabilityModule

const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!, {
  auth: { persistSession: false },
})

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
type Cefr = (typeof CEFR)[number]

/** 신호 2 — `cefr-detect.ts` 와 같은 경계값. */
const byReadability = (fre: number): Cefr =>
  fre >= 90 ? 'A1' : fre >= 80 ? 'A2' : fre >= 70 ? 'B1' : fre >= 55 ? 'B2' : fre >= 40 ? 'C1' : 'C2'

/** 합의 — `cefr-detect.ts` 의 aggregate 와 같은 가중·반올림(LLM 없음 → 0.8 로 재정규화). */
const consensus = (vocab: Cefr, read: Cefr): Cefr => {
  const idx = (l: Cefr) => CEFR.indexOf(l)
  const avg = (idx(vocab) * 0.5 + idx(read) * 0.3) / 0.8
  return CEFR[Math.max(0, Math.min(5, Math.round(avg)))]!
}

// ── 사전: word → cefr_level (페이지로 전량) ───────────────────────────
const dict = new Map<string, Cefr>()
for (let from = ''; ; ) {
  let q = db.from('shared_dictionary').select('word, cefr_level').order('word').limit(1000)
  if (from) q = q.gt('word', from)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  if (!data?.length) break
  for (const row of data) {
    const level = row.cefr_level as string | null
    if (level && (CEFR as readonly string[]).includes(level)) dict.set(row.word as string, level as Cefr)
  }
  from = data.at(-1)!.word as string
  if (data.length < 1000) break
}

// ── 지문 ──────────────────────────────────────────────────────────────
type Item = { id: string; exam_id: string; type_id: string | null; passage: string | null }
const items: Item[] = []
for (let from = ''; ; ) {
  let q = db.from('csat_items').select('id, exam_id, type_id, passage').order('id').limit(500)
  if (from) q = q.gt('id', from)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  if (!data?.length) break
  items.push(...(data as Item[]))
  from = data.at(-1)!.id as string
  if (data.length < 500) break
}

/** 신호 1 — lemma 빈도의 80 백분위 CEFR. 사전에 없는 낱말은 분모에서 뺀다(정본과 같다). */
function byVocab(text: string): { level: Cefr; hitRate: number } {
  const counts: Record<Cefr, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 }
  let known = 0
  let seen = 0
  // WlpResult 는 문장 배열을 준다 — 토큰은 그 안에 있다(정본 extract-lemmas 와 같은 경로).
  const doc = processText(text)
  for (const token of doc.sentences.flatMap((s) => s.tokens)) {
    const lemma = (token.lemma ?? '').toLowerCase()
    if (!lemma || lemma.length < 2 || /\d/.test(lemma)) continue
    seen++
    const level = dict.get(lemma)
    if (!level) continue
    counts[level] += 1
    known += 1
  }
  if (!known) return { level: 'B1', hitRate: 0 }
  let cum = 0
  for (const level of CEFR) {
    cum += counts[level]
    if (cum / known >= 0.8) return { level, hitRate: known / Math.max(1, seen) }
  }
  return { level: 'C2', hitRate: known / Math.max(1, seen) }
}

const yearOf = (examId: string) => (/^M(\d{2})\d{2}$/.exec(examId)?.[1] ? `20${/^M(\d{2})/.exec(examId)![1]}` : examId)

const byType = new Map<string, Record<string, number>>()
const byYear = new Map<string, Record<string, number>>()
const overall: Record<string, number> = {}
const signalGap: Record<string, number> = {}
let measured = 0
let hitRateSum = 0

for (const r of items) {
  const text = (r.passage ?? '').trim()
  if (text.split(/\s+/).length < 40) continue
  const vocab = byVocab(text)
  const read = byReadability(readability.fleschReadingEase(text) as number)
  const level = consensus(vocab.level, read)
  measured++
  hitRateSum += vocab.hitRate
  const gap = `${vocab.level}/${read}`
  signalGap[gap] = (signalGap[gap] ?? 0) + 1
  const bump = (map: Map<string, Record<string, number>>, key: string) => {
    const cell = map.get(key) ?? {}
    cell[level] = (cell[level] ?? 0) + 1
    map.set(key, cell)
  }
  overall[level] = (overall[level] ?? 0) + 1
  bump(byType, r.type_id ?? '(유형 없음)')
  bump(byYear, yearOf(r.exam_id))
}

const pct = (cell: Record<string, number>) => {
  const total = Object.values(cell).reduce((a, b) => a + b, 0)
  return Object.fromEntries(
    CEFR.filter((k) => cell[k]).map((k) => [k, `${cell[k]} (${(((cell[k] ?? 0) / total) * 100).toFixed(1)}%)`]),
  )
}
const out = {
  readOnly: true,
  what: '3중 합의 중 **신호 1(어휘 0.5) + 신호 2(가독성 0.3)** — LLM 신호는 기출 원문 유출 때문에 쓰지 않는다',
  dictionaryWords: dict.size,
  measured,
  vocabHitRateAvg: `${((hitRateSum / Math.max(1, measured)) * 100).toFixed(1)}%`,
  overall: pct(overall),
  byType: Object.fromEntries([...byType].sort().map(([k, v]) => [k, pct(v)])),
  byYear: Object.fromEntries([...byYear].sort().map(([k, v]) => [k, pct(v)])),
  signalGapTop: Object.fromEntries(
    Object.entries(signalGap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8),
  ),
}
console.log(process.argv.includes('--json') ? JSON.stringify(out, null, 2) : JSON.stringify(out))

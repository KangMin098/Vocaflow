// scripts/csat/measure-band-rulers.mts
//
// **CEFR 상한(HIGH_BAND_MAX_CEFR = B2)을 실측으로 다시 정하기 위한 측정 — 읽기 전용 · 수치만 출력.**
//
// `assemble-unit.ts` 의 주석이 요구한 절차다: 「시중 고등 교재를 실측하면 이 값을 다시 정해야 한다 — 그때까지는 잠정」.
// 그리고 band-policy-measure-20260920 §6-3 이 권하고 하지 않은 것: 「막힌 글을 **같은 합의 식으로** 재서
// 수능 분포와 겹치는지 본다」. 세 집단을 **같은 자 하나**로 잰다 — 자가 다르면 비교가 성립하지 않는다.
//
//   ① 기출(csat_items.passage)            — 수능이 실제로 내는 수준
//   ② 시중 교재(textbook-corpus, 학년대별) — 시중 고등 교재가 실제로 싣는 수준(+ 중등 대조군)
//   ③ PLOS 발췌본 — 상한에 막힌 것 · 적격인 것(대조군). DB 에 저장된 CEFR 과 이 자의 일치도도 낸다
//
// 자: `measure-passage-cefr-consensus.mts` 와 같다 — 어휘 80백분위(0.5, `shared_dictionary`) + Flesch(0.3),
// LLM 없음 → 0.8 재정규화(정본 `cefr-detect.aggregate` 와 같은 식).
//
// ⚠️ **저작권**: 기출·시중 교재 본문을 출력하지 않는다. `--peek` 는 추출 검수용으로 교재 덩어리 앞 80자만
//   로컬 콘솔에 찍는다(파일로 쓰지 않는다).
// ⚠️ 시중 교재는 PDF 2단 조판이라 쪽 텍스트에 두 단이 한 줄로 섞여 있다. 넓은 공백(4칸+)으로 단을 가르고,
//   한글이 없고 90어 이상 · 문장 3개 이상 · 숫자 3% 미만인 영어 산문 덩어리만 지문으로 센다.
//
// 실행: pnpm exec tsx scripts/csat/measure-band-rulers.mts [--plos 800] [--peek] [--json out.json]

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
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

const argOf = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith('--') ? process.argv[i + 1]! : d
}
const PLOS_N = Number(argOf('plos', '800'))
const PEEK = process.argv.includes('--peek')
const CORPUS = argOf('corpus', 'd:/workspace/textbook-corpus/corpus.db')
/**
 * 어느 자로 재나. ⚠️ **둘이 한 단계 다르게 잰다**(2026-09-24 발견):
 *   `canonical` — DB 에 저장되는 값을 만드는 정본 경로(`extract-lemmas.ts`)처럼 **기능어를 뺀다**. 기본값.
 *   `all`       — `measure-passage-cefr-consensus.mts`(기출 C1 0.6% 를 낸 측정)처럼 기능어를 포함한다.
 * 기능어는 거의 A1 이라 포함하면 80백분위가 내려간다. 기출 기준선과 DB 값을 서로 다른 자로 재어
 * 「기출은 B2, 발췌본은 C1」처럼 보였다 — 비교는 반드시 같은 자로 한다.
 */
const RULER = argOf('ruler', 'canonical')
if (!['canonical', 'all'].includes(RULER)) throw new Error('--ruler canonical|all')

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
type Cefr = (typeof CEFR)[number]
const byReadability = (fre: number): Cefr =>
  fre >= 90 ? 'A1' : fre >= 80 ? 'A2' : fre >= 70 ? 'B1' : fre >= 55 ? 'B2' : fre >= 40 ? 'C1' : 'C2'
const consensus = (vocab: Cefr, read: Cefr): Cefr => {
  const idx = (l: Cefr) => CEFR.indexOf(l)
  return CEFR[Math.max(0, Math.min(5, Math.round((idx(vocab) * 0.5 + idx(read) * 0.3) / 0.8)))]!
}

// ── 사전 ──────────────────────────────────────────────────────────────
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

function byVocab(text: string): { level: Cefr; hitRate: number } {
  const counts: Record<Cefr, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 }
  let known = 0
  let seen = 0
  for (const token of processText(text).sentences.flatMap((s) => s.tokens)) {
    if (RULER === 'canonical' && (token.isStopWord || token.isPunctuation)) continue
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

type Group = { n: number; levels: Record<string, number>; hit: number; agree?: number; stored?: Record<string, number> }
const groups = new Map<string, Group>()
function measure(group: string, text: string, stored?: string | null) {
  const v = byVocab(text)
  const level = consensus(v.level, byReadability(readability.fleschReadingEase(text) as number))
  const g = groups.get(group) ?? { n: 0, levels: {}, hit: 0 }
  g.n++
  g.hit += v.hitRate
  g.levels[level] = (g.levels[level] ?? 0) + 1
  if (stored !== undefined) {
    g.stored ??= {}
    g.stored[stored ?? '(없음)'] = (g.stored[stored ?? '(없음)'] ?? 0) + 1
    g.agree = (g.agree ?? 0) + (stored === level ? 1 : 0)
  }
  groups.set(group, g)
}

// ── ① 기출 ────────────────────────────────────────────────────────────
for (let from = ''; ; ) {
  let q = db.from('csat_items').select('id, passage').order('id').limit(500)
  if (from) q = q.gt('id', from)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  if (!data?.length) break
  for (const r of data) {
    const text = String(r.passage ?? '').trim()
    if (text.split(/\s+/).length >= 40) measure('① 기출', text)
  }
  from = data.at(-1)!.id as string
  if (data.length < 500) break
}

// ── ② 시중 교재 ───────────────────────────────────────────────────────
/** 쪽 텍스트 → 단별로 가른 영어 산문 덩어리. */
function blocksOf(page: string): string[] {
  const cols: string[][] = []
  for (const line of page.replace(/\r\n?/g, '\n').split('\n')) {
    const segs = line.split(/\s{4,}/)
    // 들여쓰기로 시작하는 줄의 빈 첫 조각은 버린다 — 단 번호는 나머지 조각 순서로 매긴다.
    const parts = segs[0]!.trim() ? segs : segs.slice(1)
    if (!line.trim()) {
      for (const c of cols) c.push('')
      continue
    }
    parts.forEach((p, i) => {
      ;(cols[i] ??= []).push(p.trim())
    })
  }
  const out: string[] = []
  for (const col of cols) {
    for (const para of col.join('\n').split(/\n{2,}/)) {
      // \uad6c\ubb38 \uad50\uc7ac\uc758 \ub04a\uc5b4 \uc77d\uae30 \ud45c\uc2dc(` / `)\ub97c \uc9c0\uc6b4\ub2e4 \u2014 \ub0a8\uae30\uba74 \ubb38\uc7a5\uc774 \uc798\uac8c \ub04a\uaca8 \ubcf4\uc778\ub2e4.
      const text = para.replace(/-\n(?=[a-z])/g, '').replace(/\s+\/\s+/g, ' ').replace(/\s+/g, ' ').trim()
      const words = text.split(' ')
      if (words.length < 90) continue
      if (/[\uac00-\ud7a3]/.test(text)) continue
      // \ud55c\uae00 \uae00\uaf34\uc774 \uae68\uc838 \ub098\uc628 \ub369\uc5b4\ub9ac(\ub77c\ud2f4\u00b7\uc77c\ubc18 \ubb38\uc7a5\ubd80\ud638 \ubc16 \uae00\uc790\uac00 1% \ub118\uc74c)\ub294 \ubc84\ub9b0\ub2e4.
      if ((text.match(/[^\x20-\x7E\u2018-\u201d\u2013\u2014\u2026]/g)?.length ?? 0) / text.length > 0.01) continue
      if ((text.match(/\d/g)?.length ?? 0) / text.length >= 0.03) continue
      if ((text.match(/[.!?]["”']?(\s|$)/g)?.length ?? 0) < 3) continue
      out.push(text)
    }
  }
  return out
}

if (!existsSync(CORPUS)) throw new Error(`코퍼스가 없다: ${CORPUS}`)
const corpus = new DatabaseSync(CORPUS, { readOnly: true })
const docs = corpus
  .prepare(`select id, school, grade_band, category from docs where status = 'ok' and school in ('중등','중등~고등','고등') and category in ('독해','구문','내신')`)
  .all() as { id: string; school: string; grade_band: string; category: string }[]
const seen = new Set<string>()
const peeks: string[] = []
let dupes = 0
for (const d of docs) {
  const pages = corpus.prepare('select text from pages where doc_id = ?').all(d.id) as { text: string }[]
  for (const p of pages) {
    for (const block of blocksOf(p.text)) {
      // 같은 책이 여러 본 있다(사본 24쌍) — 같은 덩어리는 한 번만 센다.
      const h = createHash('sha1').update(block.toLowerCase()).digest('hex')
      if (seen.has(h)) {
        dupes++
        continue
      }
      seen.add(h)
      const band = d.school === '고등' ? `② 고등 ${d.grade_band}` : `② ${d.school}(대조군)`
      measure(band, block)
      if (PEEK && peeks.length < 12 && Math.random() < 0.02) peeks.push(`[${band}] ${block.slice(0, 80)}…`)
    }
  }
}

// ── ③ PLOS 발췌본 ─────────────────────────────────────────────────────
async function plosSample(blocked: boolean, n: number) {
  const ids: string[] = []
  let cursor = '00000000-0000-0000-0000-000000000000'
  for (;;) {
    let q = db.from('csat_source_eligibility').select('article_id').eq('source', 'plos').eq('input->>gatePurpose', 'csat').gt('article_id', cursor).order('article_id').limit(1000)
    q = blocked ? q.filter('result->blockers', 'cs', '["cefr_above_band"]') : q.eq('result->>status', 'eligible')
    const { data, error } = await q
    if (error) throw new Error(error.message)
    if (!data.length) break
    ids.push(...data.map((r) => r.article_id as string))
    cursor = data.at(-1)!.article_id as string
  }
  // 고르게 뽑는다 — uuid 순서는 사실상 무작위다.
  const step = Math.max(1, Math.floor(ids.length / n))
  const pick = ids.filter((_, i) => i % step === 0).slice(0, n)
  for (let i = 0; i < pick.length; i += 50) {
    const { data, error } = await db.from('library_articles').select('content, cefr_level').in('id', pick.slice(i, i + 50))
    if (error) throw new Error(error.message)
    for (const r of data) measure(blocked ? '③ PLOS 발췌 — 상한에 막힘' : '③ PLOS 발췌 — 적격(대조군)', String(r.content ?? ''), r.cefr_level as string | null)
  }
  return ids.length
}
const blockedTotal = await plosSample(true, PLOS_N)
const eligibleTotal = await plosSample(false, Math.floor(PLOS_N / 2))

// ── 출력 ──────────────────────────────────────────────────────────────
const table = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([name, g]) => {
  const pct = (k: string) => (((g.levels[k] ?? 0) / g.n) * 100).toFixed(1)
  return {
    group: name,
    n: g.n,
    hitRate: `${((g.hit / g.n) * 100).toFixed(1)}%`,
    ...Object.fromEntries(CEFR.map((k) => [k, `${pct(k)}%`])),
    'B2 이하': `${(((['A1', 'A2', 'B1', 'B2'] as const).reduce((s, k) => s + (g.levels[k] ?? 0), 0) / g.n) * 100).toFixed(1)}%`,
    ...(g.stored ? { 'DB 값과 일치': `${(((g.agree ?? 0) / g.n) * 100).toFixed(1)}%`, 'DB 저장 CEFR': g.stored } : {}),
  }
})
console.log(`자 ${RULER} · 사전 ${dict.size.toLocaleString()} · 교재 문서 ${docs.length} · 교재 중복 덩어리 제외 ${dupes} · PLOS 막힘 모집단 ${blockedTotal} · 적격 모집단 ${eligibleTotal}`)
console.table(table.map(({ ['DB 저장 CEFR']: _s, ...rest }) => rest))
for (const t of table) if ('DB 저장 CEFR' in t) console.log(t.group, 'DB 저장 CEFR', JSON.stringify(t['DB 저장 CEFR']))
if (PEEK) console.log(peeks.join('\n'))
const jsonOut = argOf('json', '')
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ measuredAt: new Date().toISOString(), table }, null, 2))

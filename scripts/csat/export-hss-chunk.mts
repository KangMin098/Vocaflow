// scripts/csat/export-hss-chunk.mts
//
// **인문사회 CC-BY 초록을 기존 채점 계약과 **같은 청크 모양**으로 뽑는다 — 읽기 전용.**
//
// `source-scorecard-export.mts` 와 산출 모양이 같아서 같은 검증기(`source-scorecard-verify.mts`)와
// 같은 채점기가 그대로 돈다. 새 후보와 기존 21원천이 **다른 자로 재어져 나란히 놓이는 일**을 막는다.
//
// ── 무엇을 확인하려고 뽑나 ───────────────────────────────────────────
// 실측(`measure-hss-abstracts.mts`)이 이미 말한 것: 예술·인문 초록은 **어수 중앙 162**(기출 164),
// 규격(140~200어) 적중 **36.5%**, 밴드내 **85%**, 구조화 초록 **10%**.
// 길이와 난이도는 맞는다는 뜻이다. **남은 질문은 하나** — 그 초록이
// **자족적인 논증문인가**, 아니면 「이 특집호는 …를 모았다」류의 안내문인가.
// 그건 사람(에이전트)이 읽어야 답이 나온다. 그래서 청크로 뽑는다.
//
// ⚠️ 본문은 청크 파일(`.agent-logs/`, gitignore)에만 남는다. 리포트에는 수치만 간다(A1).
// ⚠️ 라이선스는 OpenAlex 의 `best_oa_location.license` 를 그대로 싣는다 — 적재 전 원문 재확인 대상이다.
//
// 실행: pnpm exec tsx scripts/csat/export-hss-chunk.mts --out <dir> [--per-field 50]

import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
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
const db = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  { auth: { persistSession: false } },
)

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
type Cefr = (typeof CEFR)[number]
const MAILTO = 'killerapp51@empal.com'
const argOf = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : d
}
const OUT_DIR = resolve(argOf('out', '.agent-logs/source-candidates'))
const PER = Number(argOf('per-field', '50'))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 청크 하나 = 분야 하나. 기존 원천과 같은 자리에 놓으려고 `source` 키를 준다. */
const FIELDS: [string, string][] = [
  ['12', 'openalex_humanities'],
  ['33', 'openalex_socialsci'],
  ['32', 'openalex_psychology'],
]

const byReadability = (fre: number): Cefr =>
  fre >= 90 ? 'A1' : fre >= 80 ? 'A2' : fre >= 70 ? 'B1' : fre >= 55 ? 'B2' : fre >= 40 ? 'C1' : 'C2'

const dict = new Map<string, Cefr>()
for (let from = ''; ; ) {
  let q = db.from('shared_dictionary').select('word, cefr_level').order('word').limit(1000)
  if (from) q = q.gt('word', from)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  if (!data?.length) break
  for (const r of data) {
    const lv = r.cefr_level as string | null
    if (lv && (CEFR as readonly string[]).includes(lv)) dict.set(r.word as string, lv as Cefr)
  }
  from = data.at(-1)!.word as string
  if (data.length < 1000) break
}
console.log(`사전 ${dict.size.toLocaleString()}낱말`)

function byVocab(text: string) {
  const counts: Record<Cefr, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 }
  let known = 0
  let seen = 0
  for (const t of processText(text).sentences.flatMap((s) => s.tokens)) {
    const lemma = (t.lemma ?? '').toLowerCase()
    if (!lemma || lemma.length < 2 || /\d/.test(lemma)) continue
    seen++
    const lv = dict.get(lemma)
    if (!lv) continue
    counts[lv]++
    known++
  }
  if (!known) return { level: 'B1' as Cefr, hitRate: 0, lemmas: seen }
  let cum = 0
  for (const lv of CEFR) {
    cum += counts[lv]
    if (cum / known >= 0.8) return { level: lv, hitRate: known / Math.max(1, seen), lemmas: seen }
  }
  return { level: 'C2' as Cefr, hitRate: known / Math.max(1, seen), lemmas: seen }
}

function fromInverted(inv: Record<string, number[]> | null): string {
  if (!inv) return ''
  const slots: string[] = []
  for (const [w, ps] of Object.entries(inv)) for (const p of ps) slots[p] = w
  return slots.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

mkdirSync(OUT_DIR, { recursive: true })
const pid = process.pid
const manifest: Record<string, unknown>[] = []

for (const [fieldId, source] of FIELDS) {
  const file = join(OUT_DIR, `${source}-g2-${pid}.json`)
  if (existsSync(file)) {
    console.log(`  ${source}: 이미 있음 — 건너뜀 (재실행 안전)`)
    continue
  }
  const items: Record<string, unknown>[] = []
  let cursor = '*'
  while (items.length < PER) {
    const url =
      `https://api.openalex.org/works?per-page=100&cursor=${encodeURIComponent(cursor)}&mailto=${MAILTO}` +
      `&select=id,doi,title,abstract_inverted_index,publication_year,best_oa_location,primary_topic` +
      `&filter=best_oa_location.license:cc-by,language:en,type:article,has_abstract:true,primary_topic.field.id:fields/${fieldId}`
    const res = await fetch(url, { headers: { 'user-agent': `Vocaflow-SourceProbe/1.0 (mailto:${MAILTO})` } })
    if (!res.ok) {
      console.log(`  ${source}: HTTP ${res.status} — 중단`)
      break
    }
    const j = JSON.parse(await res.text()) as {
      results: {
        id: string
        doi: string | null
        title: string | null
        abstract_inverted_index: Record<string, number[]> | null
        best_oa_location: { license: string | null; landing_page_url: string | null } | null
        primary_topic: { display_name: string | null } | null
      }[]
      meta: { next_cursor: string | null }
    }
    if (!j.results?.length) break
    for (const w of j.results) {
      if (items.length >= PER) break
      const text = fromInverted(w.abstract_inverted_index)
      const wc = text.split(/\s+/).filter(Boolean).length
      // **규격 창 안만 뽑는다.** 이 청크가 답해야 하는 질문은 「길이가 맞는 것이
      //   실제로 논증문인가」이지 「길이가 맞는 것이 있는가」가 아니다(그건 이미 쟀다).
      if (wc < 140 || wc > 200) continue
      const vocab = byVocab(text)
      const fre = readability.fleschReadingEase(text) as number
      items.push({
        id: String(w.id).replace('https://openalex.org/', 'openalex:'),
        source,
        grade: 'candidate',
        status: 'probe',
        wordCount: wc,
        measuredWords: wc,
        dbCefr: null,
        dbRegister: null,
        dbVLevel: null,
        dbTopic: w.primary_topic?.display_name ?? null,
        gatePurpose: null,
        gateVerdict: null,
        license: w.best_oa_location?.license ?? null,
        licenseClass: 'cc_by',
        displayOnly: false,
        sourceUrl: w.best_oa_location?.landing_page_url ?? (w.doi ?? null),
        signals: {
          vocabCefr: vocab.level,
          vocabHitRate: +vocab.hitRate.toFixed(3),
          lemmas: vocab.lemmas,
          readabilityCefr: byReadability(fre),
          fleschReadingEase: +fre.toFixed(1),
          tooShort: false,
        },
        excerpt: text,
        excerptTruncated: false,
        judgement: null,
      })
    }
    cursor = j.meta.next_cursor ?? ''
    if (!cursor) break
    await sleep(250)
  }
  if (!items.length) {
    console.log(`  ${source}: 표본 0편 — 청크를 쓰지 않는다`)
    continue
  }
  const payload = {
    contract: 'source-scorecard/v1',
    source,
    pid,
    exportedAt: new Date().toISOString(),
    stockLive: items.length,
    sampled: items.length,
    gradeQuota: { candidate: items.length },
    itemsSha256: '',
    items,
  }
  payload.itemsSha256 = createHash('sha256')
    .update(JSON.stringify(items.map((i) => ({ id: i['id'], e: i['excerpt'], s: i['signals'] }))))
    .digest('hex')
  writeFileSync(file, JSON.stringify(payload, null, 2))
  manifest.push({ source, file: `${source}-g2-${pid}.json`, sampled: items.length, itemsSha256: payload.itemsSha256 })
  console.log(`  ${source}: 규격 내 표본 ${items.length}편 → ${file}`)
}

writeFileSync(
  join(OUT_DIR, `manifest-hss-${pid}.json`),
  JSON.stringify({ contract: 'source-scorecard/v1', stage: 'gate2-hss', pid, exportedAt: new Date().toISOString(), chunks: manifest }, null, 2),
)
console.log(`\n청크 ${manifest.length}개 → ${OUT_DIR}`)

// scripts/csat/source-scorecard-export.mts
//
// **원천 채점 — 표본 추출 + 결정론 신호 계산. 읽기 전용 · DB 를 고치지 않는다.**
//
// 소스GET 원천 21곳을 5축으로 채점하려면 편수·차단 분포(SQL 로 나온다) 말고
// **표본을 실제로 읽은 값**이 필요하다. 이 스크립트가 그 표본을 뽑고, 3중 합의 중
// **결정론 신호 둘**을 미리 계산해 청크에 넣는다. 남은 신호 하나(LLM)는 에이전트가 채운다.
//
// ── 무엇을 재는가 (DD-57 정정 측정과 **같은 식**) ────────────────────
//   신호 1 어휘 분포 (0.5) — lemma 의 80 백분위 CEFR. lemma 는 `@vocaflow/wlp`,
//                            CEFR 은 `shared_dictionary.cefr_level`.
//   신호 2 가독성    (0.3) — Flesch Reading Ease → CEFR(경계 90/80/70/55/40).
//   신호 3 LLM       (0.2) — **여기서 안 한다.** 에이전트가 `.out.json` 에 채우고
//                            `source-scorecard-verify.mts` 가 합의를 낸다.
//   기준선은 기출 802편의 같은 식 측정이다(DD-57 정정: B2 51.2 · B1 31.7 · A2 14.8 · C1 0.6).
//   **다른 식으로 잰 값과 비교하면 안 된다** — 가독성만 쓰면 같은 글이 C1·C2 68.7% 로 나온다.
//
// ── 표본을 어떻게 고르는가 ───────────────────────────────────────────
// 층화 추출이다. 적격 등급(usable·excerpt·excerpt-blind·unjudged·blocked)별로
// 재고 비율만큼 뽑되 있는 등급은 최소 1편 넣는다. **usable 만 보면 원천이 실제보다 좋아 보인다**
// — 이 저장소가 이미 한 번 그렇게 틀렸다(ocean_facts 를 표본 하나로 A2-B1 이라 적었다).
// 난수는 원천별 고정 시드라 **다시 돌려도 같은 표본**이 나온다(재실행 안전).
//
// ── 저작권 경계 ──────────────────────────────────────────────────────
// 본문은 청크 파일(스크래치패드)에만 넣는다. 리포트로는 **길이·점수만** 나간다.
// 청크 파일은 저장소에 커밋하지 않는다.
//
// 실행: pnpm exec tsx scripts/csat/source-scorecard-export.mts --out <dir> [--per-source 50]

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
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

const argOf = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback
}
const OUT_DIR = resolve(argOf('out', '.agent-logs/source-scorecard'))
const PER_SOURCE = Number(argOf('per-source', '50'))
/** LLM 에게 보여 줄 본문 길이. 유형·소재 판정에는 초록 한 덩이로 부족하다. */
const EXCERPT_CHARS = 2600

const byReadability = (fre: number): Cefr =>
  fre >= 90 ? 'A1' : fre >= 80 ? 'A2' : fre >= 70 ? 'B1' : fre >= 55 ? 'B2' : fre >= 40 ? 'C1' : 'C2'

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
console.log(`사전 ${dict.size.toLocaleString()}낱말`)

/** 신호 1 — 정본 `cefr-detect.ts` 와 같은 80 백분위. 사전에 없는 낱말은 분모에서 뺀다. */
function byVocab(text: string): { level: Cefr; hitRate: number; lemmas: number } {
  const counts: Record<Cefr, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 }
  let known = 0
  let seen = 0
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
  if (!known) return { level: 'B1', hitRate: 0, lemmas: seen }
  let cum = 0
  for (const level of CEFR) {
    cum += counts[level]
    if (cum / known >= 0.8) return { level, hitRate: known / Math.max(1, seen), lemmas: seen }
  }
  return { level: 'C2', hitRate: known / Math.max(1, seen), lemmas: seen }
}

/** 원천별 고정 시드 난수 — 다시 돌려도 같은 표본이 나온다. */
function seeded(seed: string) {
  let h = 2166136261
  for (const ch of seed) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return ((h >>> 0) % 1_000_000) / 1_000_000
  }
}

// ── 원천 목록 — DB 가 정한다(문서 목록을 사실로 쓰지 않는다) ──────────
type Row = {
  id: string
  source: string
  title: string | null
  word_count: number | null
  cefr_level: string | null
  register: string | null
  article_v_level: number | null
  license: string | null
  license_class: string | null
  display_only: boolean | null
  status: string
  content: string | null
  csat_fit: Record<string, unknown> | null
  source_url: string | null
}

const { data: sourceRows, error: srcErr } = await db.rpc('csat_source_rollup')
if (srcErr) throw new Error(srcErr.message)
const sources: string[] = ((sourceRows as { sources?: { src: string; n: number }[] })?.sources ?? [])
  .map((s) => s.src)
  .sort()
if (!sources.length) throw new Error('원천 목록이 비었다 — rollup 이 sources 를 안 준다')
console.log(`원천 ${sources.length}곳: ${sources.join(', ')}`)

mkdirSync(OUT_DIR, { recursive: true })
const pid = process.pid
const manifest: Record<string, unknown>[] = []

for (const source of sources) {
  // 등급을 알아야 층화한다. 적격 캐시에서 등급만 먼저 읽는다(본문 없이).
  const grades = new Map<string, string>()
  for (let page = 0; ; page += 1000) {
    const { data, error } = await db
      .from('csat_source_eligibility')
      .select('article_id, result')
      .eq('source', source)
      .eq('policy_version', 3)
      .range(page, page + 999)
    if (error) throw new Error(`${source} 적격 캐시: ${error.message}`)
    if (!data?.length) break
    for (const r of data) {
      grades.set(r.article_id as string, ((r.result as Record<string, string>)?.['grade'] ?? 'unknown'))
    }
    if (data.length < 1000) break
  }

  // 후보 id 목록 — 본문은 아직 안 읽는다(plos 4만 편의 본문을 통으로 끌면 죽는다).
  const ids: { id: string; grade: string }[] = []
  for (let from = ''; ; ) {
    let q = db
      .from('library_articles')
      .select('id')
      .eq('source', source)
      .in('status', ['ready', 'published'])
      .order('id')
      .limit(1000)
    if (from) q = q.gt('id', from)
    const { data, error } = await q
    if (error) throw new Error(`${source} 목록: ${error.message}`)
    if (!data?.length) break
    for (const r of data) ids.push({ id: r.id as string, grade: grades.get(r.id as string) ?? 'uncached' })
    from = data.at(-1)!.id as string
    if (data.length < 1000) break
  }
  if (!ids.length) {
    console.log(`  ${source}: 생존 0편 — 건너뜀`)
    continue
  }

  // 층화: 등급별 몫 = round(비율 × N), 있는 등급은 최소 1.
  const byGrade = new Map<string, { id: string }[]>()
  for (const r of ids) {
    const list = byGrade.get(r.grade) ?? []
    list.push({ id: r.id })
    byGrade.set(r.grade, list)
  }
  const want = Math.min(PER_SOURCE, ids.length)
  const picked: string[] = []
  const quota = new Map<string, number>()
  for (const [g, list] of byGrade) {
    quota.set(g, Math.max(1, Math.round((list.length / ids.length) * want)))
  }
  for (const [g, list] of [...byGrade].sort((a, b) => b[1].length - a[1].length)) {
    const rnd = seeded(`${source}:${g}`)
    const shuffled = [...list].sort(() => rnd() - 0.5)
    for (const row of shuffled.slice(0, quota.get(g) ?? 1)) {
      if (picked.length < want) picked.push(row.id)
    }
  }
  // 몫 반올림으로 모자라면 남은 것으로 채운다.
  if (picked.length < want) {
    const rest = ids.map((r) => r.id).filter((id) => !picked.includes(id))
    const rnd = seeded(`${source}:fill`)
    for (const id of [...rest].sort(() => rnd() - 0.5).slice(0, want - picked.length)) picked.push(id)
  }

  // 본문 — 50편씩만 읽는다.
  const rows: Row[] = []
  for (let i = 0; i < picked.length; i += 25) {
    const { data, error } = await db
      .from('library_articles')
      .select(
        'id, source, title, word_count, cefr_level, register, article_v_level, license, license_class, display_only, status, content, csat_fit, source_url',
      )
      .in('id', picked.slice(i, i + 25))
    if (error) throw new Error(`${source} 본문: ${error.message}`)
    rows.push(...((data ?? []) as Row[]))
  }

  const items = rows.map((r) => {
    const text = (r.content ?? '').trim()
    const words = text.split(/\s+/).filter(Boolean).length
    const enough = words >= 40
    const vocab = enough ? byVocab(text) : { level: 'B1' as Cefr, hitRate: 0, lemmas: 0 }
    const read = enough ? byReadability(readability.fleschReadingEase(text) as number) : ('B1' as Cefr)
    const gate = (r.csat_fit as Record<string, Record<string, unknown>> | null)?.['gate'] ?? null
    return {
      id: r.id,
      source: r.source,
      grade: grades.get(r.id) ?? 'uncached',
      status: r.status,
      wordCount: r.word_count,
      measuredWords: words,
      dbCefr: r.cefr_level,
      dbRegister: r.register,
      dbVLevel: r.article_v_level,
      dbTopic: (r.csat_fit as Record<string, unknown> | null)?.['topic'] ?? null,
      gatePurpose: gate?.['purpose'] ?? null,
      gateVerdict: gate?.['verdict'] ?? null,
      license: r.license,
      licenseClass: r.license_class,
      displayOnly: r.display_only,
      sourceUrl: r.source_url,
      signals: {
        vocabCefr: vocab.level,
        vocabHitRate: +vocab.hitRate.toFixed(3),
        lemmas: vocab.lemmas,
        readabilityCefr: read,
        fleschReadingEase: enough ? +(readability.fleschReadingEase(text) as number).toFixed(1) : null,
        tooShort: !enough,
      },
      // 에이전트가 읽을 몫. 리포트에는 안 나간다.
      excerpt: text.slice(0, EXCERPT_CHARS),
      excerptTruncated: text.length > EXCERPT_CHARS,
      // 에이전트가 채울 칸 — 비어 있으면 검증기가 거부한다.
      judgement: null as null | Record<string, unknown>,
    }
  })

  const payload = {
    contract: 'source-scorecard/v1',
    source,
    pid,
    exportedAt: new Date().toISOString(),
    stockLive: ids.length,
    sampled: items.length,
    gradeQuota: Object.fromEntries(quota),
    /** 검증기가 이 해시로 「에이전트가 항목을 바꿔치지 않았다」를 확인한다. */
    itemsSha256: '',
    items,
  }
  payload.itemsSha256 = createHash('sha256')
    .update(JSON.stringify(items.map((i) => ({ id: i.id, e: i.excerpt, s: i.signals }))))
    .digest('hex')

  const file = join(OUT_DIR, `${source}-g0-${pid}.json`)
  if (existsSync(file)) {
    console.log(`  ${source}: 이미 있음 — 건너뜀 (재실행 안전)`)
    continue
  }
  writeFileSync(file, JSON.stringify(payload, null, 2))
  manifest.push({
    source,
    file: `${source}-g0-${pid}.json`,
    stockLive: ids.length,
    sampled: items.length,
    itemsSha256: payload.itemsSha256,
  })
  console.log(`  ${source}: 재고 ${ids.length} → 표본 ${items.length}편`)
}

writeFileSync(
  join(OUT_DIR, `manifest-${pid}.json`),
  JSON.stringify({ contract: 'source-scorecard/v1', pid, exportedAt: new Date().toISOString(), chunks: manifest }, null, 2),
)
console.log(`\n청크 ${manifest.length}개 → ${OUT_DIR}`)

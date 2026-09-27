// scripts/csat/source-candidate-sample.mts
//
// **새 원천 후보에서 표본을 떠 기존 원천과 같은 자로 잰다 — 읽기 전용 · DB 를 안 건드린다.**
//
// 산출 파일의 **모양이 `source-scorecard-export.mts` 와 같다.** 그래서 같은 검증기
// (`source-scorecard-verify.mts`)와 같은 채점기(`source-scorecard-score.mts`)가 그대로 돈다 —
// 새 후보와 기존 원천이 **다른 자로 재어져 나란히 놓이는 일**을 구조적으로 막는다.
// (이 저장소는 그 실수를 한 번 했다: 기출을 가독성 하나로 재고 B2 상한과 비교해
//  「수능이 우리 규칙을 통과 못 한다」는 결론을 냈다가 3중 합의로 다시 재니 뒤집혔다 — DD-57.)
//
// ⚠️ **두 관문을 통과한 후보만 부른다.** robots·라이선스 판정은 `source-discovery-probe.mts`
//   가 하고, 여기는 그 통과분만 받는다. 이 스크립트에는 라이선스 판단이 없다.
// ⚠️ **본문은 청크 파일에만 남는다**(스크래치패드). 리포트에는 길이·점수만 나간다(A1).
//
// 실행: pnpm exec tsx scripts/csat/source-candidate-sample.mts --out <dir> [--per-source 50] [--only k1,k2]

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
const UA =
  'Vocaflow-SourceProbe/1.0 (+https://vocaflow.app; educational corpus research; contact killerapp51@empal.com)'
const argOf = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : d
}
const OUT_DIR = resolve(argOf('out', '.agent-logs/source-candidates'))
const PER = Number(argOf('per-source', '50'))
const ONLY = argOf('only', '').split(',').filter(Boolean)
const EXCERPT_CHARS = 2600
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function get(url: string, accept = '*/*'): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept }, redirect: 'follow' })
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

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
    const lv = row.cefr_level as string | null
    if (lv && (CEFR as readonly string[]).includes(lv)) dict.set(row.word as string, lv as Cefr)
  }
  from = data.at(-1)!.word as string
  if (data.length < 1000) break
}
console.log(`사전 ${dict.size.toLocaleString()}낱말`)

function byVocab(text: string) {
  const counts: Record<Cefr, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 }
  let known = 0
  let seen = 0
  for (const token of processText(text).sentences.flatMap((s) => s.tokens)) {
    const lemma = (token.lemma ?? '').toLowerCase()
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

/** 사이트 크롬을 세면 어수와 FK 가 함께 부푼다 — 8낱말 미만 문단은 캡션·버튼이다. */
function paragraphs(html: string) {
  return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) =>
      (m[1] ?? '')
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&(?:#\d+|[a-z]+);/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((t) => t.split(/\s+/).length >= 8)
}

type Doc = { key: string; url: string; title: string; text: string }
type Adapter = { label: string; license: string; licenseClass: string; fetch: (n: number) => Promise<Doc[]> }

/** MediaWiki — 목록·본문을 한 API 로 받는다. 크롬이 안 섞여 추출이 가장 깨끗하다. */
function mediawiki(host: string, listParams: string, label: string, license: string, licenseClass: string): Adapter {
  return {
    label,
    license,
    licenseClass,
    fetch: async (n) => {
      const out: Doc[] = []
      let cont = ''
      while (out.length < n) {
        const body = await get(`https://${host}/w/api.php?${listParams}&format=json&formatversion=2${cont}`, 'application/json')
        if (!body) break
        const j = JSON.parse(body) as {
          query?: { categorymembers?: { pageid: number; title: string }[]; search?: { pageid: number; title: string }[] }
          continue?: Record<string, string>
        }
        const members = j.query?.categorymembers ?? j.query?.search ?? []
        if (!members.length) break
        for (let i = 0; i < members.length && out.length < n; i += 10) {
          const ids = members.slice(i, i + 10).map((m) => m.pageid).join('|')
          const ex = await get(
            `https://${host}/w/api.php?action=query&pageids=${ids}&prop=extracts&explaintext=1&exsectionformat=plain&format=json&formatversion=2`,
            'application/json',
          )
          await sleep(500)
          if (!ex) continue
          const ej = JSON.parse(ex) as { query?: { pages?: { pageid: number; title: string; extract?: string }[] } }
          for (const p of ej.query?.pages ?? []) {
            const text = (p.extract ?? '').trim()
            if (text.split(/\s+/).length < 60) continue
            out.push({ key: `${host}:${p.pageid}`, url: `https://${host}/?curid=${p.pageid}`, title: p.title, text })
            if (out.length >= n) break
          }
        }
        const ck = j.continue ? Object.entries(j.continue).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join('') : ''
        if (!ck) break
        cont = ck
      }
      return out
    },
  }
}

/** 목록(피드·사이트맵)에서 URL 을 뽑아 편당 GET — 사이트맵 인덱스면 한 겹 더 들어간다. */
function listed(
  label: string,
  license: string,
  licenseClass: string,
  listUrl: string,
  pattern: RegExp,
  keyOf: (u: string) => string,
): Adapter {
  return {
    label,
    license,
    licenseClass,
    fetch: async (n) => {
      const seen = new Set<string>()
      const collect = (body: string) => {
        for (const m of body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) if (m[1] && pattern.test(m[1])) seen.add(m[1])
        for (const m of body.matchAll(/<link[^>]*href="([^"]+)"/gi)) if (m[1] && pattern.test(m[1])) seen.add(m[1])
        for (const m of body.matchAll(/<link>\s*([^<\s]+)\s*<\/link>/gi)) if (m[1] && pattern.test(m[1])) seen.add(m[1])
        for (const m of body.matchAll(/"(https?:\/\/[^"\s]+)"/g)) if (m[1] && pattern.test(m[1])) seen.add(m[1])
      }
      const root = await get(listUrl, 'application/xml,text/xml,application/json,*/*')
      if (!root) return []
      collect(root)
      // 사이트맵 인덱스 — 하위 사이트맵을 몇 장 더 연다.
      if (seen.size < n) {
        const subs = [...root.matchAll(/<loc>\s*([^<\s]+\.xml[^<\s]*)\s*<\/loc>/gi)].map((m) => m[1]!).slice(0, 4)
        for (const s of subs) {
          const b = await get(s, 'application/xml,text/xml')
          await sleep(700)
          if (b) collect(b)
          if (seen.size >= n * 3) break
        }
      }
      const urls = [...seen].slice(0, n * 3)
      const out: Doc[] = []
      for (const u of urls) {
        if (out.length >= n) break
        const html = await get(u)
        await sleep(800)
        if (!html) continue
        const ps = paragraphs(html)
        const text = ps.join('\n\n').trim()
        if (text.split(/\s+/).length < 60) continue
        const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? ''
        out.push({ key: keyOf(u), url: u, title, text })
      }
      return out
    },
  }
}

const ADAPTERS: Record<string, Adapter> = {
  wikinews: mediawiki(
    'en.wikinews.org',
    'action=query&list=categorymembers&cmtitle=Category:Published&cmlimit=50&cmtype=page',
    'Wikinews (영문)',
    'CC-BY-4.0',
    'cc_by',
  ),
  wikibooks: mediawiki(
    'en.wikibooks.org',
    'action=query&list=search&srsearch=incategory%3A%22Book%3ACell%20Biology%22%7Cincategory%3A%22Subject%3ASocial%20sciences%22&srlimit=50&srnamespace=0',
    'Wikibooks (영문)',
    'CC-BY-SA-4.0',
    'cc_by_sa',
  ),
  medlineplus: listed(
    'MedlinePlus (NLM)',
    'Public Domain (US Government)',
    'public_domain',
    'https://medlineplus.gov/sitemap.xml',
    /medlineplus\.gov\/[a-z0-9-]+\.html$/i,
    (u) => `medlineplus:${u.split('/').pop()!.replace(/\.html$/, '')}`,
  ),
  global_voices: listed(
    'Global Voices',
    'CC-BY-3.0',
    'cc_by',
    'https://globalvoices.org/feed/',
    /globalvoices\.org\/\d{4}\/\d{2}\/\d{2}\//i,
    (u) => `global_voices:${u.replace(/\/$/, '').split('/').pop()!}`,
  ),
  standard_ebooks: listed(
    'Standard Ebooks',
    'CC0-1.0 / Public Domain',
    'public_domain',
    'https://standardebooks.org/feeds/atom/new-releases',
    /standardebooks\.org\/ebooks\/[^/]+\/[^/]+$/i,
    (u) => `standard_ebooks:${u.split('/ebooks/')[1]!}`,
  ),
  nsf: listed(
    'NSF',
    'Public Domain (US Government)',
    'public_domain',
    'https://www.nsf.gov/sitemap.xml',
    /nsf\.gov\/news\/[a-z0-9-]{8,}/i,
    (u) => `nsf:${u.split('/news/')[1]!.replace(/\/$/, '')}`,
  ),
  cdc: listed(
    'CDC',
    'Public Domain (US Government)',
    'public_domain',
    'https://www.cdc.gov/sitemap.xml',
    /cdc\.gov\/[a-z0-9-]+\/[a-z0-9-/]*(?:about|index|features)[a-z0-9-/]*\.html$/i,
    (u) => `cdc:${new URL(u).pathname.replace(/^\/|\.html$/g, '')}`,
  ),
  nps: listed(
    'National Park Service',
    'Public Domain (US Government)',
    'public_domain',
    'https://www.nps.gov/sitemap.xml',
    /nps\.gov\/articles\//i,
    (u) => `nps:${new URL(u).pathname.replace(/^\/articles\//, '').replace(/\.htm$/, '')}`,
  ),
}

const keys = ONLY.length ? ONLY : Object.keys(ADAPTERS)
mkdirSync(OUT_DIR, { recursive: true })
const pid = process.pid
const manifest: Record<string, unknown>[] = []

for (const key of keys) {
  const ad = ADAPTERS[key]
  if (!ad) {
    console.log(`  ${key}: 어댑터 없음 — 건너뜀`)
    continue
  }
  const file = join(OUT_DIR, `${key}-g2-${pid}.json`)
  if (existsSync(file)) {
    console.log(`  ${key}: 이미 있음 — 건너뜀 (재실행 안전)`)
    continue
  }
  console.log(`\n── ${ad.label}`)
  let docs: Doc[] = []
  try {
    docs = await ad.fetch(PER)
  } catch (e) {
    console.log(`  가져오기 실패: ${(e as Error).message}`)
  }
  if (!docs.length) {
    console.log('  표본 0편 — 청크를 쓰지 않는다(빈 값은 넣지 않는다)')
    continue
  }
  const items = docs.map((d) => {
    const words = d.text.split(/\s+/).filter(Boolean).length
    const enough = words >= 40
    const vocab = enough ? byVocab(d.text) : { level: 'B1' as Cefr, hitRate: 0, lemmas: 0 }
    const fre = enough ? (readability.fleschReadingEase(d.text) as number) : null
    return {
      id: d.key,
      source: key,
      grade: 'candidate',
      status: 'probe',
      wordCount: words,
      measuredWords: words,
      dbCefr: null,
      dbRegister: null,
      dbVLevel: null,
      dbTopic: null,
      gatePurpose: null,
      gateVerdict: null,
      license: ad.license,
      licenseClass: ad.licenseClass,
      displayOnly: false,
      sourceUrl: d.url,
      signals: {
        vocabCefr: vocab.level,
        vocabHitRate: +vocab.hitRate.toFixed(3),
        lemmas: vocab.lemmas,
        readabilityCefr: enough ? byReadability(fre!) : ('B1' as Cefr),
        fleschReadingEase: fre == null ? null : +fre.toFixed(1),
        tooShort: !enough,
      },
      excerpt: d.text.slice(0, EXCERPT_CHARS),
      excerptTruncated: d.text.length > EXCERPT_CHARS,
      judgement: null as null | Record<string, unknown>,
    }
  })
  const payload = {
    contract: 'source-scorecard/v1',
    source: key,
    pid,
    exportedAt: new Date().toISOString(),
    /** 후보는 DB 재고가 없다 — 표본 수를 그대로 둔다(규모는 발굴 프로브의 목록 편수가 말한다). */
    stockLive: items.length,
    sampled: items.length,
    gradeQuota: { candidate: items.length },
    itemsSha256: '',
    items,
  }
  payload.itemsSha256 = createHash('sha256')
    .update(JSON.stringify(items.map((i) => ({ id: i.id, e: i.excerpt, s: i.signals }))))
    .digest('hex')
  writeFileSync(file, JSON.stringify(payload, null, 2))
  manifest.push({ source: key, file: `${key}-g2-${pid}.json`, sampled: items.length, itemsSha256: payload.itemsSha256 })
  console.log(`  표본 ${items.length}편 → ${file}`)
}

writeFileSync(
  join(OUT_DIR, `manifest-g2-${pid}.json`),
  JSON.stringify({ contract: 'source-scorecard/v1', stage: 'gate2', pid, exportedAt: new Date().toISOString(), chunks: manifest }, null, 2),
)
console.log(`\n후보 청크 ${manifest.length}개 → ${OUT_DIR}`)

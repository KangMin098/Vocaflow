// scripts/comic/pd/curate.mjs
//
// 학습 적합도 큐레이션 — 소스를 검색해 "학습에 좋은 콘텐츠"를 자동 랭킹하고 큐(pd_comic_issues)에 적재.
// 설계 근거(딥서치): 고전 각색(Classics Illustrated)은 ①깨끗한 스캔(실측 55%>펄프 46%) ②그레이디드
// 리더 정본과 중첩(학습 적합·PD 확률) 으로 최우선 소스. 노이즈(문법서·해설서)는 걸러낸다.
//
//   node scripts/comic/pd/curate.mjs [--query "classics illustrated"] [--top 6] [--pages 4] [--enqueue]
//   --enqueue 없으면 랭킹만 출력(안전). 있으면 상위 N 을 status=queued 로 적재.

import fs from 'node:fs'
import path from 'node:path'
import { getAdapter } from './sources/index.mjs'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) }
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const REPO = path.resolve(HERE, '..', '..', '..')

const SOURCE = arg('source', 'internet-archive')
const QUERY = arg('query', 'classics illustrated')
const TOP = Number(arg('top', 8))
const PAGES = arg('pages') ? Number(arg('pages')) : 4
const DO_ENQUEUE = !!arg('enqueue')

// 그레이디드 리더 정본과 겹치는 고전 canon — Classics Illustrated 가 각색한 대표작.
const CANON = [
  ['ivanhoe', 'Ivanhoe'], ['odyssey', 'The Odyssey'], ['iliad', 'The Iliad'], ['macbeth', 'Macbeth'],
  ['hamlet', 'Hamlet'], ['julius caesar', 'Julius Caesar'], ['monte cristo', 'The Count of Monte Cristo'],
  ['three musketeers', 'The Three Musketeers'], ['moby dick', 'Moby Dick'], ['two cities', 'A Tale of Two Cities'],
  ['robinson crusoe', 'Robinson Crusoe'], ['treasure island', 'Treasure Island'], ['kidnapped', 'Kidnapped'],
  ['leagues', '20,000 Leagues Under the Sea'], ['oliver twist', 'Oliver Twist'], ['copperfield', 'David Copperfield'],
  ['mohicans', 'The Last of the Mohicans'], ['robin hood', 'Robin Hood'], ['gulliver', "Gulliver's Travels"],
  ['tom sawyer', 'Tom Sawyer'], ['huck', 'Huckleberry Finn'], ['frankenstein', 'Frankenstein'],
  ['jekyll', 'Dr. Jekyll and Mr. Hyde'], ['time machine', 'The Time Machine'], ['war of the worlds', 'War of the Worlds'],
  ['first men in the moon', 'First Men in the Moon'], ['around the world', 'Around the World in 80 Days'],
  ['christmas carol', 'A Christmas Carol'], ['don quixote', 'Don Quixote'], ['miserables', 'Les Misérables'],
  ['call of the wild', 'The Call of the Wild'], ['white fang', 'White Fang'], ['the spy', 'The Spy'],
  ['westward ho', 'Westward Ho!'], ['deerslayer', 'The Deerslayer'], ['prince and the pauper', 'The Prince and the Pauper'],
]
const NOISE = /sacred classics|grammar|rhetoric|antiquit|law restated|cultural history|library of|fine books|roman antiq|explained|great illustrated classics$|acclaim|junior/i
const CI_RE = /classics?[\s._-]*illustrated|illustrated[\s._-]*classics/i

const slugify = (s) => String(s || 'issue').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'issue'

function score(it) {
  const hay = `${it.identifier} ${it.title || ''}`.toLowerCase()
  if (NOISE.test(hay)) return null // 학습 부적합 노이즈 제외
  const canon = CANON.find(([kw]) => hay.includes(kw))
  const isCI = CI_RE.test(hay)
  if (!isCI && !canon) return null // CI 도 canon 도 아니면 스킵
  const pagesOk = it.pageCount != null && it.pageCount >= 20 && it.pageCount <= 120
  const riskPts = it.pdRisk === 'ok' ? 1 : it.pdRisk === 'caution' ? 0.5 : 0
  const s = (isCI ? 2 : 0) + (canon ? 3 : 0) + (pagesOk ? 1 : 0) + riskPts
  return { ...it, fit: s, canon: canon?.[1] ?? null, isCI }
}

const ad = getAdapter(SOURCE)
const raw = await ad.search(QUERY, 40, { sort: 'downloads' })
const ranked = raw.map(score).filter(Boolean).sort((a, b) => b.fit - a.fit).slice(0, TOP)

console.log(`\n학습 적합도 큐레이션 · ${SOURCE} · "${QUERY}" — 상위 ${ranked.length}/${raw.length}\n`)
for (const r of ranked) {
  console.log(`  fit ${r.fit.toFixed(1)}  ${(r.canon || (r.isCI ? '(CI)' : '')).padEnd(28)} ${String(r.pageCount ?? '?').padStart(4)}p  ${r.pdRisk || '?'}  ${r.identifier}`)
}
if (!ranked.length) { console.log('  (적합 후보 없음 — query 조정)'); process.exit(0) }

if (!DO_ENQUEUE) {
  console.log(`\n(랭킹만) --enqueue 로 상위 ${ranked.length}건을 큐(status=queued, 테스트 ${PAGES}쪽)에 적재.`)
  process.exit(0)
}

// 적재 — service-role
const envPath = path.join(REPO, 'apps', 'web', '.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('✗ Supabase env 없음'); process.exit(1) }
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let enq = 0, skip = 0
for (const r of ranked) {
  const { data: exists } = await db.from('pd_comic_issues').select('id').eq('source_adapter', SOURCE).eq('source_identifier', r.identifier).maybeSingle()
  if (exists) { skip++; continue }
  const title = r.canon || r.title || r.identifier
  const slug = slugify(`${title}-${r.identifier}`) // 식별자 포함 → 이슈별 유일(슬러그 충돌 방지)
  const { error } = await db.from('pd_comic_issues').insert({
    slug, title, series_title: r.isCI ? 'Classics Illustrated' : null,
    source_adapter: SOURCE, source_identifier: r.identifier, status: 'queued', acquire_pages: PAGES,
  })
  if (error) { console.error(`  ✗ ${r.identifier}: ${error.message}`); skip++ } else enq++
}
console.log(`\n✓ 큐 적재 ${enq}건 · 스킵 ${skip}(중복) — /admin/pd-comics 테스트·모니터에서 드레인 진행`)

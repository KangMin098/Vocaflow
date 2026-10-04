// scripts/knowledge/import-seed.mjs
// 학습 원리 등록부 씨앗 적재 (docs/methodology/SYSTEM.md §4·§9-2단계).
//   1) Codex 기출 원천 전수 조사 713 지문 → knowledge_csat_origins (지문 원문 없음 · 해시·서지·근거 URL 만)
//   2) 미확인 지문 → knowledge_gaps 1건 (0 이 아니라 「모름」)
//   3) 학습 과학 7 (LEARNING_MODEL) → L2 원리 항목 7개, 상태 in_review · 근거 미연결 공백 1건
// 기본은 미리보기. --commit 일 때만 쓴다. 재실행 안전: 원천은 **새 행만** 넣고 판정이 바뀐 행은 덮지 않고 충돌로 보고,
// 원리는 slug, 기출 원천 공백은 범위·원인·질문 접두어, 나머지 공백은 질문 문장으로 중복 확인.
// 사용: node --tls-max-v1.2 scripts/knowledge/import-seed.mjs [--commit]
import fs from 'node:fs'
import path from 'node:path'
import { createScriptClient } from '../lib/supabase-client.mjs'

// 자격은 --commit 때만 필요하다. 워크트리에 .env.local 이 없으면 미리보기만 된다.
const ENV_FILE = path.resolve('apps/web/.env.local')
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const COMMIT = process.argv.includes('--commit')
const ACTOR = 'seed:knowledge-import'
const RESULTS = 'docs/reports/csat-source-origin-results-20260928.jsonl'
const AUDIT_REF = 'docs/reports/csat-source-origin-audit-20260928.md'

const records = fs
  .readFileSync(RESULTS, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l))

const origins = records.map((r) => ({
  passage_sha256: r.passage_sha256,
  representative_item_id: r.representative_item_id,
  item_ids: r.item_ids,
  exam_id: r.exam.id,
  status: r.status,
  source_title: r.source?.title ?? null,
  source_authors: r.source?.authors ?? [],
  source_publisher: r.source?.publisher ?? null,
  source_year: r.source?.year ?? null,
  source_part: r.source?.part ?? null,
  field: null,
  evidence: r.evidence.map(({ kind, url, label }) => ({ kind, url, label })),
  note: r.note ?? null,
  audited_at: '2026-09-28',
  audit_ref: AUDIT_REF,
}))

const byStatus = origins.reduce((m, o) => ((m[o.status] = (m[o.status] ?? 0) + 1), m), {})
const unresolved = byStatus.unresolved ?? 0
const SOURCE_GAP_QUESTION = '수능·평가원 영어 지문의 미확인 원천(책·논문)을 추가 조사해야 한다'

const gaps = [
  {
    skill_ids: [],
    layer: 'essence',
    question: SOURCE_GAP_QUESTION,
    cause: 'not_found',
    next_action: '구절 검색 외 방법(출판사 전문 검색·도서관 DB·EBS 연계 교재 역추적)으로 원천 재조사',
    affected_count: unresolved,
  },
  {
    skill_ids: [],
    layer: 'principle',
    question: '학습 과학 7 원리에 1차 연구 근거(서지·DOI)가 아직 연결되지 않았다',
    cause: 'not_researched',
    next_action: '원리별 대표 논문 서지를 공식 페이지로 확인해 근거(등급 B 이상)로 연결',
    affected_count: 7,
  },
]

// 학습 과학 7 — AGENTS.md 「디자인 방향 · 학습 과학 7」 · docs/LEARNING_MODEL.md 에서 옮긴 원리 목록. 문장은 재서술.
const principles = [
  ['active-recall', '인출 연습', '보고 다시 읽기보다 기억에서 꺼내는 시도 자체가 장기 기억을 강화한다.'],
  ['spaced-repetition', '간격 반복', '같은 양의 복습이라도 잊을 즈음으로 간격을 벌려 나누면 더 오래 남는다.'],
  ['desirable-difficulty', '바람직한 어려움', '당장 수행을 조금 어렵게 만드는 조건이 장기 학습에는 이득이 될 수 있다.'],
  ['dual-coding', '이중 부호화', '말과 그림(또는 소리)처럼 서로 다른 경로로 함께 부호화하면 인출 단서가 늘어난다.'],
  ['context-dependent', '맥락 의존 인출', '배운 맥락과 같은 맥락에서 꺼낼 때 인출이 쉽다 — 낱말은 문장·글 안에서 익힌다.'],
  ['cognitive-load', '인지 부하 조절', '작업 기억은 한 번에 몇 덩이만 다룬다 — 새 정보는 나눠서, 불필요한 부하는 걷어서 준다.'],
  ['emotional-encoding', '정서적 부호화', '보상과 자기효능감이 따르는 경험은 더 잘 기억되고 다시 하게 만든다.'],
].map(([slug, title, statement]) => ({
  layer: 'principle',
  slug,
  title,
  statement,
  status: 'in_review',
  created_by: ACTOR,
  updated_by: ACTOR,
}))

console.log(`원천 ${origins.length} 지문 —`, byStatus)
console.log(`공백 ${gaps.length}건 · 원리 씨앗 ${principles.length}개`)
if (origins.some((o) => o.status !== 'unresolved' && !o.source_title)) {
  throw new Error('서지 없는 확인/후보 지문이 있다 — 결과 파일을 먼저 고친다')
}
if (!COMMIT) {
  console.log('미리보기 끝 — 쓰려면 --commit')
  process.exit(0)
}

const db = createScriptClient()

// 원천은 **새 행만** 넣는다. 이 파일은 2026-09-28 시점 자료라, 덮어쓰면 그 뒤 사람이 고친 판정
// (예: A→B 교정)이 재실행 한 번에 옛 값으로 돌아가고 연결 근거 등급도 따라 바뀐다(Codex 리뷰 P2).
// 이미 있는데 판정이 다르면 덮지 않고 충돌로 보고한다 — 어느 쪽이 맞는지는 사람이 정한다.
const existing = new Map()
for (let from = 0; ; from += 1000) {
  // API 한 번에 최대 1,000행 — 페이지로 끝까지 읽는다(한 번만 읽으면 뒤쪽 행을 「없음」으로 오판한다)
  const { data, error } = await db
    .from('knowledge_csat_origins')
    .select('passage_sha256,status')
    .order('passage_sha256')
    .range(from, from + 999)
  if (error) throw new Error(`기존 원천 읽기 실패: ${error.message}`)
  for (const r of data) existing.set(r.passage_sha256, r.status)
  if (data.length < 1000) break
}

const fresh = origins.filter((o) => !existing.has(o.passage_sha256))
const conflicts = origins.filter((o) => existing.has(o.passage_sha256) && existing.get(o.passage_sha256) !== o.status)
for (let i = 0; i < fresh.length; i += 200) {
  // ignoreDuplicates — 읽은 뒤 다른 세션이 같은 행을 넣었어도 덮지 않는다
  const { error } = await db
    .from('knowledge_csat_origins')
    .upsert(fresh.slice(i, i + 200), { onConflict: 'passage_sha256', ignoreDuplicates: true })
  if (error) throw new Error(`원천 적재 실패 (${i}~): ${error.message}`)
}
console.log(`원천 새로 ${fresh.length} · 같음 ${origins.length - fresh.length - conflicts.length} · 충돌 ${conflicts.length}(덮지 않음)`)
for (const c of conflicts.slice(0, 20)) {
  console.log(`  충돌 ${c.item_ids.join('·')} — DB ${existing.get(c.passage_sha256)} / 파일 ${c.status}`)
}
if (conflicts.length > 20) console.log(`  … 외 ${conflicts.length - 20}건`)

const { data: existingItems, error: e1 } = await db
  .from('knowledge_items')
  .select('slug')
  .in('slug', principles.map((p) => p.slug))
if (e1) throw new Error(e1.message)
const have = new Set(existingItems.map((r) => r.slug))
const newPrinciples = principles.filter((p) => !have.has(p.slug))
if (newPrinciples.length) {
  const { error } = await db.from('knowledge_items').insert(newPrinciples)
  if (error) throw new Error(`원리 적재 실패: ${error.message}`)
}
console.log(`원리 새로 ${newPrinciples.length} · 이미 있음 ${have.size} (건너뜀)`)

let gapNew = 0
for (const g of gaps) {
  let lookup = db.from('knowledge_gaps').select('id')
  lookup = g.question === SOURCE_GAP_QUESTION
    ? lookup.eq('layer', 'essence').eq('cause', 'not_found').ilike('question', '수능·평가원 영어 지문%원천(책·논문)%')
    : lookup.eq('question', g.question)
  const { data, error } = await lookup.limit(1)
  if (error) throw new Error(error.message)
  if (data.length) continue
  const { error: e2 } = await db.from('knowledge_gaps').insert(g)
  if (e2) throw new Error(`공백 적재 실패: ${e2.message}`)
  gapNew += 1
}
console.log(`공백 새로 ${gapNew} · 건너뜀 ${gaps.length - gapNew}`)

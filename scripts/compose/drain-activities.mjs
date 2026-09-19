// scripts/compose/drain-activities.mjs
//
// ACP §20 재저작 드레인 — ⑧ 가공(활동 파생) 단계. 결정론 DCP order/insert 문항 생성.
//
// 왜 스크립트인가: 생성기가 `/api/ctp/dev-generate-items` 에만 있었는데
//   ① 프로덕션 403 + admin 쿠키 요구 → 헤드리스 드레인이 부를 수 없고
//   ② `status='published'` 를 요구해서, 가공(⑥)이 발행(⑦)보다 앞인 드레인 순서와 모순이었다.
//   재저작 글은 발행 전 이미 게이트를 통과한 상태이므로 `ready` 에서 만들어 둔다 —
//   그래야 운영자가 발행을 누른 순간 활동까지 갖춰진다(발행 후 두 번째 수작업이 없다).
//
// 결정론·멱등: 같은 본문이면 같은 문항이 나오고 (kind,ref_id,type,paragraph_idx) 로 upsert 한다.
//   본문을 고치면 다시 돌리면 된다.
//
// 0문항이면 **왜인지** 말한다 — 적격 필터가 조용해서, 지금까지 "콘텐츠가 안 맞음" 과
//   "생성이 안 돌았음" 이 화면에서 똑같아 보였다.
//
// 실행: pnpm dlx tsx scripts/compose/drain-activities.mjs [--batch <uuid>] [--commit]

import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const commit = process.argv.includes('--commit')
const bi = process.argv.indexOf('--batch')
const batchId = bi >= 0 ? process.argv[bi + 1] : null

const { createClient } = await import('@supabase/supabase-js')
const { generateDcpItems, explainDcpEligibility, LEARNING_TYPES } = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

let q = db
  .from('library_articles')
  .select('id, source_id, title, content, article_v_level, register, status, display_only, license_class, lexical_noise, composed_spec')
  .eq('source', 'original')
  .in('status', ['ready', 'published'])
if (batchId) q = q.eq('compose_batch_id', batchId)

const { data: arts, error } = await q
if (error) throw new Error('조회 실패: ' + error.message)
if (!arts?.length) {
  console.log('대상 재저작 아티클이 없습니다.')
  process.exit(0)
}

console.log(`재저작 아티클 ${arts.length}건 ${commit ? '' : '(dry-run)'}\n`)

let total = 0
for (const a of arts) {
  console.log(`▸ ${a.title}`)

  // 이 유형이 order/insert 를 계획했는가 — 계획하지 않은 유형에서 0문항은 결함이 아니라 정답이다.
  //   (general_proficiency 는 받아쓰기·따라 말하기 계열이라 구문 재배열을 쓰지 않는다.)
  const track = a.composed_spec?.track
  const spec = track ? LEARNING_TYPES[track] : undefined
  if (track && !spec) {
    // 조회 실패를 '해당 없음' 으로 삼키면 활동이 통째로 빠진 채 통과한다.
    console.log(`  ⚠ 유형 '${track}' 을 사양에서 찾지 못했습니다 — 판단할 수 없어 건너뜁니다.
`)
    continue
  }
  const planned = spec?.activities ?? []
  if (!planned.includes('order') && !planned.includes('insert')) {
    console.log(`  해당 없음 — ${a.composed_spec?.track ?? '유형 미상'} 유형은 구문 재배열을 쓰지 않습니다.
`)
    continue
  }

  // 파생 입력 게이트 — DCP 설계와 같은 조건. 재저작 글은 자체 저작(cc0)이라 통상 통과한다.
  const gate = []
  if (a.display_only) gate.push('display_only')
  if (!['public_domain', 'cc0', 'cc_by', 'cc_by_sa'].includes(a.license_class ?? '')) {
    gate.push(`license_class=${a.license_class ?? 'null'}`)
  }
  // NULL 은 비교에서 조용히 탈락한다 — 명시적으로 걸러 이유를 남긴다.
  if (a.lexical_noise === null) gate.push('lexical_noise 미산출 (처리 단계를 먼저)')
  else if (a.lexical_noise > 0.08) gate.push(`lexical_noise ${a.lexical_noise} > 0.08`)
  if (gate.length) {
    console.log(`  건너뜀 — ${gate.join(' · ')}\n`)
    continue
  }

  const items = generateDcpItems(a.content ?? '', a.source_id)
  if (items.length === 0) {
    console.log('  문항 0 — 문단이 적격 조건을 못 넘었습니다:')
    for (const d of explainDcpEligibility(a.content ?? '')) {
      console.log(`    문단 ${d.paragraph_idx}: ${d.reason}`)
    }
    console.log('    (적격 = 빈 줄로 나뉜 문단 · 문장 4~6개 · 각 6단어 이상 · 첫 문장이 대명사·접속사 아님)\n')
    continue
  }

  console.log(`  문항 ${items.length} (order ${items.filter((i) => i.type === 'order').length} · insert ${items.filter((i) => i.type === 'insert').length})`)
  total += items.length

  if (commit) {
    const { error: upErr } = await db.from('csat_dcp_items').upsert(
      items.map((it) => ({
        kind: 'article',
        ref_id: a.id,
        type: it.type,
        item_role: 'practice',
        payload: it.payload,
        answer_key: it.answer_key,
        paragraph_idx: it.paragraph_idx,
        v_level: a.article_v_level,
      })),
      { onConflict: 'kind,ref_id,type,paragraph_idx' },
    )
    if (upErr) throw new Error('문항 저장 실패: ' + upErr.message)
    console.log('  → 저장')
  }
  console.log()
}

console.log(commit ? `완료. 문항 ${total}.` : `\n--commit 을 붙이면 저장합니다 (문항 ${total}).`)

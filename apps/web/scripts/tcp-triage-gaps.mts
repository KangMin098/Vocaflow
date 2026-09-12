// apps/web/scripts/tcp-triage-gaps.mts
//
// 사전 갭 백로그 분류 — VCB enrichment 에 태우기 전에 **진성 갭만** 추린다.
//
// 왜 필요한가: 갭 6,876건을 그대로 태우면 등재할 필요가 없는 것까지 비용을 태우고
// 사전을 오염시킨다. `lib/admin/pending-words/triage.ts` 가 이미 4버킷 분류를 갖고 있으므로
// (하이픈 노이즈 · 철자 변이 · 파생형 · 진성 갭) 그것을 그대로 쓴다 — 새 규칙을 만들면
// Admin 화면의 판정과 갈라진다.
//
// ⚠️ 분류는 표제어 직접 존재가 아니라 **`resolve_dict_headword` 해석 가능성**으로 한다.
// 표제어 존재로 검사하면 굴절형이 전부 미스난다(triage.ts 주석의 실측 사례 참조).
//
// 사용: npx tsx scripts/tcp-triage-gaps.mts [--write=<path>]

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  BUCKET_META,
  classifyPending,
  triageCandidates,
  type PendingBucket,
} from '../src/lib/admin/pending-words/triage'

config({ path: resolve(process.cwd(), '.env.local') })

const db: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

interface GapRow {
  lemma: string
  encounter_count: number
}

// 6,876건을 한 번에 못 받으므로 페이지네이션 (supabase 기본 상한 1,000).
async function fetchAllGaps(): Promise<GapRow[]> {
  const out: GapRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('pending_words')
      .select('lemma, encounter_count')
      .is('user_id', null)
      .eq('status', 'pending')
      .order('encounter_count', { ascending: false })
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as GapRow[]
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

/**
 * 후보를 배치로 해석 — 한 건씩 물으면 수만 번 왕복한다.
 *
 * `unresolved_dict_words` 는 **해석 실패분**을 돌려준다(Admin 화면·ExtractionPanel 이 쓰는
 * 바로 그 경로). 그러므로 해석 가능분 = 후보 − 실패분이다. 새 RPC 를 만들지 않는 이유:
 * 판정 경로가 둘로 갈리면 화면과 이 스크립트가 서로 다른 답을 내게 된다.
 */
async function resolveBatch(candidates: string[]): Promise<Set<string>> {
  const resolvable = new Set<string>(candidates)
  for (let i = 0; i < candidates.length; i += 500) {
    const chunk = candidates.slice(i, i + 500)
    const { data, error } = await db.rpc('unresolved_dict_words', { p_words: chunk })
    if (error) throw new Error(`배치 해석 실패: ${error.message}`)
    // 반환 형태가 text[] 이든 행 집합이든 받아낸다.
    const rows = (data ?? []) as unknown
    const list: string[] = Array.isArray(rows)
      ? rows.map((r) => (typeof r === 'string' ? r : ((r as Record<string, string>)?.word ?? '')))
      : []
    for (const w of list) if (w) resolvable.delete(w)
  }
  return resolvable
}

const gaps = await fetchAllGaps()
console.log(`갭 ${gaps.length.toLocaleString('ko-KR')}건 분류 시작\n`)

const allCandidates = new Set<string>()
for (const g of gaps) for (const c of triageCandidates(g.lemma)) allCandidates.add(c)
console.log(`해석 확인 대상 후보 ${allCandidates.size.toLocaleString('ko-KR')}개...`)

const resolvable = await resolveBatch([...allCandidates])
console.log(`해석 가능 ${resolvable.size.toLocaleString('ko-KR')}개\n`)

const buckets = new Map<PendingBucket, GapRow[]>()
for (const g of gaps) {
  const b = classifyPending(g.lemma, resolvable)
  if (!buckets.has(b)) buckets.set(b, [])
  buckets.get(b)!.push(g)
}

const order: PendingBucket[] = ['genuine_gap', 'derived_form', 'spelling_variant', 'hyphen_compound']
for (const b of order) {
  const rows = buckets.get(b) ?? []
  const meta = BUCKET_META[b]
  const pct = ((100 * rows.length) / gaps.length).toFixed(1)
  console.log(`${meta.label.padEnd(10)} ${String(rows.length).padStart(5)}건 (${pct.padStart(5)}%) — ${meta.action}`)
  console.log(`   예: ${rows.slice(0, 12).map((r) => r.lemma).join(', ')}\n`)
}

const writeFlag = process.argv.find((a) => a.startsWith('--write='))
if (writeFlag) {
  const path = writeFlag.split('=')[1]!
  const genuine = buckets.get('genuine_gap') ?? []
  writeFileSync(path, genuine.map((g) => JSON.stringify(g)).join('\n') + '\n', 'utf8')
  console.log(`진성 갭 ${genuine.length.toLocaleString('ko-KR')}건 → ${path}`)
}

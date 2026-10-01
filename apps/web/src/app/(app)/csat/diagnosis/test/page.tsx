// apps/web/src/app/(app)/csat/diagnosis/test/page.tsx
//
// 진단 테스트 — 기록이 없는 학습자용. 활성 풀에서 역량이 고르게 덮이도록 설정 수(기본 20)만큼 뽑는다.
// 출제는 (학습자 · 날짜) seed 로 결정적이라 새로고침해도 같은 문항이 나온다.
// 정답은 화면에 넘기지 않는다 — 채점은 제출 뒤 서버가 한다.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { DiagnosisShell } from '@/components/csat/diagnosis/DiagnosisShell'
import { DiagnosticTest, type TestItem } from '@/components/csat/diagnosis/DiagnosticTest'
import { composeDiagnosticTest } from '@/lib/csat/diagnosis/engine/compose'
import { learnerSession } from '@/lib/csat/diagnosis/learner'
import { todayKst } from '@/lib/csat/diagnosis/payload'
import { loadActiveSettings, loadItems } from '@/lib/csat/diagnosis/server'
import { railExams } from '@/lib/csat/rail-data'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: '진단 테스트 — 내 진단' }
export const dynamic = 'force-dynamic'

function seedOf(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export default async function DiagnosticTestPage() {
  const { userId } = await learnerSession()
  if (!userId) redirect('/login?next=/csat/diagnosis/test')
  const db = createAdminClient() as unknown as SupabaseClient
  const [{ settings }, { data: pool, error }] = await Promise.all([
    loadActiveSettings(db),
    db.from('csat_dx_pool').select('item_id').eq('active', true),
  ])
  if (error) throw new Error(`진단 풀 조회 실패: ${error.message}`)
  const metas = Object.values(await loadItems(db, (pool ?? []).map((p) => p.item_id as string)))
  const picked = composeDiagnosticTest(metas, settings.diagnostic_test.size, seedOf(`${userId}:${todayKst(new Date())}`))

  let items: TestItem[] = []
  if (picked.length > 0) {
    const { data, error: ie } = await db.from('csat_items').select('id, stem, passage, choices').in('id', picked)
    if (ie) throw new Error(`문항 조회 실패: ${ie.message}`)
    const byId = new Map((data ?? []).map((r) => [r.id as string, r]))
    items = picked.flatMap((id) => {
      const r = byId.get(id)
      if (!r || !Array.isArray(r.choices) || r.choices.length !== 5) return []
      return [{ id, stem: (r.stem as string | null) ?? '', passage: (r.passage as string | null) ?? '', choices: r.choices as string[] }]
    })
  }

  return (
    <DiagnosisShell exams={railExams()} screen="test">
      <h1 className="text-[22px] font-[800] text-[var(--t1)]">진단 테스트</h1>
      {items.length === 0 ? (
        <p className="break-keep font-body text-[14px] text-[var(--t2)]">진단 테스트 문항을 준비하고 있어요. 최근 모의고사 결과가 있다면 시험 기록 입력으로 먼저 진단받을 수 있어요.</p>
      ) : (
        <DiagnosticTest items={items} />
      )}
    </DiagnosisShell>
  )
}

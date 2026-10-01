// apps/web/src/app/admin/csat/diagnosis/pool/page.tsx
//
// 진단 테스트 문항 풀 — 기록이 없는 학습자가 푸는 20문항이 여기서 뽑힌다(역량이 고르게 덮이도록).
// 역량별 커버리지가 비면 그 역량은 진단 테스트로 판정할 수 없다.

import type { SupabaseClient } from '@supabase/supabase-js'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { DxHeader, DxNav, tdCls, thCls } from '@/components/admin/csat-diagnosis/ui'
import { requireAdmin } from '@/lib/auth/require-admin'
import { loadPool, poolCoverage } from '@/lib/csat/diagnosis/admin'
import { loadActiveSettings } from '@/lib/csat/diagnosis/server'
import { ATTRIBUTE_CODES } from '@/lib/csat/diagnosis/engine/types'
import { ATTRIBUTE_NAME } from '@/lib/csat/diagnosis/labels'
import { createAdminClient } from '@/lib/supabase/admin'

import { PoolEditor } from './PoolEditor'

export const dynamic = 'force-dynamic'

export default async function DiagnosticPoolPage() {
  await requireAdmin('/admin/csat/diagnosis/pool')
  const db = createAdminClient() as unknown as SupabaseClient
  const [pool, { settings }] = await Promise.all([loadPool(db), loadActiveSettings(db)])
  const coverage = poolCoverage(pool)
  const active = pool.filter((p) => p.active).length
  return (
    <div className="flex flex-col gap-5">
      <DxHeader
        title="진단 테스트 풀"
        lead={`활성 ${active}문항 · 한 번에 ${settings.diagnostic_test.size}문항을 뽑아요. 풀이 출제 수보다 작으면 있는 만큼만 나가요. 검수된 문항(가중치 확정)을 넣는 것이 좋아요.`}
      >
        <AdminScreenHelp screen="csat-diagnosis-pool" />
      </DxHeader>
      <DxNav current="/admin/csat/diagnosis/pool" />

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-[15px] font-[800] text-[var(--t1)]">역량별 커버리지</h3>
        <table className="w-full border-collapse">
          <thead><tr><th className={thCls}>역량</th><th className={thCls}>덮는 활성 문항</th><th className={thCls}>가중치 합</th></tr></thead>
          <tbody>
            {ATTRIBUTE_CODES.map((c) => (
              <tr key={c}>
                <td className={tdCls}>{c} {ATTRIBUTE_NAME[c].admin}</td>
                <td className={tdCls}>{coverage[c].items}</td>
                <td className={tdCls}>{coverage[c].weight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <PoolEditor rows={pool} />
    </div>
  )
}

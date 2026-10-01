// apps/web/src/app/admin/csat/diagnosis/settings/page.tsx
//
// 엔진 설정 — 컷 · 반감기 · credit · 임계값 · 시나리오 기준 시험 등 엔진의 모든 수치.
// 저장하면 새 버전이 활성이 되고, 이전 버전은 남는다(스냅샷이 어느 버전으로 계산됐는지 재현하기 위해).

import type { SupabaseClient } from '@supabase/supabase-js'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { DxHeader, DxNav, tdCls, thCls } from '@/components/admin/csat-diagnosis/ui'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listScorableExams } from '@/lib/csat/diagnosis/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { SettingsEditor } from './SettingsEditor'

export const dynamic = 'force-dynamic'

export default async function DiagnosisSettingsPage() {
  await requireAdmin('/admin/csat/diagnosis/settings')
  const db = createAdminClient() as unknown as SupabaseClient
  const [{ data: versions, error }, exams] = await Promise.all([
    // 표시용 최근 20개 — 의도적으로 자른다
    db.from('csat_dx_settings').select('id, settings, active, note, created_at').order('id', { ascending: false }).limit(20),
    listScorableExams(db),
  ])
  if (error) throw new Error(`설정 조회 실패: ${error.message}`)
  const active = (versions ?? []).find((v) => v.active)
  return (
    <div className="flex flex-col gap-5">
      <DxHeader title="엔진 설정" lead="진단 엔진의 모든 수치가 여기 있어요. 저장 전에 범위를 검사하고, 저장하면 새 버전이 활성이 돼요. 이미 쌓인 진단은 그때의 버전으로 남고, 다음 기록부터 새 값으로 계산해요.">
        <AdminScreenHelp screen="csat-diagnosis-settings" />
      </DxHeader>
      <DxNav current="/admin/csat/diagnosis/settings" />
      <SettingsEditor initial={JSON.stringify(active?.settings ?? {}, null, 2)} exams={exams.map((e) => ({ id: e.id, label: e.label }))} />
      <section className="flex flex-col gap-2">
        <h3 className="font-display text-[15px] font-[800] text-[var(--t1)]">버전 기록 (최근 20)</h3>
        <table className="w-full border-collapse">
          <thead><tr><th className={thCls}>버전</th><th className={thCls}>저장 시각</th><th className={thCls}>메모</th><th className={thCls}>상태</th></tr></thead>
          <tbody>
            {(versions ?? []).map((v) => (
              <tr key={v.id as number}>
                <td className={tdCls}>v{v.id as number}</td>
                <td className={tdCls}>{String(v.created_at).slice(0, 16).replace('T', ' ')}</td>
                <td className={tdCls}>{(v.note as string | null) ?? '—'}</td>
                <td className={tdCls}>{v.active ? '활성' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

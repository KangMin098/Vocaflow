// apps/web/src/components/admin/csat-diagnosis/AdminLearnerPlans.tsx
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadSavedPlans, type SavedPlans } from '@/lib/csat/map/v4/plan-store'
import { tasks } from '@/lib/csat/map/v4/definition'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { AdminWorkspaceSupply } from './AdminWorkspaceSupply'

/** Caller has verified the target account and admin role. Never calls the map loader that logs decisions. */
export async function AdminLearnerPlans({ db, userId }: { db: SupabaseClient; userId: string }) {
  let saved: SavedPlans
  try { saved = await loadSavedPlans(db, userId) }
  catch { return <section role="status" className="rounded border border-[var(--bd)] p-4"><h2 className="font-semibold">목표·저장 계획</h2><p className="text-sm text-[var(--error)]">계획을 읽지 못했습니다. 저장된 계획이 없다는 뜻은 아닙니다.</p></section> }
  const names = new Map(tasks().map(task => [task.id, task.name]))
  return (
    <details className="rounded-[var(--r-md)] border border-[var(--bd)] p-4" data-admin-learner-plans>
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bdf)]">목표·저장 계획 · 읽기 전용</summary>
      <p className="mt-2 break-keep text-xs text-[var(--t2)]">선택한 학습자 {userId}의 저장 기록입니다. 수행 완료·추천 적격·재진단 효과를 나타내지 않습니다.</p>
      <AdminScreenHelp screen="csat-learner-plans" className="mt-2" />
      {saved.status === 'not_installed' ? <p className="mt-3 text-sm">계획 저장 구조가 연결되지 않았습니다. 이 기기의 미저장 초안은 조회하지 않습니다.</p>
        : <>
          <p className="mt-3 text-sm">{saved.goal ? `목표 v${saved.goal.id}: ${saved.goal.score}점${saved.goal.grade == null ? '' : ` · ${saved.goal.grade}등급`}${saved.goal.date ? ` · ${saved.goal.date}` : ''}` : '저장된 목표가 없습니다.'}</p>
          {Object.values(saved.byTemplate).length === 0 && <p className="mt-2 text-sm">열린 Workspace에 저장된 계획이 없습니다.</p>}
          {Object.values(saved.byTemplate).map(workspace => (
            <section key={workspace.workspaceId} className="mt-3 border-t border-[var(--bd)] pt-3">
              <h3 className="text-sm font-semibold">{workspace.template} · 계획 v{workspace.latest.version}</h3>
              <p className="break-keep text-xs text-[var(--t2)]">Workspace {workspace.workspaceId} · 목표 버전 {workspace.latest.goalVersionId ?? '미결속'} · 정의 {workspace.latest.canon} · 기준 시각 {workspace.latest.asOf}</p>
              <ul className="mt-2 space-y-1 text-sm">{workspace.latest.plan.tasks.map(task => <li key={task.task}>{names.get(task.task) ?? task.task} · {task.stage ?? '단계 기록 없음'} · 계획 {task.planned ?? '미정'}문항 (저장 당시 가용 {task.available ?? '모름'})</li>)}</ul>
              <AdminWorkspaceSupply db={db} userId={userId} workspaceId={workspace.workspaceId} />
            </section>
          ))}
        </>}
      <p className="mt-3 break-keep text-xs text-[var(--t2)]">진단 기록·저장 목표·TASK 계획과 개인 공급을 읽습니다. 수행·계획의 명시적 결속과 저장 진단은 아래 이력에서 확인합니다. 추천 근거 재판정이나 학습 효과 자동 판정은 제공하지 않습니다.</p>
    </details>
  )
}

// apps/web/src/components/admin/csat-diagnosis/AdminLearnerActivity.tsx
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadAdminLearnerActivity, loadAdminLearnerSnapshots } from '@/lib/admin/learner-activity'
import { checkedTaskOfKey, tasks } from '@/lib/csat/map/v4/definition'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'

const LINK = 'inline-flex min-h-11 items-center underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bdf)]'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export async function AdminLearnerActivity({ db, userId, base, before }: { db: SupabaseClient; userId: string; base: string; before?: string }) {
  const [activity, snapshots] = await Promise.all([loadAdminLearnerActivity(db, userId, before), loadAdminLearnerSnapshots(db, userId)])
  const names = new Map(tasks().map(t => [t.id, t.name]))
  const href = (key: string, value: string | null, hash = '') => {
    const url = new URL(base, 'https://internal.invalid')
    if (value === null) url.searchParams.delete(key); else url.searchParams.set(key, value)
    url.hash = hash
    return `${url.pathname}${url.search}${url.hash}`
  }
  const bindings = activity.state === 'loaded' && activity.bindings.state === 'loaded' ? new Map(activity.bindings.rows.map(b => [String(b.attempt_id), b])) : null
  return (
    <details id="activity" className="rounded-[var(--r-md)] border border-[var(--bd)] p-4" data-admin-learner-activity open={!!before}>
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bdf)]">수행·계획 결속·진단 이력 · 읽기 전용</summary>
      <AdminScreenHelp screen="csat-learner-activity" className="mt-2" />
      <p className="my-3 break-keep text-xs text-[var(--t2)]">선택 학습자 {userId}의 시도 원장입니다. 단계·정답 기록은 독립 수행 판정, 계획 완료나 학습 효과를 뜻하지 않습니다.</p>
      {activity.state === 'error' ? <p role="status">수행을 읽지 못했습니다. 기록 없음으로 판정하지 않습니다.</p> : <>
        {activity.heldCount > 0 && <p role="status">보류 문항의 수행 {activity.heldCount}건은 정오·문항·계획 결속을 표시하지 않습니다.</p>}
        {activity.bindings.state !== 'loaded' && <p role="status">{activity.bindings.state === 'not_installed' ? '계획 결속 구조가 설치되지 않았습니다.' : '계획 결속을 확인하지 못했습니다.'} 수행의 계획 소속을 추정하지 않습니다.</p>}
        {activity.rows.length === 0 ? <p className="text-sm">{activity.heldCount > 0 ? '이 조회 범위에 표시할 수 있는 시도가 없습니다.' : '이 조회 범위의 시도 기록이 없습니다.'}</p> : <div className="overflow-x-auto"><table className="w-full text-left text-xs">
          <caption className="py-2 text-left">시도 ID 내림차순 · 현재 {activity.rows.length}건</caption>
          <thead><tr>{['시도·시각', '과제·문항', '단계·응답', '계획 결속', '제품 적용'].map(h => <th key={h} className="border-b border-[var(--bd)] p-2">{h}</th>)}</tr></thead>
          <tbody>{activity.rows.map(a => {
            const binding = bindings?.get(String(a.id))
            const task = checkedTaskOfKey(a.task_key)
            return <tr key={String(a.id)} className="border-b border-[var(--bd)] align-top">
              <td className="p-2">#{a.id}<br />{a.answered_at}<br />{a.synthetic === true ? '합성 표시' : a.synthetic === false ? '비합성 표시' : '합성 여부 미상'}</td>
              <td className="break-keep p-2">{task ? names.get(task) ?? task : a.task_key}<br />{a.item_ref ?? '문항 기록 없음'}</td>
              <td className="p-2">{a.phase} · {a.is_correct === true ? '정답' : a.is_correct === false ? '오답' : '정오 없음'}<br />도움 {a.help_level ?? '미상'}</td>
              <td className="break-all p-2">{binding ? <>Workspace {binding.workspace_id}<br />계획 v{binding.plan_version} · {binding.task_id} · {binding.role}<br />기록 당시 증거 {binding.evidence ? '적격' : `비적격: ${binding.non_evidence_reason ?? '사유 미기록'}`}</> : bindings ? '명시적 결속 없음' : '확인 불가'}</td>
              <td className="p-2">{a.application_id && UUID.test(a.application_id) ? <Link href={`/admin/knowledge/product/${a.application_id}`} className={LINK}>적용 추적</Link> : '연결 기록 없음'}</td>
            </tr>
          })}</tbody>
        </table></div>}
        <div className="flex gap-4">{before && <Link href={href('activityBefore', null, 'activity')} className={LINK}>최신 시도</Link>}{activity.next && <Link href={href('activityBefore', activity.next, 'activity')} className={LINK}>이전 시도</Link>}</div>
      </>}
      <h3 className="mb-2 mt-4 text-sm font-semibold">저장 진단 이력 · 최근 계산 10건까지</h3>
      {snapshots.state !== 'loaded' ? <p role="status">{snapshots.state === 'held' ? '보류 기록이 있어 저장 진단 이력을 표시하지 않습니다.' : '진단 이력 또는 보류 판정을 읽지 못했습니다.'}</p> : snapshots.rows.length === 0 ? <p className="text-sm">저장된 진단 이력이 없습니다.</p> : <ul className="space-y-2 text-xs">{snapshots.rows.map(s => <li key={s.id} className="border-t border-[var(--bd)] pt-2">
        계산 {s.computed_at} · 엔진 {s.engine_version} · 설정 {s.settings_id} · 입력 기준 {s.inputs_as_of}<br />저장 환산점수 {s.adjusted_score ?? '미산출'} · 등급 {s.grade_est ?? '미산출'} · {s.session_id ? <Link href={href('focus', s.session_id)} className={LINK}>근거 시험 기록</Link> : '연결 세션 없음'}
      </li>)}</ul>}
      <p className="mt-3 break-keep text-xs text-[var(--t2)]">입력 시험·엔진·설정이 달라질 수 있어 점수 차이를 학습 효과로 해석하지 않습니다. 과거 계획 결속·증거 판정은 현재 자료 자격을 보증하지 않습니다.</p>
    </details>
  )
}

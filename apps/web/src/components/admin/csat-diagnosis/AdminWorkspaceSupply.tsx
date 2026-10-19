// apps/web/src/components/admin/csat-diagnosis/AdminWorkspaceSupply.tsx
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadSupplyLedger } from '@/lib/csat/map/v62/supply-store'
import type { SupplyLedger } from '@/lib/csat/map/v62/supply-ledger'
import { createClient } from '@/lib/supabase/server'

export async function AdminWorkspaceSupply({ db, userId, workspaceId }: { db: SupabaseClient; userId: string; workspaceId: string }) {
  let ledger: SupplyLedger
  try {
    // Workspace 소유 조회는 상위의 관리자 클라이언트, 충족도는 기존 RPC가 검사할 실제 관리자 세션.
    const sessionDb = await createClient()
    ledger = await loadSupplyLedger(db, userId, workspaceId, sessionDb)
  } catch { ledger = { status: 'error' } }
  return <div className="mt-3 text-xs" data-admin-workspace-supply>
    <h4 className="font-semibold">이 Workspace의 개인 수요·공급 기록</h4>
    {ledger.status !== 'installed' ? <p role="status">{ledger.status === 'not_installed' ? '공급 원장 미설치' : '공급 원장 조회 불가'} · 공급 없음이나 완료로 판정하지 않습니다.</p>
      : Object.entries(ledger.lines).length === 0 ? <p>주문·공급 연결 기록이 없습니다. 수요 등록 여부는 이 표시만으로 판단하지 않습니다.</p>
        : <ul>{Object.entries(ledger.lines).map(([key, line]) => <li key={key} className="my-2 break-all">{key}<br />주문 {line.order ? `${line.order.state} · 순번 ${line.order.seq}` : '없음'} · 공급 기록 {line.delivered}건 · 현재 유효 {line.validDelivered ?? '미확인'} / 요청 {line.requested ?? '미확인'}</li>)}</ul>}
    <p className="mt-1 break-keep text-[var(--t2)]">개인 수요 원장이며 canonical Product Order의 생산 진척과 다릅니다. 공급 기록 수는 현재 유효 수량이나 수행 완료가 아닙니다.</p>
  </div>
}

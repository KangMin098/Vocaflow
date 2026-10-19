// apps/web/src/app/admin/settings/page.tsx
import { ShieldCheck, Sliders } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'

export const metadata = { title: '연결·지원 상태 — Admin' }
const CONNECTIONS = [
  {
    id: 'reports',
    name: '신고·문의',
    reason: '관리자 화면에 접수·답변·처리 이력을 저장하는 동작이 연결되어 있지 않습니다.',
    next: '별도 접수 경로로 들어온 문의는 해당 경로에서 확인합니다.',
  },
  {
    id: 'billing',
    name: '결제·구독',
    reason:
      '결제 PG와 구독 관리가 연결되어 있지 않습니다. 이 콘솔에서 청구·환불을 실행할 수 없습니다.',
    next: 'PG 연동 후 실제 결제 내역을 기준으로 관리 기능을 연결합니다.',
  },
  {
    id: 'configuration',
    name: '점검 모드·공지·프롬프트 설정',
    reason: '이 화면에서 저장하거나 서비스에 적용하는 경로가 없습니다.',
    next: '실제 설정과 배포는 저장소 및 배포 환경에서 관리합니다.',
  },
] as const

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <AdminPageHeader
        icon={Sliders}
        title="연결·지원 상태"
        description="현재 연결되지 않은 운영 기능과 실제 접근 제어 기준을 확인합니다."
      />
      <AdminScreenHelp screen="settings" />
      <dl className="divide-y divide-[var(--bd)] border-y border-[var(--bd)]">
        {CONNECTIONS.map((item) => (
          <div key={item.id} id={item.id} className="grid gap-3 py-5 lg:grid-cols-[200px_1fr]">
            <dt className="font-semibold text-[var(--t1)]">
              {item.name}
              <span className="mt-2 block w-fit rounded border border-[var(--bd)] px-2 py-1 text-xs font-normal text-[var(--t2)]">
                미연결
              </span>
            </dt>
            <dd className="break-keep text-sm leading-relaxed text-[var(--t2)]">
              <p>{item.reason}</p>
              <p className="mt-2">{item.next}</p>
            </dd>
          </div>
        ))}
      </dl>
      <section aria-labelledby="admin-access" className="break-keep text-sm text-[var(--t2)]">
        <h2
          id="admin-access"
          className="mb-3 flex items-center gap-2 font-semibold text-[var(--t1)]"
        >
          <ShieldCheck size={17} aria-hidden />
          관리자 접근
        </h2>
        <p>
          관리자와 큐레이터의 콘솔 진입은 기존 인증·계정 상태 검사로 보호합니다. 개별 실행 권한은 각
          서버 액션과 API가 별도로 확인합니다. 이 화면에서 권한을 변경하지 않습니다.
        </p>
      </section>
    </div>
  )
}

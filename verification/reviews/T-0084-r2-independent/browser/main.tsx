import 'D:/workspace/Vocaflow-final-product/apps/web/src/app/globals.css'
import { createRoot } from 'react-dom/client'
import { Activity, Users } from 'lucide-react'
import { AdminKpiGrid, type AdminKpi } from '@/components/admin/AdminKpiGrid'
// dashboard-stats.fmt 와 같은 식(그 파일은 server-only 라 브라우저로 못 싣는다)
const fmt = (n: number | null): string => (n === null ? '—' : n.toLocaleString('ko-KR'))
// 각 상태의 learners — 화면 문자열은 /admin/analytics · /admin/users page.tsx 의 KPI 정의와 같은 식
document.documentElement.dataset.skin='tines'; document.body.dataset.area='admin';
const q = new URLSearchParams(location.search)
const L = q.get('state') === 'zero' ? { total: 65, activeToday: 4, verified: 0, verifiedActiveToday: 0 }
  : q.get('state') === 'unavailable' ? { total: 65, activeToday: 4, verified: null, verifiedActiveToday: null }
  : { total: 65, activeToday: 4, verified: 12, verifiedActiveToday: 3 }
const kpis: AdminKpi[] = [
  { label: '오늘 활성 (DAU)', value: fmt(L.verifiedActiveToday), icon: Activity, accent: 'var(--info)', bg: 'var(--info-light)', hint: `검증된 실사용 학습자만 · 전체 계정 오늘 ${fmt(L.activeToday)}(내부·미분류 포함)` },
  { label: '실사용 학습자', value: fmt(L.verified), icon: Users, accent: 'var(--p)', bg: 'var(--p-light)', hint: `검증된 외부 계정만 · 전체 계정 ${fmt(L.total)}(내부·미분류 포함)` },
  { label: '오늘 학습자', value: fmt(L.verifiedActiveToday), icon: Users, accent: 'var(--p)', bg: 'var(--bg3)', hint: `실사용 학습자 ${fmt(L.verified)}명 · 전체 계정 ${fmt(L.total)}(내부·미분류 포함) · 학습 텍스트 ${fmt(280)}편` },
  { label: 'WAU', value: '—', icon: Activity, accent: 'var(--info)', bg: 'var(--bg3)' },
]
createRoot(document.getElementById('root')!).render(<main style={{ padding: 32, maxWidth: 1152, margin: '0 auto' }}><AdminKpiGrid kpis={kpis} /></main>)

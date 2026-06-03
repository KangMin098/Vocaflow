// apps/web/src/components/home/ModuleGrid.tsx
//
// Hub 의 7개 ModuleCard 그리드 — useHubData().modules 순회 렌더.

'use client'

import { HUB_MODULE_IDS, useHubData } from '@/hooks/useHubData'

import { ModuleCard } from './ModuleCard'

export function ModuleGrid() {
  const { data, isLoading } = useHubData()

  // 데이터 도착 전에도 동일 그리드 골격 유지 (lastStudiedAt = null 로 placeholder)
  const modules = data?.modules ?? HUB_MODULE_IDS.map((id) => ({ id, lastStudiedAt: null }))

  return (
    <div
      aria-busy={isLoading}
      className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7"
    >
      {modules.map((m) => (
        <ModuleCard
          key={m.id}
          moduleId={m.id as Parameters<typeof ModuleCard>[0]['moduleId']}
          lastStudiedAt={m.lastStudiedAt}
        />
      ))}
    </div>
  )
}

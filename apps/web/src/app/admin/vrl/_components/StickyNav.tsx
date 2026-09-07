// apps/web/src/app/admin/vrl/_components/StickyNav.tsx
//
// 사전DB 모니터링 v3 — 8 section jump nav (sticky top).
// IntersectionObserver 로 활성 section 추적 + smooth scroll.
//
// 화면도움말도 여기서 그린다: 활성 section 라벨을 아는 곳이 여기뿐이라
// (page.tsx 는 Server Component) 도움말이 스크롤/점프를 따라가려면 이 컴포넌트가 넘겨야 한다.
// sticky 인 <nav> 바깥(일반 흐름)에 놓아 펼침 패널이 상단에 붙어 다니지 않게 한다.

'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Grid3x3,
  ListTodo,
  Network,
  Sparkles,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'

interface SectionMeta {
  id: string
  label: string
  icon: LucideIcon
}

const SECTIONS: SectionMeta[] = [
  { id: 's1-hero', label: 'Overall', icon: Activity },
  { id: 's2-responsibilities', label: 'R1-R4', icon: Workflow },
  { id: 's3-dimensions', label: '9 Dims', icon: Sparkles },
  { id: 's4-defects', label: 'Defects', icon: AlertTriangle },
  { id: 's5-impact', label: 'Impact', icon: Grid3x3 },
  { id: 's6-schema', label: 'Schema', icon: Network },
  { id: 's7-distribution', label: 'Dist/Rounds', icon: BarChart3 },
  { id: 's8-backlog', label: 'Backlog', icon: ListTodo },
]

export function StickyNav() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0]?.id ?? '')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActiveId(e.target.id)
            break
          }
        }
      },
      // 상단 80px (nav 높이) 아래에서 활성화
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 },
    )

    for (const s of SECTIONS) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [])

  const activeLabel = SECTIONS.find((s) => s.id === activeId)?.label

  return (
    <>
      <nav
        aria-label="Section navigation"
        className="sticky top-0 z-30 -mx-6 mb-2 border-b border-[var(--bd)] bg-[var(--bg)]/95 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg)]/80"
      >
        <ul className="flex items-center gap-1 overflow-x-auto" role="tablist">
          {SECTIONS.map((s) => {
            const active = activeId === s.id
            const Icon = s.icon
            return (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  role="tab"
                  aria-selected={active}
                  onClick={(e) => {
                    e.preventDefault()
                    const el = document.getElementById(s.id)
                    if (el)
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className={`min-h-[44px] group inline-flex items-center gap-2 rounded-[var(--r-md)] px-3 py-2 font-display text-[11px] font-[600] transition-all duration-[var(--dur-normal)] ${
                    active
                      ? 'bg-[#8B5CF61A] text-[#8B5CF6] shadow-[var(--sh-sm)]'
                      : 'text-[var(--t2)] hover:bg-[var(--bg2)] hover:text-[var(--t2)]'
                  }`}
                >
                  <Icon size={12} strokeWidth={2} aria-hidden />
                  {s.label}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 활성 section 을 그대로 탭 키로 넘긴다 — 스크롤하면 도움말 내용도 따라 바뀐다. */}
      <AdminScreenHelp screen="vrl" tab={activeLabel} className="-mt-4" />
    </>
  )
}

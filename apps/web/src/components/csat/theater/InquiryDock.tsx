// apps/web/src/components/csat/theater/InquiryDock.tsx
'use client'
//
// **하단 탐구 도크 — 네 요소 · 일곱 장면 아이콘.** (기출 탐구 작업공간 W2)
//
// 요소 하나 = 48px 한 줄: 작은 이름(제목 버튼) + 세부 장면 아이콘 버튼(형제 · 중첩 금지). 질문 · 설명은 위 판에만 둔다.
// 키보드: 제목 그룹에 포커스가 있을 때만 ←/→ · Home/End 로 제목 사이를 옮긴다(Enter/Space 가 선택). Tab 은 아이콘으로 들어간다.
// 아이콘 이름은 aria-label + 호버 · 포커스 때 보이는 툴팁(title 만으로 키보드 사용자에게 이름을 주지 않는다).
// 선택은 면색 + 테두리 + aria-pressed/aria-current 로(색만으로 전달하지 않는다). 방문 수 · 진행률은 없다.

import { BookOpen, Columns2, GitBranch, Network, NotebookPen, Scale, Target, type LucideIcon } from 'lucide-react'
import { useRef, type KeyboardEvent } from 'react'

import { DOCK_GROUPS, groupOf, titleScene, type DockGroupId } from '@/lib/csat/inquiry/dock'
import { SCENES, type SceneId } from '@/lib/csat/inquiry/scenes'

import styles from './theater.module.css'

const ICON: Record<SceneId, LucideIcon> = {
  task: Target,
  meaning: BookOpen,
  judgment: Scale,
  design: GitBranch,
  compare: Columns2,
  principle: Network,
  explain: NotebookPen,
}
const TINT: Record<DockGroupId, string> = { understand: 'blue', design: 'lavender', transfer: 'mint', explain: 'peach' }

export function InquiryDock({
  current,
  last,
  onSelect,
}: {
  current: SceneId
  /** 요소별 마지막으로 본 장면(탭 메모리) */
  last: Partial<Record<DockGroupId, SceneId>>
  onSelect: (scene: SceneId, via: 'title' | 'icon') => void
}) {
  const titles = useRef<(HTMLButtonElement | null)[]>([])
  const active = groupOf(current).id
  const onTitleKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = DOCK_GROUPS.length
    const to = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null
    if (to == null) return
    // 극장 전역 ←/→(강의 차례 이동)로 새지 않게 — 제목 그룹 안에서만 포커스를 옮긴다
    e.preventDefault()
    e.stopPropagation()
    titles.current[to]?.focus()
  }

  return (
    <nav className={styles.dock} aria-label="탐구 요소" data-testid="inquiry-dock">
      {DOCK_GROUPS.map((g, i) => {
        const on = g.id === active
        return (
          <div key={g.id} className={styles.dockGroup} data-tint={TINT[g.id]} data-active={on} data-testid="dock-group" data-group={g.id}>
            <button
              ref={(el) => {
                titles.current[i] = el
              }}
              type="button"
              className={styles.dockTitle}
              aria-pressed={on}
              onClick={() => onSelect(titleScene(g, last), 'title')}
              onKeyDown={(e) => onTitleKey(e, i)}
              data-testid="dock-title"
            >
              {g.label}
            </button>
            <span className={styles.dockIcons}>
              {g.scenes.map((s) => {
                const Icon = ICON[s]
                const name = SCENES.find((x) => x.id === s)?.label ?? s
                return (
                  <button
                    key={s}
                    type="button"
                    className={styles.dockIcon}
                    aria-label={name}
                    aria-current={s === current ? 'page' : undefined}
                    data-on={s === current}
                    onClick={() => onSelect(s, 'icon')}
                    data-testid="dock-scene"
                    data-scene={s}
                  >
                    <span className={styles.dockIconFace} aria-hidden>
                      <Icon size={13} strokeWidth={1.9} />
                    </span>
                    <span className={styles.dockTip} aria-hidden>
                      {name}
                    </span>
                  </button>
                )
              })}
            </span>
          </div>
        )
      })}
    </nav>
  )
}

// apps/web/src/components/csat/theater/SceneNav.tsx
'use client'
//
// **일곱 장면 탐색 — 평가 과제 · 원문 이해 · 문항 성립 · 설계 재구성 · 기출 비교 · 조건부 원리 · 내 설명.** (v3)
//
// 자유 이동이다 — 어느 장면도 잠그지 않는다. 키보드: 장면 줄에 포커스가 있을 때만 ←/→ · Home/End 로 옮긴다
// (전역 키 소유자는 극장 하나 — 여기서 처리한 키는 stopPropagation 으로 극장의 큐 이동과 겹치지 않게 한다).

import { useEffect, useRef } from 'react'

import { SCENES, type SceneId } from '@/lib/csat/inquiry/scenes'

import styles from './theater.module.css'

export function SceneNav({ current, onSelect }: { current: SceneId; onSelect: (id: SceneId) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const at = SCENES.findIndex((s) => s.id === current)
  // 한 줄 가로 스크롤이라 현재 장면이 가려질 수 있다 — 바뀔 때마다 보이는 자리로(세로 스크롤은 건드리지 않는다)
  useEffect(() => {
    refs.current[at]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [at])

  const onKey = (e: React.KeyboardEvent) => {
    const to =
      e.key === 'ArrowRight' ? (at + 1) % SCENES.length
      : e.key === 'ArrowLeft' ? (at - 1 + SCENES.length) % SCENES.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? SCENES.length - 1
      : -1
    if (to < 0) return
    e.preventDefault()
    e.stopPropagation()
    onSelect(SCENES[to].id)
    refs.current[to]?.focus()
  }

  return (
    <div className={styles.sceneNav} role="tablist" aria-label="학습 장면" onKeyDown={onKey} data-testid="scene-nav">
      {SCENES.map((s, i) => (
        <button
          key={s.id}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          role="tab"
          aria-selected={s.id === current}
          tabIndex={s.id === current ? 0 : -1}
          onClick={() => onSelect(s.id)}
          data-scene={s.id}
        >
          <span aria-hidden>{i + 1}</span>
          {s.label}
        </button>
      ))}
    </div>
  )
}

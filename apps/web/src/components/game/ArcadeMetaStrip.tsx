// apps/web/src/components/game/ArcadeMetaStrip.tsx
// 아케이드 허브 상단 리텐션 스트립 — 연속일 스트릭 · 레벨 · 오늘의 목표(XP) 진행.
// 클라이언트 전용(localStorage). SSR 안전: 마운트 전엔 렌더 안 함(하이드레이션 불일치 방지).
// 스타일 클래스(.arc-meta*)는 arcade/page.tsx 의 ARC_CSS 에 정의 — 황혼 테마 일관.

'use client'

import { useEffect, useState } from 'react'

import {
  DAILY_GOAL_XP,
  getArcadeMeta,
  levelForXp,
  xpForLevel,
  type ArcadeMeta,
} from '@/lib/game/arcade-meta'

export default function ArcadeMetaStrip() {
  const [meta, setMeta] = useState<ArcadeMeta | null>(null)

  useEffect(() => {
    setMeta(getArcadeMeta())
    // 다른 탭/복귀 시 최신화
    const onFocus = () => setMeta(getArcadeMeta())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  if (!meta) return <div className="arc-meta arc-meta--ghost" aria-hidden="true" />

  const lvBase = xpForLevel(meta.level)
  const lvNext = xpForLevel(meta.level + 1)
  const lvPct = Math.max(0, Math.min(1, (meta.xp - lvBase) / Math.max(1, lvNext - lvBase)))
  const goalPct = Math.max(0, Math.min(1, meta.todayXp / DAILY_GOAL_XP))
  const goalMet = meta.todayXp >= DAILY_GOAL_XP

  return (
    <div className="arc-meta" role="status" aria-live="polite">
      <div className="arc-meta-item">
        <span className="arc-meta-num">
          <span className="arc-meta-flame" aria-hidden="true">
            🔥
          </span>
          {meta.streak}
        </span>
        <span className="arc-meta-lbl">연속일</span>
      </div>

      <div className="arc-meta-item arc-meta-level">
        <span className="arc-meta-num">Lv {meta.level}</span>
        <span className="arc-meta-bar" aria-hidden="true">
          <span className="arc-meta-bar-fill" style={{ width: `${lvPct * 100}%` }} />
        </span>
      </div>

      <div className="arc-meta-item arc-meta-goal" data-met={goalMet ? '1' : '0'}>
        <span className="arc-meta-num">
          {meta.todayXp}
          <span className="arc-meta-goal-total"> / {DAILY_GOAL_XP} XP</span>
        </span>
        <span className="arc-meta-lbl">
          {goalMet ? '오늘 목표 달성 ✓' : '오늘의 목표'}
          <span className="arc-meta-bar arc-meta-bar--goal" aria-hidden="true">
            <span className="arc-meta-bar-fill" style={{ width: `${goalPct * 100}%` }} />
          </span>
        </span>
      </div>
    </div>
  )
}

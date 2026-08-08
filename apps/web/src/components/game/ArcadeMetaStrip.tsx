// apps/web/src/components/game/ArcadeMetaStrip.tsx
// 아케이드 허브 상단 리텐션 스트립 — 연속일 스트릭 · 레벨 · 오늘의 목표(XP) 진행 · 배경음악.
// 클라이언트 전용(localStorage). SSR 안전: 마운트 전엔 렌더 안 함(하이드레이션 불일치 방지).
// 스타일 클래스(.arc-meta*)는 arcade/page.tsx 의 ARC_CSS 에 정의 — 황혼 테마 일관.
//
// 배경음악 토글(v07.4) — 큐레이션 BGM 을 붙여놓고도 듣는 학습자가 없었다. 원인은
// 재생 로직이 아니라 발견성: 기본 OFF 인데 켜는 길이 게임 안 작은 아이콘 하나뿐이었다.
// 게임에 들어가기 전 조용한 맥락에서 정할 수 있게 허브로 끌어올린다(같은 localStorage 키).
// v07.6 부터 기본값이 ON 이라 이 알약의 역할은 "끄는 길"이 된다 — 그래서 미설정 상태를
// 기본값으로 해석해야 게임 화면과 표시가 일치한다(lib/game/music-pref).

'use client'

import { useEffect, useState } from 'react'

import {
  DAILY_GOAL_XP,
  getArcadeMeta,
  levelForXp,
  xpForLevel,
  type ArcadeMeta,
} from '@/lib/game/arcade-meta'
import { DEFAULT_MUSIC_ON, readMusicOn, writeMusicPref } from '@/lib/game/music-pref'

export default function ArcadeMetaStrip() {
  const [meta, setMeta] = useState<ArcadeMeta | null>(null)
  // 미설정이면 기본값(v07.6 부터 ON) — `=== true` 로 읽으면 기본 ON 인데도
  // 허브 알약만 "끔"으로 표시돼 게임 안 상태와 어긋난다.
  const [music, setMusic] = useState(DEFAULT_MUSIC_ON)

  useEffect(() => {
    setMeta(getArcadeMeta())
    setMusic(readMusicOn())
    // 다른 탭/복귀 시 최신화
    const onFocus = () => {
      setMeta(getArcadeMeta())
      setMusic(readMusicOn())
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const toggleMusic = () => {
    setMusic((v) => {
      writeMusicPref(!v)
      return !v
    })
  }

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

      {/* 배경음악 — 게임 진입 전에 정한다. 모든 게임이 같은 선호를 따른다. */}
      <button
        type="button"
        className="arc-meta-music"
        onClick={toggleMusic}
        aria-pressed={music}
        data-on={music ? '1' : '0'}
        aria-label={music ? '배경음악 끄기' : '배경음악 켜기'}
        title="모든 게임에 적용돼요"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18V6l10-2v12" />
          <circle cx="6.5" cy="18" r="2.5" />
          <circle cx="16.5" cy="16" r="2.5" />
          {!music && <path d="M4 3.5l16 17" opacity=".9" />}
        </svg>
        <span>배경음악 {music ? '켬' : '끔'}</span>
      </button>
    </div>
  )
}

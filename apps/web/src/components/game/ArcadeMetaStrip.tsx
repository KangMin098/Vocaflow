// apps/web/src/components/game/ArcadeMetaStrip.tsx
// Game Lab 상단 Lab Status 스트립 — 스트릭 · 랭크 · 오늘의 할당량(XP) · 앰비언트(BGM).
//
// v08.3 — 랩 명명 정렬. 지표 라벨은 영문(STREAK · RANK · DAILY QUOTA · AMBIENT),
// 상태값과 격려 문구는 한국어. 구조 라벨은 짧고 고유해야 기억에 남고, 사람에게 말을 거는
// 문장은 모국어여야 한다는 이 화면의 원칙을 따른다.
// 클라이언트 전용(localStorage). SSR 안전: 마운트 전엔 렌더 안 함(하이드레이션 불일치 방지).
// 스타일 클래스(.arc-meta*)는 arcade/page.tsx 의 ARC_CSS 에 정의 — 황혼 테마 일관.
//
// 배경음악 토글(v07.4) — 큐레이션 BGM 을 붙여놓고도 듣는 학습자가 없었다. 원인은
// 재생 로직이 아니라 발견성: 기본 OFF 인데 켜는 길이 게임 안 작은 아이콘 하나뿐이었다.
// 게임에 들어가기 전 조용한 맥락에서 정할 수 있게 허브로 끌어올린다(같은 localStorage 키).
// v07.6 부터 기본값이 ON 이라 이 알약의 역할은 "끄는 길"이 된다 — 그래서 미설정 상태를
// 기본값으로 해석해야 게임 화면과 표시가 일치한다(lib/game/music-pref).

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

// levelForXp 는 import 하지 않는다 — getArcadeMeta 가 이미 날짜 롤오버까지 반영한
// level 을 계산해서 돌려준다. 여기서 또 계산하면 두 값이 어긋날 수 있다.
import { DAILY_GOAL_XP, getArcadeMeta, xpForLevel, type ArcadeMeta } from '@/lib/game/arcade-meta'
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
        <span className="arc-meta-lbl">Streak · 연속일</span>
      </div>

      <div className="arc-meta-item arc-meta-level">
        <span className="arc-meta-num">Lv {meta.level}</span>
        <span className="arc-meta-lbl">
          Level
          <span className="arc-meta-bar" aria-hidden="true">
            <span className="arc-meta-bar-fill" style={{ width: `${lvPct * 100}%` }} />
          </span>
        </span>
      </div>

      <div className="arc-meta-item arc-meta-goal" data-met={goalMet ? '1' : '0'}>
        <span className="arc-meta-num">
          {meta.todayXp}
          <span className="arc-meta-goal-total"> / {DAILY_GOAL_XP} XP</span>
        </span>
        <span className="arc-meta-lbl">
          {goalMet ? 'Daily quota · 달성 ✓' : 'Daily quota · 오늘의 할당량'}
          <span className="arc-meta-bar arc-meta-bar--goal" aria-hidden="true">
            <span className="arc-meta-bar-fill" style={{ width: `${goalPct * 100}%` }} />
          </span>
        </span>
      </div>

      {/* 순위 — v08.6. 이 스트립의 다른 수치는 전부 localStorage(이 기기의 나)라
          다른 학습자와의 비교가 어디에도 없었다. 링크를 걸지 않으면 /arcade/ranking 은
          주소를 아는 사람만 가는 화면이 된다(브리핑이 허브 카드에만 있던 것과 같은 실수). */}
      <Link href="/arcade/ranking" className="arc-meta-rank" title="게임별 순위와 내 랭크">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 20V11M12 20V5M18 20v-6" />
          <path d="M3.5 20h17" opacity=".6" />
        </svg>
        <span>Standings</span>
      </Link>

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
        <span>Ambient {music ? '켬' : '끔'}</span>
      </button>
    </div>
  )
}

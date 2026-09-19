// apps/web/src/components/textfit/SharedFitView.tsx
//
// **공유받은 결과** — `/fit/s/[payload]` 전용(2026-09-19 발산 A · docs/design/compare/fit-s.md · DD-25).
//
// 왜 `PublicFitClient` 를 쓰지 않나: 공유 링크에는 **원문이 없다**(`share.ts` — 커버리지와 어려운 낱말 16개만).
// 도구 화면은 원문이 있어야 칠하므로, 공유로 들어오면 **빈 입력칸이 먼저** 섰고 결과는 그 아래로 밀렸다
// (감사 2026-09-18 코드 추정 → 2026-09-19 유효 payload 로 확인). 그 컴포넌트는 `/fit`(골든 1호)과 함께 쓰므로
// 고치지 않고(A5) 이 화면 전용 보기를 둔다.
//
// 골격: **이 지문의 가장 어려운 낱말 줄**이 `/fit` 과 같은 부품(`PaintedPassage`)으로 칠해진다 —
// 학년 슬라이더를 옮기면 그 학년이 처음 만나는 낱말에 주묵 면(200ms). 랜딩·`/fit` 과 같은 몸짓이다.
// 출력 면(「학급에 나눠 줄 한 장」)도 `/fit` 과 같은 `ClassSheet` 를 그대로 쓴다.
//
// 관측은 `/fit` 의 이름 그대로 — 새 이벤트 0.

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { FileText, Printer } from 'lucide-react'
import Link from 'next/link'

import { track } from '@/lib/analytics/client'
import type { PaintToken } from '@/lib/textfit/paint'
import type { LevelProfile, ProfileLevel } from '@/lib/textfit/profile'

import { ClassSheet, buildGloss } from './ClassSheet'
import { PaintedPassage } from './PaintedPassage'

const TRACK_DEBOUNCE_MS = 600
/** 적정 학년이 없으면(고등 교육과정 이상) 고1 에서 시작 — `/fit` 의 기본값과 같다 */
const DEFAULT_LEVEL: ProfileLevel = 6

const PRIMARY =
  'inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--ju)] px-5 font-display text-[14px] font-[700] text-[var(--on-ju)] no-underline transition-colors duration-[var(--dur-normal)] hover:bg-[var(--ju-ink)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none'
const SECONDARY =
  'inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[13.5px] font-[600] text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none'

/** 공유 낱말 → 칠할 조각. 사이에 공백 한 칸 — 원문이 아니므로 문장부호를 지어내지 않는다. */
export function wordTokens(profile: LevelProfile): PaintToken[] {
  const out: PaintToken[] = []
  profile.hardestWords.forEach((w, i) => {
    if (i > 0) out.push({ t: ' ' })
    out.push({ t: w.surface, v: w.vLevel })
  })
  return out
}

export function SharedFitView({ profile }: { profile: LevelProfile }) {
  const [level, setLevel] = useState<ProfileLevel>((profile.fitLevel as ProfileLevel | null) ?? DEFAULT_LEVEL)
  const [sheetOpen, setSheetOpen] = useState(false)
  const tokens = useMemo(() => wordTokens(profile), [profile])
  const levelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 확산 계수의 분자 — 공유 링크로 온 진입(`/fit` 과 같은 두 이벤트)
  useEffect(() => {
    track({ name: 'fit_viewed', props: { shared: true } })
    track({ name: 'fit_share_opened', props: { valid: true } })
    return () => {
      if (levelTimer.current) clearTimeout(levelTimer.current)
    }
  }, [])

  function changeLevel(next: ProfileLevel) {
    setLevel(next)
    if (levelTimer.current) clearTimeout(levelTimer.current)
    levelTimer.current = setTimeout(() => {
      track({ name: 'fit_level_moved', props: { level: next } })
    }, TRACK_DEBOUNCE_MS)
  }

  function toggleSheet() {
    const next = !sheetOpen
    setSheetOpen(next)
    if (next) track({ name: 'fit_sheet_opened', props: { words: buildGloss(profile, null, level).length } })
  }

  const hasWords = tokens.length > 0

  return (
    <div className="flex flex-col gap-6">
      {/* ── 골격: 가장 어려운 낱말 줄이 학년으로 칠해진다 ── */}
      <section aria-label="이 지문의 가장 어려운 낱말" className="flex flex-col gap-4 border-y border-[var(--bd)] py-5">
        <p className="m-0 flex flex-wrap items-baseline justify-between gap-2 font-display text-[12.5px] font-[700] text-[var(--t2)]">
          <span>이 지문의 가장 어려운 낱말 {profile.hardestWords.length}개</span>
          <span className="font-body text-[12px] font-[400]">원문은 링크에 담기지 않아요</span>
        </p>
        {/* 어려운 낱말이 하나도 레벨을 갖지 못했으면 눈금만 선다(같은 부품, 토큰 없이) */}
        <PaintedPassage
          tokens={hasWords ? tokens : null}
          readings={profile.readings}
          fitLevel={profile.fitLevel as ProfileLevel | null}
          level={level}
          onLevelChange={changeLevel}
          stale={false}
        />
      </section>

      {/* 1차 — 받은 교사가 자기 반 지문으로 넘어가는 문(렌즈 6 교사의 3분) */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/fit" className={PRIMARY}>
          <FileText size={15} aria-hidden />내 지문으로 해 보기
        </Link>
        <button
          type="button"
          aria-expanded={sheetOpen}
          aria-controls="fit-shared-sheet"
          onClick={toggleSheet}
          className={SECONDARY}
        >
          <Printer size={15} aria-hidden />
          {sheetOpen ? '한 장 접기' : '학급에 나눠 줄 한 장으로'}
        </button>
      </div>

      {sheetOpen && (
        <div id="fit-shared-sheet">
          <ClassSheet profile={profile} tokens={null} level={level} variant="screen" />
        </div>
      )}
    </div>
  )
}

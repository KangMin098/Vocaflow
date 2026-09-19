// apps/web/src/app/(auth)/signup/SignupProof.tsx
//
// **가입 옆의 칠해진 지문** — `/signup` 골격(2026-09-19 발산 A · docs/design/compare/signup.md · DD-26).
//
// 가입은 가치를 본 **뒤**에 온다(D1). 그런데 가입 화면에는 그 가치가 하나도 없었다 — 빈 바탕 한가운데
// 그림자 카드 폼뿐이었다(감사 평균). 여기서는 랜딩·`/fit` 과 같은 지문이 같은 부품(`PaintedPassage`)으로
// 칠해진 채 폼 옆에 선다: "지금은 학년 기준으로 칠했어요 — 가입하고 진단하면 내 수준으로 칠해요."
// (`/diagnostic` 이 실제로 그렇게 칠한다 — DD-23.)
//
// 데스크톱: 학년 슬라이더까지 온전히. 모바일: 두 줄로 줄인 칠 — 가입 버튼이 첫 화면에 남아야 한다(브리프 제약).

'use client'

import { useState } from 'react'

import { PaintedPassage, runs } from '@/components/textfit/PaintedPassage'
import { countUnknownTypes, isUnknownAt, type PaintToken } from '@/lib/textfit/paint'
import type { LevelReading, ProfileLevel } from '@/lib/textfit/profile'

const DEFAULT_LEVEL: ProfileLevel = 6

/** 처음 만나는 낱말 앞에 남길 낱말 수 — 두 줄 안에 칠이 들어오게 */
const LEAD_WORDS = 4

/**
 * 모바일 두 줄이 칠을 담게 — 처음 만나는 낱말 **몇 낱말 앞**부터 자르고 앞에 말줄임표를 단다.
 * 지문 첫머리부터(0회차) · 그 문장 첫머리부터(1회차) 자르면 첫 칠 낱말이 문장 끝이라
 * 두 줄 자르기에 걸려 칠이 하나도 안 보였다(2026-09-19 캡처 — 증명이 사라졌다. 2회차 수정).
 */
export function fromFirstUnknown(tokens: PaintToken[], level: number): PaintToken[] {
  const first = tokens.findIndex((t) => isUnknownAt(t, level))
  if (first <= 0) return tokens
  let words = 0
  for (let i = first - 1; i >= 0; i--) {
    if (/^[A-Za-z]/.test(tokens[i].t) && ++words === LEAD_WORDS) {
      return i === 0 ? tokens : [{ t: '… ' }, ...tokens.slice(i)]
    }
  }
  return tokens
}

export function SignupProof({
  tokens,
  readings,
  fitLevel,
}: {
  tokens: PaintToken[]
  readings: LevelReading[]
  fitLevel: ProfileLevel | null
}) {
  const [level, setLevel] = useState<ProfileLevel>(DEFAULT_LEVEL)

  return (
    <>
      {/* 모바일 — 두 줄 칠(조작 없음). 폼이 주인이고 이 줄은 "무엇을 저장하는가" 를 보인다 */}
      <p className="m-0 font-mono text-[11px] tabular-nums text-[var(--t2)] md:hidden">
        고1 기준 · 처음 만나는 낱말 {countUnknownTypes(tokens, level)}개 — 진단하면 내 수준으로 칠해요
      </p>
      <p
        lang="en"
        aria-hidden
        className="m-0 line-clamp-2 font-english text-[15px] leading-[1.8] text-[var(--t1)] md:hidden"
      >
        {runs(fromFirstUnknown(tokens, level), level).map((run, i) =>
          run.unknown ? (
            <mark
              key={i}
              className="rounded-[var(--r-sm)] bg-[var(--ju-wash)] px-[1px] text-[var(--t1)] underline decoration-[var(--ju)] decoration-1 underline-offset-[4px]"
            >
              {run.text}
            </mark>
          ) : (
            <span key={i}>{run.text}</span>
          ),
        )}
      </p>

      {/* 데스크톱 — `/fit` 과 같은 부품: 학년 슬라이더 → 낱말 면 색 200ms */}
      <div className="hidden md:block">
        <PaintedPassage
          tokens={tokens}
          readings={readings}
          fitLevel={fitLevel}
          level={level}
          onLevelChange={setLevel}
          stale={false}
        />
      </div>
    </>
  )
}

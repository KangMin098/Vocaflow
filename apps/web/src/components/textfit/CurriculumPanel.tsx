// apps/web/src/components/textfit/CurriculumPanel.tsx
//
// **교육과정 기본 어휘** 칸 — 이 화면에서 교사가 실제로 행동하는 숫자.
//
// ── 왜 커버리지 사다리로 부족한가 ───────────────────────────────────
// 위 칸은 "고1에게 92%" 라고 말한다. 유용하지만 **제품 안에서만 참인 숫자**다 —
// V-Level 사다리는 자기참조라(`profile.ts` 의 `LEVEL_LABEL`) 교사가 그것을 믿을 근거가
// 바깥에 없다. 반면 교육과정 기본 어휘 3,000은 교육부 고시로 공개돼 있고
// **교과서 검정이 그 목록으로 이뤄진다**(KICE Word Lister). 교사·출판사·평가원이
// 이미 같은 말을 쓰므로 "교육과정 밖 6개" 는 설명이 필요 없다.
//
// ── 무엇을 강조하나 ─────────────────────────────────────────────────
// 큰 숫자는 **밖**이다. 안에 있는 것은 수업에서 다룰 이유가 적고, 밖에 있는 것이
// 유인물·각주·사전 찾기를 부르는 것들이다. 그중 **수능 기출**은 따로 센다 —
// "교육과정 밖이지만 시험에는 나온다" 가 고3 교사에게는 가장 먼저 볼 칸이다
// (실측: 수능 13년치 5,254개 중 3,108개가 교육과정 밖).
//
// ⚠️ Calm UI — "밖" 은 나쁜 것이 아니라 정보다. 경고색을 쓰지 않는다.
// ⚠️ 조회에 실패하면 `profile.curriculum` 이 **없다**. 이 컴포넌트는 그때 아무것도
//    그리지 않는다 — "밖 0개" 는 성공과 실패를 구별하지 못한다.

'use client'

import {
  CURRICULUM_BAND_LABEL,
  CURRICULUM_BAND_MARK,
  CURRICULUM_OFFICIAL_COUNT,
  CURRICULUM_TOTAL,
  type CurriculumBand,
} from '@/lib/textfit/curriculum'
import type { LevelProfile } from '@/lib/textfit/profile'

const BANDS: CurriculumBand[] = [1, 2, 3]

export function CurriculumPanel({ profile }: { profile: LevelProfile | null }) {
  const c = profile?.curriculum
  if (!c || c.considered === 0) return null

  // 밖에 있는 낱말들 — 교사가 손댈 목록이 이것이다. 어려운 순으로 이미 정렬돼 있다.
  const outsideWords = (profile?.hardestWords ?? []).filter((w) => w.curriculumBand === null)

  return (
    <section
      aria-label="교육과정 기본 어휘"
      className="flex flex-col gap-4 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="m-0 font-display text-[15px] font-[750] tracking-[-0.02em] text-[var(--t1)]">
          교육과정 기본 어휘
        </h2>
        <p className="m-0 font-mono text-[10.5px] text-[var(--t3)]">
          2022 개정 · 기본 어휘 {CURRICULUM_TOTAL.toLocaleString('ko-KR')}개
        </p>
      </header>

      {/* 큰 숫자 — 밖 */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-[34px] font-[800] leading-none tracking-[-0.02em] text-[var(--t1)] tabular-nums">
          {c.outside}
        </span>
        <span className="font-body text-[13.5px] text-[var(--t2)]">
          개 낱말이 <b className="text-[var(--t1)]">교육과정 기본 어휘 밖</b>이에요
          <span className="text-[var(--t3)]"> (내용어 {c.considered}개 중)</span>
        </span>
      </div>

      {c.outsideButCsat > 0 && (
        <p className="m-0 font-body text-[12.5px] leading-[1.65] text-[var(--t2)]">
          그중 <b className="tabular-nums text-[var(--t1)]">{c.outsideButCsat}개</b>는{' '}
          <b>수능 기출</b>에 나온 낱말이에요 — 교육과정 밖이지만 시험에는 나옵니다.
        </p>
      )}

      {/* 계층별 — 색이 아니라 숫자와 이름으로 읽힌다 */}
      <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-2 p-0 sm:grid-cols-4">
        {BANDS.map((b) => (
          <li key={b} className="flex flex-col gap-0.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-[var(--t3)]">
              {CURRICULUM_BAND_LABEL[b]}
              {CURRICULUM_BAND_MARK[b] && (
                <span aria-hidden> {CURRICULUM_BAND_MARK[b]}</span>
              )}
            </span>
            <span className="font-display text-[17px] font-[700] tabular-nums text-[var(--t1)]">
              {c.inBand[b]}
            </span>
            <span className="font-mono text-[10px] text-[var(--t3)]">
              전체 {CURRICULUM_OFFICIAL_COUNT[b].toLocaleString('ko-KR')}
            </span>
          </li>
        ))}
        <li className="flex flex-col gap-0.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-[var(--t3)]">
            목록 밖
          </span>
          <span className="font-display text-[17px] font-[700] tabular-nums text-[var(--t1)]">
            {c.outside}
          </span>
          <span className="font-mono text-[10px] text-[var(--t3)]">수능 {c.outsideButCsat}</span>
        </li>
      </ul>

      {/* 밖에 있는 낱말 — 유인물·각주로 옮길 실제 목록 */}
      {outsideWords.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-[var(--bd)] pt-3">
          <h3 className="m-0 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--t3)]">
            목록 밖 낱말 (어려운 순)
          </h3>
          <ul className="m-0 flex flex-wrap gap-x-3 gap-y-1.5 p-0">
            {outsideWords.map((w) => (
              <li
                key={w.lemma}
                className="inline-flex items-baseline gap-1.5 font-body text-[13px] text-[var(--t1)]"
              >
                <span className="font-[600]">{w.surface}</span>
                {w.meaningKo && (
                  <span className="text-[var(--t3)]">{w.meaningKo.split(',')[0]}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        출처를 적는다 — 이 숫자의 값어치는 **어디서 왔는지 말할 수 있다는 것**이다.
        교사가 학교에서 근거를 대야 할 때 이 한 줄이 필요하다.
      */}
      <p className="m-0 font-mono text-[10px] leading-[1.6] text-[var(--t3)]">
        교육부 고시 제2022-33호 [별책 14] 영어과 교육과정 기본 어휘 목록 (pp. 254–290)
        {c.viaDerived > 0 && (
          <>
            {' · '}
            {c.viaDerived}개는 원형에서 인정 (teach → teacher)
          </>
        )}
      </p>
    </section>
  )
}

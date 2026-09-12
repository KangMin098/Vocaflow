// apps/web/src/components/wordvault/hub/FacetProgressSection.tsx
//
// 내 단어의 **면(facet) 상태** — 그리고 지금 가장 비어 있는 면 하나.
//
// 이 자리에 있던 `LearningDimensionSection` 을 대체한다. 그것이 왜 못 쓰였는가:
//   · 어디서도 렌더되지 않았고(임포터 0), 데이터는 `MOCK_MASTERY_GROUPS`(63/47/27) 였다
//   · 분류가 모듈명 4개 하드코딩(`flashcard`·`wordblitz`·`spellforge`·`dictation`)이라
//     **아케이드 19종과 Echo 가 통째로 안 보였다** — 어떤 게임을 해도 '아직 안 만난 단어'
//   · 3그룹(unmet/recognizing/multichannel)은 사실상 단일 mastery 스칼라였다.
//     설계안 §2.3 이 배제한 그것 — 면이 6개인데 하나로 접으면 "무엇이 부족한지" 를 못 말한다
//
// 그래서 축을 레지스트리에 돌려준다. 활동이 어떤 면을 훈련하는지는 `Activity.facets` 가 알고,
// 여기서는 **그림과 한국어 라벨만** 고른다(MobileTabBar 가 표면 이름을 다루는 방식과 같다).
//
// 화면 원칙:
//   · 설계안 §2.3 — "가장 뒤처진 면 **하나**를 처방으로". 6개를 나란히 들이밀지 않는다
//   · Progressive Disclosure — 면별 내역은 접어 두고 요청할 때 편다
//   · Empathetic Feedback — 못한 것을 세지 않고 **다음에 할 것**을 말한다. 경고색 없음

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

import { Frame } from '@/components/ui/ios'
import { FACETS, FACET_ORDER, type FacetId } from '@/lib/framework/axes'
import { activityLabel } from '@/lib/framework/registry'
import { suggestActivityForFacet } from '@/lib/framework/word-progress'
import type { FacetSummary } from '@/lib/framework/word-progress-query'

/** 면 → 학습자에게 보일 짧은 한국어. 정식명·설명은 축이 갖고, 좁은 자리 라벨만 여기서 고른다. */
const LABEL: Record<FacetId, string> = {
  recognize: '뜻 알아보기',
  spell: '철자 쓰기',
  sound: '소리로 익히기',
  build: '형태 뜯어보기',
  use: '문맥에서 쓰기',
  fluency: '빠르게 꺼내기',
}

/** 처방 문장 — "못했다" 가 아니라 "아직 안 해봤다 / 더 하면 는다" 로 말한다. */
function prescriptionText(summary: FacetSummary): { headline: string; detail: string } | null {
  const gap = summary.weakest
  if (!gap) {
    return {
      headline: '여섯 면을 고르게 채우고 있어요',
      detail: '지금은 특별히 비어 있는 면이 없어요. 하던 대로 이어가면 돼요.',
    }
  }
  const label = LABEL[gap.facet]
  if (gap.untried) {
    return {
      headline: `아직 안 해본 건 ${label}예요`,
      detail: FACETS[gap.facet].says,
    }
  }
  const passed = summary.distribution[gap.facet].passed
  const tried = summary.distribution[gap.facet].tried
  return {
    headline: `지금 가장 여유 있는 건 ${label}예요`,
    detail: `${tried}개 중 ${passed}개가 자리를 잡았어요. ${FACETS[gap.facet].says}`,
  }
}

export function FacetProgressSection({ summary }: { summary: FacetSummary }) {
  const [open, setOpen] = useState(false)
  const prescription = prescriptionText(summary)
  if (!prescription) return null

  const gap = summary.weakest
  const activity = gap ? suggestActivityForFacet(gap.facet) : null
  // 아직 한 번도 안 꺼내 본 단어 — "무엇이 부족한가" 보다 먼저 알려야 할 사실이다
  const untouched = summary.total - summary.practiced

  return (
    // ⚠️ 섹션 껍데기는 `Frame` 이다 — 손으로 만들지 않는다.
    // 이 섹션만 자기 껍데기(border + p-4 + h2 15px)를 갖고 있어서, 같은 화면의 다른 다섯
    // 섹션(전부 Frame · h2 22px · Card)과 **혼자 다른 언어로 말하고 있었다**. 화면을 훑으면
    // 이 구역만 한 단계 작아 보여서 덜 중요한 것으로 읽힌다 — 실제로는 "어느 쪽으로 아는가"
    // 를 말하는 유일한 구역이다(실측 2026-08-16: /wordvault 3.04화면 · 섹션 6종 중 1종만 이탈).
    <Frame title="단어를 어느 쪽으로 알고 있나">
      <p className="-mt-4 mb-5 font-body text-[13px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
        같은 단어라도 알아보는 것과 직접 쓰는 것은 다른 능력이에요
      </p>

      <div className="rounded-[var(--r-md)] bg-[var(--bg2)] p-4">
        {/* 처방 문장 — 회귀가 부제목과 구별할 수 있어야 한다(첫 구현이 그걸 헷갈렸다) */}
        <p
          data-testid="facet-prescription"
          className="font-display text-[16px] font-[700] leading-snug text-[var(--t1)]"
        >
          {prescription.headline}
        </p>
        <p className="mt-1 font-body text-[13px] leading-relaxed text-[var(--t2)]">
          {prescription.detail}
        </p>

        {/* 다크에서 --p 는 밝은 파랑(#6B9BD1)이라 흰 글자가 AA 미달(2.90:1) — 짝 토큰 --on-p */}
        {activity && (
          <Link
            href={activity.route!.path}
            className="mt-3 inline-flex h-11 items-center rounded-[var(--r-md)] bg-[var(--p)] px-4 font-display text-[14px] font-[700] text-[var(--on-p)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:-translate-y-px hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 active:translate-y-0"
          >
            {activityLabel(activity.id)}로 시작하기
          </Link>
        )}
      </div>

      {untouched > 0 && (
        <p className="mt-3 font-body text-[12px] text-[var(--t2)]">
          내 단어 {summary.total}개 중{' '}
          <span className="font-mono font-[700] tabular-nums text-[var(--t1)]">{untouched}개</span>
          는 아직 한 번도 꺼내 보지 않았어요
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="facet-progress-detail"
        className="mt-3 inline-flex h-11 items-center gap-1 font-body text-[13px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        면별로 보기
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={`transition-transform duration-[var(--dur-normal)] ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul id="facet-progress-detail" className="mt-2 flex flex-col gap-2">
          {FACET_ORDER.map((f) => {
            const d = summary.distribution[f]
            // 0/0 을 100% 로 보이게 하지 않는다 — "안 해봤다" 와 "다 했다" 는 다르다
            const pct = d.tried === 0 ? 0 : Math.round((d.passed / d.tried) * 100)
            return (
              <li key={f} className="flex items-center gap-3">
                <span className="w-[92px] shrink-0 font-body text-[12px] text-[var(--t1)]">
                  {LABEL[f]}
                </span>
                {/* 색만으로 정보를 주지 않는다 — 막대 옆에 항상 수치를 같이 쓴다 */}
                <span
                  aria-hidden="true"
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg2)]"
                >
                  <span
                    className="block h-full rounded-full bg-[var(--p)]"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="w-[76px] shrink-0 text-right font-mono text-[11px] tabular-nums text-[var(--t2)]">
                  {d.tried === 0 ? '안 해봄' : `${d.passed}/${d.tried}`}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Frame>
  )
}

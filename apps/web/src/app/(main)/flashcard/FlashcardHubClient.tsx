// apps/web/src/app/(main)/flashcard/FlashcardHubClient.tsx
//
// Flashcard 허브 표시부 — 세션 길이 선택만 클라이언트 상태로 갖는다.
// 데이터는 전부 page.tsx(서버)가 실측해서 넘긴다. 이 파일에는 학습 데이터 상수가 없어야 한다.
//
// 길이를 바꾸면 큐 분포도 같이 바뀐다 — bucketsOf(words, limit) 를 다시 계산하기 때문에
// 화면의 분포는 항상 "지금 시작하면 담길 카드" 와 같다. (자세한 이유는 session-queue.ts 주석)

'use client'

import { Layers } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { HubStartCard } from '@/components/hub/HubStartCard'
import { ModuleHero } from '@/components/hub/ModuleHero'
import { TodayQueue } from '@/components/hub/TodayQueue'
import { bucketsOf, overdueOf, type SessionQueue } from '@/lib/learner/session-queue'

// Flashcard 모듈 색(CLAUDE.md §13)은 #EC4899 이지만 그 핑크를 '채움 위 글자' 나 '작은 글자'
// 로 쓰면 3.4~3.5:1 로 AA 미달이라(2026-08-09 axe) 채움 CTA 는 한 단계 깊은 톤을 쓴다
// (흰 글자 6.04 · 종이 위 5.78). 면/그래프용 #EC4899 는 이 화면에서 쓰는 곳이 없어졌다
// (ContinueRow 제거) — 필요해지면 그때 되살린다.
const FLASHCARD_INK = '#BE185D'

/** 세션 길이 후보 — 세션에 담긴 것보다 많은 길이는 제안하지 않는다(없는 카드를 약속하지 않게). */
const LENGTH_STEPS = [10, 20, 30] as const

/** '전체' 선택값 — 쿼리스트링에 limit 을 붙이지 않는다는 뜻. */
const ALL = 'all'

export function FlashcardHubClient({ queue, streak }: { queue: SessionQueue; streak: number }) {
  const total = queue.words.length
  const steps = useMemo(() => LENGTH_STEPS.filter((n) => n < total), [total])
  // 기본은 20장 — 있으면 그것, 없으면 전체. (Cognitive Load: 한 번에 20장이 기존 권장값)
  const [length, setLength] = useState<string>(steps.includes(20) ? '20' : ALL)

  const limit = length === ALL ? undefined : Number(length)
  const buckets = useMemo(() => bucketsOf(queue.words, limit), [queue.words, limit])
  const sessionSize = limit === undefined ? total : Math.min(limit, total)
  const overdue = useMemo(() => overdueOf(queue.words, limit), [queue.words, limit])

  const empty = total === 0
  const href = limit === undefined ? '/flashcard/play' : `/flashcard/play?limit=${limit}`

  return (
    <div className="mx-auto flex max-w-[var(--ios-content-wide-max)] flex-col gap-4 px-4 py-6 md:px-6 md:py-8">
      <ModuleHero
        eyebrow="Flashcard · 능동적 회상"
        title="복습 카드"
        note={
          empty
            ? '단어장에 단어를 추가하면 여기에 복습 카드가 채워져요'
            : queue.capped
              ? `내 단어 ${queue.vocabTotal}개 중 복습이 급한 것부터 담았어요`
              : `내 단어 ${queue.vocabTotal}개를 급한 순서로 담았어요`
        }
        gradient={{ from: '#FB7185', to: '#9F1239' }}
        // PRACTICE 그룹은 조용한 변형 — 형제 4화면이 서로 다른 고채도 면으로 소리치던 것을 멈춘다
        quiet
        icon={Layers}
        stats={[
          // 라벨을 영어로 바꾸면 단위도 같이 가야 한다 — 'This Session 12장' 은 어느 쪽도 아니다.
          { label: 'This Session', value: sessionSize, unit: 'cards', emphasis: true },
          { label: 'Overdue', value: overdue, unit: 'due' },
          { label: 'Streak', value: streak, unit: 'days' },
        ]}
      />

      <TodayQueue
        buckets={buckets}
        totalLabel={empty ? '0개' : `내 단어 ${queue.vocabTotal}개 중 ${sessionSize}장`}
      />

      <HubStartCard
        title="세션 길이"
        description={empty ? undefined : '고른 만큼 급한 순서로 담아요'}
        choices={
          steps.length === 0
            ? []
            : [
                {
                  label: '길이',
                  value: length,
                  options: [
                    ...steps.map((n) => ({ value: String(n), label: `${n}장` })),
                    { value: ALL, label: `전체 ${total}장` },
                  ],
                  onChange: setLength,
                },
              ]
        }
        extras={
          // 제거한 단어장 선택기가 하던 약속(자료를 골라 학습)은 실제로는 자료 화면에 있다.
          // 여기서 링크로 남긴다 — 없애면 그 경로가 존재하는 것 자체를 모르게 된다.
          <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
            특정 도서·챕터·단어장으로 학습하려면{' '}
            <Link href="/text" className="font-[600] underline decoration-dotted text-[var(--t1)]">
              내 자료
            </Link>{' '}
            에서 그 자료를 열고 카드로 들어오세요.
          </p>
        }
        cta={{
          label: '시작하기',
          href,
          accent: FLASHCARD_INK,
          disabled: empty,
          disabledReason: '복습할 단어가 아직 없어요',
        }}
      />
    </div>
  )
}

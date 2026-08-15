// apps/web/src/app/(main)/spellforge/SpellForgeHubClient.tsx
//
// SpellForge 허브 표시부 — 세션 길이 선택만 클라이언트 상태.
// 데이터는 전부 page.tsx(서버) 실측. 이 파일에 학습 데이터 상수가 있으면 안 된다.

'use client'

import { Keyboard, Zap } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { HubStartCard } from '@/components/hub/HubStartCard'
import { ModuleHero } from '@/components/hub/ModuleHero'
import { RecentScoresList } from '@/components/hub/RecentScoresList'
import { TodayQueue } from '@/components/hub/TodayQueue'
import { bucketsOf, overdueOf, type SessionQueue } from '@/lib/learner/session-queue'
import type { RecentScore } from '@/lib/scores/recent'

const SPELLFORGE_ACCENT = '#4A9FCF' // CLAUDE.md 게임 전용 파란 패널

const LENGTH_STEPS = [10, 20, 30] as const
const ALL = 'all'

export function SpellForgeHubClient({
  queue,
  recent,
  best,
}: {
  queue: SessionQueue
  recent: RecentScore[]
  best: number | null
}) {
  const total = queue.words.length
  const steps = useMemo(() => LENGTH_STEPS.filter((n) => n < total), [total])
  const [length, setLength] = useState<string>(steps.includes(20) ? '20' : ALL)

  const limit = length === ALL ? undefined : Number(length)
  const buckets = useMemo(() => bucketsOf(queue.words, limit), [queue.words, limit])
  const sessionSize = limit === undefined ? total : Math.min(limit, total)
  const overdue = useMemo(() => overdueOf(queue.words, limit), [queue.words, limit])

  const empty = total === 0
  const href = limit === undefined ? '/spellforge/play' : `/spellforge/play?limit=${limit}`

  // 흔들림+흐릿함 — 철자를 다시 써 보는 것이 가장 효과 있는 구간(Desirable Difficulty)
  const focus = useMemo(
    () =>
      buckets
        .filter((b) => b.kind === 'risk' || b.kind === 'shaky')
        .reduce((s, b) => s + b.count, 0),
    [buckets],
  )

  return (
    <div className="mx-auto flex max-w-[var(--ios-content-wide-max)] flex-col gap-4 px-4 py-6 md:px-6 md:py-8">
      <ModuleHero
        eyebrow="SpellForge · 타이핑 단련"
        title="철자 연습"
        note={
          empty
            ? '단어장에 단어를 추가하면 철자를 단련할 단어가 채워져요'
            : focus > 0
              ? `이번 세션에서 철자가 흔들리는 단어 ${focus}개를 만나요`
              : '이번 세션은 안정된 단어들이에요 — 손에 익히는 시간'
        }
        gradient={{ from: '#5CB8E0', to: '#3A7FAF' }}
        icon={Keyboard}
        stats={[
          { label: 'This Session', value: sessionSize, unit: 'words', emphasis: true },
          { label: 'Overdue', value: overdue, unit: 'due' },
          // 기록이 없으면 0 을 넣지 않는다 — '—' 가 "아직 안 해봤다" 를 정확히 말한다
          { label: 'Best', value: best ?? '—', unit: best == null ? '' : 'pts' },
        ]}
      />

      <TodayQueue
        buckets={buckets}
        totalLabel={empty ? '0개' : `내 단어 ${queue.vocabTotal}개 중 ${sessionSize}개`}
      />

      <RecentScoresList
        scores={recent}
        best={best}
        accent={SPELLFORGE_ACCENT}
        emptyHint="아직 이 모듈 기록이 없어요. 한 세션을 마치면 점수와 정확도가 여기에 남아요."
      />

      <HubStartCard
        title="세션 길이"
        description={empty ? undefined : '어려울수록 기억은 단단해져요 (Desirable Difficulty)'}
        choices={
          steps.length === 0
            ? []
            : [
                {
                  label: '길이',
                  value: length,
                  options: [
                    ...steps.map((n) => ({ value: String(n), label: `${n}개` })),
                    { value: ALL, label: `전체 ${total}개` },
                  ],
                  onChange: setLength,
                },
              ]
        }
        extras={
          <div className="space-y-2">
            <p className="font-body text-[11px] italic leading-relaxed text-[var(--t2)]">
              <Zap size={10} className="mr-1 inline align-text-bottom text-[var(--active)]" aria-hidden />
              {/* 기존 문구는 "힌트 사용 시 점수 -20" 이었지만 그런 감점은 코드에 없다.
                  실제로는 FSRS 등급이 내려간다 — rating-mapper: 힌트 0·오류 0 → Easy,
                  힌트 ≤1·오류 ≤1 → Good, 그 외 Hard. 즉 다음 복습이 더 빨리 돌아온다. */}
              힌트를 쓰면 점수가 깎이는 게 아니라 다음 복습이 더 빨리 돌아와요 — 처음엔 그래도 쓰는 게 좋아요.
            </p>
            <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
              특정 도서·챕터·단어장으로 연습하려면{' '}
              <Link href="/text" className="font-[600] underline decoration-dotted text-[var(--t1)]">
                내 자료
              </Link>{' '}
              에서 그 자료를 열고 철자로 들어오세요.
            </p>
          </div>
        }
        cta={{
          label: '시작하기',
          href,
          accent: SPELLFORGE_ACCENT,
          disabled: empty,
          disabledReason: '연습할 단어가 아직 없어요',
        }}
      />
    </div>
  )
}

// apps/web/src/components/dashboard/TodayHero.tsx
// Dashboard Hero (v06.36 iOS) — Activity Ring + 거대 hero + iOS Primary CTA.
// Calm UI · Empathetic Feedback — 압박 대신 격려.

'use client'

import { ActivityRing, Card, PrimaryButton } from '@/components/ui/ios'

export interface TodayHeroProps {
  userName?: string
  todayWords?: number
  goal?: number
}

export function TodayHero({ userName = '학습자', todayWords = 23, goal = 30 }: TodayHeroProps) {
  const hour = new Date().getHours()
  const greeting =
    hour < 6
      ? '이른 아침이에요'
      : hour < 12
        ? '좋은 아침이에요'
        : hour < 18
          ? '안녕하세요'
          : hour < 22
            ? '좋은 저녁이에요'
            : '늦은 시간이네요'
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  const pct = goal > 0 ? Math.min(100, Math.round((todayWords / goal) * 100)) : 0
  const remaining = Math.max(0, goal - todayWords)
  const done = remaining === 0
  const note = done
    ? '오늘 목표를 달성했어요. 차분히 잘 해내고 있어요.'
    : `오늘 ${remaining}단어만 더 하면 목표예요. 천천히 가도 괜찮아요.`

  return (
    <Card size="lg">
      <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
        <ActivityRing
          pct={pct}
          reached={done}
          capLabel="오늘"
          centerValue={todayWords}
          centerSub={`/ ${goal}`}
          ariaLabel={`오늘 ${todayWords} / ${goal}`}
        />

        <div className="flex min-w-0 flex-col gap-2">
          <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.15em] text-[var(--t3)]">
            {dateStr}
          </span>
          <h1 className="font-editorial text-[28px] font-[500] leading-[1.05] tracking-[-0.012em] text-[var(--t1)] md:text-[34px]">
            {greeting},{' '}
            <span className="text-[var(--p)]">{userName}</span>
            <span className="text-[var(--t1)]">님</span>
          </h1>
          <p className="font-body text-[13.5px] leading-relaxed text-[var(--t2)]">
            {note}
          </p>
        </div>
      </div>

      <PrimaryButton
        href="/hub"
        tone={done ? 'success' : 'brand'}
        className="mt-5"
      >
        이어서 학습
      </PrimaryButton>
    </Card>
  )
}

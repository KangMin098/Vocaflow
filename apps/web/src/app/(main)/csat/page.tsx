// apps/web/src/app/(main)/csat/page.tsx
//
// 기출 유형 허브 — 「무엇이 몇 번 나오고, 나는 그 유형에서 어디서 미끄러지나」.
//
// 카드가 말하는 것은 **출제 비중과 실패 지점** 둘이다. 진도율·정복률 같은 게이지를 두지 않았다
// (Implicit Progress — 숫자 게이지보다 환경 변화). 분석이 없는 유형도 숨기지 않는다:
// 숨기면 학습자는 그 유형이 시험에 안 나온다고 읽는다.

import type { Metadata } from 'next'
import Link from 'next/link'

import { loadCsatTypeCards } from '@/lib/csat/learner'

export const metadata: Metadata = {
  title: '기출 유형 분석',
  description: '평가원 수능·모의평가 독해 문항을 유형별로 분석한 결과.',
}

export const dynamic = 'force-dynamic'

export default async function CsatHubPage() {
  const { cards, error } = await loadCsatTypeCards()
  const ready = cards.filter((c) => c.ready).length

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--t1)]">기출 유형 분석</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--t2)]">
          평가원이 유형마다 재려는 것은 좁습니다. 그래서 유형마다 <strong>볼 곳이 다릅니다.</strong>{' '}
          여기 적힌 절차는 전부 기출로 확인한 것이고, 통하지 않는 구간도 함께 적어 두었습니다.
        </p>
        {ready > 0 ? (
          <p className="mt-2 text-xs text-[var(--t3)]">
            분석이 준비된 유형 {ready} / {cards.length} · 듣기는 다루지 않습니다
          </p>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4 text-sm text-[var(--t2)]">
          지금은 분석을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
        </p>
      ) : null}

      {!error && !cards.length ? (
        <p className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4 text-sm text-[var(--t2)]">
          아직 준비된 유형이 없어요.
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <li key={c.type_id}>
            <Link
              href={`/csat/${c.type_id}`}
              className="group flex h-full min-h-[44px] flex-col rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--sf)] p-4 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] hover:bg-[var(--sf-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:bg-[var(--bd)] motion-reduce:transition-none"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-base font-bold text-[var(--t1)]">{c.name}</h2>
                <span className="shrink-0 tabular-nums text-xs text-[var(--t3)]">
                  {c.recent > 0 ? `최근 4개년 ${c.recent}문항` : `기출 ${c.items}문항`}
                </span>
              </div>

              {c.status === 'retired' ? (
                <span className="mt-1 self-start rounded bg-[var(--sf-2)] px-1.5 py-0.5 text-[10px] text-[var(--t3)]">
                  2023학년도 이후 출제 없음
                </span>
              ) : null}

              {c.ready ? (
                <>
                  {c.headline ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--t2)]">{c.headline}</p>
                  ) : null}
                  {c.time_budget_sec ? (
                    <p className="mt-auto pt-3 text-xs text-[var(--t3)]">
                      권장 풀이 시간 {c.time_budget_sec}초
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-sm text-[var(--t3)]">분석 준비 중이에요.</p>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs leading-relaxed text-[var(--t3)]">
        문항 원문은 싣지 않습니다. 지문·선지의 저작권은 한국교육과정평가원에 있고, 여기 있는 것은
        그 문항을 분석해 우리가 쓴 글입니다. 원문은 평가원 공개자료에서 보실 수 있어요.
      </p>
    </main>
  )
}

// apps/web/src/components/admin/factory/FactoryMap.tsx
//
// **공장 지도 — 영어 글감이 문제집 한 권이 되기까지.**
//
// 자리 셋, 위에서 아래로 읽는 순서가 곧 묻는 순서다:
//   ① 지금 가장 먼저 할 일 — 카드 한 장. 재료 흐름에서 가장 앞선, 순조롭지 않은 걸음.
//   ② 여덟 걸음 — 왼쪽에서 오른쪽, 위에서 아래. 칸마다 숫자 하나 · 상태(색+모양+글자) · 누가.
//      마지막 「낸 뒤 살피기」는 다음 주문으로 돌아가는 고리다.
//   ③ 기준을 세우는 곳 — 재료가 거치지 않는 연구 칸. 옆줄로 뺀다(라인을 막지 않는다).
//
// 새로 재는 것은 없다 — 숫자와 상태는 `loadFactoryLine()` 과 판정 스냅샷에서 그대로 온다.

import { ArrowRight, RotateCcw } from 'lucide-react'
import Link from 'next/link'

import type { StageState } from '@/lib/csat/factory-model'
import {
  PLAIN_LAB,
  PLAIN_STEPS,
  firstThing,
  gaugeText,
  readStep,
  type PickSnapshot,
  type StepReading,
} from '@/lib/csat/factory-plain'

import { FactoryTerm } from './FactoryTerm'
import { PlainStatusBadge } from './PlainStatusBadge'
import { WhoChip } from './WhoChip'

function StepCard({ r, arrow }: { r: StepReading; arrow: boolean }) {
  const { step, status, gauge } = r
  const value = step.countLabel ? gaugeText(gauge) : null
  return (
    <li className="relative flex">
      <Link
        href={step.href}
        className="group flex w-full flex-col gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--admin)] hover:bg-[var(--bg2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)]"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--admin)] font-display text-[13px] font-[800] text-[var(--on-p)]"
            >
              {step.no}
            </span>
            <h3 className="break-keep font-display text-[15px] font-[800] text-[var(--t1)]">
              <span className="sr-only">{step.no}번째 걸음 · </span>
              {step.name}
            </h3>
          </div>
          {status ? <PlainStatusBadge status={status} size="sm" /> : null}
        </div>
        <p className="break-keep font-body text-[12.5px] leading-relaxed text-[var(--t2)]">{step.says}</p>
        <div className="mt-auto flex flex-col gap-1 pt-1">
          {value ? (
            <p className="flex flex-col">
              <span className="font-mono text-[18px] font-[700] tabular-nums text-[var(--t1)]">{value}</span>
              <span className="font-body text-[11.5px] text-[var(--t3)]">{step.countLabel}</span>
            </p>
          ) : null}
          <WhoChip who={step.who} />
        </div>
      </Link>
      {arrow ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-[15px] top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-[var(--bg)] text-[var(--t3)] xl:block"
        >
          <ArrowRight size={18} strokeWidth={2} />
        </span>
      ) : null}
    </li>
  )
}

export function FactoryMap({
  stages,
  pick,
  loadError,
}: {
  stages: readonly StageState[]
  pick: PickSnapshot | null
  loadError: string | null
}) {
  const flow = PLAIN_STEPS.filter((s) => s.no != null).map((s) => readStep(s, stages, pick))
  const loop = PLAIN_STEPS.filter((s) => s.no == null).map((s) => readStep(s, stages, pick))
  const first = firstThing(stages, pick)

  return (
    <div className="flex flex-col gap-5">
      {loadError ? (
        <div role="alert" className="flex flex-col gap-1 rounded-[var(--r-md)] border border-[var(--error)]/40 bg-[var(--error)]/5 p-4">
          <p className="font-display text-[13.5px] font-[700] text-[var(--error-ink)]">공장 숫자를 읽지 못했어요</p>
          <p className="break-keep font-body text-[12.5px] text-[var(--t1)]">
            무슨 일: {loadError}
          </p>
          <p className="break-keep font-body text-[12.5px] text-[var(--t2)]">
            고치는 법: 잠시 뒤 새로고침해 보세요. 계속 같으면 데이터베이스 연결을 확인해야 해요. 아래 칸의 「아직 못 셈」은 0 이 아니라 모른다는 뜻이에요.
          </p>
        </div>
      ) : null}

      {/* ① 지금 가장 먼저 할 일 */}
      <section
        aria-labelledby="first-thing"
        className="flex flex-col gap-3 rounded-[var(--r-lg)] border-2 border-[var(--admin)] bg-[var(--bg)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
      >
        <div className="flex flex-col gap-1.5">
          <h2 id="first-thing" className="font-display text-[12.5px] font-[800] text-[var(--admin)]">
            지금 가장 먼저 할 일
          </h2>
          {first ? (
            <>
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-display text-[17px] font-[800] text-[var(--t1)]">
                  {first.step.no ? `${first.step.no}. ` : ''}
                  {first.step.name}
                </span>
                <PlainStatusBadge status={first.status} size="sm" />
              </p>
              <p className="break-keep font-body text-[14px] leading-relaxed text-[var(--t1)]">{first.text}</p>
            </>
          ) : (
            <p className="break-keep font-body text-[14px] leading-relaxed text-[var(--t1)]">
              막힌 걸음이 없어요. 새 책을 내려면 「무엇을 만들까」에서 시작하세요.
            </p>
          )}
        </div>
        <Link
          href={first ? first.step.href : '/admin/csat/new'}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-[var(--r-md)] bg-[var(--admin)] px-4 font-display text-[13.5px] font-[700] text-[var(--on-p)] transition-opacity duration-[var(--dur-normal)] ease-[var(--ease)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)]"
        >
          {first ? `「${first.step.name}」 화면 열기` : '새 책 주문하기'}
          <ArrowRight size={15} strokeWidth={2.2} aria-hidden />
        </Link>
      </section>

      {/* ② 여덟 걸음 */}
      <section aria-labelledby="flow-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="flow-title" className="font-display text-[15px] font-[800] text-[var(--t1)]">
            여덟 걸음
          </h2>
          <p className="break-keep font-body text-[12.5px] text-[var(--t2)]">
            왼쪽 위 1번부터 순서대로 흘러가요. 칸을 누르면 그 걸음 화면으로 가요. 상태 표시가 무슨 뜻인지는{' '}
            <FactoryTerm id="stopped">멈춤</FactoryTerm> · <FactoryTerm id="piling">할 일 남음</FactoryTerm> ·{' '}
            <FactoryTerm id="unknown">아직 못 셈</FactoryTerm>에 올려 보세요.
          </p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-x-6">
          {flow.map((r, i) => (
            <StepCard key={r.step.key} r={r} arrow={i % 4 !== 3} />
          ))}
        </ol>

        {loop.map((r) => {
          const value = r.step.countLabel ? gaugeText(r.gauge) : null
          return (
            <Link
              key={r.step.key}
              href={r.step.href}
              className="flex flex-col gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--admin)]/60 bg-[var(--bg2)] p-4 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--admin)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <RotateCcw size={16} strokeWidth={2} className="text-[var(--admin)]" aria-hidden />
                  <h3 className="font-display text-[15px] font-[800] text-[var(--t1)]">{r.step.name}</h3>
                  {r.status ? <PlainStatusBadge status={r.status} size="sm" /> : null}
                  <span className="font-body text-[11.5px] text-[var(--t3)]">— 여기서 정한 것이 다시 1번 주문이 돼요</span>
                </div>
                <p className="break-keep font-body text-[12.5px] leading-relaxed text-[var(--t2)]">{r.step.says}</p>
                <WhoChip who={r.step.who} />
              </div>
              {value ? (
                <p className="flex shrink-0 flex-col sm:items-end">
                  <span className="font-mono text-[18px] font-[700] tabular-nums text-[var(--t1)]">{value}</span>
                  <span className="font-body text-[11.5px] text-[var(--t3)]">{r.step.countLabel}</span>
                </p>
              ) : null}
            </Link>
          )
        })}
      </section>

      {/* ③ 기준을 세우는 곳 */}
      <section aria-labelledby="lab-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="lab-title" className="font-display text-[15px] font-[800] text-[var(--t1)]">
            기준을 세우는 곳
          </h2>
          <p className="break-keep font-body text-[12.5px] text-[var(--t2)]">
            글감이 거쳐 가는 곳은 아니에요. 무엇을 어떤 수준으로 만들지 정하는 데 써요. 여기가 멈춰도 여덟 걸음은 계속 돌아요.
          </p>
        </div>
        <ul className="grid gap-3 md:grid-cols-3">
          {PLAIN_LAB.map((l) => {
            const st = stages.find((s) => s.def.id === l.stage)
            return (
              <li key={l.key} className="flex">
                <Link
                  href={l.href}
                  className="flex w-full flex-col gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3.5 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--admin)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-[13.5px] font-[800] text-[var(--t1)]">{l.name}</h3>
                    {st ? <PlainStatusBadge status={st.status} size="sm" /> : null}
                  </div>
                  <p className="break-keep font-body text-[12px] leading-relaxed text-[var(--t2)]">{l.says}</p>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

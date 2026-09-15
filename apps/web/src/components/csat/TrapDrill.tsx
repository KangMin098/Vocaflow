// apps/web/src/components/csat/TrapDrill.tsx
//
// **오답 감별 훈련 — 「이 수법의 이름은 무엇인가」.**
//
// ── 이 화면이 메우는 구멍 ─────────────────────────────────────────────
// 재설계로 학습자는 ①**알고** ②**짚을** 수 있게 됐지만, 거기까지는 **읽고 납득하는** 물건이다.
// 아홉 가지를 아무리 잘 읽어도 다음 지문에서 그것을 **알아보는** 것은 다른 능력이고,
// 그 능력은 인출로만 자란다(원칙 1 Active Recall). 여기가 인출이 일어나는 첫 자리다.
//
// ── 비난하지 않는다 (철학 3) ──────────────────────────────────────────
// 틀려도 빨간 글씨로 점수를 압박하지 않는다. 틀린 것은 **이름을 아직 안 외운 것**이지
// 못 푸는 것이 아니다 — 그래서 오답 피드백은 「고른 것 / 실제」를 나란히 놓고 **둘의 잡는 법**을
// 함께 보여 준다. 그게 다음에 갈리는 지점이기 때문이다.
//
// ── 모션 ──────────────────────────────────────────────────────────────
// 학습 중 화이트리스트 안에서만 쓴다: 정답 `scale(1.03)→1` · 오답 shake 3회 · 진행률 바.
// `motion-reduce` 에서는 이동·스케일을 끄되 **색과 기호는 그대로 남는다**(5.1 — 끄기가 아니라 낮추기).

'use client'

import { useMemo, useRef, useState } from 'react'

import { track } from '@/lib/analytics/client'
import { CORPUS, DETECTOR, TRAPS } from '@/lib/csat/trap-atlas'
import { scoreDrill, type DrillAnswer, type DrillCard } from '@/lib/csat/trap-drill'
import { recordTrapAttempt } from '@/app/(main)/csat/drill/actions'

const GREEN = '#2E7D5A'
const RED = '#9C3A30'

export function TrapDrill({ cards, pool }: { cards: DrillCard[]; pool: number }) {
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [answers, setAnswers] = useState<DrillAnswer[]>([])
  // 기록이 몇 건 실패했나. 0 이 아니면 끝 화면이 그 사실을 말한다 — 조용히 넘기면 거짓말이 된다.
  const [saveFailed, setSaveFailed] = useState(0)
  const started = useRef(Date.now())

  const card = cards[idx]
  const done = idx >= cards.length
  const result = useMemo(() => scoreDrill(answers), [answers])
  const countOf = useMemo(() => new Map(TRAPS.map((t) => [t.key, t])), [])

  function choose(option: string) {
    if (picked || !card) return
    setPicked(option)
    const next = [...answers, { cardId: card.id, picked: option, answer: card.answer }]
    setAnswers(next)
    track({
      name: 'csat_drill_answered',
      props: { seq: next.length, correct: option === card.answer, options: card.options.length },
    })

    // **문제 단위로 남긴다** — 세트 끝에 몰아 쓰면 중간에 그만둔 사람이 통째로 사라지고,
    // 그 사람이야말로 훈련이 어려웠던 사람이라 가장 알아야 할 대상이다.
    //
    // ⚠️ 기다리지 않는다. 기록이 안 되는 것과 문제를 못 푸는 것은 다르므로, 쓰기가 느리거나
    //    실패해도 학습자는 다음 문제로 간다. 실패하면 화면이 한 줄로 그 사실만 말한다.
    void recordTrapAttempt({
      itemId: card.item_id,
      choice: card.choice,
      answerTrap: card.answer,
      pickedTrap: option,
    })
      .then((r) => {
        if (!r.ok) setSaveFailed((n) => n + 1)
      })
      .catch(() => setSaveFailed((n) => n + 1))
  }

  function advance() {
    if (!card) return
    const nextIdx = idx + 1
    setPicked(null)
    setIdx(nextIdx)
    if (nextIdx >= cards.length) {
      const r = scoreDrill(answers)
      track({
        name: 'csat_drill_finished',
        props: {
          total: r.total,
          correct: r.correct,
          weak: r.weak.length,
          seconds: Math.min(3600, Math.round((Date.now() - started.current) / 1000)),
        },
      })
    }
  }

  if (!cards.length) {
    // **막다른 화면을 만들지 않는다**(D5). 왜 비었는지 말하고 다음 한 걸음을 준다.
    return (
      <p className="break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4 text-sm leading-relaxed text-[var(--t2)]">
        지금은 훈련 문제를 불러오지 못했어요.{' '}
        <a className="underline decoration-[var(--bd)] underline-offset-4 hover:decoration-[var(--p)]" href="/csat">
          오답 지도에서 아홉 가지를 먼저 봐 두셔도 좋아요 →
        </a>
      </p>
    )
  }

  if (done) return <Summary result={result} cards={cards} answers={answers} saveFailed={saveFailed} />

  const right = picked === card!.answer

  return (
    <div>
      {/* 진행 — 화이트리스트 안의 진행률 바. 숫자를 크게 쓰지 않는다(Calm UI). */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <p className="tabular-nums text-xs text-[var(--t3)]">
            {idx + 1} / {cards.length}
          </p>
          <p className="break-keep text-xs text-[var(--t3)]">
            기출 해설 {pool.toLocaleString()}개에서 고른 것이에요
          </p>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--bd)]">
          <div
            className="h-full rounded-full bg-[var(--p)] transition-[width] duration-[var(--dur-normal)] ease-[var(--ease)] motion-reduce:transition-none"
            style={{ width: `${(100 * idx) / cards.length}%` }}
          />
        </div>
      </div>

      {/* `data-proof` — 계측기가 「접힌 위에 작동하는 결과가 있는가」(I1)를 셀 때 보는 표식.
          다른 화면에서는 그것이 막대였지만 여기서는 **문제 카드 자체**다: 지어낸 예시가 아니라
          코퍼스에서 꺼낸 실제 기출 분석이고, 클릭 0 으로 보이며, 바로 손댈 수 있다.
          ⚠️ 진행률 바에는 안 붙인다 — 그건 제품이 한 일이 아니라 화면의 장치다.
             표식을 넉넉히 붙이면 자가 스스로를 속인다(이 저장소가 한 번 겪었다 · 시간 띠). */}
      <article data-proof="drill-card" className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
        <p className="break-keep text-xs text-[var(--t3)]">
          {card!.exam_label} <span className="tabular-nums">{card!.no}번</span> · {card!.type_name} ·{' '}
          <span className="tabular-nums">{card!.choice}</span>번 선지
        </p>

        <p className="mt-3 break-keep text-sm leading-relaxed text-[var(--t2)]">
          <span className="text-[var(--t3)]">끌리는 이유 — </span>
          {card!.tempting}
        </p>
        <p className="mt-2 break-keep border-l-2 border-[var(--bd)] pl-3 text-sm leading-relaxed text-[var(--t1)]">
          <span className="text-[var(--t3)]">버리는 법 — </span>
          {card!.reject}
        </p>
      </article>

      <h2 className="mb-2 mt-5 break-keep font-display text-sm font-bold text-[var(--t1)]">
        이 오답은 어떤 수법인가요?
      </h2>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {card!.options.map((o) => {
          const isAnswer = o === card!.answer
          const chosen = picked === o
          // 색만으로 말하지 않는다 — 기호(✓/✗)와 테두리와 글자를 함께 낸다.
          const mark = picked ? (isAnswer ? '✓' : chosen ? '✗' : '') : ''
          return (
            <li key={o}>
              <button
                type="button"
                onClick={() => choose(o)}
                disabled={Boolean(picked)}
                aria-pressed={chosen}
                className={[
                  'flex w-full min-h-[44px] items-center gap-2 break-keep rounded-[var(--r-md)] border px-4 py-2 text-left text-sm',
                  'transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] motion-reduce:transition-none',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]',
                  picked
                    ? 'cursor-default text-[var(--t1)]'
                    : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] hover:border-[var(--p)] hover:bg-[var(--bg3)] active:bg-[var(--bd)]',
                  picked && isAnswer ? 'bg-[var(--success-light)]' : '',
                  picked && chosen && !isAnswer ? 'bg-[var(--error-light)]' : '',
                  picked && !isAnswer && !chosen ? 'border-[var(--bd)] opacity-60' : '',
                ].join(' ')}
                style={
                  picked && (isAnswer || chosen)
                    ? { borderColor: isAnswer ? GREEN : RED, color: 'var(--t1)' }
                    : undefined
                }
              >
                <span aria-hidden className="w-3 shrink-0 font-display text-sm font-bold">
                  {mark}
                </span>
                <span className="min-w-0 flex-1">{o}</span>
                {picked && isAnswer ? (
                  <span className="shrink-0 tabular-nums text-xs text-[var(--t3)]">
                    {countOf.get(o)?.n ?? 0}개
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>

      {picked ? (
        <div
          className={[
            'mt-4 rounded-[var(--r-md)] border bg-[var(--bg)] p-4',
            // 학습 중 모션 화이트리스트: 정답 scale · 오답 shake 3회(CLAUDE.md 모션 예산).
            // **새 키프레임을 만들지 않는다** — `globals.css` 의 `correct-pop`·`error-shake` 가
            // 이미 그 둘이고 SpellForge 가 쓰고 있다. 새로 만들면 같은 동작이 두 벌이 된다.
            right
              ? 'motion-safe:animate-[correct-pop_300ms_cubic-bezier(.34,1.56,.64,1)]'
              : 'motion-safe:animate-[error-shake_400ms_ease]',
          ].join(' ')}
          style={{ borderColor: right ? GREEN : RED }}
          role="status"
        >
          <p className="break-keep font-display text-sm font-bold text-[var(--t1)]">
            <span aria-hidden>{right ? '✓ ' : '· '}</span>
            {right ? '맞았어요' : `이건 「${card!.answer}」이에요`}
          </p>

          {/* 틀렸으면 **둘을 나란히** 놓는다 — 다음에 갈리는 지점이 거기다. */}
          {!right && DETECTOR[picked] ? (
            <p className="mt-2 break-keep text-sm leading-relaxed text-[var(--t2)]">
              <span className="text-[var(--t3)]">고른 「{picked}」 — </span>
              {DETECTOR[picked]}
            </p>
          ) : null}
          {DETECTOR[card!.answer] ? (
            <p className="mt-2 break-keep text-sm leading-relaxed text-[var(--t1)]">
              <span className="text-[var(--t3)]">{card!.answer} 잡는 법 — </span>
              {DETECTOR[card!.answer]}
            </p>
          ) : null}

          <p className="mt-3 break-keep text-xs leading-relaxed text-[var(--t3)]">
            이 수법은 기출 오답 {CORPUS.distractors.toLocaleString()}개 중{' '}
            <span className="tabular-nums">{countOf.get(card!.answer)?.n ?? 0}</span>개 ·{' '}
            <span className="tabular-nums">{countOf.get(card!.answer)?.types ?? 0}</span>유형에 걸쳐 나와요.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={advance}
              autoFocus
              className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--ju)] px-4 text-sm text-[var(--on-ju)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--ju-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
            >
              {idx + 1 < cards.length ? '다음 →' : '결과 보기 →'}
            </button>
            <a
              href={`/csat/item/${card!.slug}`}
              className="inline-flex min-h-[44px] items-center break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 text-sm text-[var(--t2)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
            >
              이 문항 해설 보기 →
            </a>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * 끝 화면.
 *
 * ⚠️ **여덟 문항으로 「내 함정 분포」를 그리지 않는다.** 1/1 을 「이 함정에 약하다」로 적으면
 *    학습자가 없는 결함을 고치러 간다. 두 번 보고 둘 다 틀린 것만 이름을 부르고, 나머지는
 *    「틀린 문제」로만 말한다. 분포는 기록이 쌓인 뒤의 일이다.
 */
function Summary({
  result,
  cards,
  answers,
  saveFailed,
}: {
  result: ReturnType<typeof scoreDrill>
  cards: DrillCard[]
  answers: DrillAnswer[]
  saveFailed: number
}) {
  const cardOf = new Map(cards.map((c) => [c.id, c]))
  return (
    <div>
      {/* 숫자에 말을 얹지 않는다 — 폭죽도 트로피도 없다(Calm UI · 모션 금지 목록). */}
      <p className="break-keep font-display text-lg font-bold text-[var(--t1)]">
        <span className="tabular-nums">{result.total}</span>개 중{' '}
        <span className="tabular-nums">{result.correct}</span>개를 맞혔어요
      </p>
      <p className="mt-1 break-keep font-editorial text-sm italic leading-relaxed text-[var(--t2)]">
        오늘 잘 마쳤어요. 이름을 한 번 꺼내 본 수법은 다음 지문에서 눈에 걸립니다.
      </p>

      {result.weak.length ? (
        <p className="mt-4 break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4 text-sm leading-relaxed text-[var(--t2)]">
          두 번 나왔는데 두 번 다 놓친 수법이 있어요 — <strong>{result.weak.join(' · ')}</strong>. 유형 화면에서
          이 수법이 잦은 유형부터 보시면 좋아요.
        </p>
      ) : null}

      {result.missed.length ? (
        <section className="mt-5">
          <h2 className="mb-2 font-display text-sm font-bold text-[var(--t1)]">다시 볼 것</h2>
          <ul className="space-y-2">
            {result.missed.map((m) => {
              const c = cardOf.get(m.cardId)
              if (!c) return null
              return (
                <li key={m.cardId} className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4">
                  <p className="break-keep text-sm text-[var(--t1)]">
                    <span className="text-[var(--t3)]">고른 것 </span>
                    {m.picked}
                    <span className="text-[var(--t3)]"> · 실제 </span>
                    <strong>{m.answer}</strong>
                  </p>
                  {DETECTOR[m.answer] ? (
                    <p className="mt-1.5 break-keep text-sm leading-relaxed text-[var(--t2)]">{DETECTOR[m.answer]}</p>
                  ) : null}
                  <a
                    href={`/csat/item/${c.slug}`}
                    className="mt-1 inline-flex min-h-[44px] items-center break-keep text-xs text-[var(--t3)] underline decoration-[var(--bd)] underline-offset-4 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] hover:decoration-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
                  >
                    {c.exam_label} <span className="tabular-nums">{c.no}번</span> 해설 →
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {/* 기록은 **문제마다** 남았다. 다만 실패한 건이 있으면 그것도 말한다 — 조용히 넘기면
          학습자는 다 쌓인 줄 알고, 그건 「저장되지 않아요」를 안 적는 것과 같은 종류의 거짓말이다. */}
      {saveFailed > 0 ? (
        <p className="mt-5 break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3 text-xs leading-relaxed text-[var(--t2)]">
          <span className="tabular-nums">{saveFailed}</span>문항은 기록에 남기지 못했어요 — 푼 것은 그대로
          맞습니다. 로그인이 풀렸거나 잠깐 연결이 끊긴 경우예요.
        </p>
      ) : (
        <p className="mt-5 break-keep text-xs leading-relaxed text-[var(--t3)]">
          기록은 문제마다 남았어요.{' '}
          <a
            className="underline decoration-[var(--bd)] underline-offset-4 transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:text-[var(--t1)] hover:decoration-[var(--p)] motion-reduce:transition-none"
            href="/csat"
          >
            오답 지도의 「내 기록」에서 되풀이해 걸리는 수법을 볼 수 있어요 →
          </a>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={`/csat/drill?set=${answers.length}-${Date.now().toString(36)}`}
          className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--p)] bg-[var(--ju)] px-4 text-sm text-[var(--on-ju)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:bg-[var(--ju-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
        >
          여덟 개 더 →
        </a>
        <a
          href="/csat"
          className="inline-flex min-h-[44px] items-center break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 text-sm text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] hover:bg-[var(--bg3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
        >
          오답 지도로 →
        </a>
      </div>
    </div>
  )
}

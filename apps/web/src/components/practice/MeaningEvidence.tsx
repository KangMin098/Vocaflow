// apps/web/src/components/practice/MeaningEvidence.tsx
//
// 의미 선택 채점 뒤 「본문 근거 짚기 → 해설과 나란히」(lib/learner/meaning-evidence).
// 짚은 문장은 판정하지 않는다 — 학습자가 자기 근거와 해설을 비교해 스스로 본다. 건너뛰어도 다음으로 갈 수 있다.
// 문항이 바뀌면 부모가 key 로 새로 그린다(상태가 다음 문항으로 새지 않는다).
// T-0205: 견주기 결과 안에서 「이 문장과 두 선택지의 관계 · 내 판단」을 하나 고르고 고칠 수 있다 — 학습자 자기 판단이며 채점 · 기록하지 않는다
//   (이 컴포넌트 메모리뿐 — 저장소 · 네트워크 · 채점 · 기록 · 이벤트 없음). 견줄 대상이나 짚은 문장을 다르게 바꾸면 판단만 비운다.

'use client'

import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'

const CIRCLED = ['①', '②', '③', '④', '⑤']

/** 짚은 문장과 두 선택지의 관계 — 학습자가 스스로 고르는 판단. 정답이 아니며 자동으로 맞고 틀림을 매기지 않는다 */
export const RELATIONS = [
  { key: 'mine', label: '내 답을 뒷받침해요' },
  { key: 'target', label: '견준 선택지를 뒷받침해요' },
  { key: 'both', label: '두 선택지 모두를 뒷받침해요' },
  { key: 'neither', label: '어느 쪽도 뒷받침하지 않아요' },
  { key: 'unsure', label: '아직 판단하기 어려워요' },
] as const
export type RelationKey = (typeof RELATIONS)[number]['key']
export const RELATION_NOTE = '내 판단을 표시했어요. 등록된 해설과 다시 견주어 볼 수 있어요. 이 판단은 채점하지 않아요.'

/**
 * 근거 후보가 이보다 많으면 목록 높이를 묶고 안에서 스크롤한다 — 긴 발췌(예: 274어 → 28문장)에서 목록만 1,400px 가 되어
 * 비교 결과 · 다음 행동이 화면 밖으로 밀렸다(2026-10-28 PC 실측). 문장 · 순서는 그대로, 짧은 목록은 예전 크기 그대로.
 * 안쪽 여백(p-1)은 focus 링(ring-2)이 스크롤 상자 가장자리에서 잘리지 않게 하는 자리다.
 */
const LONG_LIST = 8
const listClass = (n: number) =>
  n > LONG_LIST
    ? // [&>*]:shrink-0 — 높이를 묶은 세로 flex 는 자식을 줄여 긴 문장 단추가 44px 로 찌그러지며 글자가 넘친다
      'flex max-h-[360px] flex-col gap-1.5 overflow-y-auto overscroll-contain rounded-[var(--r-md)] border border-[var(--bd)] p-1 [&>*]:shrink-0'
    : 'flex flex-col gap-1.5'

function LongListHint({ n }: { n: number }) {
  if (n <= LONG_LIST) return null
  return (
    <p className="break-keep font-body text-[12px] text-[var(--t2)]" data-testid="meaning-evidence-scroll-hint">
      본문 문장 {n}개 — 목록 안에서 스크롤해 끝까지 볼 수 있어요.
    </p>
  )
}

export function MeaningEvidence({
  sentences,
  explanation,
  chosen,
  correct,
  stem = null,
  choices = null,
}: {
  sentences: string[]
  explanation: string | null
  /** 이 문항에 실제로 제출한 답 — 무엇의 근거를 짚는지 보여 준다 */
  chosen: { n: number; text: string } | null
  /** 서버 채점 결과(제출한 답의 정오) — 짚은 근거 문장의 판정이 아니다 */
  correct: boolean
  /** 원래 발문 — 근거 과업의 맥락(채점 뒤에만 넘어온다) */
  stem?: string | null
  /** 원래 선택지 그대로 — 다른 선택지 하나와 견줄 때만 쓴다. 새 정답 · 표현을 만들지 않는다 */
  choices?: string[] | null
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const [skipped, setSkipped] = useState(false)
  // 다른 선택지와 견주기 — 고른 대상(원래 번호 1..5)과 그 대상에 대해 짚은 문장. 대상을 바꾸면 짚은 문장은 비운다(앞 대상의 근거를 새 대상 것으로 쓰지 않는다)
  const [compareOpen, setCompareOpen] = useState(false)
  const [target, setTarget] = useState<number | null>(null)
  const [comparePicked, setComparePicked] = useState<number | null>(null)
  // 관계 판단 — 견줄 대상 · 짚은 문장이 다르게 바뀌면 비운다(같은 값을 다시 눌러도 그대로)
  const [relation, setRelation] = useState<RelationKey | null>(null)
  const others = chosen && choices ? choices.map((text, i) => ({ n: i + 1, text })).filter((c) => c.n !== chosen.n && c.text.trim()) : []
  const targetText = target != null ? choices?.[target - 1] ?? null : null
  // 건너뛴 **그 순간 한 번만** 안내로 포커스를 옮긴다 — 매 렌더 ref 콜백으로 옮기면 부모가 다시 그릴 때마다
  //   학습자가 Tab 으로 옮긴 포커스(다음 단추 등)를 빼앗았다(리뷰 P3)
  const skippedRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (skipped) skippedRef.current?.focus()
  }, [skipped])
  // T-0211 — 「다시 짚어 보기」로 같은 문항의 후보로 돌아온 **그 순간 한 번만** 근거 제목으로 초점을 옮긴다(재개 횟수가 바뀔 때만 —
  //   부모가 다시 그려도 옮기지 않는다). 짚은 문장 · 견주기 · 관계 판단은 건너뛰기 전에도 비어 있었으므로(건너뛰기는 picked 없을 때만) 그대로다.
  const [resumes, setResumes] = useState(0)
  const promptRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (resumes > 0) promptRef.current?.focus()
  }, [resumes])

  if (skipped) {
    return (
      // 건너뛰기 단추가 사라지며 포커스가 BODY 로 떨어졌다(Codex PC 실측) — 안내 문장이 포커스를 이어받는다
      <div className="flex flex-col items-start gap-2" data-testid="meaning-evidence-skipped-block">
        <p
          ref={skippedRef}
          tabIndex={-1}
          className="break-keep rounded-[var(--r-md)] font-body text-[12.5px] leading-relaxed text-[var(--t2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          data-testid="meaning-evidence-skipped"
        >
          근거 짚기는 건너뛰었어요. 다음 문항에서 다시 해 볼 수 있어요.
        </p>
        {/* T-0211 — 피드백 · 읽은 글을 보고 난 뒤 같은 문항의 후보로 돌아오는 길. 기록 · 채점 · 이벤트 없음 */}
        <button
          type="button"
          onClick={() => {
            setSkipped(false)
            setResumes((n) => n + 1)
          }}
          data-testid="meaning-evidence-resume"
          className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 font-display text-[12.5px] font-[700] text-[var(--t1)] hover:border-[var(--p)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          다시 짚어 보기
        </button>
      </div>
    )
  }

  return (
    <section aria-label="본문 근거 짚기" className="flex flex-col gap-3" data-testid="meaning-evidence">
      {stem && (
        <p className="break-keep font-display text-[12.5px] font-[700] text-[var(--t2)]" data-testid="meaning-evidence-stem">
          질문 · {stem}
        </p>
      )}
      {chosen && (
        <p className="break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-body text-[12.5px] text-[var(--t2)]" data-testid="meaning-evidence-chosen">
          {correct ? '내가 고른 답(정답)' : '내가 고른 답(정답과 다름)'} · <span className="font-english text-[var(--t1)]">{CIRCLED[chosen.n - 1] ?? chosen.n} {chosen.text}</span>
        </p>
      )}
      <div>
        <p ref={promptRef} tabIndex={-1} className="break-keep rounded-[var(--r-md)] font-display text-[13px] font-[700] text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]" data-testid="meaning-evidence-prompt">
          {correct ? '이 답을 받치는 본문 문장을 하나 짚어 보세요' : '정답을 받치는 본문 문장을 하나 짚어 보세요'}
        </p>
        <p className="break-keep font-body text-[12px] leading-relaxed text-[var(--t2)]">정답 확인이 아니라 연습이에요 — 근거가 되는 문장은 여러 개일 수 있어요.</p>
      </div>
      <LongListHint n={sentences.length} />
      <div role="group" aria-label="근거 문장 후보" className={listClass(sentences.length)} data-testid="meaning-evidence-list">
        {sentences.map((s, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={picked === i}
            onClick={() => setPicked(i)}
            className="min-h-[44px] rounded-[var(--r-md)] border px-3 py-2 text-left font-english text-[13.5px] leading-relaxed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            style={
              picked === i
                ? { borderColor: 'var(--p)', background: 'var(--p-light)', color: 'var(--t1)' }
                : { borderColor: 'var(--bd)', background: 'var(--bg)', color: 'var(--t2)' }
            }
          >
            {s}
          </button>
        ))}
      </div>
      {picked === null ? (
        <button
          type="button"
          onClick={() => setSkipped(true)}
          data-testid="meaning-evidence-skip"
          className="inline-flex min-h-[44px] items-center self-start rounded-[var(--r-md)] px-3 font-display text-[12.5px] font-[700] text-[var(--t2)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        >
          아직 찾기 어려워요 · 건너뛰기
        </button>
      ) : (
        <div className="grid gap-3 md:grid-cols-2" data-testid="meaning-evidence-compare" aria-live="polite">
          <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3">
            <p className="mb-1 font-display text-[11.5px] font-[700] text-[var(--t2)]">내가 짚은 문장</p>
            <p className="font-english text-[13.5px] leading-relaxed text-[var(--t1)]">{sentences[picked]}</p>
          </div>
          <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3">
            <p className="mb-1 font-display text-[11.5px] font-[700] text-[var(--t2)]">해설</p>
            {explanation ? (
              <p className="break-keep font-body text-[13px] leading-relaxed text-[var(--t1)]">{explanation}</p>
            ) : (
              <p className="break-keep font-body text-[12.5px] text-[var(--t2)]" data-testid="meaning-evidence-no-explanation">
                이 문항에는 등록된 해설이 없어요.
              </p>
            )}
          </div>
          <p className="break-keep font-body text-[12px] leading-relaxed text-[var(--t2)] md:col-span-2">
            해설이 말하는 근거와 내가 짚은 문장이 같은 내용을 가리키는지 견주어 보세요. 다른 문장을 다시 짚어도 돼요.
          </p>
        </div>
      )}
      {others.length > 0 && chosen && (
        <div className="flex flex-col gap-2 border-t border-[var(--bd)] pt-3" data-testid="meaning-compare">
          <button
            type="button"
            aria-expanded={compareOpen}
            onClick={() => setCompareOpen((o) => !o)}
            data-testid="meaning-compare-toggle"
            className="inline-flex min-h-[44px] items-center self-start rounded-[var(--r-md)] px-3 font-display text-[12.5px] font-[700] text-[var(--t1)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            {compareOpen ? '다른 선택지와 견주기 접기' : '다른 선택지 하나와 견주어 보기 (선택)'}
          </button>
          {compareOpen && (
            <>
              <div role="group" aria-label="견줄 선택지" className="flex flex-col gap-1.5">
                {others.map((c) => (
                  <button
                    key={c.n}
                    type="button"
                    aria-pressed={target === c.n}
                    onClick={() => {
                      if (target !== c.n) {
                        setComparePicked(null)
                        setRelation(null)
                      }
                      setTarget(c.n)
                    }}
                    className="min-h-[44px] rounded-[var(--r-md)] border px-3 py-2 text-left font-english text-[13px] leading-relaxed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                    style={
                      target === c.n
                        ? { borderColor: 'var(--p)', background: 'var(--p-light)', color: 'var(--t1)' }
                        : { borderColor: 'var(--bd)', background: 'var(--bg)', color: 'var(--t2)' }
                    }
                  >
                    {CIRCLED[c.n - 1] ?? c.n} {c.text}
                  </button>
                ))}
              </div>
              {target != null && targetText && (
                <div className="flex flex-col gap-2" data-testid="meaning-compare-task">
                  <p className="break-keep font-display text-[13px] font-[700] text-[var(--t1)]">
                    내 답과 이 선택지가 갈리는 본문 문장을 하나 짚어 보세요
                  </p>
                  <LongListHint n={sentences.length} />
                  <div role="group" aria-label="견주기 근거 문장 후보" className={listClass(sentences.length)} data-testid="meaning-compare-list">
                    {sentences.map((sent, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={comparePicked === i}
                        onClick={() => {
                          if (comparePicked !== i) setRelation(null)
                          setComparePicked(i)
                        }}
                        className="min-h-[44px] rounded-[var(--r-md)] border px-3 py-2 text-left font-english text-[13.5px] leading-relaxed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                        style={
                          comparePicked === i
                            ? { borderColor: 'var(--p)', background: 'var(--p-light)', color: 'var(--t1)' }
                            : { borderColor: 'var(--bd)', background: 'var(--bg)', color: 'var(--t2)' }
                        }
                      >
                        {sent}
                      </button>
                    ))}
                  </div>
                  {comparePicked != null && (
                    <div className="grid gap-3 md:grid-cols-2" data-testid="meaning-compare-result" aria-live="polite">
                      <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3">
                        <p className="mb-1 font-display text-[11.5px] font-[700] text-[var(--t2)]">견준 두 선택지</p>
                        <p className="font-english text-[13px] leading-relaxed text-[var(--t1)]">
                          내 답 {CIRCLED[chosen.n - 1] ?? chosen.n} {chosen.text}
                        </p>
                        <p className="font-english text-[13px] leading-relaxed text-[var(--t1)]">
                          견준 선택지 {CIRCLED[target - 1] ?? target} {targetText}
                        </p>
                        <p className="mt-2 mb-1 font-display text-[11.5px] font-[700] text-[var(--t2)]">내가 짚은 문장</p>
                        <p className="font-english text-[13.5px] leading-relaxed text-[var(--t1)]">{sentences[comparePicked]}</p>
                      </div>
                      <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3">
                        <p className="mb-1 font-display text-[11.5px] font-[700] text-[var(--t2)]">해설</p>
                        {explanation ? (
                          <p className="break-keep font-body text-[13px] leading-relaxed text-[var(--t1)]">{explanation}</p>
                        ) : (
                          <p className="break-keep font-body text-[12.5px] text-[var(--t2)]">이 문항에는 등록된 해설이 없어요.</p>
                        )}
                      </div>
                      <p className="break-keep font-body text-[12px] leading-relaxed text-[var(--t2)] md:col-span-2">
                        짚은 문장이 두 선택지 중 어느 쪽을 받치는지, 해설과 견주어 스스로 보세요. 판정하지 않아요 — 다른 선택지를 골라 다시 견주어도 돼요.
                      </p>
                      <div className="flex flex-col gap-2 md:col-span-2" data-testid="meaning-relation">
                        <p id="meaning-relation-label" className="break-keep font-display text-[12.5px] font-[700] text-[var(--t1)]">
                          이 문장과 두 선택지의 관계 · 내 판단 <span className="font-body text-[12px] font-[500] text-[var(--t2)]">(선택 — 고르지 않아도 다음으로 갈 수 있어요)</span>
                        </p>
                        <div role="group" aria-labelledby="meaning-relation-label" className="flex flex-wrap gap-1.5">
                          {RELATIONS.map((r) => (
                            <button
                              key={r.key}
                              type="button"
                              aria-pressed={relation === r.key}
                              data-relation={r.key}
                              onClick={() => setRelation(r.key)}
                              className="min-h-[44px] rounded-[var(--r-md)] border px-3 py-2 text-left font-body text-[12.5px] leading-snug transition-colors break-keep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
                              style={
                                relation === r.key
                                  ? { borderColor: 'var(--p)', background: 'var(--p-light)', color: 'var(--t1)' }
                                  : { borderColor: 'var(--bd)', background: 'var(--bg)', color: 'var(--t2)' }
                              }
                            >
                              {/* 고른 판단은 색만이 아니라 체크 표지로도 보인다(aria-pressed 가 읽기 상태를 맡는다) */}
                              {relation === r.key && <Check size={13} strokeWidth={2.5} aria-hidden className="mr-1.5 inline-block align-[-2px]" data-relation-mark />}
                              {r.label}
                            </button>
                          ))}
                        </div>
                        {relation && (
                          <p role="status" className="break-keep font-body text-[12px] leading-relaxed text-[var(--t2)]" data-testid="meaning-relation-note">
                            {RELATION_NOTE}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

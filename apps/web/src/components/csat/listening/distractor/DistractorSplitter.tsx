// apps/web/src/components/csat/listening/distractor/DistractorSplitter.tsx
//
// I6 부분 일치 오답 도구. 학습자가 먼저 선지를 조각으로 자르고 각 조각을 「들은 부분 / 들리지 않은·틀린 부분」으로
// 표시하고 들은 조각을 발화에 잇는다 → 확정 뒤에만 분석과 맞대어 본다. 분석의 근거·함정 유형은 노출 단계(L4+)가
// 열려 있을 때만, 정답 여부는 L5 에서만 보인다. 점수·숙달 산입 없음.
'use client'

import { useMemo, useState } from 'react'

import type { ChoiceNo, ListeningItem } from '@/lib/csat/listening/types'
import { exposureView, type ExposureContext, type ExposureLevel } from '@/lib/csat/listening/exposure'
import {
  analyzeChoice,
  choiceWords,
  compareJudgment,
  judgmentComplete,
  segmentsFromCuts,
  type DistractorJudgment,
  type JudgedSegment,
  type SegmentLabel,
} from '@/lib/csat/listening/distractor'
import type { DistractorPattern } from '@/lib/csat/listening/pedagogy'

export const PATTERN_LABELS: Readonly<Record<DistractorPattern, string>> = {
  'partial-match': '부분 일치',
  'mentioned-not-asked': '언급됐지만 묻지 않음',
  'role-reversal': '역할 뒤바꿈',
  'timing-trap': '시점·순서 함정',
  'numeric-calc-trap': '수치·계산 함정',
}

export interface DistractorSplitterProps {
  item: ListeningItem
  exposureLevel: ExposureLevel
  /** 제출 여부 + Reveal Gate 판정. 생략하면 닫힘(fail-closed) */
  exposureContext?: ExposureContext
  /** 학습자가 판단을 확정할 때 한 번 */
  onJudge?: (judgment: DistractorJudgment) => void
  /** 선지가 공식 선지가 아닌 테스트용 합성일 때 true — 화면에 표지를 띄운다 */
  choicesAreSynthetic?: boolean
  /** 복원용 초기 상태 */
  initial?: { judgment: DistractorJudgment; committed?: boolean }
}

const BTN =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-[var(--r-md)] border px-3 text-[15px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ju)] disabled:cursor-not-allowed disabled:opacity-50'
const ON = 'border-[var(--t1)] bg-[var(--bg3)] font-semibold text-[var(--t1)]'
const OFF = 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)]'

const CLOSED: ExposureContext = { submitted: false, reveal: null }

function cutsOf(segments: readonly JudgedSegment[]): number[] {
  return segments.slice(0, -1).map((s) => s.wordEnd)
}

export function DistractorSplitter({ item, exposureLevel, exposureContext = CLOSED, onJudge, choicesAreSynthetic = false, initial }: DistractorSplitterProps) {
  const [choice, setChoice] = useState<ChoiceNo>(initial?.judgment.choice ?? 1)
  const words = useMemo(() => choiceWords(item.choices[choice - 1] ?? ''), [item.choices, choice])
  const [segments, setSegments] = useState<JudgedSegment[]>(() => initial?.judgment.segments ?? segmentsFromCuts(words.length, []))
  const [committed, setCommitted] = useState(initial?.committed ?? false)
  const view = exposureView(exposureLevel, exposureContext)
  const judgment: DistractorJudgment = { choice, segments }
  const complete = judgmentComplete(judgment)
  const uttLabel = (id: string) => {
    const i = item.utterances.findIndex((u) => u.id === id)
    const u = item.utterances[i]
    return u ? `${i + 1}번 줄 · ${u.speaker}` : id
  }

  const pickChoice = (c: ChoiceNo) => {
    if (committed) return
    setChoice(c)
    setSegments(segmentsFromCuts(choiceWords(item.choices[c - 1] ?? '').length, []))
  }
  const toggleCut = (i: number) => {
    if (committed) return
    const cuts = cutsOf(segments)
    const next = cuts.includes(i) ? cuts.filter((c) => c !== i) : [...cuts, i]
    setSegments(segmentsFromCuts(words.length, next, segments))
  }
  const patch = (idx: number, p: Partial<JudgedSegment>) => {
    if (committed) return
    setSegments((s) => s.map((x, i) => (i === idx ? { ...x, ...p, ...(p.label === 'unheard' ? { utteranceId: null } : {}) } : x)))
  }
  const commit = () => {
    if (!complete || committed) return
    setCommitted(true)
    onJudge?.(judgment)
  }

  const analysis = committed ? analyzeChoice(item, choice) : null
  const comparison = analysis ? compareJudgment(judgment, analysis) : []
  const cuts = new Set(cutsOf(segments))

  return (
    <section aria-labelledby="dx-title" data-testid="distractor-splitter" className="flex flex-col gap-4 text-[var(--t1)]">
      <h3 id="dx-title" className="break-keep text-[17px] font-semibold">
        선지에서 들은 부분과 들리지 않은·틀린 부분 가르기
      </h3>
      {choicesAreSynthetic && (
        <p data-testid="synthetic-choices" className="break-keep rounded-[var(--r-md)] border border-dashed border-[var(--bd)] px-3 py-2 text-[14px]">
          ⚠ 테스트용 합성 선택지 — 공식 선지가 아닙니다.
        </p>
      )}

      <div role="group" aria-label="살펴볼 선지" className="flex flex-wrap gap-2">
        {item.choices.map((_, i) => {
          const c = (i + 1) as ChoiceNo
          return (
            <button key={c} type="button" className={`${BTN} ${c === choice ? ON : OFF}`} aria-pressed={c === choice} disabled={committed && c !== choice} onClick={() => pickChoice(c)}>
              선지 {c}
            </button>
          )
        })}
      </div>

      <div>
        <p className="break-keep text-[14px] text-[var(--t2)]">① 낱말 사이 칸을 눌러 선지를 조각으로 자르세요.</p>
        <p data-testid="choice-words" className="mt-2 flex flex-wrap items-center gap-y-2 text-[17px]">
          {words.map((w, i) => (
            <span key={i} className="inline-flex items-center">
              <span className="px-1">{w.text}</span>
              {i < words.length - 1 && (
                <button
                  type="button"
                  className={`${BTN} px-1 ${cuts.has(i) ? ON : OFF}`}
                  aria-pressed={cuts.has(i)}
                  aria-label={`${w.text} 뒤에서 ${cuts.has(i) ? '자르기 취소' : '자르기'}`}
                  disabled={committed}
                  onClick={() => toggleCut(i)}
                >
                  {cuts.has(i) ? '✂' : '·'}
                </button>
              )}
            </span>
          ))}
        </p>
      </div>

      <ol aria-label="조각 판단" className="flex flex-col gap-3">
        {segments.map((s, idx) => {
          const text = words.slice(s.wordStart, s.wordEnd + 1).map((w) => w.text).join(' ')
          const setLabel = (label: SegmentLabel) => patch(idx, { label })
          return (
            <li key={`${s.wordStart}-${s.wordEnd}`} data-testid="segment" className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] p-3">
              <span className="text-[16px]">
                조각 {idx + 1}: “{text}”
              </span>
              <div role="group" aria-label={`조각 ${idx + 1} 표시`} className="flex flex-wrap gap-2">
                <button type="button" className={`${BTN} ${s.label === 'heard' ? ON : OFF}`} aria-pressed={s.label === 'heard'} disabled={committed} onClick={() => setLabel('heard')}>
                  {s.label === 'heard' ? '✓ ' : ''}들은 부분
                </button>
                <button type="button" className={`${BTN} ${s.label === 'unheard' ? ON : OFF}`} aria-pressed={s.label === 'unheard'} disabled={committed} onClick={() => setLabel('unheard')}>
                  {s.label === 'unheard' ? '✓ ' : ''}들리지 않은·틀린 부분
                </button>
              </div>
              {s.label === 'heard' && (
                <label className="flex flex-wrap items-center gap-2 text-[14px]">
                  <span className="break-keep">어느 발화에서 들었나요?</span>
                  <select
                    className="min-h-[44px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ju)]"
                    value={s.utteranceId ?? ''}
                    disabled={committed}
                    onChange={(e) => patch(idx, { utteranceId: e.target.value || null })}
                  >
                    <option value="">발화 고르기</option>
                    {item.utterances.map((u) => (
                      <option key={u.id} value={u.id}>
                        {uttLabel(u.id)} — {u.text.length > 60 ? `${u.text.slice(0, 60)}…` : u.text}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </li>
          )
        })}
      </ol>

      {!committed && (
        <div>
          <button type="button" className={`${BTN} ${ON}`} disabled={!complete} onClick={commit} data-testid="commit-judgment">
            판단 확정하고 분석과 맞대기
          </button>
          {!complete && <p className="mt-1 break-keep text-[13px] text-[var(--t2)]">모든 조각을 표시하고, 들은 조각은 발화를 골라야 확정할 수 있어요.</p>}
        </div>
      )}

      {analysis && (
        <div data-testid="distractor-analysis" aria-live="polite" className="flex flex-col gap-3 border-t border-[var(--bd)] pt-3">
          <h4 className="text-[16px] font-semibold">내 판단과 글자 겹침 비교</h4>
          {view.transcript ? (
            <ul className="flex flex-col gap-2">
              {comparison.map((c, i) => (
                <li key={i} data-testid="segment-compare" className="break-keep text-[15px]">
                  <span lang="en">“{c.text}”</span> — 내 표시: {c.segment.label === 'heard' ? '들은 부분' : '들리지 않은·틀린 부분'} · 글자 겹침:{' '}
                  {c.analysisHeard === null ? '내용어 없음' : c.analysisHeard ? `들림(${c.analysisUtteranceIds.map(uttLabel).join(', ')})` : '들리지 않음'}
                  {c.labelAgrees !== null && <strong> · {c.labelAgrees ? '같음' : '다름'}</strong>}
                  {c.linkAgrees !== null && <span> · 연결한 발화 {c.linkAgrees ? '같음' : '다름'}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="break-keep text-[14px]">대본 단계(L1)부터 글자 겹침을 볼 수 있어요.</p>
          )}

          {view.rationales ? (
            <div data-testid="distractor-rationale" className="flex flex-col gap-1 text-[15px]">
              <p className="break-keep">
                함정 유형: <strong>{analysis.pattern ? PATTERN_LABELS[analysis.pattern] : '해당 없음'}</strong>
                {analysis.patternReason && ` — ${analysis.patternReason}`}
                {analysis.pattern && !analysis.patternExpected && ' (이 유형 교수 설계 밖의 함정)'}
              </p>
              {analysis.conflicts.length > 0 && (
                <ul aria-label="반박 근거" className="flex flex-col gap-1">
                  {analysis.conflicts.map((c) => (
                    <li key={c.evidenceId} className="break-keep">
                      {c.kind === 'refutes' ? '반박' : '대조'} · {uttLabel(c.utteranceId)}: <span lang="en">“{c.text}”</span>
                    </li>
                  ))}
                </ul>
              )}
              {analysis.unasked && <p className="break-keep">{analysis.unasked === 'mentioned-not-asked' ? '대화에 나왔지만 질문이 묻는 대상이 아닙니다.' : '대화에 나오지 않은 내용입니다.'}</p>}
              {view.answer && <p className="break-keep">이 선지는 {analysis.isAnswer ? '정답입니다' : '정답이 아닙니다'}.</p>}
            </div>
          ) : (
            <p data-testid="rationale-locked" className="break-keep text-[14px] text-[var(--t2)]">
              🔒 반박 근거와 함정 유형은 문항을 제출하고 공개 판정이 열린 뒤(L4)에 볼 수 있어요.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

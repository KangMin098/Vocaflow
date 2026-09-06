// apps/web/src/components/library/vocab/VocabSpreadSheet.tsx
//
// **지면 — 시중 단어장을 펼쳤을 때 나오는 것을 화면에 옮긴다.**
//
// ── 왜 이 컴포넌트가 생겼나 (실측 2026-09-06) ───────────────────────
// 단어장은 내용 지수 1.635 · 선택 지수 1.288 로 이기고 있었는데 **지면 지수는 0.102** 였다.
// 세트를 열면 낱말과 뜻만 나왔다 — 시중 지면이 매 쪽에 싣는 장치 17종 중 1.5개.
// 재료는 `shared_dictionary` 에 다 있었고, 없던 것은 그것을 앉히는 자리였다.
//
// 조판은 **여기서 하지 않는다** — `@vocaflow/library-pipeline/vocab-typeset` 이 한다.
// 이 파일은 조판된 것을 그리기만 한다. 그래야 「파이프라인이 만든 지면」이 되고,
// 발행물을 다시 낼 때 같은 규칙이 다시 돌아간다.
//
// ── 디자인 ─────────────────────────────────────────────────────────
// Calm UI — 지면은 정보 밀도가 높으므로 **색을 늘리지 않는다.** 위계는 굵기와 여백으로만
// 만들고, 강조색은 액센트 하나(`--p`)만 쓴다. 모든 값은 CSS 변수라 다크 테마가 따라온다.

'use client'

import { useEffect, useState } from 'react'
import { BookOpen, CalendarDays, ListOrdered, RotateCcw } from 'lucide-react'

/** 라우트가 내려 주는 모양 — `api/vocab/[setId]/spread` 와 짝이다. */
interface SpreadSense {
  n: number | null
  pos: string | null
  meaning: string
  exampleEn: string | null
  exampleKo: string | null
}
interface SpreadEntry {
  no: string
  word: string
  ipa: string | null
  senses: SpreadSense[]
  derived: string[]
  inflections: string[]
  synonyms: string[]
  antonyms: string[]
  collocations: string[]
  note: string | null
  crossRefs: Array<{ word: string; day: number }>
  day: number
}
interface SpreadDay {
  n: number
  label: string
  entries: SpreadEntry[]
  test: { meaning: Array<{ n: number; word: string }>; cloze: Array<{ n: number; sentence: string; answer: string }> }
  passes: number
}
interface SpreadPart {
  label: string
  principle: string | null
  days: SpreadDay[]
}
export interface VocabSpreadData {
  title: string
  studyPlan: { days: number; perDay: number; dayLabels: string[] }
  parts: SpreadPart[]
  reviews: Array<{ label: string; coversDays: number[]; items: Array<{ n: number; word: string }> }>
  indexSize: number
  indexHead: Array<{ word: string; day: number }>
  apparatus: string[]
  previewDays: number
  truncated: boolean
}

const Kicker = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 inline-flex items-center gap-2 font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t2)]">
    {children}
  </p>
)

export function VocabSpreadSheet({ setId }: { setId: string }) {
  const [data, setData] = useState<VocabSpreadData | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'none'>('loading')

  useEffect(() => {
    let alive = true
    setState('loading')
    fetch(`/api/vocab/${setId}/spread`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: VocabSpreadData | null) => {
        if (!alive) return
        if (!j || j.parts.length === 0) { setState('none'); return }
        setData(j)
        setState('ready')
      })
      .catch(() => { if (alive) setState('none') })
    return () => { alive = false }
  }, [setId])

  if (state === 'loading') {
    return (
      <div className="rounded-[var(--r-md)] border border-[var(--bd)] px-4 py-6 text-center font-body text-[13px] text-[var(--t3)]">
        지면을 여는 중…
      </div>
    )
  }
  /*
    지면을 못 만들면 **아무것도 그리지 않는다.** 빈 칸을 그려 두면 "칸은 있는데 늘 비어 있다"
    가 되어 지면 지수가 스스로를 속인다(조판기가 `apparatus` 를 채워진 것만 세는 것과 같은 규칙).
  */
  if (state === 'none' || !data) return null

  const days = data.parts.flatMap((p) => p.days)

  return (
    <div className="flex flex-col gap-5">
      {/* 학습 계획 — 며칠이면 끝나는가 */}
      <section aria-label="학습 계획">
        <Kicker><CalendarDays size={11} aria-hidden /> 학습 계획</Kicker>
        <div className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]/40 px-4 py-3">
          <p className="font-body text-[13px] text-[var(--t2)]">
            하루 <b className="text-[var(--t1)]">{data.studyPlan.perDay}</b>개 ·{' '}
            <b className="text-[var(--t1)]">{data.studyPlan.days}</b>일 완성
            {data.truncated && <span className="text-[var(--t3)]"> (지면 미리보기는 앞부분만)</span>}
          </p>
          <ol className="mt-2 flex flex-wrap gap-1">
            {data.studyPlan.dayLabels.slice(0, 20).map((l) => (
              <li
                key={l}
                className="rounded-[var(--r-sm)] border border-[var(--bd)] px-2 py-0.5 font-mono text-[10px] text-[var(--t3)]"
              >
                {l}
              </li>
            ))}
            {data.studyPlan.dayLabels.length > 20 && (
              <li className="px-2 py-0.5 font-mono text-[10px] text-[var(--t3)]">
                …{data.studyPlan.dayLabels.length - 20}
              </li>
            )}
          </ol>
        </div>
      </section>

      {/* 지면 — PART / DAY / 표제어 칸 */}
      {data.parts.map((part) => (
        <section key={part.label} aria-label={`${part.label} 지면`}>
          <Kicker><BookOpen size={11} aria-hidden /> {part.label}</Kicker>
          {part.principle && (
            <p className="mb-3 font-body text-[12px] italic leading-relaxed text-[var(--t3)]">
              <b className="not-italic">묶음 원리</b> — {part.principle}
            </p>
          )}

          {part.days.map((day) => (
            <div key={day.n} className="mb-4">
              {/* 러닝헤드 — 스크롤해도 지금 어느 날인지 남는다 */}
              <div className="sticky top-0 z-[1] -mx-1 mb-2 flex items-center justify-between bg-[var(--bg)] px-1 py-1.5">
                <h3 className="font-mono text-[11px] font-[700] tracking-[0.14em] text-[var(--t2)]">
                  {day.label}
                </h3>
                {/* 회독 칸 — 시중 지면의 체크박스 자리 */}
                <span className="flex items-center gap-1" aria-label={`회독 ${day.passes}칸`}>
                  {Array.from({ length: day.passes }, (_, i) => (
                    <span
                      key={i}
                      className="inline-block h-3 w-3 rounded-[3px] border border-[var(--bd)]"
                      aria-hidden
                    />
                  ))}
                  <span className="ml-1 font-body text-[10px] text-[var(--t3)]">회독</span>
                </span>
              </div>

              <ul className="flex flex-col divide-y divide-[var(--bd)]">
                {day.entries.map((e) => (
                  <li key={e.no} className="py-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[10px] text-[var(--t3)]">{e.no}</span>
                      <span className="font-english text-[16px] font-[700] text-[var(--t1)]">{e.word}</span>
                      {e.ipa && <span className="font-mono text-[11px] text-[var(--t3)]">{e.ipa}</span>}
                      {e.inflections.length > 0 && (
                        <span className="font-mono text-[10px] text-[var(--t3)]">
                          ({e.inflections.slice(0, 3).join('–')})
                        </span>
                      )}
                    </div>

                    <ol className="mt-1 flex flex-col gap-1.5">
                      {e.senses.map((s, i) => (
                        <li key={i} className="font-body text-[13px] leading-relaxed text-[var(--t2)]">
                          {s.n != null && <span className="mr-1 font-mono text-[11px] text-[var(--t3)]">{s.n}.{' '}</span>}
                          {s.pos && (
                            <span className="mr-1 rounded-[3px] bg-[var(--bg3)] px-1 font-body text-[10px] text-[var(--t2)]">
                              {s.pos}
                            </span>
                          )}
                          {s.pos && ' '}
                          <span className="text-[var(--t1)]">{s.meaning}</span>
                          {s.exampleEn && (
                            <span className="mt-0.5 block font-english text-[12.5px] text-[var(--t2)]">
                              {s.exampleEn}
                            </span>
                          )}
                          {s.exampleKo && (
                            <span className="block font-body text-[12px] text-[var(--t3)]">{s.exampleKo}</span>
                          )}
                        </li>
                      ))}
                    </ol>

                    {(e.derived.length > 0 || e.collocations.length > 0 || e.crossRefs.length > 0) && (
                      <div className="mt-1.5 flex flex-col gap-0.5">
                        {e.derived.length > 0 && (
                          <p className="font-body text-[11.5px] text-[var(--t3)]">
                            <span className="mr-1 font-[600]">파생</span>
                            <span className="font-english">{e.derived.slice(0, 5).join(' · ')}</span>
                          </p>
                        )}
                        {e.collocations.length > 0 && (
                          <p className="font-body text-[11.5px] text-[var(--t3)]">
                            <span className="mr-1 font-[600]">연어</span>
                            <span className="font-english">{e.collocations.slice(0, 3).join(' · ')}</span>
                          </p>
                        )}
                        {e.crossRefs.length > 0 && (
                          <p className="font-body text-[11.5px] text-[var(--t3)]">
                            {e.crossRefs.slice(0, 3).map((r) => (
                              <span key={r.word} className="mr-2">
                                → <span className="font-english">{r.word}</span> (DAY{' '}
                                {String(r.day).padStart(2, '0')})
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    )}

                    {e.note && (
                      <p className="mt-1.5 border-l-[3px] border-[var(--p)] bg-[var(--bg2)] px-3 py-1.5 font-body text-[11.5px] leading-relaxed text-[var(--t2)]">
                        <b className="mr-1">어법</b>
                        {e.note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              {/* DAY 끝 테스트 — 그날치를 바로 확인하는 자리 */}
              {day.test.meaning.length > 0 && (
                <div className="mt-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)]/40 px-4 py-3">
                  <p className="mb-1.5 font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t2)]">
                    DAILY TEST
                  </p>
                  <p className="font-body text-[12px] text-[var(--t3)]">
                    뜻 쓰기 {day.test.meaning.length}문항
                    {day.test.cloze.length > 0 && ` · 빈칸 ${day.test.cloze.length}문항`}
                  </p>
                  {day.test.cloze[0] && (
                    <p className="mt-1.5 font-english text-[12.5px] text-[var(--t2)]">
                      01 {day.test.cloze[0].sentence}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      ))}

      {/* 누적 복습 */}
      {data.reviews.length > 0 && (
        <section aria-label="누적 복습">
          <Kicker><RotateCcw size={11} aria-hidden /> 누적 복습</Kicker>
          <ul className="flex flex-col gap-1">
            {data.reviews.map((r) => (
              <li key={r.label} className="font-body text-[12.5px] text-[var(--t2)]">
                {r.label} · {r.items.length}낱말
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 색인 */}
      {data.indexSize > 0 && (
        <section aria-label="색인">
          <Kicker><ListOrdered size={11} aria-hidden /> 색인 (전체 {data.indexSize}개)</Kicker>
          <p className="font-english text-[12px] leading-relaxed text-[var(--t3)]">
            {data.indexHead.map((x) => `${x.word} ${String(x.day).padStart(2, '0')}`).join(' · ')}
            {data.indexSize > data.indexHead.length && ' …'}
          </p>
        </section>
      )}

      <p className="font-body text-[11px] text-[var(--t3)]">
        지면 미리보기는 앞 {data.previewDays}일치입니다 — 나머지 {Math.max(0, data.studyPlan.days - data.previewDays)}일치는
        추가 후 학습 모듈에서 이어집니다.
      </p>

      {days.length === 0 && null}
    </div>
  )
}

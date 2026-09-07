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
import { BookOpen, CalendarDays, Info, ListOrdered, RotateCcw } from 'lucide-react'

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
  test: {
    meaning: Array<{ n: number; word: string }>
    cloze: Array<{ n: number; sentence: string; answer: string }>
  }
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
  /** 설명 지면 — 시중 교재의 머리말 + FEATURES 자리. 조판기가 만든다. */
  guide: {
    question: string
    claims: Array<{ n: number; key: string; label: string; body: string; evidence: string }>
    features: Array<{ n: number; id: string; label: string; says: string }>
    sampleWord: string | null
  } | null
  colophon: {
    brand: string
    title: string
    ladder: string
    edition: string
    issued: string
    selection: string
    volume: string
    sourcePolicy: string
    review: string
    /** 시중 ISBN 자리. slug 가 없는 세트는 null — 지어낸 번호는 인용할 수 없다. */
    imprintCode: string | null
    /** 일곱 계단 중 이 권의 자리. `[5]` 처럼 대괄호가 선 칸이 지금 권이다. */
    ladderStrip: string[]
    ladderStep: number | null
    targetLevel: string
  } | null
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
        if (!j || j.parts.length === 0) {
          setState('none')
          return
        }
        setData(j)
        setState('ready')
      })
      .catch(() => {
        if (alive) setState('none')
      })
    return () => {
      alive = false
    }
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
  /*
    콜아웃이 가리킬 **진짜 표제어 칸.** 조판기가 `sampleWord` 로 이름만 알려 주므로,
    그림을 그리려면 항목 자체가 필요하다 — 앞 2일치에 늘 들어 있는 첫 항목을 쓴다.
  */
  const sampleEntry = days[0]?.entries[0] ?? null

  return (
    <div className="flex flex-col gap-5">
      {/*
        설명 지면 — 시중 어휘 교재가 본문 앞에 반드시 두는 것(실측 4권 모두 p2·p5).
        머리말(왜 이 책인가)과 FEATURES(각 칸이 무엇인지)를 한 자리에 합쳤다.

        **주장마다 근거 수치가 붙는다** — 조판기가 없는 주장은 아예 만들지 않으므로
        여기서 빈 값을 거를 필요가 없다. 시중 머리말이 "난이도를 일정하게 배분했습니다" 로
        끝나는 자리에 우리는 센 값을 적는다.
      */}
      {data.guide && data.guide.claims.length > 0 && (
        <section aria-label="이 단어장의 구성">
          <Kicker>
            <Info size={11} aria-hidden /> {data.guide.question}
          </Kicker>
          <ol className="flex flex-col gap-2.5">
            {data.guide.claims.map((c) => (
              <li key={c.n} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2">
                <span className="font-mono text-[11px] text-[var(--t3)]">{c.n}</span>
                <div>
                  <p className="font-body text-[13px] text-[var(--t1)]">
                    <span className="font-display font-[700]">{c.key}</span>
                    <span className="mx-1.5 text-[var(--t3)]">·</span>
                    {c.label}
                    <span className="ml-2 rounded-[3px] bg-[var(--bg3)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--t2)]">
                      {c.evidence}
                    </span>
                  </p>
                  <p className="mt-0.5 font-body text-[12px] leading-relaxed text-[var(--t3)]">
                    {c.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {/* FEATURES — 지면의 어느 자리가 무엇인지. 이 권이 실제로 채운 칸만 가리킨다. */}
          {data.guide.features.length > 0 && (
            <div className="bg-[var(--bg2)]/40 mt-4 rounded-[var(--r-md)] border border-[var(--bd)] px-4 py-3">
              <p className="mb-2 font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t2)]">
                지면 보는 법
              </p>

              {/*
                시중 교재의 FEATURES 는 **실제 지면에 번호를 찍는다** — 목록만 주면 학습자가
                그 칸이 어디인지 눈으로 못 찾는다. 그래서 이 권의 **첫 표제어 칸**을 그대로
                한 번 더 그리고 그 위에 번호를 얹는다(지어낸 예가 아니라 진짜 항목이다).
              */}
              {sampleEntry && <FeatureCallout entry={sampleEntry} features={data.guide.features} />}

              <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {data.guide.features.map((f) => (
                  <li key={f.n} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2">
                    <span
                      aria-hidden
                      className="mt-[1px] inline-flex h-[16px] w-[16px] items-center justify-center rounded-full border border-[var(--bd)] font-mono text-[9.5px] text-[var(--t2)]"
                    >
                      {f.n}
                    </span>
                    <p className="font-body text-[11.5px] leading-relaxed text-[var(--t3)]">
                      <b className="text-[var(--t2)]">{f.label}</b> — {f.says}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* 학습 계획 — 며칠이면 끝나는가 */}
      <section aria-label="학습 계획">
        <Kicker>
          <CalendarDays size={11} aria-hidden /> 학습 계획
        </Kicker>
        <div className="bg-[var(--bg2)]/40 rounded-[var(--r-md)] border border-[var(--bd)] px-4 py-3">
          <p className="font-body text-[13px] text-[var(--t2)]">
            하루 <b className="text-[var(--t1)]">{data.studyPlan.perDay}</b>개 ·{' '}
            <b className="text-[var(--t1)]">{data.studyPlan.days}</b>일 완성
            {data.truncated && (
              <span className="text-[var(--t3)]"> (지면 미리보기는 앞부분만)</span>
            )}
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
          <Kicker>
            <BookOpen size={11} aria-hidden /> {part.label}
          </Kicker>
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
                      <span className="font-english text-[16px] font-[700] text-[var(--t1)]">
                        {e.word}
                      </span>
                      {e.ipa && (
                        <span className="font-mono text-[11px] text-[var(--t3)]">{e.ipa}</span>
                      )}
                      {e.inflections.length > 0 && (
                        <span className="font-mono text-[10px] text-[var(--t3)]">
                          ({e.inflections.slice(0, 3).join('–')})
                        </span>
                      )}
                    </div>

                    <ol className="mt-1 flex flex-col gap-1.5">
                      {e.senses.map((s, i) => (
                        <li
                          key={i}
                          className="font-body text-[13px] leading-relaxed text-[var(--t2)]"
                        >
                          {s.n != null && (
                            <span className="mr-1 font-mono text-[11px] text-[var(--t3)]">
                              {s.n}.{' '}
                            </span>
                          )}
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
                            <span className="block font-body text-[12px] text-[var(--t3)]">
                              {s.exampleKo}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>

                    {(e.derived.length > 0 ||
                      e.collocations.length > 0 ||
                      e.crossRefs.length > 0) && (
                      <div className="mt-1.5 flex flex-col gap-0.5">
                        {e.derived.length > 0 && (
                          <p className="font-body text-[11.5px] text-[var(--t3)]">
                            <span className="mr-1 font-[600]">파생</span>
                            <span className="font-english">
                              {e.derived.slice(0, 5).join(' · ')}
                            </span>
                          </p>
                        )}
                        {e.collocations.length > 0 && (
                          <p className="font-body text-[11.5px] text-[var(--t3)]">
                            <span className="mr-1 font-[600]">연어</span>
                            <span className="font-english">
                              {e.collocations.slice(0, 3).join(' · ')}
                            </span>
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
                <div className="bg-[var(--bg2)]/40 mt-3 rounded-[var(--r-md)] border border-[var(--bd)] px-4 py-3">
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
          <Kicker>
            <RotateCcw size={11} aria-hidden /> 누적 복습
          </Kicker>
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
          <Kicker>
            <ListOrdered size={11} aria-hidden /> 색인 (전체 {data.indexSize}개)
          </Kicker>
          <p className="font-english text-[12px] leading-relaxed text-[var(--t3)]">
            {data.indexHead.map((x) => `${x.word} ${String(x.day).padStart(2, '0')}`).join(' · ')}
            {data.indexSize > data.indexHead.length && ' …'}
          </p>
        </section>
      )}

      {/*
        판권면 — 시중 단어장이 뒤에 싣는 것. 값이 없는 줄은 **넣지 않는다**
        ("정보 없음" 을 채우면 판권면이 있으나 마나가 되고, 지어내면 거짓이 된다).
        각인 전 세트는 검수가 `0/0` 으로 오는데 그건 "0개 통과" 가 아니라 "센 적이 없다" 이므로 뺀다.
      */}
      {data.colophon && (
        <section aria-label="판권면" className="border-t border-[var(--bd)] pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--t3)]">
            {data.colophon.brand}
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {(
              [
                ['판차', data.colophon.edition],
                ['발행', data.colophon.issued],
                ['구성', data.colophon.volume],
                ['표제어 선정', data.colophon.selection],
                ['검수', data.colophon.review.includes('0/0') ? '' : data.colophon.review],
                ['대상 수준', data.colophon.targetLevel],
                ['판권 번호', data.colophon.imprintCode ?? ''],
              ] as Array<[string, string]>
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-body text-[11px] text-[var(--t3)]">{k}</dt>
                  <dd className="font-body text-[11.5px] text-[var(--t2)]">{v}</dd>
                </div>
              ))}
          </dl>
          {/*
            사다리 — 시중 단어장의 뒤표지가 하는 일(다음에 무엇을 볼지). **계단 밖이어도 띠는
            그린다** — 어느 칸도 세우지 않을 뿐이다. 띠를 통째로 빼면 그 권만 시리즈에서
            떨어져 나온 것처럼 보인다.
          */}
          <div className="mt-3 flex items-center gap-2" aria-label="시리즈 사다리">
            <span className="font-body text-[11px] text-[var(--t3)]">사다리</span>
            <div className="flex gap-1">
              {data.colophon.ladderStrip.map((mark, i) => {
                const here = mark.startsWith('[')
                return (
                  <span
                    key={i}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-[3px] font-mono text-[10px]"
                    style={
                      here
                        ? { background: 'var(--p)', color: 'var(--on-p)' }
                        : { border: '1px solid var(--bd)', color: 'var(--t3)' }
                    }
                  >
                    {i + 1}
                  </span>
                )
              })}
            </div>
            {data.colophon.ladderStep == null && (
              <span className="font-body text-[11px] text-[var(--t3)]">학령 밖</span>
            )}
          </div>

          <p className="mt-2 font-body text-[11px] leading-relaxed text-[var(--t3)]">
            {data.colophon.sourcePolicy}
          </p>
        </section>
      )}

      <p className="font-body text-[11px] text-[var(--t3)]">
        지면 미리보기는 앞 {data.previewDays}일치입니다 — 나머지{' '}
        {Math.max(0, data.studyPlan.days - data.previewDays)}일치는 추가 후 학습 모듈에서
        이어집니다.
      </p>

      {days.length === 0 && null}
    </div>
  )
}

/**
 * **지면 보는 법 — 실제 칸 위에 번호.**
 *
 * 시중 어휘 교재는 FEATURES 지면에서 표제어 칸 한 장을 그대로 싣고 ① ② ③ 을 찍는다.
 * 목록만 주면 "파생어" 가 어느 줄인지 학습자가 눈으로 못 찾는다 — 설명의 값은 **가리키는 데**
 * 있지 이름을 부르는 데 있지 않다.
 *
 * 번호는 조판기가 이미 정한 순서를 그대로 쓴다(`guide.features`) — 여기서 다시 매기면
 * 아래 범례와 어긋난다.
 */
function FeatureCallout({
  entry,
  features,
}: {
  entry: SpreadEntry
  features: Array<{ n: number; id: string; label: string }>
}) {
  /** 그 장치가 이 콜아웃에서 몇 번인가. 없으면 이 권이 안 채운 칸이라 표시하지 않는다. */
  const numberOf = (id: string): number | null => features.find((f) => f.id === id)?.n ?? null

  const Marker = ({ id }: { id: string }) => {
    const n = numberOf(id)
    if (n == null) return null
    return (
      <span
        aria-hidden
        className="mr-1 inline-flex h-[15px] w-[15px] shrink-0 translate-y-[-1px] items-center justify-center rounded-full font-mono text-[9px] font-[700]"
        style={{ background: 'var(--p)', color: 'var(--on-p)' }}
      >
        {n}
      </span>
    )
  }

  const sense = entry.senses[0]

  return (
    <div className="mt-2 rounded-[var(--r-sm)] border border-dashed border-[var(--bd)] bg-[var(--bg)] px-3 py-2.5">
      <div className="mb-1.5 flex items-center gap-1">
        <Marker id="runningHead" />
        <span className="font-mono text-[10px] font-[700] tracking-[0.14em] text-[var(--t3)]">
          DAY {String(entry.day).padStart(2, '0')}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="inline-flex items-baseline">
          <Marker id="entryNumber" />
          <span className="font-mono text-[10px] text-[var(--t3)]">{entry.no}</span>
        </span>
        <span className="font-english text-[15px] font-[700] text-[var(--t1)]">{entry.word}</span>
        {entry.ipa && <span className="font-mono text-[10.5px] text-[var(--t3)]">{entry.ipa}</span>}
        {entry.inflections.length > 0 && (
          <span className="inline-flex items-baseline">
            <Marker id="inflection" />
            <span className="font-mono text-[10px] text-[var(--t3)]">
              ({entry.inflections.slice(0, 2).join('–')})
            </span>
          </span>
        )}
      </div>

      {sense && (
        <p className="mt-1 font-body text-[12.5px] leading-relaxed text-[var(--t2)]">
          {sense.n != null && (
            <span className="inline-flex items-baseline">
              <Marker id="senseNumber" />
              <span className="mr-1 font-mono text-[10.5px] text-[var(--t3)]">{sense.n}.</span>
            </span>
          )}
          {sense.pos && (
            <span className="inline-flex items-baseline">
              <Marker id="posLabel" />
              <span className="mr-1 rounded-[3px] bg-[var(--bg3)] px-1 font-body text-[10px] text-[var(--t2)]">
                {sense.pos}
              </span>
            </span>
          )}
          <span className="text-[var(--t1)]">{sense.meaning}</span>
        </p>
      )}

      {sense?.exampleEn && (
        <p className="mt-1 flex items-baseline font-english text-[12px] text-[var(--t2)]">
          <Marker id="exampleEn" />
          <span className="min-w-0">{sense.exampleEn}</span>
        </p>
      )}
      {sense?.exampleKo && (
        <p className="flex items-baseline font-body text-[11.5px] text-[var(--t3)]">
          <Marker id="exampleKo" />
          <span className="min-w-0">{sense.exampleKo}</span>
        </p>
      )}

      {entry.derived.length > 0 && (
        <p className="mt-1 flex items-baseline font-body text-[11px] text-[var(--t3)]">
          <Marker id="derivedRow" />
          <span className="mr-1 font-[600]">파생</span>
          <span className="font-english">{entry.derived.slice(0, 4).join(' · ')}</span>
        </p>
      )}
      {entry.crossRefs.length > 0 && (
        <p className="flex items-baseline font-body text-[11px] text-[var(--t3)]">
          <Marker id="crossRef" />
          <span className="font-english">
            → {entry.crossRefs[0]!.word} (DAY {String(entry.crossRefs[0]!.day).padStart(2, '0')})
          </span>
        </p>
      )}
      {entry.note && (
        <p className="mt-1 flex items-baseline border-l-[3px] border-[var(--p)] bg-[var(--bg2)] px-2 py-1 font-body text-[11px] leading-relaxed text-[var(--t2)]">
          <Marker id="usageNote" />
          <span className="min-w-0">{entry.note}</span>
        </p>
      )}
    </div>
  )
}

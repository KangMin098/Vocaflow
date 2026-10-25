// apps/web/src/components/csat/listening/ListeningTracer.tsx
//
// 듣기 근거 추적 도구(I5 + I8). 학습자가 후보(표 행 · 이유 카드)를 고르고 → 그 후보를 지우거나 남기는 발화를 짚고 →
// 확정한다. 발화 목록 ↔ 근거 강조 ↔ 후보 판단을 오간다(발화에 달린 연결 칩을 누르면 그 후보로, 후보를 누르면 그 발화로).
// 노출 단계는 계약 `exposure.ts` 가 정한다 — 정답 비교(L4) · 정답 번호(L5)는 제출 + Reveal Gate 'open' 일 때만.
// 점수 · 숙달 산입 없음. 선지 층은 BLOCKED_EVIDENCE(공식 선지 없음) — 지어내지 않는다.
'use client'

import { Check, CircleSlash, Link2, ShieldAlert, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { EXPOSURE_LABELS, EXPOSURE_LEVELS, canTransition, exposureView, type ExposureContext, type ExposureLevel } from '@/lib/csat/listening/exposure'
import type { ClientTraceCandidate as TraceCandidate, ClientTraceFixture as ListeningTraceFixture } from '@/lib/csat/listening/fixtures'
import { LISTENING_TYPE_LABELS, type EvidenceRole, type ListeningUtterance } from '@/lib/csat/listening/types'

import { BTN, ListeningAudioBar, OFF, ON, PRIMARY } from './ListeningAudioBar'
import {
  analysisReveal,
  compareCandidate,
  toAnalysisState,
  type AnalysisState,
  initialItemState,
  judge,
  loadSnapshot,
  moveLevel,
  remainingCount,
  saveSnapshot,
  shownLevel,
  submit,
  submitBlock,
  unjudge,
  type ItemTraceState,
  type LinkMatch,
  type TracerSnapshot,
} from './tracer-state'
import { useListeningAudio, type AudioFactory } from './useListeningAudio'

const ROLE_LABEL: Readonly<Record<EvidenceRole, string>> = { decisive: '결정', supporting: '보조', contrast: '대조' }
const ROLE_CLASS: Readonly<Record<EvidenceRole, string>> = {
  decisive: 'bg-[var(--bg3)] font-semibold underline decoration-2 underline-offset-4',
  supporting: 'bg-[var(--bg3)] underline decoration-dotted underline-offset-4',
  contrast: 'bg-transparent underline decoration-wavy underline-offset-4',
}
const MATCH_TEXT: Readonly<Record<LinkMatch, string>> = {
  match: '같다 — 판정과 발화 모두 분석과 일치',
  'verdict-differs': '판정이 다르다',
  'utterance-differs': '판정은 같고, 짚은 발화가 다르다',
  unjudged: '판단 없음',
}
const LEVEL_BLOCK: Readonly<Record<string, string>> = {
  'not-submitted': '판단을 제출해야 열린다',
  'reveal-held': '정답 공개 보류(Reveal Gate) — 열 수 없다',
  skip: '한 단계씩 올린다',
}
const ANALYSIS_TEXT: Readonly<Record<AnalysisState['status'], string>> = {
  idle: '제출 뒤 확인',
  loading: '불러오는 중',
  open: '열림',
  held: '정답 공개 보류 중(수집 중인 시험)',
  failure: '불러오기 실패 — 닫아 둔다',
}

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function Highlighted({ u, fx, show }: { u: ListeningUtterance; fx: ListeningTraceFixture; show: boolean }) {
  if (!show) return <>{u.text}</>
  const spans = fx.evidence.filter((e) => e.utteranceId === u.id).sort((a, b) => a.charStart - b.charStart)
  const parts: React.ReactNode[] = []
  let at = 0
  for (const s of spans) {
    if (s.charStart < at) continue
    if (s.charStart > at) parts.push(u.text.slice(at, s.charStart))
    parts.push(
      <mark key={s.id} data-evidence={s.id} data-role={s.role} className={`rounded-sm px-0.5 text-[var(--t1)] ${ROLE_CLASS[s.role]}`}>
        {u.text.slice(s.charStart, s.charEnd)}
        <span className="ml-1 whitespace-nowrap align-middle text-[length:max(var(--csat-fs-min),calc(11px*var(--csat-fs-scale)))] font-semibold not-italic text-[var(--t2)]">[{ROLE_LABEL[s.role]}]</span>
      </mark>,
    )
    at = s.charEnd
  }
  if (at < u.text.length) parts.push(u.text.slice(at))
  return <>{parts}</>
}

export interface ListeningTracerProps {
  fixtures: readonly ListeningTraceFixture[]
  initialKey?: string | null
  /** 제출 뒤 분석 열기(서버 액션). 없거나 실패하면 L4 이상은 닫힌 채다 */
  loadAnalysis?: (itemId: string, submission: ItemTraceState['judgments']) => Promise<unknown>
  /** 시험 · 미리보기용 — 문항별 분석 상태를 미리 채운다 */
  initialAnalysis?: Record<string, AnalysisState>
  audioFactory?: AudioFactory
  /** 주어지면 sessionStorage 복원을 건너뛰고 이 상태로 시작한다(시험 · 미리보기) */
  initialSnapshot?: TracerSnapshot
}

export function ListeningTracer({ fixtures, initialKey, loadAnalysis, initialAnalysis, audioFactory, initialSnapshot }: ListeningTracerProps) {
  const [analysis, setAnalysis] = useState<Record<string, AnalysisState>>(initialAnalysis ?? {})
  const fallbackKey = fixtures.some((f) => f.key === initialKey) ? (initialKey as string) : fixtures[0].key
  const [snap, setSnap] = useState<TracerSnapshot>(initialSnapshot ?? { selectedKey: fallbackKey, byItem: {} })
  const [hydrated, setHydrated] = useState(false)
  const skipLoad = useRef(initialSnapshot !== undefined)
  const [pickedCandidate, setPickedCandidate] = useState<string | null>(null)
  const [pickedUtterance, setPickedUtterance] = useState<string | null>(null)
  const uttRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const candRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // 복원: URL 의 ?item= 이 저장된 선택보다 우선한다
  useEffect(() => {
    if (skipLoad.current) {
      setHydrated(true)
      return
    }
    const loaded = loadSnapshot(fixtures, fallbackKey)
    setSnap(initialKey && fixtures.some((f) => f.key === initialKey) ? { ...loaded, selectedKey: initialKey } : loaded)
    setHydrated(true)
  }, [fixtures, fallbackKey, initialKey])

  useEffect(() => {
    if (!hydrated) return
    saveSnapshot(snap)
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('item', snap.selectedKey)
      window.history.replaceState(window.history.state, '', url.toString())
    } catch {
      // 주소 갱신 실패는 무시 — 상태는 sessionStorage 에도 있다
    }
  }, [snap, hydrated])

  const baseFx = fixtures.find((f) => f.key === snap.selectedKey) ?? fixtures[0]
  const st: ItemTraceState = snap.byItem[baseFx.key] ?? initialItemState()
  const an = analysis[baseFx.key]
  // 분석이 'open' 으로 도착했을 때만 정답이 담긴 픽스처로 바꾼다
  const fx = an?.status === 'open' ? an.fixture : baseFx
  const reveal = analysisReveal(an)
  const ctx: ExposureContext = { submitted: st.submitted, reveal }

  // 제출(또는 제출 상태 복원) 뒤에만 서버에 분석을 묻는다
  useEffect(() => {
    if (!st.submitted || !loadAnalysis) return
    const key = baseFx.key
    if (analysis[key] && analysis[key].status !== 'idle') return
    setAnalysis((p) => ({ ...p, [key]: { status: 'loading' } }))
    loadAnalysis(key, st.judgments).then(
      (r) => setAnalysis((p) => ({ ...p, [key]: toAnalysisState(key, r) })),
      () => setAnalysis((p) => ({ ...p, [key]: { status: 'failure' } })),
    )
  }, [st.submitted, st.judgments, baseFx.key, loadAnalysis, analysis])
  const level = shownLevel(st, ctx)
  const view = exposureView(st.level, ctx)
  const audio = useListeningAudio(fx.audio, audioFactory)
  const canLink = view.transcript && st.captions

  const update = (fn: (s: ItemTraceState) => ItemTraceState) =>
    setSnap((prev) => ({ ...prev, byItem: { ...prev.byItem, [fx.key]: fn(prev.byItem[fx.key] ?? initialItemState()) } }))

  const selectItem = (key: string) => {
    setPickedCandidate(null)
    setPickedUtterance(null)
    setSnap((prev) => ({ ...prev, selectedKey: key }))
  }

  const linksByUtterance = useMemo(() => {
    const m: Record<string, { cand: TraceCandidate; verdict: string }[]> = {}
    for (const c of fx.candidates) {
      const j = st.judgments[c.id]
      if (j) (m[j.utteranceId] ??= []).push({ cand: c, verdict: j.verdict })
    }
    return m
  }, [fx, st.judgments])

  const goCandidate = (id: string) => {
    setPickedCandidate(id)
    candRefs.current[id]?.focus()
  }
  const pickCandidate = (id: string) => {
    setPickedCandidate(id)
    const j = st.judgments[id]
    if (j) setPickedUtterance(j.utteranceId)
  }
  const goUtterance = (id: string) => {
    setPickedUtterance(id)
    uttRefs.current[id]?.focus()
  }

  const confirm = (verdict: 'eliminated' | 'remaining') => {
    if (!pickedCandidate || !pickedUtterance) return
    update((s) => judge(s, pickedCandidate, { verdict, utteranceId: pickedUtterance }))
    setPickedCandidate(null)
    setPickedUtterance(null)
  }

  const remaining = remainingCount(fx, st)
  const block = submitBlock(fx, st)
  const selUtt = fx.utterances.find((u) => u.id === pickedUtterance) ?? null
  const selCand = fx.candidates.find((c) => c.id === pickedCandidate) ?? null
  const uttNo = (id: string) => fx.utterances.findIndex((u) => u.id === id) + 1
  const speaker = (s: string) => fx.speakerLabels[s] ?? s
  const hasTiming = fx.utterances.some((u) => u.startMs !== undefined)
  const segment = selUtt && selUtt.startMs !== undefined && selUtt.endMs !== undefined ? { startMs: selUtt.startMs, endMs: selUtt.endMs, label: `${uttNo(selUtt.id)}번 발화` } : null
  const synthetic = fx.candidatesSource === 'synthetic-reconstruction'

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4 text-[var(--t1)]" data-testid="listening-tracer">
      {/* 문항 고르기 + 표지 */}
      <header className="flex flex-col gap-3">
        <div role="group" aria-label="문항 고르기" className="flex flex-wrap gap-2">
          {fixtures.map((f) => (
            <button key={f.key} type="button" className={`${BTN} ${f.key === fx.key ? ON : OFF}`} aria-pressed={f.key === fx.key} onClick={() => selectItem(f.key)}>
              {f.examId} 수능 {f.itemNo}번 · {LISTENING_TYPE_LABELS[f.typeId]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[length:max(var(--csat-fs-min),calc(12px*var(--csat-fs-scale)))]">
          <span data-testid="badge-unverified" className="inline-flex items-center gap-1 rounded-[var(--r-md)] border border-[var(--t2)] px-2 py-1 font-semibold break-keep">
            <ShieldAlert size={13} aria-hidden="true" />
            서버·DB 연동 미검증
          </span>
          <span className="rounded-[var(--r-md)] border border-[var(--bd)] px-2 py-1 break-keep">로컬 자료 · 전사 검수 전(NOT_VERIFIED)</span>
          <span className="rounded-[var(--r-md)] border border-[var(--bd)] px-2 py-1 break-keep">분석: {ANALYSIS_TEXT[an?.status ?? 'idle']}</span>
        </div>
        <h1 className="text-[length:max(var(--csat-fs-min),calc(18.5px*var(--csat-fs-scale)))] font-bold leading-snug break-keep">{fx.stem}</h1>
        <p className="text-[length:max(var(--csat-fs-min),calc(15px*var(--csat-fs-scale)))] text-[var(--t2)] break-keep">{fx.prompt}</p>
      </header>

      <ListeningAudioBar source={fx.audio} audio={audio} segment={segment} />

      {/* 노출 단계 */}
      <section aria-label="노출 단계" className="flex flex-col gap-2">
        <div role="group" aria-label="노출 단계 고르기" className="flex flex-wrap gap-2">
          {EXPOSURE_LEVELS.map((l: ExposureLevel) => {
            const t = canTransition(st.level, l, ctx)
            const cur = l === level
            const reason = !t.ok && t.reason !== 'same' ? LEVEL_BLOCK[t.reason] : null
            return (
              <button
                key={l}
                type="button"
                className={`${BTN} ${cur ? ON : OFF}`}
                aria-current={cur ? 'step' : undefined}
                disabled={!cur && !t.ok}
                title={reason ?? undefined}
                aria-label={`${l} ${EXPOSURE_LABELS[l]}${reason ? ` — ${reason}` : ''}`}
                onClick={() => update((s) => moveLevel(s, l, ctx))}
              >
                {l} · {EXPOSURE_LABELS[l]}
              </button>
            )
          })}
          <button
            type="button"
            className={`${BTN} ${st.captions ? ON : OFF}`}
            aria-pressed={st.captions}
            disabled={!view.transcript}
            onClick={() => update((s) => ({ ...s, captions: !s.captions }))}
          >
            자막(대본) {st.captions ? '켬' : '끔'}
          </button>
        </div>
        {level === 'L3' && !view.evidenceHighlights ? (
          <p data-testid="evidence-held" className="text-[length:max(var(--csat-fs-min),calc(14px*var(--csat-fs-scale)))] text-[var(--t2)] break-keep">
            L3 근거 강조는 판단을 제출하고 정답 공개가 열린 뒤에 보인다. 지금은 내가 짚은 발화(연결 칩)만 표시된다.
          </p>
        ) : null}
        {!view.transcript ? <p className="text-[length:max(var(--csat-fs-min),calc(14px*var(--csat-fs-scale)))] text-[var(--t2)] break-keep">L0 음성만 — 원음이 없어 들을 것이 없다. L1 로 올리면 대본으로 판단할 수 있다.</p> : null}
      </section>

      <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-4">
        {/* 발화 목록 */}
        <section aria-labelledby="utt-h" className="flex flex-col gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
          <h2 id="utt-h" className="text-[length:max(var(--csat-fs-min),calc(13px*var(--csat-fs-scale)))] font-bold break-keep">
            발화 {fx.utterances.length}개 {view.timing && !hasTiming ? <span className="font-normal text-[var(--t2)]">· 시각 정보 없음</span> : null}
          </h2>
          <ol className="flex flex-col gap-1.5">
            {fx.utterances.map((u, i) => {
              const picked = pickedUtterance === u.id
              const links = linksByUtterance[u.id] ?? []
              return (
                <li key={u.id} className="flex flex-col gap-1">
                  <button
                    ref={(el) => {
                      uttRefs.current[u.id] = el
                    }}
                    type="button"
                    data-utterance={u.id}
                    aria-pressed={picked}
                    disabled={!canLink}
                    aria-label={canLink ? undefined : `${i + 1}번 발화 — 대본이 닫혀 있다`}
                    onClick={() => setPickedUtterance(picked ? null : u.id)}
                    className={`flex min-h-[44px] w-full items-start gap-2 rounded-[var(--r-md)] border px-3 py-2 text-left text-[length:max(var(--csat-fs-min),calc(15px*var(--csat-fs-scale)))] leading-relaxed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ju)] disabled:cursor-default ${picked ? 'border-[var(--t1)] border-2 bg-[var(--bg3)]' : 'border-[var(--bd)] bg-[var(--bg)]'}`}
                  >
                    <span className="w-7 shrink-0 font-mono text-[length:max(var(--csat-fs-min),calc(13px*var(--csat-fs-scale)))] text-[var(--t2)]">{i + 1}</span>
                    {view.speakerStructure ? <span className="w-10 shrink-0 text-[length:max(var(--csat-fs-min),calc(13px*var(--csat-fs-scale)))] font-semibold break-keep">{speaker(u.speaker)}</span> : null}
                    {view.timing && u.startMs !== undefined ? <span className="shrink-0 font-mono text-[length:max(var(--csat-fs-min),calc(12px*var(--csat-fs-scale)))] text-[var(--t2)]">{fmtMs(u.startMs)}</span> : null}
                    <span className="min-w-0 flex-1">
                      {view.transcript && st.captions ? <Highlighted u={u} fx={fx} show={view.evidenceHighlights} /> : <span className="text-[var(--t3)]">{view.transcript ? '자막 끔' : '대본 닫힘'}</span>}
                    </span>
                    {picked ? <span className="shrink-0 text-[length:max(var(--csat-fs-min),calc(12px*var(--csat-fs-scale)))] font-semibold">짚음</span> : null}
                  </button>
                  {links.length ? (
                    <div className="flex flex-wrap gap-1 pl-9">
                      {links.map(({ cand, verdict }) => (
                        <button key={cand.id} type="button" className={`${BTN} ${OFF} text-[length:max(var(--csat-fs-min),calc(13px*var(--csat-fs-scale)))]`} onClick={() => goCandidate(cand.id)} aria-label={`${cand.label} 판단으로 가기 — ${verdict === 'eliminated' ? '지움' : '남김'}`}>
                          <Link2 size={14} aria-hidden="true" />
                          {cand.label} {verdict === 'eliminated' ? '지움' : '남김'}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </section>

        {/* 후보 판단 */}
        <section aria-labelledby="judge-h" className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
          <h2 id="judge-h" className="text-[length:max(var(--csat-fs-min),calc(13px*var(--csat-fs-scale)))] font-bold break-keep">
            {fx.mode === 'table-filter' ? '표 행 거르기' : '이유 후보 소거'}
          </h2>
          <p data-testid="candidates-source" className={`rounded-[var(--r-md)] border px-2 py-1.5 text-[length:max(var(--csat-fs-min),calc(13px*var(--csat-fs-scale)))] break-keep ${synthetic ? 'border-dashed border-[var(--t2)]' : 'border-[var(--bd)]'}`}>
            {synthetic
              ? '테스트용 합성 자료 — 공식 표가 아니다. 대본의 조건을 걸어 보는 연습용 재구성 행이다.'
              : '대본에서 나온 이유 후보 — 공식 선지가 아니다.'}
          </p>

          {fx.mode === 'table-filter' ? (
            <table className="w-full border-collapse text-[length:max(var(--csat-fs-min),calc(14px*var(--csat-fs-scale)))]">
              <caption className="sr-only">재구성 표 — 행을 골라 지우거나 남긴다</caption>
              <thead>
                <tr className="text-left text-[length:max(var(--csat-fs-min),calc(12px*var(--csat-fs-scale)))] text-[var(--t2)]">
                  <th scope="col" className="p-1">행</th>
                  {fx.candidateColumns?.map((c) => (
                    <th key={c} scope="col" className="p-1 break-keep">{c}</th>
                  ))}
                  <th scope="col" className="p-1">내 판단</th>
                </tr>
              </thead>
              <tbody>
                {fx.candidates.map((c) => {
                  const j = st.judgments[c.id]
                  const out = j?.verdict === 'eliminated'
                  return (
                    <tr key={c.id} className={`border-t border-[var(--bd)] ${out ? 'text-[var(--t3)] line-through' : ''}`}>
                      <th scope="row" className="p-1">
                        <CandidateButton c={c} picked={pickedCandidate === c.id} disabled={st.submitted} onPick={pickCandidate} refs={candRefs} />
                      </th>
                      {c.cells?.map((v, k) => (
                        <td key={k} className="p-1 break-keep">{v}</td>
                      ))}
                      <td className="p-1 no-underline" style={{ textDecoration: 'none' }}>
                        <JudgmentTag j={j} uttNo={uttNo} onGo={goUtterance} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <ul className="flex flex-col gap-2">
              {fx.candidates.map((c) => {
                const j = st.judgments[c.id]
                return (
                  <li key={c.id} className={`flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-2 ${j?.verdict === 'eliminated' ? 'text-[var(--t3)]' : ''}`}>
                    <CandidateButton c={c} picked={pickedCandidate === c.id} disabled={st.submitted} onPick={pickCandidate} refs={candRefs} strike={j?.verdict === 'eliminated'} />
                    <span className="ml-auto">
                      <JudgmentTag j={j} uttNo={uttNo} onGo={goUtterance} />
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          {!st.submitted ? (
            <div className="flex flex-col gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-2" aria-label="판단 확정">
              <p className="text-[length:max(var(--csat-fs-min),calc(14px*var(--csat-fs-scale)))] break-keep" aria-live="polite">
                {selCand ? <b>{selCand.label}</b> : '① 후보를 고르고'} · {selUtt ? <b>{uttNo(selUtt.id)}번 발화</b> : '② 근거 발화를 짚고'} · ③ 확정
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`${BTN} ${OFF}`} disabled={!selCand || !selUtt} onClick={() => confirm('eliminated')}>
                  <X size={16} aria-hidden="true" />이 말로 지운다
                </button>
                <button type="button" className={`${BTN} ${OFF}`} disabled={!selCand || !selUtt} onClick={() => confirm('remaining')}>
                  <Check size={16} aria-hidden="true" />이 말로 남긴다
                </button>
                <button
                  type="button"
                  className={`${BTN} ${OFF}`}
                  disabled={!selCand || !st.judgments[selCand.id]}
                  onClick={() => {
                    if (selCand) update((s) => unjudge(s, selCand.id))
                    setPickedCandidate(null)
                  }}
                >
                  <CircleSlash size={16} aria-hidden="true" />판단 지우기
                </button>
              </div>
            </div>
          ) : null}

          <p role="status" data-testid="remaining" className="text-[length:max(var(--csat-fs-min),calc(14px*var(--csat-fs-scale)))] font-semibold break-keep">
            남은 {fx.mode === 'table-filter' ? '행' : '후보'} {remaining}개 / {fx.candidates.length}개
          </p>

          {!st.submitted ? (
            <div className="flex flex-col gap-1">
              <button type="button" className={`${BTN} ${PRIMARY}`} disabled={block !== null} onClick={() => update((s) => submit(fx, s))}>
                판단 제출
              </button>
              {block === 'unjudged' ? <p className="text-[length:max(var(--csat-fs-min),calc(13px*var(--csat-fs-scale)))] text-[var(--t2)] break-keep">모든 후보를 지우거나 남겨야 제출할 수 있다.</p> : null}
              {block === 'none-remaining' ? <p className="text-[length:max(var(--csat-fs-min),calc(13px*var(--csat-fs-scale)))] text-[var(--t2)] break-keep">하나는 남겨야 한다 — 모두 지웠다.</p> : null}
            </div>
          ) : (
            <p className="text-[length:max(var(--csat-fs-min),calc(14px*var(--csat-fs-scale)))] break-keep" data-testid="submitted">
              제출했다 — 판단은 잠겼다.{' '}
              {an?.status === 'open'
                ? rankBelow(level, 'L4')
                  ? 'L4 로 올리면 분석과 맞대어 볼 수 있다.'
                  : null
                : an?.status === 'held'
                  ? '정답 공개가 보류돼 L4 이상(분석 비교 · 정답 번호)은 열리지 않는다.'
                  : an?.status === 'failure'
                    ? '분석을 불러오지 못했다 — L4 이상은 닫아 둔다.'
                    : '분석을 불러오는 중 — 도착하기 전에는 L4 이상이 열리지 않는다.'}
            </p>
          )}

          {view.rationales ? (
            <section aria-label="분석과 비교" data-testid="compare" className="flex flex-col gap-2 border-t border-[var(--bd)] pt-2">
              <h3 className="text-[length:max(var(--csat-fs-min),calc(14px*var(--csat-fs-scale)))] font-bold">분석과 비교</h3>
              <ul className="flex flex-col gap-1.5 text-[length:max(var(--csat-fs-min),calc(14px*var(--csat-fs-scale)))]">
                {fx.candidates.map((c) => {
                  const m = compareCandidate(fx, st, c.id)
                  return (
                    <li key={c.id} className="flex flex-col gap-0.5 break-keep">
                      <span className="flex items-center gap-1 font-semibold">
                        {m === 'match' ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                        {c.label} · 분석: {c.expected === 'eliminated' ? '지움' : '남김'}
                        {c.keyUtteranceIds?.[0] ? (
                          <>
                            {' · '}
                            <button type="button" className="inline-flex min-h-[44px] min-w-[44px] items-center rounded-[var(--r-md)] px-1.5 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ju)]" onClick={() => goUtterance(c.keyUtteranceIds![0])}>
                              {uttNo(c.keyUtteranceIds[0])}번 발화
                            </button>
                          </>
                        ) : null}
                      </span>
                      <span>{MATCH_TEXT[m]} — {c.note}</span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          <section aria-label="선지 층" className="flex flex-col gap-1 border-t border-[var(--bd)] pt-2 text-[length:max(var(--csat-fs-min),calc(13px*var(--csat-fs-scale)))] break-keep" data-testid="choice-layer">
            <p>
              <b>선지 층: {fx.choiceLayer.status}</b> — {fx.choiceLayer.status === 'BLOCKED_EVIDENCE' ? fx.choiceLayer.reason : fx.choiceLayer.label}
            </p>
            {view.answer && fx.officialAnswer ? (
              <p data-testid="official-answer">
                공식 정답 번호 <b>{fx.officialAnswer.choice}번</b> · {fx.officialAnswer.form}형 · 형별 결속 {fx.officialAnswer.formBinding === 'UNVERIFIED' ? '미검증' : '검증'} · 선지 문구는 없다.
                {synthetic ? ' 위 재구성 행의 결과는 공식 선지 번호와 무관하다.' : ''}
              </p>
            ) : null}
          </section>
        </section>
      </div>
    </div>
  )
}

function rankBelow(a: ExposureLevel, b: ExposureLevel): boolean {
  return EXPOSURE_LEVELS.indexOf(a) < EXPOSURE_LEVELS.indexOf(b)
}

function CandidateButton({
  c,
  picked,
  disabled,
  onPick,
  refs,
  strike = false,
}: {
  c: TraceCandidate
  picked: boolean
  disabled: boolean
  onPick: (id: string) => void
  refs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>
  strike?: boolean
}) {
  return (
    <button
      ref={(el) => {
        refs.current[c.id] = el
      }}
      type="button"
      data-candidate={c.id}
      aria-pressed={picked}
      disabled={disabled}
      onClick={() => onPick(c.id)}
      className={`${BTN} ${picked ? `${ON} border-2` : OFF} ${strike ? 'line-through' : ''} disabled:opacity-100`}
    >
      {c.label}
    </button>
  )
}

function JudgmentTag({ j, uttNo, onGo }: { j: { verdict: string; utteranceId: string } | undefined; uttNo: (id: string) => number; onGo: (id: string) => void }) {
  if (!j) return <span className="text-[length:max(var(--csat-fs-min),calc(13px*var(--csat-fs-scale)))] text-[var(--t2)]">미판단</span>
  return (
    <button type="button" className={`${BTN} ${OFF} text-[length:max(var(--csat-fs-min),calc(13px*var(--csat-fs-scale)))] no-underline`} style={{ textDecoration: 'none' }} onClick={() => onGo(j.utteranceId)} aria-label={`${j.verdict === 'eliminated' ? '지움' : '남김'} — ${uttNo(j.utteranceId)}번 발화로 가기`}>
      {j.verdict === 'eliminated' ? <X size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
      {j.verdict === 'eliminated' ? '지움' : '남김'} · {uttNo(j.utteranceId)}번
    </button>
  )
}

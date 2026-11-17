// apps/web/src/app/admin/csat/content-review/ContentReviewClient.tsx
//
// **콘텐츠 검수 작업 공간 — 대조 4칸 + 상태 패널.**
//
// 검수자의 판단 순서대로 놓는다: 공식 원문(무엇이 사실인가) → 현재 분석·강의(지금 무엇을 가르치나)
// → 수정 후보(무엇으로 바꾸려나, 낱말 차이) → 발행 전 검증·결속(이대로 내보내도 되나).
// 상태 버튼은 **시연 원장**(이 브라우저 localStorage)에만 줄을 덧붙인다 — DB·발행과 연결되지 않는다.

'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import {
  STATE_LABEL,
  TRACK_LABEL,
  TRANSITIONS,
  bindingHash,
  countHumanApprovals,
  currentState,
  revert,
  transition,
  verifyLedger,
} from '@/lib/csat/content-review/state'
import type { Evidence, LedgerEntry, ReviewState, ReviewTrack, Reviewer } from '@/lib/csat/content-review/types'
import {
  DEFECT_LABEL,
  SOURCE_LABEL,
  wordDiff,
  type CandidateDetail,
  type QueueRow,
} from '@/lib/csat/content-review/workspace'

const LEDGER_KEY = 'csat-content-review:demo-ledger:v1'
const CIRCLED = ['①', '②', '③', '④', '⑤']

const DEMO_REVIEWERS: Reviewer[] = [
  { id: 'demo-human-reviewer', kind: 'human', roles: ['content_reviewer'] },
  { id: 'demo-answer-authority', kind: 'human', roles: ['content_reviewer', 'answer_authority', 'publisher'] },
  { id: 'demo-ai-checker', kind: 'ai', roles: ['content_reviewer'] },
]
const REVIEWER_LABEL: Record<string, string> = {
  'demo-human-reviewer': '시연 · 사람 검수자',
  'demo-answer-authority': '시연 · 사람 정답 권한자',
  'demo-ai-checker': '시연 · AI 확인자',
}

const EVIDENCE_LABEL: Record<Evidence['kind'], string> = {
  official_pdf_text: '공식 문제지 문장 대조',
  official_answer_sheet: '평가원 정답표',
  press_report: '보도(1차 원문 아님)',
  analysis_revision: '분석 판본 본문',
  lecture_cue: '강의 cue 본문',
  ai_consensus: 'AI 합의(승인 근거 아님)',
  reviewer_note: '검수자 메모',
}

/**
 * 지문 문장이 몇 번 선지 본문과 같은가(앞 원문자·공백 무시). 없으면 null.
 * 35번(무관한 문장)·도표 문항은 시험지에서도 선지가 지문 안의 번호 문장이다 — 추출 오류가 아니라 형식이다.
 * 「(e)」 같은 짧은 표지 선지는 접두 일치로 오인하므로 15자 이상 본문만 대조한다.
 */
function choiceLike(sentence: string, choices: readonly string[]): number | null {
  const norm = (t: string) => t.replace(/^[①-⑤]\s*/, '').replace(/\s+/g, ' ').trim()
  const s = norm(sentence)
  const i = choices.findIndex((c) => {
    const n = norm(c)
    return n.length >= 15 && (s === n || s.startsWith(n) || n.startsWith(s))
  })
  return i < 0 ? null : i + 1
}

function readLedger(): LedgerEntry[] {
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY)
    const v = raw ? (JSON.parse(raw) as LedgerEntry[]) : []
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
function writeLedger(l: LedgerEntry[]) {
  try {
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(l))
  } catch {
    // 저장이 막힌 브라우저 — 이 탭 안에서만 유지된다
  }
}

const card = 'rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4'
const h2 = 'font-display text-[14px] font-[700] text-[var(--t1)]'
const small = 'font-body text-[12px] text-[var(--t3)]'
const btn =
  'min-h-[44px] rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-body text-[13px] text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:opacity-40'

export function ContentReviewClient({
  rows,
  detail,
  unknownId,
  generatedFrom,
}: {
  rows: QueueRow[]
  detail: CandidateDetail | null
  unknownId: string | null
  generatedFrom: Record<string, unknown>
}) {
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [filter, setFilter] = useState<'all' | QueueRow['source']>('all')
  useEffect(() => setLedger(readLedger()), [])

  const shown = filter === 'all' ? rows : rows.filter((r) => r.source === filter)
  const integrity = useMemo(() => verifyLedger(ledger), [ledger])

  return (
    <div className="flex flex-col gap-4 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-[20px] font-[700] text-[var(--t1)]">기출분석 콘텐츠 검수</h1>
          <p className={`${small} mt-1 break-keep`}>
            공식 원문 · 현재 분석 · 현재 강의 cue · 수정 후보를 대조한다. 스냅샷 {String(generatedFrom.generatedAt ?? generatedFrom.commit ?? '')}
          </p>
        </div>
        <Link href="/admin/csat/content-review/t0148" className={`${btn} inline-flex items-center`}>
          T-0148 블라인드 채점
        </Link>
      </header>

      <p role="status" className="rounded-[var(--r-md)] border border-[var(--memory-risk)] bg-[var(--bg)] p-3 font-body text-[13px] text-[var(--t1)] break-keep">
        <strong>실제 사람 내용 승인 0건</strong> · 이 화면은 DB·발행과 연결되지 않는다. 아래 버튼은 이 브라우저의 시연 원장에만 기록된다
        (시연 승인 {countHumanApprovals(ledger)}건 — 실제 승인이 아니다).
        {integrity.ok ? null : <span className="text-[var(--error-ink)]"> 시연 원장 무결성 오류: {integrity.problems[0]}</span>}
      </p>

      {unknownId ? (
        <p role="alert" className="font-body text-[13px] text-[var(--error-ink)]">
          후보 {unknownId} 가 스냅샷에 없다 — 첫 후보를 연다.
        </p>
      ) : null}

      <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-4">
        <nav aria-label="검수 대기열" className={`${card} flex max-h-[calc(100vh-200px)] flex-col gap-2 overflow-y-auto`}>
          <label className={small} htmlFor="cr-filter">원천</label>
          <select
            id="cr-filter"
            className={btn}
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">전체 {rows.length}</option>
            {(Object.keys(SOURCE_LABEL) as QueueRow['source'][]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]} {rows.filter((r) => r.source === s).length}
              </option>
            ))}
          </select>
          <ul className="flex flex-col gap-1">
            {shown.map((r) => {
              const active = detail?.candidate.id === r.id
              const states = r.tracks.map((t) => currentState(ledger, r.id, t))
              return (
                <li key={r.id}>
                  <Link
                    href={`/admin/csat/content-review?id=${r.id}`}
                    aria-current={active ? 'true' : undefined}
                    className={`block min-h-[44px] rounded-[var(--r-md)] px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)] ${active ? 'bg-[var(--bd)]' : ''}`}
                  >
                    <span className="font-mono text-[13px] text-[var(--t1)]">{r.itemId}</span>
                    <span className="ml-2 font-body text-[11px] text-[var(--t2)] break-keep">{DEFECT_LABEL[r.defect]}</span>
                    <span className="block font-body text-[11px] text-[var(--t3)]">
                      {SOURCE_LABEL[r.source]} · {states.map((s) => STATE_LABEL[s]).join(' / ')}
                      {r.stale ? ' · 판본 바뀜' : ''}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {detail ? <Detail detail={detail} ledger={ledger} setLedger={(l) => { setLedger(l); writeLedger(l) }} /> : (
          <p className={card}>후보가 없다.</p>
        )}
      </div>
    </div>
  )
}

function Detail({ detail, ledger, setLedger }: { detail: CandidateDetail; ledger: LedgerEntry[]; setLedger: (l: LedgerEntry[]) => void }) {
  const { candidate: c, item } = detail
  const answers = c.officialAnswers ?? item?.officialAnswers ?? null
  const changedCueIds = new Set(c.changes.filter((ch) => ch.target.startsWith('cue:')).map((ch) => ch.target.slice(4)))

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* ① 공식 원문 */}
      <section aria-labelledby="cr-official" className={card}>
        <h2 id="cr-official" className={h2}>공식 원문</h2>
        <p className={`${small} mt-1 break-keep`}>
          원문 대조: {c.officialText.verdict}
          {c.officialText.note ? ` — ${c.officialText.note}` : ''}
        </p>
        <p className="mt-2 font-body text-[13px] text-[var(--t1)]">
          공식 정답 집합:{' '}
          <strong>{answers ? answers.map((n) => CIRCLED[n - 1]).join(' · ') : '모름(근거 없음)'}</strong>
          {answers && answers.length > 1 ? ' — 복수정답. 단일 정답 규칙으로 줄이지 않는다.' : ''}
          <span className={`${small} ml-1`}>{c.officialAnswerBasis ? `근거 ${c.officialAnswerBasis}` : ''}</span>
        </p>
        {item?.stem ? <p className="mt-2 font-body text-[13px] text-[var(--t2)] break-keep">{item.stem}</p> : null}
        <ol className="mt-2 flex flex-col gap-1">
          {/* 문장 번호는 제품 분할기와 같아야 cue 의 「N 번째 문장」을 대조할 수 있다 — 선지가 섞인 문장도 지우지 않고 표시만 한다 */}
          {(item?.passageSentences ?? []).map((s, i) => {
            const asChoice = choiceLike(s, item?.choices ?? [])
            return (
              <li key={i} className="font-body text-[13px] leading-relaxed text-[var(--t1)]">
                <span className="mr-1 font-mono text-[11px] text-[var(--t3)]">s{i}</span>
                {s}
                {asChoice ? <span className="ml-1 font-body text-[11px] text-[var(--t3)]">= 선지 {CIRCLED[asChoice - 1]}(지문 안 번호 문장)</span> : null}
              </li>
            )
          })}
        </ol>
        <ol className="mt-3 flex flex-col gap-1 border-t border-[var(--bd)] pt-2">
          {(item?.choices ?? []).map((ch, i) => (
            <li key={i} className="font-body text-[13px] text-[var(--t1)]">
              {CIRCLED[i]} {ch}
              {answers?.includes(i + 1) ? <strong className="ml-1 text-[var(--p)]">공식 정답</strong> : null}
            </li>
          ))}
        </ol>
      </section>

      {/* ② 현재 분석 · 강의 */}
      <section aria-labelledby="cr-current" className={card}>
        <h2 id="cr-current" className={h2}>현재 분석 · 강의</h2>
        {item?.analysis ? (
          <>
            <p className={`${small} mt-1`}>분석 v{item.analysis.version} · 분석 정답 {item.analysis.answer ?? '없음'}</p>
            {item.analysis.intent ? (
              <p className="mt-2 font-body text-[13px] text-[var(--t2)] break-keep">
                <span className="font-[700]">출제 의도(근거 기반 가설 — 공식 발표 아님):</span> {item.analysis.intent}
              </p>
            ) : null}
            <ul className="mt-2 flex flex-col gap-1.5">
              {item.analysis.choiceVerdicts.map((v) => {
                const conflict = answers?.includes(v.n) && v.verdict !== 'answer'
                return (
                  <li key={v.n} className={`font-body text-[12.5px] leading-snug break-keep ${conflict ? 'text-[var(--error-ink)]' : 'text-[var(--t1)]'}`}>
                    {CIRCLED[v.n - 1]} {v.verdict === 'answer' ? '정답' : '오답'}
                    {conflict ? ' — 공식 정답과 충돌' : ''}: {v.howToReject ?? ''}
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <p className={`${small} mt-1`}>분석 판본을 못 읽었다(없음과 다르다).</p>
        )}
        <h3 className="mt-3 font-display text-[13px] font-[700] text-[var(--t1)]">강의 cue</h3>
        <ol className="mt-1 flex flex-col gap-1">
          {(item?.cues ?? []).map((q) => (
            <li
              key={q.id}
              className={`rounded-[var(--r-md)] px-1.5 py-1 font-body text-[12.5px] leading-snug break-keep ${changedCueIds.has(q.id) ? 'border border-[var(--memory-risk)]' : ''}`}
            >
              <span className="mr-1 font-mono text-[11px] text-[var(--t3)]">{q.id} · {q.role} · {q.target}</span>
              {q.text}
            </li>
          ))}
        </ol>
      </section>

      {/* ③ 수정 후보 · 검증 · 상태 */}
      <div className="col-span-2 grid grid-cols-2 items-start gap-4">
        <section aria-labelledby="cr-change" className={card}>
          <h2 id="cr-change" className={h2}>수정 후보 {c.changes.length}</h2>
          <p className={`${small} mt-1 break-keep`}>{SOURCE_LABEL[c.source]} {c.sourceRef} · {DEFECT_LABEL[c.defect]}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {c.changes.map((ch) => (
              <li key={ch.target} className="font-body text-[12.5px] leading-snug break-keep">
                <p className="font-mono text-[11px] text-[var(--t3)]">{ch.target}{ch.draftRef ? ` · ${ch.draftRef}` : ''}</p>
                {ch.proposed == null ? (
                  <p className="text-[var(--t2)]">제안 문안 없음 — 현재: {ch.current}</p>
                ) : (
                  <p aria-label="수정 전후 낱말 차이">
                    {wordDiff(ch.current, ch.proposed).map((d, i) =>
                      d.op === 'same' ? <span key={i}>{d.text}</span> : d.op === 'del' ? (
                        <del key={i} className="text-[var(--error-ink)]">{d.text}</del>
                      ) : (
                        <ins key={i} className="font-[700] text-[var(--p)] no-underline">{d.text}</ins>
                      ),
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {c.aiEvidence.length ? (
            <p className={`${small} mt-2 break-keep`}>AI 확인 경로(증거일 뿐 승인 아님): {c.aiEvidence.join(' · ')}</p>
          ) : null}
        </section>

        <Prepublish detail={detail} />
        <Binding detail={detail} />
        <StatePanel detail={detail} ledger={ledger} setLedger={setLedger} />
      </div>
    </div>
  )
}

function Prepublish({ detail }: { detail: CandidateDetail }) {
  const now = detail.prepublishNow
  const after = detail.prepublishAfter
  return (
    <section aria-labelledby="cr-pre" className={card}>
      <h2 id="cr-pre" className={h2}>발행 전 검증</h2>
      {!now ? <p className={`${small} mt-1`}>문항 자료가 없어 검증하지 못했다 — 발행 불가.</p> : (
        <>
          <p className="mt-1 font-body text-[13px] text-[var(--t1)]">
            현재 판본: {now.blocked ? <strong className="text-[var(--error-ink)]">차단</strong> : '차단 없음'}
            {after ? <> · 수정 적용 후: {after.blocked ? <strong className="text-[var(--error-ink)]">차단</strong> : '차단 없음'}</> : ' · 적용할 제안 문안 없음'}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {now.findings.map((f, i) => (
              <li key={i} className="font-body text-[12px] leading-snug text-[var(--t2)] break-keep">
                <span className={f.severity === 'BLOCK' ? 'font-[700] text-[var(--error-ink)]' : 'font-[700]'}>{f.severity}</span> {f.where} — {f.message}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function Binding({ detail }: { detail: CandidateDetail }) {
  const b = detail.candidate.binding
  return (
    <section aria-labelledby="cr-bind" className={card}>
      <h2 id="cr-bind" className={h2}>판본 결속</h2>
      <p className="mt-1 font-body text-[13px] text-[var(--t1)]">
        {detail.bindingDrift.length === 0 ? '후보가 묶인 판본 = 현재 판본' : <strong className="text-[var(--error-ink)]">바뀐 칸: {detail.bindingDrift.join(' · ')} — 재검수</strong>}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 font-mono text-[11px] text-[var(--t2)]">
        <dt>item</dt><dd>{b.itemMd5.slice(0, 12)}</dd>
        <dt>분석</dt><dd>v{b.analysisVersion} · {b.analysisMd5.slice(0, 12)}</dd>
        <dt>강의</dt><dd>{b.lectureVersion == null ? '없음' : `v${b.lectureVersion} · ${b.lectureHash}`}</dd>
      </dl>
      {detail.relations.length ? (
        <ul className="mt-2">
          {detail.relations.map((r, i) => (
            <li key={i} className={`${small} break-keep`}>{r.kind}: {r.reason}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function StatePanel({ detail, ledger, setLedger }: { detail: CandidateDetail; ledger: LedgerEntry[]; setLedger: (l: LedgerEntry[]) => void }) {
  const c = detail.candidate
  const [track, setTrack] = useState<ReviewTrack>(c.tracks[0]!)
  const [reviewerId, setReviewerId] = useState(DEMO_REVIEWERS[0]!.id)
  const [reason, setReason] = useState('')
  const [checked, setChecked] = useState<Set<Evidence['kind']>>(new Set())
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => { setTrack(c.tracks[0]!); setMessage(null); setChecked(new Set()) }, [c.id, c.tracks])

  const by = DEMO_REVIEWERS.find((r) => r.id === reviewerId)!
  const state = currentState(ledger, c.id, track)
  const mine = ledger.filter((e) => e.candidateId === c.id)

  function go(to: ReviewState) {
    if (!detail.currentBinding) { setMessage('현재 판본을 모른다 — 상태를 바꾸지 않는다'); return }
    // 증거는 검수자가 **지금 보고 있는 판본**에 묶는다
    const evidence: Evidence[] = [...checked].map((kind) => ({ kind, ref: c.sourceRef, boundHash: bindingHash(detail.currentBinding!) }))
    const r = transition(ledger, { candidate: c, track, to, by, currentBinding: detail.currentBinding, evidence, reason, at: new Date().toISOString() })
    if (!r.ok) { setMessage(r.message); return }
    setLedger([...ledger, r.entry])
    setMessage(`시연 원장 ${r.entry.seq}번: ${STATE_LABEL[r.entry.from]} → ${STATE_LABEL[r.entry.to]}`)
    setReason('')
  }
  function undo(seq: number) {
    const r = revert(ledger, seq, by, reason || '시연 되돌림', new Date().toISOString())
    if (!r.ok) { setMessage(r.message); return }
    setLedger([...ledger, r.entry])
    setMessage(`시연 원장 ${r.entry.seq}번: ${seq}번 되돌림`)
  }

  return (
    <section aria-labelledby="cr-state" className={card}>
      <h2 id="cr-state" className={h2}>상태 · 시연 원장</h2>
      <div className="mt-2 flex flex-col gap-2">
        <label className={small} htmlFor="cr-track">트랙 — 공식 정답과 해설은 따로 승인된다</label>
        <select id="cr-track" className={btn} value={track} onChange={(e) => setTrack(e.target.value as ReviewTrack)}>
          {c.tracks.map((t) => <option key={t} value={t}>{TRACK_LABEL[t]} · {STATE_LABEL[currentState(ledger, c.id, t)]}</option>)}
        </select>
        <label className={small} htmlFor="cr-who">검수자(시연)</label>
        <select id="cr-who" className={btn} value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
          {DEMO_REVIEWERS.map((r) => <option key={r.id} value={r.id}>{REVIEWER_LABEL[r.id]}</option>)}
        </select>
        <fieldset className="flex flex-col gap-1">
          <legend className={small}>판본에 묶인 증거</legend>
          {(Object.keys(EVIDENCE_LABEL) as Evidence['kind'][]).map((k) => (
            <label key={k} className="flex min-h-[44px] cursor-pointer items-center gap-2 font-body text-[12.5px] text-[var(--t1)]">
              <input
                type="checkbox"
                className="h-4 w-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
                checked={checked.has(k)}
                onChange={(e) => {
                  const n = new Set(checked)
                  if (e.target.checked) n.add(k)
                  else n.delete(k)
                  setChecked(n)
                }}
              />
              {EVIDENCE_LABEL[k]}
            </label>
          ))}
        </fieldset>
        <label className={small} htmlFor="cr-reason">사유(필수)</label>
        <textarea id="cr-reason" className={`${btn} py-2`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        <p className="font-body text-[13px] text-[var(--t1)]">지금: <strong>{STATE_LABEL[state]}</strong></p>
        <div className="flex flex-wrap gap-2">
          {TRANSITIONS[state].map((to) => (
            <button key={to} type="button" className={btn} onClick={() => go(to)}>
              → {STATE_LABEL[to]}
            </button>
          ))}
        </div>
        {message ? <p role="status" className="font-body text-[12.5px] text-[var(--t2)] break-keep">{message}</p> : null}
        {mine.length ? (
          <ol className="mt-1 flex flex-col gap-1 border-t border-[var(--bd)] pt-2">
            {mine.map((e) => (
              <li key={e.seq} className="flex items-center justify-between gap-2 font-mono text-[11px] text-[var(--t2)]">
                <span>#{e.seq} {TRACK_LABEL[e.track]} {STATE_LABEL[e.from]}→{STATE_LABEL[e.to]} · {REVIEWER_LABEL[e.by.id] ?? e.by.id}{e.revertsSeq ? ` · ${e.revertsSeq}번 되돌림` : ''}</span>
                {!e.revertsSeq ? (
                  <button type="button" className={`${btn} min-h-[32px] text-[11px]`} onClick={() => undo(e.seq)} aria-label={`${e.seq}번 줄 되돌리기`}>
                    되돌림
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  )
}

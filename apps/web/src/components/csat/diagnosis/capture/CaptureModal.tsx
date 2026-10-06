// apps/web/src/components/csat/diagnosis/capture/CaptureModal.tsx
//
// 풀이 증거 수집 — 오답 원인 Pilot 참가자가 시험 기록을 저장한 뒤, 결과(점수 · 틀린 문항)를 보기 전에 받는다(?tab=records&capture=<세션>).
//   확인 2문항 → 대상 문항마다(번호순 · 정오 표시 없음) 막힌 곳 · 고른 이유 · 「이 부분을 어떻게 이해했나요?」 · 어려웠던 쪽 →
//   저장 뒤 서버가 추가 질문을 돌려주면 그 문항에만 「한 가지만 더 확인할게요」 → 끝나면 결과.
// 학생 화면에 원인 이름 · 경계 · taxonomy · 연구 용어를 쓰지 않는다. 학생이 고른 범주는 과정 증거 하나일 뿐이다(원인으로 바꾸지 않는다).
// 「나중에 하기」는 언제든 결과로 간다(남은 문항은 저장하지 않는다 — 같은 주소로 다시 열면 이어진다).

'use client'

import { ClipboardList, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { track } from '@/lib/analytics/client'
import type { CaptureItem, CaptureState, FinishResult, PendingProbe } from '@/lib/csat/ec-pilot/server'
import { STUDENT_GROUPS, type InterpretationState, type StudentGroup } from '@/lib/csat/ec-pilot/targets'

import s from '../board.module.css'
import { ResultView, type SavedResult } from '../RecordModal'
import { useModalFocus } from '../useModalFocus'
import c from './capture.module.css'

type Blocked = { part: 'passage' | 'stem' | 'option'; option: number | null; sentence: number } | 'none' | null
interface Form { blocked: Blocked; reason: string; mode: InterpretationState | null; text: string; group: StudentGroup | null }
const EMPTY: Form = { blocked: null, reason: '', mode: null, text: '', group: null }
const CIRCLED = ['①', '②', '③', '④', '⑤']

async function call<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string; body?: Record<string, unknown> }> {
  try {
    const res = await fetch(url, init)
    const json = await res.json().catch(() => ({}))
    return res.ok ? { ok: true, data: json as T } : { ok: false, status: res.status, error: (json as { error?: string }).error ?? '저장하지 못했어요', body: json }
  } catch {
    return { ok: false, status: 0, error: '연결이 끊겼어요' }
  }
}
const post = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export function CaptureModal({ sessionId, closeHref, diagnosisBase }: { sessionId: string; closeHref: string; diagnosisBase: string }) {
  const router = useRouter()
  const dialogRef = useModalFocus<HTMLDivElement>()
  const [phase, setPhase] = useState<'loading' | 'confirm' | 'item' | 'probe' | 'result' | 'error'>('loading')
  const [state, setState] = useState<CaptureState | null>(null)
  const [idx, setIdx] = useState(0)
  const [form, setForm] = useState<Form>(EMPTY)
  const [confirm, setConfirm] = useState<{ took: boolean | null; judged: boolean | null }>({ took: null, judged: null })
  const [probe, setProbe] = useState<PendingProbe | null>(null)
  const [probeChoice, setProbeChoice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failedOnce, setFailedOnce] = useState(false)
  const [result, setResult] = useState<SavedResult | null>(null)
  const stats = useRef({ completed: 0, skipped: 0, probes: 0, failures: 0, opened: false })
  const headRef = useRef<HTMLDivElement>(null)

  const items = state?.items ?? []
  const item: CaptureItem | undefined = items[idx]

  const showResult = useCallback(async (outcome: 'done' | 'later') => {
    setBusy(true)
    // 다 마쳤으면 수집을 끝낸다(collecting → completed) — 끝나야 이 회차의 정답 · 점수가 열린다.
    // 「나중에」는 끝내지 않는다(수집은 열린 채로, 보류도 그대로). 수집 대상이 아닌 기록은 'none'
    if (outcome === 'done' && stats.current.opened) {
      const f = await call<FinishResult>('/api/csat/ec/capture', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session: sessionId, action: 'finish' }) })
      if (!f.ok) { setBusy(false); setError(f.error); setPhase('error'); return }
      if (f.data.status === 'collecting') {
        setBusy(false)
        if (f.data.missing === 'confirmation') { setError('결과를 보려면 먼저 아래 두 질문에 답해 주세요.'); setPhase('confirm'); return }
        // 해석이 빠진 문항으로 돌아간다 — 「모르겠어요」를 골라도 된다
        for (const no of f.data.remaining) visited.current.delete(no)
        const back = itemsRef.current.findIndex((i) => f.data.status === 'collecting' && f.data.missing === 'interpretation' && f.data.remaining.includes(i.itemNo))
        if (back >= 0) {
          resetStep(); setIdx(back); setPhase('item')
          setError('결과를 보려면 이 문항의 「읽은 뜻」을 남겨 주세요. 모르겠으면 「모르겠어요」를 골라도 돼요.')
          return
        }
      }
    }
    const r = await call<SavedResult>(`/api/csat/diagnosis/sessions/${sessionId}/result`)
    setBusy(false)
    if (!r.ok && r.status === 423) {
      // 아직 수집 중인 회차(보류) — 오류가 아니라 안내
      setError('이 회차의 결과는 풀이 기록을 다 남긴 뒤에 열려요. 이어서 하려면 다시 열어 주세요.'); setPhase('error'); return
    }
    if (!r.ok) { setError(r.error); setPhase('error'); return }
    if (stats.current.opened) {
      const st = stats.current
      track({ name: 'csat_ec_capture_finished', props: { targets: items.length, completed: st.completed, skipped: st.skipped, probes: st.probes, failures: st.failures, outcome } })
    }
    setResult(r.data)
    // router.refresh() 를 부르지 않는다 — 서버 페이지가 다시 그려지며 이 모달이 새로 마운트되면 건너뛴 문항을 다시 띄운다(e2e 실측).
    // 보드는 「완료」로 돌아갈 때 새로 읽는다
    setPhase('result')
  }, [sessionId, items.length])

  // 지나간 문항(저장 · 건너뜀) · 이미 저장된 문항에 남은 추가 질문 — 다음 단계를 고를 때 쓴다(재개 · 새로고침 뒤에도)
  const visited = useRef(new Set<number>())
  const probeQueue = useRef<PendingProbe[]>([])
  const itemsRef = useRef<CaptureItem[]>([])

  const resetStep = () => { setForm(EMPTY); setError(null); setFailedOnce(false); setProbe(null); setProbeChoice(null) }

  /** 다음 단계: 남은 추가 질문 → 아직 안 지나간 문항 → 결과 */
  const advance = useCallback(() => {
    resetStep()
    const list = itemsRef.current
    const q = probeQueue.current.shift()
    if (q) { setIdx(Math.max(0, list.findIndex((i) => i.itemNo === q.itemNo))); setProbe(q); setPhase('probe'); return }
    const nextIdx = list.findIndex((i) => !visited.current.has(i.itemNo))
    if (nextIdx < 0) { void showResult('done'); return }
    setIdx(nextIdx); setPhase('item')
  }, [showResult])

  // 처음 · 재개 — 저장된 상태로 이어서
  useEffect(() => {
    let alive = true
    void (async () => {
      const r = await call<CaptureState>(`/api/csat/ec/capture?session=${sessionId}`)
      if (!alive) return
      if (!r.ok) {
        // 참가자가 아니거나(404) 대상이 아니면 결과로
        if (r.status === 404) { void showResult('done'); return }
        setError(r.error); setPhase('error'); return
      }
      setState(r.data)
      itemsRef.current = r.data.items
      if (r.data.status !== 'open' || r.data.items.length === 0) { void showResult('done'); return }
      for (const i of r.data.items) if (i.saved.reason && i.saved.interpretation) visited.current.add(i.itemNo)
      // 저장은 끝났는데 추가 질문에 답하기 전에 닫혔던 문항 — 그 질문부터
      const p = await call<{ probes: PendingProbe[] }>(`/api/csat/ec/probes?session=${sessionId}`)
      if (!alive) return
      probeQueue.current = p.ok ? p.data.probes.filter((x) => visited.current.has(x.itemNo)) : []
      const resumed = r.data.confirmed || r.data.items.some((i) => i.saved.reason || i.saved.interpretation)
      stats.current.opened = true
      track({ name: 'csat_ec_capture_opened', props: { targets: r.data.items.length, resumed } })
      if (!r.data.confirmed) { setPhase('confirm'); return }
      advance()
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 세션이 바뀔 때만 다시 연다
  }, [sessionId])

  useEffect(() => { headRef.current?.focus() }, [idx, phase])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) router.push(closeHref) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router, closeHref, busy])

  const fail = (msg: string) => { setError(msg); setFailedOnce(true); stats.current.failures += 1 }

  const saveConfirm = async () => {
    if (confirm.took === null || confirm.judged === null) return
    setBusy(true); setError(null)
    const r = await call(`/api/csat/ec/confirm`, post({ sessionId, tookExam: confirm.took, judgedEach: confirm.took ? confirm.judged : false }))
    setBusy(false)
    if (!r.ok) { fail(r.error); return }
    advance()
  }

  const saveItem = async () => {
    if (!item) return
    // 「내가 이해한 뜻 적기」를 골랐는데 비어 있으면 저장하지 않는다(해석이 빠진 채 완료로 세지 않게)
    if (form.mode === 'answered' && !form.text.trim()) { setError('이해한 뜻을 적거나, 「잘 모르겠어요」 · 「건너뛰기」를 골라 주세요'); return }
    const pieces: Record<string, unknown>[] = []
    if (form.blocked && form.blocked !== 'none') pieces.push({ kind: 'blocked_span', ...form.blocked })
    if (form.reason.trim()) pieces.push({ kind: 'reason', text: form.reason })
    if (form.group) pieces.push({ kind: 'category', group: form.group })
    // 해석은 맨 마지막 — 재개 때 「이유 + 해석」이 있으면 끝난 문항으로 보므로, 앞 조각이 모두 저장된 뒤에만 그 표시가 생기게
    if (form.mode === 'answered') pieces.push({ kind: 'interpretation', state: 'answered', text: form.text })
    if (form.mode === 'unknown' || form.mode === 'skipped') pieces.push({ kind: 'interpretation', state: form.mode })
    setBusy(true); setError(null)
    for (const evidence of pieces) {
      // 같은 값 재전송은 같은 행 · 고친 값은 정정(서버) — 재시도해도 상충 증거가 남지 않는다
      const r = await call(`/api/csat/ec/evidence`, post({ sessionId, itemNo: item.itemNo, evidence }))
      if (!r.ok) { setBusy(false); fail(r.error); return }
    }
    visited.current.add(item.itemNo)
    if (form.reason.trim().length >= 10 && form.mode !== null) stats.current.completed += 1
    else stats.current.skipped += 1
    // 서버가 이 문항에 추가 질문을 요구할 때만 띄운다(화면은 경계를 판단하지 않는다). 조회 실패면 질문 없이 진행
    const p = await call<{ probes: PendingProbe[] }>(`/api/csat/ec/probes?session=${sessionId}`)
    setBusy(false)
    if (!p.ok) stats.current.failures += 1
    const mine = p.ok ? p.data.probes.find((x) => x.itemNo === item.itemNo) : undefined
    if (mine) probeQueue.current.unshift(mine)
    advance()
  }

  const skipItem = () => { if (item) visited.current.add(item.itemNo); stats.current.skipped += 1; advance() }

  const saveProbe = async (option: string | null) => {
    if (!probe) return
    setBusy(true); setError(null)
    const r = await call(`/api/csat/ec/probe`, post({ sessionId, itemNo: probe.itemNo, probeKey: probe.probe.key, probeVersion: probe.probe.version, promptHash: probe.probe.promptHash, option }))
    setBusy(false)
    // 이미 답했거나(중복 복구) · 질문이 바뀌었거나 · 상한이면 질문 없이 진행
    if (r.ok || r.status === 409 || r.status === 404) { if (r.ok) stats.current.probes += 1; advance(); return }
    fail(r.error)
  }

  const saveLabel = items.every((i) => i.itemNo === item?.itemNo || visited.current.has(i.itemNo)) ? '저장하고 마치기' : '저장하고 다음'

  return (
    <div className={s.overlay} role="dialog" aria-modal="true" aria-labelledby="dx-capture-title">
      <div className={s.modal} ref={dialogRef}>
        <div className={s.modalHead}>
          <span className={s.modalTitle}>
            <span className={s.tint} aria-hidden="true"><ClipboardList size={16} /></span>
            <span className="min-w-0">
              <span id="dx-capture-title" className="block truncate">{phase === 'result' ? '이번 시험 결과' : '풀이를 조금만 더 알려 주세요'}</span>
              <span className={s.modalSub}>{phase === 'result' ? '알려 준 풀이는 다음 분석에 쓰여요' : '결과를 보기 전에, 그때 어떻게 생각했는지 적어 주세요'}</span>
            </span>
          </span>
          {phase === 'item' || phase === 'probe' ? <span className={c.progress} aria-live="polite">{idx + 1} / {items.length}</span> : <span aria-hidden="true" />}
          <Link href={closeHref} className={s.modalClose} aria-label="닫기"><X size={18} aria-hidden="true" /></Link>
        </div>

        <div className={s.modalBody}>
          <div ref={headRef} tabIndex={-1} className="sr-only">{phase === 'item' && item ? `${item.itemNo}번` : phase === 'probe' ? '추가 질문' : ''}</div>
          {phase === 'loading' && <section className={s.section}><div className={s.sectionDesc}>불러오는 중…</div></section>}
          {phase === 'error' && (
            <section className={s.section}>
              <div className={s.sectionTitle}>불러오지 못했어요</div>
              <div className={s.sectionDesc}>{error}</div>
              <button type="button" className={c.ghost} disabled={busy} onClick={() => void showResult('later')}>다시 시도</button>
            </section>
          )}
          {phase === 'confirm' && (
            <>
              <YesNo legend="이 시험을 실제 시험처럼 시간을 재고 풀었나요?" value={confirm.took} onChange={(v) => setConfirm({ took: v, judged: v ? confirm.judged : false })} />
              {confirm.took && <YesNo legend="문항마다 선지를 하나씩 따져 보며 답을 골랐나요?" value={confirm.judged} onChange={(v) => setConfirm({ ...confirm, judged: v })} />}
            </>
          )}
          {phase === 'item' && item && <ItemForm item={item} form={form} setForm={setForm} />}
          {phase === 'probe' && probe && <ProbeQuestion probe={probe} choice={probeChoice} onChoose={setProbeChoice} />}
          {phase === 'result' && result && <ResultView result={result} diagnosisHref={`${diagnosisBase}?focus=${sessionId}`} />}
        </div>

        <div className={s.modalFoot}>
          <span className={s.muted}>
            {error && phase !== 'error' && <span role="alert" style={{ color: 'var(--t1)', fontWeight: 700 }}>{error}</span>}
          </span>
          {phase === 'result' ? (
            <Link href={closeHref} className={s.done}>완료</Link>
          ) : phase === 'confirm' ? (
            <span className={c.footActions}>
              <button type="button" className={c.ghost} disabled={busy} onClick={() => void showResult('later')}>나중에 하기</button>
              <button type="button" className={s.done} disabled={busy || confirm.took === null || (confirm.took && confirm.judged === null)} onClick={() => void saveConfirm()}>{failedOnce ? '다시 시도' : '다음'}</button>
            </span>
          ) : phase === 'item' ? (
            <span className={c.footActions}>
              <button type="button" className={c.ghost} disabled={busy} onClick={() => void showResult('later')}>나중에 하기</button>
              <button type="button" className={c.ghost} disabled={busy} onClick={skipItem}>{failedOnce ? '건너뛰고 다음' : '이 문항 건너뛰기'}</button>
              <button type="button" className={s.done} disabled={busy} onClick={() => void saveItem()}>{busy ? '저장하는 중…' : failedOnce ? '다시 시도' : saveLabel}</button>
            </span>
          ) : phase === 'probe' ? (
            <span className={c.footActions}>
              <button type="button" className={c.ghost} disabled={busy} onClick={() => (failedOnce ? advance() : void saveProbe(null))}>{failedOnce ? '넘어가기' : '건너뛰기'}</button>
              <button type="button" className={s.done} disabled={busy || !probeChoice} onClick={() => void saveProbe(probeChoice)}>{failedOnce ? '다시 시도' : '다음'}</button>
            </span>
          ) : <span />}
        </div>
      </div>
    </div>
  )
}

function YesNo({ legend, value, onChange }: { legend: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <section className={s.section}>
      <div className={s.sectionTitle}>{legend}</div>
      <div className={c.pills} role="radiogroup" aria-label={legend}>
        {[[true, '네'], [false, '아니요']].map(([v, label]) => (
          <button key={String(v)} type="button" role="radio" aria-checked={value === v} className={c.pill} onClick={() => onChange(v as boolean)}>{label as string}</button>
        ))}
      </div>
    </section>
  )
}

export type CaptureForm = Form
export const EMPTY_FORM = EMPTY

export function ItemForm({ item, form, setForm }: { item: CaptureItem; form: Form; setForm: (f: Form) => void }) {
  const isBlocked = (part: 'passage' | 'stem' | 'option', option: number | null, sentence: number) =>
    !!form.blocked && form.blocked !== 'none' && form.blocked.part === part && form.blocked.option === option && form.blocked.sentence === sentence
  const toggle = (b: Exclude<Blocked, 'none' | null>) => setForm({ ...form, blocked: isBlocked(b.part, b.option, b.sentence) ? null : b })
  return (
    <>
      <section className={s.section}>
        <div className={s.sectionRow}>
          <div className={s.sectionTitle}>{item.itemNo}번</div>
          <span className={s.chip}>내가 고른 답 {CIRCLED[item.chosen - 1]}</span>
        </div>
        <div className={c.stem}>{item.stem}</div>
        <div className={c.hint}>막혔던 문장이나 선지가 있으면 하나만 눌러 주세요. 없으면 「막힌 곳 없음」을 눌러요.</div>
        {item.passage.length > 0 && (
          <div className={c.passage} lang="en">
            {item.passage.map((p) => (
              <button key={p.sentence} type="button" className={c.sentence} aria-pressed={isBlocked('passage', null, p.sentence)}
                onClick={() => toggle({ part: 'passage', option: null, sentence: p.sentence })}>{p.text}{' '}</button>
            ))}
          </div>
        )}
        <div className={c.choices}>
          {item.choices.map((ch) => (
            <button key={ch.no} type="button" className={c.choiceRow} aria-pressed={isBlocked('option', ch.no, 0)} onClick={() => toggle({ part: 'option', option: ch.no, sentence: 0 })}>
              <span className={c.choiceNo}>{CIRCLED[ch.no - 1]}</span>
              <span>{ch.text}</span>
              {ch.no === item.chosen && <span className={c.mine}>내가 고른 답</span>}
            </button>
          ))}
        </div>
        <div className={c.pills}>
          <button type="button" className={c.pill} aria-pressed={form.blocked === 'none'} onClick={() => setForm({ ...form, blocked: form.blocked === 'none' ? null : 'none' })}>막힌 곳 없음</button>
        </div>
      </section>

      <section className={s.section}>
        <label className={s.field}>
          <span className={s.fieldLabel}>이 답을 고른 이유</span>
          <textarea className={c.textarea} maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <span className={c.hint}>한 문장 이상 적어 주세요. 그때 떠올린 생각 그대로면 돼요.</span>
        </label>
      </section>

      <section className={s.section}>
        <div className={s.sectionTitle} id={`interp-${item.itemNo}`}>막혔던 부분(또는 고른 답의 근거)을 어떻게 이해했나요?</div>
        <div className={c.pills} role="radiogroup" aria-labelledby={`interp-${item.itemNo}`}>
          {([['answered', '내가 이해한 뜻 적기'], ['unknown', '잘 모르겠어요'], ['skipped', '건너뛰기']] as const).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={form.mode === k} className={c.pill} onClick={() => setForm({ ...form, mode: k })}>{label}</button>
          ))}
        </div>
        {form.mode === 'answered' && (
          <label className={s.field}>
            <span className={s.fieldLabel}>내가 이해한 뜻</span>
            <textarea className={c.textarea} maxLength={500} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
            <span className={c.hint}>예: 「그 문장을 ‘~해서 ~했다’로 읽었어요」</span>
          </label>
        )}
      </section>

      <section className={s.section}>
        <div className={s.sectionTitle} id={`group-${item.itemNo}`}>어디가 가장 어려웠나요?</div>
        <div className={c.pills} role="radiogroup" aria-labelledby={`group-${item.itemNo}`}>
          {STUDENT_GROUPS.map((g) => (
            <button key={g.key} type="button" role="radio" aria-checked={form.group === g.key} className={c.pill} onClick={() => setForm({ ...form, group: g.key })}>{g.label}</button>
          ))}
        </div>
      </section>
    </>
  )
}

export function ProbeQuestion({ probe, choice, onChoose }: { probe: PendingProbe; choice: string | null; onChoose: (k: string) => void }) {
  return (
    <section className={s.section}>
      <div>
        <div className={s.sectionTitle}>{probe.probe.intro}</div>
        <div className={s.sectionDesc}>{probe.probe.question}</div>
      </div>
      <div className={c.probeOptions} role="radiogroup" aria-label={probe.probe.question}>
        {(['A', 'B', 'C', 'D'] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={choice === k} className={c.choiceRow} onClick={() => onChoose(k)}>
            <span className={c.choiceNo}>{k}</span>{probe.probe.options[k]}
          </button>
        ))}
      </div>
    </section>
  )
}

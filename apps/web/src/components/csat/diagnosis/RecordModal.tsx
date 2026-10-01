// apps/web/src/components/csat/diagnosis/RecordModal.tsx
//
// 새 시험 기록 모달 — 머리(아이콘 · 제목 · 알약 탭 [시험] [답안] · 닫기), 본문은 섹션 카드, 바닥에 검은 알약 버튼.
//   [시험] 종류 · 학년 · 회차 선택 + 응시일 + 「다시 푼 기출」 토글
//   [답안] 1~45 고른 번호(모르면 비움) — 키보드 1~5 · 0/Backspace · ↑↓
// 저장하면 같은 모달에 점수 · 등급 · 틀린 문항을 보이고 「완료」로 닫는다. 채점은 서버가 정답표로.

'use client'

import { ClipboardList, FileText, LayoutGrid, SlidersHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { track } from '@/lib/analytics/client'
import type { PickerExam } from '@/lib/csat/diagnosis/report'

import s from './board.module.css'
import { AreaBars, ResultGridSection } from './ResultParts'
import { GROUP_TINT, areaTint, gradeTint } from './tints'

type Group = 'hakpyeong' | 'mock' | 'suneung'
const GROUP_LABEL: Record<Group, string> = { hakpyeong: '학력평가', mock: '모의평가', suneung: '수능' }
const groupOf = (e: PickerExam): Group => (e.organizer === 'edu_office' ? 'hakpyeong' : e.kind === 'suneung' ? 'suneung' : 'mock')

export function RecordModal({
  exams,
  today,
  closeHref,
  diagnosisBase,
  endpoint = '/api/csat/diagnosis/sessions',
  userId,
}: {
  exams: PickerExam[]
  today: string
  closeHref: string
  /** 저장 뒤 「진단에서 보기」 — 진단 개요 주소(?focus=<세션> 이 붙는다) */
  diagnosisBase: string
  endpoint?: string
  /** 관리자 대리 기록일 때만 */
  userId?: string
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'exam' | 'sheet'>('exam')
  const [group, setGroup] = useState<Group>('hakpyeong')
  const [grade, setGrade] = useState(1)
  const [examId, setExamId] = useState('')
  const [takenAt, setTakenAt] = useState(today)
  const [retake, setRetake] = useState(false)
  const [choices, setChoices] = useState<Record<number, number | null>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ sessionId: string; raw: number; grade: number | null; wrong: number[] } | null>(null)
  const clientKey = useRef<string>(crypto.randomUUID())
  const lines = useRef<(HTMLDivElement | null)[]>([])

  const options = useMemo(
    () =>
      exams
        .filter((e) => groupOf(e) === group && (group !== 'hakpyeong' || e.grade === grade))
        .sort((a, b) => b.label.localeCompare(a.label, 'ko')),
    [exams, group, grade],
  )
  const exam = exams.find((e) => e.id === examId) ?? null
  const answered = Object.values(choices).filter((v) => v != null).length
  const locked = saving || result !== null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) router.push(closeHref)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router, closeHref, saving])

  const pick = (no: number, v: number | null) => {
    if (locked) return
    setChoices((c) => ({ ...c, [no]: v }))
  }
  const onLineKey = (no: number, e: React.KeyboardEvent) => {
    if (/^[1-5]$/.test(e.key)) {
      e.preventDefault()
      pick(no, Number(e.key))
      if (no < 45) lines.current[no]?.focus()
    } else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      pick(no, null)
    } else if (e.key === 'ArrowDown' && no < 45) {
      e.preventDefault()
      lines.current[no]?.focus()
    } else if (e.key === 'ArrowUp' && no > 1) {
      e.preventDefault()
      lines.current[no - 2]?.focus()
    }
  }

  const save = async () => {
    if (!exam) return
    setSaving(true)
    setError(null)
    try {
      const sheet = Object.fromEntries(Array.from({ length: 45 }, (_, i) => [i + 1, choices[i + 1] ?? null]))
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(userId ? { userId } : {}), examId: exam.id, mode: retake ? 'retake' : 'live', takenAt, clientKey: clientKey.current, choices: sheet }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '저장하지 못했어요')
      setResult({ sessionId: json.sessionId, raw: json.raw, grade: json.grade, wrong: json.wrong ?? [] })
      if (!userId) track({ name: 'csat_dx_attempt_saved', props: { ready: Boolean(json.ready), retake, answered } })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={s.overlay} role="dialog" aria-modal="true" aria-labelledby="dx-modal-title">
      <div className={s.modal}>
        <div className={s.modalHead}>
          <span className={s.modalTitle}>
            <span className={s.tint} style={{ '--tint': result ? gradeTint(result.grade) : GROUP_TINT[group] } as React.CSSProperties} aria-hidden="true">
              {result ? result.grade ?? '–' : <ClipboardList size={16} />}
            </span>
            <span className="min-w-0">
              <span id="dx-modal-title" className="block truncate">{exam ? exam.label : '새 시험 기록'}</span>
              <span className={s.modalSub}>{exam ? `${takenAt}${retake ? ' · 다시 푼 기출' : ''}` : '학력평가 · 모의평가 · 수능'}</span>
            </span>
          </span>
          {result ? <span aria-hidden="true" /> : (
            <nav className={s.modalTabs} aria-label="기록 단계">
              <button type="button" className={s.tab} aria-current={tab === 'exam' ? 'page' : undefined} onClick={() => setTab('exam')}><SlidersHorizontal size={14} aria-hidden="true" />시험</button>
              <button type="button" className={s.tab} aria-current={tab === 'sheet' ? 'page' : undefined} onClick={() => exam && setTab('sheet')} disabled={!exam}>
                <FileText size={14} aria-hidden="true" />답안{answered ? <span className={s.tabCount}>{answered}</span> : null}
              </button>
            </nav>
          )}
          <Link href={closeHref} className={s.modalClose} aria-label="닫기"><X size={18} aria-hidden="true" /></Link>
        </div>

        <div className={s.modalBody}>
          {result && exam ? (
            <ResultView result={result} diagnosisHref={`${diagnosisBase}?focus=${result.sessionId}`} />
          ) : tab === 'exam' ? (
            <>
              <section className={s.section}>
                <div className={s.sectionRow} style={{ justifyContent: 'flex-start' }}>
                  <span className={s.tint} style={{ '--tint': GROUP_TINT[group] } as React.CSSProperties} aria-hidden="true">{GROUP_LABEL[group].slice(0, 1)}</span>
                  <div>
                    <div className={s.sectionTitle}>시험</div>
                    <div className={s.sectionDesc}>푼 시험의 종류와 회차를 골라 주세요. 정답표가 있는 회차만 보여요.</div>
                  </div>
                </div>
                <div className={s.fieldRow}>
                  <label className={s.field}>
                    <span className={s.fieldLabel}>종류</span>
                    <select className={s.select} value={group} onChange={(e) => { setGroup(e.target.value as Group); setExamId('') }}>
                      {(Object.keys(GROUP_LABEL) as Group[]).map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
                    </select>
                  </label>
                  {group === 'hakpyeong' && (
                    <label className={s.field}>
                      <span className={s.fieldLabel}>학년</span>
                      <select className={s.select} value={grade} onChange={(e) => { setGrade(Number(e.target.value)); setExamId('') }}>
                        {[1, 2, 3].map((g) => <option key={g} value={g}>고{g}</option>)}
                      </select>
                    </label>
                  )}
                  <label className={s.field} style={group === 'hakpyeong' ? undefined : { gridColumn: 'span 2' }}>
                    <span className={s.fieldLabel}>회차</span>
                    <select className={s.select} value={examId} onChange={(e) => setExamId(e.target.value)}>
                      <option value="">회차 선택</option>
                      {options.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                    </select>
                  </label>
                </div>
              </section>
              <section className={s.section}>
                <label className={s.field} style={{ maxWidth: 240 }}>
                  <span className={s.fieldLabel}>응시일</span>
                  <input type="date" className={s.input} value={takenAt} max={today} onChange={(e) => setTakenAt(e.target.value)} />
                </label>
              </section>
              <section className={s.section}>
                <div className={s.sectionRow}>
                  <div>
                    <div className={s.sectionTitle}>다시 푼 기출</div>
                    <div className={s.sectionDesc}>이미 풀어 본 시험을 다시 푼 거라면 켜 주세요. 점수 흐름에는 보이되 유형 진단에는 넣지 않아요.</div>
                  </div>
                  <button type="button" role="switch" aria-checked={retake} aria-label="다시 푼 기출" className={s.toggle} onClick={() => setRetake(!retake)}>
                    <span />
                  </button>
                </div>
              </section>
            </>
          ) : (
            <section className={s.section}>
              <div>
                <div className={s.sectionTitle}>답안</div>
                <div className={s.sectionDesc}>고른 번호를 눌러 주세요. 모르면 비워 두면 돼요. 줄을 누르고 숫자 키 1–5 로도 적을 수 있어요.</div>
              </div>
              <div className={s.miniSheet}>
                {[
                  [1, 23],
                  [24, 45],
                ].map(([from, to]) => (
                  <div key={from}>
                    <div className={s.sheetColHead}>
                      <span>{from}–{to}</span>
                      <span className={s.areaChips}>
                        {(from === 1
                          ? [['듣기 1–17', 1], ['독해', 18]]
                          : [['독해 –40', 24], ['장문 41–45', 41]]
                        ).map(([label, no]) => (
                          <span key={label as string} className={s.areaChip} style={{ '--tint': areaTint(no as number) } as React.CSSProperties}>{label as string}</span>
                        ))}
                      </span>
                    </div>
                    {Array.from({ length: to - from + 1 }, (_, k) => from + k).map((no) => (
                      <div
                        key={no}
                        ref={(el) => {
                          lines.current[no - 1] = el
                        }}
                        className={s.line}
                        style={{ '--tint': areaTint(no) } as React.CSSProperties}
                        tabIndex={0}
                        onKeyDown={(e) => onLineKey(no, e)}
                        aria-label={`${no}번${choices[no] ? ` ${choices[no]}번 고름` : ' 비어 있음'}`}
                      >
                        <span className={s.lineNo}>{no}</span>
                        <div className={s.bubbles} role="radiogroup" aria-label={`${no}번 답`}>
                          {[1, 2, 3, 4, 5].map((v) => (
                            <button
                              key={v}
                              type="button"
                              role="radio"
                              aria-checked={choices[no] === v}
                              aria-label={`${no}번 ${v}`}
                              tabIndex={-1}
                              disabled={locked}
                              className={s.bubble}
                              onClick={() => pick(no, choices[no] === v ? null : v)}
                            >
                              <span>{v}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className={s.modalFoot}>
          <span className={s.muted}>
            {result ? '진단에 반영했어요' : tab === 'sheet' ? `${answered} / 45 적음` : `${options.length}개 회차`}
            {error && <span role="alert" style={{ marginLeft: 12, color: 'var(--t1)', fontWeight: 700 }}>{error}</span>}
          </span>
          {result ? (
            <span style={{ display: 'flex', gap: 8 }}>
              <Link href={closeHref} className={s.done}>완료</Link>
            </span>
          ) : tab === 'exam' ? (
            <button type="button" className={s.done} disabled={!exam} onClick={() => setTab('sheet')}>다음</button>
          ) : (
            <button type="button" className={s.done} disabled={saving || answered === 0} onClick={save}>
              {saving ? '채점하는 중…' : '채점하고 저장'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** 저장 직후 — 진단 연결 카드 · 점수와 영역 막대 · 45칸 결과판 */
function ResultView({ result, diagnosisHref }: { result: { raw: number; grade: number | null; wrong: number[] }; diagnosisHref: string }) {
  return (
    <>
      <section className={s.linkCard}>
        <div>
          <div className={s.sectionTitle}>진단에 반영했어요</div>
          <div className={s.sectionDesc}>이 시험이 점수 흐름 · 약한 유형에 어떻게 들어갔는지 바로 볼 수 있어요.</div>
        </div>
        <Link href={diagnosisHref} className={s.linkBtn}><LayoutGrid size={14} aria-hidden="true" />진단에서 보기</Link>
      </section>
      <section className={s.section}>
        <div className={s.sectionRow}>
          <div>
            <div className={s.sectionTitle}>점수</div>
            <div className={s.sectionDesc}>45문항 중 {45 - result.wrong.length}문항 맞음</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            <span className={s.big} style={{ fontSize: 34, marginTop: 0 }}>{result.raw}<span className={s.bigSub}>점</span></span>
            <span className={`${s.tint} ${s.tintRound}`} style={{ '--tint': gradeTint(result.grade), width: 40, height: 40, fontSize: 14 } as React.CSSProperties}>
              {result.grade ?? '–'}
            </span>
          </span>
        </div>
        <AreaBars wrong={result.wrong} />
      </section>
      <ResultGridSection wrong={result.wrong} />
    </>
  )
}

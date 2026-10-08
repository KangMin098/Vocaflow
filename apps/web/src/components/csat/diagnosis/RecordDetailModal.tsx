// apps/web/src/components/csat/diagnosis/RecordDetailModal.tsx
//
// 기록 한 회 팝업 — 탭 [요약] [답안] [틀린 문항]. 맨 위 「진단에서 보기」 카드가 진단 개요로 바로 잇는다
// (그 시험이 점수 흐름에서 강조되고 바닥에 선택 표시가 뜬다). 맨 아래 「기록 삭제」(두 번 눌러 확인).
//   요약 = 설정 카드형 · 답안 = 파일 편집기형(45줄) · 틀린 문항 = 검색 + 표(유형 아바타 · 칩)

'use client'

import { Crosshair, FileText, LayoutGrid, Search, SlidersHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import type { ExamReport, WrongItem } from '@/lib/csat/diagnosis/engine/exam-report'
import { toItemSlug } from '@/lib/csat/item-slug'

import s from './board.module.css'
import { useModalFocus } from './useModalFocus'
import { AreaBars, ResultGridSection } from './ResultParts'
import { areaTint, familyTint, gradeTint } from './tints'

type Trend = ExamReport['trend'][number]
const CIRCLED = ['', '①', '②', '③', '④', '⑤']

/** 연결 카드 바탕 — 접근 지도처럼 옅은 선과 상자 */
function LinkArt() {
  return (
    <svg className={s.linkCardArt} viewBox="0 0 600 90" preserveAspectRatio="none" aria-hidden="true">
      <path d="M250 10 C 300 40, 330 70, 380 85" stroke="var(--bd)" fill="none" />
      <path d="M380 20 C 430 25, 470 60, 520 70" stroke="var(--bd)" fill="none" strokeDasharray="3 4" />
      <rect x="300" y="2" width="90" height="22" rx="6" fill="var(--bg3)" />
      <rect x="470" y="62" width="110" height="24" rx="6" fill="var(--bg3)" />
      <rect x="520" y="4" width="70" height="16" rx="6" fill="var(--bg3)" />
    </svg>
  )
}

export function RecordDetailModal({
  record,
  wrongs,
  typeNames,
  closeHref,
  diagnosisHref,
  deleteEndpoint,
}: {
  record: Trend
  wrongs: WrongItem[]
  typeNames: Record<string, string>
  closeHref: string
  /** 진단 개요에서 이 시험을 강조해 여는 주소 */
  diagnosisHref: string
  deleteEndpoint: string
}) {
  const router = useRouter()
  const dialogRef = useModalFocus<HTMLDivElement>()
  const [tab, setTab] = useState<'summary' | 'sheet' | 'wrong'>('summary')
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = (id: string) => typeNames[id] ?? id

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) router.push(closeHref)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router, closeHref, busy])

  const remove = async () => {
    if (!confirm) {
      setConfirm(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(deleteEndpoint, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? '삭제하지 못했어요')
      router.push(closeHref)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제하지 못했어요')
      setBusy(false)
    }
  }

  const shown = wrongs.filter((w) => !q.trim() || String(w.no) === q.trim() || name(w.typeId).includes(q.trim()) || (w.trap ?? '').includes(q.trim()))
  const sheetText = record.answers
    .map((a) => `${String(a.no).padStart(2, ' ')}  ${a.chosen ? CIRCLED[a.chosen] : '·'}  ${a.correct ? '' : '✕'}`)
    .join('\n')

  return (
    <div className={s.overlay} role="dialog" aria-modal="true" aria-labelledby="dx-detail-title">
      <div className={s.modal} ref={dialogRef}>
        <div className={s.modalHead}>
          <span className={s.modalTitle}>
            <span className={`${s.tint} ${s.tintRound}`} style={{ '--tint': gradeTint(record.grade) } as React.CSSProperties} aria-hidden="true">{record.grade ?? '–'}</span>
            <span className="min-w-0">
              <span id="dx-detail-title" className="block truncate">{record.label}</span>
              <span className={s.modalSub}>{record.takenAt} · {record.raw}점 · {record.grade ?? '—'}등급</span>
            </span>
          </span>
          <nav className={s.modalTabs} aria-label="기록 보기">
            <button type="button" className={s.tab} aria-current={tab === 'summary' ? 'page' : undefined} onClick={() => setTab('summary')}>
              <SlidersHorizontal size={14} aria-hidden="true" />요약
            </button>
            <button type="button" className={s.tab} aria-current={tab === 'sheet' ? 'page' : undefined} onClick={() => setTab('sheet')}>
              <FileText size={14} aria-hidden="true" />답안
            </button>
            <button type="button" className={s.tab} aria-current={tab === 'wrong' ? 'page' : undefined} onClick={() => setTab('wrong')}>
              <Crosshair size={14} aria-hidden="true" />틀린 문항<span className={s.tabCount}>{wrongs.length}</span>
            </button>
          </nav>
          <Link href={closeHref} className={s.modalClose} aria-label="닫기"><X size={18} aria-hidden="true" /></Link>
        </div>

        <div className={s.modalBody}>
          {tab === 'summary' && (
            <>
              <section className={s.linkCard}>
                <LinkArt />
                <div>
                  <div className={s.sectionTitle}>진단</div>
                  <div className={s.sectionDesc}>이 시험이 점수 흐름 · 약한 유형에 어떻게 반영됐는지 한 화면에서 봐요.</div>
                </div>
                <Link href={diagnosisHref} className={s.linkBtn}><LayoutGrid size={14} aria-hidden="true" />진단에서 보기</Link>
              </section>
              <section className={s.section}>
                <div>
                  <div className={s.sectionTitle}>기록</div>
                  <div className={s.sectionDesc}>채점 결과와 응시 정보예요.</div>
                </div>
                <div className={s.kv}>
                  <div className={s.kvRow}>
                    <span>등급</span>
                    <span className={`${s.tint} ${s.tintRound}`} style={{ '--tint': gradeTint(record.grade) } as React.CSSProperties}>{record.grade ?? '–'}</span>
                  </div>
                  <div className={s.kvRow}>
                    <span>점수</span>
                    <span className={`${s.kvValue} ${s.num}`}>{record.raw}점 · 오답 {record.wrong}</span>
                  </div>
                  <div className={s.kvRow}>
                    <span>응시일</span>
                    <span className={`${s.kvValue} ${s.num}`}>{record.takenAt}</span>
                  </div>
                  <div className={s.kvRow}>
                    <span>방식</span>
                    <span className={s.kvValue}>{record.mode === 'retake' ? '다시 푼 기출 — 유형 진단에서 빠져요' : '실제 응시'}</span>
                  </div>
                </div>
              </section>
              <section className={s.section}>
                <div>
                  <div className={s.sectionTitle}>영역별 정답률</div>
                  <div className={s.sectionDesc}>듣기 · 독해 · 장문으로 나눠 봐요.</div>
                </div>
                <AreaBars wrong={record.answers.filter((x) => !x.correct).map((x) => x.no)} />
              </section>
              <ResultGridSection wrong={record.answers.filter((x) => !x.correct).map((x) => x.no)} />
              <section className={s.section}>
                <div className={s.sectionRow}>
                  <div>
                    <div className={s.sectionTitle}>기록 삭제</div>
                    <div className={s.sectionDesc}>
                      {confirm ? '한 번 더 누르면 지워져요. 되돌릴 수 없어요.' : '이 시험의 답안을 지우고 진단을 다시 계산해요.'}
                    </div>
                    {error && <div role="alert" className={s.sectionDesc} style={{ color: '#dc2626' }}>{error}</div>}
                  </div>
                  <button type="button" className={s.danger} disabled={busy} onClick={remove}>
                    {busy ? '지우는 중…' : confirm ? '정말 삭제' : '기록 삭제'}
                  </button>
                </div>
              </section>
            </>
          )}

          {tab === 'sheet' && (
            <div className={s.editor}>
              <div className={s.editorBar}>
                <span className={s.filePill}>
                  <span className={s.filePillNum}>45</span>
                  <FileText size={13} aria-hidden="true" />답안지
                </span>
                <span className={s.muted}>✕ = 틀림 · · = 비움</span>
              </div>
              <pre className={s.code} aria-label="번호별 고른 답">{sheetText}</pre>
            </div>
          )}

          {tab === 'wrong' && (
            <section className={s.section}>
              <div>
                <div className={s.sectionTitle}>틀린 문항</div>
                <div className={s.sectionDesc}>문항을 누르면 해설로, 유형을 누르면 진단의 유형 탭으로 가요.</div>
              </div>
              <label className={s.search} style={{ width: '100%', minHeight: 48 }}>
                <Search size={15} aria-hidden="true" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="번호 · 유형 · 함정으로 찾기" aria-label="틀린 문항 찾기" />
              </label>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr><th>문항</th><th>유형 · 함정</th></tr>
                  </thead>
                  <tbody>
                    {shown.map((w) => (
                      <tr key={w.no}>
                        <td>
                          <span className={s.who}>
                            <span className={s.tint} style={{ '--tint': areaTint(w.no) } as React.CSSProperties}>{w.no}</span>
                            <span>
                              {w.itemId ? <Link className={s.rowLink} style={{ minHeight: 0 }} href={`/csat/item/${toItemSlug(w.itemId)}`}>{w.no}번 해설</Link> : `${w.no}번`}
                              <span className={s.whoSub}>고른 답 {w.chosen ? CIRCLED[w.chosen] : '비움'}</span>
                            </span>
                          </span>
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
                            <Link className={`${s.tagChip} ${s.tintChip}`} style={{ '--tint': areaTint(w.no) } as React.CSSProperties} href={`${diagnosisHref.split('?')[0]}?tab=records&view=types`}>{name(w.typeId)}</Link>
                            {w.trap && (
                              <span className={`${s.tagChip} ${s.tintChip}`} style={{ '--tint': familyTint(w.family) } as React.CSSProperties}>
                                <Crosshair size={11} aria-hidden="true" />{w.trap}
                              </span>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {shown.length === 0 && (
                      <tr><td colSpan={2} className={s.muted}>{wrongs.length ? '찾는 문항이 없어요.' : '다 맞았어요.'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <div className={s.modalFoot}>
          <span className={s.muted}>틀린 문항 {wrongs.length}</span>
          <Link href={closeHref} className={s.done}>완료</Link>
        </div>
      </div>
    </div>
  )
}

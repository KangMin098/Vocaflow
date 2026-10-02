// apps/web/src/components/csat/diagnosis/map/NodePopup.tsx
//
// 학습 지도 팝업 — 노드를 누르면 하나만 열린다. 참조(3B 앱)의 모달 형태: 가운데 모달 · 헤더(아이콘 타일 · 이름 · 알약 탭 · 닫기) ·
// 옅은 바탕의 둥근 카드 · 하단 검은 알약 버튼. 탭 넷 = 섹션 넷:
//   목표(목표율 · 계산 근거 문항) · 달성(성취율 · 근거 데이터 수) · 현 상태(차이 · 과제 순서 · 완료 체크) · 근거(출처 · 근거 유형)
// 같은 정보를 두 곳에 두지 않는다 — 지도의 노드는 막대와 상태만, 근거 문장과 과제는 여기에만.

'use client'

import { BookOpenCheck, Gauge, ListChecks, Target, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { MapPageData } from '@/lib/csat/map/load'

import { useModalFocus } from '../useModalFocus'

import { BASIS_LABEL, EDGE_KIND_LABEL, KIND_LABEL, STATUS_LABEL, pct, shortExam, toneOf } from './format'
import s from './map.module.css'

type TabKey = 'goal' | 'reached' | 'now' | 'basis'

const TABS: { key: TabKey; label: string; Icon: typeof Target }[] = [
  { key: 'goal', label: '목표', Icon: Target },
  { key: 'reached', label: '달성', Icon: Gauge },
  { key: 'now', label: '현 상태', Icon: ListChecks },
  { key: 'basis', label: '근거', Icon: BookOpenCheck },
]

const TONE_TEXT = { met: s.sMet, near: s.sNear, short: s.sShort, muted: '' } as const

/** 노드 종류별 아이콘 타일 색 — 라인은 접근 트랙 색, 나머지는 중립 */
export function tileClass(kind: string, trackCode: string | null | undefined): string {
  if (kind === 'track' || kind === 'line') return trackCode === 'T1' ? s.tileT1 : trackCode === 'T2' ? s.tileT2 : trackCode === 'T3' ? s.tileT3 : s.tileNeutral
  return s.tileNeutral
}

export function NodePopup({
  data,
  code,
  done,
  taskError,
  onToggle,
  onClose,
  onOpenNode,
}: {
  data: MapPageData
  code: string
  done: ReadonlySet<string>
  taskError: string | null
  onToggle: (taskId: string, next: boolean) => void
  onClose: () => void
  onOpenNode: (code: string) => void
}) {
  const dialogRef = useModalFocus<HTMLDivElement>()
  const [tab, setTab] = useState<TabKey>('goal')
  const model = data.model
  const node = data.nodes.find((n) => n.code === code)
  const value = model.nodes[code]

  // 다른 노드로 옮겨 가면 첫 탭부터
  useEffect(() => {
    setTab('goal')
  }, [code])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!node || !value) return null
  const nameOf = (c: string) => data.nodes.find((n) => n.code === c)?.name ?? c
  const srcById = new Map(data.sources.map((x) => [x.id, x]))
  const isLine = node.kind === 'line'
  const hasTarget = value.target !== null
  const tone = toneOf(value.status)
  const gap = hasTarget && value.achieved !== null ? value.target! - value.achieved : null
  const lineTasks = data.tasks.filter((t) => t.line_code === code)
  const edges = data.edges.filter((e) => e.from_code === code || e.to_code === code)
  const edgeCounts = edges.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.basis]: (acc[e.basis] ?? 0) + 1 }), {})
  const trackName = node.track ? nameOf(node.track) : null

  // 집계 노드: 먼저 볼 라인 — 목표까지 격차가 큰 순
  const childLines = isLine ? [] : data.nodes.filter((n) => n.kind === 'line' && linesOfNode(data, node.code).includes(n.code))
  const focus = childLines
    .map((l) => ({ l, v: model.nodes[l.code] }))
    .filter(({ v }) => v.target !== null && v.achieved !== null && v.target - v.achieved > 1e-9)
    .sort((a, b) => b.v.target! - b.v.achieved! - (a.v.target! - a.v.achieved!))
    .slice(0, 4)

  return (
    <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className={s.modal} role="dialog" aria-modal="true" aria-labelledby="map-popup-title">
        <div className={s.modalHead}>
          <div className={s.modalWho}>
            <span className={`${s.tile} ${s.tileNeutral} ${s.tileHead}`} aria-hidden="true">
              {node.code === 'GOAL' ? '◎' : node.code}
            </span>
            <h2 id="map-popup-title" className={s.modalTitle}>{node.name}</h2>
          </div>
          <div className={s.pillTabs} role="tablist" aria-label="팝업 구역">
            {TABS.map(({ key, label, Icon }) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={s.pillTab} onClick={() => setTab(key)}>
                <span className={`${s.pillTabIn} ${tab === key ? s.pillTabOn : ''}`}>
                  <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
                  {label}
                </span>
              </button>
            ))}
          </div>
          <button type="button" className={s.close} onClick={onClose} aria-label="팝업 닫기">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className={s.modalBody} role="tabpanel">
          {tab === 'goal' && (
            <>
              <Card
                title="목표율"
                desc={`${KIND_LABEL[node.kind]}${trackName ? ` · ${trackName}` : ''} — ${isLine ? '반드시 맞혀야 하는 문항의 배점 비율이에요.' : '연결된 라인의 배점 가중 평균이에요.'}`}
              >
                {hasTarget ? (
                  <div className={s.big}>{pct(value.target)}</div>
                ) : (
                  <p className={`${s.p} ${s.muted}`}>{value.status === 'tasks_only' ? '문항과 연결되지 않아 목표율 대신 과제 완료율로 봐요.' : value.note ?? '연결 문항이 없어요.'}</p>
                )}
                {hasTarget && (
                  <p className={s.p}>
                    목표 {model.goal}점 · 기준 시험 {model.reference.exams.length}회
                    {model.reference.shortfall > 0 ? ` (원하는 ${model.reference.wanted}회 중 적격 시험이 모자라요)` : ''}
                  </p>
                )}
              </Card>
              <Card title="기준 시험" desc="정답표가 완전한 평가원 시험 중 최근 순이에요.">
                <p className={s.p}>{model.reference.exams.map((e) => shortExam(e.label)).join(' · ') || '없음'}</p>
                {model.reference.skipped.length > 0 && <p className={`${s.p} ${s.muted}`}>정답표가 완전하지 않아 건너뜀: {model.reference.skipped.map(shortExam).join(' · ')}</p>}
              </Card>
              {model.goal < 100 && (
                <div className={s.warn}>
                  놓쳐도 되는 문항은 <strong>EBSi 응답자 집계</strong>의 오답률(시험별 상위 15문항)로 정해요 — 평가원 공식 오답률이 아니에요.
                  {model.missingRate > 0 && model.mayOverstate ? ' 오답률이 없는 문항은 모두 반드시로 계산해서 목표율이 실제보다 높을 수 있어요.' : ''}
                </div>
              )}
              {isLine && value.mustItems.length > 0 && (
                <Card title={`반드시 맞혀야 하는 문항 ${value.mustItems.length}개`} desc="목표율 계산에 들어간 문항이에요.">
                  <div className={s.tableWrap}>
                    <table className={s.table}>
                      <thead>
                        <tr><th>시험</th><th>번호</th><th>배점</th><th>오답률</th></tr>
                      </thead>
                      <tbody>
                        {value.mustItems.map((i) => (
                          <tr key={`${i.examId}#${i.no}`}>
                            <td>{shortExam(model.reference.exams.find((e) => e.id === i.examId)?.label ?? i.examId)}</td>
                            <td>{i.no}</td>
                            <td>{i.points}점</td>
                            <td>{i.errorRate === null ? '미관측' : pct(i.errorRate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}

          {tab === 'reached' && (
            <>
              <Card title="현재 성취율" desc="최신 진단 기록 기준이에요.">
                <div className={`${s.big} ${TONE_TEXT[tone]}`}>{value.achieved !== null ? pct(value.achieved) : '—'}</div>
                <p className={s.p}>
                  <strong className={TONE_TEXT[tone]}>{STATUS_LABEL[value.status]}</strong>
                  {value.note && value.note !== STATUS_LABEL[value.status] ? ` · ${value.note}` : ''}
                  {value.coverage !== null && value.coverage < 1 && value.status !== 'no_items' ? ` · 진단된 라인 ${Math.round(value.coverage * 100)}%` : ''}
                </p>
              </Card>
              <Card title="근거 데이터" desc="이 값이 얼마나 쌓인 기록에서 나왔는지예요.">
                <p className={s.p}>{value.n !== null ? `${isLine ? '관측' : '관측 합계(중복 포함)'} ${value.n}건` : '관측 건수 없음'}</p>
                {model.evidence && <p className={`${s.p} ${s.muted}`}>기록 전체 기준: 시험 {model.evidence.examSessions}회 · 응답 {model.evidence.responses}개</p>}
              </Card>
              <Card title="추세" desc="진단이 쌓이면 보여요.">
                <p className={`${s.p} ${s.muted}`}>지도 지표를 담은 진단이 둘 이상일 때 변화를 보여 줘요.</p>
              </Card>
              {value.tasks.total > 0 && (
                <Card title="과제 완료" desc="이 노드에 연결된 과제예요.">
                  <p className={s.p}>
                    {value.tasks.done} / {value.tasks.total}
                    {value.tasks.rate !== null ? ` (${pct(value.tasks.rate)})` : ''}
                  </p>
                </Card>
              )}
            </>
          )}

          {tab === 'now' && (
            <>
              <Card title="목표와의 차이" desc="목표율 눈금과 지금 성취율의 차이예요.">
                {gap !== null ? (
                  <p className={s.p}>
                    {gap > 1e-9 ? `목표까지 ${Math.round(gap * 100)}%p 남았어요${value.status === 'hold' ? ' (추정 — 진단 안 된 라인이 있어요)' : ''}.` : '목표에 닿았어요.'}
                  </p>
                ) : (
                  <p className={`${s.p} ${s.muted}`}>{hasTarget ? '진단이 쌓이면 목표와의 차이를 보여 줘요.' : '목표와의 차이는 문항에 연결된 라인에서만 보여요.'}</p>
                )}
                {isLine && value.habit !== null && (
                  <p className={s.p}>
                    습관 신호: <strong>{value.habit === 'active' ? '신호 있음' : value.habit === 'resolved' ? '해소됨' : '판단 불가'}</strong>
                    {value.habitBasis ? ` (관측 ${value.habitBasis.n} / 필요 ${value.habitBasis.need})` : ''}
                    {value.habit === 'unknown' ? ' — 지금 근거로는 신호가 없다고 확정할 수 없어요.' : ''}
                  </p>
                )}
              </Card>
              {isLine ? (
                lineTasks.length > 0 && (
                  <Card title="차이를 줄이는 과제" desc="순서대로 하나씩 — 끝낸 것은 체크해요.">
                    <ol className={s.tasks}>
                      {lineTasks.map((t) => {
                        const checked = done.has(t.id)
                        return (
                          <li key={t.id} className={`${s.task} ${checked ? s.taskDone : ''}`}>
                            <label className={s.taskBox}>
                              <input type="checkbox" checked={checked} onChange={(e) => onToggle(t.id, e.target.checked)} aria-label={`${t.title} 완료`} />
                            </label>
                            <div>
                              <div className={s.taskTitle}>
                                {t.ord}. {t.title}
                                <span className={t.material === 'past' ? s.matPast : s.matCore}>{t.material === 'past' ? '기출' : '본질'}</span>
                              </div>
                              <div className={s.taskMeta}>{t.how}</div>
                              <div className={s.taskMeta}>
                                {t.cadence} · 완료 기준: {t.done_when}
                                {t.method_line ? ` · 방법: ${nameOf(t.method_line)}` : ''}
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                    {taskError && <div className={s.err} role="alert">{taskError}</div>}
                  </Card>
                )
              ) : (
                focus.length > 0 && (
                  <Card title="먼저 볼 라인" desc="목표까지 격차가 큰 순이에요.">
                    <ul className={s.list}>
                      {focus.map(({ l, v }) => (
                        <li key={l.code}>
                          <button type="button" className={s.linkBtn} onClick={() => onOpenNode(l.code)}>
                            {l.code} {l.name}
                          </button>
                          <span className={s.muted}> · 목표 {pct(v.target)} · 지금 {pct(v.achieved)}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )
              )}
            </>
          )}

          {tab === 'basis' && (
            <>
              {(isLine ? node.why : node.summary) && (
                <Card title={isLine ? '왜 이렇게 분류했나' : '설명'}>
                  <p className={s.p}>{(isLine ? node.why : node.summary)!.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}</p>
                  {isLine && node.signal && <p className={`${s.p} ${s.muted}`}>진단에서 보는 지표: {node.signal}</p>}
                </Card>
              )}
              <Card title="이 노드의 출처" desc="출처가 없으면 보류로 둬요.">
                {(data.nodeSources[code] ?? []).length === 0 ? (
                  <p className={`${s.p} ${s.muted}`}>출처가 없어 <strong>보류</strong>로 두었어요.</p>
                ) : (
                  <ul className={s.list}>
                    {(data.nodeSources[code] ?? []).map((id) => {
                      const src = srcById.get(id)
                      return src ? <SourceRow key={id} src={src} /> : null
                    })}
                  </ul>
                )}
              </Card>
              <Card title={`연결선 ${edges.length}개`} desc={(['direct', 'inferred', 'pending'] as const).map((b) => `${BASIS_LABEL[b]} ${edgeCounts[b] ?? 0}`).join(' · ')}>
                <ul className={s.list}>
                  {edges.slice(0, 8).map((e) => {
                    const ids = data.edgeSources[e.id] ?? []
                    return (
                      <li key={e.id}>
                        {e.from_code} {nameOf(e.from_code)} → {e.to_code} {nameOf(e.to_code)}
                        <span className={s.muted}> · {EDGE_KIND_LABEL[e.kind]} · {BASIS_LABEL[e.basis]}</span>
                        {ids.length > 0 ? <div className={s.src}>{ids.map((id) => srcById.get(id)?.citation ?? id).join(' / ')}</div> : <div className={`${s.src} ${s.muted}`}>출처 없음 — 보류</div>}
                      </li>
                    )
                  })}
                </ul>
                {edges.length > 8 && <p className={`${s.p} ${s.muted}`}>그 밖 {edges.length - 8}개는 같은 방식이에요.</p>}
              </Card>
            </>
          )}
        </div>

        <div className={s.modalFoot}>
          <button type="button" className={s.pillBtn} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className={s.card}>
      <div className={s.cardTitle}>{title}</div>
      {desc && <div className={s.cardDesc}>{desc}</div>}
      <div className={s.cardBody}>{children}</div>
    </section>
  )
}

function SourceRow({ src }: { src: MapPageData['sources'][number] }) {
  return (
    <li>
      <span className={`${s.srcStatus} ${src.status === 'verified' ? s.srcOk : s.srcReview}`}>{src.status === 'verified' ? '확인됨' : '검토 필요'}</span>
      <span className={s.src}>{src.citation}</span>
      <div className={`${s.src} ${s.muted}`}>{src.supports}</div>
    </li>
  )
}

/** 노드에 연결된 라인 코드(집계 노드의 「먼저 볼 라인」 용) — model.ts 의 연결 규칙과 같다 */
function linesOfNode(data: MapPageData, code: string): string[] {
  const n = data.nodes.find((x) => x.code === code)
  const lines = data.nodes.filter((x) => x.kind === 'line')
  if (!n) return []
  if (n.kind === 'goal') return lines.map((l) => l.code)
  if (n.kind === 'axis') return lines.filter((l) => l.axis === code).map((l) => l.code)
  if (n.kind === 'track') return lines.filter((l) => l.track === code).map((l) => l.code)
  return data.edges.filter((e) => e.kind === 'reason' && e.to_code === code).map((e) => e.from_code)
}

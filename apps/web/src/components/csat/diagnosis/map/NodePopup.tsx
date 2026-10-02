// apps/web/src/components/csat/diagnosis/map/NodePopup.tsx
//
// 학습 지도 팝업 — 노드를 누르면 하나만 열린다. 섹션 넷을 한 스크롤에 순서대로(탭 없음):
//   ① 목표(목표율 · 계산 근거 문항) ② 달성(성취율 · 근거 데이터 수) ③ 현 상태(차이 · 과제 순서 · 완료 체크) ④ 근거(출처 · 근거 유형)
// 같은 정보를 두 곳에 두지 않는다 — 지도의 노드는 막대와 상태만, 근거 문장과 과제는 여기에만.

'use client'

import { useEffect, useRef } from 'react'

import type { MapPageData } from '@/lib/csat/map/load'


import { BASIS_LABEL, EDGE_KIND_LABEL, KIND_LABEL, STATUS_LABEL, pct, shortExam, toneOf } from './format'
import s from './map.module.css'

const TONE_TEXT = { met: s.sMet, near: s.sNear, short: s.sShort, muted: '' } as const

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
  const node = data.nodes.find((n) => n.code === code)
  const value = data.model.nodes[code]
  const headRef = useRef<HTMLHeadingElement>(null)
  const model = data.model

  useEffect(() => {
    headRef.current?.focus()
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

  // 집계 노드: 먼저 볼 라인 — 목표까지 격차가 큰 순, 진단 안 된 라인은 뒤
  const childLines = isLine ? [] : data.nodes.filter((n) => n.kind === 'line' && linesOfNode(data, node.code).includes(n.code))
  const focus = childLines
    .map((l) => ({ l, v: model.nodes[l.code] }))
    .filter(({ v }) => v.target !== null && v.achieved !== null && v.target - v.achieved > 1e-9)
    .sort((a, b) => b.v.target! - b.v.achieved! - (a.v.target! - a.v.achieved!))
    .slice(0, 4)

  return (
    <aside className={s.popup} role="dialog" aria-modal="false" aria-labelledby="map-popup-title">
      <div className={s.popHead}>
        <div className={s.popTitle}>
          <div className={s.popKind}>
            {KIND_LABEL[node.kind]} · {node.code}
            {trackName ? ` · ${trackName}` : ''}
          </div>
          <h2 id="map-popup-title" className={s.popName} ref={headRef} tabIndex={-1}>
            {node.name}
          </h2>
        </div>
        <button type="button" className={s.close} onClick={onClose} aria-label="팝업 닫기">
          ✕
        </button>
      </div>

      <div className={s.popBody}>
        {/* ① 목표 */}
        <section className={s.sec} aria-labelledby="map-sec-goal">
          <h3 id="map-sec-goal" className={s.secTitle}>① 목표</h3>
          {hasTarget ? (
            <div className={s.big}>{pct(value.target)}</div>
          ) : (
            <div className={`${s.p} ${s.muted}`}>{value.status === 'tasks_only' ? '문항과 연결되지 않아 목표율 대신 과제 완료율로 봐요.' : value.note ?? '연결 문항이 없어요.'}</div>
          )}
          {hasTarget && (
            <p className={s.p}>
              목표 {model.goal}점 · 기준 시험 {model.reference.exams.length}회
              {model.reference.shortfall > 0 ? ` (원하는 ${model.reference.wanted}회 중 적격 시험이 모자라요)` : ''}
              {isLine ? ' — 반드시 맞혀야 하는 문항의 배점 비율이에요.' : ' — 연결된 라인의 배점 가중 평균이에요.'}
            </p>
          )}
          <p className={`${s.p} ${s.muted}`}>기준 시험: {model.reference.exams.map((e) => shortExam(e.label)).join(' · ') || '없음'}</p>
          {model.reference.skipped.length > 0 && (
            <p className={`${s.p} ${s.muted}`}>정답표가 완전하지 않아 건너뜀: {model.reference.skipped.map(shortExam).join(' · ')}</p>
          )}
          {model.goal < 100 && (
            <div className={s.warn}>
              놓쳐도 되는 문항은 <strong>EBSi 응답자 집계</strong>의 오답률(시험별 상위 15문항)로 정해요 — 평가원 공식 오답률이 아니에요.
              {model.missingRate > 0 && model.mayOverstate ? ' 오답률이 없는 문항은 모두 반드시로 계산해서 목표율이 실제보다 높을 수 있어요.' : ''}
            </div>
          )}
          {isLine && value.mustItems.length > 0 && (
            <>
              <div className={s.secTitle}>반드시 맞혀야 하는 문항 {value.mustItems.length}개</div>
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
            </>
          )}
        </section>

        {/* ② 달성 */}
        <section className={s.sec} aria-labelledby="map-sec-ach">
          <h3 id="map-sec-ach" className={s.secTitle}>② 달성</h3>
          {value.achieved !== null ? (
            <div className={`${s.big} ${TONE_TEXT[tone]}`}>{pct(value.achieved)}</div>
          ) : (
            <div className={s.big}>—</div>
          )}
          <p className={s.p}>
            <strong className={TONE_TEXT[tone]}>{STATUS_LABEL[value.status]}</strong>
            {value.note && value.note !== STATUS_LABEL[value.status] ? ` · ${value.note}` : ''}
            {value.coverage !== null && value.coverage < 1 && value.status !== 'no_items' ? ` · 진단된 라인 ${Math.round(value.coverage * 100)}%` : ''}
          </p>
          <p className={`${s.p} ${s.muted}`}>
            {value.n !== null ? `${isLine ? '관측' : '관측 합계(중복 포함)'} ${value.n}건` : '관측 건수 없음'}
            {model.evidence ? ` · 기록 전체: 시험 ${model.evidence.examSessions}회 · 응답 ${model.evidence.responses}개` : ''}
          </p>
          <p className={`${s.p} ${s.muted}`}>추세는 진단 기록이 쌓이면 보여요(지도 지표를 담은 진단이 둘 이상일 때).</p>
          {(value.tasks.total > 0) && (
            <p className={s.p}>
              과제 완료 {value.tasks.done} / {value.tasks.total}
              {value.tasks.rate !== null ? ` (${pct(value.tasks.rate)})` : ''}
            </p>
          )}
        </section>

        {/* ③ 현 상태 */}
        <section className={s.sec} aria-labelledby="map-sec-now">
          <h3 id="map-sec-now" className={s.secTitle}>③ 현 상태</h3>
          {gap !== null ? (
            <p className={s.p}>
              {gap > 1e-9 ? `목표까지 ${Math.round(gap * 100)}%p 남았어요${value.status === 'hold' ? ' (추정 — 진단 안 된 라인이 있어요)' : ''}.` : '목표에 닿았어요.'}
            </p>
          ) : (
            <p className={`${s.p} ${s.muted}`}>{hasTarget ? '진단이 쌓이면 목표와의 차이를 보여 줘요.' : '목표와의 차이는 문항에 연결된 라인에서만 보여요.'}</p>
          )}
          {isLine && value.habit !== null && (
            <p className={s.p}>
              습관 신호:{' '}
              <strong>{value.habit === 'active' ? '신호 있음' : value.habit === 'resolved' ? '해소됨' : '판단 불가'}</strong>
              {value.habitBasis ? ` (관측 ${value.habitBasis.n} / 필요 ${value.habitBasis.need})` : ''}
              {value.habit === 'unknown' ? ' — 지금 근거로는 신호가 없다고 확정할 수 없어요.' : ''}
            </p>
          )}
          {isLine ? (
            lineTasks.length > 0 && (
              <>
                <div className={s.secTitle}>차이를 줄이는 과제 — 순서대로</div>
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
              </>
            )
          ) : (
            focus.length > 0 && (
              <>
                <div className={s.secTitle}>먼저 볼 라인</div>
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
              </>
            )
          )}
        </section>

        {/* ④ 근거 */}
        <section className={s.sec} aria-labelledby="map-sec-src">
          <h3 id="map-sec-src" className={s.secTitle}>④ 근거</h3>
          {isLine && node.why && <p className={s.p}>{node.why}</p>}
          {!isLine && node.summary && <p className={s.p}>{node.summary.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}</p>}
          {isLine && node.signal && <p className={`${s.p} ${s.muted}`}>진단에서 보는 지표: {node.signal}</p>}
          <div className={s.secTitle}>이 노드의 출처</div>
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
          <div className={s.secTitle}>
            연결선 {edges.length}개 — {(['direct', 'inferred', 'pending'] as const).map((b) => `${BASIS_LABEL[b]} ${edgeCounts[b] ?? 0}`).join(' · ')}
          </div>
          <ul className={s.list}>
            {edges.slice(0, 8).map((e) => {
              const ids = data.edgeSources[e.id] ?? []
              return (
                <li key={e.id}>
                  {e.from_code} {nameOf(e.from_code)} → {e.to_code} {nameOf(e.to_code)}
                  <span className={s.muted}> · {EDGE_KIND_LABEL[e.kind]} · {BASIS_LABEL[e.basis]}</span>
                  {ids.length > 0 ? (
                    <div className={s.src}>{ids.map((id) => srcById.get(id)?.citation ?? id).join(' / ')}</div>
                  ) : (
                    <div className={`${s.src} ${s.muted}`}>출처 없음 — 보류</div>
                  )}
                </li>
              )
            })}
          </ul>
          {edges.length > 8 && <p className={`${s.p} ${s.muted}`}>그 밖 {edges.length - 8}개는 같은 방식이에요.</p>}
        </section>
      </div>
    </aside>
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


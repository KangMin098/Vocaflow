// apps/web/src/components/csat/diagnosis/map/NodePopup.tsx
//
// 학습 지도 팝업 — 노드를 누르면 하나만 열린다. 참조(3B 앱)의 팝업 패턴으로 구성한다(부품: PopupParts · 패턴 표: popup-patterns.md):
//   머리(타일 · 이름 · 알약 탭 · 닫기) · 배너(경로 보기) · 카드 · 검색창 · 목록 박스(타일 + 두 줄 + 칩) · 바닥 알약 버튼.
//   탭 넷 = 섹션 넷: 목표(목표율 · 계산 근거 문항 — 역량만) · 관찰(규칙 기반 관찰값 · 근거량) · 학습 활동(차이 · 과제 — 능력 상태와 분리) · 근거(설명 · 설계 근거 P · 처방 접근 T · 출처 · 연결선)
// 역량(A)만 목표율 · 차이를 보인다. 문항유형 · 선지 함정 · 행동 · 방법 노드는 역할 카드와 관찰 지표만(목표 100% 개념 없음).
// P · T 는 숙달 노드가 아니라 이 팝업의 「근거」 탭 한 곳에만 나온다(2026-10-03 결정).
// 같은 정보를 두 곳에 두지 않는다 — 지도의 노드는 막대와 상태만, 근거 문장과 과제는 여기에만.

'use client'

import { Activity, BookOpen, BookOpenCheck, CalendarDays, CheckSquare, Database, Eye, FileText, Footprints, Gauge, Lightbulb, Link2, ListChecks, ListOrdered, Network, Route, Shapes, Sprout, Target, TrendingUp, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { AXIS_ROLE, CURRENT_BASIS, GOAL_STRATEGY_NOTE, TASK_NOTE, roleOf } from '@/lib/csat/map/core'
import { LINKS, STAGE_DESC, STAGE_LABEL, activityFrame, groupByStage } from '@/lib/csat/map/prescription'
import type { MapPageData } from '@/lib/csat/map/load'

import { useModalFocus } from '../useModalFocus'

import { BADGE_LABEL, BASIS_LABEL, EDGE_KIND_LABEL, KIND_LABEL, evidenceBadge, obsLabel, pct, shortExam } from './format'
import s from './map.module.css'
import p from './popup.module.css'
import { Banner, BigMeter, Card, Chip, Empty, ListBox, ListRow, SearchBox } from './PopupParts'

type TabKey = 'goal' | 'reached' | 'now' | 'basis'

const TABS: { key: TabKey; label: string; Icon: typeof Target }[] = [
  { key: 'goal', label: '목표', Icon: Target },
  { key: 'reached', label: '관찰', Icon: Gauge },
  // 「학습 활동」 — 과제 완료는 능력 상태와 다른 계층(2026-10-07 vNext 정렬 · 이전 라벨 「현 상태」)
  { key: 'now', label: '학습 활동', Icon: ListChecks },
  { key: 'basis', label: '근거', Icon: BookOpenCheck },
]


/** 노드 종류별 아이콘 타일 색 — 라인은 접근 트랙 색, 나머지는 중립 */
export function tileClass(kind: string, trackCode: string | null | undefined): string {
  if (kind === 'track' || kind === 'line') return trackCode === 'T1' ? s.tileT1 : trackCode === 'T2' ? s.tileT2 : trackCode === 'T3' ? s.tileT3 : s.tileNeutral
  return s.tileNeutral
}
const rowTone = (track: string | null | undefined) => (track === 'T1' ? 'sky' : track === 'T2' ? 'purple' : track === 'T3' ? 'pink' : 'neutral') as 'sky' | 'purple' | 'pink' | 'neutral'

export function NodePopup({
  data,
  code,
  done,
  taskError,
  onToggle,
  onClose,
  onShowPath,
}: {
  data: MapPageData
  code: string
  done: ReadonlySet<string>
  taskError: string | null
  onToggle: (taskId: string, next: boolean) => void
  /** 팝업만 닫는다(선택 · 경로 강조는 유지) */
  onClose: () => void
  /** 팝업을 닫고 지도에서 경로를 본다 */
  onShowPath: () => void
}) {
  const dialogRef = useModalFocus<HTMLDivElement>()
  const [tab, setTab] = useState<TabKey>('goal')
  const [qMust, setQMust] = useState('')
  const [qSrc, setQSrc] = useState('')
  const model = data.model
  const node = data.nodes.find((n) => n.code === code)
  const value = model.nodes[code]

  // 다른 노드로 옮겨 가면 첫 탭 · 빈 검색부터
  useEffect(() => {
    setTab('goal')
    setQMust('')
    setQSrc('')
  }, [code])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const examLabel = useMemo(() => new Map(model.reference.exams.map((e) => [e.id, e.label])), [model.reference.exams])
  if (!node || !value) return null
  const nameOf = (c: string) => data.nodes.find((n) => n.code === c)?.name ?? c
  const srcById = new Map(data.sources.map((x) => [x.id, x]))
  const isLine = node.kind === 'line'
  const roleAxis = node.kind === 'axis' ? node.code : node.kind === 'line' ? node.axis : null
  const role = roleOf(roleAxis)
  /** 목표율 · 차이를 보이는 노드 — 최종 목표와 역량(A) 영역 · 라인만 */
  const usesTarget = node.kind === 'goal' || role === 'ability_proxy'
  const roleInfo = roleAxis ? AXIS_ROLE[roleAxis] : undefined
  const hasTarget = usesTarget && value.target !== null
  const obs = obsLabel(value, data.settings.core)
  // 학습 활동 틀 — 근거 수준(지금 rule_proxy)으로 처방 여부를 정한다
  const frame = activityFrame(CURRENT_BASIS)
  const lineTasks = data.tasks.filter((t) => t.line_code === code)
  const edges = data.edges.filter((e) => e.from_code === code || e.to_code === code)
  const trackName = node.track ? nameOf(node.track) : null

  // 기준 시험별 「반드시」 문항 요약(라인) — 시험 행의 보조 줄
  const byExam = new Map<string, { n: number; pts: number }>()
  for (const i of value.mustItems) {
    const cur = byExam.get(i.examId) ?? { n: 0, pts: 0 }
    byExam.set(i.examId, { n: cur.n + 1, pts: cur.pts + i.points })
  }

  const mustRows = value.mustItems.filter((i) => {
    if (!qMust.trim()) return true
    const label = shortExam(examLabel.get(i.examId) ?? i.examId)
    return `${label} ${i.no}`.includes(qMust.trim())
  })

  const principles = isLine ? data.edges.filter((e) => e.kind === 'reason' && e.from_code === code).map((e) => data.nodes.find((n) => n.code === e.to_code)).filter((n): n is MapPageData['nodes'][number] => Boolean(n)) : []
  const q = qSrc.trim()
  const edgesShown = edges.filter((e) => !q || `${e.from_code} ${nameOf(e.from_code)} ${e.to_code} ${nameOf(e.to_code)} ${BASIS_LABEL[e.basis]}`.includes(q))
  const nodeSrcIds = data.nodeSources[code] ?? []
  const srcShown = nodeSrcIds.map((id) => srcById.get(id)).filter((x): x is MapPageData['sources'][number] => Boolean(x)).filter((x) => !q || `${x.citation} ${x.supports}`.includes(q))

  return (
    <div className={p.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className={p.modal} data-map-modal="" role="dialog" aria-modal="true" aria-labelledby="map-popup-title">
        <div className={p.head} data-map-modal-head="">
          <div className={p.who}>
            <span className={p.headTile} aria-hidden="true">{node.code === 'GOAL' ? '◎' : node.code}</span>
            <h2 id="map-popup-title" className={p.title}>{node.name}</h2>
          </div>
          <div className={p.tabs} role="tablist" aria-label="팝업 구역">
            {TABS.map(({ key, label, Icon }) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={p.tab} onClick={() => setTab(key)}>
                <span className={`${p.tabIn} ${tab === key ? p.tabOn : ''}`}>
                  <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
                  {label}
                </span>
              </button>
            ))}
          </div>
          <button type="button" className={p.close} onClick={onClose} aria-label="팝업 닫기">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className={p.body} role="tabpanel">
          {tab === 'goal' && (
            <>
              <Banner
                title="지도에서 경로 보기"
                desc={`${KIND_LABEL[node.kind]}${roleInfo ? ` · ${roleInfo.label}` : ''} — 이 노드와 이어진 영역 · 라인을 지도에서 한눈에 봐요.`}
                actionLabel="경로 보기"
                actionIcon={<Network size={14} strokeWidth={1.8} aria-hidden="true" />}
                onAction={onShowPath}
              />
              {!usesTarget && roleInfo && (
                <Card icon={<Shapes size={14} strokeWidth={1.9} />} title={roleInfo.label} desc="이 노드의 역할이에요." right={<Chip>목표율 없음</Chip>}>
                  <p className={p.p}>{roleInfo.desc}</p>
                </Card>
              )}
              {usesTarget && (
              <Card icon={<Target size={14} strokeWidth={1.9} />} title="목표율" desc={`${isLine ? '반드시 맞혀야 하는 문항의 배점 비율이에요.' : '연결된 라인의 배점 가중 평균이에요.'} ${GOAL_STRATEGY_NOTE}`}>
                {hasTarget ? (
                  <div className={p.bigRow}>
                    <span className={p.big}>{pct(value.target)}</span>
                    <Chip>목표 {model.goal}점 기준</Chip>
                    <Chip>기준 시험 {model.reference.exams.length}회</Chip>
                    {model.reference.shortfall > 0 && <Chip tone="warn">적격 시험 부족 · 원하는 {model.reference.wanted}회</Chip>}
                  </div>
                ) : (
                  <Empty>{value.status === 'tasks_only' ? '문항과 연결되지 않아 목표율 대신 과제 완료율로 봐요.' : (value.note ?? '연결 문항이 없어요.')}</Empty>
                )}
              </Card>
              )}
              {usesTarget && model.goal < 100 && (
                <div className={p.warn}>
                  놓쳐도 되는 문항은 <strong>EBSi 응답자 집계</strong>의 오답률(시험별 상위 15문항)로 정해요 — 평가원 공식 오답률이 아니에요.
                  {model.missingRate > 0 && model.mayOverstate ? ' 오답률이 없는 문항은 모두 반드시로 계산해서 목표율이 실제보다 높을 수 있어요.' : ''}
                </div>
              )}
              {usesTarget && (
              <Card icon={<CalendarDays size={14} strokeWidth={1.9} />} title="기준 시험" desc="정답표가 완전한 평가원 시험 중 최근 순이에요.">
                {model.reference.exams.length === 0 ? (
                  <Empty>기준 시험이 없어요.</Empty>
                ) : (
                  <ListBox>
                    {model.reference.exams.map((e) => {
                      const sum = byExam.get(e.id)
                      return (
                        <ListRow
                          key={e.id}
                          tile={<CalendarDays size={16} strokeWidth={1.8} />}
                          title={shortExam(e.label)}
                          sub={isLine ? (sum ? `반드시 ${sum.n}문항 · ${sum.pts}점` : '연결된 문항 없음') : e.label}
                          right={<Chip>{e.label.includes('수능') ? '수능' : '모의평가'}</Chip>}
                        />
                      )
                    })}
                  </ListBox>
                )}
                {model.reference.skipped.length > 0 && <p className={`${p.p} ${p.muted}`}>정답표가 완전하지 않아 건너뜀: {model.reference.skipped.map(shortExam).join(' · ')}</p>}
              </Card>
              )}
              {usesTarget && isLine && value.mustItems.length > 0 && (
                <Card icon={<ListChecks size={14} strokeWidth={1.9} />} title={`반드시 맞혀야 하는 문항 ${value.mustItems.length}개`} desc="목표율 계산에 들어간 문항이에요.">
                  <SearchBox value={qMust} onChange={setQMust} placeholder="시험 · 번호로 찾기…" label="반드시 맞혀야 하는 문항 찾기" />
                  <ListBox head={['시험 · 번호', '배점 · 오답률']}>
                    <div className={p.scroll}>
                      {mustRows.length === 0 ? (
                        <Empty>찾는 문항이 없어요.</Empty>
                      ) : (
                        mustRows.map((i) => (
                          <ListRow
                            key={`${i.examId}#${i.no}`}
                            tile={i.no}
                            title={shortExam(examLabel.get(i.examId) ?? i.examId)}
                            sub={`${i.no}번`}
                            right={
                              <>
                                <Chip>{i.points}점</Chip>
                                <Chip tone={i.errorRate !== null && i.errorRate >= 0.5 ? 'warn' : 'neutral'}>{i.errorRate === null ? '미관측' : pct(i.errorRate)}</Chip>
                              </>
                            }
                          />
                        ))
                      )}
                    </div>
                  </ListBox>
                </Card>
              )}
            </>
          )}

          {tab === 'reached' && (
            <>
              <Card icon={<Gauge size={14} strokeWidth={1.9} />} title="기출 관찰 정답률" desc="최신 진단 기록에서 문항유형 → 역량 대응표로 이어 받은 값이에요. 실제 숙련 정도를 잰 값이 아니에요." right={<Chip tone="warn">규칙 기반 · 정밀 진단 미실시</Chip>}>
                <div className={p.bigRow}>
                  <span className={p.big}>{value.achieved !== null ? pct(value.achieved) : '—'}</span>
                  {usesTarget ? <Chip>{obs}</Chip> : roleInfo && <Chip>{roleInfo.label}</Chip>}
                  {value.note && value.note !== obs && <Chip>{value.note}</Chip>}
                  {value.coverage !== null && value.coverage < 1 && value.status !== 'no_items' && <Chip tone="warn">진단된 라인 {Math.round(value.coverage * 100)}%</Chip>}
                </div>
                {(value.achieved !== null || hasTarget) && <BigMeter rate={value.achieved} target={null} tone="muted" />}
              </Card>
              <Card icon={<Database size={14} strokeWidth={1.9} />} title="근거 데이터" desc="이 값이 얼마나 쌓인 기록에서 나왔는지예요.">
                <ListBox>
                  <ListRow tile={<Gauge size={16} strokeWidth={1.8} />} title={isLine ? '관측 건수' : '라인별 기여 건수(중복 포함)'} sub={isLine ? '이 지표에 실제로 들어간 응답' : '연결 라인 관측 건수의 합 — 서로 다른 응답 수가 아니에요'} right={<Chip>{value.n !== null ? `${value.n}건` : '없음'}</Chip>} />
                  {model.evidence && <ListRow tile={<FileText size={16} strokeWidth={1.8} />} title="기록 전체" sub="노드별 시험 수는 저장하지 않아요" right={<Chip>시험 {model.evidence.examSessions}회 · 응답 {model.evidence.responses}개</Chip>} />}
                  {value.coverage !== null && <ListRow tile={<ListChecks size={16} strokeWidth={1.8} />} title="진단 범위" sub="진단된 라인의 배점 비율" right={<Chip>{Math.round(value.coverage * 100)}%</Chip>} />}
                </ListBox>
              </Card>
              <Card icon={<TrendingUp size={14} strokeWidth={1.9} />} title="추세" desc="진단이 쌓이면 보여요." right={<Chip>준비 중</Chip>}>
                <p className={`${p.p} ${p.muted}`}>지도 지표를 담은 진단이 둘 이상일 때 변화를 보여 줘요.</p>
              </Card>
              {value.tasks.total > 0 && (
                <Card icon={<CheckSquare size={14} strokeWidth={1.9} />} title="과제 체크" desc="이 노드에 연결된 과제 중 체크한 것이에요.">
                  <div className={p.bigRow}>
                    <span className={p.big}>
                      {value.tasks.done}/{value.tasks.total}
                    </span>
                    {value.tasks.rate !== null && <Chip tone={value.tasks.rate >= 1 ? 'good' : 'neutral'}>{pct(value.tasks.rate)}</Chip>}
                  </div>
                  <BigMeter rate={value.tasks.rate} target={null} tone="muted" />
                </Card>
              )}
            </>
          )}

          {tab === 'now' && (
            <>
              {usesTarget && (
                <Card icon={<Eye size={14} strokeWidth={1.9} />} title="지금 관찰" desc="목표 점수와 역량 수준의 직접 연결은 목표율 보정(calibration) 뒤에 다시 보여 줘요.">
                  <div className={p.bigRow}>
                    <Chip>{obs}</Chip>
                    <Chip tone="warn">규칙 기반 · 정밀 진단 미실시</Chip>
                  </div>
                </Card>
              )}
              {isLine && value.habit !== null && (
                <Card icon={<Activity size={14} strokeWidth={1.9} />} title="행동 신호" desc="풀이 습관 신호예요. 능력이 아니라 행동을 봐요.">
                  <div className={p.bigRow}>
                    <Chip tone={value.habit === 'active' ? 'bad' : value.habit === 'resolved' ? 'good' : 'neutral'}>
                      {value.habit === 'active' ? '신호 있음' : value.habit === 'resolved' ? '해소됨' : '판단 불가'}
                    </Chip>
                    {value.habitBasis && <Chip>관측 {value.habitBasis.n} / 필요 {value.habitBasis.need}</Chip>}
                  </div>
                </Card>
              )}
              {isLine ? (
                lineTasks.length > 0 && (
                  // 관찰 → 진단 필요 → 처방: 진단 전에는 「처방」이라 부르지 않고, 찾기만 「지금 해 볼 수 있는」 단계로 연다(prescription.ts)
                  <Card icon={<Footprints size={14} strokeWidth={1.9} />} title={frame.title} desc={`${frame.note} ${TASK_NOTE}`} right={<Chip>{value.tasks.done}/{value.tasks.total} 완료</Chip>}>
                    <div data-testid="popup-stages" data-phase={frame.phase}>
                      {groupByStage(lineTasks, frame).map((g) => (
                        <section key={g.stage ?? 'none'} className={p.stageGroup} aria-label={g.stage ? STAGE_LABEL[g.stage] : '단계 미정'}>
                          <div className={p.stageHead}>
                            <Chip tone={g.open ? 'good' : 'neutral'}>{g.stage ? STAGE_LABEL[g.stage] : '단계 미정'}</Chip>
                            <span className={p.stageDesc}>{g.stage ? STAGE_DESC[g.stage] : '아직 단계를 정하지 않은 활동이에요'}{g.open ? '' : frame.phase === 'prescription' ? '' : ' · 원인 확인 뒤'}</span>
                          </div>
                          <ListBox>
                        {g.tasks.map((t) => {
                          const checked = done.has(t.id)
                          const link = t.id in LINKS ? LINKS[t.id] : undefined
                          return (
                            <div key={t.id} className={checked ? p.rowDone : ''} data-task-stage={g.stage ?? 'none'}>
                              <ListRow
                                leading={
                                  <label className={p.check}>
                                    {/* 원인 확인 전에는 열린 단계(FIND)만 완료로 저장한다 — 단계 시트와 같은 게이트(prescription.activityFrame) */}
                                    <input type="checkbox" checked={checked} disabled={!g.open} onChange={(e) => onToggle(t.id, e.target.checked)} aria-label={g.open ? `${t.title} 완료` : `${t.title} — 원인 확인 뒤 열림`} />
                                  </label>
                                }
                                tile={t.material === 'past' ? <FileText size={16} strokeWidth={1.8} /> : <Sprout size={16} strokeWidth={1.8} />}
                                tileTone={t.material === 'past' ? 'sky' : 'pink'}
                                title={t.title}
                                sub={
                                  <>
                                    {t.how}
                                    <br />
                                    완료 기준: {t.done_when}
                                    {t.method_line ? ` · 방법: ${nameOf(t.method_line)}` : ''}
                                    {link !== undefined ? ` · 연결: ${link ? nameOf(link) : '원인에 맞는 라인'}` : ''}
                                  </>
                                }
                                right={
                                  <>
                                    <Chip>{t.cadence}</Chip>
                                    <Chip tone={t.material === 'past' ? 'neutral' : 'warn'}>{t.material === 'past' ? '기출' : '본질'}</Chip>
                                  </>
                                }
                              />
                            </div>
                          )
                        })}
                          </ListBox>
                        </section>
                      ))}
                    </div>
                    {taskError && <div className={p.err} role="alert">{taskError}</div>}
                  </Card>
                )
              ) : (
                <Card icon={<ListOrdered size={14} strokeWidth={1.9} />} title="우선 확인 후보" desc="영역 · 목표 단위의 확인 후보는 핵심 지도에서 봐요.">
                  <Empty>격차 순 추천은 하지 않아요 — 규칙 기반 관찰이라 진단을 먼저 해요.</Empty>
                </Card>
              )}
            </>
          )}

          {tab === 'basis' && (
            <>
              {(isLine ? node.why : node.summary) && (
                <Card icon={<BookOpen size={14} strokeWidth={1.9} />} title={isLine ? '왜 이렇게 분류했나' : '설명'}>
                  <p className={p.p}>{(isLine ? node.why : node.summary)!.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}</p>
                  {isLine && node.signal && <p className={`${p.p} ${p.muted}`}>진단에서 보는 지표: {node.signal}</p>}
                </Card>
              )}
              {principles.length > 0 && (
                <Card icon={<Lightbulb size={14} strokeWidth={1.9} />} title="설계 근거" desc="이 라인을 이렇게 짠 학습 원리예요. 학생 실력을 재는 노드가 아니에요.">
                  <ListBox>
                    {principles.map((n) => (
                      <ListRow key={n.code} tile={n.code} tileTone="teal" title={n.name} sub={n.summary ?? ''} right={<Chip>{BADGE_LABEL[evidenceBadge(data.nodeSources[n.code], data.sources)]}</Chip>} />
                    ))}
                  </ListBox>
                </Card>
              )}
              {isLine && trackName && (
                <Card icon={<Route size={14} strokeWidth={1.9} />} title="처방 접근" desc="진단 뒤 고를 수 있는 학습 경로(Route) 후보예요. 지금은 정하지 않아요." right={<Chip tone="warn">Route 미정</Chip>}>
                  <ListBox>
                    <ListRow tile={node.track} tileTone={rowTone(node.track)} title={trackName} sub="추가 진단 뒤 결정" />
                  </ListBox>
                </Card>
              )}
              <Card icon={<Link2 size={14} strokeWidth={1.9} />} title="출처와 연결선" desc="출처가 없으면 보류로 둬요. 연결선도 출처가 있어야 직접 근거 · 추론이 돼요.">
                <SearchBox value={qSrc} onChange={setQSrc} placeholder="출처 · 연결선 찾기…" label="출처와 연결선 찾기" />
                <div className={p.cardTitle} style={{ margin: '4px 0 8px' }}>이 노드의 출처 {nodeSrcIds.length}</div>
                {nodeSrcIds.length === 0 ? (
                  <Empty>출처가 없어 <strong>보류</strong>로 두었어요.</Empty>
                ) : srcShown.length === 0 ? (
                  <Empty>찾는 출처가 없어요.</Empty>
                ) : (
                  <ListBox>
                    {srcShown.map((x) => (
                      <ListRow key={x.id} tile={<BookOpen size={16} strokeWidth={1.8} />} tileTone="teal" title={x.citation} sub={x.supports} right={<Chip tone={x.status === 'verified' ? 'good' : 'warn'}>{x.status === 'verified' ? '확인됨' : '검토 필요'}</Chip>} />
                    ))}
                  </ListBox>
                )}
                <div className={p.cardTitle} style={{ margin: '16px 0 8px' }}>
                  연결선 {edges.length} · {(['direct', 'inferred', 'pending'] as const).map((b) => `${BASIS_LABEL[b]} ${edges.filter((e) => e.basis === b).length}`).join(' · ')}
                </div>
                {edgesShown.length === 0 ? (
                  <Empty>찾는 연결선이 없어요.</Empty>
                ) : (
                  <ListBox>
                    <div className={p.scroll}>
                      {edgesShown.map((e) => {
                        const ids = data.edgeSources[e.id] ?? []
                        return (
                          <ListRow
                            key={e.id}
                            tile={<Link2 size={16} strokeWidth={1.8} />}
                            title={`${e.from_code} ${nameOf(e.from_code)} → ${e.to_code} ${nameOf(e.to_code)}`}
                            sub={`${EDGE_KIND_LABEL[e.kind]} · ${ids.length > 0 ? ids.map((id) => srcById.get(id)?.citation ?? id).join(' / ') : '출처 없음 — 보류'}`}
                            right={<Chip tone={e.basis === 'direct' ? 'good' : e.basis === 'inferred' ? 'warn' : 'neutral'}>{BASIS_LABEL[e.basis]}</Chip>}
                          />
                        )
                      })}
                    </div>
                  </ListBox>
                )}
              </Card>
            </>
          )}
        </div>

        <div className={p.foot} data-map-modal-foot="">
          <button type="button" className={p.pillBtn} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

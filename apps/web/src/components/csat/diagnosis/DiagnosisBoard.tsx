// apps/web/src/components/csat/diagnosis/DiagnosisBoard.tsx
//
// 내 진단 — 모니터링 보드. 판 하나 안에 알약 탭(개요 · 유형 · 오답 함정 · 틀린 문항 · 시험 기록)과
// 오른쪽 「+ 시험 기록」. 개요는 벤토 격자: 최근 점수 게이지 · 등급 분포 도넛 · 점수 흐름 막대 ·
// 듣기/독해 · 유형 레이더 · 작은 지표 셋. 나머지 탭은 표. 데이터는 기록한 답안에서만 온다.

import { ClipboardList, Crosshair, LayoutGrid, Layers, ListX, Plus } from 'lucide-react'
import Link from 'next/link'

import type { ExamReport } from '@/lib/csat/diagnosis/engine/exam-report'
import type { TrapFamily } from '@/lib/csat/diagnosis/engine/types'
import { TRAP_FAMILY_NAME } from '@/lib/csat/diagnosis/labels'
import { toItemSlug } from '@/lib/csat/item-slug'

import s from './board.module.css'
import { Bars, Donut, Radar, Sparkline, seriesColor } from './charts'
import { RecordsList } from './RecordsList'

export type BoardTab = 'overview' | 'types' | 'traps' | 'wrong' | 'records'

const TABS: { key: BoardTab; label: string; Icon: typeof LayoutGrid }[] = [
  { key: 'overview', label: '개요', Icon: LayoutGrid },
  { key: 'types', label: '유형', Icon: Layers },
  { key: 'traps', label: '오답 함정', Icon: Crosshair },
  { key: 'wrong', label: '틀린 문항', Icon: ListX },
  { key: 'records', label: '시험 기록', Icon: ClipboardList },
]

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`)
const short = (d: string) => d.slice(2).replace(/-/g, '.')

export function BoardFrame({
  base,
  tab,
  counts,
  addHref,
  children,
}: {
  base: string
  tab: BoardTab | 'add'
  counts?: Partial<Record<BoardTab, number>>
  addHref: string
  children: React.ReactNode
}) {
  return (
    <div className={s.board}>
      <div className={s.tabbar}>
        <nav className={s.tabs} aria-label="내 진단">
          {TABS.map(({ key, label, Icon }) => (
            <Link key={key} href={key === 'overview' ? base : `${base}?tab=${key}`} className={s.tab} aria-current={tab === key ? 'page' : undefined}>
              <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
              {label}
              {counts?.[key] ? <span className={s.tabCount}>{counts[key]}</span> : null}
            </Link>
          ))}
        </nav>
        <div className={s.actions}>
          <Link href={addHref} className={s.plusWide} aria-current={tab === 'add' ? 'page' : undefined}>
            <Plus size={16} aria-hidden="true" />
            시험 기록
          </Link>
        </div>
      </div>
      <div className={s.body}>{children}</div>
    </div>
  )
}

function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className={s.empty}>
      <ClipboardList size={28} className={s.emptyIcon} aria-hidden="true" />
      <div className={s.emptyTitle}>{title}</div>
      <div className={s.emptyText}>{text}</div>
      {action}
    </div>
  )
}

function Overview({ report, name, focus }: { report: ExamReport; name: (id: string) => string; focus?: string }) {
  const latest = report.latest!
  const grades = Object.entries(report.gradeCounts).sort((a, b) => Number(a[0]) - Number(b[0]))
  const radar = [...report.types].sort((a, b) => b.answered - a.answered).slice(0, 6).map((t) => ({ label: name(t.typeId), value: t.rate }))
  const lastWrongs = report.trend.map((t) => t.wrong)
  const retakes = report.trend.filter((t) => t.mode === 'retake').length
  const topTrap = report.traps[0]

  return (
    <div className={s.bento}>
      <section className={`${s.card} ${s.span1} ${s.row2}`} aria-label="최근 점수">
        <div className={s.label}>최근 점수</div>
        <div className={s.big} style={{ fontSize: 24 }}>{latest.raw}</div>
        <div className={s.gauge} aria-hidden="true">
          <div className={s.gaugeFill} style={{ height: `${latest.raw}%` }} />
        </div>
        <div className={s.gaugeFoot}>{latest.grade ? `${latest.grade}등급` : '—'} · /100</div>
      </section>

      <section className={`${s.card} ${s.span2}`} aria-label="등급 분포">
        <div className={s.cardHead}>
          <div>
            <div className={s.label}>등급 분포</div>
            <div className={s.big}>{grades.length ? `${grades.reduce((n, [, c]) => n + c, 0)}회` : '—'}</div>
          </div>
          <span className={s.chip}>실제 응시</span>
        </div>
        <div className={s.viz}>
          {grades.length ? (
            <Donut
              parts={grades.map(([g, c], i) => ({ value: c, color: seriesColor(i), label: `${g}등급` }))}
              center={latest.grade ? `${latest.grade}` : '—'}
              sub="최근 등급"
            />
          ) : (
            <span className={s.muted}>실제 응시 기록이 쌓이면 보여요</span>
          )}
        </div>
        <div className={s.legend}>
          {grades.map(([g, c], i) => (
            <span key={g}>
              <span className={s.dot} style={{ background: seriesColor(i) }} />
              {g}등급 {c}회
            </span>
          ))}
        </div>
      </section>

      <section className={`${s.card} ${s.span4}`} aria-label="점수 흐름">
        <div className={s.cardHead}>
          <div>
            <div className={s.label}>점수 흐름</div>
            <div className={s.big}>
              {latest.raw}점
              {latest.delta !== null && latest.delta !== 0 && <span className={s.bigSub}>{latest.delta > 0 ? `▲ ${latest.delta}` : `▼ ${-latest.delta}`} 지난 시험 대비</span>}
            </div>
          </div>
          <span className={s.chip}>최근 {Math.min(10, report.trend.length)}회</span>
        </div>
        <div className={s.viz}>
          <Bars
            bars={(focus && !report.trend.slice(-10).some((t) => t.sessionId === focus)
              // 선택한 시험이 최근 10회 밖이면 최근 9회 + 그 시험을 원래 시간순으로 놓는다(맨 뒤에 붙이면 순서가 뒤집힌다)
              ? report.trend.filter((t, i, all) => t.sessionId === focus || i >= all.length - 9)
              : report.trend.slice(-10)
            ).map((t) => ({ key: t.sessionId, value: t.raw, label: short(t.takenAt), hollow: t.mode === 'retake', focus: t.sessionId === focus }))}
          />
        </div>
        {retakes > 0 && <div className={s.legend}>속 빈 막대 = 다시 푼 기출</div>}
      </section>

      <section className={`${s.card} ${s.span2}`} aria-label="듣기와 독해">
        <div className={s.label}>듣기 · 독해</div>
        <div className={s.big}>{pct(report.sections.listening)} <span className={s.bigSub}>/ {pct(report.sections.reading)}</span></div>
        <div className={s.viz} style={{ alignItems: 'stretch', gap: 8 }}>
          {[
            ['듣기 1~17', report.sections.listening],
            ['독해 18~45', report.sections.reading],
          ].map(([label, v], i) => (
            <div
              key={label as string}
              style={{
                flex: 1,
                borderRadius: 10,
                background: i === 0 ? 'color-mix(in srgb, var(--p) 22%, var(--bg))' : 'color-mix(in srgb, var(--t1) 8%, var(--bg))',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: 120,
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{label as string}</span>
              <span className={s.num} style={{ fontSize: 22, fontWeight: 700 }}>{pct(v as number | null)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={`${s.card} ${s.span2}`} aria-label="유형 정답률 레이더">
        <div className={s.label}>유형 정답률</div>
        <div className={s.big}>{report.types.length}<span className={s.bigSub}>유형</span></div>
        <div className={s.viz}>
          {radar.length >= 3 ? <Radar axes={radar} /> : <span className={s.muted}>유형이 셋 이상 쌓이면 보여요</span>}
        </div>
      </section>

      <div className={s.span2} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <section className={s.card} style={{ flex: 1 }} aria-label="최근 시험 오답">
          <div className={s.cardHead}>
            <div>
              <div className={s.label}>최근 시험 오답</div>
              <div className={s.big}>{report.wrongLatest.length}<span className={s.bigSub}>문항</span></div>
            </div>
            <Sparkline values={lastWrongs} />
          </div>
        </section>
        <section className={s.card} style={{ flex: 1 }} aria-label="가장 약한 유형">
          <div className={s.label}>가장 약한 유형</div>
          <div className={s.big} style={{ fontSize: 16 }}>
            {report.weakest[0] ? name(report.weakest[0].typeId) : '—'}
            {report.weakest[0] && <span className={s.bigSub}>{pct(report.weakest[0].rate)}</span>}
          </div>
        </section>
        <section className={s.card} style={{ flex: 1 }} aria-label="가장 많이 끌린 오답">
          <div className={s.label}>가장 많이 끌린 오답</div>
          <div className={s.big} style={{ fontSize: 16 }}>
            {topTrap ? TRAP_FAMILY_NAME[topTrap.family as TrapFamily]?.admin ?? '분류 전 함정' : '—'}
            {topTrap && <span className={s.bigSub}>{topTrap.count}번</span>}
          </div>
        </section>
      </div>
    </div>
  )
}

function TypesTab({ report, name }: { report: ExamReport; name: (id: string) => string }) {
  if (report.types.length === 0) return <Empty title="유형 기록이 없어요" text="실제로 응시한 시험을 기록하면 유형별 정답률이 쌓여요." />
  const change = (l: number | null, b: number | null) => {
    if (l === null || b === null) return '—'
    const d = Math.round((l - b) * 100)
    return d === 0 ? '0' : d > 0 ? `▲ ${d}%p` : `▼ ${-d}%p`
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <section className={s.card}>
        <div className={s.label}>유형별 정답률</div>
        <div className={s.muted}>실제 응시 기록 전체 · 낮은 순</div>
        <div className={s.viz}>
          <Bars bars={report.types.slice(0, 12).map((t) => ({ key: t.typeId, value: Math.round(t.rate * 100), label: name(t.typeId).slice(0, 5) }))} unit="%" />
        </div>
      </section>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr><th>유형</th><th>정답률</th><th>맞음 / 문항</th><th>최근 시험</th><th>이전</th><th>변화</th></tr>
          </thead>
          <tbody>
            {report.types.map((t) => (
              <tr key={t.typeId}>
                <td>
                  {t.typeId === 'LISTEN' ? name(t.typeId) : (
                    <Link className={s.rowLink} href={`/csat/browse?type=${encodeURIComponent(t.typeId)}`}>{name(t.typeId)}</Link>
                  )}
                </td>
                <td className={s.num}>
                  <span className={s.cellBar}><span className={s.cellBarFill} style={{ width: `${Math.round(t.rate * 100)}%` }} /></span>
                  {pct(t.rate)}
                </td>
                <td className={s.num}>{t.correct} / {t.answered}</td>
                <td className={s.num}>{pct(t.latest)}</td>
                <td className={s.num}>{pct(t.before)}</td>
                <td className={s.num}>{change(t.latest, t.before)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TrapsTab({ report }: { report: ExamReport }) {
  if (report.traps.length === 0) {
    return <Empty title="끌린 오답이 아직 없어요" text="오답 선지의 설계가 분석된 문항에서 틀리면, 어떤 함정에 끌렸는지 여기에 모여요." />
  }
  const total = report.traps.reduce((n, t) => n + t.count, 0)
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr><th>함정</th><th>어떻게 끌렸나</th><th>횟수</th><th>비중</th></tr>
        </thead>
        <tbody>
          {report.traps.map((t, i) => (
            <tr key={t.family}>
              <td><span className={s.icon} style={{ color: seriesColor(i) }}>{i + 1}</span>{TRAP_FAMILY_NAME[t.family as TrapFamily]?.admin ?? '분류 전 함정'}</td>
              <td>{TRAP_FAMILY_NAME[t.family as TrapFamily]?.learner ?? ''}</td>
              <td className={s.num}>{t.count}</td>
              <td className={s.num}>
                <span className={s.cellBar}><span className={s.cellBarFill} style={{ width: `${Math.round((t.count / total) * 100)}%` }} /></span>
                {Math.round((t.count / total) * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WrongTab({ report, name }: { report: ExamReport; name: (id: string) => string }) {
  if (report.wrongAll.length === 0) return <Empty title="틀린 문항이 없어요" text="기록한 시험에서 틀린 문항이 여기에 모여요." />
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr><th>시험</th><th>번호</th><th>유형</th><th>고른 답</th><th>끌린 함정</th><th>해설</th></tr>
        </thead>
        <tbody>
          {report.wrongAll.map((w) => (
            <tr key={`${w.sessionId}-${w.no}`}>
              <td><span className={s.num} style={{ color: 'var(--t2)', marginRight: 10 }}>{short(w.takenAt)}</span>{w.examLabel}</td>
              <td className={s.num}>{w.no}</td>
              <td>{name(w.typeId)}</td>
              <td className={s.num}>{w.chosen ?? '비움'}</td>
              <td>{w.trap ?? '—'}</td>
              <td>{w.itemId ? <Link className={s.rowLink} href={`/csat/item/${toItemSlug(w.itemId)}`}>보기</Link> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DiagnosisBoard({
  report,
  typeNames,
  tab,
  base,
  addHref,
  modal,
  focus,
}: {
  report: ExamReport
  typeNames: Record<string, string>
  tab: BoardTab
  base: string
  addHref: string
  /** 열려 있는 모달(새 기록 · 기록 상세) — 페이지가 그려 넘긴다 */
  modal?: React.ReactNode
  /** 팝업의 「진단에서 보기」로 온 시험 — 개요에서 강조하고 바닥에 선택 표시 */
  focus?: string
}) {
  const focused = focus ? report.trend.find((t) => t.sessionId === focus) : undefined
  const name = (id: string) => typeNames[id] ?? id
  const counts = { wrong: report.wrongAll.length, records: report.trend.length }
  return (
    <BoardFrame base={base} tab={tab} counts={counts} addHref={addHref}>
      {!report.latest ? (
        <Empty
          title="아직 기록한 시험이 없어요"
          text="학력평가 · 모의평가 · 수능 중 푼 시험을 고르고 내 답만 적으면, 점수 흐름과 약한 유형이 여기에 나와요."
          action={<Link href={addHref} className={s.primary} style={{ marginTop: 12 }}><Plus size={16} aria-hidden="true" />첫 시험 기록</Link>}
        />
      ) : tab === 'types' ? (
        <TypesTab report={report} name={name} />
      ) : tab === 'traps' ? (
        <TrapsTab report={report} />
      ) : tab === 'wrong' ? (
        <WrongTab report={report} name={name} />
      ) : tab === 'records' ? (
        <RecordsList trend={report.trend} base={base} addHref={addHref} />
      ) : (
        <Overview report={report} name={name} focus={focused?.sessionId} />
      )}
      {focused && tab === 'overview' && (
        <div className={s.focusBar} role="status">
          <ClipboardList size={15} aria-hidden="true" />
          <strong>{focused.label}</strong>
          <span className={s.focusBarSub}>{focused.raw}점 · {focused.grade ?? '—'}등급 · 오답 {focused.wrong}</span>
          <Link href={`${base}?tab=records&record=${focused.sessionId}`} className={s.linkBtn}>기록 열기</Link>
          <Link href={base} className={s.modalClose} aria-label="선택 해제" style={{ width: 36, height: 36 }}>✕</Link>
        </div>
      )}
      {modal}
    </BoardFrame>
  )
}

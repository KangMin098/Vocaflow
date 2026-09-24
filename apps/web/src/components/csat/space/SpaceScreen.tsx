// apps/web/src/components/csat/space/SpaceScreen.tsx
'use client'

//
// **기출 작업 공간** — 참조(Tines 3B) 앱 화면의 골격을 우리 자산으로 채운 화면.
// tines-mapping §0 「앱 화면」 행이 ○(예정)으로 남아 있던 자리다.
//
// 참조에서 옮겨 온 것(구조):
//   ① 좌측 레일 — 두 무리 + 아래 「Spaces」 목록
//   ② 무늬 띠 + 그 위에 뜬 두 장짜리 명령 상자
//   ③ 판이 띠를 조금 올라타고, 그 머리에 개수 뱃지 달린 탭 + 오른쪽 도구 하나
//   ④ 한 줄이 한 작업인 표(아이콘 타일 · 이름 · 상태 한 줄 · 열 넷)
//
// 참조와 **다르게 한 것**(의도):
//   · 참조의 명령 상자는 AI 에게 시키는 자리다. 우리 것은 **실제로 거르는 입력**이다 —
//     안 되는 것을 되는 것처럼 그리지 않는다(누르면 아무 일도 없는 상자가 가장 나쁜 복제다).
//   · 참조 표의 행은 workflow 다. 우리 행은 유형 26 · 함정 32 이고, 수치는 전부
//     구운 코퍼스(`trap-atlas.json`)에서 온다 — 손으로 적은 수가 없다(AGENTS I5).
//   · 참조 상세 화면(바닥 색 카드 넷)은 별도 라우트가 아니라 **줄을 펼치면** 나온다.

import Link from 'next/link'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  ChevronDown,
  Crosshair,
  Gauge,
  Layers,
  Microscope,
  Search,
  SlidersHorizontal,
  Star,
} from 'lucide-react'

import { PatternBand } from './PatternBand'
import styles from './space.module.css'
import home from '../home/home.module.css'
import { ContinueCard } from '../home/ContinueCard'
import { ContinuePanel } from '../home/ContinuePanel'
import { CsatRail, type NeedId } from '../home/CsatRail'
import { useCsatRecord } from '../home/useCsatRecord'
import { track } from '@/lib/analytics/client'
import { activeSet, coverage, dueBucket, dueNow, gapBucket, gapDays, visitState } from '@/lib/csat/continuity'
import { ATLAS_TYPES } from '@/lib/csat/trap-atlas'
import {
  EMPTY_SPACE_FILTER,
  filterRows,
  killerTypeIds,
  patternShapes,
  spaceHeadline,
  stepsFor,
  trapRows,
  typeRows,
  type SpaceFilter,
  type SpaceRow,
  type SpaceTab,
  type SpaceTone,
} from '@/lib/csat/space-model'

const TONE_CLASS: Record<SpaceTone, string> = {
  lavender: 'tone-lavender',
  green: 'tone-green',
  peach: 'tone-peach',
  yellow: 'tone-yellow',
  pink: 'tone-pink',
  teal: 'tone-teal',
}

const n = (value: number) => value.toLocaleString('ko-KR')

export interface SpaceExam {
  exam_id: string
  label: string
  items: number
}

/** 씨는 탭마다 다르다 — 참조도 화면마다 다른 무늬를 쓴다. 값 자체에 뜻은 없다(결정론만 필요). */
const SEED: Record<SpaceTab, number> = { type: 7, trap: 23 }

const TAB_LABEL: Record<SpaceTab, string> = { type: '유형', trap: '함정' }

export function SpaceScreen({
  exams,
  itemTypes,
  initialTab = 'type',
  need = null,
  view = 'home',
}: {
  exams: SpaceExam[]
  /** 문항 id → 유형 id(넓이 · 「본 문항」 계산용). 서가 카탈로그에서 온다 */
  itemTypes: Record<string, string>
  initialTab?: SpaceTab
  /** 목적별 경로로 들어왔을 때 — 표를 그 묶음으로 미리 좁힌다 */
  need?: NeedId | null
  /** 'continue' = 이어서 · 복습 판(표 자리에 선다) */
  view?: 'home' | 'continue'
}) {
  const head = useMemo(spaceHeadline, [])
  const all = useMemo(() => ({ type: typeRows(), trap: trapRows() }), [])
  const [tab, setTab] = useState<SpaceTab>(need === 'trap' ? 'trap' : initialTab)
  const [filter, setFilter] = useState<SpaceFilter>(need === 'killer' ? { ...EMPTY_SPACE_FILTER, keys: killerTypeIds() } : EMPTY_SPACE_FILTER)
  const rec = useCsatRecord()
  const typeOf = useCallback((id: string) => itemTypes[id], [itemTypes])
  const cov = useMemo(() => (rec ? coverage(rec.record, typeOf) : null), [rec, typeOf])
  const homeSent = useRef(false)
  // 홈 상태는 기록을 읽은 **뒤** 한 번만 센다 — 지속 학습 지표의 분모(ia-design §5)
  useEffect(() => {
    if (!rec || homeSent.current) return
    homeSent.current = true
    track({
      name: 'csat_home_viewed',
      props: {
        state: visitState(rec.record, rec.now),
        due: dueBucket(rec.dueBefore),
        gap: gapBucket(gapDays(rec.record, rec.now)),
        active: activeSet(rec.record) !== null,
        synced: rec.synced,
      },
    })
  }, [rec])
  const [draft, setDraft] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [showGauges, setShowGauges] = useState(false)
  const listId = useId()
  const firstRow = useRef<HTMLButtonElement>(null)
  const openedCount = useRef(0)

  const rows = useMemo(() => filterRows(all[tab], filter), [all, tab, filter])
  const counts = useMemo(
    () => ({ type: filterRows(all.type, filter).length, trap: filterRows(all.trap, filter).length }),
    [all, filter],
  )
  // 무늬는 **지금 표에 있는 것**을 그린다. 28개까지만 — 그 아래는 점이 되어 보이지 않는다.
  const shapes = useMemo(() => patternShapes(rows.slice(0, 28).map((r) => r.weight), SEED[tab]), [rows, tab])

  /**
   * 범위를 바꾸는 **유일한 통로**. 탭·칩·찾기·회차가 전부 여기를 지난다 —
   * 갈래마다 따로 `track` 을 부르면 한 곳을 고칠 때 나머지가 조용히 빠진다(D2).
   */
  const scope = useCallback(
    (next: { tab?: SpaceTab; filter?: SpaceFilter }) => {
      const nextTab = next.tab ?? tab
      const nextFilter = next.filter ?? filter
      setTab(nextTab)
      setFilter(nextFilter)
      setOpenKey(null)
      track({
        name: 'csat_space_scoped',
        props: {
          tab: nextTab,
          withExample: nextFilter.withExample,
          recentOnly: nextFilter.recentOnly,
          queried: nextFilter.query.trim().length > 0,
          shown: filterRows(all[nextTab], nextFilter).length,
        },
      })
    },
    [all, tab, filter],
  )

  const submit = useCallback(() => {
    scope({ filter: { ...filter, query: draft } })
    // 거른 결과의 첫 줄로 초점을 옮긴다 — 누르고 나서 어디를 봐야 하는지 말해 준다.
    window.requestAnimationFrame(() => firstRow.current?.focus())
  }, [scope, filter, draft])

  const reset = useCallback(() => {
    setDraft('')
    scope({ filter: EMPTY_SPACE_FILTER })
  }, [scope])

  // ⚠️ `setOpenKey(updater)` 안에서 보내지 않는다 — StrictMode 가 갱신 함수를 두 번 부르면
  //    접을 때마다 이벤트가 둘이 된다(분자만 두 배가 되는 종류의 오염이다).
  const openRow = useCallback(
    (row: SpaceRow, index: number) => {
      if (openKey === row.key) {
        setOpenKey(null)
        return
      }
      setOpenKey(row.key)
      openedCount.current += 1
      track({
        name: 'csat_space_opened',
        props: {
          kind: row.kind,
          rank: index + 1,
          live: row.live,
          hasExample: row.example !== null,
          seq: openedCount.current,
        },
      })
    },
    [openKey],
  )

  const namedPct = Math.round((100 * head.named) / head.distractors)
  const recentPct = Math.round((100 * head.recentTotal) / head.distractors)

  return (
    <div className={styles.root} data-csat-space>
      {/* ── ① 좌측 레일 ─────────────────────────────────────────────────── */}
      <CsatRail
        place={view === 'continue' ? 'continue' : need ? 'need' : 'home'}
        current={need ?? undefined}
        exams={exams}
        dueCount={rec ? dueNow(rec.record, rec.now).length + (activeSet(rec.record) ? 1 : 0) : null}
      />

      <div className="min-w-0">
        {/* ── 상단 줄 ───────────────────────────────────────────────────── */}
        <header className={styles.topbar}>
          <span className={styles.topPill}>
            <Microscope size={13} aria-hidden="true" />
            기출 <b>{n(head.items)}</b>문항 · 오답 <b>{n(head.distractors)}</b>
            <span className={styles.topPillWide}>
              {' '}
              · {head.yearMin}–{head.yearMax}
            </span>
          </span>
          <Link className={styles.topLink} href="/csat/browse">
            <Search size={14} aria-hidden="true" />
            전체 서가
          </Link>
        </header>

        <div className={styles.canvas}>
          {/* ── ② 무늬 띠 + 명령 상자 ─────────────────────────────────── */}
          <div className={styles.band}>
            <PatternBand shapes={shapes} className={styles.bandArt} variant="grid" />
            <div className={styles.bandVeil} aria-hidden="true" />
            <ContinueCard state={rec} />
          </div>

          {/* ── ③ 판 ─────────────────────────────────────────────────── */}
          <div className={styles.panel}>
            <div className={styles.tabs} role="tablist" aria-label="보는 것">
              {(['type', 'trap'] as SpaceTab[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`${listId}-tab-${key}`}
                  aria-selected={tab === key}
                  aria-controls={`${listId}-panel`}
                  className={styles.tab}
                  onClick={() => scope({ tab: key })}
                >
                  {key === 'type' ? <Layers size={14} aria-hidden="true" /> : <Crosshair size={14} aria-hidden="true" />}
                  {TAB_LABEL[key]}
                  <span className={styles.tabCount}>{n(counts[key])}</span>
                </button>
              ))}
              <button
                type="button"
                className={styles.tabsRight}
                aria-expanded={showGauges}
                onClick={() => setShowGauges((v) => !v)}
              >
                <Gauge size={14} aria-hidden="true" />
                채움 현황
                <ChevronDown size={13} aria-hidden="true" style={{ transform: showGauges ? 'rotate(180deg)' : undefined }} />
              </button>
            </div>

            <form
              className={home.tools}
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              <label className={home.search}>
                <Search size={14} aria-hidden="true" />
                <span className="sr-only">유형 · 함정 · 회차 · 문항 번호로 찾기</span>
                <input
                  id={`${listId}-q`}
                  type="search"
                  value={draft}
                  placeholder="예: 빈칸 주체 역전 · 2026 수능 31"
                  onChange={(event) => setDraft(event.target.value)}
                />
              </label>
              <button
                type="button"
                className={home.chip}
                aria-pressed={filter.withExample}
                onClick={() => scope({ filter: { ...filter, withExample: !filter.withExample } })}
              >
                <Star size={12} aria-hidden="true" />
                예시 있는 것만
              </button>
              <button
                type="button"
                className={home.chip}
                aria-pressed={filter.recentOnly}
                onClick={() => scope({ filter: { ...filter, recentOnly: !filter.recentOnly } })}
              >
                <SlidersHorizontal size={12} aria-hidden="true" />
                {head.recentFrom}학년도 이후
              </button>
              {filter.keys ? (
                <button type="button" className={home.chip} aria-pressed onClick={() => scope({ filter: { ...filter, keys: null } })} data-testid="need-chip">
                  킬러 유형만 · 풀기
                </button>
              ) : null}
              <p className={home.breadth} data-testid="breadth">
                {cov ? (
                  <>
                    본 유형 <b>{cov.types}</b>/{ATLAS_TYPES.length} · 만난 함정 계열 <b>{cov.families}</b> · 내 공식 <b>{cov.formulas}</b>
                  </>
                ) : (
                  '기록을 확인하는 중…'
                )}
              </p>
            </form>

            {showGauges ? (
              <div className={styles.gauges}>
                <div className={styles.gauge}>
                  <b>
                    {n(head.analyzed)} / {n(head.items)}
                  </b>
                  분석이 붙은 문항
                  <span className={styles.gaugeBar}>
                    <span className={styles.gaugeFill} style={{ width: `${Math.round((100 * head.analyzed) / head.items)}%` }} />
                  </span>
                </div>
                <div className={styles.gauge}>
                  <b>
                    {n(head.named)} / {n(head.distractors)}
                  </b>
                  계열 이름이 붙은 오답 · {namedPct}%
                  <span className={styles.gaugeBar}>
                    <span className={styles.gaugeFill} style={{ width: `${namedPct}%` }} />
                  </span>
                </div>
                <div className={styles.gauge}>
                  <b>
                    {n(head.recentTotal)} / {n(head.distractors)}
                  </b>
                  {head.recentFrom}학년도 이후의 오답 · {recentPct}%
                  <span className={styles.gaugeBar}>
                    <span className={styles.gaugeFill} style={{ width: `${recentPct}%` }} />
                  </span>
                </div>
              </div>
            ) : null}

            <div className={styles.tableHead} aria-hidden="true" hidden={view === 'continue'}>
              <span>{tab === 'type' ? '유형' : '함정'}</span>
              <span>갖춘 것</span>
              <span>걸친 범위</span>
              <span>{head.recentFrom}학년도 이후</span>
              <span>예시 기출</span>
            </div>

            {view === 'continue' ? <ContinuePanel state={rec} itemTypes={itemTypes} /> : null}

            <div id={`${listId}-panel`} role="tabpanel" aria-labelledby={`${listId}-tab-${tab}`} hidden={view === 'continue'}>
              {rows.length === 0 ? (
                <div className={styles.empty}>
                  <p>조건에 맞는 {TAB_LABEL[tab]}이 없습니다.</p>
                  <button type="button" className={styles.emptyReset} onClick={reset}>
                    조건 지우기
                  </button>
                </div>
              ) : (
                rows.map((row, i) => (
                  <Row
                    key={row.key}
                    row={row}
                    seen={row.kind === 'type' ? cov?.byType.get(row.key) ?? 0 : null}
                    index={i}
                    open={openKey === row.key}
                    onToggle={() => openRow(row, i)}
                    buttonRef={i === 0 ? firstRow : undefined}
                  />
                ))
              )}
            </div>
          </div>

          {/* 바닥 — 「이 수치를 언제 잰 것인가」를 화면이 스스로 말한다.
              링크는 문장 안이 아니라 **밖**이다: 문장 안 13px 링크는 44px 하한에 걸린다(실측). */}
          <div className={styles.foot}>
            <p>
              수치는 전부 구운 코퍼스 <code>trap-atlas.json</code> 에서 옵니다 — 기출 {n(head.items)}문항의 오답{' '}
              {n(head.distractors)}개를 센 값이고, 마지막으로 센 때는 {head.builtAt.slice(0, 10)} 입니다. 지문·선지 원문은
              이 화면에 오지 않습니다(기기의 PDF 에서만 열립니다).
            </p>
            <Link className={styles.footLink} href="/csat/browse">
              전체 기출 서가로
              <ArrowUpRight size={12} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({
  row,
  seen,
  index,
  open,
  onToggle,
  buttonRef,
}: {
  row: SpaceRow
  /** 이 학습자가 이 유형에서 연 문항 수(함정 줄은 null) */
  seen: number | null
  index: number
  open: boolean
  onToggle: () => void
  buttonRef?: React.RefObject<HTMLButtonElement>
}) {
  const steps = useMemo(() => stepsFor(row), [row])
  return (
    <>
      <button ref={buttonRef} type="button" className={styles.row} aria-expanded={open} onClick={onToggle}>
        <span className={styles.rowName}>
          <span className={`${styles.tile} ${TONE_CLASS[row.tone]}`} aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="min-w-0">
            <span className={styles.rowTitle}>{row.name}</span>
            <span className={styles.rowMeta}>
              <span className={`${styles.dot} ${row.live ? '' : styles.dotOff}`} aria-hidden="true" />
              {row.liveLabel}
              {row.meta.map((fact) => (
                <span key={fact}>· {fact}</span>
              ))}
              {seen ? <span data-testid="row-seen">· 본 문항 {seen}</span> : null}
            </span>
          </span>
        </span>

        <span className={styles.badges}>
          {row.badges.map((badge) => (
            <span key={badge.label} className={`${styles.badge} ${TONE_CLASS[badge.tone]}`}>
              {badge.label}
            </span>
          ))}
        </span>

        <span className={styles.cell}>
          <span className={styles.cellLabel}>걸친 범위 </span>
          {row.reach}
        </span>

        <span className={styles.recentCell}>
          {row.recent}
          <span className={styles.recentBar} aria-hidden="true">
            <span className={styles.recentFill} style={{ width: `${Math.round(row.recentRatio * 100)}%` }} />
          </span>
        </span>

        <span>
          {row.example ? (
            <span className={styles.exampleChip}>
              {row.example.label} {row.example.no}번
            </span>
          ) : (
            <span className={styles.exampleNone}>예시 없음</span>
          )}
        </span>
      </button>

      {open ? (
        <div className={styles.drawer}>
          {steps.map((step, i) => (
            <div key={step.title} className={`${styles.step} ${TONE_CLASS[step.tone]}`}>
              <span className={styles.stepHead}>
                <span className={styles.stepNum} aria-hidden="true">
                  {i + 1}
                </span>
                {step.title}
              </span>
              <span className={styles.stepBody}>{step.body}</span>
              {step.href ? (
                <Link className={styles.stepLink} href={step.href}>
                  {step.hrefLabel}
                  <ArrowUpRight size={12} aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </>
  )
}

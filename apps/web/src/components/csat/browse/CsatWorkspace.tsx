'use client'

// apps/web/src/components/csat/browse/CsatWorkspace.tsx
//
// **전체 기출 서가 — 별도 화면(3B 워크스페이스 골격).** 기출 메인(`/csat`)에서 띄운다.
//
// 앱 셸 안의 긴 랜딩(`SessionHome`)을 대신한다. `(app)` 풀스크린 그룹에 서서 상단 메뉴 ·
// 나침반 띠 없이 뷰포트를 통째로 쓰고, 문항 해설 극장(`theater/AnalysisTheater`)과
// **같은 판**을 쓴다 — 목록에서 문항으로 들어가도 화면의 결이 바뀌지 않게.
//
//   참조                        → 여기
//   ─────────────────────────────────────────────────────────────────
//   상단 줄(공간 이름 · # 태그)  → 기출 · # 문항 수 · 오른쪽 「오늘의 해부 시작」
//   왼쪽 레일(대화 기록)         → 유형 목록(누르면 오른쪽이 그 유형으로 좁혀진다)
//   레일 바닥 작성 상자          → 찾기 입력(유형 · 회차 · 번호) — 실제로 거른다
//   왼쪽 판(README ⌄)            → 오늘의 해부 + 시험 · 학년도 · 상태 거르개
//   오른쪽 판(Output ⌄)          → 회차별 번호 칩(결과)
//   바닥 단계 카드               → 학습 네 걸음(예측 · 설계 읽기 · 전이 · 패턴 축적)
//
// ⚠️ 발문·지문은 여기 없다(저작권 경계). 칩이 말하는 것은 번호 · 유형 · 배점뿐이다.
// ⚠️ 수치는 전부 카탈로그에서 센 값이다(AGENTS I5).

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, Circle, Code2, Dices, LayoutGrid, ListFilter, Play, Search } from 'lucide-react'

import { track } from '@/lib/analytics/client'
import { EMPTY_FILTER, filterBrowse, groupByExam, type BrowseCatalog, type BrowseFilter, type ExamKind } from '@/lib/csat/browse-model'
import { composeDissection, emptyDissectionRecord, type DissectionCatalog, type DissectionItem, type DissectionRecord } from '@/lib/csat/dissect'
import { toItemSlug } from '@/lib/csat/item-slug'
import { recommendationReason } from '@/lib/csat/learning-home'
import { REFLOW_VERSION } from '@/lib/csat/reflow/reflow'
import { cachedExamIds, loadDissectionRecord, saveDissectionRecord } from '@/lib/csat/session/store'

import theater from '../theater/theater.module.css'
import styles from './workspace.module.css'

const dissectionHref = (items: DissectionItem[]) => `/csat/dissect?set=${encodeURIComponent(items.map((i) => toItemSlug(i.id)).join(','))}`
const STEP_ROLE = ['먼저 예측하기', '설계 대조하기', '다른 문항에서 전이']

export function CsatWorkspace({ catalog, browse, initialType }: { catalog: DissectionCatalog; browse: BrowseCatalog; initialType?: string }) {
  const router = useRouter()
  const [state, setState] = useState<{ record: DissectionRecord; cached: string[]; plan: DissectionItem[]; now: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<BrowseFilter>({
    ...EMPTY_FILTER,
    type: initialType && browse.types.some((t) => t.id === initialType) ? initialType : 'all',
  })
  const set = <K extends keyof BrowseFilter>(key: K, value: BrowseFilter[K]) => setFilter((f) => ({ ...f, [key]: value }))

  useEffect(() => {
    let alive = true
    void Promise.all([loadDissectionRecord(), cachedExamIds(REFLOW_VERSION)]).then(([record, cached]) => {
      const now = Date.now()
      if (alive) setState({ record, cached, plan: composeDissection(catalog, record, now, cached), now })
    })
    return () => {
      alive = false
    }
  }, [catalog])

  const record = state?.record ?? emptyDissectionRecord(0)
  const plan = state?.plan ?? []
  const ready = plan.length === 3
  const active = record.active && record.active.index < record.active.items.length ? record.active : null
  const planType = catalog.types.find((t) => t.id === plan[0]?.type_id)?.name ?? '기출 분석'

  const years = useMemo(() => [...new Set(browse.exams.map((e) => e.year))].sort((a, b) => b - a), [browse.exams])
  const typeName = useMemo(() => new Map(browse.types.map((t) => [t.id, t.name])), [browse.types])
  const items = useMemo(() => filterBrowse(browse, filter), [browse, filter])
  const grouped = useMemo(() => groupByExam(browse, items), [browse, items])
  const random = items.length ? items[Math.floor(Math.random() * items.length)] : null
  const { kind, year, type, status, query } = filter
  const filtered = kind !== 'all' || year !== 'all' || type !== 'all' || status !== 'all' || query.trim() !== ''
  const reset = () => setFilter(EMPTY_FILTER)

  const start = async () => {
    if (busy || !state || !ready) return
    setBusy(true)
    await saveDissectionRecord({ ...record, onboarded: true })
    track({
      name: 'csat_session_started',
      props: {
        size: plan.length,
        review: record.queue.some((q) => q.due <= state.now),
        needed: new Set(plan.map((i) => i.exam_id)).size,
        cached: new Set(plan.map((i) => i.exam_id).filter((e) => state.cached.includes(e))).size,
      },
    })
    router.push(dissectionHref(plan))
  }

  const steps = [
    { name: '예측', detail: '근거는 어디에 있을까', tint: 'pink', href: ready ? dissectionHref(plan) : '#csat-results' },
    { name: '설계 읽기', detail: '근거 → 함정 → 의도', tint: 'green', href: random ? `/csat/item/${toItemSlug(random.id)}` : '#csat-results' },
    { name: '전이', detail: '소재가 바뀌어도 통할까', tint: 'peach', href: ready ? dissectionHref(plan) : '#csat-results' },
    { name: '패턴 축적', detail: '내 언어로 남긴 공식', tint: 'teal', href: '/csat/formulas' },
  ]

  return (
    <div className={`${theater.workspace} ${styles.full}`} data-csat-home data-testid="csat-workspace">
      {/* ── 상단 줄 ─────────────────────────────────────────── */}
      <header className={theater.bar}>
        <Link className={theater.back} href="/csat">
          <ChevronLeft size={15} aria-hidden /> 기출 홈
        </Link>
        <h1 className={theater.docTitle}>기출 · 수능 · 모의평가</h1>
        <span className={theater.tag}># {browse.items.length}문항</span>
        <div className={theater.barRight}>
                    {random ? (
            <Link className={styles.ghost} href={`/csat/item/${toItemSlug(random.id)}`}>
              <Dices size={14} aria-hidden /> 아무거나 한 문항
            </Link>
          ) : null}
          <button type="button" className={theater.play} onClick={() => void start()} disabled={busy || !ready} data-testid="start">
            <Play size={14} aria-hidden /> {busy ? '여는 중…' : ready ? '오늘의 해부 시작' : '준비 중'}
          </button>
        </div>
      </header>

      <div className={theater.body}>
        {/* ── ① 레일: 유형 ───────────────────────────────────── */}
        <aside className={theater.rail} aria-label="유형으로 고르기">
          <div className={theater.railTop}>
            <span className={theater.liveDot} data-on={filtered} aria-hidden />
            <b>유형 {browse.types.length}</b>
            <span className={theater.railTime}>{browse.exams.length}회차</span>
          </div>
          <p className={theater.railBanner}>
            <Circle size={12} aria-hidden />
            <span>{type === 'all' ? '유형을 누르면 오른쪽이 그 유형으로 좁혀져요.' : `${typeName.get(type) ?? type}만 보는 중이에요.`}</span>
            <button type="button" onClick={() => set('type', 'all')} disabled={type === 'all'}>
              전체 유형
            </button>
          </p>

          <div className={theater.stream}>
            {browse.types.map((t) => {
              const on = t.id === type
              return (
                <div key={t.id} className={theater.step} data-state={on ? 'live' : 'wait'}>
                  <span className={theater.dot} aria-hidden />
                  <button type="button" className={theater.stepBtn} aria-pressed={on} onClick={() => set('type', on ? 'all' : t.id)}>
                    <span className={theater.stepKind}>
                      {t.status === 'retired' ? '폐지' : '유형'}
                      <em>{t.items}문항</em>
                    </span>
                    {t.name}
                  </button>
                </div>
              )
            })}
          </div>

          {/* 참조의 작성 상자 자리 — 실제로 거르는 찾기 */}
          <div className={theater.composer}>
            <p className={theater.composerHead}>
              <span className={theater.avatar} aria-hidden>
                V
              </span>
              어떤 문항을 볼까요?
            </p>
            <label className={styles.search}>
              <Search size={14} aria-hidden />
              <input
                id="csat-library-search"
                type="search"
                value={query}
                placeholder="예: 빈칸 · 2026 · 31"
                aria-label="유형 · 회차 · 번호로 찾기"
                onChange={(e) => set('query', e.target.value)}
              />
            </label>
            <div className={theater.composerFoot}>
              <span className={theater.pill}>
                {items.length}문항 · {grouped.length}회차
              </span>
              <button type="button" className={styles.textBtn} onClick={reset} disabled={!filtered}>
                필터 지우기
              </button>
            </div>
          </div>
        </aside>

        {/* ── ② 본문 ─────────────────────────────────────────── */}
        <section className={theater.main}>
          <div className={theater.stageHead}>
            <p className={theater.now}>
              <b>{type === 'all' ? '전체 기출' : typeName.get(type) ?? type}</b>
              <span>
                {items.length} / {browse.items.length}
              </span>
            </p>
            <p className={theater.legend}>
              <span className={styles.legendLecture}>상영 있음</span>
              <span className={styles.legendThree}>
                <i>3점</i> 고배점
              </span>
              <span className={theater.clock}>{grouped.length}회차</span>
            </p>
          </div>

          <div className={theater.view}>
            <div className={theater.panes}>
              {/* ── 왼쪽 판: 오늘의 해부 + 거르개(참조 README 자리) ── */}
              <section className={theater.pane} aria-label="오늘의 해부와 거르개">
                <p className={theater.paneHead}>
                  <Code2 size={13} aria-hidden />
                  <span className={theater.file}>오늘의 해부</span>
                  <ChevronDown size={12} aria-hidden />
                  <em>{ready ? `${plan.length} ITEMS` : 'LOADING'}</em>
                </p>
                <div className={theater.paneBody}>
                  {active ? (
                    <Link className={styles.resume} href="/csat/dissect?resume=1">
                      <span>이어서</span>
                      {active.items[active.index].replace('#', ' · ')}번부터 하던 학습
                    </Link>
                  ) : null}

                  <div data-testid="today-card" aria-busy={!state}>
                    <p className={theater.lead}>
                      <b>오늘의 해부</b> · <code>{planType}</code>
                      {ready ? (
                        <>
                          {' '}
                          · <code>{plan.length}문항</code> · 예측 → 대조 → 전이 · 예상 <code>{plan.length * 4}분</code>
                        </>
                      ) : null}
                    </p>
                    {ready ? (
                      <>
                        <p className={styles.reason} data-testid="recommendation-reason">
                          {recommendationReason(catalog, plan, record, state!.now)}
                        </p>
                        <ol className={styles.plan}>
                          {plan.map((item, index) => (
                            <li key={item.id}>
                              <span className={styles.planNo}>{String(index + 1).padStart(2, '0')}</span>
                              <span>
                                <small>
                                  {STEP_ROLE[index]} · {item.exam_id} {item.no}번
                                </small>
                                {item.format}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </>
                    ) : (
                      <p className={theater.quiet}>{state ? '추천할 분석을 준비하고 있어요.' : '기기 기록을 확인하고 있어요…'}</p>
                    )}
                  </div>

                  <p className={styles.sectionHead}>
                    <ListFilter size={13} aria-hidden /> 거르기
                  </p>
                  <fieldset className={styles.group}>
                    <legend>시험</legend>
                    <div className={styles.chips}>
                      {([['all', '전체'], ['suneung', '수능'], ['mock', '모의평가']] as const).map(([value, label]) => (
                        <button key={value} type="button" aria-pressed={kind === value} onClick={() => set('kind', value as ExamKind | 'all')}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className={styles.group}>
                    <legend>학년도</legend>
                    <div className={styles.chips}>
                      <button type="button" aria-pressed={year === 'all'} onClick={() => set('year', 'all')}>
                        전체
                      </button>
                      {years.map((y) => (
                        <button key={y} type="button" aria-pressed={year === y} onClick={() => set('year', y)}>
                          {y}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className={styles.group}>
                    <legend>상태</legend>
                    <div className={styles.chips}>
                      {([['all', '전부'], ['lecture', '상영 있음'], ['map', '지도 있음']] as const).map(([value, label]) => (
                        <button key={value} type="button" aria-pressed={status === value} onClick={() => set('status', value as BrowseFilter['status'])}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <p className={theater.quiet}>
                    지문·선지는 평가원 저작물이라 싣지 않아요. 문항을 열면 <b>근거 자리</b>와 <b>오답 설계</b>를 차례로 봅니다.
                  </p>
                </div>
              </section>

              {/* ── 오른쪽 판: 결과(참조 Output 자리) ── */}
              <section className={theater.pane} aria-labelledby="library-title" data-testid="csat-library">
                <p className={theater.paneHead}>
                  <LayoutGrid size={13} aria-hidden />
                  <span className={theater.file} id="library-title">
                    문항
                  </span>
                  <ChevronDown size={12} aria-hidden />
                  <em>
                    {items.length} ITEMS · {grouped.length} EXAMS
                  </em>
                </p>
                <div className={theater.paneBody} id="csat-results">
                  <p className={theater.status}>
                    <span data-on={items.length > 0}>{items.length > 0 ? '200' : '0'}</span>
                    {items.length > 0 ? 'OK' : '결과 없음'}
                  </p>
                  {browse.error ? <p className={theater.quiet}>목록 일부를 읽지 못했어요: {browse.error}</p> : null}
                  {grouped.length === 0 ? (
                    <p className={theater.pending}>
                      <b>이 조건에 맞는 문항이 없어요</b>
                      <button type="button" className={styles.textBtn} onClick={reset}>
                        필터 지우기
                      </button>
                    </p>
                  ) : (
                    grouped.map(({ exam, items: rows }) => (
                      <section key={exam.id} className={styles.exam}>
                        <div className={styles.examHead}>
                          <h3>{exam.label}</h3>
                          <p>
                            {rows.length}문항{rows.length !== exam.items ? ` / ${exam.items}` : ''}
                          </p>
                        </div>
                        <ul className={styles.numbers}>
                          {rows.map((i) => (
                            <li key={i.id}>
                              <Link
                                href={`/csat/item/${toItemSlug(i.id)}`}
                                data-lecture={i.lecture}
                                aria-label={`${exam.label} ${i.no}번 · ${typeName.get(i.type_id) ?? i.type_id}${i.points ? ` · ${i.points}점` : ''}${i.lecture ? ' · 상영 있음' : ' · 상영 없음'}`}
                              >
                                <b>{i.no}</b>
                                <span>{typeName.get(i.type_id) ?? i.type_id}</span>
                                {i.points === 3 ? <i aria-hidden>3점</i> : null}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>

          {/* ── ③ 바닥 카드: 학습 네 걸음 ─────────────────────── */}
          <nav className={theater.cards} aria-label="학습 걸음">
            {steps.map((s, index) => (
              <Link key={s.name} href={s.href} className={theater.card} data-tint={s.tint} data-state={index === 0 && ready ? 'live' : 'done'}>
                <b>{s.name}</b>
                <span>
                  <em>{String(index + 1).padStart(2, '0')}</em>
                  <i>{s.detail}</i>
                </span>
              </Link>
            ))}
          </nav>
        </section>
      </div>
    </div>
  )
}

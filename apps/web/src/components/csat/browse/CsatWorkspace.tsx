'use client'

// apps/web/src/components/csat/browse/CsatWorkspace.tsx
//
// **전체 기출 서가 — 기출분석공간의 하위 화면.** (ia-design §1-2)
//
// 결은 홈(`/csat`)과 같다 — 같은 메뉴(`CsatRail`) · 상단 줄 · 흰 카드 · 도구줄. 해설 극장 판은
// 문항 해설(`/csat/item`)에만 쓴다(2026-09-24 사용자 지적 「극장 스타일 아님」).
//
// **기출 탐구(v3 M1)** — 상시 메뉴 「기출 탐구」 의 본문. 목적 · 유형 · 회차는 메뉴가 아니라 이 화면의 검색 조건이다:
//   목적 — 킬러 유형 · 근거 문장(지도 있음) · 최근 기출(조건) / 처음 시작 · 오답 설계 표(기존 화면으로 가는 링크)
//   유형 · 회차 · 출처 · 학년도 · 상태 · 검색어
// 고른 조건은 주소에 replaceState 로 싣는다(새로 고침 · 뒤로가기). 번호 칩은 `?ret=<지금 서가 주소>` 를 들고 가서
// 문항의 「뒤로」 가 같은 조건으로 돌아온다(browseReturn 이 서가 경로만 받는다). 옛 `?type=` · `?exam=` · `?status=` · `?from=` 주소도 그대로 열린다.
//
// ⚠️ 발문·지문은 여기 없다(저작권 경계). 칩이 말하는 것은 번호 · 유형 · 배점뿐이다.
// ⚠️ 수치는 전부 카탈로그에서 센 값이다(AGENTS I5).

import Link from 'next/link'
import { Crosshair, Dices, Library, Search, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { CsatRail, type NeedId, type RailPlace } from '@/components/csat/home/CsatRail'
import { useCsatRecord } from '@/components/csat/home/useCsatRecord'
import { track } from '@/lib/analytics/client'
import { activeSet, dueNow, touchedItems } from '@/lib/csat/continuity'
import { browseHref, type BrowseParams, type BrowsePurpose } from '@/lib/csat/browse-url'
import { killerTypeIds } from '@/lib/csat/space-model'
import { RECENT_FROM } from '@/lib/csat/trap-atlas'
import { EMPTY_FILTER, filterBrowse, groupByExam, type BrowseCatalog, type BrowseFilter, type ExamKind } from '@/lib/csat/browse-model'
import { toItemSlug } from '@/lib/csat/item-slug'
import type { RailExam } from '@/lib/csat/rail-data'

import home from '../home/home.module.css'
import bc from './browse-conditions.module.css'
import styles from '../space/space.module.css'

export type BrowseEntry = BrowseParams

const isEmpty = (f: BrowseFilter) =>
  f.kind === 'all' && (f.grade ?? 'all') === 'all' && f.year === 'all' && f.type === 'all' && f.status === 'all' && f.query.trim() === '' && (f.exam ?? 'all') === 'all' && (f.from ?? 'all') === 'all'

export function CsatWorkspace({ browse, exams, entry }: { browse: BrowseCatalog; exams: RailExam[]; entry: BrowseEntry }) {
  const rec = useCsatRecord()
  const [filter, setFilter] = useState<BrowseFilter>({
    ...EMPTY_FILTER,
    type: entry.type && browse.types.some((t) => t.id === entry.type) ? entry.type : 'all',
    status: entry.status ?? 'all',
    from: entry.from ?? 'all',
    exam: entry.exam && browse.exams.some((e) => e.id === entry.exam) ? entry.exam : 'all',
    query: entry.query ?? '',
    kind: entry.kind ?? 'all',
    year: entry.year ?? 'all',
    grade: entry.grade ?? 'all',
  })
  // 목적 — killer 만 별도 상태(유형 묶음). evidence · recent 는 status · from 조건 그 자체다
  const [killer, setKiller] = useState(entry.purpose === 'killer')
  const killers = useMemo(() => new Set(killerTypeIds()), [])
  // 옛 목적 링크(?purpose=evidence · recent)는 조건으로 펼친다
  useEffect(() => {
    if (entry.purpose === 'evidence') setFilter((f) => ({ ...f, status: 'map' }))
    if (entry.purpose === 'recent') setFilter((f) => ({ ...f, from: RECENT_FROM }))
  }, [entry.purpose])
  const set = <K extends keyof BrowseFilter>(key: K, value: BrowseFilter[K]) => setFilter((f) => ({ ...f, [key]: value }))

  const years = useMemo(() => [...new Set(browse.exams.map((e) => e.year))].sort((a, b) => b - a), [browse.exams])
  const typeName = useMemo(() => new Map(browse.types.map((t) => [t.id, t.name])), [browse.types])
  const examLabel = useMemo(() => new Map(browse.exams.map((e) => [e.id, e.label])), [browse.exams])
  const items = useMemo(() => {
    const all = filterBrowse(browse, filter)
    return killer ? all.filter((i) => killers.has(i.type_id)) : all
  }, [browse, filter, killer, killers])
  const grouped = useMemo(() => groupByExam(browse, items), [browse, items])
  const seen = useMemo(() => (rec ? touchedItems(rec.record) : new Set<string>()), [rec])
  const random = items.length ? items[Math.floor(Math.random() * items.length)] : null
  const { kind, year, type, status, query } = filter
  const grade = filter.grade ?? 'all'
  // 학력평가가 서가에 있을 때만 출처 칩에 「학력평가」·학년을 보인다(발행된 학평이 없으면 칩도 없다)
  const hasHak = useMemo(() => browse.exams.some((e) => e.kind === 'hakpyeong'), [browse.exams])
  const exam = filter.exam ?? 'all'
  const reset = () => {
    setFilter(EMPTY_FILTER)
    setKiller(false)
  }
  const purpose: BrowsePurpose | null = killer ? 'killer' : null
  // 지금 조건의 주소 — 새로 고침 · 뒤로가기 · 문항에서 돌아올 자리(history 를 쌓지 않는다)
  const here = browseHref(filter, purpose)
  useEffect(() => {
    const cur = `${window.location.pathname}${window.location.search}`
    if (cur !== here) window.history.replaceState(window.history.state, '', here)
  }, [here])
  // 스크롤 위치 복귀(v3 M1) — 문항 칩을 누를 때 지금 조건 주소를 열쇠로 위치를 남기고, 같은 조건으로 돌아오면 그 자리로.
  //   sessionStorage(탭 단위 · 조건 주소별)라 다른 조건 · 다른 탭에는 남지 않는다. 저장소를 못 쓰면 맨 위에서 시작한다.
  const scrollKey = (href: string) => `csat-browse-scroll:${href}`
  const keepScroll = () => {
    try {
      sessionStorage.setItem(scrollKey(here), String(Math.round(window.scrollY)))
    } catch {
      // 저장 실패 — 돌아오면 맨 위부터
    }
  }
  useEffect(() => {
    let y: number | null = null
    try {
      const raw = sessionStorage.getItem(scrollKey(`${window.location.pathname}${window.location.search}`))
      if (raw !== null) y = Number(raw)
      if (raw !== null) sessionStorage.removeItem(scrollKey(`${window.location.pathname}${window.location.search}`))
    } catch {
      y = null
    }
    if (y !== null && Number.isFinite(y) && y > 0) {
      const target = y
      requestAnimationFrame(() => window.scrollTo(0, target))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 그릴 때 한 번(돌아온 조건 주소 기준)
  }, [])
  const choosePurpose = (p: BrowsePurpose) => {
    track({ name: 'csat_path_chosen', props: { axis: 'purpose', need: p } })
    if (p === 'killer') setKiller((k) => !k)
    if (p === 'evidence') set('status', status === 'map' ? 'all' : 'map')
    if (p === 'recent') set('from', filter.from === RECENT_FROM ? 'all' : RECENT_FROM)
  }

  // 메뉴에서 어느 줄이 「지금」인가 — 지금 걸린 조건을 그대로 비춘다
  const need: NeedId | null = status === 'map' ? 'evidence' : filter.from && filter.from !== 'all' ? 'recent' : null
  const place: RailPlace = exam !== 'all' ? 'exam' : type !== 'all' ? 'type' : need ? 'need' : 'browse'
  const current = place === 'exam' ? exam : place === 'type' ? type : need ?? undefined
  const title =
    exam !== 'all'
      ? examLabel.get(exam) ?? '회차'
      : type !== 'all'
        ? typeName.get(type) ?? type
        : need === 'evidence'
          ? '근거 문장 찾기 — 지문 지도가 있는 문항'
          : need === 'recent'
            ? `최근 기출부터 — ${filter.from}학년도 이후`
            : killer
              ? '킬러 유형'
              : '기출 탐구 — 전체'

  return (
    <div className={styles.root} data-csat-browse data-testid="csat-workspace">
      <CsatRail place={place} current={current} exams={exams} dueCount={rec ? dueNow(rec.record, rec.now).length + (activeSet(rec.record) ? 1 : 0) : null} />

      <div className="min-w-0">
        <header className={styles.topbar}>
          <span className={styles.topPill}>
            <Library size={13} aria-hidden="true" />
            서가 <b>{browse.items.length.toLocaleString('ko-KR')}</b>문항 · <b>{browse.exams.length}</b>회차 · <b>{browse.types.length}</b>유형
          </span>
          {random ? (
            <Link className={styles.topLink} href={`/csat/item/${toItemSlug(random.id)}`}>
              <Dices size={14} aria-hidden="true" />
              아무거나 한 문항
            </Link>
          ) : null}
        </header>

        <div className={styles.canvas}>
          <div className={styles.panel} style={{ marginTop: 0, borderRadius: 0, borderTop: 0 }}>
            <div className={styles.tabs}>
              <span className={styles.tab} aria-current="page" style={{ cursor: 'default' }}>
                <Library size={14} aria-hidden="true" />
                <span data-testid="browse-title">{title}</span>
                <span className={styles.tabCount} data-testid="browse-count">
                  {items.length}
                </span>
              </span>
              {!isEmpty(filter) || killer ? (
                <button type="button" className={styles.tabsRight} onClick={reset} data-testid="browse-reset">
                  <X size={13} aria-hidden="true" />
                  조건 지우기
                </button>
              ) : null}
            </div>

            <div className={bc.conditions} data-testid="browse-conditions">
            {/* 목적 — 메뉴가 아니라 검색 조건(v3 M1). 처음 시작 · 오답 설계 표는 기존 화면으로 */}
            <div className={home.tools} role="group" aria-label="목적" data-testid="browse-purpose">
              {(
                [
                  ['killer', '킬러 유형', killer],
                  ['evidence', '근거 문장 찾기', status === 'map'],
                  ['recent', '최근 기출부터', filter.from === RECENT_FROM],
                ] as const
              ).map(([p, label, on]) => (
                <button key={p} type="button" className={home.chip} aria-pressed={on} onClick={() => choosePurpose(p)} data-purpose={p}>
                  {label}
                </button>
              ))}
              <Link className={home.chip} href="/csat/dissect" onClick={() => track({ name: 'csat_path_chosen', props: { axis: 'purpose', need: 'start' } })} data-purpose="start">
                <Sparkles size={13} aria-hidden="true" /> 처음 시작하기
              </Link>
              <Link className={home.chip} href="/csat?tab=trap" onClick={() => track({ name: 'csat_path_chosen', props: { axis: 'purpose', need: 'trap' } })} data-purpose="trap">
                <Crosshair size={13} aria-hidden="true" /> 오답 설계 표
              </Link>
            </div>

            <div className={home.tools} role="group" aria-label="거르기">
              <label className={home.search}>
                <Search size={14} aria-hidden="true" />
                <span className="sr-only">유형 · 회차 · 번호로 찾기</span>
                <input id="csat-library-search" type="search" value={query} placeholder="예: 빈칸 · 2026 · 31" onChange={(e) => set('query', e.target.value)} />
              </label>
              {(
                [['all', hasHak ? '출처 전부' : '수능·모의'], ['suneung', '수능'], ['mock', '모의평가'], ...(hasHak ? ([['hakpyeong', '학력평가']] as const) : [])] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={home.chip}
                  aria-pressed={kind === value}
                  data-testid={`browse-kind-${value}`}
                  onClick={() => setFilter((f) => ({ ...f, kind: value as ExamKind | 'all', grade: value === 'hakpyeong' ? (f.grade ?? 'all') : 'all' }))}
                >
                  {label}
                </button>
              ))}
              {kind === 'hakpyeong' ? (
                <>
                  <label className="sr-only" htmlFor="csat-browse-grade">
                    학년
                  </label>
                  <select
                    id="csat-browse-grade"
                    className={home.chip}
                    value={String(grade)}
                    onChange={(e) => set('grade', e.target.value === 'all' ? 'all' : (Number(e.target.value) as 1 | 2 | 3))}
                  >
                    <option value="all">학년 전체</option>
                    {([3, 2, 1] as const).map((g) => (
                      <option key={g} value={g}>
                        고{g}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
              {([['all', '상태 전부'], ['lecture', '강의 있음'], ['map', '지도 있음']] as const).map(([value, label]) => (
                <button key={value} type="button" className={home.chip} aria-pressed={status === value} onClick={() => set('status', value as BrowseFilter['status'])}>
                  {label}
                </button>
              ))}
              <label className="sr-only" htmlFor="csat-browse-year">
                학년도
              </label>
              <select
                id="csat-browse-year"
                className={home.chip}
                value={year === 'all' ? 'all' : String(year)}
                onChange={(e) => set('year', e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <option value="all">학년도 전체</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}학년도
                  </option>
                ))}
              </select>
              {/* 회차 — 옛 「회차별」 메뉴가 서가 조건으로(v3 M1) */}
              <label className="sr-only" htmlFor="csat-browse-exam">
                회차
              </label>
              <select id="csat-browse-exam" className={home.chip} value={exam} onChange={(e) => set('exam', e.target.value)} data-testid="browse-exam">
                <option value="all">회차 전체</option>
                {browse.exams.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="csat-library-type">
                유형
              </label>
              <select id="csat-library-type" className={home.chip} value={type} onChange={(e) => set('type', e.target.value)}>
                <option value="all">유형 전체</option>
                {browse.types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.items}){t.status === 'retired' ? ' · 폐지' : ''}
                  </option>
                ))}
              </select>
              <p className={home.breadth} role="status">
                <b>{items.length}</b>문항 · <b>{grouped.length}</b>회차
                {rec ? (
                  <>
                    {' '}
                    · 연 문항 <b>{items.filter((i) => seen.has(i.id)).length}</b>
                  </>
                ) : null}
              </p>
            </div>

            </div>

            <div data-testid="csat-library" id="csat-results">
              {browse.error ? <p className={`${home.section} ${home.empty}`}>목록 일부를 읽지 못했어요: {browse.error}</p> : null}
              {grouped.length === 0 ? (
                <div className={styles.empty}>
                  <p>이 조건에 맞는 문항이 없어요.</p>
                  <button type="button" className={styles.emptyReset} onClick={reset}>
                    조건 지우기
                  </button>
                </div>
              ) : (
                grouped.map(({ exam: e, items: rows }) => (
                  <section key={e.id} className={home.exam}>
                    <div className={home.examHead}>
                      <h3>{e.label}</h3>
                      <p>
                        {rows.length}문항{rows.length !== e.items ? ` / ${e.items}` : ''}
                      </p>
                    </div>
                    <ul className={home.numbers}>
                      {rows.map((i) => (
                        <li key={i.id}>
                          <Link
                            href={`/csat/item/${toItemSlug(i.id)}?ret=${encodeURIComponent(here)}`}
                            onClick={keepScroll}
                            data-lecture={i.lecture}
                            data-seen={seen.has(i.id)}
                            aria-label={`${e.label} ${i.no}번 · ${typeName.get(i.type_id) ?? i.type_id}${i.points ? ` · ${i.points}점` : ''}${i.lecture ? ' · 강의 있음' : ' · 강의 없음'}${seen.has(i.id) ? ' · 연 문항' : ''}`}
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
          </div>

          <div className={styles.foot}>
            <p>
              점선 칸은 해설 강의가 아직 없는 문항, 옅은 칸은 이미 연 문항이에요. 지문·선지는 평가원·교육청 저작물이라 서버에 싣지 않아요 — 받은 문제지 PDF 를 놓으면 이 기기에서만 보여요. 문항을 열면 근거
              자리와 오답 설계를 차례로 봅니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

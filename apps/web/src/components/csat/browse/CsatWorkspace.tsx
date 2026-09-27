'use client'

// apps/web/src/components/csat/browse/CsatWorkspace.tsx
//
// **전체 기출 서가 — 기출분석공간의 하위 화면.** (ia-design §1-2)
//
// 결은 홈(`/csat`)과 같다 — 같은 메뉴(`CsatRail`) · 상단 줄 · 흰 카드 · 도구줄. 해설 극장 판은
// 문항 해설(`/csat/item`)에만 쓴다(2026-09-24 사용자 지적 「극장 스타일 아님」).
//
// 세 입구가 여기로 모인다:
//   목적별 — `?status=map`(근거 문장 찾기) · `?from=<학년도>`(최근 기출부터)
//   유형별 — `?type=<유형 id>`
//   회차별 — `?exam=<회차 id>`
// 어느 쪽으로 들어와도 같은 번호 칩 → 같은 문항 화면(`/csat/item/[slug]`)이다.
//
// ⚠️ 발문·지문은 여기 없다(저작권 경계). 칩이 말하는 것은 번호 · 유형 · 배점뿐이다.
// ⚠️ 수치는 전부 카탈로그에서 센 값이다(AGENTS I5).

import Link from 'next/link'
import { Dices, Library, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { CsatRail, type NeedId, type RailPlace } from '@/components/csat/home/CsatRail'
import { useCsatRecord } from '@/components/csat/home/useCsatRecord'
import { activeSet, dueNow, touchedItems } from '@/lib/csat/continuity'
import { EMPTY_FILTER, filterBrowse, groupByExam, type BrowseCatalog, type BrowseFilter, type ExamKind } from '@/lib/csat/browse-model'
import { toItemSlug } from '@/lib/csat/item-slug'
import type { RailExam } from '@/lib/csat/rail-data'

import home from '../home/home.module.css'
import styles from '../space/space.module.css'

export interface BrowseEntry {
  type?: string
  status?: BrowseFilter['status']
  from?: number
  exam?: string
  query?: string
}

const isEmpty = (f: BrowseFilter) =>
  f.kind === 'all' && f.year === 'all' && f.type === 'all' && f.status === 'all' && f.query.trim() === '' && (f.exam ?? 'all') === 'all' && (f.from ?? 'all') === 'all'

export function CsatWorkspace({ browse, exams, entry }: { browse: BrowseCatalog; exams: RailExam[]; entry: BrowseEntry }) {
  const rec = useCsatRecord()
  const [filter, setFilter] = useState<BrowseFilter>({
    ...EMPTY_FILTER,
    type: entry.type && browse.types.some((t) => t.id === entry.type) ? entry.type : 'all',
    status: entry.status ?? 'all',
    from: entry.from ?? 'all',
    exam: entry.exam && browse.exams.some((e) => e.id === entry.exam) ? entry.exam : 'all',
    query: entry.query ?? '',
  })
  const set = <K extends keyof BrowseFilter>(key: K, value: BrowseFilter[K]) => setFilter((f) => ({ ...f, [key]: value }))

  const years = useMemo(() => [...new Set(browse.exams.map((e) => e.year))].sort((a, b) => b - a), [browse.exams])
  const typeName = useMemo(() => new Map(browse.types.map((t) => [t.id, t.name])), [browse.types])
  const examLabel = useMemo(() => new Map(browse.exams.map((e) => [e.id, e.label])), [browse.exams])
  const items = useMemo(() => filterBrowse(browse, filter), [browse, filter])
  const grouped = useMemo(() => groupByExam(browse, items), [browse, items])
  const seen = useMemo(() => (rec ? touchedItems(rec.record) : new Set<string>()), [rec])
  const random = items.length ? items[Math.floor(Math.random() * items.length)] : null
  const { kind, year, type, status, query } = filter
  const exam = filter.exam ?? 'all'
  const reset = () => setFilter(EMPTY_FILTER)

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
            : '전체 서가'

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
              {!isEmpty(filter) ? (
                <button type="button" className={styles.tabsRight} onClick={reset} data-testid="browse-reset">
                  <X size={13} aria-hidden="true" />
                  조건 지우기
                </button>
              ) : null}
            </div>

            <div className={home.tools} role="group" aria-label="거르기">
              <label className={home.search}>
                <Search size={14} aria-hidden="true" />
                <span className="sr-only">유형 · 회차 · 번호로 찾기</span>
                <input id="csat-library-search" type="search" value={query} placeholder="예: 빈칸 · 2026 · 31" onChange={(e) => set('query', e.target.value)} />
              </label>
              {([['all', '수능·모의'], ['suneung', '수능'], ['mock', '모의평가']] as const).map(([value, label]) => (
                <button key={value} type="button" className={home.chip} aria-pressed={kind === value} onClick={() => set('kind', value as ExamKind | 'all')}>
                  {label}
                </button>
              ))}
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
                            href={`/csat/item/${toItemSlug(i.id)}`}
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
              점선 칸은 해설 강의가 아직 없는 문항, 옅은 칸은 이미 연 문항이에요. 지문·선지는 평가원 저작물이라 서버에 싣지 않아요 — 받은 문제지 PDF 를 놓으면 이 기기에서만 보여요. 문항을 열면 근거
              자리와 오답 설계를 차례로 봅니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

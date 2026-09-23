'use client'

// apps/web/src/components/csat/browse/CsatLibrary.tsx
//
// **전체 기출 서가 — 802문항을 학습자가 직접 고른다.**
//
// 이전 화면은 「오늘의 해부」가 골라 준 3문항만 열 수 있었고, 목록에 있는 문항은 12개였다.
// 자료는 처음부터 802개였다(29회차 · 26유형 · 공개 분석 802/802 · 강의 792).
// 그래서 이 화면은 **거르지 않고 다 내놓고**, 학습자가 네 축으로 좁힌다:
//
//   시험 종류(수능 / 모의평가) · 학년도 · 유형 · 상태(상영 있음 / 지도 있음)
//
// 목록의 단위는 **회차**다. 「2026학년도 수능 · 28문항」 아래에 번호 칩이 깔린다 —
// 시험지를 펴 놓은 모양이라, 학습자가 이미 아는 좌표(몇 번 문제)로 바로 손이 간다.
//
// ⚠️ 발문·지문은 여기 없다(저작권 경계). 칩이 말하는 것은 번호 · 유형 · 배점뿐이다.

import Link from 'next/link'
import { Dices, LayoutGrid, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { toItemSlug } from '@/lib/csat/item-slug'
import { EMPTY_FILTER, filterBrowse, groupByExam, type BrowseCatalog, type BrowseFilter, type ExamKind } from '@/lib/csat/browse-model'

import styles from './library.module.css'

export function CsatLibrary({ catalog, initialType }: { catalog: BrowseCatalog; initialType?: string }) {
  // 축 넷과 찾기를 **한 덩어리**로 든다 — 축마다 state 를 두면 「필터 지우기」가 다섯 줄이 되고,
  // 한 줄을 빠뜨린 채 지워지는 사고가 난다.
  const [filter, setFilter] = useState<BrowseFilter>({
    ...EMPTY_FILTER,
    type: initialType && catalog.types.some((t) => t.id === initialType) ? initialType : 'all',
  })
  const set = <K extends keyof BrowseFilter>(key: K, value: BrowseFilter[K]) => setFilter((f) => ({ ...f, [key]: value }))

  const years = useMemo(() => [...new Set(catalog.exams.map((e) => e.year))].sort((a, b) => b - a), [catalog.exams])
  const typeName = useMemo(() => new Map(catalog.types.map((t) => [t.id, t.name])), [catalog.types])
  const items = useMemo(() => filterBrowse(catalog, filter), [catalog, filter])
  const grouped = useMemo(() => groupByExam(catalog, items), [catalog, items])

  const random = items.length ? items[Math.floor(Math.random() * items.length)] : null
  const reset = () => setFilter(EMPTY_FILTER)
  const { kind, year, type, status, query } = filter

  return (
    <section className={styles.library} aria-labelledby="library-title" data-testid="csat-library">
      <div className={styles.head}>
        <div>
          <p className={styles.eyebrow}>전체 기출</p>
          <h2 id="library-title">아무 문항이나, 지금 바로</h2>
          <p className={styles.lede}>
            수능 {catalog.exams.filter((e) => e.kind === 'suneung').length}회차 · 모의평가{' '}
            {catalog.exams.filter((e) => e.kind === 'mock').length}회차 · {catalog.types.length}유형 ·{' '}
            <b>{catalog.items.length}문항</b>. 고르면 근거와 오답 설계를 차례로 봐요.
          </p>
        </div>
        {/* 서가의 두 갈래 — 한 문항으로 바로 들어가거나, 유형·함정을 한 판에 놓고 고르거나.
            작업 공간(`/csat/space`)으로 들어오는 **유일한 길**이다(링크 그래프 라쳇이 지킨다). */}
        <div className={styles.headLinks}>
          <Link className={styles.dice} href="/csat/space">
            <LayoutGrid size={16} aria-hidden /> 작업 공간에서 고르기
          </Link>
          {random ? (
            <Link className={styles.dice} href={`/csat/item/${toItemSlug(random.id)}`}>
              <Dices size={16} aria-hidden /> 아무거나 한 문항
            </Link>
          ) : null}
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.filters}>
          <label className={styles.search}>
            <Search size={15} aria-hidden />
            <input
              id="csat-library-search"
              type="search"
              value={query}
              placeholder="유형·회차·번호"
              aria-label="유형 · 회차 · 번호로 찾기"
              onChange={(e) => set('query', e.target.value)}
            />
          </label>

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

          <div className={styles.group}>
            <label className={styles.selectLabel} htmlFor="csat-library-type">
              유형
            </label>
            <select id="csat-library-type" value={type} onChange={(e) => set('type', e.target.value)}>
              <option value="all">전체 유형 ({catalog.items.length})</option>
              {catalog.types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.items}){t.status === 'retired' ? ' · 폐지' : ''}
                </option>
              ))}
            </select>
          </div>

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

          <p className={styles.count} role="status">
            {items.length}문항 · {grouped.length}회차
          </p>
          <button type="button" className={styles.reset} onClick={reset}>
            필터 지우기
          </button>
        </div>

        <div className={styles.results}>
          {catalog.error ? <p className={styles.quiet}>목록 일부를 읽지 못했어요: {catalog.error}</p> : null}
          {grouped.length === 0 ? (
            <p className={styles.quiet}>
              이 조건에 맞는 문항이 없어요.{' '}
              <button type="button" className={styles.inlineReset} onClick={reset}>
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
      </div>
    </section>
  )
}

// apps/web/src/components/csat/home/HomeLanding.tsx
'use client'
//
// **내 학습 지도 — `/csat` 지도 중심 홈.** (v3 M1 · CSAT_LEARNER_UX_V3 §1 · §7)
//
// 한 화면에 역할을 나눈다: ① 첫 제안 하나 ② 핵심 학습 지도 ③ 내 자료(쓸 때 여는 기록 · 진단 · 공식 · 연습) ④ 기출 탐구 입구.
// 첫 제안은 `pickHomeSuggestion` 이 기존 상태에서 고른다(새 점수 · 순위 없음). 「확인 필요 · 기록 없음 · 기록만」 은
// 지도의 초점 카드가 그대로 첫 제안이다 — 홈이 같은 판정을 다시 쓰지 않는다.
// 기출 탐구는 언제나 열려 있다(진단이 탐구의 입장권이 아니다). 지도를 못 읽으면 오류로 말하고 기록 0 으로 추정하지 않는다.

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { AlertTriangle, ArrowRight, BookMarked, CornerUpLeft, FlaskConical, History, Library, NotebookPen, Stethoscope } from 'lucide-react'

import { track } from '@/lib/analytics/client'
import { activeSet, dueBucket, dueNow, gapBucket, gapDays, visitState } from '@/lib/csat/continuity'
import { pickHomeSuggestion, type HomeFocusKind, type MapLoadState } from '@/lib/csat/home-suggestion'
import type { MapPageData } from '@/lib/csat/map/load'

import { MapPreparing } from '../diagnosis/map/MapPreparing'
import { MapScreen } from '../diagnosis/map/MapScreen'
import styles from '../space/space.module.css'
import { ContinueCard } from './ContinueCard'
import { CsatRail } from './CsatRail'
import home from './home.module.css'
import l from './home-landing.module.css'
import { useCsatRecord } from './useCsatRecord'

/** 지도 화면의 기록 · 상세 주소는 진단 화면 그대로(UX §7 — root 에서 MapScreen 을 재사용할 때 base 유지) */
const MAP_BASE = '/csat/diagnosis'

export function HomeLanding({
  exams,
  map,
  mapData,
  focusKind,
  returned,
}: {
  exams: { exam_id: string; label: string; items: number }[]
  map: MapLoadState
  mapData: MapPageData | null
  focusKind: HomeFocusKind | null
  /** 문항에서 돌아왔으면 그 문항(slug · 라벨) */
  returned: { slug: string; label: string } | null
}) {
  const rec = useCsatRecord()
  const due = rec ? dueNow(rec.record, rec.now).length : null
  const set = rec ? activeSet(rec.record) !== null : null
  // 이어서 = 진행 중 세트 또는 오늘 할 복습(기기 기록의 실제 과제) — 둘 다 ContinueCard 가 행동을 맡는다
  const ongoing = rec ? Boolean(set) || (due ?? 0) > 0 : null
  const suggest = pickHomeSuggestion({ map, focusKind, returned: returned !== null, activeSet: ongoing })

  // 홈 상태는 기록을 읽은 **뒤** 한 번만 센다(지속 학습 지표 분모 · ia-design §5) — 이번엔 고른 첫 제안도 함께(닫힌 열거형)
  const sent = useRef(false)
  useEffect(() => {
    if (!rec || sent.current) return
    sent.current = true
    track({
      name: 'csat_home_viewed',
      props: {
        state: visitState(rec.record, rec.now),
        due: dueBucket(rec.dueBefore),
        gap: gapBucket(gapDays(rec.record, rec.now)),
        active: activeSet(rec.record) !== null,
        synced: rec.synced,
        suggest,
      },
    })
  }, [rec, suggest])

  return (
    <div className={styles.root} data-csat-space data-testid="csat-home" data-suggest={rec ? suggest : 'loading'}>
      <CsatRail place="home" exams={exams} dueCount={rec ? (due ?? 0) + (set ? 1 : 0) : null} />

      <div className="min-w-0">
        <header className={styles.topbar}>
          <span className={styles.topPill}>내 학습 지도</span>
          <Link className={styles.topLink} href="/csat/browse" data-testid="home-browse-top">
            <Library size={14} aria-hidden="true" />
            기출 탐구
          </Link>
        </header>

        <div className={`${styles.canvas} ${l.canvas}`}>
          {/* ① 첫 제안 — 지도 초점이 맡는 경우에는 짧은 안내만 두고 지도 카드로 보낸다 */}
          <section className={l.suggest} aria-label="먼저 할 일" data-testid="home-suggest" data-kind={suggest}>
            {suggest === 'error' ? (
              <div className={home.card} role="alert" data-testid="home-map-error">
                <p className={home.cardBack}>
                  <AlertTriangle size={13} aria-hidden="true" /> 학습 지도를 불러오지 못했어요
                </p>
                <div className={home.cardFront}>
                  <p className={`${home.cardLead} break-keep`}>잠시 뒤 다시 열어 주세요. 기록이 없다는 뜻이 아니에요. 기출 탐구는 그대로 쓸 수 있어요.</p>
                  <div className={home.cardActions}>
                    <Link className={home.primary} href="/csat">다시 열기</Link>
                    <Link className={home.secondary} href="/csat/browse">기출 탐구</Link>
                  </div>
                </div>
              </div>
            ) : suggest === 'return' && returned ? (
              <div className={home.card} data-testid="home-return">
                <p className={home.cardBack}>
                  <CornerUpLeft size={13} aria-hidden="true" /> 탐구에서 돌아왔어요
                </p>
                <div className={home.cardFront}>
                  <p className={`${home.cardLead} break-keep`}>
                    방금 본 <b>{returned.label}</b>로 다시 가거나, 아래 지도에서 다음에 할 일을 이어서 보세요. 탐구를 본 것만으로 지도의 판정이 바뀌지는 않아요.
                  </p>
                  <div className={home.cardActions}>
                    <Link className={home.secondary} href={`/csat/item/${returned.slug}?from=map`} data-testid="home-return-item">
                      {returned.label} 다시 보기
                    </Link>
                    <a className={home.primary} href="#focus-h">
                      지도의 다음 할 일 <ArrowRight size={14} aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>
            ) : suggest === 'resume' ? (
              <ContinueCard state={rec} />
            ) : suggest === 'preparing' ? (
              <p className={`${l.lead} break-keep`} data-testid="home-preparing">학습 지도는 아직 준비 중이에요. 그동안 기출 탐구에서 문항을 살펴볼 수 있어요.</p>
            ) : (
              <p className={`${l.lead} break-keep`} data-testid="home-map-lead">
                {suggest === 'goal'
                  ? '먼저 목표 점수를 정하면 지도가 지금 근거로 먼저 확인할 것을 골라요.'
                  : suggest === 'check'
                  ? '지도가 지금 근거로 먼저 확인할 것 하나를 골라 두었어요.'
                  : suggest === 'no_records'
                    ? '아직 시험 기록이 없어요. 지도는 기록을 넣으면 그려져요. 기출 탐구는 기록 없이도 쓸 수 있어요.'
                    : '기록이 쌓이는 중이에요. 지도에서 지금 근거로 보이는 것을 확인하세요.'}{' '}
                <a href="#focus-h" className={l.inlineLink}>지도에서 보기</a>
              </p>
            )}
          </section>

          {/* ② 핵심 학습 지도 */}
          <section className={l.map} aria-label="학습 지도" data-testid="home-map" data-map={map}>
            {map === 'ok' && mapData ? (
              <MapScreen data={mapData} view="core" base={MAP_BASE} />
            ) : map === 'preparing' ? (
              <MapPreparing />
            ) : null}
          </section>

          {/* ③ 내 자료 — 쓸 때 연다(메뉴에 올리지 않는다) · 기존 경로 그대로 */}
          <nav className={l.mine} aria-label="내 자료" data-testid="home-mine">
            <Link className={l.mineItem} href="/csat?view=continue" data-testid="home-continue">
              <History size={15} aria-hidden="true" /> 이어서 · 복습
              {due ? <span className={l.count}>{due}</span> : null}
            </Link>
            <Link className={l.mineItem} href="/csat/record">
              <BookMarked size={15} aria-hidden="true" /> 내 기록
            </Link>
            <Link className={l.mineItem} href="/csat/diagnosis">
              <Stethoscope size={15} aria-hidden="true" /> 내 진단
            </Link>
            <Link className={l.mineItem} href="/csat/formulas">
              <NotebookPen size={15} aria-hidden="true" /> 내 공식
            </Link>
            <Link className={l.mineItem} href="/csat/practice">
              <FlaskConical size={15} aria-hidden="true" /> 연습 · 주장과 근거
            </Link>
          </nav>

          {/* ④ 기출 탐구 입구 — 진단 없이도 언제나 */}
          <section className={l.explore} aria-label="기출 탐구" data-testid="home-explore">
            <div>
              <p className={l.exploreTitle}>기출 탐구</p>
              <p className={`${l.lead} break-keep`}>목적 · 유형 · 회차로 골라 문항 하나를 원문 근거부터 끝까지 탐구해요.</p>
            </div>
            <span className={l.exploreActions}>
              <Link className={home.secondary} href="/csat/dissect" data-testid="home-start">
                처음이라면 3문항으로 시작
              </Link>
              <Link className={home.primary} href="/csat/browse" data-testid="home-explore-go">
                기출 탐구로 <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </span>
          </section>
        </div>
      </div>
    </div>
  )
}

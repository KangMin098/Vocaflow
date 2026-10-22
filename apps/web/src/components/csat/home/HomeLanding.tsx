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
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, BookMarked, ClipboardCheck, ListChecks, CornerUpLeft, FlaskConical, History, Library, NotebookPen, Search, Stethoscope } from 'lucide-react'

import { ItemFinderDialog } from '@/components/csat/browse/ItemFinderDialog'
import finder from '@/components/csat/browse/item-finder.module.css'
import { EMPTY_SELECTION, finderItemHref } from '@/lib/csat/item-finder'

import { track } from '@/lib/analytics/client'
import { activeSet, dueBucket, dueNow, gapBucket, gapDays, visitState } from '@/lib/csat/continuity'
import { pickHomeSuggestion, type HomeFocusKind, type MapLoadState } from '@/lib/csat/home-suggestion'
import { toItemSlug } from '@/lib/csat/item-slug'
import { reviewsDue, unfinishedSessions } from '@/lib/csat/learning-session'
import type { MapProgress } from '@/lib/csat/map/home-progress'
import type { MapPageData } from '@/lib/csat/map/load'
import { mapReturnQuery, type MapReturnCtx } from '@/lib/csat/map-return'

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
  restore = null,
  progress = null,
}: {
  exams: { exam_id: string; label: string; items: number }[]
  map: MapLoadState
  mapData: MapPageData | null
  focusKind: HomeFocusKind | null
  /** 문항에서 돌아왔으면 그 문항(slug · 라벨) */
  returned: { slug: string; label: string } | null
  /** 지도 활동 복귀 문맥(검증된 과제 · 학습 묶음 · 단계) — 지도가 그 묶음 · 단계 시트를 열고, 홈이 그 과제 칸을 표시한다 */
  restore?: MapReturnCtx | null
  /** 지도에서 하던 일(확인 중 과제 · 계획량에 못 미친 저장 계획) */
  progress?: MapProgress | null
}) {
  const router = useRouter()
  // 기출 찾기(2026-10-13) — 기출 탐구 입구의 보조 행동. 전체 조건으로 시작한다(성취 · 점수로 고르지 않는다)
  const [finderOpen, setFinderOpen] = useState(false)
  const returnTask = restore?.task ?? null
  const rec = useCsatRecord()
  const due = rec ? dueNow(rec.record, rec.now).length : null
  const set = rec ? activeSet(rec.record) !== null : null
  // 이어서 = 진행 중 세트 또는 오늘 할 복습(기기 기록의 실제 과제) — 둘 다 ContinueCard 가 행동을 맡는다
  // 해설 극장 세션(G0) — 다시 볼 때가 된 문항 · 하다 만 문항. 세트 · 복습이 없을 때 이것으로 이어 간다
  const itemAgain = rec ? reviewsDue(rec.record, rec.now)[0] ?? null : null
  const itemHalf = rec ? unfinishedSessions(rec.record)[0] ?? null : null
  const itemResume = itemAgain ?? itemHalf
  const ongoing = rec ? Boolean(set) || (due ?? 0) > 0 || itemResume !== null : null
  // 지도 과제 복귀 — 그 과제 칸을 찾아 화면에 들이고 표시한다(없으면 찾지 못했다고 말한다)
  const [taskFound, setTaskFound] = useState<boolean | null>(null)
  useEffect(() => {
    if (!returnTask) return
    const el = document.querySelector<HTMLElement>(`[data-task="${CSS.escape(returnTask)}"]`)
    if (!el) {
      setTaskFound(false)
      return
    }
    el.setAttribute('data-returned', 'true')
    el.scrollIntoView({ block: 'center' })
    setTaskFound(true)
  }, [returnTask, map])
  const suggest = pickHomeSuggestion({ map, focusKind, returned: returned !== null, activeSet: ongoing, mapProgress: progress ? { check: !!progress.check, plan: !!progress.plan } : null })

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
                    {/* 같은 주소로의 Link 는 라우터 캐시의 오류 화면을 다시 쓸 수 있다 — 서버에서 다시 조회한다 */}
                    <button type="button" className={home.primary} onClick={() => router.refresh()} data-testid="home-map-retry">다시 열기</button>
                    <Link className={home.secondary} href="/csat/browse">기출 탐구</Link>
                  </div>
                </div>
              </div>
            ) : suggest === 'withheld' ? (
              <div className={home.card} role="status" data-testid="home-map-withheld">
                <p className={home.cardBack}>
                  <AlertTriangle size={13} aria-hidden="true" /> 지금은 지도의 관찰값을 보여 드릴 수 없어요
                </p>
                <div className={home.cardFront}>
                  <p className={`${home.cardLead} break-keep`}>풀이 기록을 모으는 기간인 회차가 기록에 있어 그동안 점수 · 정오에서 나온 관찰은 잠시 닫아 두었어요. 기록이 없다는 뜻이 아니에요. 기출 탐구는 그대로 쓸 수 있어요.</p>
                  <div className={home.cardActions}>
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
                  {returnTask ? (
                    <p className={`${home.cardLead} break-keep`} data-testid="home-return-task" data-found={taskFound === null ? 'pending' : String(taskFound)}>
                      {taskFound === false ? '시작했던 과제를 지금 지도에서 찾지 못했어요. 지도의 다음 할 일에서 이어 가세요.' : '시작했던 과제를 지도에 표시해 두었어요.'}
                    </p>
                  ) : null}
                  <div className={home.cardActions}>
                    <Link className={home.secondary} href={`/csat/item/${returned.slug}?from=map`} data-testid="home-return-item">
                      {returned.label} 다시 보기
                    </Link>
                    <a className={home.primary} href="#ins-h">
                      지도의 다음 할 일 <ArrowRight size={14} aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>
            ) : suggest === 'resume' && !set && !(due ?? 0) && itemResume ? (
              <div className={home.card} data-testid="home-resume-item">
                <p className={home.cardBack}>
                  <CornerUpLeft size={13} aria-hidden="true" /> {itemAgain ? '다시 볼 때가 된 문항' : '하다 만 문항'}
                </p>
                <div className={home.cardFront}>
                  <p className={`${home.cardLead} break-keep`}>
                    <b>{itemResume.item.replace('#', ' · ')}번</b>
                    {itemAgain ? ' — 다시 볼 때예요.' : ' — 이어서 볼 수 있어요.'}
                  </p>
                  <div className={home.cardActions}>
                    <Link
                      className={home.primary}
                      href={`/csat/item/${toItemSlug(itemResume.item)}`}
                      onClick={() => track({ name: 'csat_resume_clicked', props: { kind: itemAgain ? 'review' : 'set', from: 'home' } })}
                      data-testid="home-resume-item-go"
                    >
                      이어서 보기 <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                    <Link className={home.secondary} href="/csat?view=continue">이어서 · 복습 전체</Link>
                  </div>
                </div>
              </div>
            ) : suggest === 'resume' ? (
              <ContinueCard state={rec} />
            ) : suggest === 'continue_check' && progress?.check ? (
              // T-0080 — 학습 TASK 는 map_task(지도 TASK 선택)로 보낸다. task 는 과거 활동 키 칸이라 지도가 TASK 로 쓰지 않아 옛 선택이 남았다
              <div className={home.card} data-testid="home-continue-check" data-target-task={progress.check.task}>
                <p className={home.cardBack}>
                  <ClipboardCheck size={13} aria-hidden="true" /> 확인하던 항목
                </p>
                <div className={home.cardFront}>
                  <p className={`${home.cardLead} break-keep`}>
                    <b>{progress.check.name}</b> 확인 문항을 풀기 시작했어요. 아직 확인 결과가 나오지 않았어요.
                  </p>
                  <div className={home.cardActions}>
                    <Link className={home.primary} href={`/csat?${mapReturnQuery({ mapTask: progress.check.task, ws: progress.check.ws }).slice(1)}`} onClick={() => track({ name: 'csat_resume_clicked', props: { kind: 'map_check', from: 'home' } })} data-testid="home-continue-check-go">
                      지도에서 이어서 확인 <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            ) : suggest === 'continue_plan' && progress?.plan ? (
              <div className={home.card} data-testid="home-continue-plan" data-target-ws={progress.plan.ws}>
                <p className={home.cardBack}>
                  <ListChecks size={13} aria-hidden="true" /> 저장한 학습계획
                </p>
                <div className={home.cardFront}>
                  <p className={`${home.cardLead} break-keep`}>
                    {/* T-0081 — 묶음 집계(기존 · 배정 없으면 말하지 않음)와 이어갈 TASK 의 양을 따로 */}
                    <b>{progress.plan.name}</b> 계획{progress.plan.planned !== null && progress.plan.done !== null ? `에서 ${progress.plan.planned}개 중 ${progress.plan.done}개를 했어요` : '을 이어서 할 수 있어요'}.{' '}
                    <span data-testid="home-continue-plan-resume" data-task={progress.plan.task}>이어갈 항목: {progress.plan.resume.name} {progress.plan.resume.planned}{progress.plan.resume.unit} 중 {progress.plan.resume.done}{progress.plan.resume.unit}</span>
                  </p>
                  <div className={home.cardActions}>
                    <Link className={home.primary} href={`/csat?${mapReturnQuery({ mapTask: progress.plan.task, ws: progress.plan.ws }).slice(1)}`} onClick={() => track({ name: 'csat_resume_clicked', props: { kind: 'map_plan', from: 'home' } })} data-testid="home-continue-plan-go">
                      계획 이어서 보기 <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            ) : suggest === 'preparing' ? (
              <p className={`${l.lead} break-keep`} data-testid="home-preparing">학습 지도는 아직 준비 중이에요. 그동안 기출 탐구에서 문항을 살펴볼 수 있어요.</p>
            ) : (
              <p className={`${l.lead} break-keep`} data-testid="home-map-lead">
                {suggest === 'goal'
                  ? '먼저 목표 점수를 정하면 지도가 지금 근거로 먼저 확인할 것을 골라요.'
                  : suggest === 'check'
                  ? '지도가 지금 근거로 먼저 확인할 것 하나를 골라 두었어요.'
                  : suggest === 'no_records'
                    // T-0079 — 기록 0 = 미측정 · 시작 전(약점 아님). 시험 기록은 필수 조건이 아니다 — 지도에서 계획 → 자료 → 직접 확인으로 시작할 수 있다
                    ? '아직 미측정이에요. 지도에서 첫 확인을 시작해요.'
                    : '지도에서 지금 근거와 다음 단계(자료 · 대기 이유 포함)를 확인하세요.'}{' '}
                <a href="#umap-h" className={l.inlineLink}>지도에서 보기</a>
                {suggest === 'no_records' && <span className={l.startFlow} role="list" aria-label="첫 학습 순서"><span role="listitem"><ListChecks size={18} aria-hidden="true" />계획 선택</span><ArrowRight size={15} aria-hidden="true" /><span role="listitem"><Library size={18} aria-hidden="true" />자료 받기</span><ArrowRight size={15} aria-hidden="true" /><span role="listitem"><ClipboardCheck size={18} aria-hidden="true" />직접 확인</span></span>}
              </p>
            )}
          </section>

          {/* ② 핵심 학습 지도 */}
          <section className={l.map} aria-label="학습 지도" data-testid="home-map" data-map={map}>
            {(map === 'ok' || map === 'withheld') && mapData ? (
              <MapScreen key={`${restore?.ws ?? ""}|${restore?.step ?? ""}|${restore?.task ?? ""}`} data={mapData} view="core" base={MAP_BASE} restore={restore} />
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
              <p className={`${l.lead} break-keep`}><Search size={15} aria-hidden="true" />목적 · 유형 · 회차로 찾기</p>
            </div>
            <span className={l.exploreActions}>
              <Link className={home.secondary} href="/csat/dissect" onClick={() => track({ name: 'csat_resume_clicked', props: { kind: 'start', from: 'home' } })} data-testid="home-start">
                처음이라면 3문항으로 시작
              </Link>
              <button
                type="button"
                className={finder.trigger}
                onClick={() => {
                  track({ name: 'csat_path_chosen', props: { axis: 'finder', need: 'none', origin: 'home', action: 'open' } })
                  setFinderOpen(true)
                }}
                aria-haspopup="dialog"
                data-testid="home-finder-open"
              >
                <span className={finder.triggerFace}>
                  <Search size={14} aria-hidden="true" />
                  기출 찾기
                </span>
              </button>
              <Link className={`${home.primary} ${l.primary}`} href="/csat/browse" data-testid="home-explore-go">
                기출 탐구로 <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </span>
          </section>
        </div>
      </div>
      {finderOpen ? (
        <ItemFinderDialog
          origin="home"
          initial={EMPTY_SELECTION}
          // 지도 홈에서 고른 문항 — 「학습 지도로」 로 돌아오게 from=map 만 싣는다(과제 · 확인 수행이 아니다)
          hrefFor={(id) => finderItemHref(id, { fromMap: true })}
          onClose={() => setFinderOpen(false)}
        />
      ) : null}
    </div>
  )
}

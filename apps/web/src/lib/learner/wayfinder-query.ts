// apps/web/src/lib/learner/wayfinder-query.ts
//
// 나침반 띠의 **서버 조회부**. 순수 계산은 `wayfinder.ts` 가 갖는다(그 파일 머리 주석).
//
// 비용 원칙 — 이 조회는 **모든 학습자 라우트**에서 돈다(layout). 그래서 새 왕복을
// 하나도 만들지 않는 것을 설계 목표로 잡았고, 실제로 만들지 않았다:
//
//   · 처방(prescribe_today)          → `fetchTodayPrescription` 재사용 (cache)
//   · 기억 분포 · 28일 · 예보          → `fetchGrowthStats` 재사용 (cache).
//                                       예보는 그 함수가 **이미 읽고 버리던** vocabularies 행을
//                                       7번 더 접은 것이다 — 쿼리 0
//   · 오늘 손댄 모듈 · DCP             → `fetchTouchedModulesToday` · `fetchDcpDoneToday` 재사용
//   · V-Level                        → 처방이 이미 읽던 `user_profiles.current_v_level`.
//                                       버리던 값을 실어 보내게 고쳤다 — 쿼리 0
//   · 사정권(발행 도서 분포)            → 사용자 무관 전역값. 프로세스 TTL 캐시 10분
//                                       (`library-reach.ts`) — 대부분의 요청에서 쿼리 0
//
// 즉 이전 `fetchTodayStatus` 와 **같은 왕복 수**로 여섯 질문을 전부 답한다.

import 'server-only'

import { cache } from 'react'

import { fetchGrowthStats } from '@/lib/learner/growth-stats'
import { fetchLevelReach, type LevelReach } from '@/lib/learner/library-reach'
import { forecastMemory, type MemoryForecast } from '@/lib/learner/memory-forecast'
import { fetchTodayPrescription } from '@/lib/learner/prescription-actions'
import { buildTodayBlocks } from '@/lib/learner/today-blocks'
import {
  fetchDcpDoneToday,
  fetchTouchedModulesToday,
} from '@/lib/learner/today-status-query'
import type { WayfinderBlock, WayfinderPast } from '@/lib/learner/wayfinder'

/**
 * 클라이언트로 넘어가는 **직렬화 가능한** 셸 데이터.
 *
 * `pathname` 은 여기 없다 — 위치는 클라이언트만 알고, 그것 하나 때문에 서버 조회를
 * 라우트마다 다르게 만들 이유가 없다. 모델 조립은 `buildWayfinder` 가 브라우저에서 한다.
 */
export interface WayfinderData {
  blocks: WayfinderBlock[]
  isDiagnosed: boolean
  /** 처방 계산 실패 — 화면이 "오늘 할 게 없다" 와 구별할 수 있게 실어 보낸다 */
  unavailable: boolean
  reach: LevelReach
  forecast: MemoryForecast
  past: WayfinderPast
  counts: { attention: number; fresh: number }
}

/** 아무 데이터도 못 읽었을 때의 예보 — 지어내지 않고 빈 곡선을 준다. */
const EMPTY_FORECAST: MemoryForecast = forecastMemory([], new Date(0), 7)

export const fetchWayfinder = cache(async (): Promise<WayfinderData | null> => {
  const [prescription, growth, touched, dcpDone] = await Promise.all([
    fetchTodayPrescription(),
    fetchGrowthStats(),
    fetchTouchedModulesToday(),
    fetchDcpDoneToday(),
  ])

  // 비로그인 — 셸 띠를 그리지 않는다(기존 판정과 같다).
  if (!prescription && !growth) return null

  const isDiagnosed = prescription?.isDiagnosed === true
  const unavailable = prescription?.unavailable === true

  // 처방을 못 냈으면 계단을 그리지 않는다. 폴백 5블록을 "오늘 할 일" 로 그리면
  // 실패가 정상처럼 보인다(prescription-actions 의 unavailable 주석과 같은 판단).
  const blocks: WayfinderBlock[] =
    prescription && isDiagnosed && !unavailable
      ? buildTodayBlocks(prescription, touched, dcpDone).map((b) => ({
          key: b.key,
          name: b.name,
          headline: b.headline,
          href: b.href,
          done: b.done,
          locked: b.locked,
        }))
      : []

  const reach = await fetchLevelReach(prescription?.vLevel ?? null)

  // 최근 7일 / 그 앞 7일 — `days28` 은 이미 손에 있다(추가 쿼리 0).
  const days = growth?.days28 ?? []
  const active = (slice: typeof days) => slice.filter((d) => d.minutes > 0 || d.words > 0).length

  return {
    blocks,
    isDiagnosed,
    unavailable,
    reach,
    forecast: growth?.forecast ?? EMPTY_FORECAST,
    past: {
      activeDays: active(days.slice(-7)),
      prevActiveDays: active(days.slice(-14, -7)),
      streak: growth?.streak ?? 0,
    },
    counts: {
      // 이전 띠의 "다시 볼" 과 같은 정의 — risk + shaky. 뜻이 바뀌면 학습자가 세던 수가 바뀐다.
      attention: (growth?.memory.risk ?? 0) + (growth?.memory.shaky ?? 0),
      fresh: growth?.memory.fresh ?? 0,
    },
  }
})

// apps/web/src/lib/game/arcade-meta.ts
// 아케이드 리텐션 메타 — 데일리 플레이 스트릭 + XP + 데일리 목표. 클라이언트 localStorage.
// DB 무변경(Phase 3에서 서버 동기화 가능). 게임 완료 훅(useRecordGameScore)이 awardArcadeXp 호출,
// 아케이드 허브가 getArcadeMeta 로 표시. 재방문(스트릭)·성장(XP·레벨)·오늘의 목표로 중독성 강화.

'use client'

const KEY = 'vocaflow-arcade-meta'
export const DAILY_GOAL_XP = 30

export interface ArcadeMeta {
  xp: number // 누적 XP
  level: number // xp 파생
  streak: number // 연속 플레이 일수
  todayXp: number // 오늘 획득 XP
  day: string // 마지막 갱신일 (YYYY-MM-DD, 로컬)
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}
// 완만한 성장 곡선: Lv1=0xp, Lv2=40, Lv3=160, Lv4=360…
export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 40)) + 1
}
export function xpForLevel(level: number): number {
  return (level - 1) * (level - 1) * 40
}

function read(): ArcadeMeta {
  const base: ArcadeMeta = { xp: 0, level: 1, streak: 0, todayXp: 0, day: today() }
  if (typeof window === 'undefined') return base
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const m = JSON.parse(raw) as Partial<ArcadeMeta>
    return { ...base, ...m }
  } catch {
    return base
  }
}
function write(m: ArcadeMeta): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m))
  } catch {
    /* private mode */
  }
}

// 표시용 — 날짜 롤오버 반영(오늘 미플레이면 todayXp 0, 스트릭은 어제까지면 유지·그 이전이면 끊김).
export function getArcadeMeta(): ArcadeMeta {
  const m = read()
  const gap = daysBetween(m.day, today())
  if (gap <= 0) return { ...m, level: levelForXp(m.xp) }
  return { ...m, todayXp: 0, streak: gap === 1 ? m.streak : 0, level: levelForXp(m.xp) }
}

// 게임 완료 시 1회 호출 — XP 지급 + 스트릭 갱신. 반환: 갱신된 메타.
export function awardArcadeXp(accuracy = 0): ArcadeMeta {
  const prev = read()
  const gap = daysBetween(prev.day, today())
  const gain = 10 + Math.round(Math.max(0, Math.min(100, accuracy)) / 10) // 10~20
  let streak: number
  let todayXp: number
  if (gap <= 0) {
    todayXp = prev.todayXp + gain
    streak = prev.streak === 0 ? 1 : prev.streak
  } else if (gap === 1) {
    streak = prev.streak + 1
    todayXp = gain
  } else {
    streak = 1
    todayXp = gain
  }
  const xp = prev.xp + gain
  const next: ArcadeMeta = { xp, level: levelForXp(xp), streak, todayXp, day: today() }
  write(next)
  return next
}

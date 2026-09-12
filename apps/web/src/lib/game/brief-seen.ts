// apps/web/src/lib/game/brief-seen.ts
//
// "이 게임의 브리핑을 이미 봤는가" — 첫 플레이에만 자동으로 열기 위한 기록.
//
// 왜 필요한가:
//   브리핑(보드 그림 + Trial Run)은 19종 전부에 있는데, 지금까지 **누를 자리가 허브 카드
//   하나뿐**이었다. 그래서 자료 화면·코스 칩·주소 직접 입력·`?from=` 복귀처럼 허브를 거치지
//   않는 경로로 들어온 학습자는 규칙을 한 번도 보지 못한 채 게임 안에 떨어졌다.
//   게임마다 판돈 구조가 다른 것이 이 아케이드의 존재 이유이므로, 그 상태에서 첫 판은
//   대부분 "무슨 일이 일어나는지 보는 판"으로 소모된다.
//
// 왜 서버가 아니라 localStorage 인가:
//   이것은 학습 기록이 아니라 **UI 상태**다. 기기마다 다르게 기억되는 편이 오히려 맞고
//   (새 기기 = 다시 한 번 보여 주는 편이 안전), 로그인 없이 노는 경로(/arcade 는 공개)에서도
//   작동해야 한다. arcade-meta.ts 가 같은 이유로 localStorage 를 쓴다.
//
// 실패는 조용히 흡수한다 — 프라이빗 모드·저장 차단에서 던지면 게임이 통째로 못 열린다.
// 그 경우 "못 봤다"로 취급되어 브리핑이 매번 열린다(성가시지만 안전한 쪽).

import type { GameSlug } from '@/lib/game/catalog'

const KEY = 'vocaflow-brief-seen'

function readAll(): Record<string, true> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, true>
  } catch {
    return {}
  }
}

/**
 * 이 게임의 브리핑을 이미 통과했는가.
 *
 * ⚠️ 서버에서는 항상 false 다. 호출부는 **effect 안에서만** 물어야 한다 —
 * 렌더 중에 쓰면 서버(false)와 클라이언트(true)가 갈려 hydration 이 깨진다.
 */
export function isBriefSeen(slug: GameSlug): boolean {
  return readAll()[slug] === true
}

/** 브리핑을 닫은 순간 기록한다(끝까지 읽었든 '나중에'든 — 한 번 봤으면 본 것이다). */
export function markBriefSeen(slug: GameSlug): void {
  if (typeof window === 'undefined') return
  try {
    const all = readAll()
    if (all[slug]) return
    all[slug] = true
    window.localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* private mode — 다음에 또 보여 준다 */
  }
}

/** 전부 잊는다 — 설정/개발 도구에서 "튜토리얼 다시 보기". */
export function resetBriefSeen(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}

/** 지금까지 본 게임 수 — 이해도 지표(본 게임 / 플레이한 게임)의 분자. */
export function seenCount(): number {
  return Object.keys(readAll()).length
}

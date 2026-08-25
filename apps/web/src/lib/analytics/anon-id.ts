// apps/web/src/lib/analytics/anon-id.ts
//
// 익명 구간과 로그인 구간을 잇는 **하나의 고리.**
//
// ── 왜 필요한가 (실측 2026-08-26) ───────────────────────────────────
// 교사 여정은 두 저장소로 쪼개져 있다:
//   `/fit` 익명 체험 → PostHog        (외부·비로그인)
//   가입 → 학급 개설 → 과제 → funnel_events (자체 DB·로그인)
// 그래서 **"`/fit` 을 써 본 사람이 실제로 학급을 만들었는가"** 를 물을 수 없다.
// 그 질문이 곧 진단 §6 의 교사 채널(CAC 0) 성립 여부인데, 지금은 분자도 분모도 못 센다.
//
// 고리는 `anon_id` 하나다. 익명일 때 찍어 두고, 가입 뒤에도 같은 값을 함께 남기면
// `funnel_events` 안에서 `anon_id` 로 앞뒤가 이어진다(같은 행에 user_id 와 anon_id 가 함께 남는다).
//
// ── 최소 수집 ───────────────────────────────────────────────────────
// 무작위 UUID 하나뿐이다. 사람을 식별하지 않고 기기를 잇기만 한다.
// 지우면 그 고리가 끊길 뿐 다른 영향이 없다 — 그게 맞는 성질이다.
//
// ── 실패해도 화면을 깨뜨리지 않는다 ─────────────────────────────────
// 사파리 프라이빗 모드·저장소 차단에서 `localStorage` 접근 자체가 던진다.
// 그때는 조용히 `null` 을 돌려주고, 호출부는 anon_id 없이 계속 간다.

const STORAGE_KEY = 'vocaflow.anon_id'

function randomId(): string {
  // crypto.randomUUID 는 https/localhost 에서만 있다. 없으면 충분히 흩어지는 값으로 대체.
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    /* 아래 대체 경로로 */
  }
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * 이 브라우저의 익명 식별자. 없으면 만들어 저장한다.
 *
 * 서버에서 부르면 `null` — 이 값은 브라우저에만 있다.
 * 저장소가 막혀 있어도 `null` 이며, 그 경우 앞뒤를 잇지 못할 뿐 기능은 그대로다.
 */
export function getAnonId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing && existing.length >= 8) return existing
    const fresh = randomId()
    window.localStorage.setItem(STORAGE_KEY, fresh)
    return fresh
  } catch {
    // 프라이빗 모드·저장소 차단 — 고리는 못 만들지만 화면은 살아 있어야 한다.
    return null
  }
}

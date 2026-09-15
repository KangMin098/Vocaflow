// apps/web/src/lib/auth/profile-cache.ts
//
// **미들웨어가 요청마다 프로필을 다시 읽던 것을 합친다.**
//
// ── 왜 (2026-09-06 장애 실측) ───────────────────────────────────────
// DB 가 08:05~19:30 UTC 응답을 멈췄다. 원인은 쓰기 폭주가 아니라 **읽기 포화**였고,
// 36분 창의 단일 최대 기여자가 미들웨어였다(발견 #43):
//
//     Next.js Middleware  /auth/v1/user        3,498
//     Next.js Middleware  /rest/v1/user_profiles 3,482
//
// 요청 하나에 **인증 1회 + 프로필 1회**. 앞의 것은 못 줄인다 — `getUser()` 는 JWT 를
// 인증 서버에 검증시키는 **보안 경계**라 쿠키의 주장만 믿고 건너뛸 수 없다.
// 줄일 수 있는 것은 뒤의 것이고, 그 값(역할·상태)은 **요청마다 바뀌지 않는다.**
//
// ── 두 겹으로 줄인다 ────────────────────────────────────────────────
// ① **동시 합치기(in-flight)** — 같은 사용자의 겹치는 요청은 조회 하나를 나눠 쓴다.
//    문서 요청 하나가 RSC 프리페치 여럿을 동시에 부르는 이 앱에서 이게 크다.
//    **낡음이 0 이다** — 시간상 겹친 것만 합치므로 어떤 값도 더 오래 살지 않는다.
// ② **짧은 TTL** — 그 위에 §TTL 만큼만 다시 쓴다.
//
// ── TTL 이 무엇을 늦추는가 (숨기지 않는다) ──────────────────────────
// 이 값은 **정지·해지가 학습자 화면에서 효력을 갖기까지의 상한**이다. 30초로 잡았다.
//
//   · `/admin` 은 약해지지 않는다 — RSC 가드(`requireAdmin`)가 **매 렌더 새로** 읽는다.
//     미들웨어의 판정은 그 앞의 빠른 거름망일 뿐이다.
//   · 학습자 화면은 정지가 최대 30초 늦게 걸린다. 정지는 초 단위로 다투는 조치가 아니고,
//     이 게이트가 생기기 전에는 **아예 안 걸렸다**(v06.140 주석).
//   · 그 대가로 프로필 조회가 사용자당 **분당 2회 상한**이 된다.
//     실측 부하(분당 약 97회)를 그대로 대입하면 98% 가 줄어든다.
//
// ⚠️ **실패한 조회는 캐시하지 않는다.** 캐시했다면 한 번의 순간적 오류가 TTL 동안
//   그 사용자를 잘못된 판정에 묶는다(관리자를 비관리자로, 또는 그 반대로).
// ⚠️ **사용자별로 가른다.** 열쇠는 언제나 user id 다 — 섞이면 남의 권한을 쓰게 된다.

/** 미들웨어가 판정에 쓰는 값. 이 둘 말고는 읽지 않는다. */
export interface AccountProfile {
  role: string | null
  status: string | null
}

/**
 * 조회 결과.
 *
 * `ok: false` 는 **행이 없다**가 아니라 **읽지 못했다**는 뜻이다. 둘을 뭉개면
 * 조회 실패가 "프로필 없음" 으로 캐시돼 조용히 굳는다.
 */
export type ProfileRead = { ok: true; profile: AccountProfile | null } | { ok: false }

/**
 * 캐시가 값을 다시 쓰는 시간(ms).
 *
 * 위 §TTL 의 상한이 곧 이 값이다. 바꿀 때는 그 문단의 근거도 함께 고칠 것.
 */
export const PROFILE_CACHE_TTL_MS = 30_000

/**
 * 담아 두는 사용자 수 상한.
 *
 * 미들웨어는 오래 사는 isolate 에서 돌 수 있어 상한이 없으면 계속 자란다.
 * 넘치면 **가장 오래된 것부터** 버린다(Map 은 삽입 순서를 지킨다).
 */
export const PROFILE_CACHE_MAX_ENTRIES = 500

interface Entry {
  at: number
  profile: AccountProfile | null
}

const fresh = new Map<string, Entry>()
const inFlight = new Map<string, Promise<ProfileRead>>()

/** 지금 시각. 테스트가 갈아 끼울 수 있게 한 자리에 모은다. */
let now = (): number => Date.now()

function remember(userId: string, profile: AccountProfile | null): void {
  // 다시 넣기 전에 지운다 — Map 은 기존 열쇠를 덮어써도 **삽입 순서를 유지**하므로,
  // 지우지 않으면 자주 쓰는 사용자가 오래된 것으로 남아 먼저 버려진다.
  fresh.delete(userId)
  fresh.set(userId, { at: now(), profile })
  while (fresh.size > PROFILE_CACHE_MAX_ENTRIES) {
    const oldest = fresh.keys().next()
    if (oldest.done) break
    fresh.delete(oldest.value)
  }
}

/**
 * 그 사용자의 역할·상태를 얻는다 — 겹치는 요청은 합치고, TTL 안이면 다시 쓴다.
 *
 * @param userId  인증된 사용자 id. **여기서 신원을 판정하지 않는다** —
 *                이미 `getUser()` 로 검증된 값을 받는다.
 * @param read    실제 조회. 실패를 `{ ok: false }` 로 알려야 캐시가 그것을 굳히지 않는다.
 */
export async function loadAccountProfile(
  userId: string,
  read: () => Promise<ProfileRead>,
): Promise<ProfileRead> {
  const hit = fresh.get(userId)
  if (hit && now() - hit.at < PROFILE_CACHE_TTL_MS) {
    return { ok: true, profile: hit.profile }
  }

  const pending = inFlight.get(userId)
  if (pending) return pending

  const task = (async (): Promise<ProfileRead> => {
    try {
      const result = await read()
      // 실패는 담지 않는다 — 순간적 오류가 TTL 동안 굳으면 안 된다.
      if (result.ok) remember(userId, result.profile)
      return result
    } catch {
      // 던지는 조회도 실패로 본다. 미들웨어를 여기서 죽이지 않는다.
      return { ok: false }
    } finally {
      inFlight.delete(userId)
    }
  })()

  inFlight.set(userId, task)
  return task
}

/**
 * 그 사용자의 값을 즉시 버린다.
 *
 * 정지·역할 변경처럼 **판정이 바뀐 것을 아는 자리**에서 부른다. 다만 이것만 믿으면 안 된다 —
 * 다른 isolate 의 값은 못 지우므로 실제 상한은 여전히 TTL 이다.
 */
export function invalidateAccountProfile(userId: string): void {
  fresh.delete(userId)
}

/** 테스트 전용 — 캐시를 비우고 시계를 갈아 끼운다. */
export function __resetProfileCacheForTest(clock?: () => number): void {
  fresh.clear()
  inFlight.clear()
  now = clock ?? (() => Date.now())
}

/** 테스트·계측 전용 — 지금 담고 있는 사용자 수. */
export function __profileCacheSize(): number {
  return fresh.size
}

// apps/web/src/lib/library/story/return-context.ts
//
// LCP-D5-I02 — Story 에서 **명시적으로** 다른 화면(지금은 WordVault Browse)으로 갈 때 붙이는 임시 복귀 문맥.
// 계약: docs/lcp-story/LCP_D5_INTEGRATION.md §4.2 · §5.1~4 · §5.8.
// - 주소에는 구조화된 두 값만: `story_release=<lsr_ + 32 hex>` · `story_unit=<0-based 정준 10진>`. 사용자 id · 토큰 · 본문 · 뜻 · 진도 ·
//   임의 return_url 을 싣지 않는다. 이 값은 권한 · 개인 기록 조회 키가 아니다(돌아가면 Story 서버가 로그인 · 발행 · 권리를 다시 확인한다).
// - 낱말 행에 영구 Story 출처를 남기는 기능이 아니다 — 명시 이동에 붙는 문맥일 뿐, 단어장에 바로 들어오면 출처를 지어내지 않는다.
// - 지도 복귀(lib/csat/map-return)와 섞이면 어느 쪽도 고르지 않고 중립(conflict)으로 돌려준다 — 지도 의미를 덮지 않는다.
// 순수 함수 — 네트워크 · 시계 없음.

// learner.ts(server-only)와 같은 형식 — 이 모듈은 클라이언트에서도 쓰므로 값을 옮겨 적는다(시험이 두 값이 같은지 확인한다).
export const RETURN_RELEASE_KEY_RE = /^lsr_[0-9a-f]{32}$/
export const RETURN_MAX_UNIT_INDEX = 9999

export const STORY_RETURN_RELEASE_PARAM = 'story_release'
export const STORY_RETURN_UNIT_PARAM = 'story_unit'

const UNIT_RE = /^(0|[1-9][0-9]{0,3})$/

export interface StoryReturnContext {
  releaseKey: string
  /** 0-based(화면의 「3번째 단위」 = 2). */
  unitIndex: number
}

/** 지도 복귀는 `from=map` 으로 시작한다(lib/csat/map-return.ts vocabMapReturnHref). `from` 이 함께 오면 Story 문맥과 섞인 것이다. */
const MAP_RETURN_MARKER = 'from'

type Params = Record<string, string | string[] | undefined>

/**
 * 받은 검색 매개변수 → 상태:
 *  - none: Story 문맥 매개변수가 하나도 없다(일반 진입 — 출처를 지어내지 않는다)
 *  - ok: 두 값이 모두 하나씩 · 엄격한 형식
 *  - invalid: 하나만 · 여러 값 · 형식 오류 · 범위 초과
 *  - conflict: 형식은 맞지만 지도 복귀 매개변수가 함께 왔다(어느 쪽도 적용하지 않는다)
 */
export function parseStoryReturnParams(
  params: Params,
  opts: { mapReturnPresent?: boolean } = {},
): { status: 'none' } | { status: 'invalid' } | { status: 'conflict' } | { status: 'ok'; context: StoryReturnContext } {
  const rel = params[STORY_RETURN_RELEASE_PARAM]
  const unit = params[STORY_RETURN_UNIT_PARAM]
  if (rel === undefined && unit === undefined) return { status: 'none' }
  if (typeof rel !== 'string' || typeof unit !== 'string') return { status: 'invalid' }
  if (!RETURN_RELEASE_KEY_RE.test(rel) || !UNIT_RE.test(unit)) return { status: 'invalid' }
  const unitIndex = Number(unit)
  if (!Number.isSafeInteger(unitIndex) || unitIndex < 0 || unitIndex > RETURN_MAX_UNIT_INDEX) return { status: 'invalid' }
  const mapPresent = opts.mapReturnPresent ?? params[MAP_RETURN_MARKER] !== undefined
  if (mapPresent) return { status: 'conflict' }
  return { status: 'ok', context: { releaseKey: rel, unitIndex } }
}

/** Story → 일반 단어장(명시 이동). 단어장은 본인 전체 목록이며 Story 전용 목록이 아니다. */
export function storyVaultHref(ctx: StoryReturnContext): string {
  const q = new URLSearchParams({ [STORY_RETURN_RELEASE_PARAM]: ctx.releaseKey, [STORY_RETURN_UNIT_PARAM]: String(ctx.unitIndex) })
  return `/wordvault/browse?${q.toString()}`
}

/** 단어장 → 같은 발행본 · 단위(돌아가면 서버가 다시 확인 — 단위 첫머리이지 문장 · 스크롤 위치가 아니다). */
export function storyReturnHref(ctx: StoryReturnContext): string {
  return `/library/stories/${encodeURIComponent(ctx.releaseKey)}?unit=${ctx.unitIndex}`
}

/** 로그인 복귀용 단어장 주소 — 검증된 Story 문맥만 다시 싣는다(그 밖의 매개변수는 기존처럼 싣지 않는다). */
export function vaultPathWithStoryContext(ctx: StoryReturnContext | null): string {
  return ctx ? storyVaultHref(ctx) : '/wordvault/browse'
}

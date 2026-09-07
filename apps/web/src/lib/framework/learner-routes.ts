// apps/web/src/lib/framework/learner-routes.ts
//
// **학습자 화면 매니페스트** — 셸(사이트맵)과 계측이 함께 쓰는 단일 출처.
//
// ── 왜 이 파일이 생겼나 (실측 2026-09-05) ─────────────────────────────
// 두 결함이 같은 뿌리에서 나왔다.
//
//   ① `/sitemap` 은 「Vocaflow 의 모든 화면입니다」 라고 쓰면서 `sidebar-config` 를
//      그대로 파생했다. 사이드바가 파는 것은 18 라우트뿐이라, WCAG 2.2 §2.4.5
//      (Multiple Ways) 를 해결하려고 만든 화면이 **원래 길이 있던 화면에만 두 번째
//      길을 냈다.** 나머지 59 는 그대로 길이 하나였다.
//   ② 학습자 화면 79개 중 **진입 이벤트를 가진 화면이 0개**였다. 화면마다 손으로
//      심으면 반드시 빠지므로 셸 한 곳에서 경로 변경을 듣는데, 그러려면 경로를
//      **닫힌 집합**으로 정규화할 목록이 필요하다(`lib/analytics/events.ts` 의 계약 —
//      속성은 숫자·불리언·닫힌 열거형만. 자유 문자열은 지문이 샐 수 있다).
//
// ── 왜 파일 시스템에서 읽지 않는가 ────────────────────────────────────
// `tests/e2e/utils/learner-routes.ts` 와 `wayfinding.test.ts` 는 `fs` 로 읽는다.
// 그쪽은 Node 에서만 돌지만 이 목록은 **브라우저 번들**에 들어가야 한다
// (계측은 클라이언트에서 경로를 정규화한다). 그래서 목록은 여기 선언으로 둔다.
//
// ⚠️ **손 목록은 낡는다.** 그래서 `__tests__/learner-routes.test.ts` 가 `app/(main)`·
//    `app/(app)` 을 실제로 훑어 이 표와 대조한다 — 라우트를 만들고 여기 안 적으면
//    **테스트가 막는다.** `registry.ts` 의 활동 라우트도 같은 테스트가 대조한다.
//    (같은 방어를 `events.ts` 의 `EVENT_REGISTRY` 가 이미 쓰고 있고, 2026-08-30 에
//     실제로 빠진 이벤트 하나를 그 방식이 잡았다.)

/** 라우트가 사는 그룹. `(app)` 은 풀스크린 게임 전용이다. */
export type RouteGroup = 'main' | 'app'

/**
 * 화면의 성격 — **사이트맵에 링크로 걸어도 되는가**를 이것이 정한다.
 *
 * · `screen`   — 평범한 화면. 링크로 건다.
 * · `session`  — 열면 학습이 시작되거나 셸이 걷힌다. 링크로 걸되 그렇다고 말한다.
 * · `redirect` — `redirect(): never` 한 줄. 목적지가 목록에 따로 있으므로 걸지 않는다.
 * · `lab`      — 학습자 동선이 아니다(설계 실험). 셸·사이트맵 **양쪽에서 뺀다.**
 * · `role`     — 교사 표면. 학습자 흐름이 아니라 역할 표면이라 따로 센다.
 */
export type RouteKind = 'screen' | 'session' | 'redirect' | 'lab' | 'role'

/** 사이트맵의 「그 밖의 화면」 안에서 묶는 이름. 셸이 파는 화면에는 없다. */
export type SitemapSection = '학습 관리' | '연습과 세션' | '게임' | '그 밖'

export interface LearnerRoute {
  /** URL 템플릿. 동적 세그먼트는 `[id]` 꼴 그대로 둔다. */
  path: string
  /**
   * 계측 화면 id — **닫힌 열거형**.
   *
   * ⚠️ 24자 이내 · 공백 없음이어야 한다. `isSafeProps` 가 그 두 조건으로
   *    "지문 조각이 아니다" 를 판정하기 때문이다(`lib/analytics/events.ts`).
   *    테스트가 길이를 강제한다.
   */
  screen: string
  /** 화면 이름 — 셸이 이미 파는 화면은 셸 라벨을 따른다. */
  label: string
  /** 라벨이 말하지 않는 것 한 줄. 사이트맵에서만 쓴다. */
  says?: string
  group: RouteGroup
  kind: RouteKind
  /** 동적 세그먼트가 있는가 — 있으면 링크로 걸 수 없다(어떤 id 를 넣을지 모른다). */
  dynamic?: true
  /** 「그 밖의 화면」 안에서의 묶음. 셸이 파는 화면에는 비어 있다. */
  section?: SitemapSection
}

/** 아케이드 19종 — 이름은 `game/catalog` 가 갖고, 여기는 **경로만** 센다. */
const ARCADE_SLUGS = [
  'cascade',
  'connections',
  'daily-blitz',
  'ghost-race',
  'glyph-tongue',
  'letter-forge',
  'lexicon-detective',
  'lexicon-estate',
  'lexicon-hands',
  'morpheme-rules',
  'morphmerge',
  'pirate-quest',
  'silent-rule',
  'word-customs',
  'word-economy',
  'word-orrery',
  'wordblitz',
  'wordfall-cadence',
  'wordsmith-vigil',
] as const

/**
 * 아케이드 라우트를 **파생**한다 — 19줄을 손으로 적으면 그게 또 하나의 복제다
 * (`registry.ts` 가 같은 이유로 카탈로그에서 파생한다). 이름은 `/arcade` 가 판다.
 */
const arcadeRoutes: LearnerRoute[] = ARCADE_SLUGS.map((slug) => ({
  path: `/play/${slug}`,
  screen: `play-${slug}`,
  label: slug,
  group: 'app' as const,
  kind: 'session' as const,
  section: '게임' as const,
}))

/**
 * 학습자 화면 전부.
 *
 * 정렬은 경로순이다 — 사람이 훑어 빠진 것을 찾을 수 있어야 한다.
 */
export const LEARNER_ROUTES: LearnerRoute[] = [
  { path: '/arcade', screen: 'arcade', label: 'Game Lab', group: 'main', kind: 'screen' },
  {
    path: '/arcade/ranking',
    screen: 'arcade-ranking',
    label: '게임 랭킹',
    says: '19종의 기록을 한자리에서.',
    group: 'main',
    kind: 'screen',
    section: '게임',
  },
  { path: '/comics', screen: 'comics', label: 'Comics', group: 'main', kind: 'redirect' },
  {
    path: '/comics/adapted',
    screen: 'comics-adapted',
    label: 'Book Comics',
    group: 'main',
    kind: 'screen',
  },
  {
    path: '/comics/adapted/[bookId]',
    screen: 'comics-adapted-book',
    label: '각색 만화 한 권',
    group: 'main',
    kind: 'screen',
    dynamic: true,
  },
  {
    path: '/comics/restored',
    screen: 'comics-restored',
    label: 'Vintage Comics',
    group: 'main',
    kind: 'screen',
  },
  {
    path: '/comics/restored/[slug]',
    screen: 'comics-restored-issue',
    label: '복원 만화 한 호',
    group: 'main',
    kind: 'screen',
    dynamic: true,
  },
  { path: '/csat', screen: 'csat', label: 'CSAT Types', group: 'main', kind: 'screen' },
  {
    path: '/csat/[typeId]',
    screen: 'csat-type',
    label: '기출 유형 하나',
    group: 'main',
    kind: 'screen',
    dynamic: true,
  },
  {
    path: '/csat/item/[slug]',
    screen: 'csat-item',
    label: '기출 문항 하나',
    group: 'main',
    kind: 'screen',
    dynamic: true,
  },
  {
    path: '/csat/plan',
    screen: 'csat-plan',
    label: '기출 학습 계획',
    says: '약한 유형부터 순서를 짠다.',
    group: 'main',
    kind: 'screen',
    section: '학습 관리',
  },
  { path: '/dashboard', screen: 'dashboard', label: 'Growth', group: 'main', kind: 'screen' },
  {
    path: '/diagnostic',
    screen: 'diagnostic',
    label: 'Level 진단',
    says: '내 V-Level 을 재는 곳. 최대 40문항이라 시간을 두고 시작한다.',
    group: 'main',
    kind: 'screen',
    section: '학습 관리',
  },
  {
    path: '/diagnostic/history',
    screen: 'diagnostic-history',
    label: '진단 기록',
    says: '지난 진단들이 어떻게 달라졌는지.',
    group: 'main',
    kind: 'screen',
    section: '학습 관리',
  },
  { path: '/dictate', screen: 'dictate', label: 'Dictation', group: 'main', kind: 'screen' },
  {
    path: '/dictate/results',
    screen: 'dictate-results',
    label: '받아쓰기 결과',
    says: '세션이 끝난 뒤에만 내용이 있다.',
    group: 'main',
    kind: 'screen',
    section: '연습과 세션',
  },
  {
    path: '/dictate/session',
    screen: 'dictate-session',
    label: '받아쓰기 진행',
    says: '열면 셸이 걷히고 세션이 시작된다.',
    group: 'main',
    kind: 'session',
    section: '연습과 세션',
  },
  {
    path: '/dictate/setup',
    screen: 'dictate-setup',
    label: '받아쓰기 준비',
    says: '자료 없이 열면 Dictation 으로 되돌린다.',
    group: 'main',
    kind: 'screen',
    section: '연습과 세션',
  },
  {
    path: '/flashcard',
    screen: 'flashcard',
    label: 'Flashcard',
    says: '뜻과 단어를 짝지어 떠올린다.',
    group: 'main',
    kind: 'screen',
    section: '연습과 세션',
  },
  {
    path: '/flashcard/play',
    screen: 'flashcard-play',
    label: 'Flashcard 세션',
    says: '열면 바로 시작한다.',
    group: 'main',
    kind: 'session',
    section: '연습과 세션',
  },
  { path: '/hub', screen: 'hub', label: 'Today', group: 'main', kind: 'screen' },
  {
    // 학습자 동선이 아니다 — 아래 `isLearnerDestination` 이 셸·사이트맵에서 뺀다.
    path: '/hub-lab',
    screen: 'hub-lab',
    label: '허브 실험실',
    group: 'main',
    kind: 'lab',
  },
  { path: '/library', screen: 'library', label: 'Library', group: 'main', kind: 'redirect' },
  {
    path: '/library/books',
    screen: 'library-books',
    label: 'Books',
    group: 'main',
    kind: 'screen',
  },
  {
    path: '/library/books/[bookId]',
    screen: 'library-book',
    label: '큐레이션 도서 한 권',
    group: 'main',
    kind: 'screen',
    dynamic: true,
  },
  {
    path: '/library/scripts',
    screen: 'library-scripts',
    label: 'Dispatches',
    group: 'main',
    kind: 'screen',
  },
  {
    path: '/library/scripts/[bookId]',
    screen: 'library-script',
    label: '짧은 글 한 편',
    group: 'main',
    kind: 'screen',
    dynamic: true,
  },
  {
    path: '/library/textbooks',
    screen: 'library-textbooks',
    label: 'Textbooks',
    group: 'main',
    kind: 'screen',
  },
  {
    path: '/library/textbooks/[step]',
    screen: 'library-step',
    label: '교재 한 계단',
    group: 'main',
    kind: 'screen',
    dynamic: true,
  },
  {
    path: '/library/textbooks/[step]/practice',
    // ⚠️ 경로를 그대로 접으면 31자라 `isSafeProps`(24자)에 걸린다 — 줄여서 못박는다.
    screen: 'library-step-practice',
    label: '교재 계단 연습',
    group: 'main',
    kind: 'screen',
    dynamic: true,
  },
  {
    path: '/library/vocab',
    screen: 'library-vocab',
    label: 'Decks',
    group: 'main',
    kind: 'screen',
  },
  { path: '/my', screen: 'my', label: '내 것', group: 'main', kind: 'redirect' },
  {
    path: '/my/books',
    screen: 'my-books',
    label: '내 책 목록',
    says: '챕터로 나뉜 내 책. 워크스페이스에서 되돌아 나오는 자리다.',
    group: 'main',
    kind: 'screen',
    section: '그 밖',
  },
  {
    path: '/my/books/[bookId]',
    screen: 'my-book',
    label: '내 책 한 권',
    group: 'main',
    kind: 'screen',
    dynamic: true,
  },
  { path: '/my/texts', screen: 'my-texts', label: '내 본문', group: 'main', kind: 'redirect' },
  { path: '/my/words', screen: 'my-words', label: '내 단어', group: 'main', kind: 'redirect' },
  {
    path: '/pairflip',
    screen: 'pairflip',
    label: 'PairFlip',
    says: '짝을 맞추며 자리로 기억한다.',
    group: 'main',
    kind: 'screen',
    section: '연습과 세션',
  },
  {
    path: '/pairflip/play',
    screen: 'pairflip-play',
    label: 'PairFlip 세션',
    says: '열면 바로 시작한다.',
    group: 'main',
    kind: 'session',
    section: '연습과 세션',
  },
  {
    path: '/pairflip/results',
    screen: 'pairflip-results',
    label: 'PairFlip 결과',
    says: '세션이 끝난 뒤에만 내용이 있다.',
    group: 'main',
    kind: 'screen',
    section: '연습과 세션',
  },
  {
    path: '/plan',
    screen: 'plan',
    label: 'Plan',
    says: '자료와 요일을 골라 주간 계획을 짠다.',
    group: 'main',
    kind: 'screen',
    section: '학습 관리',
  },
  ...arcadeRoutes,
  { path: '/practice', screen: 'practice', label: 'Practice', group: 'main', kind: 'screen' },
  {
    path: '/practice/dcp',
    screen: 'practice-dcp',
    label: '구문 연습',
    says: '문장 구조를 직접 조립한다.',
    group: 'main',
    kind: 'session',
    section: '연습과 세션',
  },
  {
    path: '/reports',
    screen: 'reports',
    label: 'Report',
    says: '주간 리듬과 격려 한 줄.',
    group: 'main',
    kind: 'screen',
    section: '학습 관리',
  },
  {
    path: '/scriptquiz',
    screen: 'scriptquiz',
    label: 'ScriptQuiz',
    group: 'main',
    kind: 'screen',
  },
  {
    path: '/scriptquiz/play',
    screen: 'scriptquiz-play',
    label: 'ScriptQuiz 세션',
    says: '열면 바로 시작한다.',
    group: 'main',
    kind: 'session',
    section: '연습과 세션',
  },
  { path: '/settings', screen: 'settings', label: 'Settings', group: 'main', kind: 'screen' },
  { path: '/sitemap', screen: 'sitemap', label: '전체 보기', group: 'main', kind: 'screen' },
  {
    path: '/spellforge',
    screen: 'spellforge',
    label: 'SpellForge',
    says: '철자를 직접 만들어 낸다.',
    group: 'main',
    kind: 'screen',
    section: '연습과 세션',
  },
  {
    path: '/spellforge/play',
    screen: 'spellforge-play',
    label: 'SpellForge 세션',
    says: '열면 바로 시작한다.',
    group: 'main',
    kind: 'session',
    section: '연습과 세션',
  },
  { path: '/teacher', screen: 'teacher', label: 'Class', group: 'main', kind: 'role' },
  { path: '/text', screen: 'text', label: 'My Library', group: 'main', kind: 'screen' },
  {
    path: '/text/[id]',
    screen: 'text-read',
    label: '본문 워크스페이스',
    group: 'main',
    kind: 'screen',
    dynamic: true,
  },
  {
    path: '/text/[id]/comic',
    screen: 'text-comic',
    label: '본문을 만화로',
    group: 'main',
    kind: 'screen',
    dynamic: true,
  },
  {
    path: '/text/[id]/echo',
    screen: 'text-echo',
    label: 'EchoMatch',
    group: 'main',
    kind: 'screen',
    dynamic: true,
  },
  {
    path: '/text/new',
    screen: 'text-new',
    label: '본문 직접 넣기',
    says: '가진 지문을 붙여 넣어 학습 자료로 만든다.',
    group: 'main',
    kind: 'screen',
    section: '그 밖',
  },
  {
    path: '/wordblitz',
    screen: 'wordblitz',
    label: 'WordBlitz',
    says: '제한 시간 안에 뜻을 고른다.',
    group: 'main',
    kind: 'screen',
    section: '연습과 세션',
  },
  { path: '/wordvault', screen: 'wordvault', label: 'WordVault', group: 'main', kind: 'screen' },
  {
    path: '/wordvault/browse',
    screen: 'wordvault-browse',
    label: '단어 훑어보기',
    says: '열면 셸이 걷힌다.',
    group: 'main',
    kind: 'session',
    section: '연습과 세션',
  },
  {
    path: '/wordvault/review',
    screen: 'wordvault-review',
    label: '오늘 복습',
    says: '오늘 만날 단어만 모아 준다.',
    group: 'main',
    kind: 'session',
    section: '연습과 세션',
  },
  {
    path: '/wordvault/study',
    screen: 'wordvault-study',
    label: '단어 익히기',
    says: '고른 단어를 순서대로 본다.',
    group: 'main',
    kind: 'session',
    section: '연습과 세션',
  },
]

/** 계측 화면 id 의 닫힌 집합 — `screen_viewed` 는 이 밖의 값을 보내지 않는다. */
export const SCREEN_IDS: readonly string[] = LEARNER_ROUTES.map((r) => r.screen)

/**
 * 알 수 없는 경로. **경로 문자열을 그대로 보내지 않는다** —
 * `/fit` 공유 링크처럼 URL 에 내용이 실리는 화면이 있고, 잘린 조각도 내용이다
 * (`lib/analytics/client.ts` 머리 주석의 같은 판단).
 */
export const UNKNOWN_SCREEN = 'other'

/** 정적 라우트 빠른 조회. */
const STATIC_BY_PATH = new Map(LEARNER_ROUTES.filter((r) => !r.dynamic).map((r) => [r.path, r]))

/** 동적 라우트는 세그먼트 수가 같고 리터럴 자리가 일치할 때만 맞는다. */
const DYNAMIC_ROUTES = LEARNER_ROUTES.filter((r) => r.dynamic).map((r) => ({
  route: r,
  segments: r.path.split('/').filter(Boolean),
}))

/**
 * 경로 → 화면 id. 모르면 `other`.
 *
 * 쿼리·해시는 호출부가 넘기지 않지만(`usePathname()` 은 경로만 준다) 방어로 잘라 낸다.
 */
export function screenIdOf(pathname: string): string {
  const clean = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'
  const exact = STATIC_BY_PATH.get(clean)
  if (exact) return exact.screen

  const parts = clean.split('/').filter(Boolean)
  for (const { route, segments } of DYNAMIC_ROUTES) {
    if (segments.length !== parts.length) continue
    const matched = segments.every(
      (seg, i) => (seg.startsWith('[') && seg.endsWith(']')) || seg === parts[i],
    )
    if (matched) return route.screen
  }
  return UNKNOWN_SCREEN
}

/** 경로 → 매니페스트 항목(정적만). 사이트맵·셸이 화면의 성격을 물을 때 쓴다. */
export function learnerRouteOf(path: string): LearnerRoute | undefined {
  return STATIC_BY_PATH.get(path)
}

/**
 * **학습자에게 팔아도 되는 목적지인가.**
 *
 * `redirect` 는 목적지가 목록에 따로 있어 두 번 세는 꼴이 되고,
 * `dynamic` 은 어떤 id 를 넣을지 모르며,
 * `lab`(= `/hub-lab`)은 학습자 동선이 아니다 — 인바운드 링크가 저장소 전체에 0건이고
 * (자기 화면의 변형 전환 제외) 재설계 실험용이라 `tests/e2e/utils/learner-routes.ts`
 * 의 `SKIP_ROUTES` 와 `wayfinding.test.ts` 의 `EXEMPT` 도 같은 이유로 빼 둔다.
 * **여기서 빼는 것이 그 결정을 코드에 남기는 자리다** — 지금까지는 근거 없이 떠 있었다.
 */
export function isLearnerDestination(route: LearnerRoute): boolean {
  return !route.dynamic && route.kind !== 'redirect' && route.kind !== 'lab'
}

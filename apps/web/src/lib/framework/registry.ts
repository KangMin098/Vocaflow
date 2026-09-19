// apps/web/src/lib/framework/registry.ts
//
// 학습 활동 레지스트리 — 활동의 이름·면·단계·콘텐츠 요구를 선언하는 **단일 출처**.
//
// 왜 이것이 화면보다 먼저인가:
//   지금 활동 목록이 9개 내비 표면에 각자 있고(sidebar-config · FlowNav.STAGES ·
//   ModuleCard.MODULE_META · ModePills.MODES · SessionFrame.STAGE_OPTIONS ·
//   VocabSetPreviewModal.CHAPTER_GAMES · PLAN_ACTIVITIES · game/catalog ·
//   TodayPrescriptionCard), 하나라도 빠뜨리면 그 화면에서만 활동이 사라진다.
//   WordBlitz 가 두 곳에 소속되고 EchoMatch 가 어디에도 없는 이유가 이것이다.
//
//   이 파일이 채워지면 새 활동은 **여기 한 줄**로 등록되고, 처방·연습장·챕터 런처에
//   자동으로 나타난다. 메뉴는 늘어나지 않는다.
//
// 왜 19종을 여기 다시 적지 않는가:
//   적으면 그게 **10번째 복제**다. 아케이드 항목은 `game/catalog` 와 `game/brief` 에서
//   파생시키고(이름·최소 단어 수·아키타입·계열은 이미 거기 있다), 이 파일은 **새 정보만**
//   갖는다 — 어떤 면(facet)을 훈련하는가. 그것이 지금 어디에도 없는 유일한 정보다.

import { GAME_CATALOG, type GameSlug } from '@/lib/game/catalog'
import { GAME_BRIEFS } from '@/lib/game/brief'
import type { BriefKind } from '@/lib/game/brief'

import { FACETS, SPINE, type FacetId, type StageId } from './axes'
import type { ContentRef, Strand } from './flow'

// ── 활동 ───────────────────────────────────────────────────────────

/** 콘텐츠 의존성 — 이 활동을 열려면 무엇이 있어야 하는가. */
export type ContentNeed =
  /** 내 단어만 있으면 된다 (아케이드 19종 전부) */
  | 'words'
  /** 본문이 필요하다 (ScriptQuiz · Dictation · Echo · Shadow) */
  | 'text'
  /** 도서 챕터가 필요하다 */
  | 'chapter'

/** 활동의 세션 라우트. `[id]` 세그먼트는 어떤 값과도 매칭된다. */
export interface ActivityRoute {
  /** 경로 템플릿 — 예: `/flashcard/play` · `/play/cascade` · `/text/[id]/echo` */
  path: string
  /**
   * 진입 시 사이드바·FlowNav 를 숨기는가(작업기억 보호 · §학습원칙6).
   * 이 값이 곧 `lib/layout/full-screen-routes` 의 근거다.
   */
  fullScreen: boolean
}

export interface Activity {
  /** 안정 키. `module_id` enum · `ScoreModule` · `ArcadeGameId` 의 단일 출처가 되어야 한다. */
  id: string
  /** 정식명 — 영문. 표면마다 다르게 쓰지 않는다. */
  name: string
  /** 좁은 자리용 별칭. 없으면 name 을 쓴다. */
  alias?: string
  /** 학습자에게 이 활동이 무엇인지 알리는 한국어 한 줄 */
  says: string
  /** 훈련하는 면 — 이 레지스트리가 새로 담는 유일한 정보 */
  facets: FacetId[]
  /** 손동작. 아케이드는 브리핑에서 파생, 모듈은 선언. */
  archetype: BriefKind
  contentNeed: ContentNeed
  /** 플레이 가능 하한 (아케이드는 카탈로그에서 파생) */
  minWords: number
  /**
   * FSRS 에 기여하는가. **"플레이 가능" 과 "기록 가능" 은 다르다** —
   * 5종은 설계돼 있으나 `learning_records` 실측 0건이고, ScriptQuiz·Dictation 은 0행이다.
   */
  records: boolean
  /** Four Strands 분류 — 배분 지표 산출용 */
  strand: Strand
  /** 어느 단계에 배치 가능한가 (spine 면에서 파생되지만 모듈은 명시) */
  stages: StageId[]
  /**
   * 세션 진입 경로. 없으면 전용 라우트가 없는 활동(워크스페이스 인라인).
   *
   * 왜 레지스트리가 갖는가: 라우트가 두 규약(`/x/play` · `/play/x`)으로 갈려 있는데,
   * "이 화면이 풀스크린인가" 를 **경로 문자열 패턴**(`endsWith('/play')`)으로 판정하고
   * 있었다. 그러면 `/notes/play` 같은 무관한 라우트가 생기는 순간 조용히 풀스크린이 되고,
   * 반대로 규약 밖에 놓인 세션은 조용히 사이드바를 달고 뜬다.
   * 경로는 선언의 대상이지 추측의 대상이 아니다.
   */
  route?: ActivityRoute
  /** 아케이드 계열에 접히는 활동인가 */
  family?: string
  /** 브리핑(Protocol)이 있는가 — 아케이드 19종은 전부 있다 */
  brief: boolean
}

// ── 면 매핑 (새 정보) ──────────────────────────────────────────────
//
// 이 표가 이 파일의 존재 이유다. 판정 근거는 각 게임 소스 헤더와 `game/brief/*.ts` 의
// objective·facts, 그리고 v08.4 전수 평가에서 확인한 "고유 결정" 이다.
//
// 읽는 법: `recognize` 가 10줄이고 `sound` 가 사실상 비어 있다 —
// 아케이드 정리와 신설의 근거가 이 분포다.

const ARCADE_FACETS: Record<GameSlug, FacetId[]> = {
  // 뜻→단어 재인 계열 — 면은 같고 판돈만 다르다
  cascade: ['recognize', 'fluency'],
  wordblitz: ['recognize', 'fluency'],
  'ghost-race': ['recognize', 'spell'], // 아웃코스가 철자 직접 입력
  'word-economy': ['recognize'],
  'daily-blitz': ['recognize', 'fluency'],
  'pirate-quest': ['recognize'],
  'lexicon-estate': ['recognize'],
  'word-orrery': ['recognize'],
  connections: ['recognize'],
  'lexicon-hands': ['recognize'],
  'lexicon-detective': ['recognize'],

  // 철자 생산
  'letter-forge': ['spell'],
  'wordsmith-vigil': ['spell'],

  // 형태·어원
  'morpheme-rules': ['build'],
  morphmerge: ['build'],
  'glyph-tongue': ['build', 'recognize'],
  'silent-rule': ['spell', 'build'],

  // 문맥·연어
  'word-customs': ['use'],

  // 청각 단서이지만 응답이 '뜻' — 발음 지식을 검증하지 않으므로 sound 로 세지 않는다.
  // 이것이 F3 이 비어 있는 이유다(조사에서 확인된 결함).
  'wordfall-cadence': ['recognize', 'fluency'],
}

/** 아케이드 활동을 카탈로그 + 브리핑에서 파생한다 — 복제하지 않는다. */
function arcadeActivities(): Activity[] {
  return GAME_CATALOG.map((g) => {
    const brief = GAME_BRIEFS[g.slug]
    const facets = ARCADE_FACETS[g.slug] ?? []
    return {
      id: g.slug,
      name: g.name,
      alias: g.modeLabel,
      says: g.tagline,
      facets,
      archetype: brief?.board.kind ?? 'pick',
      contentNeed: 'words' as ContentNeed,
      minWords: g.minWords,
      // 베타는 학습 기록 미연동 — 카탈로그가 이미 그것을 선언한다
      records: !g.beta,
      strand: facets.includes('fluency') ? 'fluency' : 'language-focused',
      stages: stagesFor(facets),
      // 아케이드는 `(app)/play/<slug>` 규약 하나로 통일돼 있고 전부 풀스크린이다.
      route: { path: `/play/${g.slug}`, fullScreen: true },
      family: g.family,
      brief: Boolean(brief),
    }
  })
}

/**
 * 훈련하는 spine 면에서 배치 가능한 단계를 파생한다.
 *
 * **혼합 활동 주의**: 재인과 생산을 함께 가진 활동(ghost-race 인코스/아웃코스 ·
 * silent-rule 격자/봉인 · glyph-tongue)은 단계에 따라 **다른 얼굴로 열려야 한다.**
 * 갓 만난 단어에 아웃코스(타이핑)를 걸면 초기 부호화 보호가 무너진다 —
 * 활동을 여는 쪽(처방)이 어느 면으로 들어갈지 정해야 하고, 이 파생만으로는 부족하다.
 */
function stagesFor(facets: FacetId[]): StageId[] {
  const out: StageId[] = []
  for (const f of SPINE) {
    if (!facets.includes(f)) continue
    if (f === 'recognize') out.push('met', 'recognized')
    if (f === 'spell') out.push('recognized', 'recalled')
    if (f === 'use') out.push('recalled', 'applied')
    if (f === 'fluency') out.push('applied', 'fluent')
  }
  // cross 면만 가진 활동은 어느 단계에서든 할 수 있다
  return out.length > 0 ? [...new Set(out)] : ['met', 'recognized', 'recalled', 'applied', 'fluent']
}

// ── 모듈 활동 (선언) ───────────────────────────────────────────────
//
// 9모듈 중 인출 이벤트가 있는 것만 활동이다. TextViewer(노출) · WordVault(자가평가) ·
// Dashboard(회고)는 활동이 아니라 표면·화면이므로 여기 없다.
//
// ⚠️ `records: false` 는 결함이지 설계가 아니다 — FSRS 에 0행을 쓰는 것은
//    "L5/L6 = 최상위 인출" 이라는 학습 모델과 정면 충돌한다.
//    **Dictation 은 v07 에서 해소됐고(84행 실측), ScriptQuiz 는 여전히 0행이다.**

export const MODULE_ACTIVITIES: Activity[] = [
  {
    id: 'flashcard',
    route: { path: '/flashcard/play', fullScreen: true },
    name: 'Flashcard',
    says: '뜻과 단어를 짝지어 떠올려요',
    facets: ['recognize'],
    archetype: 'pick',
    contentNeed: 'words',
    minWords: 1,
    records: true,
    strand: 'language-focused',
    stages: ['met', 'recognized'],
    brief: false,
  },
  {
    id: 'pairflip',
    route: { path: '/pairflip/play', fullScreen: true },
    name: 'PairFlip',
    says: '뒤집어 짝을 맞춰요',
    facets: ['recognize'],
    archetype: 'group',
    contentNeed: 'words',
    minWords: 4,
    records: true,
    strand: 'language-focused',
    stages: ['met', 'recognized'],
    brief: false,
  },
  {
    id: 'spellforge',
    route: { path: '/spellforge/play', fullScreen: true },
    name: 'SpellForge',
    says: '후보 없이 철자를 직접 써요',
    facets: ['spell'],
    archetype: 'type',
    contentNeed: 'words',
    minWords: 1,
    records: true,
    strand: 'language-focused',
    stages: ['recognized', 'recalled'],
    brief: false,
  },
  {
    id: 'echo',
    // 워크스페이스에서 열리되 셸을 유지한다 — 현행 동작 그대로 선언한다.
    route: { path: '/text/[id]/echo', fullScreen: false },
    // 이름 결정: '따라하기' 를 폐기하고 Echo 하나로. Shadow 와 다른 활동이다.
    name: 'Echo',
    alias: 'EchoMatch',
    says: '소리를 따라 하고 억양을 맞춰요',
    facets: ['sound'],
    archetype: 'type',
    contentNeed: 'text',
    minWords: 0,
    // 인출 기록을 남긴다 — `learning_records(module='echo')`. 이것으로 청각 면(F3) 이력이 선다.
    // 단, **복습 간격은 움직이지 않는다**: 문장이 화면에 떠 있는 채로 따라 말하는 활동이라
    // 인출이 아니다(TAP). 그래서 `vocabularies` D/S 는 그대로다 — lib/echo/word-signal.ts 참조.
    records: true,
    strand: 'output',
    stages: ['recognized', 'recalled', 'applied', 'fluent'],
    brief: false,
  },
  {
    id: 'shadow',
    // 이름 결정: 워크스페이스 인라인 따라읽기. Echo 와 구별된다.
    name: 'Shadow',
    says: '본문을 소리 내어 따라 읽어요',
    // fluency 를 넣지 않는다 — 오디오를 따라 읽는 것은 인출이 아니라 노출이다.
    // Fluency 면은 "생각하지 않아도 바로 나온다" 를 재는 것이고 Shadow 는 그것을 재지 않는다.
    facets: ['sound'],
    archetype: 'type',
    contentNeed: 'text',
    minWords: 0,
    records: false,
    strand: 'input',
    stages: ['met', 'recognized', 'recalled', 'applied', 'fluent'],
    brief: false,
  },
  {
    id: 'scriptquiz',
    route: { path: '/scriptquiz/play', fullScreen: true },
    name: 'ScriptQuiz',
    says: '본문을 이해했는지 확인해요',
    facets: ['use'],
    archetype: 'pick',
    contentNeed: 'text',
    minWords: 0,
    // **0행은 결함이 아니다 — 남길 단어가 없다.** (실측 2026-08-15)
    //   `library_chapter_quiz` 1,019 + `quiz_questions` 5 문항 어디에도 대상 단어 컬럼이 없고,
    //   문항 자체가 서사 이해다("Wickham 에 대한 여론은 어떻게 뒤집혔나"). 줄거리 문제를 맞힌 것을
    //   그 문장에 든 단어의 인출로 세면 근거 없는 주장이 된다(설계안 §9 배제 — TAP).
    //   이 활동이 재는 것은 **본문 이해**이고 그건 이미 `scores` 에 남는다(실측 15행).
    //   어휘 신호를 원하면 문항에 대상 단어를 갖게 하는 **콘텐츠 모델 변경**이 선행돼야 한다.
    records: false,
    strand: 'input',
    stages: ['recalled', 'applied'],
    brief: false,
  },
  {
    id: 'dictation',
    route: { path: '/dictate/session', fullScreen: true },
    name: 'Dictation',
    says: '들으면서 받아써요',
    facets: ['sound', 'spell', 'use'],
    archetype: 'type',
    contentNeed: 'text',
    minWords: 0,
    // v07 에서 해소됐다 — 문장 안의 타깃 단어 적중을 FSRS 등급으로 올린다
    // (`lib/dictation/targets.ts` → `flushPendingSrsResults`).
    // 실측 2026-08-14: `learning_records(module='dictation')` 84행. 이전에는 전 기간 0행이었다.
    records: true,
    strand: 'output',
    stages: ['recalled', 'applied', 'fluent'],
    brief: false,
  },
]

// ── 병합 · 조회 ────────────────────────────────────────────────────

export function activities(): Activity[] {
  return [...MODULE_ACTIVITIES, ...arcadeActivities()]
}

export function activityById(id: string): Activity | undefined {
  return activities().find((a) => a.id === id)
}

/**
 * 좁은 자리(칩·배지)용 짧은 이름. 없으면 정식명, 그것도 없으면 id 그대로.
 *
 * 왜 필요한가: 화면들이 각자 10줄짜리 라벨 표를 들고 있었고 아케이드 19종이 거기 없어서
 * **학습자에게 raw 슬러그(`pirate-quest`·`cascade`)가 그대로 노출**됐다(2026-08-13 실측:
 * 대시보드 최근 활동 칩). 라벨 표를 또 만드는 대신 레지스트리에서 파생시킨다 —
 * 이것이 "9곳을 하나로 접는다" 의 첫 소비자다.
 */
/**
 * 풀스크린으로 열리는 활동 경로 — `lib/layout/full-screen-routes` 가 지켜야 할 목록.
 *
 * 레이아웃이 이 함수를 **직접 부르지는 않는다**: 레지스트리는 `game/catalog` 를 거쳐
 * `GAME_MARKS`(ReactNode)까지 끌고 오므로, 사이드바·FlowNav 가 import 하면 그 JSX 가
 * 전 화면 번들에 딸려 온다. 그래서 판정 목록은 레이아웃 쪽에 손으로 두되,
 * **단위 테스트가 이 함수와 대조해 드리프트를 막는다**(framework.test.ts).
 */
export function fullScreenActivityPaths(): string[] {
  return activities()
    .map((a) => a.route)
    .filter((r): r is ActivityRoute => !!r && r.fullScreen)
    .map((r) => r.path)
    .sort()
}

export function activityLabel(id: string): string {
  const a = activityById(id)
  if (!a) return id
  return a.alias ?? a.name
}

/** 이 면을 훈련하는 활동들 — 처방이 "무엇으로 이 면을 채울까" 를 고를 때 쓴다. */
export function activitiesForFacet(facet: FacetId): Activity[] {
  return activities().filter((a) => a.facets.includes(facet))
}

/**
 * 면 커버리지 — 설계상 존재와 **실사용 존재**를 구분해서 센다.
 * 이 구분 없이 집계하면 "6면 다 있다" 는 거짓이 된다(5종 실측 0건 · 2모듈 0행).
 */
export function facetCoverage(): Record<FacetId, { designed: number; recording: number }> {
  const out = {} as Record<FacetId, { designed: number; recording: number }>
  for (const facet of Object.keys(FACETS) as FacetId[]) {
    const all = activitiesForFacet(facet)
    out[facet] = { designed: all.length, recording: all.filter((a) => a.records).length }
  }
  return out
}

/** 이 콘텐츠로 열 수 있는 활동들 — 챕터 런처·연습장이 쓴다. */
export function activitiesForContent(ref: ContentRef): Activity[] {
  const need: ContentNeed[] =
    ref.type === 'book' && ref.chapter != null
      ? ['words', 'text', 'chapter']
      : ref.type === 'text' || ref.type === 'article'
        ? ['words', 'text']
        : ['words']
  return activities().filter((a) => need.includes(a.contentNeed))
}

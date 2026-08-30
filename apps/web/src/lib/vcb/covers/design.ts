// apps/web/src/lib/vcb/covers/design.ts
//
// 단어장 표지의 **시각 언어** — 유형마다 결이 있고, 29권이 한 시리즈로 읽히게.
//
// ── 왜 검색만으로는 안 되나 ─────────────────────────────────────────
// Openverse 에 "etymology" 를 넣으면 스톡 사진·스크린샷·현대 일러스트가 섞여 나온다.
// 그걸 29개 유형에 그대로 붙이면 카탈로그가 **잡지 스크랩북**이 된다. 학습자에게 표지는
// "그 책이 뭐였지" 를 되살리는 손잡이인데, 결이 없으면 손잡이끼리 구별이 안 된다.
//
// ── 그래서 두 겹으로 만든다 ─────────────────────────────────────────
//
// ① 소재를 **퍼블릭도메인 도판**으로 한정한다 (판화·해부도·식물도감·고지도·성좌도).
//    · 이 플랫폼의 도서관 자체가 구텐베르크 고전이다 — 같은 시대의 인쇄물이라 결이 맞는다
//    · 시대·질감·선의 밀도가 자동으로 통일된다. 현대 사진은 채도와 심도가 제각각이라 안 된다
//    · '어원'·'미수록' 처럼 사진 찍을 대상이 없는 추상 유형에도 도판은 존재한다(색인·도표·지도)
//    · PD 는 출처 표기가 법적 의무는 아니지만 그래도 기록한다 — 나중에 되찾을 수 없다
//
// ② 계열마다 **한 가지 색으로 듀오톤** 처리한다.
//    출처가 제각각이어도 같은 색으로 눌러 두면 한 시리즈로 읽힌다. 그리고 계열이 다섯이라
//    색만 보고 "아, 저건 원서 계열" 이 된다 — 카테고리 칩이 못 하던 일을 표지가 한다.
//
// 색은 새로 만들지 않았다. 프로젝트가 이미 쓰는 값에서 가져온다:
//   Memory Decay 4색(stable/shaky/risk/new) + admin 보라. 새 팔레트를 들이면
//   화면마다 색이 늘어나 Calm UI 가 무너진다.

import { FAMILY_DUOTONE } from '@vocaflow/library-pipeline/vocab-brand'

import type { Blueprint } from '@/lib/vcb/compose/blueprints'

export type CoverFamily = Blueprint['family']

export interface FamilyGrain {
  /** 계열의 결 — 한 줄로 말하는 시각 방향 */
  grain: string
  /** 어떤 도판을 찾을 것인가 — 검색어에 공통으로 붙는 성격 */
  material: string
  /** 듀오톤 어두운 쪽 (선·그림자) */
  ink: string
  /** 듀오톤 밝은 쪽 (지면) */
  paper: string
}

/**
 * 계열 5개 × 결.
 *
 * 색 출처: stable `#2E7D5A` · shaky `#B5803A` · risk `#9C3A30` · new `#8A8278` (Memory Decay),
 * 보라 `#8B5CF6` (admin 액센트). 어느 쪽도 학습 상태를 뜻하지 않는 자리라 의미 충돌은 없다.
 */
/**
 * 계열의 **결**(방향)만 여기서 정한다. 색은 아래에서 브랜드 규격을 읽어 붙인다.
 *
 * 결과 소재는 아트 디렉션이라 값이 여기 있어야 맞지만, **색은 아니다** — 색은
 * 디자인 토큰이 정본이다.
 */
const FAMILY_DIRECTION: Record<CoverFamily, Omit<FamilyGrain, 'ink' | 'paper'>> = {
  list: {
    grain: '축적과 질서 — 세어서 줄 세운 것',
    material: 'antique chart engraving',
  },
  structure: {
    grain: '해부와 분해 — 조각으로 나눠 본 것',
    material: 'botanical plate',
  },
  corpus: {
    grain: '장면과 서사 — 이야기 속에서 만난 것',
    material: 'book illustration engraving',
  },
  delivery: {
    grain: '리듬과 반복 — 매일 같은 자리로 돌아오는 것',
    material: 'antique clock engraving',
  },
  unique: {
    grain: '열림과 연결 — 이 플랫폼만 그릴 수 있는 지도',
    material: 'celestial chart',
  },
}

/**
 * 계열 5개 × 결 + 듀오톤 색.
 *
 * ⚠️ **색을 여기 적지 않는다.** 2026-08-30 이전에는 열 색을 손으로 적어 두었는데,
 *   그중 둘만 토큰값과 같고 나머지는 사본이거나 어디서도 오지 않은 값이었다.
 *   교재 조판기가 똑같은 상태였다가 다섯 항목이 전부 어긋난 채로 발견됐다
 *   (`packages/library-pipeline/src/textbook/brand.ts` 참조).
 *
 *   그래서 `vocab/brand.ts` 의 `FAMILY_DUOTONE` 에서 **읽는다** — 그쪽은 다시
 *   `@vocaflow/design-tokens` 에서 읽으므로, 토큰이 바뀌면 표지도 같이 바뀐다.
 */
export const FAMILY_GRAIN: Record<CoverFamily, FamilyGrain> = Object.fromEntries(
  (Object.keys(FAMILY_DIRECTION) as CoverFamily[]).map((family) => [
    family,
    { ...FAMILY_DIRECTION[family], ...FAMILY_DUOTONE.light[family] },
  ]),
) as Record<CoverFamily, FamilyGrain>

/** 다크 테마용 듀오톤 — 같은 키, 같은 결, 색만 다르다. */
export const FAMILY_GRAIN_DARK: Record<CoverFamily, FamilyGrain> = Object.fromEntries(
  (Object.keys(FAMILY_DIRECTION) as CoverFamily[]).map((family) => [
    family,
    { ...FAMILY_DIRECTION[family], ...FAMILY_DUOTONE.dark[family] },
  ]),
) as Record<CoverFamily, FamilyGrain>

/**
 * 유형별 검색어 — **그 유형이 무엇인지 한 장으로 떠올리게** 하는 도판을 찾는다.
 *
 * 고른 기준: 유형의 조직 원리를 그림으로 옮긴 것. 제목을 그대로 번역하지 않는다
 * (`synonym-cluster` 에 "synonym" 을 넣으면 사전 스크린샷이 나온다 — 그건 유의어가
 * 무엇인지 말하지 않는다. 같은 갈래에서 뻗은 가지가 그 원리를 더 잘 그린다).
 */
export const COVER_QUERY: Record<string, string> = {
  // 목록 — 세어서 줄 세운 것
  'freq-tier': 'statistical chart engraving',
  'exam-list': 'examination hall engraving',
  'curriculum-grade': 'schoolroom engraving',
  'academic-awl': 'antique library engraving',
  'level-band': 'staircase engraving',
  'domain-specialty': 'anatomical plate',
  'exam-items': 'letterpress type specimen',

  // 구조 — 조각으로 나눠 본 것
  'root-etymology': 'root system botanical plate',
  'word-family': 'family tree engraving',
  'pos-focus': 'gears diagram',
  'topic-field': 'world atlas map',
  'synonym-cluster': 'botanical plate',
  'antonym-pair': 'balance scales engraving',
  confusable: 'butterfly plate',
  collocation: 'chain links engraving',
  'phrasal-idiom': 'knot diagram',
  polysemy: 'prism light',
  'rhyme-phonics': 'church bell engraving',

  // 원서·글 — 이야기 속에서 만난 것
  'book-companion': 'reading woman engraving',
  'chapter-companion': 'illuminated manuscript initial',
  'news-article': 'newspaper printing engraving',
  'script-media': 'theatre stage engraving',

  // 전달 — 매일 같은 자리로 돌아오는 것
  'day-pacing': 'almanac calendar page',
  'mnemonic-story': 'mnemonic art memory diagram',
  'picture-dict': 'pictorial dictionary plate',
  'audio-only': 'phonograph engraving',

  // 고유 — 이 플랫폼만 그릴 수 있는 지도
  unlock: 'antique key engraving',
  recycle: 'orrery orbit diagram',
  'facet-ladder': 'gemstone facets diagram',
  'confusion-log': 'labyrinth engraving',
  uncovered: 'antique blank map',
}

/**
 * **권별 검색어 — 한 유형이 여러 권일 때.**
 *
 * ── 왜 필요한가 (실측 2026-08-30) ───────────────────────────────────
 * 위 표는 **유형당 하나**다. 그런데 주제별 단어장을 17권 내자 열일곱 권이 전부
 * `world atlas map` 한 검색어를 두고 경쟁했고, 표지 수집기가 이미 쓴 그림을 제외하므로
 * **한 권만 도판을 받고 열여섯 권이 그라디언트로 떨어졌다.**
 *
 * 유형 검색어를 주제어로 바꾸면 안 된다 — 그 표는 "이 유형이 무엇인가" 를 그리는 자리다
 * (`freq-tier` = 도표, `root-etymology` = 뿌리 도판). 권이 여럿인 유형만 여기서 **덮어쓴다.**
 *
 * 검색어는 소재를 말하고 결은 계열이 잡는다(`FAMILY_GRAIN`) — 그래서 주제가 달라도
 * 열일곱 권이 한 시리즈로 읽힌다.
 */
export const COVER_QUERY_BY_SLUG: Record<string, string> = {
  'cat-topic-travel': 'antique travel poster engraving',
  'cat-topic-animals': 'zoological plate engraving',
  'cat-topic-food-and-drink': 'botanical fruit plate',
  'cat-topic-health': 'anatomical plate engraving',
  'cat-topic-science-and-technology': 'microscope engraving',
  'cat-topic-the-natural-world': 'natural history plate',
  'cat-topic-people': 'portrait engraving crowd',
  'cat-topic-sport': 'archery engraving',
  'cat-topic-culture': 'ornament pattern plate',
  'cat-topic-appearance': 'costume plate engraving',
  'cat-topic-functions': 'rhetoric diagram engraving',
  'cat-topic-communication': 'telegraph engraving',
  'cat-topic-work-and-business': 'factory engraving',
  'cat-topic-politics-and-society': 'parliament engraving',
  'cat-topic-homes-and-buildings': 'architectural elevation drawing',
  'cat-topic-leisure': 'fairground engraving',
  'cat-topic-time-and-space': 'astronomical chart engraving',
  'cat-topic-notions': 'geometric diagram engraving',
  // 레벨 밴드 3권 — 같은 `staircase engraving` 을 두고 겹친다.
  'cat-level-v1-v3': 'stepping stones engraving',
  'cat-level-v8-v10': 'mountain summit engraving',
  // 교육과정 3권 · 수능 유형 3권도 각자 한 장씩 받아야 한다.
  'cat-curriculum-elem': 'primary schoolroom engraving',
  'cat-curriculum-high': 'lecture hall engraving',
  'cat-kice-purpose': 'compass rose engraving',
  'cat-kice-long': 'scroll manuscript engraving',
}

/** 표지 출처 — CC 표기 의무를 지키기 위해 URL 과 **함께** 저장한다. */
export interface CoverMeta {
  source: 'openverse'
  provider: string | null
  license: string
  license_url: string | null
  creator: string | null
  creator_url: string | null
  page_url: string | null
  /** 어떤 검색어로 찾았나 — 나중에 왜 이 그림인지 되짚을 유일한 단서 */
  query: string
  family: CoverFamily
}

/**
 * 라이선스가 **표기만으로 쓸 수 있는 것**인가.
 *
 * `nd`(변형 금지)는 듀오톤 처리가 변형에 해당할 수 있어 받지 않는다.
 * `sa`(동일조건)는 우리 화면 전체에 같은 라이선스를 요구할 소지가 있어 받지 않는다.
 * 남는 것은 PD/CC0/BY 뿐이고, 그게 이 카탈로그에 필요한 전부다.
 */
export const ALLOWED_LICENSES = ['pdm', 'cc0', 'by'] as const

export function isUsableLicense(license: string | null | undefined): boolean {
  if (!license) return false
  return (ALLOWED_LICENSES as readonly string[]).includes(license.toLowerCase())
}

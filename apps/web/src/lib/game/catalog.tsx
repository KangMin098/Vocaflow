// apps/web/src/lib/game/catalog.tsx
//
// 게임 카탈로그 SSoT — 아케이드 19종의 정체성·무드·마크·데이터 소스 단일 출처.
//
// 왜 SSoT 인가:
//   이전에는 같은 사실이 4곳에 흩어져 있었고 전부 drift 했다 —
//     · arcade/page.tsx GAMES(17종) · gamekit MARK_PATHS(17종)
//     · SessionFrame SESSION_META(14종 — 신규 3종 누락 → 닫기가 /hub 로 오배송)
//     · ArcadeEntryCard 문구("12종" / "14개 세계")
//   카탈로그 한 곳만 고치면 진입 카드·허브·세션 셸이 함께 갱신되도록 통합.
//
// 학습자 관점 분류 (`source`) — "이 게임이 내 단어를 쓰는가?" 가 선택의 1순위 기준:
//   · mine : 스코프 단어(내 복습 큐 · 단어장 · 스크립트)로 플레이 → FSRS 갱신됨
//   · bank : 내장 큐레이션 뱅크(수제 콘텐츠)로 플레이 → 추론·규칙 학습, FSRS 무관
//
// 서버 컴포넌트에서 import 가능해야 하므로 'use client' 를 두지 않는다 (순수 데이터 + SVG path).

import type { ReactNode } from 'react'

import type { ArcadeGameId } from '@/components/game/_shared/gamekit'

/** 카탈로그 전체 slug — ArcadeGameId(스캐폴드 17종) + 독립 3D 2종. */
export type GameSlug = ArcadeGameId | 'wordblitz' | 'pirate-quest'

/** 학습자에게 노출되는 데이터 소스 구분. */
export type GameSource = 'mine' | 'bank'

export interface GameMood {
  /** 카드 그라디언트 시작 */
  a: string
  /** 카드 그라디언트 끝 */
  b: string
  /** 앰비언트 글로우 */
  glow: string
  /** 마크·강조 텍스트 */
  accent: string
}

export interface GameEntry {
  slug: GameSlug
  name: string
  /** 한 줄 정체성 — 카드 본문 */
  tagline: string
  /** 인지 계층 칩 — LEARNING_MODEL 9계층 정합 */
  layer: string
  /** 원작 계보 (디자인 레퍼런스) */
  ref: string
  source: GameSource
  /** 세션 셸 이모지 (SessionFrame) */
  emoji: string
  /** 세션 닫기·Esc 목적지 */
  closeHref: string
  mood: GameMood
  /** GamePlayScaffold minWords — source==='mine' 만 유의미 */
  minWords: number
  /** three.js 풀스크린 3D */
  is3d?: boolean
  /** 베타 — 학습 기록 미연동 */
  beta?: boolean
  /**
   * 배경음악 트랙 (`public/audio/games/<slug>.mp3` ·
   * Alexander Nakarada / Scott Buckley · 둘 다 CC-BY 4.0).
   *
   * v07.7 에서 **측정 기반 재선곡** — 요구는 "웅장 + 긴장 + 긴박 + 빠른 템포".
   * 후보 118곡의 BPM·어택밀도·박 선명도·저역 타격·충만도·긴장도를 재서 상위만 남겼다
   * (전 곡 129~161 BPM). 루프는 **마디 정수배**로 잘라 되감기는 지점의 박 위상을 맞춘다.
   * 곡별 크레딧은 `public/audio/games/CREDITS.txt` (CC-BY 4.0 은 표기 의무 — /arcade 푸터).
   */
  music?: string
  /** 같은 인지 루프를 공유하는 계열 — 허브에서 한 장으로 접힌다. 단독 게임은 undefined. */
  family?: FamilyKey
  /** 계열 안에서 이 게임이 제공하는 "모드" 이름 (예: 클래식 · 고스트) */
  modeLabel?: string
  /** 모드 칩 아래 한 줄 — 이 모드만의 차별점 */
  modeNote?: string
  /** 계열 안 모드 정렬 (작을수록 먼저). 기본 모드가 맨 앞에 오도록 명시한다. */
  modeOrder?: number
}

// ─── 계열(family) — 같은 인지 루프, 다른 동기 장치 ────────────────
//
// 왜 필요한가:
//   실측 결과 wordblitz·daily-blitz·word-economy·ghost-race 4종(1,604줄)이
//   **완전히 같은 루프**였다 — `target.ko` 프롬프트 → 4지선다 en 타일 → `o.en === target.en`.
//   다른 건 게임이 아니라 그 위에 얹은 메타(타이머·데일리·경제·경쟁)뿐.
//
//   그렇다고 지울 것은 아니다. 학습적으로는 같아도 **동기 장치로는 서로 다르고**,
//   같은 문답 위에 모드를 얹는 구조는 Gimkit 이 검증한 방식이다.
//   진짜 문제는 존재가 아니라 **19장을 동급 카드로 평평하게 깔아 "또 같은 거네"로 읽히는 것**.
//   → 허브에서 계열 1장으로 접고, 그 안에서 모드를 고르게 한다. 게임 코드는 그대로.

export type FamilyKey = 'blitz'

export interface GameFamily {
  key: FamilyKey
  /** 계열 이름 — 카드 제목 */
  name: string
  /** 계열이 훈련하는 것 한 줄 */
  tagline: string
  layer: string
  ref: string
  mood: GameMood
  /** 계열 대표 마크로 쓸 게임 slug */
  markOf: GameSlug
}

export const GAME_FAMILIES: readonly GameFamily[] = [
  {
    key: 'blitz',
    name: '속사 인출',
    tagline: '뜻을 보고 단어를 빠르게 — 같은 인출을 네 가지 재미로',
    layer: 'L4a 재인',
    ref: 'Gimkit · Kahoot · Wordle',
    mood: { a: '#7C5AC9', b: '#2A1B45', glow: 'rgba(190,160,255,.5)', accent: '#E5DAFF' },
    markOf: 'wordblitz',
  },
] as const

export const FAMILY_BY_KEY: Record<string, GameFamily> = Object.fromEntries(
  GAME_FAMILIES.map((f) => [f.key, f]),
)

/** BGM 경로 헬퍼 — 파일명만 적고 경로는 한 곳에서. */
const bgm = (name: string) => `/audio/games/${name}.mp3`

// ─── 라인 마크 (32×32 stroke) ───
export const GAME_MARKS: Record<GameSlug, ReactNode> = {
  'glyph-tongue': (<><path d="M16 6v20" /><path d="M9 11h14M8 16h16M10 21h12" opacity=".85" /><circle cx="16" cy="6" r="1.5" /></>),
  'word-customs': (<><path d="M10 5h9l4 4v18H10z" /><path d="M19 5v4h4" opacity=".7" /><path d="M13 14h7M13 18h7M13 22h4" opacity=".85" /></>),
  'lexicon-hands': (<><rect x="7" y="11" width="11" height="15" rx="1.6" transform="rotate(-10 12.5 18.5)" /><rect x="14" y="9" width="11" height="15" rx="1.6" transform="rotate(10 19.5 16.5)" /></>),
  'lexicon-detective': (<><circle cx="14" cy="13" r="6.5" /><path d="M18.8 17.8L25 24" /><path d="M11 13h6" opacity=".5" /></>),
  'morpheme-rules': (<><rect x="5" y="12" width="9" height="8" rx="1.4" /><rect x="18" y="12" width="9" height="8" rx="1.4" /><path d="M14 16h4" /></>),
  'silent-rule': (<><rect x="7" y="7" width="18" height="18" rx="3.5" /><circle cx="11" cy="11" r="1.7" fill="currentColor" stroke="none" /><path d="M11 11h5.5v5.5" /></>),
  'lexicon-estate': (<><rect x="5" y="6" width="22" height="20" rx="2" /><path d="M16 6v20M5 15h11" /><path d="M16 21h11" opacity=".5" /></>),
  'word-orrery': (<><circle cx="16" cy="16" r="4.5" /><ellipse cx="16" cy="16" rx="11" ry="11" opacity=".55" /><circle cx="27" cy="16" r="1.7" fill="currentColor" stroke="none" /></>),
  'daily-blitz': (<><path d="M6 22h20" /><path d="M16 22a6 6 0 0 0-6-6" opacity=".55" /><path d="M16 22a6 6 0 0 1 6-6" /><path d="M16 6v3M25 9l-2 2M7 9l2 2" /></>),
  'letter-forge': (<><path d="M7 20h13l4 4H11l-4-4Z" /><path d="M20 20l3-6" /><path d="M9 14l4-6 4 6" /><path d="M10.5 11.5h5" /></>),
  cascade: (<><path d="M5 12c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 7 0" /><path d="M5 18c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 7 0" opacity=".7" /><path d="M5 24c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 7 0" opacity=".45" /></>),
  connections: (<><circle cx="10" cy="10" r="2.4" /><circle cx="22" cy="10" r="2.4" /><circle cx="10" cy="22" r="2.4" /><circle cx="22" cy="22" r="2.4" /><path d="M12.4 10h7.2M10 12.4v7.2M12 12l8 8" opacity=".7" /></>),
  'word-economy': (<><ellipse cx="16" cy="10" rx="8" ry="3.4" /><path d="M8 10v6c0 1.9 3.6 3.4 8 3.4s8-1.5 8-3.4v-6" /><path d="M8 16c0 1.9 3.6 3.4 8 3.4s8-1.5 8-3.4" opacity=".6" /><path d="M8 22c0 1.9 3.6 3.4 8 3.4s8-1.5 8-3.4" opacity=".4" /></>),
  'ghost-race': (<><path d="M9 6v20" /><path d="M9 7h13l-3 4 3 4H9" /><path d="M4 14h3M3 19h4" opacity=".6" /></>),
  'wordsmith-vigil': (<><path d="M23 6l-11 11-3 6 6-3L26 9z" /><path d="M9 23l2 2" opacity=".7" /><path d="M6 26h6" opacity=".5" /></>),
  morphmerge: (<><rect x="5" y="5" width="9" height="9" rx="1.6" /><rect x="18" y="5" width="9" height="9" rx="1.6" opacity=".7" /><rect x="11.5" y="18" width="9" height="9" rx="1.6" /><path d="M14 9.5h4" opacity=".6" /></>),
  'wordfall-cadence': (<><path d="M6 16v6M12 11v11M18 7v15M24 13v9" opacity=".9" /><path d="M4 9a5 5 0 0 1 8 0" opacity=".55" /></>),
  // 독립 3D 2종
  wordblitz: (<><path d="M16 4v7" /><path d="M9 11h14l-2.5 4h-9z" /><path d="M11 15l-2 9M21 15l2 9" opacity=".7" /><path d="M13 24h6" /></>),
  'pirate-quest': (<><path d="M16 7v18" /><circle cx="16" cy="5" r="2" /><path d="M8 18a8 8 0 0 0 16 0" /><path d="M11 11h5v5" opacity=".6" /></>),
}

// ─── 카탈로그 본체 ───
// 정렬 = 학습자 선택 순서(내 단어 → 큐레이션 → 3D). 각 구간 안은 인지 부하 낮은 순.
export const GAME_CATALOG: readonly GameEntry[] = [
  // ── source: mine — 내 복습 큐/단어장/스크립트 단어로 플레이 (FSRS 갱신) ──
  {
    slug: 'cascade', name: 'Cascade', tagline: '단어와 뜻을 이어 지우는 낙하 보드',
    layer: 'L4a 재인', ref: 'Match-3', source: 'mine', emoji: '🌊', closeHref: '/arcade', minWords: 6,
    mood: { a: '#2E92A8', b: '#123C59', glow: 'rgba(130,232,238,.5)', accent: '#BEF3F7' },
    music: bgm('cascade'),
  },
  {
    slug: 'ghost-race', name: 'Ghost Race', tagline: '유령과 속도 대결 · 리그 승급',
    layer: 'L4a 경쟁', ref: 'Kahoot', source: 'mine', emoji: '🏁', closeHref: '/arcade', minWords: 4,
    mood: { a: '#B34480', b: '#38296A', glow: 'rgba(255,158,224,.5)', accent: '#FFD1EE' },
    music: bgm('ghost-race'),
    family: 'blitz', modeOrder: 2, modeLabel: '고스트', modeNote: '지난 기록과 나란히 달리기',
  },
  {
    slug: 'word-economy', name: 'Word Economy', tagline: '코인을 벌어 파워업에 전략 투자',
    layer: 'L4a 전략', ref: 'Gimkit', source: 'mine', emoji: '🪙', closeHref: '/arcade', minWords: 4,
    mood: { a: '#C99A34', b: '#77481E', glow: 'rgba(255,216,124,.55)', accent: '#FFECBB' },
    music: bgm('word-economy'),
    family: 'blitz', modeOrder: 3, modeLabel: '이코노미', modeNote: '코인을 벌어 파워업에 투자',
  },
  {
    slug: 'wordfall-cadence', name: 'Wordfall Cadence', tagline: '발음을 듣고 케이던스가 다하기 전에 뜻을 고르라',
    layer: 'L4c 듣기', ref: 'Rhythm', source: 'mine', emoji: '🎵', closeHref: '/arcade', minWords: 4,
    mood: { a: '#4C6FA6', b: '#182444', glow: 'rgba(140,180,255,.44)', accent: '#D4E2FA' },
    music: bgm('wordfall-cadence'),
  },
  {
    slug: 'letter-forge', name: 'Letter Forge', tagline: '흩어진 글자로 철자를 벼려내다',
    layer: 'L4b 생성', ref: '애너그램', source: 'mine', emoji: '🔤', closeHref: '/arcade', minWords: 5,
    mood: { a: '#C4692C', b: '#54261F', glow: 'rgba(255,186,96,.55)', accent: '#FFD9A0' },
    music: bgm('letter-forge'),
  },
  {
    slug: 'wordsmith-vigil', name: "Wordsmith's Vigil", tagline: '뜻을 든 정령을 영단어 타이핑으로 흩어라',
    layer: 'L4b 생성', ref: 'Typing of the Dead', source: 'mine', emoji: '🖋', closeHref: '/arcade', minWords: 5,
    mood: { a: '#B5763A', b: '#3A2A1C', glow: 'rgba(255,196,120,.5)', accent: '#F2DCB0' },
    music: bgm('wordsmith-vigil'),
  },
  {
    slug: 'morphmerge', name: 'Morphmerge', tagline: '같은 어족의 형태를 알아보고 합쳐 수집하라',
    layer: 'L4b 형태론', ref: '2048 · Merge', source: 'mine', emoji: '🧬', closeHref: '/arcade', minWords: 4,
    mood: { a: '#3E9E6A', b: '#173F2C', glow: 'rgba(130,235,170,.44)', accent: '#D2F3DE' },
    music: bgm('morphmerge'),
  },

  // ── source: bank — 내장 큐레이션 뱅크 (수제 콘텐츠 · 스코프 무관) ──
  {
    slug: 'daily-blitz', name: 'Daily Blitz', tagline: '매일 새로운 10단어 · 스트릭',
    layer: '리텐션', ref: 'Wordle', source: 'bank', emoji: '📅', closeHref: '/arcade', minWords: 0,
    mood: { a: '#E8846A', b: '#7C3B5E', glow: 'rgba(255,196,150,.55)', accent: '#FFE0C4' },
    music: bgm('daily-blitz'),
    family: 'blitz', modeOrder: 4, modeLabel: '데일리', modeNote: '매일 10문항 · 내장 뱅크 · 스트릭',
  },
  {
    slug: 'connections', name: 'Connections', tagline: '16단어를 숨은 4개 의미로 잇다',
    layer: 'L5 관계', ref: 'NYT', source: 'bank', emoji: '🧩', closeHref: '/arcade', minWords: 0,
    mood: { a: '#7150A8', b: '#2C2356', glow: 'rgba(206,178,255,.5)', accent: '#E3D4FF' },
    music: bgm('connections'),
  },
  {
    slug: 'glyph-tongue', name: 'The Glyph Tongue', tagline: '뜻을 주지 않는다 — 문맥으로 룬을 해독',
    layer: 'L2 해독', ref: 'Chants of Sennaar', source: 'bank', emoji: '📜', closeHref: '/arcade', minWords: 0,
    mood: { a: '#6E86A6', b: '#333E56', glow: 'rgba(184,210,230,.5)', accent: '#DCE8F2' },
    music: bgm('glyph-tongue'),
  },
  {
    slug: 'word-customs', name: 'Word Customs', tagline: '단어의 여권을 심사해 위조를 적발하라',
    layer: 'L3+ 검증', ref: 'Papers, Please', source: 'bank', emoji: '🛂', closeHref: '/arcade', minWords: 0,
    mood: { a: '#B08444', b: '#4A3524', glow: 'rgba(230,190,120,.5)', accent: '#F2E2C0' },
    music: bgm('word-customs'),
  },
  {
    slug: 'morpheme-rules', name: 'Morpheme Rules', tagline: '형태소를 조립하면 그 뜻이 세계를 바꾼다',
    layer: 'L4b 형태론', ref: 'Baba Is You', source: 'bank', emoji: '🔠', closeHref: '/arcade', minWords: 0,
    mood: { a: '#4C7A9E', b: '#1A2330', glow: 'rgba(130,205,255,.44)', accent: '#D4EAFA' },
    music: bgm('morpheme-rules'),
  },
  {
    slug: 'silent-rule', name: 'The Silent Rule', tagline: '설명 없이 철자 규칙을 스스로 귀납하라',
    layer: 'L4b 귀납', ref: 'The Witness', source: 'bank', emoji: '🔆', closeHref: '/arcade', minWords: 0,
    mood: { a: '#3E9E86', b: '#173F3B', glow: 'rgba(140,235,190,.44)', accent: '#D2F3E4' },
    music: bgm('silent-rule'),
  },
  {
    slug: 'lexicon-hands', name: 'Lexicon Hands', tagline: '어원·품사 시너지로 배수를 폭발시켜라',
    layer: 'L4+ 시너지', ref: 'Balatro', source: 'bank', emoji: '🃏', closeHref: '/arcade', minWords: 0,
    mood: { a: '#7B4BA6', b: '#241732', glow: 'rgba(150,240,205,.42)', accent: '#CFF6E6' },
    music: bgm('lexicon-hands'),
  },
  {
    slug: 'lexicon-detective', name: 'Lexicon Detective', tagline: '현장 단서를 수확해 사건을 재구성하라',
    layer: 'L5 추리', ref: 'Golden Idol', source: 'bank', emoji: '🔍', closeHref: '/arcade', minWords: 0,
    mood: { a: '#9A7B3C', b: '#2E2A1C', glow: 'rgba(214,184,110,.46)', accent: '#F0E4C2' },
    music: bgm('lexicon-detective'),
  },
  {
    slug: 'lexicon-estate', name: 'Lexicon Estate', tagline: '단어-방을 배치해 의미장 저택을 짓다',
    layer: 'L5 의미망', ref: 'Blue Prince', source: 'bank', emoji: '🏛', closeHref: '/arcade', minWords: 0,
    mood: { a: '#3E6EA6', b: '#152238', glow: 'rgba(130,180,255,.44)', accent: '#CFE2FA' },
    music: bgm('lexicon-estate'),
  },
  {
    slug: 'word-orrery', name: 'The Word Orrery', tagline: '행성을 탐사해 앎으로 핵의 봉인을 연다',
    layer: 'L5 탐사', ref: 'Outer Wilds', source: 'bank', emoji: '🪐', closeHref: '/arcade', minWords: 0,
    mood: { a: '#3B4468', b: '#0A0E1E', glow: 'rgba(255,176,86,.42)', accent: '#FFD9A0' },
    music: bgm('word-orrery'),
  },

  // ── 독립 3D 2종 — 자체 엔진(three.js). 아케이드에서도 발견 가능해야 한다. ──
  {
    // v07 재설계로 three.js 인형뽑기 → 순수 2D DOM 속사 인지(MODULES.md §5). 3D 아님.
    slug: 'wordblitz', name: 'WordBlitz', tagline: '타이머와 콤보로 몰아붙이는 순수 속도전',
    layer: 'L4a 자동화', ref: '속사 인지', source: 'mine', emoji: '⏱', closeHref: '/wordblitz', minWords: 4,
    mood: { a: '#7C5AC9', b: '#2A1B45', glow: 'rgba(190,160,255,.5)', accent: '#E5DAFF' },
    music: bgm('wordblitz'),
    family: 'blitz', modeOrder: 1, modeLabel: '클래식', modeNote: '타이머·콤보·레벨업',
  },
  {
    slug: 'pirate-quest', name: "Pirate's Bounty", tagline: '해변에서 보물 단어를 찾는 3D 모험',
    layer: 'L4a 재인', ref: '3D 어드벤처', source: 'bank', emoji: '🏴‍☠️', closeHref: '/arcade', minWords: 0, is3d: true, beta: true,
    mood: { a: '#2E7D8F', b: '#123040', glow: 'rgba(120,220,230,.45)', accent: '#C8F0F5' },
    music: bgm('pirate-quest'),
  },
] as const

// ─── 파생 조회 ───
export const GAME_BY_SLUG: Record<string, GameEntry> = Object.fromEntries(
  GAME_CATALOG.map((g) => [g.slug, g]),
)

/** 아케이드 총 게임 수 — 진입 카드 문구가 카탈로그와 절대 어긋나지 않도록. */
export const GAME_COUNT = GAME_CATALOG.length

/** 내 단어로 플레이하는 게임 (FSRS 갱신) */
export const MINE_GAMES = GAME_CATALOG.filter((g) => g.source === 'mine')

/** 내장 큐레이션 뱅크 게임 */
export const BANK_GAMES = GAME_CATALOG.filter((g) => g.source === 'bank')

// ─── 허브 표시 단위 ───────────────────────────────────────────────
//
// 허브는 "게임 목록"이 아니라 "고를 거리 목록"을 그린다.
// 같은 계열 게임이 2개 이상 있으면 계열 1장으로 접고, 그 안에서 모드를 고르게 한다.

export type HubItem =
  | { kind: 'game'; game: GameEntry }
  | { kind: 'family'; family: GameFamily; modes: GameEntry[] }

/**
 * 게임 목록 → 허브 표시 단위.
 * 계열이 같은 게임을 하나로 접되, **계열 멤버가 이 목록에 1개뿐이면 접지 않는다**
 * (혼자 있는 계열 카드는 클릭이 한 번 더 드는 손해만 남는다).
 * 정렬은 입력 순서를 보존 — 계열 카드는 그 계열 첫 멤버의 자리에 놓인다.
 */
export function buildHubItems(games: readonly GameEntry[]): HubItem[] {
  const byFamily = new Map<FamilyKey, GameEntry[]>()
  for (const g of games) {
    if (!g.family) continue
    const list = byFamily.get(g.family) ?? []
    list.push(g)
    byFamily.set(g.family, list)
  }

  const emitted = new Set<FamilyKey>()
  const items: HubItem[] = []
  for (const g of games) {
    const members = g.family ? byFamily.get(g.family) : undefined
    if (!g.family || !members || members.length < 2) {
      items.push({ kind: 'game', game: g })
      continue
    }
    if (emitted.has(g.family)) continue
    emitted.add(g.family)
    const family = FAMILY_BY_KEY[g.family]
    if (!family) {
      items.push({ kind: 'game', game: g })
      continue
    }
    // 카탈로그 순서가 아니라 modeOrder 로 정렬 — 기본 모드(클래식)가 맨 앞에 오게.
    const modes = [...members].sort(
      (a, b) => (a.modeOrder ?? Number.MAX_SAFE_INTEGER) - (b.modeOrder ?? Number.MAX_SAFE_INTEGER),
    )
    items.push({ kind: 'family', family, modes })
  }
  return items
}

/**
 * 표시 단위에 실제로 담긴 게임 수 — 섹션 배지는 카드 수가 아니라 이 값을 써야 한다.
 * (계열이 통째로 다른 섹션으로 옮겨가므로 `MINE_GAMES.length` 와 어긋난다)
 */
export function countHubGames(items: readonly HubItem[]): number {
  return items.reduce((n, i) => n + (i.kind === 'game' ? 1 : i.modes.length), 0)
}

/**
 * 계열 접기는 섹션(mine/bank) 단위로 하면 계열이 쪼개진다 —
 * blitz 계열은 3종이 mine, 1종(데일리)이 bank 다. 학습자에겐 같은 게임의 모드이므로
 * **계열은 다수가 속한 섹션에 통째로 싣고**, 소수파 모드는 칩에 그 사실을 표기한다.
 */
export function hubSections(): { mine: HubItem[]; bank: HubItem[] } {
  const homeOf = new Map<FamilyKey, GameSource>()
  for (const f of GAME_FAMILIES) {
    const members = GAME_CATALOG.filter((g) => g.family === f.key)
    const mineCount = members.filter((g) => g.source === 'mine').length
    homeOf.set(f.key, mineCount * 2 >= members.length ? 'mine' : 'bank')
  }
  const pick = (src: GameSource) =>
    GAME_CATALOG.filter((g) => (g.family ? homeOf.get(g.family) === src : g.source === src))
  return { mine: buildHubItems(pick('mine')), bank: buildHubItems(pick('bank')) }
}

/** 게임 slug → 플레이 URL. 스코프(set/text/chapter)와 복귀(from)를 함께 싣는다. */
export function gamePlayHref(
  slug: GameSlug,
  opts: { from?: string; set?: string; text?: string; chapter?: number | null } = {},
): string {
  const q = new URLSearchParams()
  if (opts.set) q.set('set', opts.set)
  if (opts.text) q.set('text', opts.text)
  if (opts.chapter != null && opts.chapter > 0) q.set('chapter', String(opts.chapter))
  if (opts.from) q.set('from', opts.from)
  const qs = q.toString()
  return qs ? `/play/${slug}?${qs}` : `/play/${slug}`
}

/**
 * 오늘의 추천 1종 — 날짜 시드 결정론적 회전.
 *
 * 근거(딥서치): 선택지가 작업기억을 넘어서면 자율성이 아니라 마비를 만든다.
 * "기본 하나를 제시하고, 원하면 전부 둘러보게" 하는 구조가 완주율을 지킨다.
 *   · 복습할 내 단어가 충분하면 → mine 게임에서 회전 (오늘 학습이 곧 게임)
 *   · 부족하면 → bank 게임에서 회전 (단어가 없어도 즉시 놀 수 있음)
 *
 * 3D·베타는 추천에서 제외 — 모바일에서 무겁고(three.js 번들) 베타는 학습 기록이 없어
 * "오늘 이거 하나만" 이라는 약속에 맞지 않는다. 직접 고르면 물론 플레이 가능.
 *
 * @param dayIndex    KST 기준 epoch day (동일 날짜 = 동일 추천 · SSR/CSR 정합)
 * @param vocabCount  사용자가 보유한 (뜻이 있는) 단어 수 — mine 게임 minWords 최댓값 6 이 기준
 */
export function pickDailyGame(dayIndex: number, vocabCount: number): GameEntry {
  const base = vocabCount >= 6 ? MINE_GAMES : BANK_GAMES
  const pool = base.filter((g) => !g.is3d && !g.beta)
  const from = pool.length > 0 ? pool : base
  return from[((dayIndex % from.length) + from.length) % from.length]
}

/** KST 기준 epoch day — 추천 회전 시드. */
export function kstDayIndex(now: number = Date.now()): number {
  return Math.floor((now + 9 * 3_600_000) / 86_400_000)
}

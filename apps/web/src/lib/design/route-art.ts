// apps/web/src/lib/design/route-art.ts
//
// **경로 → 그림 · 색** 한 곳(DD-68 · tines-mapping §16). 사이드바 아이콘과 모듈 머리띠(`ModuleBanner`)가 같이 읽는다.
//
// 왜: 우리 화면 코퍼스(79화면 · 117회, `scripts/design/ours-corpus.mjs`)에서 학습 화면 대부분이 **그림 0 · 보라 외 색 0%** 였다.
//   캔버스가 무채가 되자 눈에 남는 색이 글자 · 테두리 · 버튼의 보라뿐이라 「보라만 보인다」. 참조는 화면마다
//   보라 외 원색 면 12% · 색 있는 소품 7.8개다. 화면을 하나씩 고치는 대신 셸 두 곳(레일 · 머리띠)에서 범주 색을 준다.
//
// 가장 긴 접두사가 이긴다(`/library/scripts` 가 `/library` 보다 먼저).

import { MATERIAL_TONE, MODULE_TONE, type Deep, type Tint } from './tone'

export type RouteArt = { tile: string; spot: string; tint: Tint; deep: Deep }

const R: Record<string, RouteArt> = {
  '/hub': { tile: 'tile-hub', spot: 'spot-memory', ...MODULE_TONE.dashboard },
  '/dashboard': { tile: 'tile-dashboard', spot: 'spot-dashboard', tint: 'yellow', deep: 'ink' },
  '/diagnostic': { tile: 'tile-quiz', spot: 'spot-quiz', ...MODULE_TONE.scriptquiz },
  '/plan': { tile: 'tile-dashboard', spot: 'spot-memory', tint: 'yellow', deep: 'ink' },
  '/reports': { tile: 'tile-dashboard', spot: 'spot-dashboard', tint: 'yellow', deep: 'ink' },
  '/library': { tile: 'tile-books', spot: 'spot-reading', ...MATERIAL_TONE.book },
  '/library/books': { tile: 'tile-books', spot: 'spot-reading', ...MATERIAL_TONE.book },
  '/library/scripts': { tile: 'tile-articles', spot: 'spot-dictionary', ...MATERIAL_TONE.article },
  '/library/vocab': { tile: 'tile-decks', spot: 'spot-flashcard', ...MATERIAL_TONE.word_set },
  '/library/textbooks': { tile: 'tile-textbooks', spot: 'spot-dictionary', ...MATERIAL_TONE.textbook },
  '/text': { tile: 'tile-read', spot: 'spot-reading', ...MODULE_TONE.read },
  '/my': { tile: 'tile-read', spot: 'spot-reading', ...MODULE_TONE.read },
  '/my/words': { tile: 'tile-vault', spot: 'spot-vault', ...MODULE_TONE.wordvault },
  '/my/books': { tile: 'tile-books', spot: 'spot-reading', ...MATERIAL_TONE.book },
  '/wordvault': { tile: 'tile-vault', spot: 'spot-vault', ...MODULE_TONE.wordvault },
  '/practice': { tile: 'tile-flashcard', spot: 'spot-flashcard', ...MODULE_TONE.flashcard },
  '/flashcard': { tile: 'tile-flashcard', spot: 'spot-flashcard', ...MODULE_TONE.flashcard },
  '/spellforge': { tile: 'tile-spellforge', spot: 'spot-spellforge', ...MODULE_TONE.spellforge },
  '/pairflip': { tile: 'tile-pairflip', spot: 'spot-pairflip', ...MODULE_TONE.pairflip },
  '/wordblitz': { tile: 'tile-wordblitz', spot: 'spot-wordblitz', ...MODULE_TONE.wordblitz },
  '/arcade': { tile: 'tile-wordblitz', spot: 'spot-wordblitz', ...MODULE_TONE.wordblitz },
  '/scriptquiz': { tile: 'tile-quiz', spot: 'spot-quiz', ...MODULE_TONE.scriptquiz },
  '/dictate': { tile: 'tile-dictation', spot: 'spot-listening', ...MODULE_TONE.dictation },
  '/comics': { tile: 'tile-comics', spot: 'spot-comic', ...MATERIAL_TONE.comic },
  '/csat': { tile: 'tile-csat', spot: 'spot-quiz', tint: 'pink', deep: 'magenta' },
  '/teacher': { tile: 'tile-teacher', spot: 'spot-teacher', tint: 'teal', deep: 'green' },
}

const KEYS = Object.keys(R).sort((a, b) => b.length - a.length)

export function routeArt(pathname: string): RouteArt | null {
  const k = KEYS.find((p) => pathname === p || pathname.startsWith(p + '/'))
  return k ? R[k] : null
}

/**
 * 머리띠를 **넣지 않는** 화면 — 이미 그림 머리가 있는 곳(서가 도서 · 만화 · 교사 · 오늘 · 성장 · 연습 · 기출 홈)과
 * 학습 중인 세션(집중 — 세션 틀이 따로 있다)과 읽기 본문.
 */
const NO_BANNER = [
  /^\/hub$/, /^\/dashboard$/, /^\/practice$/, /^\/library\/books$/, /^\/comics\//, /^\/teacher$/,
  /\/play(\/|$)/, /^\/dictate\/session/, /^\/wordvault\/(study|review|browse)/, /^\/csat$/, /^\/csat\/dissect/,
  /^\/text\/[^/]+/, /^\/library\/books\/[^/]+/, /^\/my\/books\/[^/]+/, /^\/settings/, /^\/diagnostic\/[^/]+/,
]
/**
 * `slot` — 셸(main)은 서가 하위를 건너뛴다: 서가는 구역 탭 **아래**에 머리띠가 와야 참조 순서(구역 내비 → 머리)와 같아서
 * `library/layout.tsx` 가 slot='library' 로 따로 그린다.
 */
export const wantsBanner = (pathname: string, slot: 'main' | 'library' = 'main') =>
  (slot === 'library' ? pathname.startsWith('/library/') : !pathname.startsWith('/library')) &&
  !NO_BANNER.some((re) => re.test(pathname)) &&
  routeArt(pathname) !== null

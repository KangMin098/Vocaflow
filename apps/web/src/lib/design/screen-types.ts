// apps/web/src/lib/design/screen-types.ts
//
// **학습자 화면 유형 정본**(2026-10-04 · PC 디자인 시스템 고정) — 정적 학습자 라우트 전부를 네 유형 + 별칭으로 나눈다.
// 같은 머리를 모든 화면에 붙이지 않기 위해서다(DESIGN_SYSTEM 「학습 화면 머리 두 계층」).
//
//   landing    발견형 — 고르고 시작하는 대기실. 머리 = `ModuleHero`(PC 솔루션형 가운데 히어로 + 양옆 판 삽화)
//   functional 기능형 — 기록 · 계획 · 설정처럼 일하는 화면. 머리 = `PageIntro`(왼쪽 정렬 · 세리프 · 가는 선)
//   session    세션 — 전체 화면 학습/게임 판. 셸 · 머리 없음(`isFullScreenRoute`)
//   special    특수 — 자체 골격이 정본인 곳(허브 홈 · 서가 구역 탭 · 만화 서가 · CSAT 3B)
//   alias      별칭 — 다른 화면으로 넘기기만 하는 주소
//
// `head` 는 **지금 실제로 쓰는** 머리다. `bespoke` 는 아직 공용 부품으로 옮기지 않은 화면이라는 뜻이고,
// 그 목록이 곧 다음 정리 대상이다(숨기지 않는다). 회귀(`__tests__/screen-types.test.ts`)가 지킨다:
//   ① 정적 학습자 라우트가 빠짐없이 여기 있다  ② `ModuleHero`/`PageIntro` 라고 적은 화면은 실제로 그것을 쓴다
//   ③ session 은 전체 화면 목록과 일치한다.

export type ScreenType = 'landing' | 'functional' | 'session' | 'special' | 'alias'
export type ScreenHead = 'ModuleHero' | 'PageIntro' | 'bespoke' | 'none'

export interface ScreenSpec {
  type: ScreenType
  head: ScreenHead
  /** 한 줄 근거 — 왜 이 유형인가, bespoke 면 무엇이 남았나 */
  note: string
}

const landing = (head: ScreenHead, note: string): ScreenSpec => ({ type: 'landing', head, note })
const functional = (head: ScreenHead, note: string): ScreenSpec => ({ type: 'functional', head, note })
const session = (note = '전체 화면 세션'): ScreenSpec => ({ type: 'session', head: 'none', note })
const special = (note: string): ScreenSpec => ({ type: 'special', head: 'bespoke', note })
const alias = (to: string): ScreenSpec => ({ type: 'alias', head: 'none', note: `→ ${to}` })

const PLAY_GAMES = [
  'cascade', 'connections', 'daily-blitz', 'ghost-race', 'glyph-tongue', 'letter-forge', 'lexicon-detective',
  'lexicon-estate', 'lexicon-hands', 'morpheme-rules', 'morphmerge', 'pirate-quest', 'silent-rule', 'word-customs',
  'word-economy', 'word-orrery', 'wordblitz', 'wordfall-cadence', 'wordsmith-vigil',
] as const

export const SCREEN_TYPES: Record<string, ScreenSpec> = {
  // ── 발견형 ──
  '/flashcard': landing('ModuleHero', '복습 대기실'),
  '/spellforge': landing('ModuleHero', '철자 연습 대기실'),
  '/pairflip': landing('ModuleHero', '게임 대기실'),
  '/wordblitz': landing('ModuleHero', '게임 대기실(PC 만 · 모바일 슬림 머리 유지)'),
  '/text': landing('ModuleHero', '내 라이브러리 입구'),
  '/dictate': landing('ModuleHero', '받아쓰기 입구(University 히어로 변형)'),

  // ── 기능형 ──
  '/dashboard': functional('PageIntro', '성장 기록 — 승인된 비대칭(머리 | 기억 카드)'),
  '/plan': functional('PageIntro', '학습 계획'),
  '/reports': functional('PageIntro', '주간 리포트'),
  '/diagnostic/history': functional('PageIntro', 'V-Level 기록 — 왼쪽 열 sticky'),
  '/settings': functional('PageIntro', '설정'),
  '/my/books': functional('PageIntro', '내 책장(PC 만 · 모바일 기존 머리)'),
  '/wordvault': functional('PageIntro', '단어 보관함 — 모듈 막대(뷰 전환) 아래 PC 공용 머리 · 모바일 막대 제목만'),
  '/scriptquiz': functional('PageIntro', '읽은 것 확인하기 — 고르기 화면(PageIntro compact · /practice 와 같은 판단, 코드 주석 「히어로 쓰지 않음」)'),
  '/dictate/results': functional('bespoke', '미확정(유형 판정 보류) — 세션 결과가 있어야 렌더(없으면 /dictate)'),
  '/practice/dcp': functional('PageIntro', '구문 연습(PC 만 · 모바일 기존 머리)'),
  '/practice': functional('PageIntro', '연습 고르기 — 보라 추천 블록이 히어로 몫(PC 만 · 모바일 기존 머리)'),
  '/sitemap': functional('PageIntro', '학습자 화면 지도(PC 만 · 모바일 기존 머리)'),

  // ── 세션 ──
  '/flashcard/play': session(),
  '/spellforge/play': session(),
  '/pairflip/play': session(),
  '/dictate/session': session(),
  '/scriptquiz/play': session(),
  '/wordvault/browse': session('비활동 전체 화면(단어 표)'),
  '/csat/dissect': session('CSAT 해설 극장(3B)'),
  ...Object.fromEntries(PLAY_GAMES.map((g) => [`/play/${g}`, session('게임 판')])),

  // ── 특수 ──
  '/arcade': special('Game Lab — 승인된 자체 어두운 게임 스킨(게임 판과 한 세계)'),
  '/arcade/ranking': special('게임 순위 — 게임 스킨'),
  '/diagnostic': special('진단 입구 — 승인된 자체 가운데 히어로(tines-adoption.md 「진단·설정·개별 게임」 변환 · 솔루션형과 같은 문법)'),
  '/text/new': special('새 스크립트 편집 작업면 — 저장 상태를 보이는 60px 고정 도구 막대(편집기 골격 · PageIntro 로 바꾸면 사라진다)'),
  '/wordvault/review': special('단어 복습 카드 — 셸 안 학습 세션(제목은 sr-only · 전체 화면 목록 밖)'),
  '/wordvault/study': special('단어 학습 카드 — 셸 안 학습 세션(제목은 sr-only · 전체 화면 목록 밖)'),
  '/dictate/setup': special('받아쓰기 세션 설정 단계 — 고른 본문 이름 · 되돌아가기 · 설정 폼이 머리(2026-10-05 ?text= 로 재현 · DB 쓰기 없음)'),
  '/pairflip/results': special('PairFlip 세션 결과 — 결과 카드가 머리(2026-10-05 sessionStorage 결과 주입으로 재현)'),
  '/hub': special('허브 홈 — 참조 홈 골격(제품 액자 · 색 탭 · 통판 · 서가 벽)'),
  '/library/books': special('서가 — 구역 탭 + 서가 스킨'),
  '/library/scripts': special('서가 — 구역 탭 + 서가 스킨'),
  '/library/textbooks': special('서가 — 구역 탭 + 서가 스킨'),
  '/library/vocab': special('서가 — 구역 탭 + 단어장 레일'),
  '/comics/adapted': special('만화 서가 — 구역 탭'),
  '/comics/restored': special('만화 서가 — 구역 탭'),
  '/csat': special('CSAT — 3B 앱 범위'),
  '/csat/browse': special('CSAT — 3B 앱 범위'),
  '/csat/diagnosis': special('CSAT — 3B 앱 범위'),
  '/csat/formulas': special('CSAT — 3B 앱 범위'),
  '/csat/record': special('CSAT — 3B 앱 범위'),

  // ── 별칭 ──
  '/comics': alias('/comics/adapted'),
  '/library': alias('/library/books'),
  '/my': alias('/text'),
  '/my/texts': alias('/text'),
  '/my/words': alias('/wordvault'),
  '/csat/space': alias('/csat'),
  '/csat/workspace': alias('/csat'),
  '/csat/workspace/new': alias('/csat'),
  '/csat/diagnosis/attempts/new': alias('/csat/diagnosis'),
}

/** 유형별 묶음 — 문서 · 감사 화면이 읽는다. */
export function screensOf(type: ScreenType): string[] {
  return Object.entries(SCREEN_TYPES).filter(([, s]) => s.type === type).map(([r]) => r).sort()
}

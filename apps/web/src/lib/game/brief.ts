// apps/web/src/lib/game/brief.ts
//
// 게임 브리핑 SSoT — 아케이드 19종의 "이 게임은 무엇을 시키는가"를 **보드 그림**으로 설명한다.
//
// 왜 필요한가:
//   카탈로그의 `tagline` 한 줄("단어와 뜻을 이어 지우는 낙하 보드")은 정체성이지 규칙이 아니다.
//   19종은 저마다 판돈 구조가 다르고(시계·거리·자본·박·보존도…) 그 차이가 곧 게임의 존재
//   이유인데, 학습자는 들어가 보기 전에는 그것을 알 수 없었다. 결과적으로 선택이 "이름과
//   색으로 찍기"가 되고, 첫 30초를 규칙 파악에 태우다 이탈한다.
//
// 설계 원칙:
//   ① **텍스트가 아니라 보드로 설명한다.** 각 게임은 실제 플레이 표면을 축약한 `board` 를
//      하나 갖고, 3장의 `figures` 는 같은 보드의 서로 다른 순간(초기·성공·실패)이다.
//      스크린샷이 아니라 데이터인 이유 — 스크린샷은 게임이 바뀌면 조용히 거짓이 되고,
//      다크/라이트·모바일·스크린리더에 대응하지 못한다.
//   ② **읽는 대신 해 보게 한다.** `trial` 은 학습자가 실제로 눌러서 통과하는 미니 절차다.
//      절차적 기억은 서술로 만들어지지 않는다(학습 과학 원칙 1 Active Recall 의 UI 판).
//   ③ **거짓말하지 않는다.** 모든 문구는 각 게임 소스의 헤더 계약에서 끌어왔다.
//      추측한 수치(한 판 몇 분 따위)는 쓰지 않고, 게임이 스스로 정의한 단위
//      (3랩 · 20틱 · 4회랑 · 격자 3판)로 말한다.
//
// 상호작용 아키타입은 4개뿐이다. 19종의 표면은 다 다르지만 **학습자가 하는 손동작**은
// 네 가지로 수렴한다 — 고른다 / 여러 개 고른다 / 순서대로 조립한다 / 판정한다.
// 아키타입을 늘리는 대신 이 4개를 정확하게 만들면, 브리핑끼리 조작이 일관돼
// 두 번째 게임부터는 브리핑 자체를 배울 필요가 없다.
//
// 서버 컴포넌트에서도 import 가능해야 하므로 'use client' 를 두지 않는다(순수 데이터).

import type { GameSlug } from '@/lib/game/catalog'

/**
 * 보드 아키타입.
 *  · pick     — 프롬프트 하나 + 후보들. 하나를 고른다.
 *  · group    — 규칙에 맞는 여러 칸을 고른 뒤 한 번에 확정한다.
 *  · assemble — 조각을 순서대로 눌러 빈 슬롯을 채운다.
 *  · judge    — 서류를 읽고 승인/반송 둘 중 하나를 찍는다.
 */
export type BriefKind = 'pick' | 'group' | 'assemble' | 'judge'

export interface BriefToken {
  id: string
  /** 타일 본문 */
  text: string
  /** 보조 줄 — 품사·단서·비용 등. 없으면 렌더하지 않는다. */
  sub?: string
  /** 이 토큰이 정답 계열인가 — figure 의 성공 상태를 칠할 때 쓴다. */
  ok?: boolean
  /** 위험/거절 계열 타일(반송·기각·관망 등)은 색이 달라야 한다. */
  tone?: 'plain' | 'danger' | 'quiet'
  /** 이 스텝부터 보인다(기본 0). "결정한 뒤에 선택지가 열린다" 같은 구조를 표현. */
  from?: number
}

export interface BriefPrompt {
  /** 프롬프트 위 작은 라벨 — 무엇이 주어졌는지 */
  label: string
  /** 프롬프트 본문 */
  value: string
  /**
   * text  — 평범한 문제
   * audio — 소리만 주어진다(철자 없음)
   * glyph — 미지의 글자
   * doc   — 서류(judge)
   */
  kind?: 'text' | 'audio' | 'glyph' | 'doc'
  /** 프롬프트 아래 한 줄 — 문맥 비문 · 발음기호 등 */
  note?: string
}

export interface BriefBoard {
  kind: BriefKind
  prompt?: BriefPrompt
  /** assemble — 채워야 할 슬롯 수 */
  slots?: number
  /** judge — 서류의 축들 */
  doc?: { label: string; value: string }[]
  /** 귀납형 게임의 증거 줄 (silent-rule) */
  evidence?: { ok: string[]; no: string[] }
  /** 게임 고유의 압력 게이지 — 시계·거리·잔고·박 등 */
  hud?: { label: string; pct: number }
  tokens: BriefToken[]
  /** 타일 격자 열 수 (기본 2) */
  cols?: 2 | 3 | 4
}

export interface BriefFigure {
  /** 이 순간을 설명하는 한 줄. 그림이 주고 글은 거든다 — 짧게. */
  caption: string
  /** 강조할 토큰 */
  focus?: string[]
  /** 강조의 의미 — 중립/성공/실패 */
  state?: 'idle' | 'good' | 'bad'
  /** hud 게이지 위치 override */
  hudPct?: number
  /** assemble — 채워진 슬롯 수 */
  filled?: number
}

export interface BriefTrialStep {
  /** 학습자에게 주는 지시 한 줄 */
  say: string
  /** 눌러야 하는 토큰 id */
  want: string[]
  /** 순서까지 맞아야 하는가 (assemble) */
  ordered?: boolean
  /** 두 번 틀리면 열리는 힌트 */
  hint?: string
}

export interface GameBrief {
  slug: GameSlug
  /** 한 문단 — "이 게임에서 학습자가 하는 일" */
  objective: string
  board: BriefBoard
  figures: BriefFigure[]
  trial: { steps: BriefTrialStep[]; done: string }
  facts: {
    /** 조작 */
    input: string
    /** 한 판의 단위 — 게임이 스스로 정의한 것만 쓴다 */
    run: string
    /** 학습 기록에 어떻게 남는가 */
    record: string
  }
}

/** 전 게임 공통 FSRS 계약 — 19종 헤더가 모두 같은 규칙을 지킨다. */
const FSRS = '내 단어면 기억 곡선(FSRS)에 반영 · 힌트로 산 정답은 제외'

export const GAME_BRIEFS: Record<GameSlug, GameBrief> = {
  // ── recall ────────────────────────────────────────────────────────
  cascade: {
    slug: 'cascade',
    objective:
      '위에 한국어 뜻이 하나 뜨고, 보드에는 영단어만 깔린다. 그 뜻의 단어를 찾아 한 번 탭하면 그게 곧 제출이다.',
    board: {
      kind: 'pick',
      cols: 3,
      prompt: { label: '이 뜻의 단어', value: '무너지다' },
      hud: { label: '물길', pct: 0.62 },
      tokens: [
        { id: 'collect', text: 'collect' },
        { id: 'collapse', text: 'collapse', ok: true },
        { id: 'comply', text: 'comply' },
        { id: 'console', text: 'console' },
        { id: 'convey', text: 'convey' },
        { id: 'colleague', text: 'colleague' },
      ],
    },
    figures: [
      { caption: '뜻은 위에 하나뿐. 보드에는 영단어만 있어 탭하기 전에는 정답을 특정할 수 없다.' },
      { caption: '맞히면 물길이 터지고 위 장이 무너져 내린다 — 낙차가 클수록 점수.', focus: ['collapse'], state: 'good', hudPct: 0.86 },
      { caption: '빗나가면 그 뜻은 끝. 한 뜻에 한 번뿐이라 찍기가 성립하지 않는다.', focus: ['comply'], state: 'bad', hudPct: 0.4 },
    ],
    trial: {
      steps: [{ say: '지금 뜻은 “무너지다”. 보드에서 그 단어를 짚어 보세요.', want: ['collapse'], hint: 'col- 로 시작하는 단어예요.' }],
      done: '이게 전부예요 — 실제 게임에서도 이 탭 한 번이 곧 제출입니다.',
    },
    facts: { input: '탭 · 클릭', run: '보드가 마를 때까지 · 목숨 3', record: FSRS },
  },

  wordblitz: {
    slug: 'wordblitz',
    objective:
      '시계가 없다. 목숨 3개로 어디까지 버티는지가 전부다. 5발마다 게임이 카드 두 장을 내밀고, 어느 방향으로 어려워질지를 학습자가 고른다.',
    board: {
      kind: 'pick',
      prompt: { label: '이 뜻의 단어는?', value: '가파른' },
      hud: { label: '남은 창', pct: 0.45 },
      tokens: [
        { id: 'steer', text: 'steer' },
        { id: 'steep', text: 'steep', ok: true },
        { id: 'stern', text: 'stern' },
        { id: 'sterile', text: 'sterile' },
      ],
    },
    figures: [
      { caption: '뜻이 뜨고 창(제한시간)이 줄어든다. 창은 판이 진행될수록만 좁아진다.' },
      { caption: '맞히면 콤보가 쌓인다. 오답 후보는 철자·품사가 닮은 것부터 올라온다.', focus: ['steep'], state: 'good' },
      { caption: '5발마다 조임 카드 2택 — 가속 · 혼선 · 역방향 · 잔상. 고른 카드는 판 내내 남고 배수를 키운다.', focus: ['steer'], state: 'bad', hudPct: 0.2 },
    ],
    trial: {
      steps: [{ say: '“가파른” 에 해당하는 단어를 고르세요.', want: ['steep'], hint: '경사가 가파르다 — st__p.' }],
      done: '실제 판에서는 여기에 목숨 3개와 조임 카드 선택이 얹힙니다.',
    },
    facts: { input: '탭 · 숫자키 1–4', run: '최대 8단계 × 5발 · 목숨 3', record: FSRS },
  },

  'ghost-race': {
    slug: 'ghost-race',
    objective:
      '화폐가 시간이 아니라 거리다. 구간마다 라인을 먼저 건다 — 안전한 인코스(선택지 4~5개)냐, 선택지가 아예 없는 아웃코스(직접 입력)냐.',
    board: {
      kind: 'pick',
      prompt: { label: '이 뜻의 단어', value: '견디다' },
      hud: { label: '유령과의 거리', pct: 0.55 },
      tokens: [
        { id: 'enclose', text: 'enclose' },
        { id: 'endure', text: 'endure', ok: true },
        { id: 'endorse', text: 'endorse' },
        { id: 'ensure', text: 'ensure' },
      ],
    },
    figures: [
      { caption: '구간에 들어가기 전에 라인을 건다. 아웃코스를 골랐다면 이 타일들이 아예 없다.' },
      { caption: '맞히면 거리가 벌어지고, 3연속부터 유령이 잠깐 묶인다(0.4 → 1.1초).', focus: ['endure'], state: 'good', hudPct: 0.78 },
      { caption: '빗나가면 콤보가 즉시 소멸한다. 라인 전환은 다음 구간부터라 보고 갈아탈 수 없다.', focus: ['ensure'], state: 'bad', hudPct: 0.3 },
    ],
    trial: {
      steps: [{ say: '인코스를 골랐습니다. 뜻은 “견디다” — 타일에서 고르세요.', want: ['endure'], hint: 'en- 로 시작하고 -dure 로 끝나요.' }],
      done: '아웃코스에서는 이 타일이 없고 철자를 직접 씁니다 — 대신 보상이 큽니다.',
    },
    facts: { input: '탭 · 아웃코스는 키보드 입력', run: '3랩 추격전 · 내 최고기록 유령과 비동기 경주', record: FSRS },
  },

  'word-economy': {
    slug: 'word-economy',
    objective:
      'blitz 계열에서 유일하게 벽시계가 없다. 세션은 20번의 거래(틱)로 센다. 모르면 손실 없이 “관망”할 수 있고, 확신에는 “지분”을 걸어 배당을 노린다.',
    board: {
      kind: 'pick',
      prompt: { label: '이 뜻의 단어', value: '수요' },
      hud: { label: '잔고', pct: 0.48 },
      tokens: [
        { id: 'depend', text: 'depend' },
        { id: 'demand', text: 'demand', ok: true },
        { id: 'deliver', text: 'deliver' },
        { id: 'deserve', text: 'deserve' },
        { id: 'pass', text: '관망', sub: '모르면 넘긴다 · 잃지 않는다', tone: 'quiet' },
      ],
    },
    figures: [
      { caption: '벽시계가 없다. 압력은 운영비 상승과 호가창 수축(7.0초 → 3.6초) 두 곡선이 만든다.' },
      { caption: '맞히면 코인이 들어온다. 확신하면 지분을 사서 배당 2회를 노릴 수 있다.', focus: ['demand'], state: 'good', hudPct: 0.72 },
      { caption: '모르면 관망 — 벌지 못하지만 잃지도 않는다. 찍기보다 기대값이 앞선다.', focus: ['pass'], state: 'idle' },
    ],
    trial: {
      steps: [{ say: '이번엔 확실합니다. “수요” 에 해당하는 단어를 고르세요.', want: ['demand'], hint: 'de- 로 시작하고 -mand 로 끝나요.' }],
      done: '모르는 종목이었다면 “관망” 이 정답입니다 — 이 게임에만 있는 세 번째 선택지예요.',
    },
    facts: { input: '탭 · H 로 지분 매입', run: '20 거래(틱) · 벽시계 없음', record: FSRS },
  },

  'daily-blitz': {
    slug: 'daily-blitz',
    objective:
      '하루 한 번의 의식. 세션 전체를 관통하는 시계 하나가 화폐다. 뜻만 먼저 보고 스스로 떠올린 뒤에야 선택지가 열린다.',
    board: {
      kind: 'pick',
      prompt: { label: '오늘의 단어', value: '드물게' },
      hud: { label: '남은 시간', pct: 0.66 },
      tokens: [
        { id: 'open', text: '선택지 열기', sub: '떠올린 뒤에 누른다', tone: 'quiet' },
        { id: 'rapidly', text: 'rapidly', from: 1 },
        { id: 'rarely', text: 'rarely', ok: true, from: 1 },
        { id: 'readily', text: 'readily', from: 1 },
        { id: 'roughly', text: 'roughly', from: 1 },
      ],
    },
    figures: [
      { caption: '뜻만 먼저 뜬다. 선택지는 닫혀 있어 소거법이 시작될 수 없다.' },
      { caption: '떠올렸으면 연다. 확신하면 3초를 선불로 걸어 점수 ×3 · 시간 보상 ×2.', focus: ['open'], state: 'idle' },
      { caption: '맞히면 시계가 늘고 틀리면 준다. 10문항 뒤에도 시간이 남으면 연장전이 이어진다.', focus: ['rarely'], state: 'good', hudPct: 0.88 },
    ],
    trial: {
      steps: [
        { say: '먼저 머릿속으로 답을 떠올려 보세요. 준비됐으면 “선택지 열기”.', want: ['open'] },
        { say: '이제 열렸습니다. “드물게” 에 해당하는 단어를 고르세요.', want: ['rarely'], hint: 'rare(드문) 의 부사형이에요.' },
      ],
      done: '이 순서가 이 게임의 전부입니다 — 떠올린 다음에 열기. 그래서 인출이 진짜 인출로 남습니다.',
    },
    facts: { input: '탭 · 숫자키', run: '하루 1회 · 10문항 + 연장전 · 스트릭', record: FSRS },
  },

  'pirate-quest': {
    slug: 'pirate-quest',
    objective:
      '훑기 → 회수 → 확정. 해변 자리마다 영단어 라벨이 뜨고, 라벨이 물에 잠긴 뒤에야 한국어 뜻이 불린다. 그 단어가 있던 자리를 기억해 짚는다.',
    board: {
      kind: 'pick',
      prompt: { label: '밀물이 부른 뜻', value: '닻' },
      hud: { label: '밀물', pct: 0.58 },
      tokens: [
        { id: 'palm', text: '야자수 아래' },
        { id: 'wreck', text: '난파선 옆', ok: true },
        { id: 'barrel', text: '나무통 위' },
        { id: 'rock', text: '바위 틈' },
      ],
    },
    figures: [
      { caption: '훑기 — 자리마다 영단어 라벨이 뜬다. 라벨이 붙은 물건은 그 단어와 무관하다.' },
      { caption: '회수 — 라벨이 잠겨 사라지고 그제야 뜻이 불린다. 화면에 정답 단서가 남지 않는다.', focus: ['wreck'], state: 'good', hudPct: 0.8 },
      { caption: '확정 — 언제든 미확정 점수를 챙긴다. 한 번 더 캐면 배수가 오르지만 틀리면 전부 잃는다.', focus: ['rock'], state: 'bad', hudPct: 0.32 },
    ],
    trial: {
      steps: [{ say: '“닻(anchor)” 라벨은 난파선 옆에 있었습니다. 그 자리를 짚어 보세요.', want: ['wreck'], hint: '배가 부서진 곳이었어요.' }],
      done: '회수한 자리도 잠긴 것과 똑같이 보입니다 — 화면이 후보를 지워 주지 않아요.',
    },
    facts: { input: '탭 · 3D 해변', run: '밀물 시계 · 잠수마다 확정 결정', record: FSRS },
  },

  // ── produce ───────────────────────────────────────────────────────
  'letter-forge': {
    slug: 'letter-forge',
    objective:
      '뜻만 주어진다. 흩어진 글자 조각을 순서대로 눌러 철자를 벼려 낸다. 고르는 게 아니라 만들어 내는 인출이다.',
    board: {
      kind: 'assemble',
      cols: 4,
      slots: 5,
      prompt: { label: '이 뜻의 철자를 벼린다', value: '용감한' },
      hud: { label: '열(熱)', pct: 0.6 },
      tokens: [
        { id: 'v', text: 'V', ok: true },
        { id: 'b', text: 'B', ok: true },
        { id: 'd', text: 'D' },
        { id: 'a', text: 'A', ok: true },
        { id: 'r', text: 'R', ok: true },
        { id: 'n', text: 'N' },
        { id: 'e', text: 'E', ok: true },
        { id: 'i', text: 'I' },
      ],
    },
    figures: [
      { caption: '빈 슬롯의 개수가 곧 길이다. 조각에는 정답에 없는 글자가 섞여 있다.', filled: 0 },
      { caption: '앞에서부터 채워 넣는다. 열이 오를수록 배수가 커진다.', filled: 3, hudPct: 0.78 },
      { caption: '다 채워 확정하면 벼림 성공. 힌트는 가장 왼쪽 빈칸 한 글자만 채우고, 사는 순간 콤보가 끊긴다.', filled: 5, state: 'good', hudPct: 0.9 },
    ],
    trial: {
      steps: [
        {
          say: '“용감한” 의 철자를 앞에서부터 눌러 완성하세요.',
          want: ['b', 'r', 'a', 'v', 'e'],
          ordered: true,
          hint: 'B로 시작하는 다섯 글자예요.',
        },
      ],
      done: '조립대는 발동 전까지 맞았는지 알려주지 않습니다 — 검증은 완성 뒤에만.',
    },
    facts: { input: '탭 · 키보드 입력', run: '문항마다 열이 오르고 창이 좁아진다', record: FSRS },
  },

  'wordsmith-vigil': {
    slug: 'wordsmith-vigil',
    objective:
      '뜻만 든 안개 정령이 촛불로 내려온다. 조준한 정령의 철자를 기억해 칸에 채워 넣어야 흩어진다 — 화면에 철자는 없고 칸 수만 보인다.',
    board: {
      kind: 'assemble',
      cols: 4,
      slots: 5,
      prompt: { label: '조준한 정령이 든 뜻', value: '지켜보다' },
      hud: { label: '촛불', pct: 0.5 },
      tokens: [
        { id: 'c', text: 'C', ok: true },
        { id: 'w', text: 'W', ok: true },
        { id: 'a', text: 'A', ok: true },
        { id: 's', text: 'S' },
        { id: 't', text: 'T', ok: true },
        { id: 'r', text: 'R' },
        { id: 'h', text: 'H', ok: true },
        { id: 'o', text: 'O' },
      ],
    },
    figures: [
      { caption: '정령은 뜻만 들고 내려온다. 조준해도 철자는 나오지 않고 칸 수만 열린다.', filled: 0 },
      { caption: '기억해서 채운 뒤 확정하면 정령이 흩어진다.', filled: 5, state: 'good', hudPct: 0.72 },
      { caption: '틀린 제출은 어느 글자가 맞았는지 알려주지 않고 낙하만 빨라진다 — 후보 나열이 손해.', filled: 2, state: 'bad', hudPct: 0.24 },
    ],
    trial: {
      steps: [
        {
          say: '실제로는 키보드로 칩니다. 여기서는 눌러서 “지켜보다” 의 철자를 채워 보세요.',
          want: ['w', 'a', 't', 'c', 'h'],
          ordered: true,
          hint: 'W로 시작하는 다섯 글자예요.',
        },
      ],
      done: 'Enter 로 지금 확정, Space 로 서약(배수 ×2~×4) — 서약은 정령이 절반 아래일 때만 걸립니다.',
    },
    facts: { input: '키보드 타이핑 · Enter 확정 · Space 서약', run: '3밤 + 새벽 피날레', record: FSRS },
  },

  morphmerge: {
    slug: 'morphmerge',
    objective:
      '한국어 뜻 하나가 문제다. 보드의 영어 형태 중 그 낱말의 형태를 전부 찾아 용광로에 합친다. 보드에 한국어는 한 글자도 없다.',
    board: {
      kind: 'group',
      cols: 4,
      prompt: { label: '이 낱말의 형태를 모두', value: '결정하다 · 3개' },
      hud: { label: '용광로', pct: 0.55 },
      tokens: [
        { id: 'divide', text: 'divide' },
        { id: 'decide', text: 'decide', ok: true },
        { id: 'declare', text: 'declare' },
        { id: 'decided', text: 'decided', ok: true },
        { id: 'divided', text: 'divided' },
        { id: 'decides', text: 'decides', ok: true },
        { id: 'deliver', text: 'deliver' },
        { id: 'decorate', text: 'decorate' },
      ],
    },
    figures: [
      { caption: '같은 크기의 라이벌 어간 묶음이 항상 함께 깔린다 — 어간 스캔만으로는 갈리지 않는다.' },
      { caption: '형태를 전부 모아 합치면 낱말이 완성된다. 개수는 알려주되 어느 것인지는 알려주지 않는다.', focus: ['decide', 'decided', 'decides'], state: 'good', hudPct: 0.85 },
      { caption: '부분 제출은 “탐색” 이 아니다 — 어족을 소모하고 시간을 깎는다. 다시 찔러볼 수 없다.', focus: ['divided'], state: 'bad', hudPct: 0.3 },
    ],
    trial: {
      steps: [
        {
          say: '“결정하다” 의 형태 3개를 모두 고른 뒤 확정하세요.',
          want: ['decide', 'decided', 'decides'],
          hint: 'divide(나누다) 묶음은 뜻이 다릅니다.',
        },
      ],
      done: '5낱말째부터는 원형이 보드에서 사라집니다 — 그때가 이 게임의 클라이맥스예요.',
    },
    facts: { input: '탭으로 여러 개 선택 → 확정', run: '용광로가 식기 전까지 · 넘기기는 콤보 동결', record: FSRS },
  },

  'morpheme-rules': {
    slug: 'morpheme-rules',
    objective:
      '형태소 블록을 조립해 봉인된 회랑을 연다. 조립대는 미리 판정해 주지 않는다 — 놓고 “발동” 해야 맞았는지 알 수 있다.',
    board: {
      kind: 'assemble',
      cols: 3,
      slots: 2,
      prompt: { label: '봉인이 요구하는 뜻', value: '미리 내다보다' },
      hud: { label: '봉인 시계', pct: 0.62 },
      tokens: [
        { id: 'sub', text: 'sub-' },
        { id: 'fore', text: 'fore-', ok: true },
        { id: 'pre', text: 'pre-' },
        { id: 'mit', text: 'mit' },
        { id: 'see', text: 'see', ok: true },
        { id: 'port', text: 'port' },
      ],
    },
    figures: [
      { caption: '장면만 서술된다. 형태소의 한국어 뜻은 비용을 치른 “해독” 뒤에만 보인다.', filled: 0 },
      { caption: '접두사 + 어근을 놓고 발동한다. 실재하는 단어여야 봉인이 열린다.', filled: 2, state: 'good', hudPct: 0.8 },
      { caption: '모든 시도가 시간과 콤보를 태운다. 시간을 버는 “확신 발동” 은 판당 3회뿐.', filled: 1, state: 'bad', hudPct: 0.28 },
    ],
    trial: {
      steps: [
        {
          say: '“미리 내다보다” 를 만들 블록을 순서대로 놓으세요.',
          want: ['fore', 'see'],
          ordered: true,
          hint: '“미리(fore-)” + “보다(see)”.',
        },
      ],
      done: 'foresee — 형태소의 뜻을 합치면 단어의 뜻이 나온다는 것이 이 회랑의 규칙입니다.',
    },
    facts: { input: '탭 · 키보드 단축키', run: '4 회랑 · 봉인마다 첫 시도만 기록', record: FSRS },
  },

  'silent-rule': {
    slug: 'silent-rule',
    objective:
      '규칙을 설명해 주지 않는다. 맞는 예와 틀린 예만 놓아 준다. 규칙을 스스로 귀납해 격자에서 맞는 칸만 골라 한 번에 제출한다.',
    board: {
      kind: 'group',
      cols: 3,
      prompt: { label: '증거가 말하는 규칙으로', value: '맞는 철자만 밝힌다' },
      evidence: {
        ok: ['happy → happier', 'heavy → heavier'],
        no: ['happy → happyer', 'heavy → heavyer'],
      },
      hud: { label: '등불', pct: 0.6 },
      tokens: [
        { id: 'lazier', text: 'lazier', ok: true },
        { id: 'lazyer', text: 'lazyer' },
        { id: 'tinier', text: 'tinier', ok: true },
        { id: 'tinyer', text: 'tinyer' },
        { id: 'busier', text: 'busier', ok: true },
        { id: 'busyer', text: 'busyer' },
      ],
    },
    figures: [
      { caption: '증거가 먼저 놓인다 — 맞는 예와 틀린 예. 규칙은 어디에도 적혀 있지 않다.' },
      { caption: '규칙을 세웠으면 격자에서 맞는 칸만 밝힌다.', focus: ['lazier', 'tinier', 'busier'], state: 'good', hudPct: 0.82 },
      { caption: '제출은 단 한 번. “몇 칸이 어긋났다” 같은 부분 정답 오라클이 없다.', focus: ['tinyer'], state: 'bad', hudPct: 0.34 },
    ],
    trial: {
      steps: [
        {
          say: '증거를 보고 규칙을 세운 뒤, 맞는 철자 3개를 고르세요.',
          want: ['lazier', 'tinier', 'busier'],
          hint: '자음 + y 로 끝나면 y 를 i 로 바꿉니다.',
        },
      ],
      done: '설명 대신 증거를 준 이유 — 스스로 세운 규칙이 설명 들은 규칙보다 오래 남습니다.',
    },
    facts: { input: '탭으로 칸 밝히기 → 제출 1회', run: '문 여러 개 · 하나의 시계가 관통', record: FSRS },
  },

  'wordfall-cadence': {
    slug: 'wordfall-cadence',
    objective:
      '철자는 한 글자도 보이지 않는다. 발음만 듣고 남은 박(beat) 안에 뜻을 짚는다. 근거는 귀로 들은 소리뿐이다.',
    board: {
      kind: 'pick',
      prompt: {
        label: '지금 들린 소리',
        value: '♪ ─ ♪ ─ ♪',
        kind: 'audio',
        note: '브리핑에서는 소리 대신 발음기호로 대신합니다 — /feɪnt/',
      },
      hud: { label: '남은 박', pct: 0.7 },
      tokens: [
        { id: 'faint', text: '희미한', ok: true },
        { id: 'fierce', text: '사나운' },
        { id: 'firm', text: '단단한' },
        { id: 'fine', text: '벌금' },
      ],
    },
    figures: [
      { caption: '3박 카운트인 뒤 단어가 발음된다. 화면에 철자는 없다.' },
      { caption: '박이 많이 남았을 때 답하면 ×3, 중간 ×2, 끝자락 ×1 — 지금 짚을지 한 박 더 곱씹을지.', focus: ['faint'], state: 'good', hudPct: 0.9 },
      { caption: '“다시 듣기” 는 공짜가 아니다. 1회차 −2박 ×½, 2회차 −3박 ×¼, 그 뒤 소진.', focus: ['fierce'], state: 'bad', hudPct: 0.25 },
    ],
    trial: {
      steps: [{ say: '/feɪnt/ 로 들렸습니다. 이 소리의 뜻을 고르세요.', want: ['faint'], hint: '빛이나 소리가 약할 때 쓰는 말이에요.' }],
      done: '악장(5문제)이 끝날 때마다 “종지 도박” 이 열립니다 — 방금 들은 3개를 순서대로 잇는 클라이맥스.',
    },
    facts: { input: '탭 · 소리 필수(이어폰 권장)', run: '악장 5문제 × 반복 · 종지 도박 3회', record: FSRS },
  },

  // ── reason ────────────────────────────────────────────────────────
  connections: {
    slug: 'connections',
    objective:
      '격자에는 한국어 뜻만 깔린다. 그룹을 잇는 규칙은 숨어 있는 영단어의 형태에 있다 — 뜻에서 영단어를 인출하지 못하면 규칙 자체가 보이지 않는다.',
    board: {
      kind: 'group',
      cols: 4,
      prompt: { label: '이번 격자의 규칙 종류', value: '같은 접두사' },
      hud: { label: '남은 확정 기회', pct: 0.75 },
      tokens: [
        { id: 'review', text: '재검토하다', ok: true },
        { id: 'gather', text: '모으다' },
        { id: 'repeat', text: '반복하다', ok: true },
        { id: 'scatter', text: '흩어지다' },
        { id: 'replace', text: '대체하다', ok: true },
        { id: 'endure', text: '견디다' },
        { id: 'revert', text: '되돌리다', ok: true },
        { id: 'submerge', text: '잠기다' },
      ],
    },
    figures: [
      { caption: '타일에는 뜻만 있다. 규칙의 “종류” 는 알려주지만 어느 칸인지는 알려주지 않는다.' },
      { caption: '같은 규칙의 4칸을 골라 확정한다. 먼저 찾을수록 선점 배수가 붙는다.', focus: ['review', 'repeat', 'replace', 'revert'], state: 'good', hudPct: 0.9 },
      { caption: '격자마다 침입자가 섞여 있어 “남은 4칸” 이 자동 정답이 되지 않는다.', focus: ['scatter'], state: 'bad', hudPct: 0.45 },
    ],
    trial: {
      steps: [
        {
          say: '규칙은 “같은 접두사”. 해당하는 4칸을 골라 보세요.',
          want: ['review', 'repeat', 'replace', 'revert'],
          hint: '영단어로 바꿔 보면 전부 re- 로 시작합니다.',
        },
      ],
      done: '뜻만 보고 영단어를 떠올려야 규칙이 보인다 — 그게 이 격자의 설계 의도예요.',
    },
    facts: { input: '탭으로 4칸 선택 → 확정', run: '격자 3판(풀 크기에 따라 조정)', record: FSRS },
  },

  'glyph-tongue': {
    slug: 'glyph-tongue',
    objective:
      '뜻을 알려주지 않는다. 영어 비문 속 룬이 무슨 뜻인지 문맥으로 추론해, 뜻 뱅크에서 짝을 찾아 봉인한다.',
    board: {
      kind: 'pick',
      prompt: {
        label: '비문의 룬',
        value: '⟒⍑⏃',
        kind: 'glyph',
        note: 'The river ⟒⍑⏃ the stones and the village drowned.',
      },
      hud: { label: '등불', pct: 0.55 },
      tokens: [
        { id: 'flee', text: '달아나다' },
        { id: 'swallow', text: '뒤덮다', ok: true },
        { id: 'carve', text: '새기다' },
        { id: 'echo', text: '메아리치다' },
      ],
    },
    figures: [
      { caption: '룬은 미지의 글자다. 근거는 옆에 놓인 영어 비문 하나뿐.' },
      { caption: '확신하는 하나만 봉인(안전)하거나, 여러 개를 한 번에 걸어 ×4 를 노린다.', focus: ['swallow'], state: 'good', hudPct: 0.8 },
      { caption: '뜻 뱅크에는 어떤 룬의 답도 아닌 미끼가 상주한다 — 마지막 룬도 공짜가 아니다.', focus: ['echo'], state: 'bad', hudPct: 0.25 },
    ],
    trial: {
      steps: [
        {
          say: '비문을 읽고 ⟒⍑⏃ 의 뜻을 골라 보세요.',
          want: ['swallow'],
          hint: '강이 돌을 ___ 하고 마을이 물에 잠겼다.',
        },
      ],
      done: '영어를 읽어야만 풀린다 — 그래서 이 게임은 뜻을 먼저 주지 않습니다.',
    },
    facts: { input: '탭 · 묶음 봉인 선택', run: '석실 여러 개 → 최종 봉인 26초', record: FSRS },
  },

  'word-customs': {
    slug: 'word-customs',
    objective:
      '단어가 입국 서류로 도착한다. 철자 · 품사 · 뜻 · 예문 네 축을 대조해 승인하거나 반송한다. 위조는 매 판 절차적으로 새로 만들어진다.',
    board: {
      kind: 'judge',
      prompt: { label: '도착한 서류', value: '입국 심사 · 3일차', kind: 'doc' },
      doc: [
        { label: '철자', value: 'recieve' },
        { label: '품사', value: 'verb' },
        { label: '뜻', value: '받다' },
        { label: '예문', value: 'She will recieve the parcel.' },
      ],
      hud: { label: '근무일 시계', pct: 0.5 },
      tokens: [
        { id: 'ok', text: '승인', sub: '네 축이 모두 맞다' },
        // 이 서류는 철자가 위조(recieve)이므로 반송이 정답이다.
        { id: 'no', text: '반송', sub: '한 축이라도 어긋난다', tone: 'danger', ok: true },
      ],
    },
    figures: [
      { caption: '네 축이 한 장에 온다. 어느 축이 위조인지는 표시되지 않는다.' },
      { caption: '하나라도 어긋나면 반송. 정확 판정은 +4초, 1초 뒤 자동으로 다음 줄이 온다.', focus: ['no'], state: 'good', hudPct: 0.7 },
      { caption: '오심은 −7초. 3회 쌓이면 교대가 해제된다. 미결도 정직하게 오답으로 남는다.', focus: ['ok'], state: 'bad', hudPct: 0.2 },
    ],
    trial: {
      steps: [
        {
          say: '이 서류, 통과시킬까요 반송할까요?',
          want: ['no'],
          hint: '철자를 다시 보세요 — i 와 e 의 순서.',
        },
      ],
      done: 'receive 가 맞습니다. 철자 위조는 진짜 철자에서 절차적으로 만들어져 매 판 달라져요.',
    },
    facts: { input: 'A 승인 / D 반송 / F 속결 · 탭', run: '근무일마다 줄 하나 · 오심 3회면 종료', record: FSRS },
  },

  'lexicon-hands': {
    slug: 'lexicon-hands',
    objective:
      '주문판에는 한국어 뜻만, 손패에는 영단어만 인쇄된다. 화면 어디에도 (영단어, 뜻) 쌍이 함께 놓이지 않는다 — 학습자가 올려놓은 가설만이 쌍을 이룬다.',
    board: {
      kind: 'group',
      cols: 3,
      prompt: { label: '이번 주문 (뜻)', value: '모으다 · 견디다' },
      hud: { label: '납기', pct: 0.6 },
      tokens: [
        { id: 'gather', text: 'gather', ok: true },
        { id: 'gaze', text: 'gaze' },
        { id: 'gamble', text: 'gamble' },
        { id: 'endure', text: 'endure', ok: true },
        { id: 'endorse', text: 'endorse' },
        { id: 'entrust', text: 'entrust' },
      ],
    },
    figures: [
      { caption: '주문(뜻)과 손패(영단어)가 따로 인쇄된다. 짝은 학습자만 알고 있다.' },
      { caption: '한 번에 여러 주문을 채울수록 묶음 배수가 커진다 — ×1 에서 ×7 까지.', focus: ['gather', 'endure'], state: 'good', hudPct: 0.85 },
      { caption: '한 장이라도 어긋나면 통째로 반려. 몇 장이 맞았는지는 알려주지 않는다.', focus: ['gaze'], state: 'bad', hudPct: 0.3 },
    ],
    trial: {
      steps: [
        {
          say: '주문은 “모으다”와 “견디다”. 손패에서 두 장을 골라 납품하세요.',
          want: ['gather', 'endure'],
          hint: 'g- 로 시작하는 한 장, en- 으로 시작하는 한 장.',
        },
      ],
      done: '크게 걸수록 크게 법니다. 대신 전부 아니면 전무예요.',
    },
    facts: { input: '탭으로 카드 선택 → 납품', run: '계약 3건 · 검수(목숨) 소진 시 파기', record: FSRS },
  },

  'lexicon-detective': {
    slug: 'lexicon-detective',
    objective:
      '국문 조서 한 줄과 영문 수첩 봉투들을 대조한다. 어느 봉투와도 맞지 않는 진술은 위증이므로 기각한다 — 위증의 개수는 공개되지 않는다.',
    board: {
      kind: 'pick',
      cols: 2,
      prompt: { label: '조서 진술', value: '그는 값을 깎아 달라고 졸랐다' },
      hud: { label: '보존도', pct: 0.65 },
      tokens: [
        { id: 'haggle', text: 'haggle', sub: '개봉됨', ok: true },
        { id: 'hoist', text: 'hoist', sub: '개봉됨' },
        { id: 'sealed', text: '봉투 4', sub: '미개봉 · 동사 · 6글자' },
        { id: 'reject', text: '기각 (위증)', sub: '어느 봉투와도 맞지 않는다', tone: 'danger' },
      ],
    },
    figures: [
      { caption: '봉투를 열면 영단어가 드러나지만 보존도가 깎인다 — 무엇을 열지가 곧 선택이다.' },
      { caption: '진술과 봉투를 맞춰 확정하면 연쇄 배수가 오른다.', focus: ['haggle'], state: 'good', hudPct: 0.8 },
      { caption: '미개봉 봉투에는 약한 단서(품사 · 글자 수)만 인쇄된다. 뜻은 새지 않는다.', focus: ['sealed'], state: 'idle' },
    ],
    trial: {
      steps: [
        {
          say: '이 진술과 맞는 봉투를 고르세요. 없다면 기각입니다.',
          want: ['haggle'],
          hint: '값을 깎으려 흥정하는 것 — h 로 시작합니다.',
        },
      ],
      done: '심증(목숨)이 다하면 사건은 미제로 종결되고, 그때 정답이 전부 공개됩니다.',
    },
    facts: { input: '탭 · 봉투 개봉 선택', run: '사건 3건 · 전면 재구성은 사건당 1회', record: FSRS },
  },

  'lexicon-estate': {
    slug: 'lexicon-estate',
    objective:
      '영단어만 적힌 방 카드를 뽑고, 그 뜻을 인출해 맞혀야 자재(양식)가 드러난다. 같은 양식끼리 상하좌우로 붙이면 복도가 이어지고 점수가 붙는다.',
    board: {
      kind: 'pick',
      prompt: { label: '감정 — 이 방 카드의 뜻은', value: 'threshold' },
      hud: { label: '층 예산', pct: 0.58 },
      tokens: [
        { id: 'ceiling', text: '천장' },
        { id: 'threshold', text: '문턱', ok: true },
        { id: 'pillar', text: '기둥' },
        { id: 'rail', text: '난간' },
      ],
    },
    figures: [
      { caption: '드래프트에서 영단어만 적힌 방 카드를 고른다. 뜻은 아직 없다.' },
      { caption: '감정 — 뜻을 맞혀야 자재가 드러나고 방을 지을 수 있다.', focus: ['threshold'], state: 'good', hudPct: 0.76 },
      { caption: '감정을 건너뛰면 그 방의 뜻은 끝 화면에서야 공개된다. 스킵에는 시간 비용이 붙는다.', focus: ['pillar'], state: 'bad', hudPct: 0.3 },
    ],
    trial: {
      steps: [{ say: 'threshold 의 뜻을 고르세요.', want: ['threshold'], hint: '문을 넘어설 때 밟는 곳.' }],
      done: '맞혔으니 자재가 드러났습니다 — 이제 같은 양식 방 옆에 붙이면 복도가 이어져요.',
    },
    facts: { input: '탭 · 카드 선택 → 감정 → 배치', run: '층별 예산 시계 · 3층(풀 크기에 따라 조정)', record: FSRS },
  },

  'word-orrery': {
    slug: 'word-orrery',
    objective:
      '탐사 구간에는 시계가 없다. 성좌에서 영어 신호를 받아 뜻을 골라 이름을 붙인다. 정해진 수만큼 읽으면 핵에 들어갈 수 있지만, 들어서면 문이 닫히고 카운트다운이 시작된다.',
    board: {
      kind: 'pick',
      prompt: { label: '성좌가 보낸 신호', value: 'dwindle' },
      hud: { label: '읽어낸 성좌', pct: 0.45 },
      tokens: [
        { id: 'wander', text: '떠돌다' },
        { id: 'dwindle', text: '점점 줄다', ok: true },
        { id: 'tangle', text: '뒤엉키다' },
        { id: 'surge', text: '솟구치다' },
      ],
    },
    figures: [
      { caption: '탐사는 무시간 · Calm 구간이다. 맞히든 틀리든 답을 보여주고 성좌가 이름을 얻는다.' },
      { caption: '충분히 읽으면 핵이 열린다. 몇 성좌를 어둠에 남기면 미관측 배수를 노릴 수 있다.', focus: ['dwindle'], state: 'good', hudPct: 0.72 },
      { caption: '핵의 봉인은 4지 → 6지 → 각인(철자 조립) 으로 조여든다. 각인은 애너그램이 아니다.', focus: ['surge'], state: 'bad', hudPct: 0.5 },
    ],
    trial: {
      steps: [{ say: '신호는 dwindle. 이 성좌의 뜻을 고르세요.', want: ['dwindle'], hint: '조금씩 작아지는 것.' }],
      done: '전부 읽고 안전하게 들어갈지, 어둠을 남기고 배수를 노릴지 — 두 경로의 기대 점수는 6% 이내로 맞춰져 있습니다.',
    },
    facts: { input: '탭 · 각인은 철자 조립', run: '탐사(무시간) → 핵(카운트다운)', record: FSRS },
  },
}

/** 브리핑이 있는가 — 카탈로그에 게임을 추가하고 브리핑을 빠뜨리면 UI 가 조용히 비지 않도록. */
export function hasBrief(slug: GameSlug): boolean {
  return Boolean(GAME_BRIEFS[slug])
}

/** 트라이얼 전체 스텝 수 — 진행 점 표시에 쓴다. */
export function trialLength(slug: GameSlug): number {
  return GAME_BRIEFS[slug]?.trial.steps.length ?? 0
}

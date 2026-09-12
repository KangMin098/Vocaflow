// apps/web/src/lib/game/brief/types.ts
//
// 게임 브리핑 스키마 — 아케이드 19종의 "이 게임은 무엇을 시키는가"를 **보드 그림**으로 설명한다.
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
//   ④ **그 게임에만 맞아야 한다.** 19종 전부에 붙여도 맞는 설명은 정확하지만 아무것도
//      구별해 주지 못한다. 각 게임에는 다른 18종에서는 내리지 않는 **고유 결정**이 있고
//      (어느 라인에 걸까 · 얼마를 걸까 · 어느 규칙이 참일까 · 승인이냐 반송이냐),
//      `trial` 은 **그 결정을 눌러 보게** 해야 한다. "뜻 고르기" 한 스텝은 19종 공통이라
//      cascade 의 튜토리얼을 19번 복사한 것과 같다. (v08.4 전수 평가에서 실측: 평균
//      9.6/20 · 결정 축 1.11/4 — 계열 안에서 trial 을 서로 바꿔 끼워도 통과했다.)
//
// 상호작용 아키타입은 5개다. 19종의 표면은 다 다르지만 **학습자가 하는 손동작**은
// 다섯 가지로 수렴한다 — 고른다 / 여러 개 고른다 / 순서대로 조립한다 / 판정한다 / 직접 친다.
// 아키타입을 늘리는 대신 이 다섯을 정확하게 만들면, 브리핑끼리 조작이 일관돼
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
 *  · type     — 후보가 없다. 칸 수만 보이는 상태에서 철자를 직접 친다.
 *
 * `type` 을 뒤늦게 추가한 이유: wordsmith-vigil · ghost-race 아웃코스 · silent-rule 봉인은
 * 손동작이 타이핑인데 pick/assemble 로 적어 두어 **잘못된 근육을 가르치고 있었다**
 * (v08.4 평가에서 motion 0점). 없는 아키타입은 거짓으로 메울 수밖에 없다.
 */
export type BriefKind = 'pick' | 'group' | 'assemble' | 'judge' | 'type'

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
  /**
   * 격자 좌표 [행, 열] — 위치 자체가 결정인 게임(cascade 의 "가장 낮은 장 / 돌 옆 /
   * 뭉친 장", lexicon-estate 의 도면 인접)에만 쓴다. 하나라도 `at` 이 있으면 보드 전체가
   * 좌표 격자로 그려지고 `cols` 는 무시된다. 순서 없는 플랫 격자로는 "낮은 줄"·"이웃"이
   * 표현되지 않아 공간 과제가 목록 고르기로 바뀐다.
   */
  at?: [row: number, col: number]
  /**
   * 이 타일을 누르면 실제로 무엇을 지출/획득하는가.
   * 탁본 −등불 12초 · 봉투 개봉 −보존도 1 · 다시 듣기 −2박처럼 **비용을 내고 정보를 사는**
   * 타일이 여럿인데, 지출이 게이지 변화로 보이지 않으면 학습자는 그것을 실수로 읽는다.
   * `gauge` 는 `board.hud` 배열의 인덱스(기본 0), `delta` 는 pct(막대) 또는 핍 개수.
   */
  effect?: { gauge?: number; delta?: number; badge?: string }
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

/**
 * 판돈 결정 — **정답 타일과 같은 격자에 두면 안 되는 선택**.
 *
 * "인코스냐 아웃코스냐" · "확정 +100 이냐 한 번 더 ×1.6 이냐" 는 답이 아니라 결정이고,
 * 두 경로의 손익을 **나란히 놓고 비교**해야 결정이 성립한다. 타일 `sub` 한 줄로는
 * 두 경로를 대비할 수 없어서, 지금까지 이 게임들의 고유 결정이 캡션 산문으로 새어 나갔다.
 *
 * 격자 밖 별도 줄에 카드로 그린다. id 공간은 토큰과 공유하므로 `trial.want` 에 그대로 쓴다.
 */
export interface BriefChoice {
  id: string
  /** 카드 제목 — 게임이 쓰는 이름 그대로 ('인코스' · '승부' · '한 번 더') */
  label: string
  /** 손익 줄 — 수치를 나란히 놓는다. 2~3줄. */
  lines: string[]
  tone?: 'plain' | 'danger' | 'quiet'
  from?: number
  /** 이 결정이 "권장"인가 — figure 성공 상태를 칠할 때만 쓴다. 정답이라는 뜻이 아니다. */
  ok?: boolean
}

/**
 * 압력 게이지 하나. 이 계열 게임들은 압력이 **거의 항상 둘 이상**이다
 * (connections = 시계 + 기회 4핍 · cascade = 이 뜻의 시간 + 물방울 3 + 만조 2).
 * 단일 막대만 허용하던 동안 브리핑마다 판돈의 절반이 지워졌고, 작성자가 없는 게이지
 * 이름('물길' · '등불')을 만들어 메웠다.
 */
export interface BriefGauge {
  /** 게임 화면에 실제로 쓰인 라벨만. 산문 주석에만 있는 이름은 쓰지 않는다. */
  label: string
  /** 연속 막대 — 0~1 */
  pct?: number
  /** 셀 수 있는 예산(목숨 · 촛불 · 기회) — 막대 대신 핍으로 그린다 */
  pips?: { total: number; left: number }
  /** 라벨 옆 숫자 값 — '17/20' · '🪙14' 처럼 게임이 숫자로 찍는 것 */
  value?: string
}

/** figure·trial 에서 게이지 상태를 덮어쓴다. 인덱스는 `board.hud` 배열과 정렬. */
export interface BriefGaugeState {
  pct?: number
  left?: number
  value?: string
}

export interface BriefBoard {
  kind: BriefKind
  prompt?: BriefPrompt
  /** assemble · type — 채워야 할 슬롯 수 */
  slots?: number
  /** judge — 서류의 축들 */
  doc?: { label: string; value: string }[]
  /**
   * judge — 서류 맨 위에 단독으로 큰 글씨로 찍히는 표제(word-customs 의 철자).
   * doc 행으로 눕히면 "먼저 읽는 것"이라는 위계가 사라진다.
   */
  headword?: string
  /** 귀납형 게임의 증거 줄 (silent-rule) */
  evidence?: {
    ok: string[]
    /** 어긋난 예 — `fix` 가 있으면 취소선 + 올바른 철자를 함께 보인다 */
    no: (string | { text: string; fix?: string })[]
  }
  /**
   * 게임 고유의 압력 게이지. 하나면 객체, 둘 이상이면 배열.
   * 배열 첫 항목이 `figure.hudPct` 의 대상이다(레거시 호환).
   */
  hud?: BriefGauge | BriefGauge[]
  /** 판돈 결정 줄 — 격자 밖. 답이 아니라 결정임을 형태로 구별한다. */
  choices?: BriefChoice[]
  tokens: BriefToken[]
  /** 타일 격자 열 수 (기본 2). 토큰에 `at` 이 있으면 무시된다. */
  cols?: 2 | 3 | 4
}

/** 한 스텝/프레임에서 갈아 끼우는 표면 — 국면이 바뀌는 게임을 위해. */
export interface BriefSurface {
  /**
   * 프롬프트 교체. word-customs 는 D 를 누른 순간 "어느 항목이 위조입니까?"로 화면이
   * 바뀌고, morphmerge 는 2라운드째에 모르는 낱말이 온다. 판 전체에 프롬프트가 하나뿐이면
   * 그 전환을 말로만 알릴 수 있다.
   */
  prompt?: Partial<BriefPrompt>
  doc?: { label: string; value: string }[]
  headword?: string
  /** 게이지 상태 — 인덱스가 `board.hud` 배열과 정렬. */
  hud?: (BriefGaugeState | null)[]
}

export interface BriefFigure extends BriefSurface {
  /** 이 순간을 설명하는 한 줄. 그림이 주고 글은 거든다 — 짧게. */
  caption: string
  /** 강조할 토큰 · 결정 카드 */
  focus?: string[]
  /** 강조의 의미 — 중립/성공/실패 */
  state?: 'idle' | 'good' | 'bad'
  /** 첫 게이지(막대) 위치 override — `hud[0].pct` 의 축약형 */
  hudPct?: number
  /** assemble · type — 채워진 슬롯 수 */
  filled?: number
  /** assemble · type — 슬롯에 미리 보일 정답. 없으면 `trial` 의 조립 스텝에서 가져온다. */
  answer?: string[]
}

export interface BriefTrialStep extends BriefSurface {
  /** 학습자에게 주는 지시 한 줄 */
  say: string
  /** 눌러야 하는 토큰 · 결정 카드 id */
  want: string[]
  /** 순서까지 맞아야 하는가 (assemble) */
  ordered?: boolean
  /** 두 번 틀리면 열리는 힌트 */
  hint?: string
  /**
   * 타이핑 스텝 — 후보를 누르는 게 아니라 직접 친다.
   * `want` 는 비워 둔다(누를 것이 없다). 대소문자·공백은 무시하고 대조한다.
   */
  type?: { answer: string; label?: string }
  /** 이 스텝이 assemble 슬롯을 채우는 스텝인가. 조립 앞에 결정 스텝을 둘 때 필요하다. */
  fillsSlots?: boolean
}

export interface GameBrief {
  slug: GameSlug
  /** 한 문단 — "이 게임에서 학습자가 하는 일". 다른 18종에 붙여도 맞는 문장은 실패다. */
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
export const FSRS = '내 단어면 기억 곡선(FSRS)에 반영 · 힌트로 산 정답은 제외'

// ── 파생 헬퍼 ────────────────────────────────────────────────────────

/** `board.hud` 를 항상 배열로 — 렌더러·테스트가 분기하지 않도록. */
export function gaugesOf(board: BriefBoard): BriefGauge[] {
  if (!board.hud) return []
  return Array.isArray(board.hud) ? board.hud : [board.hud]
}

/** 누를 수 있는 것 전부 — 토큰 + 결정 카드. `want` 검증의 단일 출처. */
export function pressablesOf(board: BriefBoard): { id: string; from: number; ok?: boolean }[] {
  return [
    ...board.tokens.map((t) => ({ id: t.id, from: t.from ?? 0, ok: t.ok })),
    ...(board.choices ?? []).map((c) => ({ id: c.id, from: c.from ?? 0, ok: c.ok })),
  ]
}

/** 슬롯을 채우는 스텝 — 명시가 없으면 첫 ordered 스텝, 그것도 없으면 0번. */
export function slotStepOf(brief: GameBrief): BriefTrialStep | undefined {
  const steps = brief.trial.steps
  return steps.find((s) => s.fillsSlots) ?? steps.find((s) => s.ordered) ?? steps[0]
}

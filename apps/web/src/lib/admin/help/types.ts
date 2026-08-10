// apps/web/src/lib/admin/help/types.ts
//
// 관리자 화면도움말 — 데이터 스키마.
//
// 왜 자유 텍스트가 아니라 구조인가:
//   파이프라인 화면은 관리자마다 "무엇을 누르면 무슨 일이 벌어지는지"를 묻는 지점이 같다.
//   자유 서술로 두면 화면마다 길이·순서·용어가 제각각이 되어 훑어볼 수 없다.
//   구조를 고정하면 렌더가 한 곳이라 **어느 화면에서든 같은 자리에서 같은 것을 읽는다**.
//
// 작성 원칙:
//   · summary 는 화면을 처음 여는 사람이 3초 안에 "여기서 뭘 하는 곳인지" 알게 한다.
//   · 화면에 이미 쓰여 있는 라벨을 반복하지 않는다 — 도움말은 **라벨이 말하지 않는 것**
//     (순서 · 전제 · 되돌릴 수 있는지 · 실패하면 어떻게 되는지)을 말한다.
//   · steps 는 실제로 순서가 있는 화면에만. 순서가 없으면 fields 로 충분하다.
//   · caution 은 "실제로 사고가 났거나 날 수 있는 것"만. 일반론은 노이즈다.

/** 순서가 있는 작업 — 파이프라인 화면의 핵심. */
export interface HelpStep {
  /** 짧은 동사구 — "소스에서 GET" */
  title: string
  /** 무엇을 누르고 무슨 일이 벌어지는가. 한두 문장. */
  detail: string
  /** 이 단계가 끝났음을 화면에서 어떻게 아는가(상태 배지·카운트 등). */
  done?: string
}

/** 화면의 주요 버튼·지표가 실제로 무엇을 뜻하는가. */
export interface HelpField {
  label: string
  detail: string
}

/**
 * Claude Code 드레인이 포함된 화면 전용 절차.
 *
 * 드레인은 "버튼을 누르면 끝"이 아니라 **관리자가 Claude Code 를 직접 돌려 큐를 비우는**
 * 반자동 작업이다. 화면만 봐서는 다음에 무엇을 해야 하는지 알 수 없어서 따로 둔다.
 */
export interface HelpDrain {
  /** 이 화면의 드레인이 만들어 내는 산출물 한 줄. */
  what: string
  /** 시작 전에 충족돼야 하는 것(큐에 항목이 있는가 · 앞 단계가 끝났는가). */
  prerequisites: string[]
  /** 실제 절차. 관리자가 그대로 따라 할 수 있어야 한다. */
  procedure: HelpStep[]
  /** 끝났는지 확인하는 법 — 화면 어디의 무슨 수치를 보는가. */
  verify: string[]
  /** 멈췄을 때·실패했을 때 어떻게 하는가. */
  recovery?: string[]
}

export interface ScreenHelp {
  /** 이 화면이 무엇을 하는 곳인가 — 한 문장. */
  summary: string
  /** 언제 이 화면에 오는가(선행 화면·트리거). 없으면 생략. */
  when?: string
  /** 순서가 있는 작업. */
  steps?: HelpStep[]
  /** 버튼·지표 뜻. */
  fields?: HelpField[]
  /** 실제로 사고가 나는 지점만. */
  cautions?: string[]
  /** Claude Code 드레인 절차(해당 화면만). */
  drain?: HelpDrain
  /** 더 읽을 것 — docs 경로나 이어지는 화면. */
  seeAlso?: { label: string; href: string }[]
}

/**
 * 화면 하나의 도움말. 탭이 있으면 탭별로 나눈다.
 * `screen` 은 탭 공통(그 화면 전체의 목적), `tabs[key]` 는 그 탭에서만 하는 일.
 */
export interface ScreenHelpEntry {
  /** 화면 제목 — 패널 헤더에 쓴다. */
  title: string
  screen: ScreenHelp
  /** 탭 라벨(화면에 보이는 그대로) → 그 탭의 도움말. */
  tabs?: Record<string, ScreenHelp>
}

export type HelpRegistry = Record<string, ScreenHelpEntry>

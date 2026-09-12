// apps/web/src/lib/framework/memory-labels.ts
//
// 기억 4상태의 **학습자용 이름 — 여기서만 정한다.**
//
// ── 왜 만들었나 (실측 2026-08-15) ─────────────────────────────────────
// 같은 네 상태를 화면마다 다르게 부르고 있었다. 다섯 벌이었다:
//
// | 상태   | MemoryStatus | TodayQueue | DecayDistribution | VaultBar | VaultIdentity |
// |--------|--------------|------------|-------------------|----------|---------------|
// | stable | 안정         | 안정       | 안정              | 안정     | **확실**      |
// | shaky  | 흔들림       | 흔들림     | 흔들림            | 흔들림   | **익숙**      |
// | risk   | 위급         | **흐릿함** | 위급              | 위급     | **회복**      |
// | new    | **새 단어**  | **새 단어**| 신규              | 신규     | 신규          |
//
// **`/wordvault` 한 화면 안에서 두 어휘가 동시에 떠 있었다** — 히어로 카드는 "확실·익숙·회복",
// 같은 페이지 아래 섹션들은 "안정·흔들림·위급". 학습자는 그게 같은 네 칸인지 알 수 없다.
// 특히 `shaky → '익숙'` 은 방향이 반대다(흔들리는데 "익숙하다" 고 읽힌다).
//
// 이것은 `lib/framework/axes.ts` 가 표면·축 이름에 대해, `lib/learner/plan-activities.ts` 가
// 활동 이름에 대해 이미 세운 규칙(apps/web/CLAUDE.md §"학습자가 읽는 이름 — 화면에서 짓지
// 말 것")이 기억 상태에는 적용되지 않고 있었던 것이다.
//
// ── 이름을 이렇게 고른 이유 ───────────────────────────────────────────
// **안정 → 흔들림 → 흐릿함** 은 한 축(선명도)을 따라 내려가는 한 벌의 말이다.
// 다수결로는 risk 가 `위급`(5곳 중 3곳)이지만 쓰지 않는다 — 응급실 말투는 이 프로젝트가
// 금지한 압박 표현이고(§디자인철학3 Empathetic Feedback · §절대금지 "정답률 빨간 글씨 압박"),
// 무엇보다 `안정·흔들림·위급` 은 앞 둘과 다른 세계의 단어라 한 벌로 읽히지 않는다.
// `회복`(VaultIdentity)은 상태가 아니라 **할 일**이라 4칸 라벨로는 맞지 않는다 —
// 그건 CTA 문구(`지금 다시 만나기`)가 이미 하고 있다.
// new 는 `신규`(행정 말투) 대신 `새 단어` — 학습자가 읽는 문장은 사람의 말투를 쓴다.
//
// 색은 여기서 정하지 않는다. `--memory-*` 토큰이 소유한다(CLAUDE.md §Memory Decay 4색).
// 상태 판정도 여기서 하지 않는다 — R(t) 동적 계산이며 `memory_state` 컬럼은 금지다.

import type { MemoryState } from '@/lib/srs/types'

export interface MemoryLabel {
  /** 칩·범례에 쓰는 짧은 이름 */
  label: string
  /** 사람의 말투 한 줄 — 툴팁·설명 자리 */
  says: string
  /** 이 상태의 색 토큰 (하드코딩 금지) */
  token: string
}

export const MEMORY_LABEL: Record<MemoryState, MemoryLabel> = {
  stable: { label: '안정', says: '잘 기억해요', token: '--memory-stable' },
  shaky: { label: '흔들림', says: '가끔 헷갈려요', token: '--memory-shaky' },
  risk: { label: '흐릿함', says: '곧 잊을 수 있어요', token: '--memory-risk' },
  new: { label: '새 단어', says: '처음 만나요', token: '--memory-new' },
}

/** 화면에 세울 때의 순서 — 선명한 것에서 흐린 것으로, 새 단어는 끝. */
export const MEMORY_ORDER: MemoryState[] = ['stable', 'shaky', 'risk', 'new']

/**
 * `shaky + risk` 합계의 이름 — **네 상태 중 하나가 아니다.**
 *
 * 실측 2026-08-16: 상단 리본이 이 합계를 `흔들림` 이라 부르고 있었다. 그런데 레지스트리에서
 * 흔들림은 `shaky` **하나**를 가리킨다. 그래서 학습자는 한 세션 안에서 같은 단어의 두 수를
 * 본다 — 리본 "흔들림 135" · WordVault "흔들림 20". 집계에 구성 요소의 이름을 붙이면
 * 반드시 이렇게 어긋난다.
 *
 * 그래서 집계에는 **행동의 이름**을 준다. 상태가 아니라 "지금 손이 필요한 만큼" 이고,
 * WordVault 의 CTA(`지금 다시 만나기`)와 같은 말을 쓴다.
 */
export const MEMORY_ATTENTION_LABEL = '다시 볼'

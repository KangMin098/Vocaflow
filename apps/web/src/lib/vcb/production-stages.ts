// apps/web/src/lib/vcb/production-stages.ts
//
// **제작 단계 — 발행 뒤에도 책이 되기까지 남는 일들.**
//
// ── 왜 필요한가 (실측 2026-09-07) ───────────────────────────────────
// 8-step run 은 화면에서 진행이 보인다(`VcbRunProgress` — 7국면 · 다음 한 걸음). 그런데
// **발행 이후의 제작 단계는 어디에도 안 보였다.** 조판·브랜드 각인·판권 각인·표지·설명은
// 전부 Claude Code 드레인으로 도는데, 어느 권이 어디까지 됐는지 아는 방법이 로컬 파일과
// SQL 뿐이었다. 이 저장소가 반복해서 지적받은 형태다("산출물은 Admin 모니터에서 보이게").
//
// ── 단계는 사용자와 Claude Code 가 **교대한다** ─────────────────────
// 사용자가 발행하면 Claude Code 가 각인하고, 사용자가 규격을 정하면 Claude Code 가 적재한다.
// 그래서 단계마다 **누가 할 차례인가**(`actor`)를 적는다 — 화면이 "지금 내 차례인가" 를
// 먼저 답해야 관리자가 콘솔을 닫지 않는다.
//
// ── 완료 판정은 DB 에서만 ───────────────────────────────────────────
// 각 단계의 `done` 은 **세트 행을 보고** 판정한다. 로컬 파일(청크·아웃풋)은 보지 않는다 —
// 다른 기계에서 돌린 드레인은 파일이 없고, 파일이 있어도 적재됐다는 뜻이 아니다.

/** 이 단계를 누가 하는가. */
export type StageActor = 'user' | 'claude-code'

export interface ProductionStage {
  id: string
  label: string
  actor: StageActor
  /** 이 단계가 무엇을 남기나 — 라벨이 말하지 않는 것만 적는다. */
  says: string
  /** 아직인 권이 있을 때 무엇을 하면 되는가. 명령이면 그대로 붙여넣을 수 있어야 한다. */
  next: string
  /** 세트 한 행을 보고 완료를 판정한다. */
  done: (set: ProductionSetRow) => boolean
}

/** 판정에 필요한 최소 열. 넓히면 화면이 느려지므로 쓰는 것만 받는다. */
export interface ProductionSetRow {
  id: string
  title: string
  slug: string | null
  wordCount: number
  curationQuery: {
    blueprint?: string
    recipe?: unknown
    brand?: { family?: string }
    qa?: { checked?: number; passed?: number }
    level?: { median?: number }
  } | null
}

/**
 * 단계 목록 — **순서가 곧 제작 순서**다.
 *
 * 표지·지면·설명은 여기 없다: 그 셋은 **요청 시 코드가 그린다**(`cover-art` · `typeset` ·
 * `book-guide`). 각인이 필요 없으므로 "아직인 권" 이라는 개념 자체가 없고, 단계로 두면
 * 늘 100% 인 줄이 셋 늘어 콘솔이 실제 할 일을 가린다.
 */
export const PRODUCTION_STAGES: ProductionStage[] = [
  {
    id: 'publish',
    label: '발행',
    actor: 'user',
    says: '컴포저나 8-step run 이 세트를 만들어 카탈로그에 올린다.',
    next: '/admin/vocab/studio 에서 유형을 골라 조립하거나, run 을 8단계까지 진행한다.',
    done: () => true, // 이 목록의 모집단이 이미 "발행된 것" 이다
  },
  {
    id: 'slug',
    label: '슬러그',
    actor: 'user',
    says: '판권 번호와 표지 도판의 열쇠. 없으면 인용도 못 하고 표지가 제목에 매인다.',
    next: '슬러그 없이 발행된 세트를 Studio 에서 같은 유형·같은 슬러그로 다시 발행한다.',
    done: (s) => !!s.slug,
  },
  {
    id: 'recipe',
    label: '레시피',
    actor: 'claude-code',
    says: '무엇으로 뽑았는지가 세트에 남아야 같은 기준으로 다시 뽑을 수 있다.',
    next: 'Studio 에서 재조립하면 레시피가 함께 저장된다(레거시 세트만 비어 있다).',
    done: (s) => !!s.curationQuery?.recipe,
  },
  {
    id: 'blueprint',
    label: '묶음 원리',
    actor: 'claude-code',
    says: '지면 머리와 판권면의 「표제어 선정」 줄이 여기서 나온다.',
    next: 'Studio 재조립. 유형 없이 만들어진 레거시 세트는 원리 줄이 비어 나간다.',
    done: (s) => !!s.curationQuery?.blueprint,
  },
  {
    id: 'imprint',
    label: '판권 각인',
    actor: 'claude-code',
    says: '자동 검수 수치와 표제어 난이도 실측. 없으면 판권면이 그 줄을 뺀다(0/0 은 안 적는다).',
    next: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/vocab/stamp-imprint.mts --commit',
    done: (s) => (s.curationQuery?.qa?.checked ?? 0) > 0 && !!s.curationQuery?.level,
  },
  {
    id: 'brand',
    label: '브랜드 각인',
    actor: 'claude-code',
    says: '계열 표지 규격. 표지가 이 값으로 계열을 정한다 — 없으면 목록 계열로 떨어진다.',
    next: 'brand-drain-export → artboards → Claude Design 캔버스 → brand-drain-import --commit',
    done: (s) => !!s.curationQuery?.brand?.family,
  },
]

export interface StageStatus {
  id: string
  label: string
  actor: StageActor
  says: string
  next: string
  doneCount: number
  total: number
  /** 아직인 권 — 이름을 보여야 관리자가 무엇을 고칠지 안다. 너무 많으면 잘라 센다. */
  pending: string[]
  pendingMore: number
}

const PENDING_SHOWN = 6

export function computeStageStatus(sets: ProductionSetRow[]): StageStatus[] {
  return PRODUCTION_STAGES.map((stage) => {
    const pendingSets = sets.filter((s) => !stage.done(s))
    return {
      id: stage.id,
      label: stage.label,
      actor: stage.actor,
      says: stage.says,
      next: stage.next,
      doneCount: sets.length - pendingSets.length,
      total: sets.length,
      pending: pendingSets.slice(0, PENDING_SHOWN).map((s) => s.title),
      pendingMore: Math.max(0, pendingSets.length - PENDING_SHOWN),
    }
  })
}

/**
 * **지금 누구 차례인가.** 아직인 단계 중 첫 번째가 그 답이다.
 *
 * 전부 끝났으면 `null` — 그때 화면은 "할 일 없음" 을 말해야지 아무 단계나 강조하면 안 된다.
 */
export function currentStage(status: StageStatus[]): StageStatus | null {
  return status.find((s) => s.doneCount < s.total) ?? null
}

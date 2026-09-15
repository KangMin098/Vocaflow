// apps/web/src/lib/textbook/production-stages.ts
//
// **교재 제작 단계 — 권마다 어디까지 왔고 지금 누구 차례인가.**
//
// ── 왜 필요한가 (실측 2026-09-07) ───────────────────────────────────
// 교재 파이프라인에는 상업 출판 8단계 대응표가 이미 있다
// (`packages/library-pipeline/src/textbook/production-stages.ts`). 그런데 그 표를 읽는 것은
// **스크립트뿐**이고 화면이 하나도 없었다 — grep 으로 확인한 소비처가 전부 `scripts/` 다.
// 단어장(VCB)에는 같은 성격의 콘솔이 있는데(`VcbProductionPanel`) 교재에는 없었다.
//
// 게다가 그 표의 진행률은 **코드에 박힌 산문**이다("2026-08-30 실측 13,814/17,206 = 80.3%").
// 날짜가 박힌 문장은 그날 이후로 계속 틀린다. 이 파일은 그것을 대신하지 않는다 —
// 그 표는 *상업 절차와의 대응*을 적는 자리로 두고, 여기서는 **지금 값**을 잰다.
//
// ── 단계는 사용자와 Claude Code 가 교대한다 ─────────────────────────
// 재고는 스크립트가 채우고, 해설은 Claude Code 드레인이 쓰고, 펼칠지는 사람이 정한다.
// 그래서 단계마다 **누가 할 차례인가**(`actor`)를 적는다 — 콘솔이 먼저 답해야 하는 질문이
// "지금 내 차례인가" 이기 때문이다(VCB 콘솔이 같은 이유로 그렇게 만들어졌다).
//
// ── 판정은 실측값에서만 ─────────────────────────────────────────────
// 완료 판정은 `ShelfVolume` 한 행을 보고 한다 — 그 행은 `fetchTextbookShelf()` 가 DB 에서
// 센 것이다. 로컬 파일(청크·아웃풋)은 보지 않는다: 다른 기계에서 돌린 드레인은 파일이 없고,
// 파일이 있어도 적재됐다는 뜻이 아니다.
//
// ⚠️ **"못 쟀다" 를 "0" 으로 적지 않는다.** `explainedCount` 는 `null` 일 수 있고, 그때는
//    완료도 미완료도 아니라 **판정 불가**다. 이 구별은 매대(`shelf.ts`)가 세운 규칙이고
//    여기서도 그대로 지킨다 — 못 잰 것을 미완료로 세면 관리자가 없는 일을 하러 간다.

import type { ShelfVolume } from './shelf'
import { contentsOf, type VolumeContents } from './volume-contents'

/**
 * 그 권의 **실릴 문항 기준** 준비도. 스냅샷이 없으면 `null` — 못 쟀다는 뜻이다.
 *
 * ⚠️ **판정 함수가 스냅샷을 직접 읽지 않는다.** 처음엔 `judge` 안에서 `contentsOf` 를
 *    불렀는데, 그러면 모델이 파일에 묶여 **테스트가 실제 스냅샷을 타 버린다**(실측
 *    2026-09-07: 픽스처로 해설 0 을 넣어도 실제 파일이 60/60 이라 늘 done 이었다).
 *    바깥에서 넣어 준다 — 기본값만 스냅샷에서 온다.
 */
export type Readiness = NonNullable<VolumeContents['readiness']>

export const readinessFromSnapshot = (v: ShelfVolume): Readiness | null =>
  contentsOf(v.vLevels)?.readiness ?? null

/** 이 단계를 누가 하는가. */
export type StageActor = 'script' | 'claude-code' | 'user'

/** 한 권에서 그 단계가 어떤 상태인가. */
export type StageState = 'done' | 'todo' | 'unmeasured'

export interface ProductionStage {
  id: string
  label: string
  actor: StageActor
  /** 라벨이 말하지 않는 것만 적는다 — 무엇이 끝나야 이 단계가 끝인가. */
  says: string
  /** 아직이면 무엇을 하면 되는가. 명령이면 그대로 붙여넣을 수 있어야 한다. */
  next: string
  /**
   * 한 권을 보고 판정한다. `unmeasured` 는 **못 쟀다**는 뜻이지 미완료가 아니다.
   *
   * @param r 실릴 문항 기준 준비도. `null` 이면 못 쟀다.
   */
  judge: (v: ShelfVolume, r: Readiness | null) => StageState
}

export const ACTOR_LABEL: Record<StageActor, string> = {
  script: '스크립트',
  'claude-code': 'Claude Code',
  user: '사람',
}

/**
 * 단계 목록 — **순서가 곧 제작 순서**다.
 *
 * 표지·판권·구성 설명은 여기 없다: 셋 다 **요청 시 코드가 그린다**(`cover.ts` · `dossier.ts`).
 * 각인이 필요 없으므로 "아직인 권" 이라는 개념이 없고, 단계로 두면 늘 100% 인 줄이 셋 늘어
 * 콘솔이 실제 할 일을 가린다. (VCB 콘솔이 같은 이유로 그 셋을 뺐다.)
 */
export const PRODUCTION_STAGES: readonly ProductionStage[] = [
  {
    id: 'stock',
    label: '재고',
    actor: 'script',
    says: '이 권이 쓰기로 한 유형에 문항이 하나도 안 빈 상태',
    next: 'node scripts/textbook/store-new-types.mjs --commit',
    judge: (v) =>
      v.status === 'unmeasured' ? 'unmeasured' : v.emptyTypes.length === 0 ? 'done' : 'todo',
  },
  {
    id: 'units',
    label: '단원',
    actor: 'script',
    says: '문항을 단원으로 묶을 수 있는 상태 — 한 단원도 안 나오면 책이 안 된다',
    next: 'node scripts/textbook/render-volume.mjs <step>',
    judge: (v) => (v.status === 'unmeasured' ? 'unmeasured' : v.maxUnits >= 1 ? 'done' : 'todo'),
  },
  {
    id: 'render',
    label: '조판 가능',
    actor: 'script',
    says: '실릴 문항을 조판기가 **전부 그릴 수 있는** 상태. 못 그리면 목차엔 있고 지면엔 없다',
    next: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/contents-snapshot.mjs --bands <n>',
    judge: (_v, r) => {
      if (!r || r.items === 0) return 'unmeasured'
      return r.renderable >= r.items ? 'done' : 'todo'
    },
  },
  {
    id: 'explain',
    label: '해설',
    actor: 'claude-code',
    says: '실릴 문항마다 **왜 그것이 답인지**가 붙은 상태. 시장이 고르는 기준이 여기다',
    next: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/explain-drain-export.mjs --band <n> --volume 10 → Claude Code → explain-drain-import.mjs --commit',
    /**
     * ⚠️ **재고 전량이 아니라 실릴 문항으로 판정한다.**
     *
     * 처음에는 `ShelfVolume.explainedCount >= itemCount`(재고 전량, 밴드에 따라 수만 건)로
     * 쟀다. 그랬더니 콘솔이 전 권을 "해설 아직" 으로 적고 **「Claude Code 차례 · 해설」**
     * 이라며 드레인을 가리켰는데, 그 드레인을 실제로 돌려 보니 **배치 몫이 전 밴드 0** 이었다
     * (실측 2026-09-07 — V2 47/13/0 · V3 16/44/0 · V4 5/55/0 · V5 34/26/0 · V6·V7 27/33/0).
     * 책은 안 막혀 있었고 콘솔이 **없는 일을 시키고 있었다.**
     *
     * 그래서 분모를 바꿨다: 실제로 실릴 60문항 중 **조판 가능한 것**에 해설이 붙었는가.
     * (조판이 안 되는 문항은 지면에 없으므로 해설을 물을 대상이 아니다 — 그건 앞 칸의 일이다.)
     */
    judge: (_v, r) => {
      if (!r || r.renderable === 0) return 'unmeasured'
      return r.explained >= r.renderable ? 'done' : 'todo'
    },
  },
  {
    id: 'proof',
    label: '교정',
    actor: 'claude-code',
    says: '실릴 지문에 표기 결함이 없는 상태 — 구두점 앞 공백 · 아포스트로피 혼용 · 반복 낱말',
    next: 'npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/proofread-report.mjs → 고칠 것과 둘 것을 가른다',
    /**
     * ⚠️ **검사 대상이 0 이면 "깨끗함" 이 아니라 판정 불가다.** 초등 낱말 유형은
     *    `payload.sentences` 가 없어 이 규칙으로 잴 수 없다(실측 2026-09-07: 1·2단이 0/0).
     *    대상 밖을 통과로 세면 결함률이 실제보다 낮게 나온다.
     */
    judge: (_v, r) => {
      if (!r || r.proofChecked === 0) return 'unmeasured'
      return r.proofClean >= r.proofChecked ? 'done' : 'todo'
    },
  },
  {
    id: 'open',
    label: '펼치기',
    actor: 'user',
    says: '사람이 보고 학습자에게 열기로 정한 상태 — 기계가 정하지 않는다',
    next: '매대에서 이 권을 열어 보고 문제가 없으면 발행한다',
    judge: (v) =>
      v.status === 'unmeasured' ? 'unmeasured' : v.status === 'ready' ? 'done' : 'todo',
  },
]

export interface VolumeProgress {
  step: number
  title: string
  schoolBand: string
  /** 단계별 판정. `PRODUCTION_STAGES` 와 같은 순서다. */
  states: StageState[]
  /**
   * **지금 걸린 단계** — 앞에서부터 처음으로 `done` 이 아닌 칸.
   * 전부 끝났으면 `null`. 못 잰 칸에서 멈추면 그 칸이다(그 사실을 화면이 말해야 한다).
   */
  blockedAt: ProductionStage | null
  doneCount: number
}

export function measureVolume(
  v: ShelfVolume,
  readiness: Readiness | null,
  stages: readonly ProductionStage[] = PRODUCTION_STAGES,
): VolumeProgress {
  const states = stages.map((s) => s.judge(v, readiness))
  const idx = states.findIndex((s) => s !== 'done')
  return {
    step: v.step,
    title: v.title,
    schoolBand: v.schoolBand,
    states,
    blockedAt: idx === -1 ? null : (stages[idx] ?? null),
    doneCount: states.filter((s) => s === 'done').length,
  }
}

export interface ProductionReport {
  volumes: VolumeProgress[]
  /** 단계별로 **몇 권이 끝났나** — `PRODUCTION_STAGES` 와 같은 순서. */
  doneByStage: number[]
  /** 단계별로 **몇 권을 못 쟀나**. 0 과 구별해서 화면에 적어야 한다. */
  unmeasuredByStage: number[]
  /**
   * **지금 누구 차례인가** — 가장 앞에서 막힌 단계의 담당.
   * 전 권이 끝났으면 `null`.
   */
  turn: StageActor | null
  /** 그 차례가 걸린 단계. */
  turnStage: ProductionStage | null
}

/**
 * 서가 전체를 단계별로 잰다.
 *
 * ⚠️ **차례는 "가장 앞에서 막힌 칸"** 으로 정한다. 뒤 단계가 더 많이 비어 보여도 앞을 먼저
 *    푼다 — 재고가 안 찬 권의 해설을 쓰면 그 해설은 버려진다. (공정 현황판이 병목을 그렇게
 *    고르는 것과 같은 규칙이다.)
 */
export function measureProduction(
  volumes: readonly ShelfVolume[],
  /** 권 → 준비도. 기본값은 스냅샷이고, 테스트는 자기 값을 넣는다. */
  readinessOf: (v: ShelfVolume) => Readiness | null = readinessFromSnapshot,
  stages: readonly ProductionStage[] = PRODUCTION_STAGES,
): ProductionReport {
  const rows = volumes.map((v) => measureVolume(v, readinessOf(v), stages))
  const doneByStage = stages.map((_, i) => rows.filter((r) => r.states[i] === 'done').length)
  const unmeasuredByStage = stages.map(
    (_, i) => rows.filter((r) => r.states[i] === 'unmeasured').length,
  )
  const idx = stages.findIndex((_, i) => rows.some((r) => r.states[i] !== 'done'))
  const turnStage = idx === -1 ? null : (stages[idx] ?? null)
  return {
    volumes: rows,
    doneByStage,
    unmeasuredByStage,
    turn: turnStage?.actor ?? null,
    turnStage,
  }
}

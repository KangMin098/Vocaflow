// packages/library-pipeline/src/textbook/production-stages.ts
//
// **상업 교재 제작 단계 ↔ 이 파이프라인의 대응표.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// "상업교재 만드는 프로세스를 적용" 하려면 그 프로세스가 무엇인지 먼저 있어야 하고,
// 우리 파이프라인의 어느 단계가 그것에 대응하는지 **한 곳에** 적혀 있어야 한다.
// 적어 두지 않으면 "검수 단계가 있나요" 를 매번 코드를 뒤져 답하게 된다.
//
// ── 출처 (2026-08-21 조사) ───────────────────────────────────────────
// 교육출판 편집자 실무: 기획안 작성 → 저자 섭외·원고 의뢰 → 원고 검토 →
// 원고 교정(초교·재교·삼교) → 화면 교정·내부 검수 → 인쇄.
//   https://comento.kr/edu/learn/camp/detail-G854
//   https://www.typetak.com/ko/blog/publishing_process
//
// ⚠️ 이 표는 **시중 교재의 내용을 쓰는 것이 아니라 절차를 참고**한 것이다.
//   절차는 아이디어라 저작권 대상이 아니다. 내용을 입력으로 쓰는 것은 별개 문제이고,
//   목적이 시장 대체라면 성립하지 않는다.

export type StageState = 'done' | 'partial' | 'missing'

/**
 * 그 단계에서 **누가 일하는가.**
 *
 * ── 왜 단계마다 적는가 ──────────────────────────────────────────────
 * 이 저장소의 다른 파이프라인은 **단계·탭마다** Claude Code 드레인을 따로 둔다
 * (VCB 3개 · PDCP 2개 · LCP·CCP·TCP·Compose 각 1개). 교재만 전부를 묶은 드레인
 * 하나로 두면 "지금 어느 단계에서 Claude Code 를 돌려야 하는가" 를 알 수 없다.
 *
 * ⚠️ **"LLM 이 필요하다" 는 차단 사유가 아니라 작업 시작 신호다**(루트 CLAUDE.md §🤖).
 *   그래서 `claude` 인 단계는 드레인이 있어야 하고, 없으면 그게 곧 할 일 목록이다.
 */
export type StageWorker =
  /** 스크립트가 결정론으로 한다 — 사람도 LLM 도 필요 없다. */
  | 'script'
  /** **Claude Code 배치** — 글을 읽고 써야 하는 일. */
  | 'claude'
  /** 사람이 판단한다 — 발행 여부·교육적 적합성. */
  | 'human'

/** 그 단계의 Claude Code 몫. `worker` 가 `claude` 가 아니면 null. */
export interface ClaudeDrain {
  /** 무엇을 쓰는가. */
  role: string
  /** 뽑기·적재 스크립트 짝. 아직 없으면 null — **그게 할 일이라는 뜻이다.** */
  scripts: { exportScript: string; importScript: string } | null
  /** 어디에 저장되는가. 마이그레이션이 필요 없으면 그 사실을 적는다. */
  storage: string
  /** 실측 진척 — 분자/분모. 아직 안 시작했으면 그렇게 적는다. */
  progress: string
}

export interface ProductionStage {
  order: number
  /** 출판 실무에서 부르는 이름. */
  label: string
  /** 그 단계가 실제로 하는 일 — 우리가 흉내 내야 하는 것. */
  purpose: string
  state: StageState
  /** 우리 파이프라인의 대응물. `missing` 이면 빈 배열. */
  ours: string[]
  /** 무엇이 모자란가. `done` 이면 null. */
  gap: string | null
  /** 이 단계에서 누가 일하는가. */
  worker: StageWorker
  /** Claude Code 몫. `worker !== 'claude'` 면 null. */
  claude: ClaudeDrain | null
}

export const PRODUCTION_STAGES: readonly ProductionStage[] = [
  {
    order: 1,
    label: '기획',
    purpose: '대상 학년·수준·유형 구성과 단원 수를 정한다. 여기서 교재의 정체가 결정된다.',
    state: 'done',
    ours: [
      'series.ts 계단 7단 (학령 사다리 = vocaflow_levels)',
      'article_compose_jobs (발주: track + target_v_level)',
    ],
    gap: null,
    worker: 'script',
    claude: null,
  },
  {
    order: 2,
    label: '집필',
    purpose: '기획에 맞는 지문을 쓴다. 상업 교재는 저자를 섭외한다.',
    state: 'partial',
    ours: ['csat_korean 유형 명세 (130~190어 · 주제문→근거→함의)', 'PD 소스 재고 328편'],
    gap:
      '생성 지문의 산출 레벨이 목표보다 2~3밴드 낮게 나온다(실측 csat_korean 2건: 목표 V6·V8 → 산출 V3·V4). ' +
      '그리고 **사다리 3·4단(중1-2·중3)이 가장 얇다** — V3~V4 지문 재고가 ACP 수집 편중으로 비어 있다.',
    worker: 'claude',
    claude: {
      role:
        '사실에서 수능형 주제글을 새로 쓴다(`csat_korean` — 130~190어 · 주제문→근거→함의). ' +
        '**지문 재고가 얇은 밴드를 겨냥해서** 쓴다 — 지금은 V3~V4 다.',
      scripts: null,
      storage: 'article_compose_candidates → 게이트 6종 → library_articles',
      progress: '드레인 없음. 지금까지 2편만 있고 둘 다 목표 레벨을 못 맞췄다.',
    },
  },
  {
    order: 3,
    label: '문항 제작',
    purpose: '지문마다 유형별 문항과 답지를 만든다.',
    state: 'partial',
    ours: [
      'DCP 결정론 생성 (순서·삽입) + 흐름무관·어휘·어법 — **결정론 수능 5유형 완료**',
      '중등 영작 배열 · 초등 3종(파닉스 운율·기본어휘 뜻·철자 완성)',
      'csat-format 수능 인쇄 변환',
    ],
    gap:
      '⚠️ 여기 적혀 있던 "수능 5유형(문항 7/28)" 은 **낡은 값이었다** — 2026-08-30 DB 실측은 ' +
      '**25유형 17,206문항**이다. 시중 79종에서 뽑은 표준 발문 23종 중 우리 유형에 대응하는 14종은 ' +
      '**모두 갖췄고**(market-benchmark A5 관문 14/14), 표준 밖 11종을 더 만든다. ' +
      '남은 것은 도표·안내문처럼 **지문 밖 재료**가 필요한 유형이다.',
    worker: 'claude',
    claude: {
      role:
        '결정론으로 못 만드는 **생성형 11유형**을 쓴다 — 요지·주제·제목·주장·목적·심경·함의·빈칸(4문항)·요약. ' +
        '이 유형들은 오답의 매력도가 난이도를 만들기 때문에 **오답 4개를 함께 써야** 한다.',
      scripts: null,
      storage: 'csat_dcp_items — 유형 추가 시 `type` CHECK 확장 필요(마이그레이션 · 승인)',
      progress:
        '2026-08-30 실측 25유형 17,206문항. 생성형도 비어 있지 않다 — ' +
        'topic 78 · blank 74 · mood 45 · main_point 45 · title 30 · implication 31 · claim/purpose/summary/content_match 각 16.',
    },
  },
  {
    order: 4,
    label: '원고 검토',
    purpose: '난이도·분량·오류를 본다. 페이지별 원고 양과 난이도가 적절한지 확인한다.',
    state: 'done',
    ours: [
      '게이트 6종 (법적 안전)',
      'scorecard 자동 9항목 (분량·형식·중복·출처)',
      'item-health-report (쏠림·규격·밴드) · bias-review (편향 검토 표시)',
    ],
    gap: null,
    worker: 'script',
    claude: null,
  },
  {
    order: 5,
    label: '교정 (초교·재교·삼교)',
    purpose: '오탈자·표기·일관성을 세 번 훑는다. 상업 교재 품질의 상당 부분이 여기서 나온다.',
    state: 'partial',
    ours: [
      '초교 — isPrintablePassage 가 인쇄 불가 자국을 판정 (인용 잔해 + 용어풀이·구분선)',
      '재교 — proofread.ts: 구두점 앞 공백 · 연속 공백 · 반복 낱말 · 괄호 짝',
      '삼교 — proofread.ts: 아포스트로피/큰따옴표 모양 · -ise/-ize · 대시 혼용',
      'scripts/textbook/proofread-report.mjs — 저장 지문 상시 점검 (읽기만 · 재실행 안전)',
      'store-new-types.mjs 낡은 문항 감지 — 규칙이 엄해지면 먼저 넣은 것을 다시 잰다',
      'explain.ts 조사 자동 선택 — `"animal" 를` 같은 어긋난 조사를 막는다',
    ],
    gap:
      '세 회차를 이제 기계가 모두 훑지만 **찾은 것을 아직 안 고쳤다** — 2026-08-30 실측 ' +
      '지문 1,668편 중 **77편(4.62%)에 표기 결함**이 남아 있다(아포스트로피 혼용 31 · ' +
      '구두점 앞 공백 29 · 반복 낱말 15 · 큰따옴표 혼용 9 · 대시 혼용 3 · 괄호 짝 2). ' +
      '지문 수정은 원문 개작이라 기계가 정하지 않는다 — 사람이 판단할 목록으로 넘긴다. ' +
      '아직 못 보는 것: 숫자 표기 혼용(세 개 ↔ 3), 학년별 어휘 수준 이탈.',
    worker: 'claude',
    claude: {
      role:
        '`proofread-report.mjs` 가 표시한 자리를 읽고 **고칠 것과 둘 것을 가른다** — ' +
        '겹친 고유명사(`Durand Durand`)나 인용 안의 원문 표기처럼 그대로 두어야 하는 것이 섞여 있다.',
      scripts: null,
      storage: '지문 수정은 원문 개작이라 조심스럽다 — 표시만 하고 사람이 정하는 편이 맞다',
      progress: '점검은 상시 돈다. 판단 대기 77편.',
    },
  },
  {
    order: 6,
    label: '해답·해설',
    purpose: '정답과 **왜 그것이 답인지**를 쓴다. 학습자가 혼자 공부할 수 있게 하는 핵심이다.',
    state: 'partial',
    ours: [
      'explain.ts 결정론 해설 (한정사 전환 · 지시어 · 어휘 사슬 · 연결어 · 대명사)',
      '판별 규칙: 답지 5개를 같은 잣대로 재 정답이 유일 최다일 때만 해설을 쓴다',
    ],
    gap:
      '**적재 2026-09-01** — 결정론 해설 **22,000건**을 채웠다(explain-fill --commit). ' +
      '`explanation_ko` 보유율 94.65% → 99.79%(80자 미만 0 · 정답 키 손실 0 — 유형별로 키 이름이 ' +
      '달라서(insert→position · order→source_order · blank_word→text · unit_vocab→answer) ' +
      '한 이름으로 검사하면 14만 건이 "키 없음" 으로 잘못 잡힌다. 유형별로 물어야 한다). ' +
      '⚠️ 이 작업은 **28시간 동안 배치 자물쇠에 막혀** 있었다(pid 10592 · 산출 0 · CPU 99%). ' +
      '\n\n' +
      '⚠️⚠️ **해설 보유율을 셀 때 `explanation_ko` 만 세면 안 된다.** 해설은 **두 이름으로 산다** — ' +
      '생성형 드레인(`item-drain-*`)은 `rationale_ko` 에, 결정론·배치 드레인은 `explanation_ko` 에 ' +
      '넣는다. 학습자 화면은 `pickExplanationText`(`lib/learner/dcp.ts`)가 둘 다 보므로 **이미 나온다.** ' +
      '한쪽만 세다가 실제로 틀렸다(2026-09-01): `explanation_ko` 만 세어 "생성형 834건에 해설이 없다" 고 ' +
      '판단하고 그 유형들의 드레인을 새로 만들려 했는데, 실물을 열어 보니 `rationale_ko` 에 ' +
      '156~197자짜리 완성된 해설(원문 인용 + 오답 배제 포함)이 이미 있었다. ' +
      '**제품과 같은 규칙으로 센 진짜 값: 427,530/427,592 = 99.986%.** ' +
      '남은 **62건**(order 31 · insert 31)은 해설이 없는 게 아니라 **문항이 교재 형식으로 성립하지 않는다** — ' +
      '사유 실측: 인용 잔해 40(order 31 · insert 9) · 문장 수 미달 22(`CSAT_INSERT_BODY.min = 5` 미만). ' +
      '조판이 거부하는 조건이라 **지면에 실리지 않으므로 렌더 가능한 문항 기준으로는 100%** 다. ' +
      '(2026-08-30 에도 같은 함정을 겪었다 — 순서·삽입 2,755건을 채웠는데 화면이 한쪽 키만 읽어 정답만 보였다.) ' +
      '\n\n' +
      '**재측정 2026-09-01** — 결정론 해설의 판별력 **9,954/141,031 = 7.1%**(order 7.2% · insert 6.9%), ' +
      '동점 50.7% · 근거 없음 5.5% · **오답을 더 가리킴 36.7%**. 불변조건 "해설을 쓰고도 정답이 ' +
      '유일 최다가 아닌 것 = 0" 은 유지된다. ' +
      '⚠️ **판별력(7.1%)과 DB 보유율(99.79%)은 다른 것을 잰다** — 판별력은 `order`·`insert` 에서 ' +
      '결정론 근거가 정답만 가리키는 비율이고, 보유율은 열 유형 전체에 해설 글이 있는 비율이다. ' +
      '보유율 쪽은 Claude Code 드레인(v2·v3·v4·v6 청크)과 위 22,000건 적재가 채웠다. ' +
      '둘을 섞어 읽으면 "해설이 7% 뿐" 이라는 잘못된 결론이 나온다(실제로 그렇게 읽을 뻔했다). ' +
      '⚠️ 이 값은 11일 동안 못 재고 있었다 — `explain-discriminate.mjs` 가 `csat_dcp_items` 전량(426,784행)을 ' +
      'payload 까지 offset 페이징해 statement timeout 이 났다(유형 필터 + keyset 으로 고쳤다, 2026-09-01). ' +
      '아래 옛 값은 그 고장 이전 기록이다. ' +
      '실측 커버리지 **91/1,316 = 6.9%** (2026-08-21). 나머지는 근거가 없거나(20.8%) ' +
      '오답과 동점이거나(37.8%) **오답 쪽 근거가 더 많다(34.4%)**. ' +
      '⚠️ "다음 레버는 희귀어 사슬" 이라고 적어 뒀던 것은 **재 보니 틀렸다** — 사전 `v_level` 을 ' +
      '문턱으로 넣으니 6.9% → **6.2%** 로 떨어졌고, 이음매마다 근거를 다 담아 봐도 6.2% 였다. ' +
      '무관 문장 고르기는 후보를 **거르는** 일이라 잡음을 빼면 정확해지지만, 해설은 정답이 오답보다 ' +
      '근거가 **많아야** 성립하므로 잡음을 빼면 정답 쪽 근거도 같이 사라진다. ' +
      '진짜 문제는 필터가 아니라 **표면 단서로는 결속을 못 읽는다**는 것이다(오답을 더 가리키는 34.4%가 그 증거). ' +
      '**그래서 나머지는 Claude Code 배치가 쓴다**(아래 `claude`). 규칙 해설은 근거가 확정된 것이라 그대로 두고, ' +
      '배치 해설이 우선 실린다.',
    worker: 'claude',
    claude: {
      role:
        '결정론이 못 쓴 문항의 해설을 쓴다 — 정답 근거를 지문에서 인용하고, **왜 다른 자리가 아닌지**까지 밝힌다. ' +
        '시장이 고르는 기준이 "해설의 깊이" 이므로 오답 배제까지 적는다.',
      scripts: {
        exportScript: 'scripts/textbook/explain-drain-export.mjs',
        importScript: 'scripts/textbook/explain-drain-import.mjs',
      },
      storage: '`answer_key.explanation_ko` (jsonb) — **마이그레이션 없음.** 기존 정답 키를 덮지 않고 키만 더한다',
      progress:
        '2026-08-30 실측 **13,814/17,206 = 80.3%**(2.7% 에서 올랐다). ' +
        '`explain-items.ts` 결정론 7유형 13,351건 + `explain.ts` 순서·삽입 463건. ' +
        '남은 3,392 는 순서 1,295 · 삽입 1,522 · 생성형 575 — **읽어야 아는 것들이라 배치 몫이다**.',
    },
  },
  {
    order: 7,
    label: '내부 검수',
    purpose: '인쇄 전 마지막 확인. 사람이 본다.',
    state: 'done',
    ours: [
      "status='ready' → 사람이 검수 → 'published'",
      'csat_stage_catalog 가 published 만 노출',
      'render-volume.mjs — 한 권을 실제로 조판해 사람이 눈으로 볼 수 있게 한다',
    ],
    gap: null,
    worker: 'human',
    claude: null,
  },
  {
    order: 8,
    label: '평가·개정',
    purpose: '출간 후 오류 신고와 사용 결과를 모아 다음 쇄에 반영한다.',
    state: 'partial',
    ours: [
      'item-health.ts — 정답 번호 쏠림(카이제곱) · 지문 규격 · 밴드 분포 · 관측 유무',
      'scripts/textbook/item-health-report.mjs — 저장 문항 전체 상시 점검',
      '관측이 들어오면 난이도(P)·변별도(D)가 자동으로 붙는 자리',
    ],
    gap:
      '**학습자 관측이 0건**이라 난이도·변별도는 아직 못 낸다 — 지금 보는 것은 "만들어진 모양" 이지 ' +
      '"가르쳐 본 결과" 가 아니다. 그래도 만들자마자 값을 했다(2026-08-21 첫 실행, 4,838문항): ' +
      '**정답 번호 쏠림 2종**(insert χ²=208.6 — ④⑤가 현저히 적다 · vocab χ²=52.7) + ' +
      '**지문 규격 밖 1,936건**(order 41.4% · insert 39.5% · vocab 58.2% · grammar 78.6%). ' +
      '문단을 그대로 지문으로 쓴 탓이다 — 수능 지문은 90~200어인데 우리 문단은 그보다 길다. ' +
      '(둘 다 고쳤다 — 지금은 고칠 것 0.)',
    worker: 'claude',
    claude: {
      role:
        '기계가 **표시한 것**을 사람 대신 1차로 읽는다 — 편향 검토 표시(`colored glass` 같은 오탐 걸러내기) · ' +
        '오답 매력도 판단. 관측이 쌓이면 난이도·변별도가 낮은 문항의 **원인**을 지문에서 찾는다.',
      scripts: null,
      storage: '판단 결과는 사람에게 넘긴다 — 발행 여부를 기계가 정하지 않는다',
      progress: '드레인 없음. 편향 검토 표시 45건이 판단을 기다린다.',
    },
  },
] as const

export interface ClaudeStageReport {
  /** Claude Code 가 일해야 하는 단계. */
  stages: ProductionStage[]
  /** 그중 드레인(뽑기·적재 스크립트)이 이미 있는 것. */
  wired: ProductionStage[]
  /** **드레인이 없는 단계 — 이게 할 일 목록이다.** */
  unwired: ProductionStage[]
}

/**
 * Claude Code 몫을 단계별로 낸다.
 *
 * "LLM 이 필요하다" 는 차단 사유가 아니라 **작업 시작 신호**다(루트 CLAUDE.md §🤖).
 * 그러므로 `claude` 인데 스크립트가 없는 단계는 **막힌 곳이 아니라 아직 안 만든 곳**이다.
 */
export function measureClaudeStages(
  stages: readonly ProductionStage[] = PRODUCTION_STAGES,
): ClaudeStageReport {
  const mine = stages.filter((s) => s.worker === 'claude')
  return {
    stages: mine,
    wired: mine.filter((s) => s.claude?.scripts != null),
    unwired: mine.filter((s) => s.claude?.scripts == null),
  }
}

export interface StageReport {
  done: number
  partial: number
  missing: number
  total: number
  /** 없는 단계 — 여기가 상업 교재와의 실제 격차다. */
  missingStages: ProductionStage[]
}

export function measureStages(
  stages: readonly ProductionStage[] = PRODUCTION_STAGES,
): StageReport {
  const count = (s: StageState): number => stages.filter((x) => x.state === s).length
  return {
    done: count('done'),
    partial: count('partial'),
    missing: count('missing'),
    total: stages.length,
    missingStages: stages.filter((x) => x.state === 'missing'),
  }
}

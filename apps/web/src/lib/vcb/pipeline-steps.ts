// apps/web/src/lib/vcb/pipeline-steps.ts
// VCB Pipeline step definitions — drives the in-admin guide UI.
// One source of truth for: order, names, commands, warnings, prerequisites.
// If any of these change, update here so the UI stays consistent with the slash
// commands and docs (scripts/vcb/README.md).

import fs from 'node:fs'
import path from 'node:path'
import { getVcbJobsDir } from '@vocaflow/vcb-core'

// ─────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────

export type StepStatus =
  | 'not-started' // not yet reached — earlier steps incomplete
  | 'ready' // prerequisites met, can be done now
  | 'in-progress' // partially complete
  | 'done' // fully complete
  | 'optional-pending' // optional safety step, not yet run (will not block)
  | 'optional-done' // optional safety step, complete
  | 'blocked' // cannot proceed — prerequisite missing/broken

export type StepKind =
  | 'generate'
  | 'safety'
  | 'transform'
  | 'enrich'
  | 'review'
  | 'publish'

export interface StepHowItem {
  label: string
  type: 'slash' | 'pnpm' | 'admin' | 'editor' | 'manual'
  command?: string
  href?: string
  note?: string
}

export interface PipelineStep {
  id: string
  number: string // "1", "1.5", "2", …
  kind: StepKind
  title: string
  oneLine: string

  /** Why this step exists — especially for safety steps */
  why?: string

  /** Human-readable prerequisites (no auto-check, just guidance) */
  prerequisites: string[]

  /** How to perform this step (in recommended order) */
  how: StepHowItem[]

  /** What to verify after completion */
  verify: string[]

  /** Common mistakes / things to avoid */
  warnings: string[]

  /** Time estimate (wall-clock) */
  timeEstimate?: string

  /** Cost estimate (LLM tokens) */
  costEstimate?: string

  /** Required vs optional/recommended */
  required: boolean
}

// ─────────────────────────────────────────────────────────────────────────
//  Step content — single source of truth for the guide UI
// ─────────────────────────────────────────────────────────────────────────

export const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: 'step-1',
    number: '1',
    kind: 'generate',
    title: 'Seed List 생성',
    oneLine: 'spec(목적·레벨·세그먼트)을 받아 AI가 lemma 리스트 생성',
    prerequisites: [
      'seed-spec.json 작성 완료 (target_count / target_cefr_range / target_segment / domain_hints)',
      'Run 생성 완료 (Method B 진입 가능 상태)',
    ],
    how: [
      {
        label: 'Admin: Method B 화면에서 spec 작성 + AI 실행',
        type: 'admin',
        href: '/seed',
        note: '권장 — 화면 안내에 따라 spec → AI 실행 → DB import 3단계',
      },
      {
        label: '슬래시: 이미 spec.json 이 있을 때',
        type: 'slash',
        command: '/vcb-seed-list <path-to-seed-spec.json>',
      },
    ],
    verify: [
      'exports/vcb-jobs/{slug}-seed-list.jsonl 파일 생성 (lemma 1줄씩)',
      '자동 schema 검증 통과 (01c-validate-seed-list.mjs)',
      '총 lemma 수가 target_count ±10% 이내',
    ],
    warnings: [
      '🚨 검증 없이 바로 Step 2로 넘어가지 말 것 — 다음 Step 1.5 안전망 강력 권장',
      'spec 의 must_include_keywords / must_exclude_keywords 가 단어 단위만 가능 (구문은 불가)',
      'AI 가 같은 lemma 의 변형(run/runs/running)을 중복 생성 가능 — Step 1.5 가 잡음',
    ],
    timeEstimate: '1~3분',
    costEstimate: '~$0.50 (Opus 1회)',
    required: true,
  },

  {
    id: 'step-1-validate',
    number: '1.5',
    kind: 'safety',
    title: 'Seed Validate (안전망)',
    oneLine: 'reference 파일 + spec 의도와 비교해 seed 품질 검증',
    why: 'Step 5b enrichment 비용(Opus × 2000)을 쓰기 전에 seed 자체의 품질 문제(레벨 드리프트, 도메인 이탈, must-cover 누락, exclude 오염)를 잡는다. 운영 시 이 단계를 생략한 seed 가 Step 7 에서 대량 reject 되어 재작업 발생하는 패턴이 가장 비쌌다.',
    prerequisites: [
      'Step 1 의 seed-list.jsonl 존재',
      'reference 파일 준비 (data/seed-references/{slug}/ 또는 data/curation-references/{slug}/)',
      '권장: reference-meta.json 작성 (role: must-cover / frequency-floor / exclude / supplement)',
    ],
    how: [
      {
        label: '슬래시: seed validation 실행',
        type: 'slash',
        command:
          '/vcb-seed-validate exports/vcb-jobs/{slug}-seed-list.jsonl',
      },
      {
        label: '에디터: 출력 리포트 검토',
        type: 'editor',
        command: 'exports/vcb-jobs/{slug}-seed-validation-{date}/summary.md',
      },
      {
        label: '에디터: must-cover 누락 단어 추가',
        type: 'editor',
        command: 'exports/vcb-jobs/{slug}-seed-validation-{date}/coverage-report.md',
      },
    ],
    verify: [
      'summary.md 에서 verdict 비율 확인 (목표: keep ≥ 80%)',
      'coverage-report.md 의 must_cover_misses 0건 또는 의도된 제외',
      'spec_keyword_completeness: ✓ must_include / must_exclude 모두 OK',
      'duplicate_lemmas: 0',
    ],
    warnings: [
      '⚠️ must_cover_misses 가 있는데 무시하고 진행 → Step 7 에서 대량 누락 발견',
      '⚠️ reference 없이 실행하면 의미 검증 없이 schema-only 와 동일 — refs 필수',
      'verdict=remove 가 많을 때 (>10%): spec 자체를 재검토 (target_segment 변경 등)',
    ],
    timeEstimate: '5~15분',
    costEstimate: '~$1~3 (Opus, 4 chunks × 500 lemmas)',
    required: false,
  },

  {
    id: 'step-2',
    number: '2',
    kind: 'transform',
    title: 'Normalize (정규화·중복 제거)',
    oneLine: 'seed-list.jsonl → vocab_seed_candidates DB rows (lowercase·dedupe·cache lookup)',
    prerequisites: [
      'seed-list.jsonl 검증 완료',
      'shared_dictionary 마스터 캐시 접근 가능 (캐시 hit 단어는 미스만 통과)',
    ],
    how: [
      {
        label: 'Admin: Method A 카드의 Step 2 (또는 Method A 통합 실행)',
        type: 'admin',
        href: '#method-a',
      },
      {
        label: 'CLI',
        type: 'pnpm',
        command: 'pnpm vcb:normalize --run-id <N>',
      },
    ],
    verify: [
      'vocab_seed_candidates rows 생성 (seed_count 카운트 증가)',
      'run.status: created/ingesting → normalized',
      'shared_dictionary 캐시 hit 단어 제외됨 (vocab_dict_hits 적재)',
    ],
    warnings: [
      'normalize 재실행 시 새 rows 추가 — 기존 rows 자동 삭제 X',
      '캐시 hit 단어가 너무 많으면 (>50%): 새 seed list 가 기존과 너무 겹친다는 신호',
    ],
    timeEstimate: '수 초~1분',
    required: true,
  },

  {
    id: 'step-3-4',
    number: '3·4',
    kind: 'transform',
    title: 'Queue 적재 + Batch 분할',
    oneLine: 'cache miss 단어를 vocab_enrichment_queue 에 status=pending 으로 적재 + 200줄 chunk 로 export',
    prerequisites: ['Step 2 완료 (vocab_seed_candidates 적재)'],
    how: [
      {
        label: 'Admin: Method A 통합 실행 (Step 2+3 한번에)',
        type: 'admin',
        href: '#method-a',
      },
      {
        label: 'CLI Step 3 (lookup)',
        type: 'pnpm',
        command: 'pnpm vcb:dict-lookup --run-id <N>',
      },
      {
        label: 'CLI Step 4 (export)',
        type: 'pnpm',
        command: 'pnpm vcb:export-job --run-id <N>',
      },
    ],
    verify: [
      'vocab_enrichment_queue rows status=exported',
      'exports/vcb-jobs/{slug}-pending-NNofMM.jsonl 파일 생성 (200줄씩 N개)',
      'run.status: extracted',
    ],
    warnings: [
      'export-job 후 pending 파일 삭제 시 Step 5b 진행 불가 — 다시 export-job 으로 재생성 가능',
    ],
    timeEstimate: '수 초',
    required: true,
  },

  {
    id: 'step-5b',
    number: '5b',
    kind: 'enrich',
    title: 'Enrichment (LLM 호출) — 파이프라인 병목 ★',
    oneLine: '각 pending chunk 를 lexicographer 사양으로 enrich → enriched JSONL',
    why: '전체 파이프라인의 시간·비용 95% 가 이 단계. autoregressive 토큰 생성이 본질 병목. Claude Code 의 Agent fan-out 으로 9 chunks 병렬 처리하면 4-9시간 → 20-60분.',
    prerequisites: [
      'Step 4 의 pending JSONL 파일들 존재',
      'reference-meta.json 의 enrichment 가이드 (선택)',
    ],
    how: [
      {
        label: '슬래시 (권장): pilot 1개 chunk',
        type: 'slash',
        command: '/vcb-batch-enrich {slug} --pilot',
        note: '한 chunk 먼저 품질 확인 → 나머지 fan-out',
      },
      {
        label: '슬래시: 전체 fan-out',
        type: 'slash',
        command: '/vcb-batch-enrich {slug}',
        note: 'wave-size 3 자동 — rate-limit 안전',
      },
      {
        label: 'Admin: chunk 별 개별 실행 (legacy)',
        type: 'admin',
        href: '#step-5',
        note: '브라우저에서 chunk 카드 [Run] 클릭',
      },
    ],
    verify: [
      'exports/vcb-jobs/{slug}-enriched-NNofMM.jsonl 파일 N개 생성',
      '각 파일의 자동 검증 통과 (05c-validate-output.mjs 결과 ok:true)',
      '리포트의 verdict: succeeded=N, failed=0, malformed=0',
    ],
    warnings: [
      '🚨 partial 파일 있을 때 --force 없이 재실행 시 거부 — 의도적 백업 후 재실행',
      '🚨 Claude Code 사용량 한도 도달 가능 — pilot 부터, wave-size 3 유지 권장',
      '낮은 모델로 downgrade 자동 제안 금지 (feedback memory 정합)',
    ],
    timeEstimate: '20~60분 (9 chunks 병렬)',
    costEstimate: 'Opus xhigh 기준 ~$60~120',
    required: true,
  },

  {
    id: 'step-5d',
    number: '5d',
    kind: 'transform',
    title: 'DB Import',
    oneLine: 'enriched JSONL → vocab_enrichment_queue UPDATE (status=enriched + payload)',
    prerequisites: ['모든 chunk 의 enriched JSONL + validation 통과'],
    how: [
      {
        label: '단일 chunk import',
        type: 'pnpm',
        command:
          'pnpm vcb:import-enriched -- --file exports/vcb-jobs/{slug}-enriched-NNofMM.jsonl',
      },
      {
        label: '전체 일괄 (bash)',
        type: 'manual',
        command:
          'for f in exports/vcb-jobs/{slug}-enriched-*.jsonl; do pnpm vcb:import-enriched -- --file "$f"; done',
      },
    ],
    verify: [
      'vocab_enrichment_queue 의 enriched 카운트 = 전체 queue 카운트',
      '각 row 의 enriched_payload IS NOT NULL',
      'run.status: enriching → enriched',
    ],
    warnings: [
      '이미 enriched 인 row 는 자동 skip — --force 시에만 덮어쓰기',
      'validation 실패한 file 은 import 거부 — --skip-validation 은 디버깅 전용',
    ],
    timeEstimate: 'chunk 당 30초~2분',
    required: true,
  },

  {
    id: 'step-6',
    number: '6',
    kind: 'review',
    title: 'QA Gate (R1~R8)',
    oneLine: '의미적 룰 8개로 enriched payload 검사 → 플래그 / re-enrich 대상 구분',
    prerequisites: ['Step 5d import 완료 (enriched_payload 적재)'],
    how: [
      {
        label: 'Admin: Step 6 카드',
        type: 'admin',
        href: '#step-6',
      },
      {
        label: 'CLI',
        type: 'pnpm',
        command: 'pnpm vcb:qa --run-id <N>',
      },
      {
        label: '슬래시 (플래그 단어 재생성)',
        type: 'slash',
        command: '/vcb-qa-flag-fix',
      },
    ],
    verify: [
      'qa_flags[] 채워진 row 카운트 확인',
      'run.status: enriched → qa',
      'flagged 비율 < 15% (높으면 enrich 단계로 회귀 검토)',
    ],
    warnings: [
      'flag 많을 때 (>15%): Step 5b 의 enrichment 품질 문제 — Step 1.5 안전망 미실행 가능성',
    ],
    timeEstimate: '5~15분',
    required: true,
  },

  {
    id: 'step-7-compare',
    number: '7a',
    kind: 'safety',
    title: 'Curation 비교 (선택)',
    oneLine: 'enriched 결과를 reference 파일과 비교해 큐레이터 사전 판정 (approve/review/reject)',
    why: 'Step 7 사람 검토 전, Anki/NGSL/도메인 ref 들과 LLM 으로 자동 비교해 verdict 를 매겨 두면 큐레이터가 reject·review 부터 처리해 시간을 절약. spec 의도와 실제 enriched 가 일치하는지 마지막 점검.',
    prerequisites: [
      'Step 6 QA 통과 (qa_passed)',
      'reference 파일 준비 (Step 1.5 와 같은 디렉토리 재사용 가능)',
    ],
    how: [
      {
        label: '슬래시',
        type: 'slash',
        command: '/vcb-curate-compare {slug}',
      },
      {
        label: '에디터: 요약 리포트 열기',
        type: 'editor',
        command:
          'exports/vcb-jobs/{slug}-curation-compare-{date}/summary.md',
      },
    ],
    verify: [
      'summary.md 에서 verdict 분포 (목표: reject < 5%)',
      'chunk-NN.compare.md 의 개별 verdict + rationale 검토',
    ],
    warnings: [
      'reject 가 많을 때 (>10%): Step 5b enrich 품질 또는 seed 자체 문제 → 위 단계 회귀',
    ],
    timeEstimate: '10~30분',
    costEstimate: '~$5~15 (Opus, chunk × refs)',
    required: false,
  },

  {
    id: 'step-7-curate',
    number: '7b',
    kind: 'review',
    title: 'Human Curation (큐레이터 검토)',
    oneLine: 'admin UI 에서 각 row 승인 / 거절 / 수정 → status=curated',
    prerequisites: [
      'Step 6 통과 (선택: Step 7a 비교 리포트)',
    ],
    how: [
      {
        label: 'Admin: Curation 화면',
        type: 'admin',
        href: '/curate/[run_id]',
        note: '권장 흐름: reject → review → approve 순서로 처리',
      },
      {
        label: '단어별 재생성',
        type: 'slash',
        command: '/vcb-reenrich <queue_id> [--instruction "..."]',
        note: '거절된 항목에 큐레이터 지시 첨부해 재생성',
      },
    ],
    verify: [
      '모든 row 의 curator_decision 채워짐 (approve / reject / edit)',
      'run.status: qa → curated',
    ],
    warnings: [
      '🚨 일괄 approve 금지 — 최소 spot-check 5-10%',
      '거절된 항목은 재생성 후 재검토 — 미해결 채로 Step 8 진입 시 published 누락',
    ],
    timeEstimate: '인력 의존 (수시간~수일)',
    required: true,
  },

  {
    id: 'step-8',
    number: '8',
    kind: 'publish',
    title: 'Publish → shared_dictionary',
    oneLine: '승인된 enriched payload 를 마스터 캐시(shared_dictionary)에 UPSERT',
    prerequisites: ['Step 7 모든 row 큐레이션 결정 완료'],
    how: [
      {
        label: 'Admin: Step 8 카드',
        type: 'admin',
        href: '#step-8',
      },
      {
        label: 'precheck',
        type: 'pnpm',
        command: 'pnpm vcb:publish-precheck --run-id <N>',
      },
      {
        label: 'CLI',
        type: 'pnpm',
        command: 'pnpm vcb:publish --run-id <N>',
      },
    ],
    verify: [
      'shared_dictionary 에 새 row 또는 UPDATE 적용',
      'dictionary_word_categories 매핑 동시 적재',
      'run.status: curated → published',
      'precheck 의 dry-run 결과와 일치',
    ],
    warnings: [
      '🚨 publish 는 마스터 캐시 변경 — precheck 결과 확인 후 진행',
      '롤백 어려움 — 동일 word 가 이미 있으면 UPSERT 로 덮어쓰기 됨',
    ],
    timeEstimate: '1~5분',
    required: true,
  },
]

// ─────────────────────────────────────────────────────────────────────────
//  Step state computation — uses filesystem + DB state
// ─────────────────────────────────────────────────────────────────────────

interface RunStateSnapshot {
  run_status: string
  seed_count: number
  pending_count: number
  enriched_count: number
  flagged_count: number
  failed_count: number
  approved_count: number
  collection_slug: string
}

/**
 * Compute per-step status from run state + filesystem hints.
 * Filesystem checks happen in the Node server context (this is a server-side helper).
 */
export function computeStepStatuses(
  run: RunStateSnapshot,
): Record<string, StepStatus> {
  const jobsDir = getVcbJobsDir()
  const slug = run.collection_slug
  const hasSeedList = anyFileMatches(jobsDir, `*-${slug}-seed-list.jsonl`)
  const hasSeedValidation = anyDirMatches(
    jobsDir,
    `*-${slug}-seed-validation-*`,
  )
  const hasPending = anyFileMatches(jobsDir, `*-${slug}-pending-*.jsonl`)
  const hasEnriched = anyFileMatches(jobsDir, `*-${slug}-enriched-*.jsonl`)
  const hasCurationCompare = anyDirMatches(
    jobsDir,
    `*-${slug}-curation-compare-*`,
  )

  const result: Record<string, StepStatus> = {
    'step-1': 'not-started',
    'step-1-validate': 'optional-pending',
    'step-2': 'not-started',
    'step-3-4': 'not-started',
    'step-5b': 'not-started',
    'step-5d': 'not-started',
    'step-6': 'not-started',
    'step-7-compare': 'optional-pending',
    'step-7-curate': 'not-started',
    'step-8': 'not-started',
  }

  // Step 1
  if (hasSeedList || run.seed_count > 0) {
    result['step-1'] = 'done'
  } else if (run.run_status === 'created' || run.run_status === 'ingesting') {
    result['step-1'] = 'ready'
  }

  // Step 1.5 (optional)
  if (result['step-1'] === 'done') {
    result['step-1-validate'] = hasSeedValidation
      ? 'optional-done'
      : 'optional-pending'
  }

  // Step 2
  if (run.seed_count > 0 && run.pending_count + run.enriched_count > 0) {
    result['step-2'] = 'done'
  } else if (result['step-1'] === 'done') {
    result['step-2'] = 'ready'
  }

  // Step 3-4
  if (hasPending || run.pending_count > 0) {
    result['step-3-4'] = 'done'
  } else if (result['step-2'] === 'done') {
    result['step-3-4'] = 'ready'
  }

  // Step 5b
  if (run.enriched_count > 0 && run.pending_count === 0) {
    result['step-5b'] = 'done'
  } else if (
    run.enriched_count > 0 ||
    (hasEnriched && run.pending_count > 0)
  ) {
    result['step-5b'] = 'in-progress'
  } else if (result['step-3-4'] === 'done') {
    result['step-5b'] = 'ready'
  }

  // Step 5d — combined inside 5b status from DB perspective
  if (run.enriched_count > 0) {
    result['step-5d'] =
      run.pending_count === 0 ? 'done' : 'in-progress'
  } else if (result['step-5b'] === 'in-progress' || result['step-5b'] === 'done') {
    result['step-5d'] = 'ready'
  }

  // Step 6 — QA
  if (run.run_status === 'qa' || run.run_status === 'curating' || run.run_status === 'curated' || run.run_status === 'published') {
    result['step-6'] = 'done'
  } else if (result['step-5d'] === 'done') {
    result['step-6'] = 'ready'
  }

  // Step 7a (optional comparator)
  if (result['step-6'] === 'done') {
    result['step-7-compare'] = hasCurationCompare
      ? 'optional-done'
      : 'optional-pending'
  }

  // Step 7b (human curation)
  if (run.run_status === 'curated' || run.run_status === 'published') {
    result['step-7-curate'] = 'done'
  } else if (run.run_status === 'curating') {
    result['step-7-curate'] = 'in-progress'
  } else if (result['step-6'] === 'done') {
    result['step-7-curate'] = 'ready'
  }

  // Step 8
  if (run.run_status === 'published') {
    result['step-8'] = 'done'
  } else if (result['step-7-curate'] === 'done') {
    result['step-8'] = 'ready'
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────
//  Filesystem helpers (server-only)
// ─────────────────────────────────────────────────────────────────────────

function anyFileMatches(dir: string, glob: string): boolean {
  if (!fs.existsSync(dir)) return false
  try {
    const files = fs.readdirSync(dir)
    const pattern = globToRegex(glob)
    return files.some((f) => pattern.test(f) && fs.statSync(path.join(dir, f)).isFile())
  } catch {
    return false
  }
}

function anyDirMatches(dir: string, glob: string): boolean {
  if (!fs.existsSync(dir)) return false
  try {
    const entries = fs.readdirSync(dir)
    const pattern = globToRegex(glob)
    return entries.some(
      (f) => pattern.test(f) && fs.statSync(path.join(dir, f)).isDirectory(),
    )
  } catch {
    return false
  }
}

function globToRegex(glob: string): RegExp {
  // very simple glob → regex, supports * only
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`)
}

// ─────────────────────────────────────────────────────────────────────────
//  Helpers for UI
// ─────────────────────────────────────────────────────────────────────────

export function nextActionableStep(
  statuses: Record<string, StepStatus>,
): PipelineStep | null {
  for (const step of PIPELINE_STEPS) {
    const s = statuses[step.id]
    if (s === 'ready' || s === 'in-progress') return step
  }
  // If everything done/optional-done, suggest next optional safety step
  for (const step of PIPELINE_STEPS) {
    if (statuses[step.id] === 'optional-pending') return step
  }
  return null
}

export function progressPercent(
  statuses: Record<string, StepStatus>,
): number {
  const required = PIPELINE_STEPS.filter((s) => s.required)
  const done = required.filter((s) => statuses[s.id] === 'done').length
  return Math.round((done / required.length) * 100)
}

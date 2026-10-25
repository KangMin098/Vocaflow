// packages/library-pipeline/src/story/schema.ts
//
// LCP Story 도메인 스키마 — 계약: docs/LCP_STORY.md §2~§10.
//
// 구분(같은 「책」으로 복제하지 않는다):
//   본문 판본(edition) = story_edition(서사 보존 현대 영어) · easy_reader(언어 부담 조절)
//   활동(activity)     = original_bridge(원문 대응 자료) · deep_reading(판단 구조 학습 활동)
//   편성(collection)   = theme collection — 발행본 키만 묶는다. 본문을 담지 않는다.
//
// 모든 객체는 strict — 정의되지 않은 키(예: 자유서술 답안, 임의 `verified: true`)는 거부한다.
// 선택 필드는 `undefined` 대신 `null` 로 둔다 — 결속 해시(canonical.ts)가 undefined 를 거부하기 때문이다.

import { z } from 'zod'

import type { LibrarySource } from '../types'
import { TEXT_NORMALIZATION } from './text'

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/
export const SHA256_RE = /^[0-9a-f]{64}$/
export const RELEASE_KEY_RE = /^lsr_[0-9a-f]{32}$/

/** 채우지 않은 값으로 보이는 문자열 — 빈 결과를 성공으로 들이지 않는다. */
export const PLACEHOLDER_RE = /\b(TODO|TBD|FIXME|XXX)\b|lorem ipsum|\{\{|<fill|__FILL__/i

/**
 * library_book 원천이 가리킬 수 있는 `library_books.source` 값. 실 DB 의 `library_books_source_check` 허용 목록과 같다
 * (S3 DB 감사 2026-10-25 — `docs/lcp-story/S3_DB_AUDIT.md`). types.ts 의 LibrarySource 보다 넓다(open_library · hathitrust ·
 * voa_learning 이 DB 에 있다). 좁게 두면 그 도서에 대응하는 원천을 등록할 수 없다.
 */
export const LIBRARY_BOOK_SOURCES = [
  'gutenberg',
  'standard_ebooks',
  'wikisource',
  'wikibooks',
  'simple_wikipedia',
  'openstax',
  'open_library',
  'hathitrust',
  'voa_learning',
  'librivox',
  'lit2go',
  'storyweaver',
  'pressbooks',
  'manual',
] as const satisfies readonly string[]
const LIBRARY_SOURCES = LIBRARY_BOOK_SOURCES

// types.ts 의 LibrarySource 에 값이 늘면 여기서 컴파일 오류가 난다(DB 허용 목록에도 함께 더해야 한다).
type MissingSource = Exclude<LibrarySource, (typeof LIBRARY_SOURCES)[number]>
const LIBRARY_SOURCES_EXHAUSTIVE: MissingSource extends never ? true : MissingSource = true
void LIBRARY_SOURCES_EXHAUSTIVE

const Slug = z.string().regex(SLUG_RE, 'slug(a-z0-9-, 64자 이하)여야 한다')
const Sha256 = z.string().regex(SHA256_RE, 'sha256 hex 64자여야 한다')
const IsoTime = z.string().datetime({ offset: true })

/** 의미 있는 글 — 비어 있지 않고 채우지 않은 표시가 없다. */
const Text = z
  .string()
  .refine((s) => s.trim().length > 0, { message: '비어 있다' })
  .refine((s) => !PLACEHOLDER_RE.test(s), { message: '채우지 않은 표시(TODO·TBD·{{ 등)가 있다' })

export const EDITION_KINDS = ['story_edition', 'easy_reader'] as const
export const ACTIVITY_KINDS = ['original_bridge', 'deep_reading'] as const
/** 변환 유형 셋을 구분해 기록한다. renarration(재서사)은 초기 제작에서 거부한다(validate.ts). */
export const TRANSFORMATION_TYPES = ['language_modernization', 'level_adaptation', 'renarration'] as const
/** 변경 기록 유형 = 변환 유형 + 본문 서사를 바꾸지 않는 학습자 주석(gloss · context_note). */
export const CHANGE_TYPES = [...TRANSFORMATION_TYPES, 'editorial_note'] as const
export const REVIEW_CHECKS = [
  'source_alignment',
  'meaning_preservation',
  'preserve_items',
  'language_target',
  'cognitive_target',
  'background_supports',
  'sensitivity_handling',
  'hook_spoiler_free',
  'naturalness',
  'activities',
  'assets',
] as const

const EditionKind = z.enum(EDITION_KINDS)
const TransformationType = z.enum(TRANSFORMATION_TYPES)
const Cefr = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
const Load = z.enum(['low', 'moderate', 'high'])

// ── 원문 결속 ───────────────────────────────────────────────────────────────

export const SourceAnchorSchema = z
  .object({
    source_sha256: Sha256,
    paragraph: z.number().int().nonnegative(),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    quote: z.string().min(1),
  })
  .strict()

export const RightsEvidenceSchema = z
  .object({
    asset: z.enum(['source_text', 'translation', 'illustration', 'audio']),
    /** confirmed 만 발행 후보 조건을 채운다. claimed_by_source(사이트 단위 PD 표지 등)는 확정이 아니다. */
    status: z.enum(['confirmed', 'claimed_by_source', 'unverified', 'hold', 'synthetic_fixture']),
    basis: Text,
    evidence_ref: z.string().min(1).nullable(),
    checked_by: z.string().min(1).nullable(),
    checked_at: IsoTime.nullable(),
  })
  .strict()

export const SourceSnapshotSchema = z
  .object({
    schema: z.literal('lcp-story/source-snapshot@1'),
    snapshot_id: Slug,
    synthetic: z.boolean(),
    work: z
      .object({
        /** 큐레이터가 정한 작품 키. 제목 매칭으로 만들거나 합치지 않는다. */
        work_key: Slug,
        title: Text,
        author: z.string().min(1).nullable(),
        /** 원작이 쓰인 언어(ISO 639 소문자). 원천 본문 언어와 다르다 — 번역 고전을 영어 원작으로 적지 않는다. */
        original_language: z.string().regex(/^[a-z]{2,3}$/, 'ISO 639 소문자 언어 코드여야 한다'),
      })
      .strict(),
    edition: z
      .object({
        source_kind: z.enum(['library_book', 'external_file', 'synthetic_fixture']),
        library_book_id: z.string().uuid().nullable(),
        source: z.enum(LIBRARY_SOURCES).nullable(),
        source_id: z.string().min(1).nullable(),
        source_url: z.string().url().nullable(),
        edition_label: Text,
        revision: z.string().min(1),
        /** 이 원천 판본 본문의 언어. 영어 독서 라인이라 영어만 받는다. */
        text_language: z.literal('en'),
        /** 번역본이면 번역자(표기 그대로). 원작이 영어면 null. 번역 권리는 rights 의 translation 기록으로 따로 확인한다. */
        translator: z.string().min(1).nullable(),
      })
      .strict(),
    captured_at: IsoTime,
    normalization: z.literal(TEXT_NORMALIZATION),
    coverage: z.enum(['complete_work', 'excerpt']),
    coverage_note: Text,
    text: z.string().min(1),
    text_sha256: Sha256,
    rights: z.array(RightsEvidenceSchema).min(1),
  })
  .strict()

// ── 편집 기준 · 제작 범위 · 목표 ────────────────────────────────────────────

const PreserveItemSchema = z
  .object({
    id: Slug,
    description: Text,
    anchors: z.array(SourceAnchorSchema).min(1),
    /** 이 요소를 반드시 보존해야 하는 판본 종류. 예: 언어유희는 story_edition 에서만. */
    required_in: z.array(EditionKind).min(1),
  })
  .strict()

const SensitiveItemSchema = z
  .object({
    id: Slug,
    anchors: z.array(SourceAnchorSchema).min(1),
    issue: Text,
    handling: z.enum(['retain_with_context', 'revise_with_note', 'omit_with_note']),
    rationale: Text,
  })
  .strict()

/** 언어 · 사고 · 배경지식 · 정서 적합성을 분리한다. 모두 편집 목표/판단이며 실측이 아니다. */
export const ReadingTargetSchema = z
  .object({
    language: z
      .object({
        cefr: Cefr,
        v_level_min: z.number().int().min(0).max(11),
        v_level_max: z.number().int().min(0).max(11),
        basis: z.literal('editorial_target'),
      })
      .strict(),
    cognitive: z
      .object({
        demand: Load,
        basis: z.literal('editorial_judgment'),
        note: Text,
      })
      .strict(),
    background_knowledge: z
      .object({
        load: Load,
        supports: z.array(Text),
      })
      .strict(),
    emotional_suitability: z
      .object({
        note: Text,
        cautions: z.array(Text),
      })
      .strict(),
    goals: z.array(Text).min(1),
  })
  .strict()

export const ProductionItemSchema = z
  .object({
    edition_key: Slug,
    kind: EditionKind,
    transformation: TransformationType,
    /** complete_work 만 작품 완독으로 셀 수 있다. episode · excerpt 는 원작 전권 완료가 아니다. */
    coverage: z.enum(['complete_work', 'episode', 'excerpt']),
    scope: z
      .object({
        first_paragraph: z.number().int().nonnegative(),
        last_paragraph: z.number().int().nonnegative(),
      })
      .strict(),
    target: ReadingTargetSchema,
    activities: z.array(z.enum(ACTIVITY_KINDS)),
  })
  .strict()

export const EditorialPolicySchema = z
  .object({
    schema: z.literal('lcp-story/editorial-policy@1'),
    policy_id: Slug,
    policy_version: z.number().int().positive(),
    work_key: Slug,
    source_sha256: Sha256,
    reason_to_read: Text,
    preserve: z
      .object({
        events: z.array(PreserveItemSchema).min(1),
        motivations: z.array(PreserveItemSchema).min(1),
        causality: z.array(PreserveItemSchema),
        foreshadowing: z.array(PreserveItemSchema),
        tone_devices: z.array(PreserveItemSchema),
      })
      .strict(),
    changeable: z.array(Text).min(1),
    sensitive_content: z.array(SensitiveItemSchema),
    entry_scene: z
      .object({
        anchors: z.array(SourceAnchorSchema).min(1),
        spoiler_free: z.literal(true),
        rationale: Text,
      })
      .strict(),
    review_concerns: z.array(Text),
    production: z.array(ProductionItemSchema).min(1),
  })
  .strict()

// ── 판본 결과물(에이전트가 채운다) ──────────────────────────────────────────

/**
 * source_sha256 = 본문 해시(앵커용) · source_identity_sha256 = 원천 판본 정체(판본 · revision · 대응 도서 ·
 * 권리 · 확보 기록 + 본문 해시) 해시. 본문이 같아도 다른 원천 판본이면 결속이 다르다.
 */
const EditionBindingSchema = z
  .object({
    source_sha256: Sha256,
    source_identity_sha256: Sha256,
    policy_sha256: Sha256,
    target_sha256: Sha256,
  })
  .strict()

const StoryUnitSchema = z
  .object({
    unit_id: Slug,
    order: z.number().int().positive(),
    title: Text.nullable(),
    text: z.string(),
    source_anchors: z.array(SourceAnchorSchema).min(1),
    preserves: z.array(Slug),
  })
  .strict()

const ChangeEntrySchema = z
  .object({
    change_id: Slug,
    type: z.enum(CHANGE_TYPES),
    operation: z.enum(['rewrite', 'condense', 'omit', 'gloss', 'context_note']),
    unit_ids: z.array(Slug),
    source_anchors: z.array(SourceAnchorSchema).min(1),
    sensitive_ref: Slug.nullable(),
    rationale: Text,
    learner_note: Text.nullable(),
  })
  .strict()

const EditionSpanSchema = z
  .object({
    unit_id: Slug,
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    quote: z.string().min(1),
  })
  .strict()

const OptionSpanSchema = z
  .object({
    option_id: Slug,
    unit_id: Slug,
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    quote: z.string().min(1),
  })
  .strict()

const OriginalBridgeSchema = z
  .object({
    activity_id: Slug,
    kind: z.literal('original_bridge'),
    unit_id: Slug,
    edition_span: EditionSpanSchema,
    source_anchors: z.array(SourceAnchorSchema).min(1),
    focus: z.enum(['wording', 'syntax', 'tone', 'wordplay', 'cultural_context']),
    prompt: Text,
  })
  .strict()

/** 판단 구조만 허용한다 — 자유서술 응답 형식은 스키마에 없다(자동 채점 금지). */
const DeepTaskSchema = z.discriminatedUnion('interaction', [
  z
    .object({
      interaction: z.literal('choose_evidence'),
      claim: Text,
      options: z.array(OptionSpanSchema).min(2).max(6),
      answer: z.discriminatedUnion('basis', [
        z.object({ basis: z.literal('factual'), correct: z.array(Slug).min(1) }).strict(),
        z.object({ basis: z.literal('interpretive'), defensible: z.array(Slug).min(1), note: Text }).strict(),
      ]),
    })
    .strict(),
  z
    .object({
      interaction: z.literal('order_events'),
      items: z
        .array(z.object({ item_id: Slug, label: Text, unit_id: Slug }).strict())
        .min(3)
        .max(6),
      answer: z.object({ basis: z.literal('factual'), order: z.array(Slug).min(3) }).strict(),
    })
    .strict(),
])

const DeepReadingSchema = z
  .object({
    activity_id: Slug,
    kind: z.literal('deep_reading'),
    after_unit_id: Slug,
    prompt: Text,
    task: DeepTaskSchema,
  })
  .strict()

export const ActivitySchema = z.discriminatedUnion('kind', [OriginalBridgeSchema, DeepReadingSchema])

const AssetDeclSchema = z
  .object({
    asset_id: Slug,
    kind: z.enum(['audio', 'illustration', 'quiz']),
    /** 원천 자산은 자동 상속하지 않는다 — 상속을 명시해도 권리 · 본문 정합을 따로 확인해야 한다. */
    origin: z.enum(['inherited_from_source', 'newly_produced']),
    unit_ids: z.array(Slug).min(1),
    rights_status: z.enum(['confirmed', 'unverified', 'hold']),
    rights_evidence_ref: z.string().min(1).nullable(),
    alignment: z.enum(['verified', 'unverified']),
  })
  .strict()

export const EditionArtifactSchema = z
  .object({
    schema: z.literal('lcp-story/edition@1'),
    task_id: z.string().min(1),
    binding: EditionBindingSchema,
    edition_key: Slug,
    kind: EditionKind,
    produced_by: z
      .object({
        agent: z.string().min(1),
        session_id: z.string().min(1),
        provenance: z.enum(['ai_generated', 'human_authored', 'synthetic_fixture']),
      })
      .strict(),
    title: Text,
    hook: z
      .object({
        text: z.string(),
        source_anchors: z.array(SourceAnchorSchema).min(1),
        spoiler_free: z.literal(true),
      })
      .strict(),
    units: z.array(StoryUnitSchema).min(1),
    change_log: z.array(ChangeEntrySchema),
    activities: z.array(ActivitySchema),
    assets: z.array(AssetDeclSchema),
  })
  .strict()

// ── 검수 ───────────────────────────────────────────────────────────────────

export const ReviewBindingSchema = z
  .object({
    task_id: z.string().min(1),
    edition_key: Slug,
    source_sha256: Sha256,
    source_identity_sha256: Sha256,
    policy_sha256: Sha256,
    target_sha256: Sha256,
    edition_sha256: Sha256,
    activities_sha256: Sha256,
  })
  .strict()

export const ReviewArtifactSchema = z
  .object({
    schema: z.literal('lcp-story/review@1'),
    review_id: Slug,
    binding: ReviewBindingSchema,
    reviewer: z
      .object({
        kind: z.enum(['ai_model', 'human']),
        agent: z.string().min(1),
        session_id: z.string().min(1),
        role: Text,
      })
      .strict(),
    /** synthetic_fixture 는 실제 검토가 아니다 — 계획은 이것을 발행 후보로 세지 않는다. */
    provenance: z.enum(['ai_review', 'human_review', 'synthetic_fixture']),
    checks: z
      .array(
        z
          .object({
            check: z.enum(REVIEW_CHECKS),
            verdict: z.enum(['pass', 'fail', 'hold', 'not_checked']),
            note: Text,
          })
          .strict(),
      )
      .min(1),
    issues: z.array(
      z
        .object({
          issue_id: Slug,
          severity: z.enum(['critical', 'major', 'minor']),
          status: z.enum(['open', 'resolved', 'accepted_risk']),
          unit_ids: z.array(Slug),
          summary: Text,
        })
        .strict(),
    ),
    verdict: z.enum(['approve', 'changes_requested', 'hold', 'reject']),
    reviewed_at: IsoTime,
  })
  .strict()

// ── 편성 ───────────────────────────────────────────────────────────────────

export const ThemeCollectionSchema = z
  .object({
    schema: z.literal('lcp-story/theme-collection@1'),
    collection_key: Slug,
    title: Text,
    theme: Text,
    entries: z
      .array(
        z
          .object({
            release_key: z.string().regex(RELEASE_KEY_RE),
            work_key: Slug,
            reason: Text,
          })
          .strict(),
      )
      .min(2),
  })
  .strict()

// ── 작업 폴더 원장 ─────────────────────────────────────────────────────────

export const ExportManifestSchema = z
  .object({
    schema: z.literal('lcp-story/export@1'),
    work: Slug,
    source_sha256: Sha256,
    source_identity_sha256: Sha256,
    snapshot_file_sha256: Sha256,
    policy_sha256: Sha256,
    policy_file_sha256: Sha256,
    editions: z
      .array(
        z
          .object({
            edition_key: Slug,
            kind: EditionKind,
            task_id: z.string().min(1),
            target_sha256: Sha256,
            task_file: z.string().min(1),
            task_file_sha256: Sha256,
          })
          .strict(),
      )
      .min(1),
  })
  .strict()

export type SourceAnchor = z.infer<typeof SourceAnchorSchema>
export type RightsEvidence = z.infer<typeof RightsEvidenceSchema>
export type SourceSnapshot = z.infer<typeof SourceSnapshotSchema>
export type ReadingTarget = z.infer<typeof ReadingTargetSchema>
export type ProductionItem = z.infer<typeof ProductionItemSchema>
export type EditorialPolicy = z.infer<typeof EditorialPolicySchema>
export type EditionArtifact = z.infer<typeof EditionArtifactSchema>
export type StoryUnit = EditionArtifact['units'][number]
export type ChangeEntry = EditionArtifact['change_log'][number]
export type Activity = z.infer<typeof ActivitySchema>
export type AssetDecl = EditionArtifact['assets'][number]
export type ReviewBinding = z.infer<typeof ReviewBindingSchema>
export type ReviewArtifact = z.infer<typeof ReviewArtifactSchema>
export type ReviewCheckId = (typeof REVIEW_CHECKS)[number]
export type ThemeCollection = z.infer<typeof ThemeCollectionSchema>
export type ExportManifest = z.infer<typeof ExportManifestSchema>
export type EditionKind = (typeof EDITION_KINDS)[number]
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]
export type TransformationTypeId = (typeof TRANSFORMATION_TYPES)[number]
export type ChangeTypeId = (typeof CHANGE_TYPES)[number]

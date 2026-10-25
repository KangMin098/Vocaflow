// packages/library-pipeline/src/story/index.ts
//
// LCP Story(이야기 중심 판본 라인) 모듈 배럴. 계약: docs/LCP_STORY.md.
// 패키지 루트 배럴(src/index.ts)에는 싣지 않는다. 이 전체 배럴(작업 폴더 · CLI 포함, node:fs)의 소비자는 scripts/lcp/story 다.
// 관리자 서버 코드(S4)는 패키지 exports `@vocaflow/library-pipeline/story` = ./server.ts(workdir · cli 제외)를 쓴다.

export { CanonicalError, canonicalJson, canonicalPrettyJson, sha256Canonical, sha256Hex } from './canonical'
export {
  TEXT_NORMALIZATION,
  checkEditionSpan,
  checkSourceAnchor,
  isNormalizedText,
  normalizeSourceText,
  paragraphSpans,
  rangesOverlap,
  sourceTextSha256,
  surfaceMetrics,
} from './text'
export type { ParagraphSpan, SurfaceMetrics } from './text'
export {
  ACTIVITY_KINDS,
  ActivitySchema,
  CHANGE_TYPES,
  EDITION_KINDS,
  EditionArtifactSchema,
  EditorialPolicySchema,
  ExportManifestSchema,
  ProductionItemSchema,
  REVIEW_CHECKS,
  ReadingTargetSchema,
  ReviewArtifactSchema,
  ReviewBindingSchema,
  SourceAnchorSchema,
  SourceSnapshotSchema,
  TRANSFORMATION_TYPES,
  ThemeCollectionSchema,
} from './schema'
export type {
  Activity,
  ActivityKind,
  AssetDecl,
  ChangeEntry,
  ChangeTypeId,
  EditionArtifact,
  EditionKind,
  EditorialPolicy,
  ProductionItem,
  ReadingTarget,
  ReviewArtifact,
  ReviewBinding,
  ReviewCheckId,
  SourceAnchor,
  SourceSnapshot,
  StoryUnit,
  ThemeCollection,
} from './schema'
export {
  ALLOWED_CHANGE_TYPES,
  activitiesSha256,
  editionSha256,
  policyCore,
  requiredChecks,
  reviewBindingFor,
  reviewBindingSha256,
  validateEdition,
  validatePolicy,
  validateReview,
  validateSnapshot,
} from './validate'
export type { Checked, EditionContext, EditionResult, Issue, PolicyContext, ReviewResult, SourceContext } from './validate'
export { EVIDENCE_POLICY, countReleases, decideEdition, validateThemeCollection } from './plan'
export type { EditionDecision, PlanReason, PlanStatus, ReadingIdentity, ReleasePreview, ReviewEvidence } from './plan'
export {
  PLAN_OUT_RE,
  RESERVATION_SUFFIX,
  WORK_FILES,
  WorkdirError,
  exportEditionTasks,
  exportReviewTasks,
  openWorkDir,
  planWork,
  readResultFile,
  samePath,
  validateWork,
  writeNoClobber,
} from './workdir'
export { STORY_CLI_USAGE, parseStoryArgs, runStoryCli } from './cli'
export { ATTESTATION_SCHEMA, ATTESTATION_VALIDATOR, buildValidationAttestation, snapshotFromStored } from './attest'
export type { AttestationBinding, AttestationResult, AttestationStage, ValidationAttestation } from './attest'

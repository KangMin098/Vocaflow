// packages/library-pipeline/src/story/server.ts
//
// LCP Story 서버 배럴 — 패키지 exports `@vocaflow/library-pipeline/story` 의 대상. 계약: docs/LCP_STORY.md.
// apps/web 관리자 서버 액션(Server Action · 서버 전용 모듈)이 S2 검증기 · plan · 검증 증명 어댑터를 그대로 쓰게 한다.
//
// 싣지 않는 것: workdir(작업 폴더 — node:fs) · cli(로컬 드레인 명령). 그 둘은 scripts/lcp/story 만 쓴다(./index.ts).
// 브라우저 번들 금지: canonical.ts 가 node:crypto 를 쓴다. 클라이언트 컴포넌트는 `import type` 만 한다.

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
export type { EditionDecision, EditionState, PlanReason, PlanStatus, ReadingIdentity, ReleasePreview, ReviewEvidence } from './plan'
export { ATTESTATION_SCHEMA, ATTESTATION_VALIDATOR, buildValidationAttestation, snapshotFromStored } from './attest'
export type { AttestationBinding, AttestationResult, AttestationStage, ValidationAttestation } from './attest'

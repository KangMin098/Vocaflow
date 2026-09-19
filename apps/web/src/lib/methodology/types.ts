// apps/web/src/lib/methodology/types.ts
export const claimKinds = ['principle', 'condition', 'procedure', 'rationale', 'example', 'failure', 'exception', 'transfer'] as const
export type ClaimKind = typeof claimKinds[number]
export type Review = 'extracted' | 'reviewed' | 'rejected'
export type Dimension = 'age' | 'proficiency' | 'exam' | 'skill' | 'process' | 'question'
export interface Taxon { id: string; label: string; dimension: Dimension; parentId: string | null }
export interface Expert {
  id: string; name: string; organization: string; specialties: string[]
  profileSourceIds: string[]; researchStatus: 'candidate' | 'profile_verified'; verifiedAt: string
}
export interface Channel {
  id: string; name: string; url: string; expertIds: string[]
  relationship: 'personal' | 'platform' | 'institution' | 'guest' | 'reupload' | 'fan'
  verificationSourceIds: string[]; verifiedAt: string
}
export interface Source {
  id: string; title: string; url: string; kind: 'document' | 'video'
  expertIds: string[]; channelId: string | null; originGroup: string
  publishedAt: string | null; verifiedAt: string; revision: string
  access: 'metadata_only' | 'document_read' | 'transcript_read' | 'unavailable'
  rights: 'link_only' | 'analysis_permitted'; rightsBasis: string
  durationSeconds: number | null; taxonomyIds: string[]
  priority: 'high' | 'normal' | 'low'; priorityReason: string
}
export interface Method {
  id: string; statement: string; taxonomyIds: string[]; review: Review
  reviewedBy: string | null; reviewedAt: string | null
  /** Effectiveness is deliberately not inferred from agreement or marketing. */
  efficacy: 'not_assessed'; productApplications: string[]
}
export interface Claim {
  id: string; methodId: string; kind: ClaimKind; text: string; ordinal: number
  attribution: 'source_explicit' | 'analyst_inference'
}
export type Locator = { kind: 'section'; section: string } | { kind: 'time'; start: number; end: number }
export interface Evidence {
  id: string; claimId: string; sourceId: string; sourceRevision: string
  expertIds: string[]; locator: Locator; stance: 'supports' | 'qualifies' | 'opposes'
  note: string
}
export interface Relation {
  id: string; fromId: string; toId: string
  kind: 'equivalent_candidate' | 'contradicts' | 'context_differs' | 'complements'
  reason: string; evidenceIds: string[]; review: Review
}
export interface ResearchGap { id: string; taxonomyIds: string[]; question: string; nextAction: string }
export interface KnowledgeBundle {
  schemaVersion: 1; verifiedAt: string
  experts: Expert[]; channels: Channel[]; sources: Source[]; methods: Method[]
  claims: Claim[]; evidence: Evidence[]; relations: Relation[]; taxonomy: Taxon[]; gaps: ResearchGap[]
}

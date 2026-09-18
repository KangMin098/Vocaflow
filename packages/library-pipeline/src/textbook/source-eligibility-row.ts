// packages/library-pipeline/src/textbook/source-eligibility-row.ts
import type { SourceEligibilityInput } from './source-eligibility'

/** Lossless policy input projection. SQL cache validation uses these exact values. */
export const SOURCE_POLICY_SELECT = 'id,title,status,article_v_level,word_count,register,cefr_level,syntax_score,display_only,license_class,copyright_safe_in_kr,gate:csat_fit->gate,windows:csat_fit->make->windows'

export function sourceEligibilityInput(row: Record<string, unknown>, hasItems: boolean): SourceEligibilityInput {
  const gate = (row.gate ?? {}) as Record<string, unknown>
  const syntax = row.syntax_score as { score?: unknown } | null
  const str = (v: unknown): string | null => typeof v === 'string' ? v : null
  const num = (v: unknown): number | null => typeof v === 'number' ? v : null
  const bool = (v: unknown): boolean | null => typeof v === 'boolean' ? v : null
  return {
    title: str(row.title), status: str(row.status), articleVLevel: num(row.article_v_level),
    wordCount: num(row.word_count), register: str(row.register), cefrLevel: str(row.cefr_level),
    syntaxScore: syntax?.score == null ? null : Number(syntax.score), displayOnly: bool(row.display_only),
    licenseClass: str(row.license_class), copyrightSafeInKr: bool(row.copyright_safe_in_kr),
    gatePublishable: bool(gate.publishable), gateBlockedBy: str(gate.blockedBy),
    gateVerdict: str(gate.verdict), gatePurpose: str(gate.purpose), gateGenre: str(gate.genre),
    excerptWindows: Array.isArray(row.windows) ? row.windows.length : null,
    hasItems, outsidePct: null,
  }
}

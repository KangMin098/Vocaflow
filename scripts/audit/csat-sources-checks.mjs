// scripts/audit/csat-sources-checks.mjs
// Audit assertions; these do not change the production eligibility policy.
import { HARMFUL, PURPOSE_RULE } from '../csat/gate-rules.mjs'

export function compositionContradictions(gate, grade) {
  if (!['usable', 'excerpt'].includes(grade)) return []
  const findings = []
  // Reading-library poetry is explicitly allowed by decide(); report that scope
  // mismatch separately rather than treating all reject rows as the same bug.
  const readingPoetry = gate.purpose === 'library'
    && gate.genre === 'poetry-drama' && PURPOSE_RULE.library.allowPoetry
  if (gate.verdict === 'reject') findings.push(readingPoetry ? 'library_poetry_composable' : 'reject_composable')
  if (HARMFUL.has(gate.genre)) findings.push('harmful_composable')
  return findings
}

export function auditFailures(report) {
  const critical = ['reject_composable', 'harmful_composable', 'gate_decision_drift', 'invalid_analysis_composable',
    'cache_missing', 'cache_stale', 'cache_grade_drift', 'cefr_composer_exclusion', 'windows_without_items_composable']
  const failed = critical.filter(code => (report.findings[code]?.count ?? 0) > 0)
  const snapshot = report.snapshot
  if (snapshot && (snapshot.specStale || snapshot.inventoryDelta || snapshot.candidateDelta || Object.values(snapshot.gradeDelta).some(n => n !== 0))) failed.push('snapshot_drift')
  return failed
}

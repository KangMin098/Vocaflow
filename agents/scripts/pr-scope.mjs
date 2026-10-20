// agents/scripts/pr-scope.mjs — bind an approved exact-path contract to one PR head/base and commit count.
const SHA = /^[a-f0-9]{40}$/i
const validPath = (value) => typeof value === 'string' && value.length > 0 && !/[\\:\0*?]/.test(value)
  && !value.split('/').some((part) => !part || part === '.' || part === '..')

export function parseScope(raw) {
  const scope = JSON.parse(raw)
  if (!scope || scope.version !== 1 || !SHA.test(scope.head_sha ?? '') || !SHA.test(scope.base_sha ?? '')
    || scope.base_ref !== 'main' || !Number.isInteger(scope.expected_commits) || scope.expected_commits < 1
    || !Array.isArray(scope.expected_paths) || !scope.expected_paths.length
    || !scope.expected_paths.every(validPath) || new Set(scope.expected_paths).size !== scope.expected_paths.length) {
    throw new Error('PR scope 계약 오류: version·HEAD/base SHA·main·커밋 수·정확한 경로 목록을 확인한다')
  }
  return scope
}

export function checkScope(pr, scope) {
  const reasons = []
  if (pr.headRefOid !== scope.head_sha) reasons.push('PR_SCOPE_GUARD: 승인한 HEAD와 PR HEAD가 다르다')
  if (pr.baseRefName !== scope.base_ref || pr.baseSha !== scope.base_sha) reasons.push('PR_SCOPE_GUARD: 승인한 기준 브랜치/SHA가 바뀌었다')
  if (pr.commitCount !== scope.expected_commits) reasons.push(`PR_SCOPE_GUARD: 커밋 ${pr.commitCount ?? 'UNKNOWN'}개 ≠ 승인 ${scope.expected_commits}개`)
  const actual = (pr.files ?? []).map((file) => file.path)
  if (!actual.every(validPath) || new Set(actual).size !== actual.length) reasons.push('PR_SCOPE_GUARD: 실제 변경 경로가 비어 있거나 중복/비정상이다')
  const expected = new Set(scope.expected_paths), changed = new Set(actual)
  const extra = actual.filter((file) => !expected.has(file))
  const missing = scope.expected_paths.filter((file) => !changed.has(file))
  if (extra.length) reasons.push(`PR_SCOPE_GUARD: 범위 밖 ${extra.slice(0, 5).join(', ')}${extra.length > 5 ? ' 외 추가 경로' : ''}`)
  if (missing.length) reasons.push(`PR_SCOPE_GUARD: 승인 경로 누락 ${missing.slice(0, 5).join(', ')}`)
  return { ok: reasons.length === 0, reasons }
}

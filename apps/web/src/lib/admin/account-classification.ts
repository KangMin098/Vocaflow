// apps/web/src/lib/admin/account-classification.ts
//
// 계정을 「검증된 외부 학습자 / 내부(운영·개발·QA) / 미분류」로 나누는 **순수부**. 환경변수·DB 는 읽지 않는다
// (조회는 `retention.ts` 가 하고 이 모듈에 값만 넘긴다 — 클라이언트·vitest 도 같이 쓴다).
//
// ─────────────────────────────────────────────────────────────
// 왜 필요한가 (목표 VG-L3-D1-02 「실사용/테스트 데이터 분리」 · 2026-10-09)
//
// 리텐션 패널은 `auth.users` 전원을 학습자로 셌다. 실측 2026-10-09 에 계정 5개가 **전부 내부**였다
// (운영자 1 · 개발/검증 4) — 화면의 활성화·D7 은 사실상 우리 자신의 지표였다.
//
// 분류 근거의 우선순위 (ChatGPT 기획 REQ-20261009-001 · 사용자 승인 DL-0020)
//   1. 서버 소유 **명시적 목록**(계정 ID) — 내부 / 검증된 외부. 사람이 넣은 사실이라 1차 근거다.
//   2. 역할 admin·curator → **내부로만**. 역할로 「외부」를 확정하지는 않는다(일반 user 역할의 개발 계정이 있다).
//   3. 나머지 → **미분류**. 실사용 지표에 넣지 않는다(fail-closed) — 오분류가 외부 지표를 부풀리지 않게.
//   이메일 도메인(example.com · .local · vocaflow.dev 등)은 **힌트만** 낸다: 「미분류 중 내부로 보이는 수」를
//   보여 목록 정비를 돕지만, 그것만으로 내부/외부를 확정하지 않는다(개인 도메인 운영자 · 외부 QA 가 있다).
//
// 다음 단계(PROPOSED DL-0017): 승인된 DB `user_type` 또는 중앙 분류로 옮기고 퍼널·효과 분석도 같은 계약을 쓴다.
// 그 전까지 이 모듈의 결과는 **리텐션 패널에만** 적용된다 — VG-L3-D1-02-AC1 은 부분 충족이다.
// ─────────────────────────────────────────────────────────────

export type AccountClass = 'external_verified' | 'internal' | 'unknown'
export type ClassSource = 'registry_internal' | 'registry_external' | 'role' | 'none'

export interface AccountRegistry {
  internal: ReadonlySet<string>
  externalVerified: ReadonlySet<string>
}

export type RegistryParse =
  | { status: 'ok' | 'not_configured'; registry: AccountRegistry }
  | { status: 'invalid'; errors: string[] }

/** 내부로만 판정하는 역할 — `user_profiles.role` 허용값 user/admin/curator 중 운영 역할. */
export const INTERNAL_ROLES: readonly string[] = ['admin', 'curator']

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function splitIds(raw: string | undefined | null): string[] {
  if (!raw) return []
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * 서버 설정 문자열(쉼표·공백 구분 UUID) 두 개를 목록으로 만든다.
 * 오류 문구에 **계정 ID 를 넣지 않는다**(화면까지 올라간다) — 몇 번째 항목인지만 말한다.
 */
export function parseAccountRegistry(internalRaw?: string | null, externalRaw?: string | null): RegistryParse {
  const internal = splitIds(internalRaw)
  const external = splitIds(externalRaw)
  if (internal.length === 0 && external.length === 0) {
    return { status: 'not_configured', registry: { internal: new Set(), externalVerified: new Set() } }
  }
  const errors: string[] = []
  const check = (ids: string[], label: string) => {
    const seen = new Set<string>()
    ids.forEach((id, i) => {
      if (!UUID_RE.test(id)) errors.push(`${label} 목록 ${i + 1}번째 항목이 계정 ID(UUID) 형식이 아니다`)
      if (seen.has(id)) errors.push(`${label} 목록 ${i + 1}번째 항목이 중복이다`)
      seen.add(id)
    })
    return seen
  }
  const inSet = check(internal, '내부')
  const exSet = check(external, '검증된 외부')
  const both = [...inSet].filter((id) => exSet.has(id)).length
  if (both > 0) errors.push(`내부·검증된 외부 두 목록에 같은 계정이 ${both}개 있다`)
  if (errors.length) return { status: 'invalid', errors }
  return { status: 'ok', registry: { internal: inSet, externalVerified: exSet } }
}

const RESERVED_TLDS = ['test', 'example', 'invalid', 'localhost', 'local']
const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org']
const OWN_INTERNAL_DOMAINS = ['vocaflow.dev', 'vocaflow.local']

/** 예약(RFC 2606·6761)·자사 내부 도메인인가 — **힌트 전용**. 내부/외부 확정에 쓰지 않는다. */
export function isInternalDomainHint(email: string | null | undefined): boolean {
  const at = email?.lastIndexOf('@') ?? -1
  if (!email || at < 0) return false
  const domain = email.slice(at + 1).trim().toLowerCase()
  if (!domain) return false
  const tld = domain.split('.').pop() ?? ''
  if (RESERVED_TLDS.includes(tld)) return true
  const under = (d: string) => domain === d || domain.endsWith(`.${d}`)
  return RESERVED_DOMAINS.some(under) || OWN_INTERNAL_DOMAINS.some(under)
}

export interface AccountInput {
  id: string
  role?: string | null
  email?: string | null
}

export interface Classified {
  cls: AccountClass
  source: ClassSource
  /** 미분류인데 도메인이 내부처럼 보인다(목록 정비 대상) */
  internalHint: boolean
  /** 검증된 외부 목록에 있으나 운영 역할이다 — 내부로 판정하고 따로 센다 */
  conflict: boolean
}

export function classifyAccount(a: AccountInput, registry: AccountRegistry): Classified {
  const id = a.id.toLowerCase()
  const roleInternal = !!a.role && INTERNAL_ROLES.includes(a.role)
  if (registry.internal.has(id)) return { cls: 'internal', source: 'registry_internal', internalHint: false, conflict: false }
  if (registry.externalVerified.has(id)) {
    // 운영 역할이 「외부 학습자」로 등록됐다 — 외부를 부풀리지 않는 쪽(내부)으로 판정하고 충돌로 센다
    if (roleInternal) return { cls: 'internal', source: 'role', internalHint: false, conflict: true }
    return { cls: 'external_verified', source: 'registry_external', internalHint: false, conflict: false }
  }
  if (roleInternal) return { cls: 'internal', source: 'role', internalHint: false, conflict: false }
  return { cls: 'unknown', source: 'none', internalHint: isInternalDomainHint(a.email), conflict: false }
}

/** 화면으로 올라가는 요약 — **수만** 담는다(계정 ID·이메일·목록 내용 없음). */
export interface AccountSummary {
  total: number
  externalVerified: number
  internal: number
  unknown: number
  /** 미분류 중 도메인이 내부처럼 보이는 수 */
  unknownInternalHint: number
  /** 검증된 외부 목록에 오른 운영 역할 계정 수(내부로 판정) */
  conflicts: number
  registry: 'ok' | 'not_configured'
}

export function summarizeAccounts(classified: readonly Classified[], registryStatus: 'ok' | 'not_configured'): AccountSummary {
  const s: AccountSummary = { total: classified.length, externalVerified: 0, internal: 0, unknown: 0, unknownInternalHint: 0, conflicts: 0, registry: registryStatus }
  for (const c of classified) {
    if (c.cls === 'external_verified') s.externalVerified += 1
    else if (c.cls === 'internal') s.internal += 1
    else {
      s.unknown += 1
      if (c.internalHint) s.unknownInternalHint += 1
    }
    if (c.conflict) s.conflicts += 1
  }
  return s
}

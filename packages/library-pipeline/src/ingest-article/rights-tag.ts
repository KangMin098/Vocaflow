// packages/library-pipeline/src/ingest-article/rights-tag.ts
//
// 권리 표지(rights tag) — 원문을 **담을지 말지가 아니라, 무엇을 알고 담았는지** 적는다.
//
// DD-75(2026-09-24 재확인): 저작권·라이선스는 보존 기준이 아니다. 라이선스 때문에 원문을
//   버리지 않는다. 확인 단계는 표지를 붙여 아래로 넘길 뿐이고, 서비스 차단은 발행 적격
//   (source-eligibility.ts 법적 축 · DB 트리거가 `license` 문자열로 license_class 를 도출)이 맡는다.
//
// 표지는 **원문 한 편마다** 판정한다. 컬렉션 전체에 붙은 기본값(예: "PLOS 는 전부 CC BY")은
//   `evidence: 'collection-default'` 로 남겨 해소가 필요하다고 표시한다 — 검증한 척하지 않는다.
//
// 저장 위치: `library_articles.csat_fit.rights` (jsonb 키 하나 — 기존 키를 덮지 않고 합친다).

export type RightsClass =
  | 'PD'
  | 'CC0'
  | 'BY'
  | 'BY-SA'
  | 'BY-NC'
  | 'BY-NC-SA'
  | 'BY-ND'
  | 'BY-NC-ND'
  | 'copyrighted'
  | 'unknown'

/** 라이선스를 어디서 읽었는가. 뒤의 둘은 원문 단위 확인이 아니다. */
export type RightsEvidence = 'page' | 'api' | 'jats' | 'feed' | 'collection-default' | 'none'

export interface RightsTagInput {
  license: string | null | undefined
  licenseEvidence?: RightsEvidence | null
  author?: string | null
  publishedAt?: string | Date | null
  sourceUrl?: string | null
}

export interface RightsTag {
  class: RightsClass
  /** 찾은 그대로의 표기(없으면 'unknown'). */
  license: string
  evidence: RightsEvidence
  attribution: { author: string | null; year: number | null; url: string | null }
  needsResolution: boolean
  v: 1
}

const OPEN_CLASSES: ReadonlySet<RightsClass> = new Set<RightsClass>(['PD', 'CC0', 'BY', 'BY-SA'])
const UNVERIFIED_EVIDENCE: ReadonlySet<RightsEvidence> = new Set<RightsEvidence>(['collection-default', 'none'])

/**
 * 자유 표기 → 등급. 코드(`CC-BY-4.0`) · 사람 표기(`CC BY 4.0`, `cc by-nc`) · CC 주소를 모두 읽는다.
 * 읽지 못하면 'unknown' — **추측하지 않는다.**
 */
export function rightsClassOf(license: string | null | undefined): RightsClass {
  const raw = (license ?? '').trim().toLowerCase()
  if (!raw || raw === 'unknown') return 'unknown'
  if (/publicdomain\/zero|\bcc0\b|cc-zero/.test(raw)) return 'CC0'
  if (/public[\s_-]*domain|publicdomain\/mark|\bpd\b/.test(raw)) return 'PD'

  // 주소 꼴: creativecommons.org/licenses/by-nc-sa/4.0
  const url = raw.match(/creativecommons\.org\/licenses\/([a-z-]+)/)?.[1]
  const body = url ?? raw.replace(/creative\s*commons|attribution/g, (m) => (m.startsWith('attr') ? 'by' : 'cc'))
  const isCc = url
    ? url.split('-').includes('by')
    : /\bcc\b|cc[-_ ]?by/.test(body) && /\bby\b|cc[-_ ]?by/.test(body)
  if (!isCc) {
    // CC 표기가 없을 때만 저작권 표기를 본다 — "© 저자, CC BY 4.0" 은 BY 다.
    return /all rights reserved|copyright|©|restricted|proprietary/.test(raw) ? 'copyrighted' : 'unknown'
  }
  const nc = /\bnc\b|non-?commercial|noncommercial/.test(body)
  const nd = /\bnd\b|no-?deriv|noderiv/.test(body)
  const sa = /\bsa\b|share-?alike|sharealike/.test(body)
  if (nc && nd) return 'BY-NC-ND'
  if (nc && sa) return 'BY-NC-SA'
  if (nc) return 'BY-NC'
  if (nd) return 'BY-ND'
  if (sa) return 'BY-SA'
  return 'BY'
}

function yearOf(v: string | Date | null | undefined): number | null {
  if (!v) return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getUTCFullYear()
  const m = String(v).match(/\b(1[5-9]\d\d|20\d\d)\b/)
  return m ? Number(m[1]) : null
}

/** 원문 한 편의 권리 표지. 순수 함수 — 시계·네트워크를 읽지 않는다. */
export function rightsTag(input: RightsTagInput): RightsTag {
  const trimmed = (input.license ?? '').trim()
  // 'unknown' 은 적재기가 "못 찾았다" 로 적은 값이다 — 찾은 표기로 세지 않는다.
  const found = trimmed.toLowerCase() === 'unknown' ? '' : trimmed
  const license = found || 'unknown'
  const cls = rightsClassOf(found)
  const evidence: RightsEvidence = found ? (input.licenseEvidence ?? 'feed') : 'none'
  const needsResolution = !OPEN_CLASSES.has(cls) || UNVERIFIED_EVIDENCE.has(evidence)
  return {
    class: cls,
    license,
    evidence,
    attribution: {
      author: (input.author ?? '').trim() || null,
      year: yearOf(input.publishedAt),
      url: (input.sourceUrl ?? '').trim() || null,
    },
    needsResolution,
    v: 1,
  }
}

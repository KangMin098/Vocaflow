// apps/web/src/lib/textfit/share.ts
//
// 레벨 프로파일 공유 — **결과만** URL 에 담는다. 지문은 담지 않는다.
//
// 왜 지문을 담지 않나 (설계 제약이지 최적화가 아니다):
//   이 화면에 붙여넣는 것은 대체로 교과서·모의고사·수업 프린트다. 검정교과서 저작권은
//   발행 출판사에 있고, 수능 지문은 평가원조차 대법원에서 저작권료 지급 판결을 받았다.
//   그걸 서버에 저장하거나 링크에 실어 유통하면 **우리가 복제·배포 주체가 된다.**
//   → 서버 저장 0. 링크에는 커버리지 숫자와 **단어 목록**만 담는다.
//     낱말 목록은 지문의 표현을 재현하지 않는다(문장·순서·구성이 사라진다).
//
// 왜 서버 저장이 아니라 URL 인가:
//   저장하면 테이블·마이그레이션·만료 정책·삭제 요청 처리가 따라온다. 공유 하나에
//   개인정보 처리 책임을 지는 구조를 만들 이유가 없다. URL 자체가 저장소다.
//
// 신뢰 모델: 링크는 **위조 가능**하다(서명하지 않는다). 그래서 화면은 이 결과를
//   "공유된 결과" 로 명시하고, 받는 사람이 자기 지문으로 다시 돌릴 수 있게 한다.
//   서명을 붙이면 키 관리가 생기는데 얻는 것은 "남이 숫자를 바꿔 자랑하는 것" 방지뿐이다.

import { bandFor } from './coverage'
import { LEVEL_LABEL, PROFILE_LEVELS } from './profile'
import type { LevelProfile, LevelReading, ProfileLevel, PublicWord } from './profile'

/** 페이로드 스키마 버전. 형식이 바뀌면 올리고, 옛 링크는 조용히 무시된다. */
const VERSION = 1

/** 링크에 담는 최대 단어 수 — URL 길이와 유용성의 절충. */
const MAX_SHARED_WORDS = 16

/** 단어 하나의 최대 길이 — 비정상 입력이 URL 을 부풀리지 못하게. */
const MAX_WORD_LEN = 32

/** 디코딩을 시도할 최대 길이 — 이보다 길면 우리가 만든 링크가 아니다. */
const MAX_PAYLOAD_LEN = 4000

/**
 * 쿼리 파라미터 이름 — **구버전 링크 호환용으로만 남는다.**
 *
 * 처음에는 `/fit?r=<payload>` 였다. 그런데 Next 의 `opengraph-image.tsx` 는
 * **라우트 세그먼트(`params`)만 받고 `searchParams` 는 받지 못한다** — 크롤러가 가져가는
 * og:image URL 에 페이로드가 실리지 않아 미리보기에 결과 곡선을 그릴 수 없었다(2026-08-17 실측).
 * → 공유 주소를 `/fit/s/<payload>` 로 옮겼다. 새 링크는 전부 이쪽이다.
 */
export const SHARE_PARAM = 'r'

/** 공유 경로 접두사 — `/fit/s/<payload>`. */
export const SHARE_PATH = '/fit/s'

/**
 * 압축 배열 형식 — 키 이름을 빼서 URL 을 짧게 유지한다.
 *   [ v, fitLevel, textVLevel, totalTokens, uniqueContentWords,
 *     uncertainPermille, resolvedPermille, [coverageHigh×8 (‰)], [[word, vLevel], …] ]
 * 0 은 "없음"(null)을 뜻한다 — fitLevel·textVLevel 은 1 미만 값이 존재하지 않는다.
 *
 * ⚠️ `uncertain` 과 `resolved` 는 **분모가 다르다** — 파생하려다 틀렸다(회귀로 고정).
 *    uncertain = 레벨 미상 토큰 / **러닝 워드**   (커버리지 범위의 폭)
 *    resolved  = 레벨 확인 토큰 / **내용어 토큰** (화면 문구 "단어의 N%를 확인했어요")
 *    하나에서 다른 하나를 계산할 수 없으므로 둘 다 싣는다.
 */
type Payload = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number[],
  [string, number][],
]

/** 페이로드 원소 개수 — 형식 검증에 쓴다. */
const PAYLOAD_LEN = 9

const clampInt = (n: unknown, lo: number, hi: number): number => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return Math.max(lo, Math.min(hi, Math.round(v)))
}

// ── base64url (UTF-8 안전) ──────────────────────────────────────────────────

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

// ── 인코딩 ──────────────────────────────────────────────────────────────────

/**
 * 프로파일을 공유 문자열로. 지문·개인정보는 포함하지 않는다.
 *
 * 불확실 폭은 모든 레벨이 공유하므로 **한 번만** 싣는다(‰ 단위) —
 * 받는 쪽에서 상한/하한을 그대로 복원한다.
 */
export function encodeProfile(profile: LevelProfile): string {
  const first = profile.readings[0]
  // uncertainShare = coverageHigh - coverageLow (모든 레벨에서 같은 값이다)
  const uncertain = first ? Math.max(0, first.coverageHigh - first.coverageLow) : 0

  const payload: Payload = [
    VERSION,
    profile.fitLevel ?? 0,
    profile.textVLevel ?? 0,
    clampInt(profile.totalTokens, 0, 9_999_999),
    clampInt(profile.uniqueContentWords, 0, 999_999),
    clampInt(uncertain * 1000, 0, 1000),
    clampInt(profile.resolvedShare * 1000, 0, 1000),
    profile.readings.map((r) => clampInt(r.coverageHigh * 1000, 0, 1000)),
    profile.hardestWords
      .filter((w) => w.vLevel !== null)
      .slice(0, MAX_SHARED_WORDS)
      .map((w) => [w.surface.slice(0, MAX_WORD_LEN), w.vLevel!] as [string, number]),
  ]

  return toBase64Url(JSON.stringify(payload))
}

// ── 디코딩 ──────────────────────────────────────────────────────────────────

/** 공유 단어 목록을 복원한다 — 형식이 안 맞는 항목은 조용히 건너뛴다. */
function decodeWords(raw: unknown): PublicWord[] {
  if (!Array.isArray(raw)) return []

  const out: PublicWord[] = []
  for (const entry of raw) {
    if (out.length >= MAX_SHARED_WORDS) break
    if (!Array.isArray(entry) || entry.length !== 2) continue

    const [w, lvl] = entry as [unknown, unknown]
    if (typeof w !== 'string' || typeof lvl !== 'number') continue

    const surface = w.slice(0, MAX_WORD_LEN).trim()
    if (surface.length === 0) continue

    out.push({
      surface,
      lemma: surface.toLowerCase(),
      // 공유 요약에는 원문 빈도가 없다 — 1 로 두고 화면에서 쓰지 않는다.
      count: 1,
      status: 'leveled',
      vLevel: clampInt(lvl, 1, 11),
    })
  }
  return out
}

/**
 * 공유 문자열을 프로파일로. **어떤 입력이 와도 throw 하지 않는다** —
 * 손상·위조·구버전 링크는 전부 `null` 로 떨어지고 화면은 평소대로 뜬다.
 */
export function decodeProfile(raw: string | null | undefined): LevelProfile | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_PAYLOAD_LEN) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(fromBase64Url(raw))
  } catch {
    return null
  }

  if (!Array.isArray(parsed) || parsed.length !== PAYLOAD_LEN) return null
  const [v, fit, tv, tt, uc, uncertainPermille, resolvedPermille, covs, words] = parsed as Payload

  if (v !== VERSION) return null
  if (!Array.isArray(covs) || covs.length !== PROFILE_LEVELS.length) return null

  const uncertain = clampInt(uncertainPermille, 0, 1000) / 1000

  const readings: LevelReading[] = PROFILE_LEVELS.map((level, i) => {
    const coverageHigh = clampInt(covs[i], 0, 1000) / 1000
    const coverageLow = Math.max(0, coverageHigh - uncertain)
    const coverage = Math.max(0, coverageHigh - uncertain / 2)
    return {
      level,
      label: LEVEL_LABEL[level],
      coverage,
      coverageLow,
      coverageHigh,
      band: bandFor(coverage),
      // 공유 요약에는 단어 단위 정보가 없다 — 0 으로 두고 화면에서 쓰지 않는다.
      unknownWords: 0,
    }
  })

  // 단조성 검증 — 레벨이 올라가는데 커버리지가 내려가면 위조이거나 손상이다.
  // 화면에 뒤집힌 곡선을 그리느니 링크를 버린다.
  for (let i = 1; i < readings.length; i++) {
    if (readings[i]!.coverageHigh < readings[i - 1]!.coverageHigh - 1e-9) return null
  }

  const fitLevel = (PROFILE_LEVELS as readonly number[]).includes(fit)
    ? (fit as ProfileLevel)
    : null
  const textVLevel = typeof tv === 'number' && tv >= 1 && tv <= 11 ? Math.round(tv) : null

  return {
    totalTokens: clampInt(tt, 0, 9_999_999),
    uniqueContentWords: clampInt(uc, 0, 999_999),
    readings,
    fitLevel,
    textVLevel,
    // 명시적으로 실어 온 값을 쓴다 — 불확실 폭에서 역산하면 분모가 달라 틀린다(위 Payload 주석).
    resolvedShare: clampInt(resolvedPermille, 0, 1000) / 1000,
    hardestWords: decodeWords(words),
    // 근거 분해는 공유하지 않는다(원문 토큰 구성이라 요약에 담을 값이 아니다).
    breakdown: { leveled: 0, unleveled: 0, unresolved: 0, function_word: 0 },
  }
}

/** 공유할 만한 내용이 있는가. */
export function isShareable(profile: LevelProfile | null): profile is LevelProfile {
  return profile !== null && profile.uniqueContentWords > 0
}

/**
 * 공유 URL 을 만든다. origin 은 호출부가 준다(SSR 안전).
 *
 * 페이로드는 base64url(A–Z a–z 0–9 - _)이라 **경로 세그먼트에 그대로 넣어도 안전**하다 —
 * 인코딩이 필요 없고, 링크가 메신저에서 잘려도 형태가 망가지지 않는다.
 */
export function buildShareUrl(origin: string, profile: LevelProfile): string {
  return `${origin}${SHARE_PATH}/${encodeProfile(profile)}`
}

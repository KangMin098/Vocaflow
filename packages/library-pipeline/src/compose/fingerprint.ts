// packages/library-pipeline/src/compose/fingerprint.ts
//
// ACP §20 재저작(compose) — 표현 지문(shingle fingerprint).
//
// 왜 원문이 아니라 지문인가 (설계의 법적 축):
//   재저작 파이프라인은 소스 기사 원문을 **저장하지 않는다**. 저장하면 그 순간 복제물을
//   보유·전송하는 것이고, 우리가 피하려던 바로 그 지점이다. 그런데 표현 독립성 검사
//   (Wainwright/Comline 패턴 차단)는 "우리 초안이 원문과 겹치는가"를 물으므로 비교 대상이 필요하다.
//
//   해법: 원문을 7-gram 단위로 잘라 **단방향 해시 집합**만 남긴다.
//     · 해시 집합에서 원문 문장을 복원할 수 없다 (순서·어형·연결 정보가 전부 소실).
//     · 그런데 "이 문장이 원문에 있었는가"는 정확히 답할 수 있다.
//   즉 지문은 복제물이 아니라 **대조 계측기**다. 원문 텍스트는 수집 작업 안에서만 존재하고
//   지문을 뜬 뒤 폐기된다.
//
// 해시 충돌: FNV-1a 32bit. 문서당 shingle ~2,000 개 기준 두 문서 비교 시 우연 일치 기댓값은
//   2000×2000/2^32 ≈ 0.001 개 — 게이트 판정에 영향 없는 수준. 대신 32bit 는 무차별 역산으로
//   후보 어절열을 만들 수 있으므로 지문은 **원문 대체재가 아니다**는 전제를 유지한다
//   (역산해도 그 후보가 원문이었는지 확인할 방법이 없다).

/** 지문 — 원문 복원 불가. n-gram 해시 집합 + 규모 메타. */
export interface Fingerprint {
  /** shingle 길이 (어절 수) */
  n: number
  /** shingle 해시 (오름차순 hex 8자리 · 중복 제거) */
  hashes: string[]
  /** 지문 생성에 쓰인 토큰(어절) 수 — 규모 대조용 */
  tokenCount: number
}

/** 표현 겹침 1건 — 초안 쪽 위치와 실제 문구(우리 글이므로 인용 안전). */
export interface VerbatimRun {
  /** 초안 토큰 배열에서의 시작 인덱스 */
  startToken: number
  /** 연속 일치 구간의 어절 수 (n 이상) */
  wordCount: number
  /** 초안에서 해당 구간 문구 */
  text: string
}

/** 기본 shingle 길이. 표절 검출 관행(7~8어절) + 영어 상투구가 우연히 7어절 일치하기 어려운 지점. */
export const DEFAULT_SHINGLE_N = 7

/**
 * 영어 산문 → 비교용 토큰열.
 * 소문자화 · 어절 내 아포스트로피 보존 · 그 외 구두점/기호는 경계로 처리.
 * (구두점을 살리면 같은 문장이 인용부호 유무만으로 다른 지문이 된다.)
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ')
    .replace(/(^|\s)'+|'+(\s|$)/g, '$1$2')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
}

/** FNV-1a 32bit → 8자리 hex. */
function hashToken(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** 토큰열 → shingle 해시 배열 (위치 보존, 중복 미제거). */
function shingleHashes(tokens: string[], n: number): string[] {
  if (tokens.length < n) return []
  const out: string[] = []
  for (let i = 0; i + n <= tokens.length; i++) {
    out.push(hashToken(tokens.slice(i, i + n).join(' ')))
  }
  return out
}

/** 원문 텍스트 → 지문. 호출 직후 원문은 폐기하는 것이 이 파이프라인의 규약이다. */
export function buildFingerprint(text: string, n: number = DEFAULT_SHINGLE_N): Fingerprint {
  const tokens = tokenize(text)
  const hashes = [...new Set(shingleHashes(tokens, n))].sort()
  return { n, hashes, tokenCount: tokens.length }
}

/** 두 지문의 교집합 크기. */
export function sharedCount(a: Fingerprint, b: Fingerprint): number {
  const smaller = a.hashes.length <= b.hashes.length ? a : b
  const larger = smaller === a ? b : a
  const set = new Set(larger.hashes)
  let n = 0
  for (const h of smaller.hashes) if (set.has(h)) n++
  return n
}

/**
 * 포함도 — |A∩B| / |A|. "A 의 표현이 B 안에 얼마나 들어 있나".
 * 통신사 재게재 판정에 쓴다: 짧은 축약본이 원본에 거의 통째로 포함되는 비대칭을 잡아야 하므로
 * 대칭 지표(jaccard)로는 부족하다.
 */
export function containment(a: Fingerprint, b: Fingerprint): number {
  if (a.hashes.length === 0) return 0
  return sharedCount(a, b) / a.hashes.length
}

/** 자카드 유사도 — 양방향 유사성(참고 표시용). */
export function jaccard(a: Fingerprint, b: Fingerprint): number {
  const inter = sharedCount(a, b)
  const union = a.hashes.length + b.hashes.length - inter
  return union === 0 ? 0 : inter / union
}

/**
 * 초안에서 소스 지문과 겹치는 구간을 찾아 **연속 구간으로 병합**해 반환.
 *
 * 병합이 핵심이다 — 7-gram 일치가 4개 연속이면 실제로는 10어절 연속 복제이고,
 * "일치 4건" 이 아니라 "10어절 구간 1건" 으로 봐야 심각도를 옳게 판정한다.
 */
export function findVerbatimRuns(draft: string, source: Fingerprint): VerbatimRun[] {
  const tokens = tokenize(draft)
  const n = source.n
  const hits = shingleHashes(tokens, n)
  const set = new Set(source.hashes)

  const runs: VerbatimRun[] = []
  let runStart = -1
  let runEnd = -1 // 마지막으로 일치한 shingle 의 시작 인덱스

  const flush = (): void => {
    if (runStart < 0) return
    const end = runEnd + n // exclusive
    runs.push({
      startToken: runStart,
      wordCount: end - runStart,
      text: tokens.slice(runStart, end).join(' '),
    })
    runStart = -1
    runEnd = -1
  }

  for (let i = 0; i < hits.length; i++) {
    if (set.has(hits[i]!)) {
      if (runStart < 0) runStart = i
      else if (i > runEnd + 1) {
        flush()
        runStart = i
      }
      runEnd = i
    }
  }
  flush()

  return runs.sort((a, b) => b.wordCount - a.wordCount || a.startToken - b.startToken)
}

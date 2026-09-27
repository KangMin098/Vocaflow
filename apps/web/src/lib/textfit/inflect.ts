// apps/web/src/lib/textfit/inflect.ts
//
// 표면형 → 표제어 **후보** 생성기 (순수 함수).
//
// 왜 TS 에 있나: 정본 해석기 `resolve_dict_headword` 는 anon 이 EXECUTE 할 수 있지만
// **스칼라 함수라 단어마다 왕복**이 필요하다(지문 하나에 300회). 공개 화면에서는 쓸 수 없다.
// 그래서 여기서는 **후보만** 만들고, 실제 판정은 DB 가 한다 —
// 후보 전부를 한 번의 `.in('lemma', candidates)` 로 던지고 **맞는 것만 돌아온다**.
// 즉 이 파일은 "이 단어의 원형은 X 다" 라고 주장하지 않는다. "X 일 수도 있다" 만 만든다.
// 틀린 후보는 DB 에 없으므로 조용히 버려진다 — 오탐이 학습자에게 새는 경로가 없다.
//
// ⚠️ 불규칙 변화형(went→go)은 이 파일이 다루지 않는다 — **순수 함수라 표를 읽을 수 없다**.
//    337쌍은 DB 의 `english_irregular_forms` 에 있고 `en_inflection_bases()` 가 읽는다.
//    정본 경로 `resolveLevelsPublic()`(`textfit_resolve_levels_public`, SECURITY DEFINER)은
//    그 함수를 거치므로 불규칙형을 해석한다 — 이 파일은 그 RPC 가 죽었을 때의 폴백이고,
//    폴백에서만 went→go 가 빠져 **레벨 미상**으로 남는다.
//
//    (2026-08-17~2026-09-23 에는 다른 이유로도 빠져 있었다: 그 표가 RLS 는 켜졌는데 정책이 0개라
//     SECURITY INVOKER 경로(`resolve_dict_headword`·`lookup_word_meaning`)에서 조용히 0행이었다.
//     정책 `english_irregular_forms_read` 로 고쳤고, anon 으로 `en_inflection_bases('went')` =
//     `{go}` 를 실측 확인했다. 마이그레이션 20260923104145.)

/** 자음 (y 제외 — y 는 -ies/-ied 규칙에서 따로 다룬다). */
const CONSONANT = /[bcdfghjklmnpqrstvwxz]/

/** 마지막 자음이 겹친 형태인가 — "stopped" → "stop", "running" → "run" */
function hasDoubledFinal(stem: string): boolean {
  const n = stem.length
  if (n < 3) return false
  const a = stem[n - 1]!
  const b = stem[n - 2]!
  // "ll"/"ss"/"ff"/"zz" 는 원형에서도 흔하다("small","pass") — 되돌리면 없는 단어를 만든다.
  if (a !== b) return false
  if (a === 'l' || a === 's' || a === 'f' || a === 'z') return false
  return CONSONANT.test(a)
}

/** 접미사를 떼고 나올 수 있는 어간들. 짧은 조각은 만들지 않는다(2자 미만은 단어가 아니다). */
function stripSuffix(word: string, suffix: string, extras: (stem: string) => string[]): string[] {
  if (!word.endsWith(suffix)) return []
  const stem = word.slice(0, -suffix.length)
  if (stem.length < 2) return []
  return [stem, ...extras(stem)].filter((s) => s.length >= 2)
}

/**
 * 규칙 굴절 되돌리기 후보. 원형 자신을 **항상 첫 번째**로 포함한다
 * (사전에 그 형태 그대로 실린 단어가 우선이어야 한다 — "news" 를 "new" 로 접으면 안 된다).
 *
 * 반환 순서 = 우선순위. 호출부는 먼저 맞는 후보를 채택한다.
 */
export function inflectionCandidates(surface: string): string[] {
  const w = surface.toLowerCase().trim()
  if (w.length < 2) return w.length > 0 ? [w] : []

  const out: string[] = [w]

  // 복수 / 3인칭 단수 — -ies → -y, -es, -s
  out.push(...stripSuffix(w, 'ies', (s) => [`${s}y`]))
  out.push(...stripSuffix(w, 'es', () => []))
  if (!w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) {
    out.push(...stripSuffix(w, 's', () => []))
  }

  // 과거 / 과거분사 — -ied → -y, -ed (+ 어간 e 복원, 겹자음 복원)
  out.push(...stripSuffix(w, 'ied', (s) => [`${s}y`]))
  out.push(
    ...stripSuffix(w, 'ed', (s) => {
      const alts = [`${s}e`]
      if (hasDoubledFinal(s)) alts.push(s.slice(0, -1))
      return alts
    }),
  )

  // 진행형 — -ing (+ 어간 e 복원, 겹자음 복원)
  out.push(
    ...stripSuffix(w, 'ing', (s) => {
      const alts = [`${s}e`]
      if (hasDoubledFinal(s)) alts.push(s.slice(0, -1))
      return alts
    }),
  )

  // 비교급 / 최상급 — -er, -est (+ e 복원, 겹자음 복원, -ier → -y)
  out.push(...stripSuffix(w, 'iest', (s) => [`${s}y`]))
  out.push(...stripSuffix(w, 'ier', (s) => [`${s}y`]))
  out.push(
    ...stripSuffix(w, 'est', (s) => {
      const alts = [`${s}e`]
      if (hasDoubledFinal(s)) alts.push(s.slice(0, -1))
      return alts
    }),
  )
  out.push(
    ...stripSuffix(w, 'er', (s) => {
      const alts = [`${s}e`]
      if (hasDoubledFinal(s)) alts.push(s.slice(0, -1))
      return alts
    }),
  )

  // 부사 -ly — 형용사 원형으로. "happily" → "happy"
  //
  // ⚠️ 어간 4자 하한이 있다. 다른 규칙과 달리 여기서는 과생성이 **실재하는 다른 단어**를 만든다:
  //    apply→app · only→on · family→fam(-ily) · reply→rep.
  //    다른 접미사는 잘못 벗겨도 없는 조각이 나와 DB 에서 조용히 버려지지만, 이쪽은 사전에
  //    실제로 있는 단어라 원형이 미등재일 때 **엉뚱한 레벨이 붙는다**.
  if (adverbStem(w, 'ily').length >= 4) {
    out.push(...stripSuffix(w, 'ily', (s) => [`${s}y`]))
  }
  if (adverbStem(w, 'ly').length >= 4) {
    out.push(...stripSuffix(w, 'ly', () => []))
  }

  // 연쇄 굴절 — 영어에서 실제로 겹치는 조합은 -ed/-ing + -ly 다.
  //   "repeatedly" → (ly) "repeated" → (ed) "repeat".
  //   실측(2026-08-17): 굴절 프로브 20개 중 19개는 한 단계로 풀렸고 유일하게 못 푼 것이
  //   이 형태였다. 한 단계만 더 벗긴다 — 더 깊이 가면 없는 단어를 만들기 시작한다.
  out.push(...chainFromAdverb(w))

  // 중복 제거하되 순서(우선순위) 유지.
  return [...new Set(out)]
}

/** 부사 접미사를 뗀 어간 (없으면 빈 문자열) — 4자 하한 판정용. */
function adverbStem(word: string, suffix: 'ly' | 'ily'): string {
  return word.endsWith(suffix) ? word.slice(0, -suffix.length) : ''
}

/** `-ly` 를 떼고 남은 어간에서 한 번 더 -ed/-ing 를 벗긴다(2단 한정). */
function chainFromAdverb(word: string): string[] {
  if (!word.endsWith('ly')) return []
  const stem = word.slice(0, -2)
  if (stem.length < 4) return []

  const out: string[] = []
  out.push(
    ...stripSuffix(stem, 'ed', (s) => {
      const alts = [`${s}e`]
      if (hasDoubledFinal(s)) alts.push(s.slice(0, -1))
      return alts
    }),
  )
  out.push(
    ...stripSuffix(stem, 'ing', (s) => {
      const alts = [`${s}e`]
      if (hasDoubledFinal(s)) alts.push(s.slice(0, -1))
      return alts
    }),
  )
  return out
}

/**
 * 여러 표면형의 후보를 한 번에 모은다 — DB 왕복 1회를 위한 전량 수집.
 * 반환: 조회에 넣을 후보 집합 + 표면형별 우선순위 목록.
 */
export function collectCandidates(surfaces: string[]): {
  all: string[]
  bySurface: Map<string, string[]>
} {
  const bySurface = new Map<string, string[]>()
  const all = new Set<string>()

  for (const s of surfaces) {
    const cands = inflectionCandidates(s)
    if (cands.length === 0) continue
    bySurface.set(s, cands)
    for (const c of cands) all.add(c)
  }

  return { all: [...all], bySurface }
}

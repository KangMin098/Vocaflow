// apps/web/src/lib/textfit/public-queries.ts
//
// 공개(로그인 없음) 레벨 프로파일 데이터 접근.
//
// **RLS 를 우회하지 않는다.** service_role 을 쓰지 않고 anon 권한으로 읽을 수 있는 것만 읽는다.
//   `lib/supabase/admin.ts` 는 "requireAdmin 게이트 뒤에서만" 이 명문 규약이고,
//   공개 화면에는 그 게이트가 없으므로 애초에 후보가 아니다.
//
// 2026-08-17 권한 실측:
//   shared_dictionary  → 정책 `authenticated read dictionary` — anon **불가**
//   shared_words       → anon SELECT 가능 · v_level 보유 · distinct lemma **20,776**  ← 이걸 쓴다
//   lexicon_clean      → anon SELECT 가능(정책 PUBLIC/USING true) · 45만 · v_level 없음
//                        → "실재하는 영단어인가" 만 판정(레벨 미상과 오탈자를 가른다)
//   english_irregular_forms → RLS on · public 정책 0 → anon **불가** (went→go 는 미해석으로 남는다)
//
// 실측 사각지대: 발행 아티클 내용어 토큰 기준 `shared_words` 적중 **91.5%**,
//   lexicon_clean 만 7.6%, 둘 다 없음 0.8%. 즉 8.4% 는 레벨을 알 수 없다.
//   → 감추지 않고 `profile.ts` 가 상한/하한 범위로 노출한다.

import { createClient } from '@/lib/supabase/client'
import { collectCandidates } from './inflect'
import { buildLevelProfile } from './profile'
import type { LevelProfile, PublicWord } from './profile'

/** 한 번에 조회할 후보 수 — URL 길이·타임아웃 안전선. */
const CHUNK = 300

/** 공개 화면이 받는 지문 길이 상한(문자). 넘으면 앞에서 자르고 잘렸다고 알린다. */
export const PUBLIC_TEXT_LIMIT = 12_000

/**
 * 표면형들의 레벨을 anon 권한으로 해석한다.
 *
 * 굴절형은 `inflectionCandidates` 가 만든 후보를 **전부 한 번에** 던지고
 * DB 에 실재하는 것만 돌려받는다 — TS 가 원형을 주장하지 않으므로 오탐이 새지 않는다.
 */
async function resolveLevels(surfaces: string[]): Promise<{
  lemmaOf: Map<string, string>
  levelOf: Map<string, number>
  realWords: Set<string>
}> {
  const supabase = createClient()
  const { all, bySurface } = collectCandidates(surfaces)

  const levelOf = new Map<string, number>()
  const realWords = new Set<string>()

  // ① shared_words — 레벨이 있는 학습 어휘 (20,776 표제어)
  for (let i = 0; i < all.length; i += CHUNK) {
    const { data } = await supabase
      .from('shared_words')
      .select('lemma, v_level')
      .in('lemma', all.slice(i, i + CHUNK))
      .not('v_level', 'is', null)

    for (const row of (data ?? []) as { lemma: string; v_level: number | null }[]) {
      const key = row.lemma.toLowerCase()
      if (row.v_level === null) continue
      // 같은 표제어가 여러 세트에 있으면 **가장 낮은 레벨**을 남긴다 —
      // 한 세트에서 고급으로 분류됐다고 그 단어가 초급 학습자에게 처음인 것은 아니다.
      const prev = levelOf.get(key)
      if (prev === undefined || row.v_level < prev) levelOf.set(key, row.v_level)
      realWords.add(key)
    }
  }

  // ② lexicon_clean — 레벨은 없지만 "실재하는 영단어인가" 를 가른다.
  //    이게 있어야 '레벨 미상'(가르칠 목록 밖의 진짜 단어)과 '오탈자·고유명사'를 구분한다.
  const unresolvedCands = all.filter((c) => !realWords.has(c))
  for (let i = 0; i < unresolvedCands.length; i += CHUNK) {
    const { data } = await supabase
      .from('lexicon_clean')
      .select('word')
      .in('word', unresolvedCands.slice(i, i + CHUNK))

    for (const row of (data ?? []) as { word: string }[]) realWords.add(row.word.toLowerCase())
  }

  // 표면형별로 **우선순위가 가장 높은** 실재 후보를 표제어로 채택한다.
  const lemmaOf = new Map<string, string>()
  for (const [surface, cands] of bySurface) {
    const hit = cands.find((c) => levelOf.has(c)) ?? cands.find((c) => realWords.has(c))
    if (hit) lemmaOf.set(surface, hit)
  }

  return { lemmaOf, levelOf, realWords }
}

/**
 * 지문 하나의 레벨 프로파일을 만든다 — 로그인 불필요.
 *
 * `counts`/`totalTokens` 는 `lib/text-extract/tokenize` 결과를 그대로 넘긴다:
 * 공개 화면과 로그인 화면이 **같은 토크나이저**를 써야 두 숫자가 갈라지지 않는다.
 */
export async function analyzePublicText(
  counts: Record<string, number>,
  totalTokens: number,
): Promise<LevelProfile> {
  const surfaces = Object.keys(counts)
  if (surfaces.length === 0) return buildLevelProfile([], totalTokens)

  const { lemmaOf, levelOf, realWords } = await resolveLevels(surfaces)

  // 표면형 → 표제어로 접으면서 빈도를 합산한다("allocate" 2 + "allocated" 3 = 5).
  const merged = new Map<string, PublicWord>()

  for (const [surface, count] of Object.entries(counts)) {
    const lemma = lemmaOf.get(surface) ?? surface.toLowerCase()
    const vLevel = levelOf.get(lemma) ?? null
    const status: PublicWord['status'] =
      vLevel !== null ? 'leveled' : realWords.has(lemma) ? 'unleveled' : 'unresolved'

    const prev = merged.get(lemma)
    if (prev) {
      prev.count += count
    } else {
      merged.set(lemma, { surface, lemma, count, status, vLevel })
    }
  }

  return buildLevelProfile([...merged.values()], totalTokens)
}

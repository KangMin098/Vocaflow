// apps/web/src/lib/library/__tests__/slur-not-published.integration.test.ts
//
// 회귀 고정: **집단 멸칭은 학습자 단어장에 나가지 않는다. 다만 사전에서 사라지지도 않는다.**
//
// 2026-08-25 실측 — `nigger`·`niggers` 가 발행된 챕터 단어장 3곳(Tom Sawyer Ch.6·Ch.10 ·
// The Mysterious Affair at Styles Ch.8)에 **암기 카드로** 들어가 있었다. negro(7) · whore(5) ·
// negress · midget · hussy · sodomite · gypsy · gipsy 까지 합쳐 33행. 전부 `word_register='standard'`
// 라 추출 노이즈 필터를 그대로 통과했다.
//
// 조치는 삭제가 아니라 **재분류**였다 — 9개 표제어를 `period_cultural` 로 옮겨
// `select_book_chapter_vocab` 의 노이즈 필터가 앞으로 걸러 내게 하고, 이미 나간 33행만 지웠다.
// 그래서 이 테스트는 **두 방향을 함께** 못 박는다:
//   ① 발행 단어장에 없다 (학습자가 외울 낱말로 받지 않는다)
//   ② 여전히 해석된다 (Tom Sawyer 본문에서 눌렀을 때 뜻은 떠야 한다 — 사전에서 지운 게 아니다)
// ②가 없으면 다음 사람이 "안전하게" 사전에서 삭제해 버리고, 학습자는 원문을 읽다 막힌다.
//
// ⚠️ 이 목록은 **완결이 아니다.** `word_register` 에 비속어 값이 없어(현재 8종) 멸칭을 표시할
// 자리가 없고, 그래서 새 멸칭이 `standard` 로 들어오면 같은 일이 반복된다. 근본 해결은
// 레지스터 확장이며 그때까지 이 목록이 알려진 것의 재발만 막는다.
//
// 환경변수(SERVICE_ROLE_KEY) 없으면 skip — CI 정상.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll } from 'vitest'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

/** 주된 뜻이 **집단 멸칭**인 표제어 — 굴절형 포함. 경멸 뉘앙스를 가진 일반 낱말과 구분한다. */
const SLUR_FORMS = [
  'nigger', 'niggers', 'negro', 'negroes', 'negress',
  'whore', 'whores', 'midget', 'midgets',
  'hussy', 'hussies', 'sodomite', 'sodomites',
  'gypsy', 'gypsies', 'gipsy', 'gipsies',
  'savages', 'retarded',
]

/**
 * 일부러 **남긴** 것들 — 경멸 뉘앙스는 있지만 집단 멸칭이 아니거나, 사전에 등재된 뜻이 중립이다.
 * 이 목록이 있어야 다음 사람이 "비하어 같으니 다 빼자" 로 과잉 삭제하지 않는다.
 *   chink   → 등재된 뜻이 "좁은 틈"
 *   retard  → 등재된 뜻이 "지연시키다"
 *   faggot  → 등재된 뜻이 "땔감 다발"
 *   queer   → 등재된 뜻이 "성소수자의" (재전유된 정체성 용어)
 *   savage  → 형용사 "야만적인, 흉포한" (복수 명사 savages 만 뺐다)
 *   lackey · minion · yokel · dotard · spinster · effeminate → 문학 독해에 필요한 어휘
 */
const DELIBERATELY_KEPT = ['chink', 'retard', 'faggot', 'fag', 'queer', 'savage', 'cripple', 'heathen']

describe.skipIf(skipIfNoEnv)('멸칭이 학습자 단어장에 나가지 않는다 (실 DB)', () => {
  let db: SupabaseClient

  beforeAll(() => {
    db = createClient(SUPABASE_URL as string, SERVICE_KEY as string, {
      auth: { persistSession: false },
    })
  })

  it('발행된 단어장에 멸칭이 한 행도 없다', async () => {
    const { data, error } = await db
      .from('shared_words')
      .select('word, set_id, shared_word_sets!inner(is_published)')
      .in('word', SLUR_FORMS)
    if (error) throw new Error(`조회 실패: ${error.message}`)

    const rows = (data ?? []) as Array<{
      word: string
      shared_word_sets: { is_published: boolean } | { is_published: boolean }[]
    }>
    const published = rows.filter((r) => {
      const s = Array.isArray(r.shared_word_sets) ? r.shared_word_sets[0] : r.shared_word_sets
      return s?.is_published === true
    })
    expect(
      published.map((r) => r.word),
      `발행 단어장에 멸칭이 들어갔다: ${published.map((r) => r.word).join(', ')}`,
    ).toEqual([])
  })

  it('그래도 사전에서는 여전히 해석된다 — 원문을 읽다 막히면 안 된다', async () => {
    const dead: string[] = []
    for (const w of SLUR_FORMS) {
      const { data, error } = await db.rpc('resolve_dict_headword', { p_surface: w })
      if (error) throw new Error(`resolve 실패(${w}): ${error.message}`)
      if (!data) dead.push(w)
    }
    expect(dead, `사전에서 사라졌다(과잉 삭제): ${dead.join(', ')}`).toEqual([])
  })

  it('일부러 남긴 낱말은 그대로 남아 있다 — 과잉 삭제 방지', async () => {
    const { data, error } = await db
      .from('shared_dictionary')
      .select('word, word_register')
      .in('word', DELIBERATELY_KEPT)
    if (error) throw new Error(`조회 실패: ${error.message}`)

    const rows = (data ?? []) as Array<{ word: string; word_register: string | null }>
    expect(rows.length, '남기기로 한 낱말이 사전에서 사라졌다').toBe(DELIBERATELY_KEPT.length)
    const demoted = rows.filter((r) => r.word_register === 'period_cultural').map((r) => r.word)
    expect(demoted, `남기기로 한 낱말이 노이즈 register 로 내려갔다: ${demoted.join(', ')}`).toEqual([])
  })
})

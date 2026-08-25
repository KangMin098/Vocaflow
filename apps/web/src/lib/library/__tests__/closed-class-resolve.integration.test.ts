// apps/web/src/lib/library/__tests__/closed-class-resolve.integration.test.ts
//
// 회귀 고정: **폐쇄집합 기능어는 학습자가 눌렀을 때 반드시 뜻이 나와야 한다.**
//
// 2026-08-25 실측 — 이 목록에서 9개가 `resolve_dict_headword` 로 NULL 을 냈다
// (amongst · anyhow · anymore · no one · nowhere · whenever · wherever · whoever · whomever).
// 같은 자리의 `whatever` · `anywhere` · `nobody` 는 멀쩡했으니 설계 결정이 아니라 **목록의 구멍**이었다.
// 재귀대명사는 더 고약했다 — `myself`·`itself`·`ourselves` 는 표제어인데 `herself`·`himself`·
// `themselves`·`yourself` 는 없어서 she/he/they/you 로 떨어졌다. "그녀 자신" 이 "그녀" 로 나갔다.
//
// 이 목록은 **닫혀 있다**(새 기능어가 생기지 않는다). 그래서 전수로 못 박을 수 있고, 못 박아 둔다.
// 환경변수(SERVICE_ROLE_KEY) 없으면 skip — CI 정상.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll } from 'vitest'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

/** 표제어로 **자기 자신**이 나와야 하는 것들 — 다른 낱말로 떨어지면 뜻이 어긋난다. */
const MUST_BE_OWN_HEADWORD = [
  // wh-ever
  'whatever', 'whenever', 'wherever', 'whoever', 'whichever', 'however', 'whomever',
  // 재귀대명사 — 인칭대명사로 떨어지면 "그녀 자신"이 "그녀"가 된다
  'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'yourselves', 'themselves',
  // some/any/every/no × one/body/thing/where
  'someone', 'somebody', 'something', 'somewhere',
  'anyone', 'anybody', 'anything', 'anywhere',
  'everyone', 'everybody', 'everything', 'everywhere',
  'no one', 'nobody', 'nothing', 'nowhere',
  // 접속·전치·부사 계열
  'amongst', 'amidst', 'anymore', 'anyhow', 'anyplace', 'elsewhere',
  'nevertheless', 'nonetheless', 'meanwhile', 'otherwise', 'besides',
  // 상호대명사·라틴 차용
  'each other', 'one another', 'per se', 'vice versa',
]

/** 철자 변이는 **정본으로 접히는 것이 정상** — 자기 자신을 요구하면 안 된다. */
const MUST_FOLD_TO: Array<[surface: string, headword: string]> = [
  ['towards', 'toward'],
  ['anyways', 'anyway'],
  ['backwards', 'backward'],
]

describe.skipIf(skipIfNoEnv)('폐쇄집합 기능어 해석 (실 DB)', () => {
  let db: SupabaseClient

  beforeAll(() => {
    db = createClient(SUPABASE_URL as string, SERVICE_KEY as string, {
      auth: { persistSession: false },
    })
  })

  async function resolve(surface: string): Promise<string | null> {
    const { data, error } = await db.rpc('resolve_dict_headword', { p_surface: surface })
    if (error) throw new Error(`resolve_dict_headword(${surface}) failed: ${error.message}`)
    return (data ?? null) as string | null
  }

  it('기능어가 해석되지 않고 사라지는 일이 없다', async () => {
    const dead: string[] = []
    for (const w of MUST_BE_OWN_HEADWORD) {
      if ((await resolve(w)) === null) dead.push(w)
    }
    expect(dead, `해석 실패(학습자가 눌러도 뜻이 안 뜬다): ${dead.join(', ')}`).toEqual([])
  })

  it('기능어는 다른 낱말로 떨어지지 않고 자기 표제어를 갖는다', async () => {
    const drifted: string[] = []
    for (const w of MUST_BE_OWN_HEADWORD) {
      const head = await resolve(w)
      if (head !== w) drifted.push(`${w}→${head ?? 'NULL'}`)
    }
    expect(drifted, `표제어 어긋남(뜻이 바뀌어 나간다): ${drifted.join(', ')}`).toEqual([])
  })

  it('철자 변이는 정본으로 접힌다 — 위 규칙의 예외가 아니라 다른 규칙이다', async () => {
    for (const [surface, headword] of MUST_FOLD_TO) {
      expect(await resolve(surface), `${surface} 는 ${headword} 로 접혀야 한다`).toBe(headword)
    }
  })

  it('등재된 기능어는 뜻·품사·레벨을 갖춘다 (게이트 I1 과 같은 조건)', async () => {
    const { data, error } = await db
      .from('shared_dictionary')
      .select('word, meaning_ko, pos, v_level, cefr_level')
      .in('word', MUST_BE_OWN_HEADWORD)
    if (error) throw new Error(`fetch failed: ${error.message}`)

    const rows = (data ?? []) as Array<{
      word: string
      meaning_ko: string | null
      pos: string | null
      v_level: number | null
      cefr_level: string | null
    }>
    expect(rows.length).toBe(MUST_BE_OWN_HEADWORD.length)

    const incomplete = rows
      .filter((r) => !r.meaning_ko?.trim() || !r.pos || r.v_level == null || !r.cefr_level)
      .map((r) => r.word)
    expect(incomplete, `필드 결측: ${incomplete.join(', ')}`).toEqual([])
  })
})

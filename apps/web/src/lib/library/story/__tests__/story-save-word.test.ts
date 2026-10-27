// apps/web/src/lib/library/story/__tests__/story-save-word.test.ts
//
// D5-I01 선택 낱말 저장 서버 로직 회귀 — 이 파일의 가짜 쿠키 클라이언트(호출 기록 · 메모리 vocabularies)만 쓴다. 실제 Supabase · .env 없음.
// 다루는 것: 입력 허용 목록(클라이언트 뜻 · 예문 · userId · textId 무시) · 학습자/본인 일치 · 읽기 문맥 · 본문 결속 · 같은 토큰화로 낱말 확인 ·
// 사전 재조회(확정 영어 표제어만 · 유사어/이름/외국어/뜻 없음 거부) · 조회 실패 ≠ 없음 · 기존 행 보존 · 새 행 모양(text_id null · manual) ·
// 동시 저장 23505 · 그 밖의 오류 정제 · 응답 유실 뒤 재시도 멱등 · 위치/완료/FSRS 쓰기 0 · 원문/표면 표제어 구분.

import { describe, expect, it } from 'vitest'

import { parseStoryWordSaveInput, saveStoryWord, unitWordAt, type StoryWordSaveClient } from '../save-word'
import { splitUnitParagraphs, tokenizeWords } from '../../../../components/library/story/story-view'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const UID = '66666666-6666-4666-8666-666666666666'
const OTHER = '77777777-7777-4777-8777-777777777777'
const RK = `lsr_${'a'.repeat(32)}`
const BODY = 'The gull sat on the rock.\n\nIt looked at the wide, cold sea — boats were gone.'
// 낱말 번호: The0 gull1 sat2 on3 the4 rock5 | It6 looked7 at8 the9 wide10 cold11 sea12 boats13 were14 gone15

function contextData(unitIndex = 1): Json {
  return {
    release_key: RK, work_key: 'gull-rock', edition_key: 'b1', kind: 'story_edition', coverage: 'complete_work',
    completion_label: 'adapted_full_work', counts_as_work_completion: true, counts_as_original_text_completion: false,
    title: 'The Gull', unit_count: 3, progress: null,
    toc: [0, 1, 2].map((i) => ({ unit_index: i, unit_title: ['Morning', null, 'Night'][i], completed: false })),
    unit: { unit_index: unitIndex, unit_title: ['Morning', null, 'Night'][unitIndex], anchors: [{ paragraph: 0, start: 0, end: 3, quote: 'The' }], offset_unit: 'utf16_code_unit' },
    source: { identity_sha256: 'a'.repeat(64), text_sha256: 'b'.repeat(64), title: 'The Gull', author: null, original_language: 'en', text_language: 'en', translator: null, edition_label: 'Synthetic', coverage: 'complete_work', source_url: null },
  }
}
const bodyRow = (over: Json = {}) => [{ release_key: RK, unit_index: 1, unit_count: 3, unit_title: null, unit_text: BODY, ...over }]
const dict = (over: Json = {}) => [{ found: true, surface: 'looked', resolved_word: 'look', meaning_ko: '보다', pos: 'verb', cefr_level: 'A1', v_level: 1, example_en: 'Look at this.', match_via: 'inflection', word_register: null, lang: 'en', ...over }]

interface Opts {
  user?: string | null
  profile?: Json | null
  rpc?: Partial<Record<string, () => { data: unknown; error: Json | null }>>
  vocab?: Json[]
  selectError?: boolean
  insertError?: Json | null
  insertThrows?: boolean
}

function fake(opts: Opts = {}) {
  const calls: string[] = []
  const vocab: Json[] = opts.vocab ? [...opts.vocab] : []
  const inserts: Json[] = []
  const rpcDefaults: Record<string, () => { data: unknown; error: Json | null }> = {
    story_reader_context: () => ({ data: contextData(1), error: null }),
    story_read_unit: () => ({ data: bodyRow(), error: null }),
    lookup_word_meaning: () => ({ data: dict(), error: null }),
  }
  const client: StoryWordSaveClient = {
    auth: { getUser: async () => ({ data: { user: opts.user === null ? null : { id: opts.user ?? UID } }, error: null }) },
    from: (table) => ({
      select: () => {
        const eqs: Array<[string, string]> = []
        const q = {
          eq: (c: string, v: string) => (eqs.push([c, v]), q),
          maybeSingle: async () => {
            calls.push(`select:${table}`)
            if (table === 'user_profiles') return { data: opts.profile === undefined ? { status: 'active' } : opts.profile, error: null }
            if (opts.selectError) return { data: null, error: { message: 'permission denied for table vocabularies', code: '42501' } }
            const hit = vocab.find((r) => eqs.every(([c, v]) => r[c] === v))
            return { data: hit ? { id: hit.id } : null, error: null }
          },
        }
        return q
      },
      insert: async (row) => {
        calls.push(`insert:${table}`)
        if (opts.insertThrows) throw new Error('fetch failed')
        if (opts.insertError) return { error: opts.insertError }
        inserts.push(row)
        vocab.push({ id: `v${vocab.length + 1}`, ...row })
        return { error: null }
      },
    }),
    rpc: async (fn) => {
      calls.push(`rpc:${fn}`)
      const h = opts.rpc?.[fn] ?? rpcDefaults[fn]
      if (!h) return { data: null, error: { message: `unexpected ${fn}` } }
      return h()
    },
  }
  return { client, calls, vocab, inserts }
}

const INPUT = { releaseKey: RK, unitIndex: 1, wordIndex: 7, surface: 'looked', expectedViewerId: UID }
const save = (f: ReturnType<typeof fake>, input: unknown = INPUT) => saveStoryWord({ client: f.client }, input)
const writesOf = (f: ReturnType<typeof fake>) => f.calls.filter((c) => c.startsWith('insert') || /record_position|complete_unit/.test(c))

describe('입력 허용 목록 — 클라이언트 권위 없음', () => {
  it('뜻 · 예문 · 원형 · userId · textId 를 함께 보내도 읽지 않는다(서버 사전 값만 저장)', async () => {
    const f = fake()
    const out = await save(f, { ...INPUT, meaning: '조작된 뜻', example: 'forged', lemma: 'forged', userId: OTHER, textId: 'x', text_id: 'y' })
    expect(out).toMatchObject({ ok: true, data: { status: 'saved', headword: 'look', surface: 'looked', viewerId: UID } })
    expect(f.inserts).toEqual([{ user_id: UID, text_id: null, word: 'look', meaning: '보다', pronunciation: '', pos: 'verb', cefr_level: 'A1', example_sentence: 'Look at this.', origin: 'manual' }])
    expect(parseStoryWordSaveInput({ ...INPUT, meaning: 'x' })).toEqual(INPUT)
  })

  it('형식이 틀리면 getUser · RPC · 표 전에 invalid_input', async () => {
    const bad: unknown[] = [
      null, 'x', { ...INPUT, releaseKey: 'lsr_x' }, { ...INPUT, unitIndex: -1 }, { ...INPUT, unitIndex: 10000 }, { ...INPUT, unitIndex: 1.5 },
      { ...INPUT, wordIndex: -1 }, { ...INPUT, wordIndex: '7' }, { ...INPUT, surface: 'two words' }, { ...INPUT, surface: 'looked.' },
      { ...INPUT, surface: '' }, { ...INPUT, surface: 'a'.repeat(65) }, { ...INPUT, expectedViewerId: 'not-a-uuid' }, { ...INPUT, surface: undefined },
    ]
    for (const input of bad) {
      const f = fake()
      expect(await save(f, input), JSON.stringify(input)).toMatchObject({ ok: false, code: 'invalid_input' })
      expect(f.calls).toEqual([])
    }
  })
})

describe('학습자 · 본인 · 발행 · 결속', () => {
  it('로그인 없음 · 정지 · 계정이 화면과 다름 → 읽기 문맥 · 사전 · 표 호출 0', async () => {
    for (const [opts, code] of [[{ user: null }, 'auth_required'], [{ profile: { status: 'suspended' } }, 'account_blocked'], [{ user: OTHER }, 'viewer_changed']] as const) {
      const f = fake(opts)
      expect(await save(f), code).toMatchObject({ ok: false, code })
      expect(f.calls.filter((c) => c.startsWith('rpc') || c.includes('vocabularies'))).toEqual([])
    }
  })

  it('철회 · 권리 보류 · 미발행(release_unavailable) · 단위 없음 · 결속 불일치 · 문맥 RPC 없음 → 거부 · 쓰기 0', async () => {
    const cases: Array<[Opts['rpc'], string]> = [
      [{ story_reader_context: () => ({ data: null, error: { message: 'story:release_unavailable', code: 'P0001' } }) }, 'release_unavailable'],
      [{ story_reader_context: () => ({ data: null, error: { message: 'story:unit_not_found', code: 'P0001' } }) }, 'unit_not_found'],
      [{ story_reader_context: () => ({ data: null, error: { message: 'story:reader_context_mismatch', code: 'P0001' } }) }, 'reader_data_invalid'],
      [{ story_reader_context: () => ({ data: null, error: { message: 'Could not find the function', code: 'PGRST202' } }) }, 'reader_not_ready'],
      [{ story_read_unit: () => ({ data: null, error: { message: 'story:release_unavailable', code: 'P0001' } }) }, 'release_unavailable'],
      [{ story_reader_context: () => ({ data: contextData(2), error: null }) }, 'reader_data_invalid'],
      [{ story_read_unit: () => ({ data: bodyRow({ unit_count: 4 }), error: null }) }, 'reader_data_invalid'],
      [{ story_read_unit: () => ({ data: bodyRow({ release_key: `lsr_${'b'.repeat(32)}` }), error: null }) }, 'reader_data_invalid'],
      [{ story_read_unit: () => ({ data: bodyRow({ unit_title: 'Other' }), error: null }) }, 'reader_data_invalid'],
    ]
    for (const [rpc, code] of cases) {
      const f = fake({ rpc })
      expect(await save(f), code).toMatchObject({ ok: false, code })
      expect(writesOf(f)).toEqual([])
      expect(f.calls).not.toContain('rpc:lookup_word_meaning')
    }
  })

  it('고른 낱말이 지금 본문의 그 번호 낱말과 다르면(오래된 화면 · 조작) selection_mismatch · 사전 · 표 호출 0', async () => {
    for (const input of [{ ...INPUT, surface: 'sea' }, { ...INPUT, wordIndex: 12 }, { ...INPUT, wordIndex: 16, surface: 'gone' }, { ...INPUT, wordIndex: 999, surface: 'looked' }]) {
      const f = fake()
      expect(await save(f, input), JSON.stringify(input)).toMatchObject({ ok: false, code: 'selection_mismatch', retryable: false })
      expect(f.calls.filter((c) => c === 'rpc:lookup_word_meaning' || c.includes('vocabularies'))).toEqual([])
    }
  })

  it('unitWordAt 는 StoryUnitText 와 같은 토큰화(문단 · 하이픈 · 아포스트로피 · 대시)', () => {
    let n = 0
    const words: string[] = []
    for (const p of splitUnitParagraphs(BODY)) {
      const { pieces, next } = tokenizeWords(p, n)
      for (const x of pieces) if (x.type === 'word') words.push(x.text)
      n = next
    }
    words.forEach((w, i) => expect(unitWordAt(BODY, i)).toBe(w))
    expect(unitWordAt(BODY, words.length)).toBeNull()
    expect(unitWordAt("Don't stop — well-known", 0)).toBe("Don't")
    expect(unitWordAt("Don't stop — well-known", 2)).toBe('well-known')
  })
})

describe('사전 재조회 — 확정 영어 표제어만', () => {
  it('없음 · 유사어 추정 · 이름 · 외국어 · 뜻 없음 · 표제어 이상 → not_saveable · 표 호출 0', async () => {
    for (const row of [
      dict({ found: false, resolved_word: null, meaning_ko: null, match_via: 'not_found' }),
      dict({ match_via: 'suggestion' }),
      dict({ found: false, match_via: 'proper_noun', resolved_word: null }),
      dict({ lang: 'fr' }),
      dict({ meaning_ko: '   ' }),
      dict({ resolved_word: 'two words' }),
      [],
      null,
    ]) {
      const f = fake({ rpc: { lookup_word_meaning: () => ({ data: row, error: null }) } })
      expect(await save(f), JSON.stringify(row)).toMatchObject({ ok: false, code: 'not_saveable' })
      expect(f.calls.filter((c) => c.includes('vocabularies'))).toEqual([])
    }
  })

  it('사전 조회 오류는 temporary(없음으로 바꾸지 않음) · 표 호출 0', async () => {
    const f = fake({ rpc: { lookup_word_meaning: () => ({ data: null, error: { message: 'boom' } }) } })
    expect(await save(f)).toMatchObject({ ok: false, code: 'temporary', retryable: true })
    expect(f.calls.filter((c) => c.includes('vocabularies'))).toEqual([])
  })

  it('CEFR 가 허용 값이 아니면 null · 예문 · 품사가 없으면 빈 값(사전 예문만 — Story 문장을 담지 않는다)', async () => {
    const f = fake({ rpc: { lookup_word_meaning: () => ({ data: dict({ cefr_level: 'X9', example_en: null, pos: null }), error: null }) } })
    await save(f)
    expect(f.inserts[0]).toMatchObject({ cefr_level: null, example_sentence: '', pos: '' })
    expect(JSON.stringify(f.inserts)).not.toContain('gull')
  })
})

describe('기존 행 보존 · 멱등 · 오류 정제', () => {
  it('이미 있는 표제어 → already_exists · 기존 행(뜻 · FSRS · 출처) 그대로 · 쓰기 0', async () => {
    const existing = { id: 'old', user_id: UID, word: 'look', meaning: '내가 적은 뜻', stability: 3.2, next_review_at: '2026-11-01', origin: 'library', text_id: 'tttt' }
    const f = fake({ vocab: [existing] })
    expect(await save(f)).toMatchObject({ ok: true, data: { status: 'already_exists', headword: 'look' } })
    expect(f.inserts).toEqual([])
    expect(f.vocab).toEqual([existing])
  })

  it('다른 사람의 같은 낱말은 내 저장을 막지 않는다(본인 user_id 로만 확인)', async () => {
    const f = fake({ vocab: [{ id: 'x', user_id: OTHER, word: 'look' }] })
    expect(await save(f)).toMatchObject({ ok: true, data: { status: 'saved' } })
    expect(f.inserts).toHaveLength(1)
  })

  it('사전 확인 조회가 실패하면 「없음」으로 보지 않고 temporary · 삽입 0', async () => {
    const f = fake({ selectError: true })
    const out = await save(f)
    expect(out).toMatchObject({ ok: false, code: 'temporary' })
    expect(f.calls).not.toContain('insert:vocabularies')
    expect(JSON.stringify(out)).not.toMatch(/permission|42501|vocabularies/)
  })

  it('동시 저장(23505) → already_exists · 그 밖의 삽입 오류 · 예외 → 정제된 temporary(원문 · 코드 · 식별자 없음)', async () => {
    expect(await save(fake({ insertError: { code: '23505', message: 'duplicate key value violates unique constraint "vocabularies_user_id_word_key"' } }))).toMatchObject({ ok: true, data: { status: 'already_exists' } })
    for (const opts of [{ insertError: { code: '23503', message: 'insert or update on table "vocabularies" violates foreign key constraint' } }, { insertThrows: true }]) {
      const out = await save(fake(opts))
      expect(out).toMatchObject({ ok: false, code: 'temporary', retryable: true })
      expect(JSON.stringify(out)).not.toMatch(/vocabularies|constraint|23503|fetch failed|66666666/)
    }
  })

  it('응답 유실 뒤 같은 요청 재시도 → 행 1개 · 두 번째는 already_exists', async () => {
    const f = fake()
    expect(await save(f)).toMatchObject({ ok: true, data: { status: 'saved' } })
    expect(await save(f)).toMatchObject({ ok: true, data: { status: 'already_exists' } })
    expect(f.vocab.filter((r) => r.user_id === UID && r.word === 'look')).toHaveLength(1)
  })

  it('위치 기록 · 단위 완료 · FSRS 갱신을 부르지 않는다(삽입 1회뿐 · update 없음)', async () => {
    const f = fake()
    await save(f)
    expect(f.calls.filter((c) => /record_position|complete_unit|apply_review|update/.test(c))).toEqual([])
    expect(f.calls.filter((c) => c.startsWith('insert'))).toEqual(['insert:vocabularies'])
    expect(f.inserts[0]).not.toHaveProperty('stability')
    expect(f.inserts[0]).not.toHaveProperty('next_review_at')
  })
})

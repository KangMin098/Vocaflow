// packages/library-pipeline/src/story/validate.test.ts
//
// 원천 · 편집 기준 · 판본 결과물의 구조 검증 회귀. 합성 fixture(fixtures/gull-rock.*)가 정상 예시이고,
// 그것을 한 군데씩 망가뜨려 거부 사유가 정확히 나오는지 본다. 스키마 미러가 아니라 「무엇을 막는가」를 고정한다.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { sourceTextSha256 } from './text'
import {
  validateEdition,
  validatePolicy,
  validateSnapshot,
  type Checked,
  type PolicyContext,
  type SourceContext,
} from './validate'

const NOW = new Date('2026-10-25T12:00:00+09:00')
const WORK = 'gull-rock-r1'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

function fixture(name: string): Json {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/gull-rock.${name}.json`, import.meta.url)), 'utf8')) as Json
}

function codes(c: Checked<unknown>): string[] {
  return c.errors.map((e) => e.code)
}

/** 실제 원천처럼 보이는 변형 — 테스트 안에서만 쓴다. 권리 확인 값은 가짜이며 어떤 실제 도서도 가리키지 않는다. */
function realLikeSnapshot(): Json {
  const s = fixture('snapshot')
  s.synthetic = false
  s.edition.source_kind = 'external_file'
  s.rights = [
    {
      asset: 'source_text',
      status: 'confirmed',
      basis: '테스트 전용 가상 확인 기록',
      evidence_ref: 'test-only-evidence',
      checked_by: 'test-only-checker',
      checked_at: '2026-10-25T08:00:00+09:00',
    },
  ]
  return s
}

function load(snapshot: Json = fixture('snapshot'), policy: Json = fixture('policy')): { source: SourceContext; policy: PolicyContext } {
  const src = validateSnapshot(snapshot, NOW)
  if (!src.value) throw new Error(JSON.stringify(src.errors))
  const pol = validatePolicy(policy, src.value)
  if (!pol.value) throw new Error(JSON.stringify(pol.errors))
  return { source: src.value, policy: pol.value }
}

function ctx(key: string, base = load()) {
  return { ...base, edition_key: key, task_id: `${WORK}:${key}` }
}

function story(): Json {
  return fixture('story-b1.edition.out')
}

function validateStory(mutate: (e: Json) => void, key = 'story-b1'): Checked<unknown> {
  const e = story()
  mutate(e)
  return validateEdition(e, ctx(key))
}

function deepReverseKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(deepReverseKeys)
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v)
        .reverse()
        .map((k) => [k, deepReverseKeys((v as Json)[k])]),
    )
  }
  return v
}

describe('합성 fixture 는 정상 예시로 통과한다', () => {
  it('원천 · 편집 기준 · 두 판본이 모두 구조 검증을 통과한다', () => {
    const { source, policy } = load()
    expect(source.paragraphs).toHaveLength(8)
    expect([...policy.items.keys()]).toEqual(['story-b1', 'easy-a2'])
    expect(validateEdition(story(), ctx('story-b1')).errors).toEqual([])
    expect(validateEdition(fixture('easy-a2.edition.out'), ctx('easy-a2')).errors).toEqual([])
  })

  it('fixture 는 합성임을 숨기지 않는다', () => {
    const s = fixture('snapshot')
    expect(s.synthetic).toBe(true)
    expect(s.rights.every((r: Json) => r.status === 'synthetic_fixture')).toBe(true)
    expect(story().produced_by.provenance).toBe('synthetic_fixture')
  })
})

describe('결속 해시 — 키 순서에는 같고 내용 · 정답 · 근거 변경에는 달라진다', () => {
  const base = validateEdition(story(), ctx('story-b1')).value!

  it('JSON 키 순서를 전부 뒤집어도 판본 · 활동 해시가 같다', () => {
    const r = validateEdition(deepReverseKeys(story()), ctx('story-b1'))
    expect(r.value?.edition_sha256).toBe(base.edition_sha256)
    expect(r.value?.activities_sha256).toBe(base.activities_sha256)
  })

  it('본문 한 낱말을 바꾸면 판본 해시가 바뀐다', () => {
    const e = story()
    e.units[3].text = e.units[3].text.replace('could not get up', 'could not stand up')
    const r = validateEdition(e, ctx('story-b1'))
    expect(r.ok).toBe(true)
    expect(r.value?.edition_sha256).not.toBe(base.edition_sha256)
  })

  it('활동 근거로 쓰인 본문을 바꾸고 근거 구간을 그대로 두면 거부한다', () => {
    const e = story()
    e.units[3].text = e.units[3].text.replace('gray nails', 'grey nails')
    expect(codes(validateEdition(e, ctx('story-b1')))).toContain('span_quote_mismatch')
  })

  it('정답만 바꿔도 활동 해시가 바뀌고 판본 해시는 그대로다', () => {
    const e = story()
    e.activities[0].task.answer.correct = ['o2']
    const r = validateEdition(e, ctx('story-b1'))
    expect(r.ok).toBe(true)
    expect(r.value?.activities_sha256).not.toBe(base.activities_sha256)
    expect(r.value?.edition_sha256).toBe(base.edition_sha256)
  })

  it('근거 구간을 다른 유효 구간으로 바꾸면 활동 해시가 바뀐다', () => {
    const e = story()
    const unit = e.units.find((u: Json) => u.unit_id === 'u2').text as string
    const quote = 'the ninth one is cracked'
    const start = unit.indexOf(quote)
    e.activities[0].task.options[0] = { option_id: 'o1', unit_id: 'u2', start, end: start + quote.length, quote }
    const r = validateEdition(e, ctx('story-b1'))
    expect(r.ok).toBe(true)
    expect(r.value?.activities_sha256).not.toBe(base.activities_sha256)
  })

  it('생산자 기록을 바꿔도 판본 해시가 바뀐다(자기 검수 회피 차단)', () => {
    const e = story()
    e.produced_by.session_id = 'someone-else'
    expect(validateEdition(e, ctx('story-b1')).value?.edition_sha256).not.toBe(base.edition_sha256)
  })
})

describe('원천 판본 정체 해시 — 본문 해시와 따로 결속한다(F1)', () => {
  const base = load().source

  it('본문 해시와 정체 해시는 다른 값이다', () => {
    expect(base.identity_sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(base.identity_sha256).not.toBe(base.sha256)
  })

  it('키 순서 · 권리 기록 배열 순서만 다르면 같은 정체다', () => {
    const s = realLikeSnapshot()
    s.rights.push({ asset: 'audio', status: 'unverified', basis: '쓰지 않는 낭독 기록', evidence_ref: null, checked_by: null, checked_at: null })
    const a = validateSnapshot(s, NOW).value!.identity_sha256
    const t = deepReverseKeys(s) as Json
    t.rights = [...t.rights].reverse()
    expect(validateSnapshot(t, NOW).value!.identity_sha256).toBe(a)
  })

  it.each([
    ['snapshot_id', (s: Json) => { s.snapshot_id = 'synthetic-gull-rock-r2' }],
    ['원천 revision', (s: Json) => { s.edition.revision = 'r2' }],
    ['판본 표기', (s: Json) => { s.edition.edition_label = `${s.edition.edition_label} (second printing)` }],
    ['확보 시각', (s: Json) => { s.captured_at = '2026-10-25T00:30:00+09:00' }],
    ['권리 근거 문구', (s: Json) => { s.rights[0].basis = `${s.rights[0].basis} · 재확인` }],
  ])('본문이 같아도 %s 가 다르면 정체 해시가 다르다', (_label, mutate) => {
    const s = fixture('snapshot')
    mutate(s)
    const other = validateSnapshot(s, NOW).value!
    expect(other.sha256).toBe(base.sha256)
    expect(other.identity_sha256).not.toBe(base.identity_sha256)
  })

  it('다른 대응 도서(library_book_id)도 다른 정체다', () => {
    const a = realLikeSnapshot()
    a.edition.source_kind = 'library_book'
    a.edition.library_book_id = '11111111-1111-4111-8111-111111111111'
    a.edition.source = 'standard_ebooks'
    a.edition.source_id = 'test-only-id'
    const b = structuredClone(a)
    b.edition.library_book_id = '22222222-2222-4222-8222-222222222222'
    expect(validateSnapshot(a, NOW).value!.identity_sha256).not.toBe(validateSnapshot(b, NOW).value!.identity_sha256)
  })

  it('입력이 선언한 해시를 믿지 않는다 — 정체 해시는 스냅숏 본체에서 계산한다', () => {
    const s = fixture('snapshot')
    s.source_identity_sha256 = 'e'.repeat(64)
    expect(codes(validateSnapshot(s, NOW))).toContain('schema_unrecognized_keys')
  })

  it('같은 본문의 다른 원천 판본에 대해 만든 판본 결과물은 결속이 낡았다', () => {
    const s = fixture('snapshot')
    s.snapshot_id = 'synthetic-gull-rock-r2'
    s.edition.revision = 'r2'
    const r = validateEdition(story(), ctx('story-b1', load(s)))
    expect(r.errors.map((e) => e.path)).toEqual(['edition.binding.source_identity_sha256'])
    expect(codes(r)).toEqual(['edition_binding_stale'])
  })
})

describe('번역 원천 — 원작 언어와 본문 언어를 나누고 번역 권리를 따로 둔다(F2 · 선택 명확화)', () => {
  function translated(): Json {
    const s = realLikeSnapshot()
    s.work.original_language = 'fr'
    s.edition.translator = 'Test-only Translator'
    s.rights.push({
      asset: 'translation',
      status: 'confirmed',
      basis: '테스트 전용 가상 번역 권리 기록',
      evidence_ref: 'test-only-translation-evidence',
      checked_by: 'test-only-checker',
      checked_at: '2026-10-25T08:30:00+09:00',
    })
    return s
  }

  it('번역자 · 번역 권리 기록을 갖춘 번역 원천은 통과한다', () => {
    expect(validateSnapshot(translated(), NOW).errors).toEqual([])
  })

  it.each([
    ['번역본인데 번역자 없음', (s: Json) => { s.edition.translator = null }, 'translator_missing'],
    ['번역본인데 번역 권리 기록 없음', (s: Json) => { s.rights = s.rights.filter((r: Json) => r.asset !== 'translation') }, 'rights_translation_missing'],
    ['번역 권리를 증거 없이 confirmed', (s: Json) => { s.rights[1].evidence_ref = null }, 'rights_confirmation_incomplete'],
    ['영어 원작에 번역자', (s: Json) => { s.work.original_language = 'en' }, 'translator_unexpected'],
    ['영어 원작에 번역 권리 기록', (s: Json) => { s.work.original_language = 'en'; s.edition.translator = null }, 'rights_translation_unexpected'],
    ['영어가 아닌 본문', (s: Json) => { s.edition.text_language = 'fr' }, 'schema_invalid_literal'],
  ])('%s → %s', (_label, mutate, code) => {
    const s = translated()
    mutate(s)
    expect(codes(validateSnapshot(s, NOW))).toContain(code)
  })
})

describe('잘못된 UTF-16 입력은 경로와 함께 거부한다(F3)', () => {
  const LONE = String.fromCharCode(0xd800)

  it('원천 본문에 짝 없는 서로게이트가 있으면 해시 비교 전에 거부한다', () => {
    const s = fixture('snapshot')
    s.text = `${s.text}${LONE}`
    const r = validateSnapshot(s, NOW)
    expect(r.errors).toEqual([expect.objectContaining({ code: 'text_ill_formed_unicode', path: 'snapshot.text' })])
  })

  it('판본 단위 본문 · 인용의 짝 없는 서로게이트도 거부한다', () => {
    const r = validateStory((e) => { e.units[0].text = `${e.units[0].text} ${String.fromCharCode(0xdc00)}` })
    expect(r.errors).toEqual([expect.objectContaining({ code: 'text_ill_formed_unicode', path: 'edition.units[0].text' })])
    const q = validateStory((e) => { e.units[1].source_anchors[0].quote = LONE })
    expect(codes(q)).toEqual(['text_ill_formed_unicode'])
  })
})

describe('원천 스냅숏 검증', () => {
  it.each([
    ['본문만 바꾸고 해시는 그대로', (s: Json) => { s.text = s.text.replace('twelve', 'thirteen') }, 'text_hash_mismatch'],
    ['선언 해시 조작', (s: Json) => { s.text_sha256 = 'a'.repeat(64) }, 'text_hash_mismatch'],
    ['CRLF 본문(해시는 맞춰도)', (s: Json) => { s.text = s.text.replace(/\n\n/g, '\r\n\r\n'); s.text_sha256 = sourceTextSha256(s.text) }, 'text_not_normalized'],
    ['미래 확보 시각', (s: Json) => { s.captured_at = '2026-10-26T00:00:00+09:00' }, 'time_in_future'],
    ['합성 표지 불일치', (s: Json) => { s.synthetic = false }, 'synthetic_flag_mismatch'],
    ['정의되지 않은 키', (s: Json) => { s.verified = true }, 'schema_unrecognized_keys'],
  ])('%s → %s', (_label, mutate, code) => {
    const s = fixture('snapshot')
    mutate(s)
    expect(codes(validateSnapshot(s, NOW))).toContain(code)
  })

  it('library_book 원천은 library_book_id 없이 받지 않는다 — 제목 매칭으로 잇지 않는다', () => {
    const s = realLikeSnapshot()
    s.edition.source_kind = 'library_book'
    expect(codes(validateSnapshot(s, NOW))).toContain('library_book_mapping_incomplete')
  })

  it('실제 원천에 합성 권리 표기를, confirmed 에 증거 없는 확인을 받지 않는다', () => {
    const s = realLikeSnapshot()
    s.rights[0].status = 'synthetic_fixture'
    expect(codes(validateSnapshot(s, NOW))).toContain('synthetic_rights_mismatch')
    const t = realLikeSnapshot()
    t.rights[0].evidence_ref = null
    expect(codes(validateSnapshot(t, NOW))).toContain('rights_confirmation_incomplete')
  })
})

describe('편집 기준 검증', () => {
  it.each([
    ['재서사 제작 요청', (p: Json) => { p.production[0].transformation = 'renarration' }, 'renarration_excluded'],
    ['판본 종류와 변환 유형 불일치', (p: Json) => { p.production[1].transformation = 'language_modernization' }, 'transformation_kind_mismatch'],
    ['원문 밖 제작 범위', (p: Json) => { p.production[0].scope.last_paragraph = 99 }, 'scope_invalid'],
    ['보존 요소 허위 인용', (p: Json) => { p.preserve.events[0].anchors[0].quote = 'Tobias slipped.' }, 'anchor_quote_mismatch'],
    ['다른 원문 판에 대한 기준', (p: Json) => { p.source_sha256 = 'b'.repeat(64) }, 'policy_source_stale'],
    ['보존 요소 id 중복', (p: Json) => { p.preserve.motivations.push(p.preserve.events[0]) }, 'duplicate_id'],
    ['같은 판본 키 두 번', (p: Json) => { p.production[1].edition_key = 'story-b1' }, 'duplicate_edition_key'],
    ['V-Level 범위 뒤집힘', (p: Json) => { p.production[0].target.language.v_level_min = 9 }, 'target_range_invalid'],
    ['언어 수준을 실측이라 표시', (p: Json) => { p.production[0].target.language.basis = 'measured' }, 'schema_invalid_literal'],
    ['사고 난도를 실측이라 표시', (p: Json) => { p.production[0].target.cognitive.basis = 'measured' }, 'schema_invalid_literal'],
  ])('%s → %s', (_label, mutate, code) => {
    const p = fixture('policy')
    mutate(p)
    const { source } = load()
    expect(codes(validatePolicy(p, source))).toContain(code)
  })

  it('발췌 스냅숏으로 작품 전체 판본을 만들겠다고 하지 않는다', () => {
    const s = fixture('snapshot')
    s.coverage = 'excerpt'
    const src = validateSnapshot(s, NOW).value!
    expect(codes(validatePolicy(fixture('policy'), src))).toContain('coverage_claim_invalid')
  })

  it('제작 범위(production)를 늘려도 편집 기준 해시는 그대로다 — 기존 판본 검수가 낡지 않는다', () => {
    const before = load().policy.policy_sha256
    const p = fixture('policy')
    p.production.push({ ...p.production[0], edition_key: 'story-ep1', coverage: 'episode', scope: { first_paragraph: 0, last_paragraph: 3 } })
    expect(load(fixture('snapshot'), p).policy.policy_sha256).toBe(before)
    const q = fixture('policy')
    q.reason_to_read = `${q.reason_to_read} (수정)`
    expect(load(fixture('snapshot'), q).policy.policy_sha256).not.toBe(before)
  })
})

describe('판본 결과물 — 빈 값 · 허위 인용 · 순서 · 누락 거부', () => {
  it('내보낸 템플릿을 채우지 않고 그대로 내면 거부한다', () => {
    const { source, policy } = load()
    const slot = policy.items.get('story-b1')!
    const template = {
      schema: 'lcp-story/edition@1',
      task_id: `${WORK}:story-b1`,
      binding: {
        source_sha256: source.sha256,
        source_identity_sha256: source.identity_sha256,
        policy_sha256: policy.policy_sha256,
        target_sha256: slot.target_sha256,
      },
      edition_key: 'story-b1',
      kind: 'story_edition',
      produced_by: { agent: '', session_id: '', provenance: 'ai_generated' },
      title: '',
      hook: { text: '', source_anchors: [], spoiler_free: true },
      units: [],
      change_log: [],
      activities: [],
      assets: [],
    }
    const r = validateEdition(template, ctx('story-b1'))
    expect(r.ok).toBe(false)
    expect(r.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['edition.units', 'edition.title', 'edition.produced_by.agent']))
  })

  it.each([
    ['빈 단위 본문', (e: Json) => { e.units[0].text = '   ' }, 'text_empty'],
    ['채우지 않은 표시', (e: Json) => { e.units[0].text = 'TODO adapt this paragraph.' }, 'text_placeholder'],
    ['정규화 안 된 본문', (e: Json) => { e.units[0].text = `${e.units[0].text}  ` }, 'text_not_normalized'],
    ['단위 본문 중복', (e: Json) => { e.units[1].text = e.units[0].text }, 'unit_duplicate_text'],
    ['단위 id 중복', (e: Json) => { e.units[1].unit_id = 'u1' }, 'duplicate_id'],
    ['order 필드 어긋남', (e: Json) => { e.units[0].order = 2 }, 'unit_order_field_invalid'],
    ['허위 인용', (e: Json) => { e.units[0].source_anchors[0].quote = 'Upon the bleak shoulder of Gull Rock.' }, 'anchor_quote_mismatch'],
    ['한 칸 밀린 구간', (e: Json) => { e.units[1].source_anchors[0].start += 1; e.units[1].source_anchors[0].end += 1 }, 'anchor_quote_mismatch'],
    ['다른 원문 판의 앵커', (e: Json) => { e.units[2].source_anchors[0].source_sha256 = 'c'.repeat(64) }, 'anchor_source_hash_mismatch'],
    ['보존 요소를 엉뚱한 단위가 주장', (e: Json) => { e.units[6].preserves = []; e.units[0].preserves = ['ev-brig-saved'] }, 'preserve_item_unanchored'],
    ['보존 요소 누락', (e: Json) => { e.units[5].preserves = [] }, 'preserve_item_missing'],
    ['없는 보존 요소', (e: Json) => { e.units[0].preserves = ['nope'] }, 'preserve_unknown'],
    ['재서사 변경 기록', (e: Json) => { e.change_log[0].type = 'renarration' }, 'renarration_excluded'],
    ['story 판본의 수준 각색', (e: Json) => { e.change_log[0].type = 'level_adaptation' }, 'change_type_not_allowed'],
    ['주석 작업을 현대화로 기록', (e: Json) => { e.change_log[2].type = 'language_modernization' }, 'change_type_operation_mismatch'],
    ['결과 단위 없는 재작성', (e: Json) => { e.change_log[0].unit_ids = [] }, 'change_units_required'],
    ['민감 표현 처리 기록 삭제', (e: Json) => { e.change_log.splice(3, 1) }, 'sensitive_unhandled'],
    ['민감 표현 학습자 설명 없음', (e: Json) => { e.change_log[3].learner_note = null }, 'sensitive_note_missing'],
    ['민감 표현을 방침과 다르게 처리', (e: Json) => { e.change_log[3].operation = 'gloss' }, 'sensitive_handling_mismatch'],
    ['스포일러 구간을 진입 장면으로', (e: Json) => { e.hook.source_anchors = [e.units[3].source_anchors[0]] }, 'hook_outside_entry_scene'],
    ['빈 진입 장면', (e: Json) => { e.hook.text = '' }, 'text_empty'],
    ['요청한 원문 대응 자료 누락', (e: Json) => { e.activities.splice(3, 1) }, 'activity_missing'],
    ['선택지 구간 허위 인용', (e: Json) => { e.activities[0].task.options[0].start += 1 }, 'span_quote_mismatch'],
    ['없는 선택지를 정답으로', (e: Json) => { e.activities[0].task.answer.correct = ['o9'] }, 'answer_unknown_option'],
    ['순서 정답이 순열이 아님', (e: Json) => { e.activities[1].task.answer.order = ['i-fall', 'i-lamp', 'i-lamp'] }, 'order_answer_invalid'],
    ['원문 대응이 다른 장면을 가리킴', (e: Json) => { e.activities[3].source_anchors = [e.units[0].source_anchors[0]] }, 'bridge_unaligned'],
    ['결속 해시가 옛 기준', (e: Json) => { e.binding.policy_sha256 = 'd'.repeat(64) }, 'edition_binding_stale'],
    ['다른 작업의 결과물', (e: Json) => { e.task_id = 'other-work:story-b1' }, 'edition_task_mismatch'],
    ['정의되지 않은 승인 표지', (e: Json) => { e.verified = true }, 'schema_unrecognized_keys'],
  ])('%s → %s', (_label, mutate, code) => {
    expect(codes(validateStory(mutate))).toContain(code)
  })

  it('원작 순서를 바꾼 단위를 거부한다(재서사 제외)', () => {
    const r = validateStory((e) => {
      const [a, b] = [e.units[3], e.units[4]]
      e.units[3] = { ...b, order: 4 }
      e.units[4] = { ...a, order: 5 }
    })
    expect(codes(r)).toContain('unit_order_changed')
  })

  it('원문 문단을 말없이 빠뜨리면 정렬 누락이다 — omit 기록이 있으면 통과', () => {
    const missing = validateStory((e) => {
      e.units.splice(0, 1)
      e.units.forEach((u: Json, i: number) => { u.order = i + 1 })
      e.change_log[0].unit_ids = ['u2', 'u6']
    })
    expect(codes(missing)).toContain('alignment_gap')
    const omitted = validateStory((e) => {
      e.units.splice(0, 1)
      e.units.forEach((u: Json, i: number) => { u.order = i + 1 })
      e.change_log[0].unit_ids = ['u2', 'u6']
      e.change_log.push({
        change_id: 'c-omit-opening',
        type: 'language_modernization',
        operation: 'omit',
        unit_ids: [],
        source_anchors: [story().units[0].source_anchors[0]],
        sensitive_ref: null,
        rationale: '도입 문단을 뺀 테스트 변형',
        learner_note: null,
      })
    })
    expect(codes(omitted)).not.toContain('alignment_gap')
    expect(omitted.errors).toEqual([])
  })

  it('판단 구조가 아닌 자유서술 과제 · 해석 문항의 정답 키를 받지 않는다', () => {
    expect(codes(validateStory((e) => { e.activities[0].task = { interaction: 'free_text', prompt: 'Explain.' } }))).toContain('schema_invalid_union_discriminator')
    expect(codes(validateStory((e) => { e.activities[2].task.answer.correct = ['o1'] }))).toContain('schema_unrecognized_keys')
  })

  it('요청하지 않은 활동을 쉬운 판본에 붙이지 않는다', () => {
    const e = fixture('easy-a2.edition.out')
    e.activities = [story().activities[3]]
    expect(codes(validateEdition(e, ctx('easy-a2')))).toContain('activity_not_requested')
  })

  it('판본 결과물을 다른 판본 자리에 쓰지 않는다', () => {
    const r = validateEdition(story(), ctx('easy-a2'))
    expect(codes(r)).toEqual(expect.arrayContaining(['edition_task_mismatch', 'edition_slot_mismatch', 'edition_binding_stale']))
  })

  it('실제 원천에 합성 판본을 붙이지 않는다', () => {
    const base = load(realLikeSnapshot())
    expect(codes(validateEdition(story(), ctx('story-b1', base)))).toContain('synthetic_mismatch')
  })
})

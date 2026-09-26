// packages/video-factory/src/__tests__/requests.test.ts
//
// 요청 편의 약속 — 초안에 숫자를 직접 못 쓴다 · 문제로 열고 행동으로 닫는다 · 근거 없는 효과 주장은
// 막힌다 · 수치는 원료에서만 온다 · 기존 규칙 편의 장면을 빌릴 수 있다.
// 원료는 커밋된 고정 픽스처를 쓴다(테스트 전용 — 영상·광고에 쓰지 않는다).

import { describe, expect, it } from 'vitest'

import { buildSpecs } from '../catalog/build'
import { loadBundle } from '../catalog/bundle'
import { requestVideoId } from '../catalog/ids'
import { checkDesign } from '../requests/design'
import { resolveFact, strayDigits } from '../requests/facts'
import { buildRequestSpec, type RequestMeta } from '../requests/to-spec'
import { mergeSpecs, pickRequestOwners } from '../requests/merge'
import { outcomeWindow } from '../requests/outcome'
import { MissingRetiredError, readRetired, splitRetired, type RetirementState } from '../requests/retired'
import type { RequestDesign, RequestPlan } from '../requests/types'
import { FIXTURE_BUNDLE_PATH } from './test-bundle'

const bundle = loadBundle(FIXTURE_BUNDLE_PATH)
const ctx = { bundle, catalog: buildSpecs(bundle) }

const plan: RequestPlan = {
  need: '내 수준에 맞는 교재를 고르고 싶다',
  problem: '교재가 너무 쉽거나 너무 어렵다',
  promise: '단계별 권이 수준에 맞춰 나뉘어 있다',
  message: '내 단계의 권부터 시작하면 된다',
  action: '내 단계의 권을 열어 목차를 본다',
}

const meta: RequestMeta = {
  videoId: requestVideoId('volume-reading-4', 'a1b2c3d4-0000'),
  purpose: 'buy',
  audience: 'student',
  formats: ['wide'],
  plan,
}

function good(): RequestDesign {
  return {
    title: '독해 4단계',
    subtitle: '내 수준에서 시작하는 권',
    facts: [{ name: 'items', path: 'series[id=reading].rungs[step=4].items', label: '4단계 문항' }],
    scenes: [
      { role: 'problem', kind: 'hook', caption: '교재가 너무 어렵나요?', line: '교재가 너무 어렵나요?' },
      {
        role: 'solution',
        kind: 'statement',
        caption: '이 권에는 문항 {{items}}개가 있어요.',
        title: '수준에 맞춘 권',
        body: '문항 {{items}}개',
        basis: '교재 서가 실측',
      },
      { role: 'proof', kind: 'stat', caption: '이 단계의 문항 수', stats: [{ fact: 'items', label: '문항' }] },
      {
        role: 'action',
        kind: 'closing',
        caption: '목차를 열어 보세요',
        line: '목차를 열어 보세요',
        cta: '목차 보기',
        url: 'vocaflow.app/textbook',
      },
    ],
  }
}

describe('facts', () => {
  it('경로로 원료 값을 꺼낸다', () => {
    expect(resolveFact(bundle, 'series[id=reading].rungs[step=4].items')).toEqual({ ok: true, value: 24396 })
  })
  it('없는 경로는 0 이 아니라 실패다', () => {
    expect(resolveFact(bundle, 'series[id=nope].rungs[0].items').ok).toBe(false)
  })
  it('자리표시 밖의 숫자를 잡는다', () => {
    expect(strayDigits('문항 {{items}}개')).toEqual([])
    expect(strayDigits('문항 24,396개')).toEqual(['24,396'])
  })
})

describe('checkDesign', () => {
  it('좋은 초안은 통과하고 수치는 원료에서 채워진다', () => {
    const r = checkDesign(plan, good(), meta, ctx)
    expect(r.items.filter((i) => i.level === 'error')).toEqual([])
    expect(r.ok).toBe(true)
  })

  it('숫자를 직접 쓰면 막힌다', () => {
    const d = good()
    d.scenes[1]!.caption = '이 권에는 문항 24,396개가 있어요.'
    expect(checkDesign(plan, d, meta, ctx).items.map((i) => i.rule)).toContain('stray-number')
  })

  it('문제로 열지 않거나 행동으로 닫지 않으면 막힌다', () => {
    const d = good()
    d.scenes[0]!.role = 'solution'
    d.scenes.pop()
    const rules = checkDesign(plan, d, meta, ctx).items.map((i) => i.rule)
    expect(rules).toContain('open-with-problem')
    expect(rules).toContain('close-with-action')
  })

  it('첫 장면이 길면 막힌다', () => {
    const d = good()
    d.scenes[0]!.caption = '교재를 고를 때마다 너무 쉽거나 너무 어려워서 결국 끝까지 풀지 못한 적이 있지 않나요, 그런 분들을 위해'
    expect(checkDesign(plan, d, meta, ctx).items.map((i) => i.rule)).toContain('hook-too-slow')
  })

  it('근거 없는 효과 주장은 막힌다', () => {
    const d = good()
    d.scenes[1]!.caption = '성적이 오릅니다.'
    expect(checkDesign(plan, d, meta, ctx).items.map((i) => i.rule)).toContain('unsupported-claim')
  })

  it('원료에 없는 수치를 인용하면 설계도가 되지 못한다', () => {
    const d = good()
    d.facts[0]!.path = 'series[id=reading].rungs[step=99].items'
    expect(checkDesign(plan, d, meta, ctx).items.map((i) => i.rule)).toContain('fact-unresolved')
  })

  it('기획이 비면 막힌다', () => {
    expect(checkDesign({ ...plan, problem: '' }, good(), meta, ctx).ok).toBe(false)
  })

  it('기존 규칙 편의 장면을 빌린다 — 근거도 같이 온다', () => {
    const src = ctx.catalog.find((s) => s.id === 'series-reading')
    expect(src).toBeDefined()
    const idx = src!.scenes.findIndex((s) => s.kind === 'shelf' || s.kind === 'ladder')
    expect(idx).toBeGreaterThanOrEqual(0)
    const d = good()
    d.scenes.splice(2, 1, { role: 'proof', kind: 'borrow', caption: '단계별 권이 꽂혀 있어요', videoId: 'series-reading', sceneIndex: idx })
    const r = checkDesign(plan, d, meta, ctx)
    expect(r.ok).toBe(true)
  })
})

describe('requestVideoId', () => {
  it('슬러그 + 요청 id 앞 6자, 한글 대상은 custom', () => {
    expect(requestVideoId('volume-reading-4', 'A1B2C3D4-xx')).toBe('req-volume-reading-4-a1b2c3')
    expect(requestVideoId('여름 특강', 'abcdef12')).toBe('req-custom-abcdef')
  })
})

describe('검토 미리보기', () => {
  it('원료가 있으면 자리표시를 채운 모습을 함께 낸다', () => {
    const r = checkDesign(plan, good(), meta, ctx)
    expect(r.preview?.scenes[1]?.caption).toBe('이 권에는 문항 24,396개가 있어요.')
    expect(r.preview?.evidence.some((e) => e.source.includes('rungs[step=4].items'))).toBe(true)
  })
})

describe('교체 · 내리기 — 합치기 규칙', () => {
  const rule = ctx.catalog
  const target = rule.find((s) => s.id === 'series-reading')!

  it('교체 편은 같은 id 의 규칙 편을 이기고, 원래 종류를 이어받는다', () => {
    const r = buildRequestSpec(good(), { ...meta, videoId: 'series-reading', mode: 'replace' }, ctx)
    expect(r.spec?.id).toBe('series-reading')
    expect(r.spec?.kind).toBe(target.kind)
    expect(r.spec?.brief?.replaces).toBe('series-reading')
    const merged = mergeSpecs(rule, [r.spec!], new Set())
    expect(merged.length).toBe(rule.length)
    expect(merged.find((s) => s.id === 'series-reading')?.title).toBe(r.spec!.title)
  })

  it('새 요청 편은 같은 id 가 있으면 진다 — 기존 편을 조용히 덮지 않는다', () => {
    const imposter = { ...target, title: '가짜', brief: undefined }
    const merged = mergeSpecs(rule, [imposter], new Set())
    expect(merged.find((s) => s.id === 'series-reading')?.title).toBe(target.title)
  })

  it('내린 id 는 어디에도 안 나온다', () => {
    const merged = mergeSpecs(rule, [], new Set(['series-reading']))
    expect(merged.some((s) => s.id === 'series-reading')).toBe(false)
    expect(merged.length).toBe(rule.length - 1)
  })

  it('내린 편 목록 파일이 없으면 빈 목록으로 삼키지 않고 멈춘다', () => {
    expect(() => readRetired('does/not/exist.json')).toThrow(MissingRetiredError)
  })
})

describe('같은 자리의 요청이 여럿일 때 (PR #119 리뷰 결함 1·2)', () => {
  const rule = ctx.catalog
  const base = rule.find((s) => s.id === 'series-reading')!

  it('규칙 편에 없는 id 의 요청 편이 둘이면 뒤의 것이 이긴다(첫 항목이 남지 않는다)', () => {
    const v1 = { ...base, id: 'req-x-1', title: '옛 편' }
    const v2 = { ...base, id: 'req-x-1', title: '새 편' }
    const merged = mergeSpecs(rule, [v1, v2], new Set())
    const mine = merged.filter((s) => s.id === 'req-x-1')
    expect(mine.length).toBe(1)
    expect(mine[0]!.title).toBe('새 편')
  })

  it('교체 편이 둘이어도 규칙 자리에서 뒤의 것이 이긴다', () => {
    const r1 = { ...base, title: '교체 1', brief: { ...base.brief, replaces: 'series-reading' } } as typeof base
    const r2 = { ...base, title: '교체 2', brief: { ...base.brief, replaces: 'series-reading' } } as typeof base
    const merged = mergeSpecs(rule, [r1, r2], new Set())
    expect(merged.filter((s) => s.id === 'series-reading').map((s) => s.title)).toEqual(['교체 2'])
  })

  const row = (id: string, phase: string, created_at: string, videoId = 'series-reading') => ({ id, phase, created_at, videoId })

  it('주인은 입력 순서가 아니라 created_at 으로 정해진다', () => {
    const a = row('a', 'evaluated', '2026-09-20T00:00:00+00:00')
    const b = row('b', 'applied', '2026-09-25T00:00:00+00:00')
    expect(pickRequestOwners([a, b]).owners.map((r) => r.id)).toEqual(['b'])
    expect(pickRequestOwners([b, a]).owners.map((r) => r.id)).toEqual(['b'])
  })

  it('옛 failed 는 같은 자리의 새 교체 요청이 있으면 재시도하지 않는다 — applying 두 행이 생기지 않는다', () => {
    const oldFailed = row('old', 'failed', '2026-09-20T00:00:00+00:00')
    const newApproved = row('new', 'approved', '2026-09-25T00:00:00+00:00')
    const p = pickRequestOwners([newApproved, oldFailed])
    expect(p.starters.map((r) => r.id)).toEqual(['new'])
    expect(p.superseded.map((r) => r.id)).toEqual(['old'])
  })

  it('자리의 주인인 failed 는 재시도한다', () => {
    const p = pickRequestOwners([row('old', 'evaluated', '2026-09-20T00:00:00+00:00'), row('new', 'failed', '2026-09-25T00:00:00+00:00')])
    expect(p.starters.map((r) => r.id)).toEqual(['new'])
    expect(p.superseded).toEqual([])
  })

  it('다른 자리는 서로 간섭하지 않는다', () => {
    const p = pickRequestOwners([row('a', 'approved', '2026-09-20T00:00:00+00:00', 'x'), row('b', 'failed', '2026-09-21T00:00:00+00:00', 'y')])
    expect(p.starters.map((r) => r.id).sort()).toEqual(['a', 'b'])
  })
})

describe('교체 편 평가 창 (결함 3)', () => {
  it('발행 시각이 있으면 그 뒤만 센다', () => {
    expect(outcomeWindow({ mode: 'replace', applied_at: '2026-09-25T00:00:00+00:00' })).toEqual({
      since: '2026-09-25T00:00:00+00:00',
      measurable: true,
      note: null,
    })
  })

  it('교체 편인데 발행 시각이 없으면 옛 편 기록을 섞지 않고 재지 않는다', () => {
    const w = outcomeWindow({ mode: 'replace', applied_at: null })
    expect(w.measurable).toBe(false)
    expect(w.note).toContain('applied_at')
  })

  it('새 편은 옛 기록이 없으니 창 제한 없이 잰다', () => {
    expect(outcomeWindow({ mode: 'new', applied_at: null })).toEqual({ since: null, measurable: true, note: null })
  })
})

describe('purge 뒤 되살리기 (결함 5)', () => {
  const r = (video_id: string, extra: Partial<RetirementState> = {}): RetirementState => ({
    video_id,
    restored_at: null,
    purged_at: null,
    rerender_requested_at: null,
    ...extra,
  })

  it('다시 찍기가 요청된 purge 편은 렌더 목록에서 빠지지 않지만 포장·발행에서는 계속 빠진다', () => {
    const s = splitRetired([
      r('kept'),
      r('purged-only', { purged_at: '2026-09-24T00:00:00Z' }),
      r('again', { purged_at: '2026-09-24T00:00:00Z', rerender_requested_at: '2026-09-25T00:00:00Z' }),
      r('restored', { restored_at: '2026-09-25T00:00:00Z' }),
    ])
    expect(s.excluded.sort()).toEqual(['again', 'kept', 'purged-only'])
    expect(s.forRender.sort()).toEqual(['kept', 'purged-only'])
    expect(s.rerender).toEqual(['again'])
  })

  it('마이그레이션 전(칸 없음)이면 예전과 같다', () => {
    const s = splitRetired([{ video_id: 'a', restored_at: null, purged_at: '2026-09-24T00:00:00Z' }])
    expect(s.forRender).toEqual(['a'])
    expect(s.rerender).toEqual([])
  })
})

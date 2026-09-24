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
import { mergeSpecs } from '../requests/merge'
import { MissingRetiredError, readRetired } from '../requests/retired'
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

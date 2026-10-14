// apps/web/src/lib/csat/map/v62/__tests__/factory-wire.test.ts
//
// Factory Integration v1.1 — 외부 공장이 읽을 **표준 JSON** 요청 · 응답(Codex I08 · I09).
//   ① 정규 JSON 직렬화 규칙(canonical-json.ts) ② 요청 본문 JSON.parse · requestId 재계산 ③ 요청 · 응답이 JSON Schema(docs/csat-learner/v62/schema) 형식 통과
//   ④ 예시 파일(examples.json)이 지금 코드의 출력과 같다(낡은 예시 금지 — 다시 만들려면 UPDATE_FACTORY_EXAMPLES=1)
// Schema 는 형식만 본다 — 상태 전이 · 승인 · 노출은 factory-integration.ts 검사가 본다(이 시험이 그것을 대신하지 않는다).
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import Ajv2020 from 'ajv/dist/2020'
import { describe, expect, it } from 'vitest'

import { CanonicalJsonError, canonicalJson } from '../canonical-json'
import type { WorkspaceDemand } from '../demand'
import { buildFactoryRequests, existingAssetManifest, requestBody, validateManifest } from '../factory-integration'
import { mockFactory } from '../factory-mock'
import { canonicalDemand, demandSignature } from '../persist-contract'
import type { SupplyLine } from '../supply'

const DIR = path.resolve(__dirname, '../../../../../../../../docs/csat-learner/v62/schema')
const load = (f: string) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
const ajv = new Ajv2020({ strict: false, allErrors: true })
const requestSchema = ajv.compile(load('factory-request.schema.json'))
const manifestSchema = ajv.compile(load('factory-manifest.schema.json'))

const demand = (o: Partial<WorkspaceDemand> = {}): WorkspaceDemand => ({
  key: 'example-demand', template: 'ws.reading', workspaceId: 'ws-example', goalVersion: 7, planVersion: 2, definitionVersion: 'v6.2', asOf: '2026-10-15T00:00:00Z',
  core: 'r.central_meaning', support: [], purpose: { need: null, evidence: 'example', independentItems: null, unknowns: [] },
  lines: [
    { role: 'guided_practice', task: 'r.central_meaning', taskKeys: [], csatTypes: ['R-TOPIC'], quantity: { n: 3, unit: '문항' }, requires: { rightsUsable: true, gold: false, unseenByLearner: false, noExplanationBefore: false }, reuse: true, reason: 'stage_repair' },
    { role: 'independent_check', task: 'r.central_meaning', taskKeys: ['k'], csatTypes: ['R-TOPIC'], quantity: { n: 2, unit: '문항' }, requires: { rightsUsable: true, gold: true, unseenByLearner: true, noExplanationBefore: true }, reuse: true, reason: 'stage_check' },
  ],
  ...o,
}) as WorkspaceDemand

function examples() {
  const [guided, check] = buildFactoryRequests('example-user', demand())
  const existing: SupplyLine = {
    role: 'independent_check', state: 'available', delivered: [{ ref: '2022-20', source: 'check_task' }], shortfall: 1, reason: '',
    qualification: { producible: true, rights: true, content: true, teaching: true, assessment: true, learner: true, runnable: true },
  }
  return {
    population: 'synthetic_contract_example — 실제 공장 호출 · 실제 산출물 · 승인 0',
    request: guided!,
    requestBody: requestBody(guided!),
    manifests: {
      mock_test_fixture: mockFactory(guided!, 'test_fixture'),
      mock_unsupported_assessment: mockFactory(check!, 'produced_unreviewed'),
      existing_r5: existingAssetManifest(check!, existing, (ref) => createHash('sha256').update(`example:${ref}`).digest('hex')).manifest,
    },
  }
}

describe('정규 JSON(canonical-json.ts)', () => {
  it('키 순서와 무관 · 중첩까지 · 배열 순서는 보존 · undefined 키는 생략 · 결과는 JSON.parse 가능', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, 1], c: null } })).toBe('{"a":{"c":null,"d":[3,1]},"b":1}')
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}')
    expect(JSON.parse(canonicalJson({ z: '한글', y: [true, false] }))).toEqual({ y: [true, false], z: '한글' })
  })
  it('JSON 으로 표현 안 되는 값은 거절(배열 안 undefined · NaN · Infinity · 함수 · bigint · 클래스 인스턴스)', () => {
    for (const bad of [[undefined], Number.NaN, Number.POSITIVE_INFINITY, () => 1, BigInt(1), new Date(0)]) {
      expect(() => canonicalJson({ x: bad }), String(bad)).toThrow(CanonicalJsonError)
    }
  })
})

describe('요청 · 응답 표준 JSON', () => {
  const ex = examples()
  it('요청 본문은 표준 JSON · requestId 를 포함하지 않는다 · requestId = SHA-256(본문) 앞 32자', () => {
    const parsed = JSON.parse(ex.requestBody)
    expect(parsed.requestId).toBeUndefined()
    expect(createHash('sha256').update(ex.requestBody).digest('hex').slice(0, 32)).toBe(ex.request.requestId)
    expect(JSON.parse(JSON.stringify(ex.request))).toEqual(ex.request)
  })
  it('요청이 JSON Schema 를 통과한다 · 키 순서를 섞어도 같은 본문', () => {
    expect(requestSchema(ex.request), JSON.stringify(requestSchema.errors)).toBe(true)
    const shuffled = Object.fromEntries(Object.entries(ex.request).reverse()) as typeof ex.request
    expect(requestBody(shuffled)).toBe(ex.requestBody)
  })
  it('응답 예시가 JSON Schema 와 계약 검사를 함께 통과한다(형식 통과 ≠ 공급 가능)', () => {
    const [guided, check] = buildFactoryRequests('example-user', demand())
    for (const [name, m] of Object.entries(ex.manifests)) {
      expect(manifestSchema(m), `${name}: ${JSON.stringify(manifestSchema.errors)}`).toBe(true)
      const r = name === 'mock_test_fixture' ? guided! : check!
      expect(validateManifest(m, r), name).toEqual([])
    }
  })
  it('수요 서명 v2 — 중첩 requires 의 키 순서와 무관 · 지원 TASK 가 바뀌면 다른 수요', () => {
    const d = demand()
    const reordered = demand({ lines: d.lines.map((l) => ({ ...l, requires: Object.fromEntries(Object.entries(l.requires).reverse()) as typeof l.requires })) })
    expect(demandSignature('u', reordered)).toBe(demandSignature('u', d))
    expect(JSON.parse(canonicalDemand('u', d)).v).toBe(2)
    expect(demandSignature('u', demand({ support: ['s.form_scope'] as WorkspaceDemand['support'] }))).not.toBe(demandSignature('u', d))
  })
  it('예시 파일 = 지금 코드의 출력(낡은 예시 금지)', () => {
    const file = path.join(DIR, 'examples.json')
    const text = JSON.stringify(ex, null, 2) + '\n'
    if (process.env.UPDATE_FACTORY_EXAMPLES === '1') fs.writeFileSync(file, text)
    expect(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).toBe(text)
  })
})

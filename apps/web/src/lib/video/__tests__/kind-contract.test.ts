// apps/web/src/lib/video/__tests__/kind-contract.test.ts
//
// **영상 종류 목록이 네 곳에서 갈리지 않게 잠근다.**
//
// 종류(`VideoKind`)는 지금 네 곳에 나온다:
//   ① `lib/video/catalog.ts` 의 `KIND_LABEL`      — 정본
//   ② `lib/video/components.ts` 의 구성요소 열거    — 분모
//   ③ `lib/analytics/events.ts` 의 `kind` 열거형   — 계측 계약(**일부러 import 를 안 한다**)
//   ④ 공장 `spec/types.ts` 의 `VideoKind`         — 다른 패키지
//
// ①②④ 는 타입이 이어져 있어 컴파일러가 잡는다. **③ 만 안 잡힌다** — 분석 계약은 홀로 서야
// 해서 아무것도 import 하지 않기 때문이다. 그런데 거기서 빠지면 **조용히 버려진다**:
// 수신부는 어떤 실패에도 204 를 주므로 화면도 로그도 아무 말을 안 한다(이 저장소가 이미 겪음).
// 그래서 여기서 **소스 글자를 직접 읽어** 맞대 본다.

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { KIND_LABEL, KIND_ORDER } from '../catalog'
import { componentCountByKind, platformComponents } from '../components'

const EVENTS_SRC = path.resolve(__dirname, '../../analytics/events.ts')

describe('종류 목록 — 정본', () => {
  it('KIND_ORDER 는 KIND_LABEL 에서 나온다 (손으로 적는 곳이 없다)', () => {
    expect(KIND_ORDER).toEqual(Object.keys(KIND_LABEL))
    expect(KIND_ORDER.length).toBeGreaterThan(0)
  })

  it('사용자가 이름 댄 구성요소가 전부 종류로 있다', () => {
    // 플랫폼 · 학습방법 · 권장안 · 교재(유형) · 브랜드 · 시리즈.
    // 이 중 학습방법·권장안이 2026-09-13까지 **한 편도 없었다** — 그래서 여기 박아 둔다.
    for (const k of ['intro', 'method', 'advice', 'type', 'series', 'curriculum'] as const) {
      expect(KIND_ORDER).toContain(k)
    }
  })
})

describe('분모 — 구성요소 열거', () => {
  it('모든 종류가 구성요소를 하나 이상 갖는다 — 빈 종류는 영원히 안 채워진다', () => {
    const counts = componentCountByKind()
    for (const k of KIND_ORDER) {
      expect(counts[k], `${k} 종류에 구성요소가 0개다`).toBeGreaterThan(0)
    }
  })

  it('합계가 구성요소 수와 같다 — 어느 종류에도 안 세어진 것이 없다', () => {
    const counts = componentCountByKind()
    const sum = KIND_ORDER.reduce((n, k) => n + counts[k], 0)
    expect(sum).toBe(platformComponents().length)
  })

  it('id 가 겹치지 않는다 — 겹치면 한 편이 다른 편을 덮는다', () => {
    const ids = platformComponents().map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('모든 구성요소에 출처가 있다 — "왜 이게 목록에 있나" 의 답', () => {
    for (const c of platformComponents()) {
      expect(c.source.length, `${c.id} 에 출처가 없다`).toBeGreaterThan(0)
      expect(c.name.length, `${c.id} 에 이름이 없다`).toBeGreaterThan(0)
    }
  })
})

describe('계측 계약 — events.ts 는 import 를 안 하므로 글자로 맞댄다', () => {
  const src = fs.readFileSync(EVENTS_SRC, 'utf8')

  it('video_started · video_completed 의 kind 열거에 모든 종류가 있다', () => {
    // 두 이벤트의 열거를 각각 따로 본다 — 한쪽에만 넣고 넘어가는 것이 실제 실패 모양이다.
    for (const event of ['video_started', 'video_completed']) {
      const at = src.indexOf(`name: '${event}'`)
      expect(at, `${event} 이벤트가 없다`).toBeGreaterThan(-1)
      // 그 이벤트 블록 안에서만 찾는다(다음 이벤트 선언 전까지).
      const nextEvent = src.indexOf("name: '", at + 10)
      const block = src.slice(at, nextEvent === -1 ? undefined : nextEvent)
      for (const k of KIND_ORDER) {
        expect(block.includes(`'${k}'`), `${event} 의 kind 열거에 '${k}' 가 없다`).toBe(true)
      }
    }
  })

  it('열거에 **없는 종류**를 넣어 두지 않았다 — 사라진 종류를 계속 받고 있으면 그것도 드리프트다', () => {
    const at = src.indexOf("name: 'video_started'")
    const nextEvent = src.indexOf("name: '", at + 10)
    const block = src.slice(at, nextEvent === -1 ? undefined : nextEvent)
    const kindLine = block.slice(block.indexOf('kind:'), block.indexOf('format:'))
    // `'…'` 꼴을 전부 꺼내 KIND_ORDER 와 **집합으로** 비교한다.
    const declared = [...kindLine.matchAll(/'([a-z]+)'/g)].map((m) => m[1])
    expect(new Set(declared)).toEqual(new Set(KIND_ORDER))
  })
})

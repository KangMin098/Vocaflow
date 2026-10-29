// apps/web/src/components/echo/__tests__/model-retry.test.ts
//
// T-0267 — 음성 모델 다운로드 실패 뒤 「음성 모델 다시 받기」가 실제로 다시 받는다.
// 실패 뒤 piperReady 는 이미 false 라 그 값만 다시 세우면 효과가 다시 돌지 않았다 — 명시적 재시도 세대(modelTry)를 효과 의존성에 넣는다.
// 자동 반복 없음(단추만 올린다) · 받는 중 중복 요청 없음 · 이탈 뒤 늦은 결과는 기존 cancelled 가 버린다.
// node 환경이라 배선을 소스로 고정하고, 실제 실패→재시도→성공/재실패 · 중복 · 언마운트는 하네스(pd-t267-r1)가 잰다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const c = readFileSync(join(__dirname, '../EchoMatchPlayer.tsx'), 'utf8')
const lib = readFileSync(join(__dirname, '../../../lib/echo/piper-tts.ts'), 'utf8')

describe('명시적 재시도 세대', () => {
  it('다운로드 효과가 modelTry 에 의존한다', () => {
    expect(c).toContain('}, [micGranted, piperReady, modelTry])')
  })
  it('modelTry 는 「음성 모델 다시 받기」에서만 올린다(자동 반복 0) · 받는 중이면 무시', () => {
    expect((c.match(/setModelTry\(/g) ?? []).length).toBe(1)
    expect(c).toMatch(/onClick=\{\(\) => \{\n\s+if \(piperLoading\) return\n\s+setError\(null\)\n\s+setPiperReady\(false\)\n\s+setModelTry\(\(n\) => n \+ 1\)/)
  })
  it('이탈 · 재실행 뒤 늦은 결과는 cancelled 로 버린다(기존 정리 유지)', () => {
    const eff = c.slice(c.indexOf('if (!micGranted || piperReady) return'), c.indexOf('}, [micGranted, piperReady, modelTry])'))
    expect(eff).toContain('let cancelled = false')
    expect(eff).toMatch(/if \(!cancelled\) \{\n\s+setPiperReady\(true\)/)
    expect(eff).toMatch(/return \(\) => \{\n\s+cancelled = true/)
  })
  it('다운로드 성공은 재생 · 녹음을 시작하지 않는다(효과 안에 startListen · recordUntilStop 없음)', () => {
    const eff = c.slice(c.indexOf('if (!micGranted || piperReady) return'), c.indexOf('}, [micGranted, piperReady, modelTry])'))
    expect(eff).not.toMatch(/startListen|recordUntilStop|playAudioBuffer/)
  })
})

describe('ensurePiperSession 은 실패 뒤 재호출을 받는다(기존 계약)', () => {
  it('initPromise 를 finally 에서 비운다', () => {
    expect(lib).toMatch(/try \{\n\s+return await initPromise\n\s+\} finally \{\n\s+initPromise = null\n\s+\}/)
  })
})

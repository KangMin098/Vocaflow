// apps/web/src/components/echo/__tests__/retry-focus.test.ts
//
// T-0258 — EchoMatch 결과 「한 번 더」 · 오류 「이 문장 다시 하기」 뒤 새 시도의 「시작」으로 초점을 한 번 넘긴다.
// 자료 변경 · 이전/다음 문장 · 부모 갱신도 쓰는 handleRetry 에는 초점을 넣지 않는다. 초점만 옮기고 재생 · 녹음은 시작하지 않는다.
// 이 저장소의 vitest 는 node 환경이라 배선을 소스로 고정하고, 실제 DOM 전환은 하네스(pd-t258-r1)가 잰다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const c = readFileSync(join(__dirname, '../EchoMatchPlayer.tsx'), 'utf8')
const retryBody = c.slice(c.indexOf('  function handleRetry() {'), c.indexOf('  // 학습자가 「한 번 더」'))

describe('명시적 재시도만 초점을 예약한다', () => {
  it('handleUserRetry 가 한 번용 표식을 세우고 공통 handleRetry 를 부른다', () => {
    expect(c).toMatch(/function handleUserRetry\(\) \{\n\s+focusStartOnce\.current = true\n\s+handleRetry\(\)\n\s+\}/)
  })
  it('공통 handleRetry 에는 초점 · 표식이 없다(자료 변경 · 이전/다음이 초점을 빼앗지 않게)', () => {
    expect(retryBody).not.toMatch(/focus|focusStartOnce/)
    expect((c.match(/focusStartOnce\.current = true/g) ?? []).length).toBe(1)
  })
  it('결과 「한 번 더」 · 하단 「다시」 · 오류 「이 문장 다시 하기」만 handleUserRetry 를 쓴다 · 이전/다음 · 자료 변경은 handleRetry', () => {
    expect(c).toContain('onRetry={handleUserRetry}')
    expect((c.match(/onClick=\{handleUserRetry\}/g) ?? []).length).toBe(2)
    expect((c.match(/onClick=\{handleRetry\}/g) ?? []).length).toBe(0)
    expect((c.match(/^\s+handleRetry\(\)$/gm) ?? []).length).toBeGreaterThanOrEqual(3)
  })
})

describe('시작 단추로 한 번 · 클릭 없이', () => {
  it('idle 이고 오류가 없을 때 한 번만 focus 하고 표식을 지운다', () => {
    expect(c).toMatch(/useLayoutEffect\(\(\) => \{\n\s+if \(!focusStartOnce\.current \|\| phase !== 'idle' \|\| error\) return\n\s+focusStartOnce\.current = false\n\s+startBtnRef\.current\?\.focus\(\)\n\s+\}, \[phase, error\]\)/)
  })
  it('시작 단추에 ref 만 단다 — 초점 이동이 onStart(재생)를 부르지 않는다', () => {
    expect(c).toContain('startRef={startBtnRef}')
    expect(c).toMatch(/ref=\{startRef\}\n\s+type="button"\n\s+onClick=\{onStart\}/)
    const effect = c.slice(c.indexOf('useLayoutEffect(() => {\n    if (!focusStartOnce'), c.indexOf('}, [phase, error])'))
    expect(effect).not.toMatch(/startListen|onStart|click\(/)
  })
})

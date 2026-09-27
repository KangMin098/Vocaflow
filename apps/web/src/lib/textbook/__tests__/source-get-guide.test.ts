// apps/web/src/lib/textbook/__tests__/source-get-guide.test.ts
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { sourceGetGuide, sourceGetPrompt } from '../source-get-guide'
import inventory from '../source-inventory-snapshot.json'

const ROOT = path.resolve(__dirname, '../../../../../..')
const sources = inventory.sources.map((s) => s.source)

describe('원천별 가져오는 법', () => {
  it('명령이 가리키는 스크립트가 저장소에 있다', () => {
    for (const source of sources) {
      const guide = sourceGetGuide(source)
      if (!guide) continue
      for (const step of guide.steps) {
        const file = step.command?.match(/scripts\/\S+\.m[jt]s/)?.[0]
        if (file) expect(fs.existsSync(path.join(ROOT, file)), `${source}: ${file}`).toBe(true)
      }
    }
  })

  it('명령이 있는 첫 단계는 읽기 전용이다 (예행 먼저)', () => {
    for (const source of sources) {
      const guide = sourceGetGuide(source)
      const first = guide?.steps.find((s) => s.command)
      if (first) expect(first.writes, source).toBe(false)
    }
  })

  it('--commit 이 든 명령은 쓰기로 표시된다', () => {
    for (const source of sources) {
      for (const step of sourceGetGuide(source)?.steps ?? []) {
        if (step.command?.includes('--commit')) expect(step.writes, `${source}: ${step.title}`).toBe(true)
      }
    }
  })

  it('재고에 있는 원천 대부분에 경로가 있다', () => {
    const missing = sources.filter((s) => !sourceGetGuide(s))
    expect(missing).toEqual(['african_storybook'])
  })

  it('지시문은 쓰기 앞에서 확인을 받게 한다', () => {
    const prompt = sourceGetPrompt('voa', 'VOA', sourceGetGuide('voa')!)
    expect(prompt).toContain('확인을 받아')
    expect(prompt).toContain('collect-daily.mjs --source voa')
  })
})

// apps/web/src/lib/framework/__tests__/memory-labels.test.ts
//
// 기억 4상태 이름이 **화면에서 다시 지어지지 않도록** 잠근다.
//
// 실측 2026-08-15: 같은 네 상태를 다섯 벌로 부르고 있었다. `/wordvault` 한 화면 안에서만도
// 히어로는 "확실·익숙·회복", 아래 섹션들은 "안정·흔들림·위급" 이었다. 아무 에러도 없었고
// 화면은 멀쩡했다 — 학습자만 그 넷이 같은 칸인지 알 수 없었다.
//
// 이 테스트는 소스를 훑어 **레지스트리를 안 거친 상태 라벨 리터럴**을 찾는다.
// `on-p-contrast` 래칫과 같은 방식 — 새 컴포넌트가 조용히 자기 어휘를 만들면 여기서 걸린다.

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { MEMORY_LABEL, MEMORY_ORDER } from '../memory-labels'

const SRC = path.resolve(__dirname, '../../..')

/** 과거에 쓰였던 어휘 전부 — 레지스트리 밖에서 이 문자열이 라벨로 쓰이면 드리프트다. */
const KNOWN_LABELS = [
  '안정',
  '흔들림',
  '흐릿함',
  '위급',
  '새 단어',
  '신규',
  '확실',
  '익숙',
  '회복',
]

/** 이 파일들은 검사에서 제외한다(레지스트리 자신 · 테스트 · 관리자 콘솔). */
function isExempt(file: string): boolean {
  return (
    file.includes('memory-labels') ||
    file.includes('__tests__') ||
    // admin 은 학습자 화면이 아니다 — 같은 단어를 다른 뜻(도서 상태·VRL 진단)으로 쓴다
    file.includes(`${path.sep}app${path.sep}admin${path.sep}`)
  )
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue
      walk(p, out)
    } else if (/\.tsx?$/.test(e.name) && !isExempt(p)) {
      out.push(p)
    }
  }
  return out
}

describe('기억 4상태 이름 레지스트리', () => {
  it('네 상태가 서로 다른 이름을 갖는다', () => {
    const labels = MEMORY_ORDER.map((s) => MEMORY_LABEL[s].label)
    expect(new Set(labels).size, `중복: ${labels.join(', ')}`).toBe(4)
  })

  it('설명은 사람의 말투 한 줄이다 (빈 값 금지)', () => {
    for (const s of MEMORY_ORDER) {
      expect(MEMORY_LABEL[s].says.length, `${s} 설명 없음`).toBeGreaterThan(0)
      expect(MEMORY_LABEL[s].token, `${s} 색 토큰 없음`).toMatch(/^--memory-/)
    }
  })

  it('학습자 화면이 상태 라벨을 직접 짓지 않는다', () => {
    // `label: '안정'` / `stable: '흔들림'` 형태만 잡는다 — 본문 산문은 건드리지 않는다
    // (설명 문장에 "안정" 이 나오는 것은 이름을 짓는 것이 아니다).
    const pattern = new RegExp(
      `(label|title|name|stable|shaky|risk|new)\\s*:\\s*'(${KNOWN_LABELS.join('|')})'`,
    )
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      const src = fs.readFileSync(file, 'utf8')
      src.split('\n').forEach((line, i) => {
        if (pattern.test(line)) offenders.push(`${path.relative(SRC, file)}:${i + 1}  ${line.trim()}`)
      })
    }
    expect(offenders, `레지스트리를 안 거친 상태 라벨:\n${offenders.join('\n')}`).toEqual([])
  })
})

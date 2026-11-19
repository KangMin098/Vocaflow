// apps/web/src/components/spellforge/__tests__/vault-search.test.tsx
// T-0265 — 놓친 낱말의 「내 단어장에서 이 낱말 찾기」: 본인 확인(viewerId + same)일 때만 · 영어 낱말/구 꼴만 · 기존 ?q= 인코딩 · 펼치기 전 철자 노출 0.
import fs from 'node:fs'
import path from 'node:path'

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/scores/record-score', () => ({ useRecordGameScore: () => {} }))

import { MissedWordRow } from '../SpellForgeCompletion'
import { missedWordSearchHref } from '../vault-search'

const ME = { viewerId: 'u-1', status: 'same' }

describe('missedWordSearchHref', () => {
  it('본인 확인 + 영어 낱말 · 구 → 기존 WordVault 검색(소문자 · 인코딩)', () => {
    expect(missedWordSearchHref('Resilient', ME)).toBe('/wordvault/browse?q=resilient')
    expect(missedWordSearchHref('take  off', ME)).toBe('/wordvault/browse?q=take+off')
    expect(missedWordSearchHref("o'clock", ME)).toBe('/wordvault/browse?q=o%27clock')
  })
  it('본인 미확인(viewerId 없음 · checking · changed)이면 null', () => {
    for (const id of [{ viewerId: undefined, status: 'same' }, { viewerId: null, status: 'same' }, { viewerId: 'u-1', status: 'checking' }, { viewerId: 'u-1', status: 'changed' }]) {
      expect(missedWordSearchHref('resilient', id)).toBeNull()
    }
  })
  it('빈 · 숫자 · 기호 · 비ASCII · 너무 긴 값은 null', () => {
    for (const bad of ['', '  ', '42', 'a1', '<b>', 'café', '-x', 'x-', 'a'.repeat(65), 'a&b']) expect(missedWordSearchHref(bad, ME)).toBeNull()
  })
})

describe('MissedWordRow', () => {
  it('철자를 펼치기 전에는 링크 · URL · 접근성 이름에 철자가 없다', () => {
    const html = renderToString(<ul><MissedWordRow miss={{ word: { id: '1', text: 'resilient', meaning: '회복력 있는' }, kind: 'retried', vaultSearchHref: '/wordvault/browse?q=resilient' }} /></ul>)
    expect(html).not.toContain('sf-miss-vault-search')
    expect(html).not.toContain('resilient')
  })
  it('소스 결속 — 펼친 뒤 · 경로가 있을 때만 · prefetch 없음 · 링크 이름에 철자 없음, 부모는 본인 확인 값으로 만든다', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../SpellForgeCompletion.tsx'), 'utf8')
    expect(src).toMatch(/\{shown && miss\.vaultSearchHref \? \(\n\s*<Link\n\s*href=\{miss\.vaultSearchHref\}\n\s*prefetch=\{false\}/)
    expect(src).toContain('내 단어장에서 이 낱말 찾기')
    const parent = fs.readFileSync(path.resolve(__dirname, '../SpellForge.tsx'), 'utf8')
    expect(parent).toContain('vaultSearchHref: missedWordSearchHref(w.text, { viewerId, status: authStatus }),')
  })
})

// apps/web/src/lib/scriptquiz/__tests__/reader-anchor.test.ts
// T-0209 — 복기 근거 → Reader 문장: 유일한 근거만 번호, 같은 탭 · 같은 글 · 같은 본문만 한 번, Reader 문장 표는 하나에 맞을 때만.
import { describe, expect, it } from 'vitest'

import {
  EVIDENCE_ANCHOR_KEY,
  anchorAfterMoved,
  anchorAfterTake,
  anchorKey,
  visibleReaderAnchor,
  buildEvidenceSentenceMap,
  contentHash,
  evidenceSentenceIndex,
  readerSentenceFor,
  rememberEvidenceAnchor,
  takeEvidenceAnchor,
} from '../reader-anchor'

function memory(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size
    },
  }
}

const PASSAGE = 'The boy walked to the old mill. He found a small key under the stone.\nThen he ran home to tell his sister. He found a small key under the stone.'
const UNIQUE = 'The boy walked to the old mill. He found a small key under the stone. Then he ran home to tell his sister.'
const H = contentHash(UNIQUE)

describe('evidenceSentenceIndex — 유일한 근거만', () => {
  it('유일: 그 문장 번호', () => {
    expect(evidenceSentenceIndex(UNIQUE, 'He found a small key under the stone.')).toBe(1)
  })
  it('중복(같은 문장 두 번) · 여러 문장에 걸침 · 미매칭 · 너무 짧음 · 본문 없음은 null', () => {
    expect(evidenceSentenceIndex(PASSAGE, 'He found a small key under the stone.')).toBeNull()
    expect(evidenceSentenceIndex(UNIQUE, 'walked to the old mill ... ran home to tell his sister')).toBeNull()
    expect(evidenceSentenceIndex(UNIQUE, 'A girl painted a red barn by the river.')).toBeNull()
    expect(evidenceSentenceIndex(UNIQUE, 'the key')).toBeNull()
    expect(evidenceSentenceIndex(undefined, 'He found a small key under the stone.')).toBeNull()
    expect(evidenceSentenceIndex(UNIQUE, '  ')).toBeNull()
  })
})

describe('remember / take — 같은 탭 · 같은 글 · 같은 본문 한 번', () => {
  it('같은 글 · 같은 해시면 번호를 한 번만 돌려준다', () => {
    const s = memory()
    rememberEvidenceAnchor({ textId: 't1', hash: H, sentenceIndex: 1 }, s)
    expect(takeEvidenceAnchor('t1', H, s)).toBe(1)
    expect(takeEvidenceAnchor('t1', H, s)).toBeNull()
  })
  it('다른 글 · 다른 본문(판본)이면 null 이고 지운다', () => {
    const s = memory()
    rememberEvidenceAnchor({ textId: 't1', hash: H, sentenceIndex: 1 }, s)
    expect(takeEvidenceAnchor('t2', H, s)).toBeNull()
    expect(s.getItem(EVIDENCE_ANCHOR_KEY)).toBeNull()
    rememberEvidenceAnchor({ textId: 't1', hash: H, sentenceIndex: 1 }, s)
    expect(takeEvidenceAnchor('t1', contentHash(UNIQUE + ' Extra.'), s)).toBeNull()
  })
  it('저장 값은 글 id · 해시 · 번호뿐(본문 · 문장 없음) · 잘못된 위치는 남기지 않는다', () => {
    const s = memory()
    rememberEvidenceAnchor({ textId: 't1', hash: H, sentenceIndex: 1 }, s)
    expect(JSON.parse(s.getItem(EVIDENCE_ANCHOR_KEY)!)).toEqual({ textId: 't1', hash: H, sentenceIndex: 1 })
    expect(s.getItem(EVIDENCE_ANCHOR_KEY)).not.toContain('key under')
    s.clear()
    rememberEvidenceAnchor({ textId: 't1', hash: H, sentenceIndex: -1 }, s)
    rememberEvidenceAnchor({ textId: 't1', hash: 'nothex', sentenceIndex: 1 }, s)
    rememberEvidenceAnchor({ textId: '', hash: H, sentenceIndex: 1 }, s)
    expect(s.getItem(EVIDENCE_ANCHOR_KEY)).toBeNull()
  })
  it('형식 오류 · 저장소 오류 · 저장소 없음은 null', () => {
    const s = memory()
    s.setItem(EVIDENCE_ANCHOR_KEY, '{bad')
    expect(takeEvidenceAnchor('t1', H, s)).toBeNull()
    const broken = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } }
    expect(() => rememberEvidenceAnchor({ textId: 't1', hash: H, sentenceIndex: 1 }, broken)).not.toThrow()
    expect(takeEvidenceAnchor('t1', H, broken)).toBeNull()
    expect(takeEvidenceAnchor('t1', H, null)).toBeNull()
  })
})

describe('Reader 문장 표 — 하나에 맞을 때만', () => {
  const reader = [
    { id: 0, text: 'The boy walked to the old mill. ' },
    { id: 1, text: 'He found a small key under the stone. ' },
    { id: 2, text: 'Then he ran home to tell his sister.' },
  ]
  it('본문 번호 → Reader id', () => {
    expect(buildEvidenceSentenceMap(UNIQUE, reader)).toEqual([0, 1, 2])
    expect(readerSentenceFor(UNIQUE, 1, reader)).toBe(1)
  })
  it('Reader 가 두 문장을 한 덩어리로 가지면 그 덩어리 id(품음)', () => {
    const merged = [{ id: 7, text: 'The boy walked to the old mill. He found a small key under the stone.' }, { id: 8, text: 'Then he ran home to tell his sister.' }]
    expect(buildEvidenceSentenceMap(UNIQUE, merged)).toEqual([7, 7, 8])
  })
  it('Reader 에 같은 문장이 둘이면 -1 · 없으면 -1 · 범위 밖 번호는 null', () => {
    const dup = [...reader, { id: 3, text: 'He found a small key under the stone.' }]
    expect(buildEvidenceSentenceMap(UNIQUE, dup)[1]).toBe(-1)
    expect(buildEvidenceSentenceMap(UNIQUE, [{ id: 0, text: 'Different text entirely here.' }])).toEqual([-1, -1, -1])
    expect(readerSentenceFor(UNIQUE, 9, reader)).toBeNull()
  })
  it('해시는 같은 본문에 늘 같고 한 글자만 달라도 다르다', () => {
    expect(contentHash(UNIQUE)).toBe(H)
    expect(contentHash(UNIQUE.replace('mill', 'Mill'))).not.toBe(H)
    expect(H).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('Reader 페이지 앵커 상태 — 글 · 본문 해시에 묶임(P2 3차, 경로 전수)', () => {
  const MAP = [0, 1, 2]
  const kA = anchorKey('t1', H)!
  const kA2 = anchorKey('t1', contentHash(UNIQUE + ' Updated.'))!
  const kB = anchorKey('t2', H)!

  it('진입: 같은 문맥 표식 → 그 문장 · 옮기기 전(autoMove true)', () => {
    const st = anchorAfterTake(null, kA, 1, MAP)
    expect(visibleReaderAnchor(st, kA)).toEqual({ anchorSentenceId: 1, anchorAutoMove: true })
  })
  it('옮긴 뒤 · 재마운트(모드 전환 읽기→Spell→읽기): 상태는 페이지에 남아 강조만, 이동 없음', () => {
    let st = anchorAfterTake(null, kA, 1, MAP)
    st = anchorAfterMoved(st, kA)
    // Reader 재마운트 — 페이지 상태 그대로 · 효과가 다시 돌아도 표식은 이미 지워져 taken=null
    st = anchorAfterTake(st, kA, null, MAP)
    expect(visibleReaderAnchor(st, kA)).toEqual({ anchorSentenceId: 1, anchorAutoMove: false })
  })
  it('본문 해시가 바뀌면(router.refresh 새 판본) 강조 · 이동 모두 해제 — 옛 id 를 새 판본에 쓰지 않는다', () => {
    let st = anchorAfterMoved(anchorAfterTake(null, kA, 1, MAP), kA)
    expect(visibleReaderAnchor(st, kA2)).toEqual({ anchorSentenceId: null, anchorAutoMove: false })
    st = anchorAfterTake(st, kA2, null, [5, 6, 7])
    expect(st).toBeNull()
    expect(visibleReaderAnchor(st, kA2).anchorSentenceId).toBeNull()
  })
  it('글이 바뀌면(textId) 해제 · 옛 글의 「옮김」 기록이 새 글에 적용되지 않는다', () => {
    const st = anchorAfterTake(null, kA, 1, MAP)
    expect(visibleReaderAnchor(st, kB).anchorSentenceId).toBeNull()
    expect(anchorAfterMoved(st, kB)).toEqual(st)
    expect(anchorAfterTake(st, kB, null, MAP)).toBeNull()
  })
  it('같은 문맥에서 표식을 새로 꺼내면 새 문장 · 다시 옮기기 전', () => {
    const st = anchorAfterTake(anchorAfterMoved(anchorAfterTake(null, kA, 1, MAP), kA), kA, 2, MAP)
    expect(visibleReaderAnchor(st, kA)).toEqual({ anchorSentenceId: 2, anchorAutoMove: true })
  })
  it('페이지를 떠났다 돌아오기: 새 페이지 상태는 비고 표식은 이미 지워졌다 → 없음(첫머리)', () => {
    const s = memory()
    rememberEvidenceAnchor({ textId: 't1', hash: H, sentenceIndex: 1 }, s)
    const first = anchorAfterTake(null, kA, takeEvidenceAnchor('t1', H, s), MAP)
    expect(visibleReaderAnchor(first, kA).anchorSentenceId).toBe(1)
    const back = anchorAfterTake(null, kA, takeEvidenceAnchor('t1', H, s), MAP)
    expect(back).toBeNull()
  })
  it('번호 표가 -1(하나에 안 맞음) · 범위 밖 · 문맥 없음(해시 없음)이면 없음', () => {
    expect(anchorAfterTake(null, kA, 0, [-1, 1])).toBeNull()
    expect(anchorAfterTake(null, kA, 9, MAP)).toBeNull()
    expect(anchorKey('t1', null)).toBeNull()
    expect(anchorAfterTake(anchorAfterTake(null, kA, 1, MAP), null, 1, MAP)).toBeNull()
    expect(visibleReaderAnchor(anchorAfterTake(null, kA, 1, MAP), null).anchorSentenceId).toBeNull()
  })
})

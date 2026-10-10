// apps/web/src/lib/csat/__tests__/lecture-spoken-ordinal.test.ts
//
// 강의 대본이 **말로** 가리키는 「N번째 문장」도 문장 지도 안이어야 한다(F08 · 2026-10-10).
// `lecture-sentence-range` 는 큐의 sentence:k · focus 만 본다 — 그런데 2026#35 는 골격이 2문장으로 뭉개져 있는데
// 대본은 「여섯 번째 문장」을 말했다. 귀는 여섯째를 듣고 눈에는 막대 둘뿐이다. 전량 측정: 14문항(2026-10-10 이 가드 기준).
//
// 원인은 대본이 아니라 골격이었다(대본은 실제 지문 문장 수를 맞게 말한다): splitSentences 가 「… . ① As …」 의
// 동그라미 번호 문장을 앞 문장에 붙였다. 2026-10-11 분할기 수정 · 평가원 골격 재빌드 · 강의 대상 이동
// (`scripts/csat-learner/remap-lecture-circled-split.mts`)으로 13문항이 고쳐졌고, 남은 1건(2026#23 「우열 문장」)은
// 이 가드의 오탐이었다(앞에 한글이 붙은 「열」 을 개수로 읽음 → 정규식 고침). 원장은 비었다.
// 원장은 양방향으로 지킨다: 원장 밖 문항이 넘으면 실패, 원장 문항이 더는 넘지 않으면 원장에서 지우라고 실패.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const DIR = path.resolve(__dirname, '..')
const read = (sub: string) =>
  fs
    .readdirSync(path.join(DIR, sub))
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, sub, f), 'utf8')))

const ORD: Record<string, number> = {
  첫: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10,
  열한: 11, 열두: 12, 열세: 13, 열네: 14, 열다섯: 15, 열여섯: 16, 열일곱: 17, 열여덟: 18, 열아홉: 19, 스무: 20,
}
// 긴 낱말부터 — 「열한」 을 「열」 로 읽지 않게
const ORD_RE = new RegExp(`(?<![가-힣])(${Object.keys(ORD).sort((a, b) => b.length - a.length).join('|')})\\s*번째\\s*문장`, 'g')
// 「열 문장」 처럼 개수로 말하는 것도 지도 문장 수와 맞아야 한다
// 앞에 한글이 붙은 경우(「우열 문장」 의 열)는 개수가 아니다
const COUNT_RE = new RegExp(`(?<![가-힣])(${Object.keys(ORD).filter((k) => k !== '첫').sort((a, b) => b.length - a.length).join('|')})\\s+문장`, 'g')
const COUNT_WORD: Record<string, number> = { ...ORD, 두: 2, 세: 3, 네: 4 }

/** 알려진 예외 — 문항: 사유. 고쳐지면 지운다(2026-10-11 비움) */
const PENDING: Record<string, string> = {}

type Seg = { lang: string; text: string }
type Cue = { id: string; segments?: Seg[] }

function overflow(): Map<string, string[]> {
  const counts = new Map<string, number>()
  for (const d of read('skeleton-data')) for (const it of d.items ?? []) counts.set(it.id, it.sentences.length)
  const bad = new Map<string, string[]>()
  for (const d of read('lecture-data')) {
    for (const lec of Object.values(d.lectures ?? {}) as { item_id: string; cues?: Cue[] }[]) {
      const n = counts.get(lec.item_id)
      if (n == null) continue
      for (const c of lec.cues ?? []) {
        const text = (c.segments ?? []).filter((s) => s.lang.startsWith('ko')).map((s) => s.text).join(' ')
        for (const m of text.matchAll(ORD_RE)) {
          if (ORD[m[1]] > n) bad.set(lec.item_id, [...(bad.get(lec.item_id) ?? []), `${c.id} 「${m[0]}」 > ${n}`])
        }
        for (const m of text.matchAll(COUNT_RE)) {
          if (COUNT_WORD[m[1]] > n) bad.set(lec.item_id, [...(bad.get(lec.item_id) ?? []), `${c.id} 「${m[0]}」 > ${n}`])
        }
      }
    }
  }
  return bad
}

describe('강의 대본이 말하는 문장 번호 ↔ 문장 지도', () => {
  const bad = overflow()

  it('원장 밖 문항은 말로 가리키는 문장 번호가 지도 범위 안이다', () => {
    expect([...bad.entries()].filter(([id]) => !(id in PENDING)).map(([id, xs]) => `${id}: ${xs.join(' · ')}`)).toEqual([])
  })

  it('원장 문항은 아직 넘는다 — 고쳐졌으면 PENDING 에서 지운다', () => {
    expect(Object.keys(PENDING).filter((id) => !bad.has(id))).toEqual([])
  })

  it('14B#26 — 10문장 지도에서 「열 번째」 까지만 말한다(이전 감사의 지목 문항)', () => {
    expect(bad.has('2014B#26')).toBe(false)
  })
})

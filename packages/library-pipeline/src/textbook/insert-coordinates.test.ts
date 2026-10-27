// packages/library-pipeline/src/textbook/insert-coordinates.test.ts
// 해설 후보 번호 → 화면 이음매. 해설은 **실제 생성기**(explainInsertSeam · explainShortInsertSeam)가 만든 것을 쓴다 —
// 같은 규칙을 테스트에 다시 적으면 둘이 함께 틀려도 통과한다.
import { describe, expect, it } from 'vitest'

import { toCsatInsert } from './csat-format'
import { explainInsertSeam, explainShortInsertSeam } from './explain-seam'
import { insertSeamCandidates } from './insert-coordinates'

const S = (n: number) =>
  Array.from({ length: n }, (_, i) => `Sentence number ${i + 1} talks about the river and the long dry summer in town.`)
const INS = 'This is the sentence that was taken out of the passage.'

function generated(remaining: string[], position: number) {
  const it = toCsatInsert(remaining, INS, position)
  const e = it ? explainInsertSeam(it) : explainShortInsertSeam(remaining, INS, position)
  if (!e) throw new Error('generator returned null')
  return e
}
const map = (remaining: string[], position: number, explanation: string, writer = 'insert_seam') =>
  insertSeamCandidates({ remaining, insertSentence: INS, position, explanation, writer })

describe('insertSeamCandidates', () => {
  it('짧은 문항(3·4문장): 번호 = 1..n 이음매', () => {
    for (const n of [3, 4]) {
      for (let pos = 1; pos <= n; pos++) {
        const r = S(n)
        const c = map(r, pos, generated(r, pos).ko)
        expect(c, `n${n} pos${pos}`).not.toBeNull()
        const ans = c!.find((x) => x.correct)!
        expect(ans.seam).toBe(pos)
        expect(ans.label).toBe('①②③④'[pos - 1])
        for (const w of c!.filter((x) => !x.correct)) expect('①②③④'.indexOf(w.label) + 1).toBe(w.seam)
      }
    }
  })

  it('인쇄 후보(7문장): pickSlots 부분집합 — 번호가 화면 순번이 아니라 고른 자리', () => {
    const r = S(7)
    const c = map(r, 6, generated(r, 6).ko)!
    // pickSlots(7, 6) = [1,3,4,6,7] — ⑤(끝자리)는 뒤 문장이 없어 해설에 없다
    expect(c.map((x) => [x.label, x.seam])).toEqual([
      ['①', 1],
      ['②', 3],
      ['③', 4],
      ['④', 6],
    ])
    expect(c.find((x) => x.correct)).toEqual({ label: '④', seam: 6, correct: true })
  })

  it('끝자리 정답(5문장)', () => {
    const r = S(5)
    const c = map(r, 5, generated(r, 5).ko)!
    expect(c.find((x) => x.correct)?.seam).toBe(5)
  })

  it('대응을 증명할 수 없으면 null — 추정 번호를 붙이지 않는다', () => {
    const r = S(7)
    const text = generated(r, 6).ko
    expect(map(r, 6, text, 'batch_llm')).toBeNull() // 다른 writer
    expect(map(r, 6, '')).toBeNull() // 빈 해설
    expect(map(r, 3, text)).toBeNull() // key 와 해설의 정답 번호가 다르다
    expect(map(r, 0, text)).toBeNull() // 첫 문장 앞(인쇄 좌표에 없다)
    expect(map(r, 99, text)).toBeNull() // 범위 밖
    expect(map(S(7).map((s) => s.replace('in town.', 'in the city.')), 6, text)).toBeNull() // 옛 본문/다른 판본 — 이음매 조각 불일치(조각은 문장 끝 · 앞만 본다)
    expect(map(S(12), 3, '정답은 ③ 다.')).toBeNull() // 다섯 넘는 1..n — ①~⑤ 로 부를 수 없다
  })

  it('원문 인용 안의 원문자는 후보로 읽지 않는다', () => {
    const r = S(4)
    r[1] = 'Step ② 는 "x" 와 "y" 사이를 가른다 was printed on the old sign near the bridge.'
    const c = map(r, 3, generated(r, 3).ko)
    expect(c).not.toBeNull()
    expect(c!.every((x) => x.seam >= 1 && x.seam <= 4)).toBe(true)
  })

  it('USGS 실제 문항(8ef1fd9f) — 해설 ①②③④ 가 이음매 1·3·4·6', () => {
    const remaining = [
      'The flooding in the world’s third largest soybean-exporting country caused soybean and soymeal prices to hit six-month highs in mid-January on the Chicago Board of Trade, commodity analysts said.',
      'Argentina’s Rosario Grains Exchange has reported that almost 4 million acres of soybeans in that country were damaged by this recent flooding.',
      'This image shows a portion of that inundation.',
      'As the longest-running satellite system covering the Earth, Landsat is vital to national and international food production.',
      'The Landsat imagery not only helps verify crop damage, as it did in this case, but is also valuable to agencies like the U.S.',
      'Department of Agriculture for formulating reports on crop production, condition, progress, and projecting yields.',
      'Then check out USGS Science Snippets, our snack-sized science series that focuses on the fun, weird, and fascinating stories of USGS science.',
    ]
    const explanation =
      '정답은 ④ 다. 거기 넣으면 "…and projecting yields." → "Hungry for some science, but you don’t have…" → "Then check out USGS Science…" 로 이어진다. ① 는 "…commodity analysts said." 와 "Argentina’s Rosario…" 사이를 가른다; ② 는 "…of that inundation." 와 "As the longest-running…" 사이를 가른다; ③ 는 "…food production." 와 "The Landsat imagery not…" 사이를 가른다.'
    const c = insertSeamCandidates({
      remaining,
      insertSentence: 'Hungry for some science, but you don’t have time for a full-course research plate?',
      position: 6,
      explanation,
      writer: 'insert_seam',
    })
    expect(c?.map((x) => x.seam)).toEqual([1, 3, 4, 6])
    // Codex 반례 — 정답 자리 · 삽입 문장이 현재 입력과 어긋나면 옛 해설을 붙이지 않는다
    const base = { remaining, insertSentence: 'Hungry for some science, but you don’t have time for a full-course research plate?', explanation, writer: 'insert_seam' }
    expect(insertSeamCandidates({ ...base, position: 5 })).toBeNull()
    expect(insertSeamCandidates({ ...base, position: 6, insertSentence: 'A different sentence was placed here instead of the old one.' })).toBeNull()
  })
})

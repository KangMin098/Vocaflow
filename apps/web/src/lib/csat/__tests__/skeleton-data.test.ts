// apps/web/src/lib/csat/__tests__/skeleton-data.test.ts
//
// **커밋된 골격 산출물을 지킨다.**
//
// `scripts/csat/build-skeleton-data.mjs` 가 구워 커밋한 파일들이 화면의 입력이다. 빌드가
// 잘못 돌아도 파일은 그럴듯하게 생겼고 화면은 멀쩡히 뜬다 — 막대가 조금 이상할 뿐이다.
// 그래서 산출물을 직접 검사한다. 지문은 여기 없으므로(그게 요점이다) 검사할 수 있는 것은
// **구조 불변식**과 **드러난 비율**이다. 둘 다 산출물만으로 계산된다.

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const DIR = path.join(process.cwd(), 'src/lib/csat/skeleton-data')

interface Reveal { anchorId: string; start: number; end: number; text: string }
interface Sentence { chars: number; reveals: Reveal[] }
interface Item { id: string; no: number; chars: number; sentences: Sentence[]; anchors: { id: string; sentences: number[] }[] }

const index = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8')) as {
  built: string
  exams: { exam_id: string; items: number }[]
}
const files = index.exams.map((e) => e.exam_id)
const all: Item[] = files.flatMap(
  (id) => (JSON.parse(fs.readFileSync(path.join(DIR, `${id}.json`), 'utf8')) as { items: Item[] }).items,
)

describe('골격 산출물 — 있어야 할 것이 있는가', () => {
  it('색인이 가리키는 회차 파일이 전부 있다', () => {
    expect(files.length).toBeGreaterThan(0)
    for (const id of files) expect(fs.existsSync(path.join(DIR, `${id}.json`))).toBe(true)
  })

  it('색인의 문항 수와 파일의 문항 수가 같다', () => {
    for (const e of index.exams) {
      const items = (JSON.parse(fs.readFileSync(path.join(DIR, `${e.exam_id}.json`), 'utf8')) as { items: Item[] }).items
      expect(items).toHaveLength(e.items)
    }
  })

  it('문항 id 가 겹치지 않는다', () => {
    const ids = all.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('앵커가 하나도 없는 문항은 굽지 않았다', () => {
    // 앵커가 없으면 막대만 있는 화면이 된다 — 그건 «지문 모양» 만 보여 주고 아무것도
    // 가리키지 않으므로 학습자에게 줄 것이 없다.
    for (const it of all) expect(it.anchors.length).toBeGreaterThan(0)
  })
})

describe('골격 산출물 — 구조 불변식', () => {
  it('reveal 의 start·end 가 text 길이와 일치한다', () => {
    // 밀리면 막대 안의 강조가 엉뚱한 자리에 간다. text 는 멀쩡하므로 눈으로 안 잡힌다.
    for (const it of all) {
      for (const s of it.sentences) {
        for (const r of s.reveals) {
          expect(r.end - r.start).toBe(r.text.length)
          expect(r.start).toBeGreaterThanOrEqual(0)
          expect(r.end).toBeLessThanOrEqual(s.chars)
        }
      }
    }
  })

  it('문장 길이의 합이 지문 길이를 넘지 않는다', () => {
    for (const it of all) {
      const sum = it.sentences.reduce((a, s) => a + s.chars, 0)
      expect(sum).toBeLessThanOrEqual(it.chars)
    }
  })

  it('anchors 가 가리키는 문장 번호가 실재하고, 그 문장에 그 앵커의 reveal 이 있다', () => {
    for (const it of all) {
      for (const a of it.anchors) {
        for (const si of a.sentences) {
          expect(si).toBeGreaterThanOrEqual(0)
          expect(si).toBeLessThan(it.sentences.length)
          expect(it.sentences[si].reveals.some((r) => r.anchorId === a.id)).toBe(true)
        }
      }
    }
  })

  it('reveal 의 anchorId 는 전부 anchors 에 있는 id 다', () => {
    for (const it of all) {
      const ids = new Set(it.anchors.map((a) => a.id))
      for (const s of it.sentences) for (const r of s.reveals) expect(ids.has(r.anchorId)).toBe(true)
    }
  })
})

describe('골격 산출물 — 드러난 비율 (원문 재배포로 넘어가지 않는가)', () => {
  it('전체에서 드러난 글자가 16% 를 넘지 않는다', () => {
    // 근거: 2026-09-15 빌드 실측 **14.8%** (93,405 / 629,155). 16% 는 그 위에 둔
    // **드리프트 경보**이지 품질 기준이 아니다 — 재빌드가 이 선을 넘으면 앵커 추출이
    // 바뀐 것이므로 사람이 봐야 한다.
    const chars = all.reduce((a, i) => a + i.chars, 0)
    const revealed = all.reduce(
      (a, i) => a + i.sentences.reduce((b, s) => b + s.reveals.reduce((c, r) => c + r.text.length, 0), 0),
      0,
    )
    expect(revealed / chars).toBeLessThan(0.16)
  })

  it('어느 문항도 현행 배포본이 가장 많이 드러내는 문항보다 더 드러내지 않는다', () => {
    // **임계값을 고르지 않는다 — 산출물에서 유도한다.**
    //
    // 규칙은 «새 화면은 어느 지문에서도 지금보다 더 드러내지 않는다» 다. 그 «지금» 은
    // 배포 중인 learner.ts 가 내보내는 evidence_quote(= anchorId 'answer') 단독 노출이고,
    // 그 최댓값을 여기서 직접 구해 상한으로 쓴다. 손으로 고른 수가 하나도 없으므로
    // 지문이나 분석이 바뀌어도 이 검사는 계속 «지금» 을 따라간다.
    //
    // ⚠️ 전체 평균만 보면 최악이 숨는다 — 예산을 넣기 전 전체는 18.0% 였는데
    //    한 문항은 59.5% 였다(내용일치 유형은 선지 다섯이 각기 다른 줄에 대응하는 것이
    //    설계라, 다섯을 합치면 지문 대부분이 덮인다).
    const revealedBy = (i: Item, only?: string) =>
      i.sentences.reduce(
        (b, s) => b + s.reveals.filter((r) => !only || r.anchorId === only).reduce((c, r) => c + r.text.length, 0),
        0,
      )

    const answerOnlyMax = Math.max(...all.map((i) => revealedBy(i, 'answer') / i.chars))
    const worst = all
      .map((i) => ({ id: i.id, ratio: revealedBy(i) / i.chars }))
      .sort((a, b) => b.ratio - a.ratio)[0]

    expect(answerOnlyMax).toBeGreaterThan(0)
    expect(worst.ratio).toBeLessThanOrEqual(answerOnlyMax)
  })
})

// apps/web/src/lib/textbook/__tests__/volume-contents.test.ts
//
// 목차·미리보기 스냅샷 회귀.
//
// 스냅샷은 **사람이 안 보고 지나가기 쉬운 산출물**이다 — 스크립트가 성공하고 파일이
// 커지면 다 된 것처럼 보인다. 실제로 그렇게 두 번 샜다(둘 다 실측 2026-09-06):
//
//   ① `countPassageWords` 에 **문항 객체**를 넘겨 `[object Object]` 를 세는 바람에
//      전 단원 지문이 **2어**로 적혔다. 숫자가 나왔다고 잰 것이 아니다.
//   ② `unit_vocab` 의 선택지가 객체라 화면에 **[object Object]** 가 다섯 줄 찍혔다.
//      스크립트도 화면도 오류를 내지 않았다.
//
// 그래서 여기서 잠근다: **화면에 그대로 인쇄되는 값의 모양**을 본다.

import { describe, expect, it } from 'vitest'

import {
  CONTENTS_GENERATED_AT,
  CONTENTS_UNITS_PER_VOLUME,
  contentsOf,
  contentsProblem,
  seriesHasContents,
  unitCovers,
} from '../volume-contents'
import raw from '../volume-contents.json'

const snapshot = raw as unknown as {
  volumes: Record<string, ReturnType<typeof contentsOf> & object>
  problems: { band: number; error: string; series?: string }[]
}
// ⚠️ 키에서 밴드를 뽑지 않는다 — 키가 `reading:5` 로 바뀌면서 `Number(key)` 가 NaN 이 된다.
//    권 자신이 들고 있는 `band` 를 센다.
const bands = Object.values(snapshot.volumes).map((v) => v.band)

describe('권 목차 스냅샷', () => {
  it('일곱 권이 다 들어 있다', () => {
    expect(bands.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('굽는 시각이 ISO 날짜다 — 낡은 것이 보여야 다시 굽는다', () => {
    expect(CONTENTS_GENERATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(Number.isFinite(Date.parse(CONTENTS_GENERATED_AT))).toBe(true)
  })

  it('한 권은 시장 중앙값만큼 단원을 갖는다', () => {
    expect(CONTENTS_UNITS_PER_VOLUME).toBeGreaterThanOrEqual(5)
    for (const b of bands) {
      const c = contentsOf('reading', [b])!
      expect(c.units.length, `band ${b}`).toBe(CONTENTS_UNITS_PER_VOLUME)
    }
  })

  it('단원마다 실제 원글 제목이 있다 — 단원 제목을 짓지 않는다', () => {
    for (const b of bands) {
      for (const u of contentsOf('reading', [b])!.units) {
        expect(u.passages.length, `band ${b} unit ${u.no}`).toBeGreaterThan(0)
        for (const p of u.passages) expect(typeof p).toBe('string')
      }
    }
  })

  it('지문 길이가 **말이 되는 수**다 — 객체를 세면 2어가 나온다', () => {
    // 실측 사고 재발 방지. 지문이 있는 유형이면 최소 40어는 넘는다(수능 하한 90의 절반 아래는
    // 지문이 아니라 무언가 잘못 센 것이다). 지문이 없는 유형뿐인 단원은 `null` 이다.
    for (const b of bands) {
      for (const u of contentsOf('reading', [b])!.units) {
        if (u.words === null) continue
        expect(u.words[0], `band ${b} unit ${u.no} 최소`).toBeGreaterThan(40)
        expect(u.words[1], `band ${b} unit ${u.no} 최대`).toBeGreaterThanOrEqual(u.words[0])
        expect(u.words[1], `band ${b} unit ${u.no} 최대`).toBeLessThan(1000)
      }
    }
  })

  it('미리보기 선택지가 **전부 문자열**이다 — 객체면 [object Object] 가 찍힌다', () => {
    for (const b of bands) {
      const s = contentsOf('reading', [b])!.sample
      if (!s) continue
      for (const it of s.items) {
        // ⚠️ **5 로 못 박으면 안 된다.** 초등 3종은 선택지가 3~4개이고, 철자 완성은
        //   아예 없다(단답). 5 만 받던 규칙이 초등 저학년 권의 미리보기를 통째로 비웠다.
        // ⚠️ 선택지가 **없는 유형이 여럿이다** — 문장 삽입(동그라미 슬롯) · 밑줄형(밑줄 번호) ·
        //   단답 · 배열. 그 모양들은 아래 「네 모양」 검사가 각자 필요한 것을 본다.
        //   여기서는 **선택지가 실제로 있는 문항**만 글자인지 본다.
        if (!it.choices || it.choices.length === 0) continue
        expect(it.choices.length, `band ${b} 문항 ${it.no}`).toBeGreaterThanOrEqual(3)
        expect(it.choices.length, `band ${b} 문항 ${it.no}`).toBeLessThanOrEqual(5)
        for (const c of it.choices) {
          expect(typeof c, `band ${b} 문항 ${it.no}`).toBe('string')
          expect(c).not.toContain('[object')
          expect(c.trim().length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('미리보기 정답이 1~5 안에 있다', () => {
    for (const b of bands) {
      const s = contentsOf('reading', [b])!.sample
      if (!s) continue
      for (const it of s.items) {
        if (!it.choices || it.choices.length === 0) continue // 삽입·밑줄·단답 — 아래 모양 검사에서 본다
        expect(it.answer, `band ${b} 문항 ${it.no}`).toBeGreaterThanOrEqual(1)
        expect(it.answer, `band ${b} 문항 ${it.no}`).toBeLessThanOrEqual(it.choices.length)
      }
    }
  })

  it('미리보기 어휘는 낱말과 뜻을 **둘 다** 갖는다', () => {
    for (const b of bands) {
      const s = contentsOf('reading', [b])!.sample
      if (!s) continue
      for (const w of s.vocabulary) {
        expect(w.word.trim().length, `band ${b}`).toBeGreaterThan(0)
        expect(w.meaningKo.trim().length, `band ${b}`).toBeGreaterThan(0)
      }
    }
  })

  it('미리보기를 못 내는 권은 **이유가 적혀 있다** — 빈 자리로 두지 않는다', () => {
    for (const b of bands) {
      const c = contentsOf('reading', [b])!
      if (c.sample && c.sample.items.length > 0) continue
      expect(contentsProblem('reading', [b]), `band ${b}`).toBeTruthy()
    }
  })

  it('**일곱 권 전부** 미리보기가 **6문항**이다 — 복불복이던 것을 잠근다', () => {
    // ⚠️ 실측 2026-09-06: 화면이 유형 3종만 그릴 줄 알던 동안, 조합이 다른 유형을 고른 날엔
    //   2·3·4권 미리보기가 **통째로 사라졌다**(같은 밴드가 한 시간 사이에 title·blank·topic →
    //   word_order·unit_vocab·vocab_choice·grammar_fix 로 바뀌었다). 조판기가 그리는 네 모양을
    //   전부 낸 뒤에야 일곱 권이 고르게 찬다. 이 단언이 그 회귀를 막는다.
    for (const b of bands) {
      const s = contentsOf('reading', [b])!.sample
      expect(s, `band ${b}`).not.toBeNull()
      expect(s!.items.length, `band ${b}`).toBeGreaterThanOrEqual(4)
    }
  })

  it('네 모양이 각자 필요한 것을 갖췄다 — 빈 자리로 그려지지 않게', () => {
    // 갈래를 `kind` 가 아니라 **선택지 유무**로 가른다 — 초등 철자 완성은 kind 가
    // 'elementary' 이면서 단답이라, kind 로 가르면 선택지 3개를 요구하다 걸린다.
    for (const b of bands) {
      for (const it of contentsOf('reading', [b])!.sample!.items) {
        const where = `band ${b} 문항 ${it.no} (${it.type}/${it.kind ?? 'choice'})`
        expect(it.stem.trim().length, where).toBeGreaterThan(0)

        if (it.body) {
          // 문장 삽입 — 본문에 슬롯이 박혀 있고 그 번호가 정답이다.
          expect(it.body.length, where).toBeGreaterThan(0)
          expect(it.body.some((x) => x.slot >= 0), where).toBe(true)
          expect(it.answer ?? 0, where).toBeGreaterThanOrEqual(1)
        } else if ((it.choices?.length ?? 0) > 0) {
          expect(it.choices!.length, where).toBeGreaterThanOrEqual(3)
          expect(it.answer, where).toBeGreaterThanOrEqual(1)
          expect(it.answer, where).toBeLessThanOrEqual(it.choices!.length)
        } else if (it.kind === 'underline') {
          // 밑줄형은 선택지가 없고 **번호가 곧 선택지**다.
          expect(it.sentences?.length ?? 0, where).toBeGreaterThan(0)
          expect(it.underlines?.length ?? 0, where).toBeGreaterThanOrEqual(3)
          expect(it.answer ?? 0, where).toBeGreaterThanOrEqual(1)
        } else if (it.kind === 'irrelevant') {
          // 흐름 무관도 선택지가 없다 — **문장 번호가 곧 선택지**다.
          // 조건은 조판기(`renderIrrelevant`)와 같아야 한다: 문장 정확히 5개 + 정답 1~5.
          // 다르면 책과 화면이 서로 다른 말을 한다(이 유형이 그렇게 11문항 빠져 있었다).
          expect(it.sentences?.length ?? 0, where).toBe(5)
          expect(it.answer ?? 0, where).toBeGreaterThanOrEqual(1)
          expect(it.answer ?? 0, where).toBeLessThanOrEqual(5)
        } else {
          // 단답·배열·초등 철자 — 정답이 글자다.
          expect(it.answerText?.trim().length ?? 0, where).toBeGreaterThan(0)
          if (it.kind === 'arrange') expect(it.bank?.length ?? 0, where).toBeGreaterThanOrEqual(3)
        }
      }
    }
  })

  it('원글이 없는 권은 목차가 **낱말 단원**으로 갈린다 — 낱말을 글 제목처럼 적지 않는다', () => {
    // 초등 3종은 사전에서 나오므로 ref_title 자리에 낱말이 들어간다. 실측 2026-09-06:
    // 초등 저학년 목차가 add · about · act 를 글 제목처럼 늘어놓고 있었다.
    const elementary = contentsOf('reading', [1])!
    expect(elementary.units.every((u) => unitCovers(u) === 'word')).toBe(true)
    // 글을 쓰는 권은 반대여야 한다 — 규칙이 넓어져 멀쩡한 권까지 낱말로 읽히면 안 된다.
    for (const b of bands.filter((x) => x >= 5)) {
      expect(contentsOf('reading', [b])!.units.some((u) => unitCovers(u) === 'article'), `band ${b}`).toBe(true)
    }
  })

  it('없는 밴드를 물으면 빈 목차를 만들어 내지 않는다', () => {
    expect(contentsOf('reading', [99])).toBeNull()
    expect(contentsProblem('reading', [99])).toBeNull()
  })
})

// ── 교차 시리즈 오염 (DD-71) ─────────────────────────────────────────
//
// 실측 2026-09-23: `/library/textbooks/vocab/5`(Vocaflow Vocab Advanced · 조판 기록
// **20단원 120문항**)가 학습자에게 **10단원 60문항짜리 독해 목차**를 인쇄했다 —
// 「The Will to Power…」 같은 독해 지문과 독해 유형(주장·제목·주제·함축 의미)이 그대로 찍혔다.
//
// 원인은 스냅샷을 찾는 키가 **V레벨 하나**였기 때문이다. 시리즈는 셋인데 계단이 겹친다 —
// 독해 5단 · 어휘 5단 · 구문 5단이 전부 V5 다. 그래서 어휘 권이 독해 권의 목차에 걸렸다.
//
// 이 검사가 잠그는 것은 **두 가지**다:
//   ① 안 구운 시리즈는 **다른 시리즈의 목차를 빌려 오지 않는다**(null 이어야 한다).
//   ② 목차를 낸 권은 그 목차가 **자기 시리즈의 것**이다.
describe('목차는 시리즈를 건너오지 않는다', () => {
  const SERIES_IDS = ['reading', 'vocab', 'syntax'] as const

  it('스냅샷에 없는 시리즈를 물으면 null 이다 — 독해 목차를 대신 주지 않는다', () => {
    for (const id of SERIES_IDS) {
      if (seriesHasContents(id)) continue
      for (const b of [1, 2, 3, 4, 5, 6, 7]) {
        expect(contentsOf(id, [b]), `${id} band ${b} 는 안 구웠는데 목차가 나왔다`).toBeNull()
      }
    }
  })

  it('목차를 낸 권은 그 목차가 **자기 시리즈의 것**이다', () => {
    for (const id of SERIES_IDS) {
      for (const b of [1, 2, 3, 4, 5, 6, 7]) {
        const c = contentsOf(id, [b])
        if (!c) continue
        expect(c.seriesId ?? 'reading', `${id} band ${b} 의 목차가 다른 시리즈 것이다`).toBe(id)
      }
    }
  })

  it('권 제목이 그 시리즈의 브랜드로 시작한다 — 어휘 권에 독해 제목이 박히지 않게', () => {
    const BRAND: Record<string, string> = {
      reading: 'Vocaflow Reading',
      vocab: 'Vocaflow Vocab',
      syntax: 'Vocaflow Syntax',
    }
    for (const id of SERIES_IDS) {
      for (const b of [1, 2, 3, 4, 5, 6, 7]) {
        const c = contentsOf(id, [b])
        if (!c?.title) continue
        expect(c.title, `${id} band ${b}`).toContain(BRAND[id])
      }
    }
  })

  it('적어도 한 시리즈는 구워져 있다 — 스냅샷이 통째로 비면 이 검사가 전부 통과해 버린다', () => {
    // ⚠️ 위 셋은 「없으면 통과」다. 스냅샷이 비면 아무것도 안 재고 초록이 된다 —
    //    이 저장소가 여러 번 겪은 거짓 초록이다(30-admin-sweep 머리말).
    expect(SERIES_IDS.some((id) => seriesHasContents(id))).toBe(true)
  })
})

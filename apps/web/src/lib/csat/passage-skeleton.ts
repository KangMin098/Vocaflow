// apps/web/src/lib/csat/passage-skeleton.ts
//
// **지문을 복제하지 않고 지문을 화면에 세우는 자.**
//
// ── 왜 이런 것이 필요한가 ─────────────────────────────────────────────
// 해설만 있는 화면은 "무엇에 대한 해설인지" 를 학습자가 머릿속에 들고 있어야 한다.
// 그런데 지문은 평가원 저작물이라 실을 수 없다(`csat_items_public` 이 `passage` 를 뺀 이유).
// 그래서 지금 화면은 산문 네 덩어리를 세로로 쌓는 것 말고 할 수 있는 게 없었다.
//
// 빠져나갈 구멍은 하나다 — **글자를 안 보내고 «모양» 만 보낸다.**
//   · 문장마다 **길이(문자 수)** 만 내보낸다 → 화면은 길이 비례 막대를 그린다.
//     지문이 몇 문장인지, 어디가 길고 어디가 짧은지, 논지가 어디서 꺾이는지가 **보인다.**
//   · 분석이 근거로 든 **인용문만** 글자로 내보낸다. 그건 이미 나가고 있는 것이고
//     (`learner.ts` 의 `evidence_quote`), 우리 저작물인 해설의 일부다.
//
// 그 결과 학습자는 **업로드 0 · 로그인 0** 으로 "근거가 지문의 어디에 있는지" 를 본다.
// (설계 판정 §A-N2 «즉시 증명» — 증명이 업로드 뒤에 있으면 없는 것과 같다.)
// 문제지 PDF 를 가진 학습자는 같은 상호작용을 `/csat/overlay` 에서 자기 종이 위로 이어간다.
//
// ── 앵커는 인용문이지 문장 번호가 아니다 (실측 2026-09-15) ──────────────
// `answer_locus.sentence_index` 는 **쓰지 않는다.** 1-기반으로 봐도 일치율 **65.0%** 라
// 3문항 중 1문항이 틀린 문장을 칠한다. 규약이 저장소 어디에도 없는, 분석가가 자기 방식으로
// 센 값이다. 인용문은 `body_ok=true` **589/589 (100%)** 로 지문에서 찾히므로
// **문장 번호는 인용 위치에서 역산한다.** (`scripts/csat/anchor-inventory.mjs`)
//
// ⚠️ **server-only 를 들이지 않는다** — 화면(클라이언트)이 같은 타입을 읽는다.
//    지문을 읽는 것은 부르는 쪽(서버)의 책임이고, 이 모듈은 **지문을 받아 모양만 돌려준다.**

import { findQuote } from './quote-match'

/** 문장 안에서 실제로 글자가 드러나는 구간 — **문장 내 상대 오프셋**. */
export interface Reveal {
  /** 어느 앵커가 열었는가. `'answer'` · `'reject:2'` 처럼 부르는 쪽이 정한 id. */
  anchorId: string
  /** 문장 시작 기준 오프셋. */
  start: number
  end: number
  /** 드러나는 글자 — **인용문 안**이다. 이 필드 말고 원문이 나가는 길은 없다. */
  text: string
}

/** 막대 하나 = 문장 하나. **글자는 없다.** */
export interface SkeletonSentence {
  /** 문장 길이(문자 수). 화면은 이걸로 막대 폭을 정한다. */
  chars: number
  /** 이 문장에서 드러나는 조각들. 비어 있으면 막대만 보인다. */
  reveals: Reveal[]
}

export interface PassageSkeleton {
  /** 지문 전체 길이 — 막대 비율의 분모. */
  chars: number
  sentences: SkeletonSentence[]
}

/**
 * 칠해진 자리가 **무엇을 가리키는가.**
 *
 * 오답 칩 하나에 지문 자리가 붙는 길은 둘인데 **같은 것을 뜻하지 않는다.**
 *   · `reject` — 「지우는 근거」에서 왔다. 그 자리가 이 선지를 **버린다.**
 *   · `tempt`  — 「끌리는 이유」에서 왔다. 그 자리가 이 선지로 **끌어당긴다.**
 *
 * 둘을 같은 말로 칠하면 조용한 거짓말이 된다 — 학습자는 «여기가 이걸 지우는 근거구나» 로
 * 읽는데 실제로는 함정의 미끼 자리다. 그래서 출처를 데이터에 싣고 화면이 다르게 말한다.
 */
export type AnchorOrigin = 'answer' | 'reject' | 'tempt'

/** 앵커 하나 — "이 인용문이 근거다". */
export interface AnchorSpec {
  id: string
  quote: string
  /** 없으면 예전 골격이다 — 읽는 쪽이 `answer`/`reject` 로 메운다. */
  from?: AnchorOrigin
}

/** 앵커가 지문의 어디에 붙었는가. 못 붙으면 `sentences` 가 빈 배열이다. */
export interface AnchorPlacement {
  id: string
  /** 걸친 문장 번호들(0-기반). **우리가 센 번호다** — 분석의 sentence_index 와 무관. */
  sentences: number[]
  from?: AnchorOrigin
}

/**
 * 영어 지문을 문장으로 나눈다. **결정적이어야 한다** — 같은 지문은 언제나 같은 분할이 된다.
 *
 * 약어(Mr. · e.g. · U.S.)에서 끊기는 것을 막는다. 완벽한 분할기를 만드는 것이 목적이 아니라,
 * **막대의 개수와 길이가 안정적인 것**이 목적이다. 분할이 한 번 어긋나도 인용 위치로
 * 역산하므로 강조는 여전히 맞는 자리에 간다 — 막대 경계만 조금 달라진다.
 */
const ABBREV = /(?:\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|e\.g|i\.e|U\.S|U\.K|No|Fig|approx)\.)$/i

export function splitSentences(passage: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  if (!passage) return out

  let start = 0
  for (let i = 0; i < passage.length; i += 1) {
    const ch = passage[i]
    if (ch !== '.' && ch !== '!' && ch !== '?') continue

    // 닫는 따옴표·괄호는 종결부호에 붙어 다닌다.
    let j = i + 1
    while (j < passage.length && /["'’”)\]]/.test(passage[j])) j += 1

    // 뒤에 공백이 없으면 문장 끝이 아니다(소수점 · 약어 내부).
    if (j < passage.length && !/\s/.test(passage[j])) continue

    if (ABBREV.test(passage.slice(start, j))) continue

    // 다음 글자가 대문자/따옴표/괄호여야 새 문장이다.
    let k = j
    while (k < passage.length && /\s/.test(passage[k])) k += 1
    if (k < passage.length && !/[A-Z“"('‘[]/.test(passage[k])) continue

    out.push({ start, end: j })
    start = k
    i = k - 1
  }
  if (start < passage.length) out.push({ start, end: passage.length })
  return out.filter((s) => passage.slice(s.start, s.end).trim().length > 0)
}

/**
 * 지문 + 앵커 → **글자 없는 골격**.
 *
 * 돌려주는 것에 원문이 들어가는 자리는 `Reveal.text` **하나뿐**이고, 그 값은 앵커로 받은
 * 인용문 안이다. 회귀 `passage-skeleton.test.ts` 가 이 불변식을 지킨다 — 이 모듈에서
 * 가장 중요한 것은 기능이 아니라 그 경계다.
 *
 * 앵커가 여러 문장에 걸치면 문장마다 잘라 담는다. 못 찾은 앵커는 **조용히 버리지 않고**
 * `placements` 에 빈 `sentences` 로 남는다 — 부르는 쪽이 "근거를 못 찾았다" 를 말할 수 있어야 한다.
 */
export function buildSkeleton(
  passage: string,
  anchors: AnchorSpec[],
): { skeleton: PassageSkeleton; placements: AnchorPlacement[] } {
  const bounds = splitSentences(passage)
  const sentences: SkeletonSentence[] = bounds.map((b) => ({ chars: b.end - b.start, reveals: [] }))
  const placements: AnchorPlacement[] = []

  for (const a of anchors) {
    const hit = a.quote ? findQuote(passage, a.quote) : null
    if (!hit) {
      placements.push({ id: a.id, sentences: [], from: a.from })
      continue
    }

    const touched: number[] = []
    for (let i = 0; i < bounds.length; i += 1) {
      const b = bounds[i]
      const from = Math.max(hit.start, b.start)
      const to = Math.min(hit.end, b.end)
      if (from >= to) continue
      touched.push(i)
      sentences[i].reveals.push({
        anchorId: a.id,
        start: from - b.start,
        end: to - b.start,
        text: passage.slice(from, to),
      })
    }
    placements.push({ id: a.id, sentences: touched, from: a.from })
  }

  return {
    skeleton: { chars: passage.length, sentences },
    placements,
  }
}

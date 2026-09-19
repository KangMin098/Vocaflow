// apps/web/src/lib/csat/quote-match.ts
//
// **분석이 든 인용문을 원문의 «그 자리» 로 되돌리는 자.**
//
// 이 파일이 있는 이유는 하나다 — 해설이 "이 문장이 근거다" 라고 말할 때, 학습자가 그 문장을
// **눈으로 찾지 않아도 되게** 하려면 문자열이 아니라 **좌표**가 필요하다.
//
// ── 왜 단순 indexOf 가 아닌가 (실측 2026-09-15 · 802문항 전수) ──────────
//   · 그대로 찾기            → 771/802 (96.1%)
//   · 공백만 정규화          → **0건 개선**. 공백은 원인이 아니었다
//   · 굽은따옴표·대시까지    → +20건 → 791/802 (98.6%)
//   · `body_ok = true` 만 보면 **589/589 (100.00%)**
//     남은 8건은 전부 `body_ok = false` — 단 나누기가 깨져 지문 자체가 잘린 문항이라
//     매칭기의 결함이 아니고, 화면이 이미 「격리」로 표시하는 것들이다.
//
// 그러므로 정규화 대상은 **타이포그래피 문자**다. PDF 에서 뽑은 지문과 사람이 쓴 인용문은
// 같은 글자를 다른 코드포인트로 적는다(“ vs " · — vs -). 공백 접기는 PDF 텍스트 레이어에서
// 줄바꿈이 섞여 들어오므로 **그쪽에서** 필요해진다 — 여기 함께 둔다.
//
// ⚠️ **되돌릴 수 있어야 한다.** 정규화는 길이를 바꾸므로(공백 접기) 정규화 문자열에서 찾은
//    위치를 그대로 쓰면 원문의 엉뚱한 자리를 칠한다. 그래서 정규화하면서 **원본 인덱스 지도**를
//    함께 만든다. 이 파일의 진짜 값어치는 그 지도에 있다.
//
// ⚠️ **server-only 를 들이지 않는다.** 이 모듈은 브라우저에서 PDF.js 텍스트 레이어를 훑는
//    쪽이 주 사용자다. 조회·권한이 필요한 것은 부르는 쪽이 한다.

/** 같은 글자를 다르게 적은 것들 — 왼쪽을 오른쪽으로 접는다. */
const FOLD: Record<string, string> = {
  '“': '"', // “
  '”': '"', // ”
  '„': '"',
  '‘': "'", // ‘
  '’': "'", // ’
  '‚': "'",
  '–': '-', // en dash
  '—': '-', // em dash
  '―': '-',
  '−': '-', // minus
  ' ': ' ', // nbsp
  ' ': ' ', // thin space
  '​': '', // zero-width — PDF 추출물에 섞인다
  '﻿': '',
  '­': '', // soft hyphen
  '…': '...', // …
}

/** 정규화 결과 + 원본으로 되돌아가는 지도. */
export interface Normalized {
  /** 접힌 문자열. 검색은 여기서 한다. */
  text: string
  /** `text[i]` 가 온 원본 인덱스. `map.length === text.length + 1` (끝 경계 포함). */
  map: number[]
}

/**
 * 타이포그래피를 접고 연속 공백을 하나로 만든다. **원본 인덱스 지도를 함께 낸다.**
 *
 * 공백 접기는 앞뒤 공백도 없앤다 — PDF 텍스트 조각은 줄 끝마다 공백이 붙어 나온다.
 */
export function normalizeForMatch(src: string): Normalized {
  const out: string[] = []
  const map: number[] = []
  let pendingSpace = false

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]
    const folded = FOLD[ch] ?? ch

    if (folded === '') continue

    if (/\s/.test(folded)) {
      // 앞에 낸 글자가 있을 때만 공백을 예약한다 — 선행 공백은 버린다.
      if (out.length > 0) pendingSpace = true
      continue
    }

    if (pendingSpace) {
      out.push(' ')
      map.push(i)
      pendingSpace = false
    }

    // '…' → '...' 처럼 한 글자가 여럿이 되는 경우, 전부 같은 원본 인덱스를 가리킨다.
    for (const c of folded) {
      out.push(c)
      map.push(i)
    }
  }

  map.push(src.length) // 끝 경계
  return { text: out.join(''), map }
}

/** 원문에서 찾아낸 구간 — **원본 문자열 기준** 인덱스. */
export interface QuoteHit {
  start: number
  end: number
  /** 그대로 찾았는가(정규화 없이). 진단용 — 화면에서 쓰지 않는다. */
  exact: boolean
}

/**
 * `haystack` 안에서 `quote` 의 자리를 찾는다. 못 찾으면 `null`.
 *
 * **못 찾으면 null 이지 0 이 아니다.** 0 을 돌려주면 부르는 쪽이 첫 문장을 근거라고 칠한다 —
 * 틀린 자리를 자신 있게 칠하는 것이 아무것도 안 칠하는 것보다 나쁘다.
 *
 * `from` 을 주면 그 위치(원본 인덱스) 이후만 본다 — 같은 문장이 두 번 나오는 지문에서
 * 두 번째 것을 가리켜야 할 때 쓴다.
 */
export function findQuote(haystack: string, quote: string, from = 0): QuoteHit | null {
  if (!haystack || !quote) return null

  // ① 그대로 — 98% 는 여기서 끝난다. 지도를 만들 필요가 없으니 훨씬 싸다.
  const direct = haystack.indexOf(quote, from)
  if (direct >= 0) return { start: direct, end: direct + quote.length, exact: true }

  // ② 접어서
  const h = normalizeForMatch(haystack)
  const q = normalizeForMatch(quote)
  if (!q.text) return null

  // `from` 도 접힌 좌표로 옮긴다 — map 은 단조증가라 첫 도달점을 찾으면 된다.
  let nFrom = 0
  if (from > 0) {
    while (nFrom < h.text.length && h.map[nFrom] < from) nFrom += 1
  }

  const at = h.text.indexOf(q.text, nFrom)
  if (at < 0) return null

  // ⚠️ 끝은 **다음 글자의 자리가 아니라 마지막 글자의 끝**이다. `map[at + len]` 을 쓰면
  //    접힌 공백을 넘어간 자리를 가리켜 인용 뒤의 공백까지 구간에 들어온다
  //    (실측 2026-09-15: 589편 중 3건이 "...say no. " 처럼 한 칸 더 칠해졌다).
  return { start: h.map[at], end: h.map[at + q.text.length - 1] + 1, exact: false }
}

/**
 * 인용문 여럿을 한 번에 건다. 순서는 입력 순서를 지키고, **못 찾은 것은 `null` 로 자리를 지킨다** —
 * 배열에서 빼 버리면 부르는 쪽이 n번째 인용과 n번째 결과를 잘못 짝짓는다.
 */
export function findQuotes(haystack: string, quotes: string[]): (QuoteHit | null)[] {
  return quotes.map((q) => findQuote(haystack, q))
}

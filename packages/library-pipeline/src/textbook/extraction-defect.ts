// packages/library-pipeline/src/textbook/extraction-defect.ts
//
// **본문이 글이 아닌 것 — 문항을 얹으면 안 되는 지문을 가려낸다.**
//
// ── 왜 규칙이 스크립트에서 패키지로 올라왔나 (2026-09-15) ────────────
// 규칙 여섯은 `scripts/textbook/extraction-defect-scan.mjs` 안에만 있었고, 그 스캔은
// 머리말에 **"고치지 않는다. 어디에 몇 편 있는지만 센다"** 라고 스스로 적어 두었다.
// 세는 것까지는 맞다 — 자동 세척은 위험하다. 그런데 **세기만 하고 아무도 안 쓰는 것**은
// 다른 문제다. 실측 2026-09-15 전수 스캔: ready/published 87,626편 중 **4,876편(5.6%)**
// 이 결함인데, 문항 생성(`item-drain-export.mjs`)은 이 규칙을 **한 번도 부르지 않는다.**
// grep 으로 확인했다 — 소비처는 스캔 자신뿐이었다.
//
// 그래서 결함 지문 위에 문항이 얹힌다. 스캔 머리말이 예고한 그대로다:
// "그대로 두면 **학생이 읽는 지문에 그 문자열이 인쇄된다**."
//
// ── 세척과 배제를 가른다 ────────────────────────────────────────────
// 이 파일은 여전히 **아무것도 고치지 않는다.** 스캔의 신중함은 옳다 — `==` 는 수식에도
// 나오고 문단 중복은 후렴일 수 있다. 고치는 일(`proofread.ts`·`csat-format.ts`)은 조판
// 시점에 좁게 하고, 여기서는 **고르는 시점에 비켜간다.** 결함 지문을 안 쓰는 데는
// 판단이 필요 없다 — 멀쩡한 지문이 밴드마다 수백에서 수천 편 남아 있기 때문이다
// (실측 2026-09-15 · 90~200어 창: V2 1,435 · V3 1,485 · V4 2,378 · V5 2,795 · V6 1,090 · V7 306).
//
// ⚠️ **오탐은 지문 한 편을 잃고, 미탐은 교재에 인쇄된다.** 비대칭이므로 규칙은 좁게
//   유지하되 걸리면 배제한다. 규칙을 짐작으로 늘리지 않는 원칙은 스캔에서 그대로 가져왔다 —
//   여섯 개 하나하나가 실제로 본 것이다.

import { storySeam } from './story-seam'

/** 결함 하나의 정의. `test` 는 결함이면 **근거 문자열**을, 아니면 `null` 을 돌려준다. */
export interface DefectRule {
  id: DefectId
  label: string
  /** 왜 이것이 지문으로 못 쓰는 상태인가. 화면이 그대로 보여 준다. */
  why: string
  test: (body: string) => string | null
}

export type DefectId =
  | 'html-attr'
  | 'wiki-markup'
  | 'browser-notice'
  | 'dup-paragraph'
  | 'dropped-math'
  | 'story-seam'
  | 'share-chrome'

/**
 * 규칙 일곱 — **하나하나가 실제로 본 것**이다. 짐작으로 늘리지 않는다.
 * 늘리면 오탐이 늘고, 오탐이 늘면 이 목록을 아무도 안 본다.
 *
 * ⚠️ 순서가 곧 **보고 순서**다. 첫 걸림에서 멈추므로(`firstDefect`), 인쇄 사고가 큰 것을
 *   앞에 둔다 — HTML 조각이 문장 한복판에 찍히는 쪽이 문단 중복보다 눈에 띈다.
 */
export const DEFECT_RULES: readonly DefectRule[] = [
  {
    id: 'html-attr',
    label: 'HTML 속성 혼입',
    why: '툴팁·링크 속성이 문장 한복판에 남았다 — 그대로 인쇄된다',
    test: (b) => {
      // A complete tag is required: phonetic <p, t, k> and A3 <A1 are not HTML.
      const m = b.match(/[a-z-]+="[^"]{0,40}"\s*&?gt;|&lt;\/?[a-z]+&gt;|<\/?(?:div|span|p|a|img)(?:\s+[^<>\n]{0,200})?\s*\/?>/i)
      return m ? m[0].slice(0, 60) : null
    },
  },
  {
    id: 'wiki-markup',
    label: '위키 마크업 잔재',
    why: '`== 절 ==` · `[[링크]]` · `{{틀}}` 이 본문에 남았다',
    test: (b) => {
      const matches = b.matchAll(/^={2,}[^=\n]{1,60}={2,}\s*$|\[\[[^\]\n]{1,60}\]\]|\{\{[^}\n]{1,60}\}\}/gm)
      for (const m of matches) {
        const inside = m[0].slice(2, -2).trim()
        // Observed bibliography, score rehearsal marks and formal lists are not wiki links.
        if (m[0].startsWith('[[') && (/^[\d\s,–-]+$/.test(inside) || /^[A-Z](?:-[A-Z])?$/.test(inside) || inside.includes(';'))) continue
        return m[0].slice(0, 60)
      }
      return null
    },
  },
  {
    id: 'browser-notice',
    label: '브라우저·재생기 안내',
    why: '본문 자리에 "구형 브라우저" · "여기를 눌러 내려받기" 가 들어왔다 — 추출 실패',
    test: (b) => {
      const m = b.match(
        /You are using an outdated browser|Click here to download this (?:video|file)|enable JavaScript|Your browser does not support/i,
      )
      return m ? m[0].slice(0, 60) : null
    },
  },
  {
    id: 'dup-paragraph',
    label: '문단 통째 중복',
    why: '같은 문단이 두 번 들어 있다 — 어수가 부풀고 읽으면 되풀이된다',
    test: (b) => {
      // 80자 미만 줄은 캡션·머리말일 수 있어 세지 않는다(후렴 오탐).
      const seen = new Set<string>()
      for (const raw of b.split(/\n+/)) {
        const line = raw.trim()
        if (line.length < 80) continue
        const key = line.replace(/\s+/g, ' ')
        if (seen.has(key)) return key.slice(0, 60)
        seen.add(key)
      }
      return null
    },
  },
  {
    id: 'dropped-math',
    label: '수식이 사라진 문장',
    why: '기호만 빠지고 문장은 남았다 — 산문처럼 보이는데 뜻이 안 선다',
    /**
     * PLOS 는 문장 안 기호를 `<img class="inline-graphic">` 로 렌더하고 **alt 를 안 준다**.
     * 태그를 벗기면 기호가 통째로 사라져 "Let ⟨사라짐⟩ be a graph" 가 "Let be a graph" 가 된다.
     * 겉보기엔 산문이라 다른 어떤 규칙도 못 잡는다.
     *
     * ⚠️ 규칙은 판정자들이 실제로 인용한 문장에서 뽑았다 — 짐작이 아니다.
     */
    test: (b) => {
      const pats = [
        /\b(?:of|by|for|with|to|from|than|between)\s+(?:\.(?!\.)|[,;:)])/, // ellipsis is not a missing formula
        /\b(?:Let|Assume|Suppose)\s+(?:be|is|are|denotes?|represents?),?\s/, // 주어가 빠졌다
        /\bwhere\s+(?:is|are|denotes?|represents?)\s+(?!(?:our|your|my|his|her|their)\b)/, // possessive questions have a subject
        /\b(?:denotes?|represents?|equals?)\s+[.,;]/, // 목적어가 빠졌다
      ]
      for (const re of pats) {
        const m = b.match(re)
        if (m) return m[0].slice(0, 60)
      }
      return null
    },
  },
  {
    id: 'story-seam',
    label: '이야기 경계를 넘은 발췌',
    why: '선집을 자른 창이 한 이야기가 끝난 자리를 지났다 — 지문 한 편에 두 이야기가 담긴다',
    /** 규칙과 그 정밀도(실측 77.3%)·한계는 `story-seam.ts` 주석에 있다. */
    test: (b) => storySeam(b),
  },
  {
    id: 'share-chrome',
    label: '공유 버튼·크레딧 잔재',
    why: '"Facebook Pinterest X LinkedIn" · "Image Credit:" 가 본문에 섞였다',
    test: (b) => {
      const m = b.match(
        /Facebook\s+Pinterest\s+X?\s*LinkedIn|Share on (?:Facebook|Twitter|X)\b|\b\d+ min read\b/i,
      )
      return m ? m[0].slice(0, 60) : null
    },
  },
]

/** 걸린 결함 하나 — 무엇에, 어떤 근거로. */
export interface Defect {
  id: DefectId
  label: string
  why: string
  /** 본문에서 실제로 걸린 조각. 없으면 다음 사람이 같은 조사를 처음부터 다시 한다. */
  evidence: string
}

/**
 * **첫 결함에서 멈춘다** — 고르는 쪽은 "쓸 수 있나" 만 알면 되므로 전부 셀 이유가 없다.
 * 65만 행을 훑는 자리라 이 차이가 실제로 시간이 된다.
 */
export function firstDefect(body: string): Defect | null {
  if (!body) return null
  for (const r of DEFECT_RULES) {
    const evidence = r.test(body)
    if (evidence) return { id: r.id, label: r.label, why: r.why, evidence }
  }
  return null
}

/** 문항을 얹어도 되는 지문인가. `firstDefect` 의 뒤집힌 얼굴 — 호출부가 읽기 쉬우라고 둔다. */
export const isUsablePassage = (body: string): boolean => firstDefect(body) === null

/**
 * 전부 센다 — **스캔·리포트 전용**이다. 고르는 경로에서는 `firstDefect` 를 쓴다.
 * 한 편이 여러 결함을 함께 가질 수 있고, 어느 추출기를 고쳐야 하는지는 그때 갈린다.
 */
export function allDefects(body: string): Defect[] {
  if (!body) return []
  const out: Defect[] = []
  for (const r of DEFECT_RULES) {
    const evidence = r.test(body)
    if (evidence) out.push({ id: r.id, label: r.label, why: r.why, evidence })
  }
  return out
}

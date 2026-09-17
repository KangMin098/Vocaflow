// apps/web/src/lib/csat/lecture/speakable.ts
//
// **낭독 전처리 — 브라우저 목소리가 틀리게 읽지 않을 표기로 바꾼다.**
//
// 브라우저 TTS 는 SSML 을 받지 않는다. 그래서 「어떻게 읽히는가」는 **글자로만** 정할 수 있다.
// 숫자·기호·로마자가 한국어 문장에 섞이면 목소리마다 다르게 읽는다 — 「3번째」를 「삼번째」로,
// 「①」을 건너뛰거나 「동그라미 일」로, 「(A)」를 「괄호 에이 괄호」로.
//
// 규칙(전부 여기 한 곳 — 드레인 적재와 검사가 같은 함수를 쓴다):
//   · ①~⑤ → 「일 번」…「오 번」
//   · 2014학년도 → 「이천십사 학년도」 · 23번 → 「이십삼 번」 · 40% → 「사십 퍼센트」
//   · (A) · A/B → 「에이」 · 「에이 비」 (글의 순서 문항의 (A)(B)(C))
//   · 그 밖의 아라비아 숫자 → 한자어 수
//   · 영어 구절은 **한국어 조각에 남기지 않는다** — `en-US` 조각으로 따로 뺀다(쓰는 쪽의 몫, 검사가 잡는다)
//
// ⚠️ 「세 번째 문장」처럼 **고유어 수**가 맞는 자리는 쓰는 쪽이 처음부터 한글로 쓴다.
//    기계 변환은 한자어 수만 안다 — 「3번째」를 받으면 「삼 번째」가 되어 틀린다. 그래서 검사는
//    한국어 조각에 **숫자가 남아 있으면** 막는다(변환 뒤에도 남는 경우는 없지만, 원고에 쓴 사실을 센다).

import type { LectureSegment } from './types'

const DIGIT = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
const SMALL = ['', '십', '백', '천']

/** 한자어 수 읽기 (0 ~ 99,999,999). 10 → 「십」, 100 → 「백」 — 앞의 「일」을 붙이지 않는다. */
export function sinoKorean(n: number): string {
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return String(n)
  if (n === 0) return '영'
  const chunk = (x: number) => {
    let out = ''
    const ds = String(x).padStart(4, '0').split('').map(Number)
    ds.forEach((d, i) => {
      if (!d) return
      const unit = SMALL[3 - i]
      out += (d === 1 && unit ? '' : DIGIT[d]) + unit
    })
    return out
  }
  const man = Math.floor(n / 10000)
  const rest = n % 10000
  return `${man ? `${man === 1 ? '' : chunk(man)}만` : ''}${chunk(rest)}`
}

const CIRCLED: Record<string, number> = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 }
const LETTER: Record<string, string> = { A: '에이', B: '비', C: '씨', D: '디', E: '이' }

/** 한국어 조각 하나를 낭독 표기로 */
export function speakKo(text: string): string {
  let s = text
  // ①번 · ① 번 · ① — 「번」이 겹치지 않게 먼저 먹는다
  s = s.replace(/([①②③④⑤])\s*번/g, (_, c: string) => `${sinoKorean(CIRCLED[c])} 번`)
  s = s.replace(/[①②③④⑤]/g, (c) => `${sinoKorean(CIRCLED[c])} 번`)
  s = s.replace(/(\d+)\s*학년도/g, (_, d: string) => `${sinoKorean(Number(d))} 학년도`)
  s = s.replace(/(\d+)\s*번/g, (_, d: string) => `${sinoKorean(Number(d))} 번`)
  s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, (_, d: string) => `${readNumber(d)} 퍼센트`)
  s = s.replace(/%/g, ' 퍼센트')
  // (A) · [B] · A/B/C — 글의 순서·요약문 문항의 기호
  s = s.replace(/[(\[]([A-E])[)\]]/g, (_, l: string) => LETTER[l])
  s = s.replace(/\b([A-E])(?:\s*\/\s*([A-E]))(?:\s*\/\s*([A-E]))?\b/g, (...m: string[]) =>
    [m[1], m[2], m[3]].filter(Boolean).map((l) => LETTER[l]).join(' '),
  )
  s = s.replace(/(\d+(?:\.\d+)?)/g, (d) => readNumber(d))
  return s.replace(/\s{2,}/g, ' ').trim()
}

function readNumber(d: string): string {
  if (!d.includes('.')) return sinoKorean(Number(d))
  const [a, b] = d.split('.')
  return `${sinoKorean(Number(a))} 점 ${b.split('').map((x) => (x === '0' ? '영' : DIGIT[Number(x)])).join('')}`
}

export function speakSegments(segs: LectureSegment[]): LectureSegment[] {
  return segs.map((g) => (g.lang === 'ko-KR' ? { ...g, text: speakKo(g.text) } : { ...g, text: g.text.trim() }))
}

/** 조각 하나가 낭독 표기 규칙을 어기는가 — 어긴 까닭들을 돌려준다(빈 배열이면 통과) */
export function segmentIssues(g: LectureSegment): string[] {
  const out: string[] = []
  if (!g.text.trim()) out.push('빈 조각')
  if (g.lang === 'ko-KR') {
    if (/[0-9]/.test(g.text)) out.push('한국어 조각에 아라비아 숫자')
    if (/[①-⑳]/.test(g.text)) out.push('한국어 조각에 원문자')
    if (/[A-Za-z]/.test(g.text)) out.push('한국어 조각에 로마자 — en-US 조각으로 빼야 한다')
    if (/%/.test(g.text)) out.push('한국어 조각에 %')
  } else {
    if (/[가-힣]/.test(g.text)) out.push('영어 조각에 한글')
  }
  return out
}

/**
 * **변환 전** 원고에서만 잡히는 실수 — 고유어 수가 맞는 자리에 아라비아 숫자.
 * 「3번째」는 기계 변환이 「삼 번째」로 만들어 틀리게 읽힌다. 변환 뒤에는 흔적이 안 남으므로
 * 적재가 변환 **전에** 이것을 부른다.
 */
export function rawNumeralIssues(text: string): string[] {
  return /[0-9]+[ ]*(번째|개|가지|문장|단락|줄|명|단어|군데|곳)/.test(text)
    ? ['고유어 수 자리에 아라비아 숫자(「세 번째」처럼 한글로 쓴다)']
    : []
}

/** 한국어 문장들로 자른다(낭독 길이·호흡 검사용) */
export function koSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export const syllables = (s: string) => (s.match(/[가-힣]/g) ?? []).length
export const enWords = (s: string) => (s.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length

/**
 * 1.0 배속 기준 추정 초.
 *
 * 계수는 **Gate 0 프로브의 실측**이다(`docs/csat-lecture/tts-probe-report.json` · `calibration`,
 * 2026-09-17). 한국어 초당 음절: Chrome(Google 한국의) 4.70 · Edge(선히 Natural) 3.88.
 * 처음 어림(5.6)은 실측보다 20~44% 빨라 대본을 짧게 셌다. **느린 쪽에 가깝게 4.0** 을 쓴다 —
 * 큐 길이 상한(20초)은 가장 느린 목소리에서도 지켜져야 하기 때문이다.
 * 영어는 2.92 · 2.58 → 2.6.
 */
export const RATE = { koSyllablesPerSec: 4.0, enWordsPerSec: 2.6, sentencePauseSec: 0.3 }

export function estimateSec(segs: LectureSegment[]): number {
  let sec = 0
  for (const g of segs) {
    if (g.lang === 'ko-KR') {
      sec += syllables(g.text) / RATE.koSyllablesPerSec
      sec += koSentences(g.text).length * RATE.sentencePauseSec
    } else {
      sec += enWords(g.text) / RATE.enWordsPerSec + RATE.sentencePauseSec
    }
  }
  return Math.round(sec * 10) / 10
}

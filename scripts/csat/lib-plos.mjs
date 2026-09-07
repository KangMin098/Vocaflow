// scripts/csat/lib-plos.mjs
//
// **PLOS 추출의 판정 표 — 정본.** 추출기(plos-extract)와 재검사기(plos-extract-recheck)가
// 같은 표를 봐야 한다. 두 벌이 되면 조용히 갈라지고, 그때는 "어느 기준으로 들어온 지문인가"
// 를 알 수 없게 된다. 실제로 재검사기가 약어 보호 없이 문장을 나눠 자체 오탐 370건을 냈다.

import { W } from './lib-fit.mjs'

// ── 약어 보호 ───────────────────────────────────────────────────────
//
// ⚠️ **이걸 안 하면 조용히 깨진 영어가 나온다.** 첫 실행 산출물을 눈으로 읽고 발견했다:
//
//     "While cases of animal leishmaniasis caused by L. Since the knowledge of…"
//     "Somboonpoonpol (2016) described the poor development of Thai L."
//
// 문장 분리기가 종명 약어 `L.`(= *Leishmania*) 에서 끊어 **뒷부분이 통째로 사라진** 것이다.
// 그렇게 잘린 조각은 대문자로 시작하고 마침표로 끝나므로 뒤의 관문을 **전부 통과한다** —
// 길이도 어휘도 멀쩡하다. 기계로는 안 보이고 사람이 읽어야만 보인다.
//
// 그래서 자르기 **전에** 약어의 마침표를 치환해 두고, 자른 뒤에 되돌린다.
export const DOT = ''
export const ABBR = [
  /\b([A-Z])\.(?=\s*[A-Za-z])/g, // 속명 약어: L. major · E. coli
  /\b(p|w|e|i|c|v|a|approx|ca|cf|vs|viz|etc|al|Fig|No|Dr|Prof|St|Mr|Mrs|Ms)\.(?=\s|$)/gi,
  /\b(e\.g|i\.e|p\.i|s\.c|i\.p|i\.v|et al)\./gi,
]
export const protectAbbr = (t) => {
  let s = t
  for (const re of ABBR) s = s.replace(re, (m) => m.replace(/\./g, DOT))
  return s
}
export const restoreAbbr = (t) => t.replaceAll(DOT, '.')

// ── 문장 단위 관문 ──────────────────────────────────────────────────
export const CITE_ANY = /\[\s*[\d,\s–—-]*\s*\]|\(\s*[A-Z][A-Za-z'’-]+(?:\s+et\s+al\.?)?,?\s*\d{4}[a-z]?\s*\)/g
/** 지우면 문장이 깨지는 자리의 인용 — 주어 자리, 전치사 뒤, `et al.` + 정동사. */
export const CITE_STRUCTURAL = [
  /(^|[.;]\s*)\[\s*[\d,\s–—-]*\s*\]/, // 문장 첫머리
  /\b(by|in|of|from|to|with|per|see)\s*\[\s*[\d,\s–—-]*\s*\]/i, // 전치사에 붙음
  /\b[A-Z][A-Za-z'’-]+\s+et\s+al\.?\s+(showed|found|reported|argued|demonstrated|noted|suggested|observed)\b/,
]
export const SENT_DROP = [
  { id: 'figref', re: /\b(Fig\.?|Figure|Table|Panel|Supplementary|S\d+ (Fig|Table|File))\b/i },
  { id: 'doi', re: /\b(doi:|https?:\/\/|www\.)/i },
  { id: 'stats', re: /[(\s](p|P)\s*[<=>]\s*0?\.\d|\b(95%\s*CI|SD\s*=|SE\s*=|OR\s*=|β\s*=|χ2|R2\s*=)/ },
  // 저자가 자기 연구를 말하는 문장 — 수능 지문에는 없는 목소리다.
  { id: 'first-person', re: /\b(we|our|us)\b/i },
  { id: 'self-ref', re: /\b(this (study|paper|article|work|research)|the present (study|paper)|the proposed)\b/i },
  // 절 제목이 문장에 눌어붙은 것(줄바꿈이 없어 생긴다).
  { id: 'glued-head', re: /\b(Methods?|Results|Discussion|Conclusions?|Introduction|Background|Limitations|Implications)\s+[A-Z]/ },
  { id: 'gene-chem', re: /\b([A-Z]{2,}\d+|[A-Z][a-z]?\d+[A-Z]|\d+\s*(mg|ml|μl|mM|nM|°C)\b)/ },
  // ⚠️ **1인칭이 없어도 연구 안을 가리키면 자족적이지 않다.** 첫 산출물에서 발견:
  //   "participants who held higher subjective norms…" — 어느 참가자인지 지문 안에 없다.
  //   `we/our` 만 막으면 이런 문장이 통째로 남는다.
  {
    id: 'study-deixis',
    re: /\b(participants?|respondents?|interviewees?|the (survey|sample|cohort|questionnaire|trial|intervention|experiment|dataset))\b/i,
  },
  // 인용에서 저자만 빠지고 연도가 문장 머리에 남은 것: "(2020) used intraperitoneal infection…"
  { id: 'orphan-year', re: /^\s*\(\s*\d{4}[a-z]?\s*\)/ },
  // 속명 약어로 끝나 뒤가 잘려 나간 문장: "…caused by L." — 약어 보호가 놓친 잔여분.
  { id: 'truncated-abbr', re: /\b[A-Z]\.\s*$/ },
  // ⚠️ **문서 내부를 가리키는 말** — 적재한 표본을 다시 읽고 발견했다(2026-09-05).
  //   "This section will introduce the patent value evaluation system…" 이 그대로 들어가 있었다.
  //   설명·논증 기출 549편 대조 오탐 **0.00%**.
  {
    id: 'doc-deixis',
    re: /\b(this|the (above|following|next|preceding|present)) (section|subsection|chapter|paper|article|table|figure|graph|chart|plot|equation|formula|appendix)\b/i,
  },
  { id: 'as-shown', re: /\bas (shown|described|discussed|mentioned|listed|presented) (above|below|earlier|previously|in)\b/i },
  // "The top right graph demonstrates…" — 그림 없이 못 읽는다. 좁힌 형태만 쓴다:
  //   넓은 형태(`plot`·`the scheme`)는 이야기의 '줄거리'를 잡아 오탐 0.55% 가 났다.
  {
    id: 'graphref',
    re: /\b((top|bottom|left|right|upper|lower)\s+(graph|chart|plot|panel|diagram)|(graph|chart|plot|diagram|panel)s?\s+(above|below|shows?|demonstrates?|illustrates?|depicts?))\b/i,
  },
]

// ── 못 잡는 것 (시도했고 실패했다 — 다시 시도하지 말 것) ────────────
//
// **소제목이 문장에 눌어붙는 것**은 기계로 못 가른다.
//   실제 산출물: "…a Māori proto-lexicon People who grow up in New Zealand are exposed…"
//   ( "Previous work on building a Māori proto-lexicon" 이 소제목이다 )
//
// 규칙 `[a-z-]+ [A-Z][a-z]+ (who|which|is|are|was…)` 로 잡으려 했고 기출로 쟀다:
//   · 기출 810지문 전체 — 오탐 **14.80%** (안내문이 원래 제목을 본문에 붙여 쓴다)
//   · 설명·논증 유형 549편만 — 오탐 **7.29%** ("that Australia was" · "Giant Grebe was")
//   둘 다 고유명사를 잡는다. **오탐 0% 가 아니면 안 쓴다**는 기준에 걸려 버렸다.
//
// PLOS 측정 리포트도 같은 결론이다 — 눌어붙은 제목의 **2.7%** 만 기계로 잡힌다.
// 남은 결함으로 기록하고 넘어간다. 이건 안전 결함이 아니라 품질 결함이다.

/**
 * 버린 **이유**를 함께 돌려준다.
 * ⚠️ 사유를 뭉뚱그리면 어디를 고쳐야 할지 모른다 — 첫 실행에서 482건이 한 통에 들어가
 *   "인용이 문장을 깬다" 로 보였는데, 실제로는 대소문자·마침표·길이가 섞여 있었다.
 */
export function cleanSentence(s) {
  for (const re of CITE_STRUCTURAL) if (re.test(s)) return { why: 'cite-struct' }
  // 인용을 지우면 `(e.g., )` 처럼 껍데기만 남는다. 기출 810지문 대조 오탐 0.00%.
  let t = s.replace(CITE_ANY, '').replace(/\(\s*(?:e\.g\.|i\.e\.|cf\.|see)?\s*[,;:]?\s*\)/g, '')
  t = t.replace(/\s+([.,;:])/g, '$1').replace(/\s{2,}/g, ' ').trim()
  if (!/^[A-Z"'“‘(]/.test(t)) return { why: 'no-capital-start' } // 앞이 잘려 나간 문장
  if (!/[.!?]["'’”)]?$/.test(t)) return { why: 'no-end-punct' }
  const w = W(t)
  if (w.length < 8) return { why: 'sent-too-short' }
  if (w.length > 60) return { why: 'sent-too-long' }
  return { text: t }
}


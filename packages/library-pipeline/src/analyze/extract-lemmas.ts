// packages/library-pipeline/src/analyze/extract-lemmas.ts
// LCP v2.0 — book 전체 chapter의 lemma 통합 추출
// WLP processText를 chapter 단위 호출 + 결과 통합

import { processText } from '@vocaflow/wlp'
import type { WlpToken } from '@vocaflow/wlp'
import type { ChapterSegment } from '../types'

export interface LemmaOccurrence {
  chapter_idx: number
  frequency_in_chapter: number
  first_sentence_in_chapter: string
  /** Phase 3 — 이 chapter 문맥의 지배 POS (winkNLP → dict 어휘). sense 매칭용. */
  context_pos: string | null
}

// winkNLP universal POS → shared_dictionary pos 어휘 (Phase 3 문맥 sense 매칭용).
const POS_MAP: Record<string, string> = {
  NOUN: 'noun', VERB: 'verb', ADJ: 'adjective', ADV: 'adverb', ADP: 'preposition',
  PRON: 'pronoun', CCONJ: 'conjunction', SCONJ: 'conjunction', AUX: 'verb',
  DET: 'determiner', INTJ: 'interjection', PART: 'particle', NUM: 'number',
}

export interface BookLemmaIndex {
  /** lemma → 등장 정보 (chapter별로 누적, chapter_idx 오름차순) */
  occurrences: Map<string, LemmaOccurrence[]>
  /** lemma → 책 전체 누적 빈도 */
  bookFrequency: Map<string, number>
}

// Phase 14.7.1 — LCP S4 토큰화 정규식 보정
// 학습 가치 0인 노이즈 토큰을 한 번 더 필터 (winkNLP isStopWord/isPunctuation 보완)
const TOKEN_BLOCKLIST = new Set<string>([
  // 호칭
  'mr', 'mrs', 'ms', 'dr', 'sir', 'madam', 'lord', 'lady',
  // contraction 단편 (apostrophe 시작 토큰은 본 검사 규칙에서도 별도 차단)
  "'s", "'t", "'ll", "'re", "'ve", "'d", "'m",
  // contraction 잔여 (winkNLP가 lemma만 떼어내는 경우)
  'll', 're', 've',
  // 약어 (학습 단어 아님 — 200권 평가 잔여, mr/mrs 와 동류)
  'acct', 'dept', 'depts', 'yrs', 'wks', 'wk', 'cts', 'rms', 'mgr', 'mdse', 'recd', 'shipt',
  'yd', 'yds', 'yr', 'hr', 'hrs', 'mos', 'pts', 'doz', 'rm',
  // 하이픈 중첩복합어 파편 — winkNLP 가 하이픈 분해 시 비단어 조각 발생 (bric-a-brac→brac 등, 다중책 재발)
  'brac', 'shilly', 'shally', 'scarum', 'harum', 'toity', 'hoity', 'tighty', 'jongg',
  'jeebies', 'heebie', 'hotsy', 'totsy', 'turvydom', 'willy', 'nilly', 'namby', 'pamby',
  'wishy', 'washy', 'higgledy', 'piggledy', 'razzle', 'fuddy', 'duddy', 'teeny', 'weeny',
  'itsy', 'bitsy', 'hocus', 'pocus', 'mumbo',
  // infixation/말더듬/줄바꿈 하이픈 단어 꼬리 파편 (abso-blooming-lutely→lutely 등)
  'lutely', 'cisely', 'derful', 'ishness', 'iddity',
])

/**
 * 학습 가치 있는 단어 lemma 인지 판정.
 *
 * 허용: 영문 소문자 + 하이픈/apostrophe 중간 (don't, co-operation OK)
 * 차단:
 *   — 길이 < 2 또는 > 30
 *   — 숫자 포함 (10th, 30,000, 6:30 등)
 *   — 점/콜론 포함 (mr., co., 6:30, u.s.a. 등 약어·시간)
 *   — apostrophe / 하이픈으로 시작 ('s, -ed 등)
 *   — 외래 기호 포함 (café, naïve 등) — Phase 14.8 별도
 *   — TOKEN_BLOCKLIST 적중
 */
function isValidLearningWord(raw: string): boolean {
  const lemma = raw.toLowerCase().trim()
  if (!lemma) return false
  if (lemma.length < 2 || lemma.length > 30) return false
  // 숫자 포함 거부
  if (/\d/.test(lemma)) return false
  // 점/콜론 포함 거부 (약어·시간)
  if (/[.:]/.test(lemma)) return false
  // 영문 + apostrophe + 하이픈만 (외래 기호 거부)
  if (!/^[a-z'-]+$/.test(lemma)) return false
  // 시작/끝이 apostrophe·하이픈이면 거부 ('s, -ed 등)
  if (/^['-]|['-]$/.test(lemma)) return false
  // v06.35 — 로마숫자 장 번호 (CHAPTER XLIX · XXXIX). 고전 전권에서 반복 유입되므로 규칙으로 막는다.
  //   'i'(1인칭) · 'mix'/'dim'/'did' 같은 실단어와 겹치지 않도록 길이 3 이상 + 순수 로마숫자만.
  if (lemma.length >= 3 && /^[ivxlcdm]+$/.test(lemma) && !/^(mix|dim|did|mid|lid|civil)$/.test(lemma)) {
    return false
  }
  if (TOKEN_BLOCKLIST.has(lemma)) return false
  return true
}

// v06.35 — URL 잔해 필터.
//   참고문헌·각주가 많은 교재(opentextbc Introduction to Sociology 등)에서
//   `www.globalissues.org/article/...` 같은 URL 이 '.'/'/' 로 쪼개지며
//   globalissues · religionfor · activitieson · pdf · org 같은 조각이 학습 어휘로 들어왔다.
//   판정: 문장이 URL 을 포함하고, 토큰 좌우에 공백 없이 '.' 또는 '/' 가 붙어 있을 때.
//   (문장 끝 마침표 오탐 방지 — 오른쪽 '.' 만으로는 판정하지 않고 URL 문맥을 함께 요구한다.)
const URL_CONTEXT = /https?:\/\/|www\./i
const URL_GLUE = new Set(['.', '/'])
function isUrlDebris(
  sentenceText: string,
  token: WlpToken,
  prev: WlpToken | undefined,
  next: WlpToken | undefined,
): boolean {
  if (!URL_CONTEXT.test(sentenceText)) return false
  const gluedLeft = !!prev && URL_GLUE.has(prev.surface) && prev.charEnd === token.charStart
  const gluedRight = !!next && URL_GLUE.has(next.surface) && token.charEnd === next.charStart
  return gluedLeft || gluedRight
}

// v06.35 — 이물 문자에 의한 토큰 파열 필터.
//   Standard Ebooks 원본에 남은 OCR 오류가 단어 한가운데에 라틴 확장 문자를 심어 놓으면
//   토크나이저가 그 지점에서 토큰을 쪼개 앞뒤 조각이 학습 단어로 새어 들어온다:
//       "The bɐttle"(U+0250 turned a)   → `ttle`
//       "This is the first tournamenʇ"  → `tournamen`(U+0287 turned t)
//   본문에 `ttle` 이라는 단어는 존재하지 않으므로 결함 04(유령 어휘)로 잡힌다.
//
//   합자(œ·æ)는 정규화 단계에서 펴서 근본 차단했지만(normalizeLigatures), OCR 오식은
//   문자를 특정할 수 없다 — `ɐ`→`a` 같은 매핑은 IPA·음성학 텍스트에서 오히려 파괴적이다.
//   그래서 문자를 고치는 대신 **파열의 형태**를 본다: 단어 문자도 문장부호도 아닌
//   한 글자짜리 토큰이 공백 없이 붙어 있으면, 그 옆 토큰은 온전한 단어일 수 없다.
//
//   손실 위험: 정상 텍스트에서 이 패턴은 나타나지 않는다 (아포스트로피·하이픈은 아래
//   FRAGMENT_SAFE 로 제외하고, smart quote 는 normalizePunctuation 이 이미 ASCII 로 접는다).
const FRAGMENT_SAFE = /^[a-zA-Z0-9\s.,;:!?'"()[\]{}<>@#$%&*+/\\|`~^=_—–-]$/
function isForeignCharSplit(
  token: WlpToken,
  prev: WlpToken | undefined,
  next: WlpToken | undefined,
): boolean {
  const glued = (t: WlpToken | undefined, atEnd: boolean): boolean => {
    if (!t || t.surface.length !== 1 || FRAGMENT_SAFE.test(t.surface)) return false
    return atEnd ? t.charEnd === token.charStart : token.charEnd === t.charStart
  }
  return glued(prev, true) || glued(next, false)
}

// v06.35 — 음절 하이픈 표기 파편 필터.
//   Ozma of Oz 의 Tiktok 로봇은 음절을 끊어 말한다: "lit-tle", "rev-o-lu-tion",
//   "per-fect", "in-vent-or". winkNLP 는 이런 표기를 **쪼갠다**:
//       lit-tle       → lit[word] -[punct] tle[word]
//       rev-o-lu-tion → rev - o - lu - tion
//   그래서 `tle` · `jur` · `peo` · `ture` · `cean` 같은 조각이 학습 어휘로 들어갔다
//   (316권 감사에서 104권 236건 — 음절 표기가 많은 아동서에 집중).
//
//   반면 정상 복합어는 winkNLP 가 **하나로 유지**한다: `co-operation`[word].
//   그러니 "하이픈이 공백 없이 붙어 있는 토큰" 이 곧 음절 파편이다 — 복합어를 다치지 않는다.
//
//   keepLemmaOnlyIfInText 가 이걸 못 잡는 이유: 그 검사는 **표제어**가 본문에 있는지를
//   보는데, 파편은 표면형 자체가 조각이라 lemma == surface 로 통과한다.
const isHyphen = (s: string): boolean => s === '-' || s === '‐' || s === '‑'
function isSyllableHyphenFragment(
  token: WlpToken,
  prev: WlpToken | undefined,
  next: WlpToken | undefined,
): boolean {
  const gluedBefore = !!prev && prev.isPunctuation && isHyphen(prev.surface) && prev.charEnd === token.charStart
  const gluedAfter = !!next && next.isPunctuation && isHyphen(next.surface) && token.charEnd === next.charStart
  return gluedBefore || gluedAfter
}

// Phase 14.8 — 아포스트로피 생략 방언 파편 필터 (근본 규칙, 열거 blocklist 대체)
//   작가가 방언 생략을 아포스트로피로 표기 (foun'=found · hadn'=hadn't · doin'=doing ·
//   wukkin'=working) → winkNLP 가 아포스트로피를 별도 punctuation 으로 떼어내 어간만 남김.
//   판정: word 토큰 바로 뒤(공백 없이)에 홑 아포스트로피 punctuation 이 붙고,
//         표면형이 's' 로 끝나지 않을 때 = 방언 생략 (학습 단어 아님).
//   안전: 소유격은 winkNLP 가 's/'t 를 PART 로 결합해 홑 아포스트로피가 아님 (cat's).
//         복수 소유격(dogs')·(ladies')은 's' 로 끝나 제외. → 실단어 손실 0.
const APOSTROPHES = new Set(["'", '’', 'ʼ'])
function isApostropheElision(token: WlpToken, next: WlpToken | undefined): boolean {
  if (!next || !next.isPunctuation) return false
  if (!APOSTROPHES.has(next.surface)) return false
  if (token.charEnd !== next.charStart) return false // 공백 없이 붙음 (glued)
  if (/s$/i.test(token.surface)) return false // 복수 소유격 가드 (dogs' · ladies')
  return true
}

// v06.35 — winkNLP 의 무가드 `-men → -man` 폴백 되돌리기.
//   wink-eng-lite-web-model 의 lemmatizeNoun 은 마지막 return 이
//       return value.replace(/men$/, "man")
//   인데, **이것만 `cache.hasSamePOS(lemma,"NOUN")` 가드가 없다.** 그래서 NOUN 으로 태깅된
//   -men 토큰 중 사전에 없는 것이 전부 존재하지 않는 -man 형태로 바뀐다:
//       crimen→criman · becomen→becoman · swimmen→swimman · marshalmen→marshalman
//       hymen→hyman  ← 실단어까지 파괴 (hymen 은 사전 direct 표제어)
//   76권 감사에서 유령 어휘 13건 중 4건이 이 경로였다.
//
// 왜 "차단" 이 아니라 "표면형 복원" 인가 (실측 13:1):
//   표면형을 그대로 넘기면 DB 15티어 해소 체인이 winkNLP 보다 낫다 —
//       becomen→become(spelling) · swimmen→swim(spelling) · crimen→crimen(coverage-clean)
//       policemen→policeman(cluster) · gentlemen→gentleman · fishermen→fisherman
//       marshalmen→not_found (정직한 미수록)
//   정상 복수(-men)도 손실이 없으므로 변환 자체를 되돌리는 편이 안전하다.
//   유일한 예외는 seamen→seam(굴절 티어 오답) 인데, 그건 en_inflection_bases 에
//   `men$→man` 후보를 더해 DB 쪽에서 고친다(같은 마일스톤 마이그레이션).
function unmangleMenPlural(surfaceRaw: string, lemma: string): string {
  const surface = surfaceRaw.toLowerCase()
  if (!surface.endsWith('men')) return lemma
  return lemma === `${surface.slice(0, -3)}man` ? surface : lemma
}

// v06.35 — 본문에 없는 표제어는 표면형으로 되돌린다 (유령 어휘 구조적 차단).
//
//   winkNLP 의 무가드 폴백은 -men→-man 하나가 아니다. 136권 감사에서 동사 쪽에서도 나왔다:
//       "Captain Blood had outmaneuvered him" → lemma `outmaneuvere`
//   사전에 `outmaneuver` 가 없으니 어미만 떼고 멈춘, 존재하지 않는 형태다. 규칙을 하나씩
//   뒤쫓는 대신 **결과를 검사한다** — 이 챕터 본문에 그 형태가 한 번도 안 나왔다면
//   학습 단위로 부적절하다. 결함 04(유령 어휘)는 정의상 "본문에 없는 말"이므로
//   이 판정이 그 클래스를 통째로 닫는다.
//
//   정상 표제어가 본문에 없는 경우(ran→run · policemen→policeman 단수 부재)에도
//   표면형으로 되돌아가지만 손실이 없다 — DB 15티어가 표면형에서 더 나은 표제어를
//   찾는다는 걸 17단어 실측에서 13:1 로 확인했다 (위 unmangleMenPlural 주석).
//
//   surface 자체는 본문에서 왔으므로 항상 존재한다. 즉 되돌린 값은 언제나 실재한다.
function keepLemmaOnlyIfInText(
  surfaceRaw: string,
  lemma: string,
  chapterTokens: ReadonlySet<string>,
): string {
  if (lemma === surfaceRaw.toLowerCase()) return lemma
  return chapterTokens.has(lemma) ? lemma : surfaceRaw.toLowerCase()
}

/** 챕터 본문의 소문자 단어 집합 — 표제어 실재 검사용 (isValidLearningWord 와 같은 문자 범위). */
function chapterTokenSet(content: string): Set<string> {
  return new Set(content.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [])
}

/**
 * 책 전체 chapter의 lemma 추출 + 통합.
 *
 * WLP processText는 chapter 단위로 호출 (winkNLP는 paragraph 이상 단위가 효율적).
 * stopword와 punctuation은 자동 필터링됨 (WLP 기본 옵션).
 */
export function extractBookLemmas(chapters: ChapterSegment[]): BookLemmaIndex {
  const occurrences = new Map<string, LemmaOccurrence[]>()
  const bookFrequency = new Map<string, number>()

  for (const ch of chapters) {
    const result = processText(ch.content)
    // 표제어 실재 검사용 — 챕터당 1회만 만든다
    const chapterTokens = chapterTokenSet(ch.content)

    // chapter 내 lemma별 빈도 + 첫 등장 sentence index 집계
    const chapterCounts = new Map<
      string,
      { count: number; firstSentenceIdx: number; posCounts: Map<string, number> }
    >()

    for (const sentence of result.sentences) {
      const toks = sentence.tokens
      for (let ti = 0; ti < toks.length; ti++) {
        const token = toks[ti]
        // 인덱스 접근은 타입상 undefined 가능(noUncheckedIndexedAccess) — 루프 범위상
        // 실제로는 항상 존재하지만, 가드가 없으면 패키지 typecheck 가 통째로 실패한다.
        if (!token) continue
        // stopword/punct는 통계에서 제외 (WLP 기본 옵션과 동일 정책)
        if (token.isStopWord || token.isPunctuation) continue
        // R3 (CLAUDE.md v06.29) — 고유명사 (PROPN) 차단
        //   캐릭터명·지명 (Elizabeth/Darcy/Jim/London/Hispaniola) 학습 vocab 에서 제외.
        //   winkNLP universal POS tag 기준 — 측정상 6권 noise 4~12% 모두 PROPN 패턴.
        if (token.pos === 'PROPN') continue
        // v06.35 — winkNLP 무가드 폴백 되돌리기 (아래 두 헬퍼 주석)
        //   ① -men→-man 특정 규칙  ② 본문에 없는 표제어 일반 차단
        const lemma = keepLemmaOnlyIfInText(
          token.surface,
          unmangleMenPlural(token.surface, token.lemma),
          chapterTokens,
        )
        // Phase 14.7.1 노이즈 필터 (숫자/약어/외래기호/호칭/contraction)
        if (!isValidLearningWord(lemma)) continue
        // Phase 14.8 — 아포스트로피 생략 방언 파편 (foun'·hadn'·doin'·wukkin')
        if (isApostropheElision(token, toks[ti + 1])) continue
        // v06.35 — 참고문헌 URL 잔해 (globalissues·religionfor·pdf·org)
        if (isUrlDebris(sentence.text, token, toks[ti - 1], toks[ti + 1])) continue
        // v06.35 — OCR 이물 문자에 의한 토큰 파열 (bɐttle→ttle · tournamenʇ→tournamen)
        if (isForeignCharSplit(token, toks[ti - 1], toks[ti + 1])) continue
        // v06.35 — 음절 하이픈 표기 파편 (lit-tle→tle · rev-o-lu-tion→jur/tion)
        if (isSyllableHyphenFragment(token, toks[ti - 1], toks[ti + 1])) continue

        const mapped = POS_MAP[token.pos] ?? null
        const existing = chapterCounts.get(lemma)
        if (existing) {
          existing.count += 1
          if (mapped) existing.posCounts.set(mapped, (existing.posCounts.get(mapped) ?? 0) + 1)
        } else {
          const posCounts = new Map<string, number>()
          if (mapped) posCounts.set(mapped, 1)
          chapterCounts.set(lemma, {
            count: 1,
            firstSentenceIdx: token.sentenceIndex,
            posCounts,
          })
        }
      }
    }

    // chapter별 결과를 book index에 병합
    for (const [lemma, info] of chapterCounts) {
      // 책 전체 빈도 누적
      bookFrequency.set(lemma, (bookFrequency.get(lemma) ?? 0) + info.count)

      // chapter별 등장 기록
      const firstSentence =
        result.sentences[info.firstSentenceIdx]?.text.trim().slice(0, 300) ?? ''

      // Phase 3 — chapter 지배 POS (최다 등장 POS)
      let context_pos: string | null = null
      let maxPos = 0
      for (const [p, n] of info.posCounts) if (n > maxPos) { maxPos = n; context_pos = p }

      const list = occurrences.get(lemma) ?? []
      list.push({
        chapter_idx: ch.chapter_idx,
        frequency_in_chapter: info.count,
        first_sentence_in_chapter: firstSentence,
        context_pos,
      })
      occurrences.set(lemma, list)
    }
  }

  // chapter_idx 오름차순 정렬 (computeLearningValue가 첫 등장 chapter 사용)
  for (const list of occurrences.values()) {
    list.sort((a, b) => a.chapter_idx - b.chapter_idx)
  }

  return { occurrences, bookFrequency }
}

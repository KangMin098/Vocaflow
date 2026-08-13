// apps/web/src/lib/text-extract/tokenize.ts
//
// 영문 텍스트 → 단어 토큰 추출 (client-side).
// /text/new 입력 → extract_vocabulary_for_user_v2 RPC 호출용.
//
// ── 설계 원칙 ──
// 표제어 해석(굴절/파생 → headword)은 **서버 `resolve_dict_headword` 4계층**이 담당한다.
// 따라서 이 모듈의 유일한 책임은 "원문에 실제로 있던 단어를, 있던 그대로, 하나도 빠뜨리지 않고,
// 없던 것은 만들지 않고" 표면형으로 넘기는 것이다. 여기서 만든 쓰레기는 서버가 걸러주지 못하고,
// 여기서 흘린 단어는 서버가 되살리지 못한다.
//
// ── v06.35 이전 구현이 실측으로 흘리던 것 (probe 결과) ──
//   1. 축약형 파편: `[^a-z\s']` 치환 + `split("'")[0]` 조합이 "didn't"→"didn", "couldn't"→"couldn"
//      같은 **비단어**를 대량 생성. 구어 스크립트 한 편에서 8~11개.
//   2. 그중 일부는 **실재 단어와 충돌**: "won't"→"won", "don't"→"don". 사전에 존재하므로
//      전 단계 필터를 통과해 **원문에 없던 단어를 학습자에게 가르친다** (최악의 오추출).
//   3. 숫자 결합 토큰이 알파벳 앞부분만 남김: "CO2"→"co", "Cas9"→"cas".
//   4. `sort().slice(0, 1000)` — **알파벳 순 절단**. unique 1200 입력 시 w·x·y·z 로 시작하는
//      단어가 통째로 소실. 장문일수록 뒷글자가 조용히 사라진다.
//   5. 아포스트로피 종류(U+0027 vs U+2019)에 따라 결과가 달라짐 — 재현성 없음.
//   6. 비ASCII 자모: "Jørgensen"→"j"+"rgensen" 파편.
//
// 아래 구현은 위 6종을 모두 닫고, 무엇을 어떻게 처리했는지 `diagnostics` 로 되돌려
// 화면에서 검증 가능하게 만든다 (누수는 숨기지 않는다).

/** 후보 상한 — 47분 대담(≈7,000어, unique ≈1,800)도 여유로 수용. 초과분은 diagnostics.truncated 로 노출. */
const MAX_UNIQUE = 5000

/** stopwords — 추출 가치 거의 없음 (가장 빈번한 기능어). 서버 v_threshold 가 어차피 거르므로 payload 절약 목적. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can',
  'may', 'might', 'must', 'shall', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with',
  'from', 'as', 'into', 'about', 'over', 'under', 'this', 'that', 'these', 'those',
  'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
  'it', 'its', 'they', 'them', 'their', 'who', 'whom', 'what', 'which', 'where', 'when',
  'why', 'how', 'so', 'if', 'then', 'than', 'just', 'not', 'no', 'yes',
])

/**
 * 불규칙 축약형 — 일반 규칙(`n't` 절단, clitic 절단)으로 복원하면 틀리는 것들만.
 * "won't"→"wo", "can't"→"ca" 가 되는 것을 막는다.
 */
const IRREGULAR_CONTRACTIONS: Record<string, string[]> = {
  "won't": ['will'],
  "can't": ['can'],
  "shan't": ['shall'],
  "ain't": ['be'],
  "let's": ['let'],
  "y'all": ['you', 'all'],
  // 아포스트로피가 어휘의 일부인 단어 — 분해하지 않고 통째로 사전에 묻는다.
  "o'clock": ["o'clock"],
  "ma'am": ["ma'am"],
}

/** clitic 접미사 — 앞부분만 남긴다. "we're"→"we", "humanity's"→"humanity" */
const CLITIC_RE = /^(.+?)'(s|re|ve|ll|d|m)$/

/** NFD 분해로 처리되지 않는 자모 — 명시적 ASCII 대응 */
const LETTER_FOLD: Record<string, string> = {
  ø: 'o', Ø: 'o', æ: 'ae', Æ: 'ae', œ: 'oe', Œ: 'oe',
  ß: 'ss', đ: 'd', Đ: 'd', ð: 'd', Ð: 'd', ł: 'l', Ł: 'l',
  þ: 'th', Þ: 'th', ı: 'i',
}

const PLAIN_WORD = /^[a-z]{2,}$/
const HYPHEN_WORD = /^[a-z]+(?:-[a-z]+)+$/
const APOSTROPHE_WORD = /^[a-z]+'[a-z]+$/

/** 무엇을 어떻게 처리했는지 — 화면에서 추출 신뢰를 검증할 수 있게 되돌린다. */
export interface TokenizationDiagnostics {
  /** 축약형을 올바른 어간으로 복원한 횟수 ("didn't"→"did") */
  contractionsResolved: number
  /** 하이픈 복합어 — 부분 + 전체를 모두 후보로 올린 횟수 */
  hyphenCompounds: number
  /** 숫자가 섞인 토큰을 통째로 제외한 횟수 ("co2", "173,000") */
  numericDropped: number
  /** 비ASCII 자모를 ASCII 로 접은 횟수 ("Jørgensen"→"jorgensen") */
  diacriticsFolded: number
  /** `[Laughter]` 류 대괄호 마커 제거 횟수 */
  bracketMarkers: number
  /** 줄머리 화자 라벨("Speaker Name:") 제거 횟수 */
  speakerLabels: number
  /** stopword 로 제외된 unique 수 */
  stopwordsRemoved: number
  /** 상한 초과로 잘려나간 unique 수 — 0 이 아니면 누수다 */
  truncated: number
}

export interface TokenizationResult {
  /** 추출된 unique words — **원문 등장 순서** (알파벳 정렬 금지: 절단 시 편향을 만든다) */
  words: string[]
  /** 본문의 running word 수 (단어를 1개 이상 만들어낸 표면 토큰 수) */
  totalWords: number
  /** unique 수 (dedupe 후, stopword 제외 전) */
  uniqueRaw: number
  /** stopword 제거 + 상한 적용 후 최종 unique 수 */
  uniqueFinal: number
  /** 처리 내역 */
  diagnostics: TokenizationDiagnostics
}

function emptyDiagnostics(): TokenizationDiagnostics {
  return {
    contractionsResolved: 0,
    hyphenCompounds: 0,
    numericDropped: 0,
    diacriticsFolded: 0,
    bracketMarkers: 0,
    speakerLabels: 0,
    stopwordsRemoved: 0,
    truncated: 0,
  }
}

/**
 * 전처리 — 유니코드 정규화 + 스크립트 관습(대괄호 마커·화자 라벨) 제거.
 * 이 단계의 목적은 "같은 글이면 어디서 복사해 붙여넣어도 같은 결과" 를 보장하는 것.
 */
function preprocess(text: string, d: TokenizationDiagnostics): string {
  let s = text.normalize('NFKC')

  // 보이지 않는 문자 — soft hyphen·zero-width. 남기면 단어를 조용히 쪼갠다.
  s = s.replace(/[­​‌‍﻿]/g, '')

  // 아포스트로피 변종 → ASCII. (U+2019 이 웹 복사 붙여넣기의 기본형이다)
  s = s.replace(/[‘’ʼʹ′´]/g, "'")

  // 하이픈 변종 → ASCII 하이픈 (복합어를 잇는 문자)
  s = s.replace(/[‐‑⁃]/g, '-')

  // 대시 변종 → 공백 (복합어를 잇지 않는 **구두점**이다. 하이픈과 구분해야 한다)
  s = s.replace(/[‒–—―−]/g, ' ')

  // 공백으로 둘러싸인 하이픈도 구두점 — "AI - and what to do"
  s = s.replace(/\s-+\s/g, ' ')

  // `[Laughter]` `[Applause]` 류 전사 마커
  s = s.replace(/\[[^\]\n]{1,40}\]/g, () => {
    d.bracketMarkers += 1
    return ' '
  })

  // 줄머리 화자 라벨 — "Chris Anderson: " / "CA: ". 대담·2인 강연 스크립트의 표준 형식.
  //   **의도적으로 보수적이다.** 여기서 과하게 지우면 평범한 문장의 앞부분이 통째로
  //   사라진다("There is one lesson here: ..." 전체가 라벨로 오인됐던 실패 사례).
  //   그래서 ① 제목형 2~4단어(모든 단어가 대문자 시작) 또는 ② 대문자 이니셜 2~6자 만 인정한다.
  //   덜 지우는 쪽이 안전하다 — 남은 인명은 서버가 word_register='proper_noun' 으로 거른다.
  s = s.replace(
    /^[ \t]*(?:\p{Lu}{2,6}|\p{Lu}[\p{Ll}.'\-]+(?:[ ]\p{Lu}[\p{Ll}.'\-]+){1,3}):[ \t]+/gmu,
    () => {
      d.speakerLabels += 1
      return ' '
    },
  )

  // 발음기호 접기 — 명시 대응표 먼저, 그다음 NFD 결합문자 제거
  s = s.replace(/[øØæÆœŒßđĐðÐłŁþÞı]/g, (ch) => {
    d.diacriticsFolded += 1
    return LETTER_FOLD[ch] ?? ch
  })
  const beforeNfd = s
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (s !== beforeNfd) d.diacriticsFolded += 1

  return s.toLowerCase()
}

/**
 * 축약형 분해. 반환값이 null 이면 아포스트로피가 없는 토큰.
 * 핵심: "didn't"→["did"] 이지 ["didn"] 이 아니다.
 */
function resolveContraction(tok: string, d: TokenizationDiagnostics): string[] | null {
  if (!tok.includes("'")) return null

  const irregular = IRREGULAR_CONTRACTIONS[tok]
  if (irregular) {
    d.contractionsResolved += 1
    return irregular
  }

  // n't → 어간 ("wasn't"→"was", "couldn't"→"could", "don't"→"do")
  if (tok.endsWith("n't")) {
    const base = tok.slice(0, -3)
    if (PLAIN_WORD.test(base)) {
      d.contractionsResolved += 1
      return [base]
    }
    return []
  }

  // clitic ('s / 're / 've / 'll / 'd / 'm) → 앞부분
  const clitic = CLITIC_RE.exec(tok)
  if (clitic) {
    const base = clitic[1]!
    if (PLAIN_WORD.test(base)) {
      d.contractionsResolved += 1
      return [base]
    }
    if (HYPHEN_WORD.test(base)) {
      d.contractionsResolved += 1
      return [base]
    }
    return []
  }

  // 어휘 내부 아포스트로피 (o'clock 류 · 외래 인명) — 전체형을 후보로 올리고 부분도 함께
  const out: string[] = []
  if (APOSTROPHE_WORD.test(tok)) out.push(tok)
  for (const part of tok.split("'")) {
    if (PLAIN_WORD.test(part)) out.push(part)
  }
  return out
}

/** 하이픈 복합어 — 부분들 + 전체형 모두 후보. 사전에 전체형이 있으면 그쪽이 매칭된다. */
function expandHyphen(word: string, d: TokenizationDiagnostics): string[] {
  if (!word.includes('-')) return [word]
  const parts = word.split('-').filter((p) => PLAIN_WORD.test(p))
  if (parts.length === 0) return []
  const out = [...parts]
  if (HYPHEN_WORD.test(word) && parts.length >= 2) out.push(word)
  d.hyphenCompounds += 1
  return out
}

/**
 * 영문 텍스트 토큰화 — extract_vocabulary_for_user_v2 RPC 입력용.
 *
 * 반환 `words` 는 **원문 등장 순서**를 유지한다. 상한에 걸려 잘리더라도
 * 알파벳 뒷글자만 통째로 사라지는 편향이 생기지 않도록 하기 위함이다.
 */
export function tokenizeText(text: string): TokenizationResult {
  const diagnostics = emptyDiagnostics()

  if (!text || text.trim().length === 0) {
    return { words: [], totalWords: 0, uniqueRaw: 0, uniqueFinal: 0, diagnostics }
  }

  const cleaned = preprocess(text, diagnostics)

  // 단어 구성 문자만 남긴다 — 알파벳 · 숫자 · 아포스트로피 · 하이픈.
  //   숫자를 이 단계에서 지우지 않는 이유: "co2"→"co" 같은 **파편 위조**를 막으려면
  //   숫자가 붙어 있었다는 사실을 토큰 단위로 알아야 하기 때문이다.
  const masked = cleaned.replace(/[^a-z0-9'\-\s]/g, ' ')

  const surfaces = masked.split(/\s+/).filter((t) => t.length > 0)

  const ordered = new Set<string>()
  let totalWords = 0

  for (const surface of surfaces) {
    // 토큰 양끝의 아포스트로피·하이픈은 구두점 — 인용부호, 줄표 잔재
    const tok = surface.replace(/^['\-]+/, '').replace(/['\-]+$/, '')
    if (tok.length === 0) continue

    // 숫자가 섞인 토큰은 통째로 제외 — 알파벳 앞부분만 남기면 없던 단어를 만든다
    if (/[0-9]/.test(tok)) {
      diagnostics.numericDropped += 1
      continue
    }

    const contracted = resolveContraction(tok, diagnostics)
    const bases = contracted ?? [tok]

    let emitted = 0
    for (const base of bases) {
      for (const w of expandHyphen(base, diagnostics)) {
        if (w.length < 2) continue
        if (!PLAIN_WORD.test(w) && !HYPHEN_WORD.test(w) && !APOSTROPHE_WORD.test(w)) continue
        ordered.add(w)
        emitted += 1
      }
    }
    if (emitted > 0) totalWords += 1
  }

  const uniqueRaw = ordered.size

  const filtered: string[] = []
  for (const w of ordered) {
    if (STOPWORDS.has(w)) {
      diagnostics.stopwordsRemoved += 1
      continue
    }
    filtered.push(w)
  }

  // 상한 — 등장 순서 유지 절단. 잘렸다면 숨기지 않고 보고한다.
  const capped = filtered.slice(0, MAX_UNIQUE)
  diagnostics.truncated = filtered.length - capped.length

  return {
    words: capped,
    totalWords,
    uniqueRaw,
    uniqueFinal: capped.length,
    diagnostics,
  }
}

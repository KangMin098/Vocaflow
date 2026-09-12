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

/**
 * 결합형 접두사 — **단독으로는 단어가 아니다.**
 *
 * `expandHyphen` 이 하이픈 조각을 전부 후보로 올리는 바람에 `pre-industrial` 이
 * `pre`·`industrial`·`pre-industrial` 셋을 냈다. `pre` 는 사전에 없으므로
 *   ① 학습자 추출 화면에 "pre" 가 배울 단어로 뜨고
 *   ② 해석 실패라서 `pending_words` 에 **사전 갭으로 오적재**된다
 * 실측(2026-08-15 · 발행 콘텐츠 31편): `non` 8편 · `pre` 6편 · `mid` 4편에서 발생.
 *
 * 자유 형태소로도 쓰이는 것(`self`·`over`·`under`·`out`·`up`·`off`·`well`·`long`·`half`)은
 * **넣지 않는다** — 그 자체로 학습할 가치가 있는 단어이고 사전에도 있다.
 */
const BOUND_PREFIXES = new Set([
  'anti', 'auto', 'bi', 'bio', 'co', 'counter', 'cross', 'cyber', 'de', 'eco', 'ex',
  'extra', 'geo', 'hyper', 'inter', 'intra', 'macro', 'meta', 'micro', 'mid', 'mini',
  'multi', 'nano', 'neo', 'non', 'post', 'pre', 'pro', 'pseudo', 're', 'semi', 'socio',
  'sub', 'super', 'tele', 'trans', 'tri', 'ultra', 'un', 'uni', 'vice',
])

/**
 * 어휘가 아닌 관습 표기 — 인용·약어·로마숫자·도메인.
 *
 * 학술 원문에서 그대로 흘러나온다: `et al.`→`al`(8편) · `plos`·`org`·`articlereuse`(3편) ·
 * `vs`·`adj`·`ii`. 전부 "배울 단어" 가 아니고, 사전에 없으니 갭 백로그까지 오염시킨다.
 * 로마숫자는 **열거하고** 정규식으로 잡지 않는다 — `[ivxlcdm]+` 는 `mix`·`civil` 을 삼킨다.
 */
const NON_LEXICAL = new Set([
  // 인용 관습
  'al', 'et', 'ibid', 'op', 'cit', 'pp', 'eds', 'ed', 'vol', 'fig', 'figs', 'tbl', 'doi',
  // 약어
  'vs', 'adj', 'adv', 'abbr', 'approx', 'etc', 'ie', 'eg', 'cf', 'min', 'max', 'avg', 'std',
  // 웹·도메인 조각
  'http', 'https', 'www', 'com', 'org', 'net', 'edu', 'gov', 'html', 'pdf', 'url', 'doi',
  // 로마숫자 (ii 이상만 — 'i' 는 기능어로 이미 제외된다)
  'ii', 'iii', 'iv', 'vi', 'vii', 'viii', 'ix', 'xi', 'xii', 'xiii', 'xiv', 'xv',
  'xvi', 'xvii', 'xviii', 'xix', 'xx',
])

/** 무엇을 어떻게 처리했는지 — 화면에서 추출 신뢰를 검증할 수 있게 되돌린다. */
export interface TokenizationDiagnostics {
  /** 축약형을 올바른 어간으로 복원한 횟수 ("didn't"→"did") */
  contractionsResolved: number
  /** 하이픈 복합어 — 부분 + 전체를 모두 후보로 올린 횟수 */
  hyphenCompounds: number
  /** 결합형 접두사라서 단독 후보에서 뺀 횟수 ("pre-industrial"의 `pre`) */
  boundAffixesDropped: number
  /** 어휘가 아닌 관습 표기(인용·약어·로마숫자·도메인)로 제외한 횟수 */
  nonLexicalDropped: number
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
  /**
   * 표면형별 등장 횟수 — `words` 와 **같은 집합, 같은 순서**.
   *
   * 학습자 추출은 "이 글에 이 단어가 있다" 만 알면 되지만, 주제 코퍼스(TCP)는 빈도가 있어야
   * 배경 대비 두드러짐을 계산할 수 있다. 그렇다고 토크나이저를 두 벌로 두면 **학습자가 보는
   * 추출과 사전에 쌓이는 통계가 서로 다른 규칙으로 갈라진다** — 축약형·하이픈·접두사 판정이
   * 한쪽에서만 고쳐지는 순간 두 숫자는 영원히 안 맞는다. 그래서 같은 통과에서 함께 센다.
   */
  counts: Record<string, number>
  /**
   * 고유명사 후보 — **문장 중간에서 대문자로만 나타난** 단어.
   *
   * 왜 필요한가 (실측 2026-08-16): 코퍼스 수확이 만든 사전 갭 9,879건을 표본 200건으로
   * 분류하니 **약 60%가 인명·지명·기관명**이었다. 기존 필터가 있는데도 못 걸렀다 —
   * `noise_blacklist` 24,347건이 잡아낸 게 709건뿐이다.
   *
   * 원인은 이 모듈이 전처리에서 **모두 소문자로 내려 버린** 것이었다. 문장 중간의 대문자는
   * 영어에서 고유명사를 가리키는 가장 강한 신호인데, 갭으로 기록될 때는 그 정보가 이미 없다.
   * 소문자화 자체는 표제어 조회에 필요하므로 유지하되, **대문자였다는 사실을 따로 남긴다.**
   *
   * 판정: 문장 첫머리 대문자는 근거로 세지 않는다(모든 문장이 그렇다). 문장 중간에서
   * 대문자로 나타난 적이 있고 **소문자로는 한 번도 안 나타난** 단어만 후보로 올린다 —
   * 같은 글에 두 형태가 섞이면 후보에서 뺀다. 덜 잡는 쪽이 안전하다.
   */
  properNounCandidates: string[]
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
    boundAffixesDropped: 0,
    nonLexicalDropped: 0,
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

  // 줄 끝 하이픈 재결합 — PDF·스캔본에서 복사한 글은 `rail-\nroad` 처럼 낱말이 행에서 끊긴다.
  //   재결합하지 않으면 `rail` + `road` 두 토큰이 되어 **없는 낱말을 추출하고 진짜 낱말은 잃는다.**
  //   개행 정규화가 **먼저** 와야 한다 — 붙여넣기 소스가 CRLF 면 `-\n` 이 매치되지 않는다.
  //   (같은 결함이 library-pipeline 의 reflowSoftHyphens 에 있었다: 구텐베르크 전권에서 no-op)
  s = s.replace(/\r\n?/g, '\n')
  s = s.replace(/(\p{L})-[ \t]*\n[ \t]*(\p{L})/gu, '$1$2')

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

  // **소문자화하지 않고 돌려준다.** 대문자 여부가 고유명사 판정의 유일한 신호이고,
  // 여기서 내려 버리면 뒤에서는 복구할 방법이 없다(`properNounCandidates` 주석 참조).
  // 소문자화는 토큰을 실제로 내보내는 지점에서 한다.
  return s
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

/**
 * 하이픈 복합어 — 부분들 + 전체형 모두 후보. 사전에 전체형이 있으면 그쪽이 매칭된다.
 *
 * 단, **결합형 접두사는 단독 후보로 올리지 않는다**(`pre-industrial` → `pre` 금지).
 * 전체형은 그대로 올리므로 정보가 사라지지는 않는다 — 학습자에게 조각을 단어라고
 * 내놓지 않을 뿐이다.
 */
function expandHyphen(word: string, d: TokenizationDiagnostics): string[] {
  if (!word.includes('-')) return [word]
  const parts = word.split('-').filter((p) => PLAIN_WORD.test(p))
  if (parts.length === 0) return []
  const free = parts.filter((p) => !BOUND_PREFIXES.has(p))
  d.boundAffixesDropped += parts.length - free.length
  const out = [...free]
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
    return {
      words: [],
      counts: {},
      properNounCandidates: [],
      totalWords: 0,
      uniqueRaw: 0,
      uniqueFinal: 0,
      diagnostics,
    }
  }

  const cleaned = preprocess(text, diagnostics)

  // Map 은 삽입 순서를 보존한다 — `words` 의 "원문 등장 순서" 계약이 여기에 걸려 있다.
  const ordered = new Map<string, number>()
  let totalWords = 0

  // 대소문자 근거 — 문장 첫머리는 세지 않는다(모든 문장이 대문자로 시작한다).
  const capMidSentence = new Map<string, number>()
  const seenLowercase = new Map<string, number>()

  // 문장 단위로 자른다. 각 조각의 **첫 토큰만** 문장 첫머리다.
  //   여기서 마스킹 전에 잘라야 한다 — 마스킹은 문장부호를 공백으로 지워 버리므로,
  //   순서를 바꾸면 문장 경계를 영영 알 수 없다.
  const chunks = cleaned.split(/(?<=[.!?…])[\s"')\]]+|\n+/)

  for (const chunk of chunks) {
    // 단어 구성 문자만 남긴다 — 알파벳 · 숫자 · 아포스트로피 · 하이픈.
    //   숫자를 이 단계에서 지우지 않는 이유: "co2"→"co" 같은 **파편 위조**를 막으려면
    //   숫자가 붙어 있었다는 사실을 토큰 단위로 알아야 하기 때문이다.
    const masked = chunk.replace(/[^A-Za-z0-9'\-\s]/g, ' ')
    const surfaces = masked.split(/\s+/).filter((t) => t.length > 0)

    for (let si = 0; si < surfaces.length; si += 1) {
      const surface = surfaces[si]!
      // 토큰 양끝의 아포스트로피·하이픈은 구두점 — 인용부호, 줄표 잔재
      const rawTok = surface.replace(/^['\-]+/, '').replace(/['\-]+$/, '')
      if (rawTok.length === 0) continue

      // 숫자가 섞인 토큰은 통째로 제외 — 알파벳 앞부분만 남기면 없던 단어를 만든다
      if (/[0-9]/.test(rawTok)) {
        diagnostics.numericDropped += 1
        continue
      }

      // 조각별 대문자 여부를 원형에서 먼저 뽑아 둔다 (하이픈·아포스트로피 분해 전).
      const capByPart = new Map<string, boolean>()
      capByPart.set(rawTok.toLowerCase(), /^[A-Z]/.test(rawTok))
      for (const part of rawTok.split(/['-]/)) {
        if (part.length > 0) capByPart.set(part.toLowerCase(), /^[A-Z]/.test(part))
      }

      const isSentenceStart = si === 0
      const tok = rawTok.toLowerCase()

      const contracted = resolveContraction(tok, diagnostics)
      const bases = contracted ?? [tok]

      let emitted = 0
      for (const base of bases) {
        for (const w of expandHyphen(base, diagnostics)) {
          if (w.length < 2) continue
          if (!PLAIN_WORD.test(w) && !HYPHEN_WORD.test(w) && !APOSTROPHE_WORD.test(w)) continue
          ordered.set(w, (ordered.get(w) ?? 0) + 1)

          const wasCap = capByPart.get(w) ?? false
          if (wasCap) {
            // 문장 첫머리 대문자는 근거가 못 된다 — 소문자 근거로도 세지 않고 그냥 버린다.
            if (!isSentenceStart) capMidSentence.set(w, (capMidSentence.get(w) ?? 0) + 1)
          } else {
            seenLowercase.set(w, (seenLowercase.get(w) ?? 0) + 1)
          }
          emitted += 1
        }
      }
      if (emitted > 0) totalWords += 1
    }
  }

  const uniqueRaw = ordered.size

  const filtered: string[] = []
  for (const w of ordered.keys()) {
    if (STOPWORDS.has(w)) {
      diagnostics.stopwordsRemoved += 1
      continue
    }
    // 인용·약어·로마숫자·도메인 조각 — 배울 단어가 아니다. stopword 와 따로 센다:
    // stopword 는 "흔해서 뺀 단어" 이고 이쪽은 "애초에 단어가 아닌 표기" 다.
    if (NON_LEXICAL.has(w)) {
      diagnostics.nonLexicalDropped += 1
      continue
    }
    filtered.push(w)
  }

  // 상한 — 등장 순서 유지 절단. 잘렸다면 숨기지 않고 보고한다.
  const capped = filtered.slice(0, MAX_UNIQUE)
  diagnostics.truncated = filtered.length - capped.length

  // counts 는 capped 와 정확히 같은 집합이어야 한다 — 잘려나간 단어의 빈도가 통계에 남으면
  // `words` 에는 없는데 사전에는 쌓이는, 화면으로 검증할 수 없는 차이가 생긴다.
  const counts: Record<string, number> = {}
  for (const w of capped) counts[w] = ordered.get(w) ?? 1

  // 문장 중간에서 대문자로 나타난 적이 있고, 소문자로는 **한 번도** 안 나타난 것만 후보다.
  // 두 형태가 섞여 나오면(회사명 Apple 과 과일 apple) 판정을 포기한다 — 잘못 거르면
  // 배워야 할 단어가 사전 갭에서 사라지고, 그 손실은 화면 어디에도 드러나지 않는다.
  const properNounCandidates = capped.filter(
    (w) => (capMidSentence.get(w) ?? 0) > 0 && (seenLowercase.get(w) ?? 0) === 0,
  )

  return {
    words: capped,
    counts,
    properNounCandidates,
    totalWords,
    uniqueRaw,
    uniqueFinal: capped.length,
    diagnostics,
  }
}

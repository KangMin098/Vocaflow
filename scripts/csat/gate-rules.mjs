// scripts/csat/gate-rules.mjs
//
// **교재 게시 게이트 — 하드 리젝트 규칙의 정본.**
//
// ── 왜 채점기(lib-fit)로는 부족한가 ────────────────────────────────
// 대역 채점기는 문장 길이·낱말 길이·연결사/지시어 세 가지만 본다. 그 셋은
// 성경 절 번호도, 도판 캡션도, 서사문도 멀쩡히 만족한다. 실제로 무작위 18편을
// 손으로 읽었을 때 쓸 만한 것은 3편이었다(2026-09-05 실측). 즉 여기서 막는 것은
// **채점기가 볼 수 없는 축**이지 채점기의 버그가 아니다.
//
// ── 검증 원칙 (이 파일의 존재 이유) ─────────────────────────────────
// **실제 수능·모평 지문을 떨어뜨리는 규칙은 그 자체로 틀린 규칙이다.**
// 기출 810지문이 대조군이고, 규칙마다 그 위에서의 오탐률을 잰다(gate-screen.mjs).
// 오탐이 0 이 아니면 규칙을 좁히거나 버린다. 문서로 "조심하자" 고 적는 것은
// 세 번 다 실패했다 — 숫자로 막는다.
//
// ── 규칙의 성격 ────────────────────────────────────────────────────
// 여기 있는 것은 **기계로 100% 확실한 것만**이다. 장르(서사/논증), 교리·의사과학,
// 사실 오류처럼 판단이 필요한 축은 규칙이 아니라 LLM 판정(책 단위 드레인)이 맡는다.
// 애매한 것을 규칙으로 만들면 멀쩡한 지문이 조용히 사라진다.

/**
 * 하드 리젝트 규칙.
 * `id` 는 DB 에 남는 사유 코드다 — 바꾸면 과거 판정을 못 읽는다.
 * `test(text)` 가 true 면 **게시 불가**.
 */
export const HARD_RULES = [
  {
    id: 'doc-figure',
    why: '도판·표 참조 — 그림이 없는 지문에서 “Fig. 3 참조”는 이해 불가',
    test: (t) => /\bFig\.\s*\d|\bFigure\s+\d|\bPlate\s+[IVXLC\d]|\bTable\s+\d/.test(t),
  },
  {
    id: 'doc-page',
    why: '원본 쪽 참조 — 지문 밖을 가리킨다',
    test: (t) => /\bpp?\.\s*\d{1,4}\b|\bvol\.\s*[IVXLC\d]/i.test(t),
  },
  {
    id: 'doc-footnote',
    why: '각주 번호 잔재',
    test: (t) => /\[\d{1,3}\]|\{\d{1,3}\}/.test(t),
  },
  {
    id: 'doc-verse',
    why: '성경 장:절 번호 — 본문이 아니라 경전 편집 체계',
    test: (t) => /(^|\s)\d{1,3}:\d{1,3}\s+[A-Z]/.test(t),
  },
  {
    id: 'doc-glyph',
    why: 'OCR·조판 잔재 글리프',
    // ⚠️ ※ 는 빼야 한다 — 기출 안내문 23편이 쓴다(2.35% 오탐). OCR 잔재만 남긴다.
    test: (t) => /[■□▪▲◆●†‡]/.test(t),
  },
  {
    id: 'doc-markup',
    why: '밑줄 이탤릭 마크업 잔재 (_word_)',
    test: (t) => /_[A-Za-z][A-Za-z '-]{1,40}_/.test(t),
  },
  {
    id: 'doc-caption',
    why: '캡션 조각 — 닫는 대괄호로 끝나거나 시작한다',
    test: (t) => /^\s*[^\[\]]{0,200}\]|\[\s*$/.test(t.slice(0, 400)),
  },
  {
    id: 'ref-crossref',
    why: '앞뒤 장 참조 — 자족성이 깨진다',
    test: (t) =>
      /\b(in the (preceding|foregoing|last|next) chapter|as (we|I) (have )?(saw|seen|said|shown) (above|earlier)|see (above|below|note)|ibid\b|op\.\s*cit)/i.test(
        t,
      ),
  },
  {
    id: 'ref-reader',
    why: '독자 호명 — 책의 서문·서술자 개입',
    // ⚠️ "the reader" 는 빼야 한다 — 문학·독서 소재 기출 6편이 본문에서 쓴다(0.74% 오탐).
    //   책이 독자를 부르는 것은 소유격이 붙은 형태다.
    test: (t) => /\b(my readers?|dear readers?|our readers)\b/i.test(t),
  },
  {
    id: 'lex-entry',
    why: '사전·용어집 표제어 항목',
    test: (t) => /\b[A-Z]{3,},\s*(n|adj|v|adv|prep|conj)\./.test(t),
  },
  {
    id: 'lex-list',
    why: '번호 매긴 목록 — 문단이 아니다',
    test: (t) => /(^|[.;]\s)\d{1,2}\.\s+[A-Z][a-z]/.test(t),
  },
]

/** 규칙을 한 번에 돌려 걸린 사유 코드 배열을 준다. */
export function hardReject(text) {
  const t = String(text ?? '')
  return HARD_RULES.filter((r) => r.test(t)).map((r) => r.id)
}

// ── 용도 ────────────────────────────────────────────────────────────
//
// **한 자로 두 용도를 재면 한쪽이 반드시 틀린다.** 실제로 그렇게 틀렸다 —
// `publishable = verdict === 'use'` 하나로 재는 바람에 초·중 교재용 서사 발췌
// 1,241편이 통째로 내려갔다(2026-09-05). 수능이 설명·논증문만 쓰는 것과
// 초·중 독해 교재가 이야기를 싣는 것은 **다른 용도의 다른 판단**이다.
//
// 그래서 용도를 먼저 정하고, 용도마다 기준을 따로 둔다.
/**
 * 이 행이 무엇에 쓰이는가. `feed_id` 와 `source` 로 가른다 (실측 2026-09-05).
 *
 * | 용도 | 무엇 | 행 |
 * |---|---|---|
 * | `csat` | 수능 지문 원천 — Gutenberg 수확 · 작문 드레인 | 약 23,200 |
 * | `kids` | 초·중 교재 발췌 (`PD 발췌 · 초3~4` … `중3`) | 5,508 |
 * | `raw` | PLOS 논문 **전문** — 지문이 아니다 | 약 34,700 |
 * | `library` | 도서관 읽기 자료 (essay·news·featured·default·snippets 등) | 약 6,500 |
 */
export function purposeOf(row) {
  const feed = String(row.feed_id ?? '')
  const source = String(row.source ?? '')
  // 'adapted' = 목표 학령으로 다시 쓴 각색문. 이야기가 나올 수밖에 없으므로 교재 쪽이다.
  if (feed === 'kid-excerpt' || feed === 'adapted') return 'kids'
  // ⚠️ **`plos-extract` 를 먼저 걸러야 한다.** 추출기가 논문에서 잘라 낸 지문은 300어대이고
  //   `source` 는 여전히 'plos' 다. 순서를 바꾸면 잘라 낸 지문까지 "미절단 원본" 으로 되돌아간다.
  //   실측 2026-09-06: 이 순서 때문에 `raw` 가 36,337 → 46,473 으로 늘고
  //   `csat` 게시 가능이 17,518 → 9,170 으로 줄었다 — 추출 성과가 통째로 사라진 것이다.
  if (feed === 'plos-extract') return 'csat'
  // PLOS 원본은 평균 4만 자다 — 지문 크기(700~1,000자)가 아니라 논문 전문이다.
  //   자르기 전에는 어느 용도로도 게시할 수 없다.
  if (source === 'plos') return 'raw'
  if (feed === 'harvest' || feed === 'compose-drain') return 'csat'
  return 'library'
}

/**
 * 용도별 게시 기준.
 *
 * - `harmful` 은 **모든 용도에서 차단**한다. 교리·차별·의사과학·폐기된 사실·선동은
 *   읽기 자료로도, 초등 교재로도 게시하면 안 된다. 용도와 무관한 축이다.
 * - `unfit` 은 "읽을 수 있는 글이 아닌 것" — 사전 항목·주석 덩어리·판정 불가.
 * - 나머지는 용도가 가른다.
 */
export const HARMFUL = new Set(['bias', 'doctrine', 'pseudoscience', 'obsolete-fact', 'polemic'])
export const UNFIT = new Set(['reference', 'fragmentary', 'mixed'])

export const PURPOSE_RULE = {
  csat: {
    /**
     * ⚠️ **서사도 받는다 — 여기 오래 `use` 하나만 있었다.**
     *
     * 주석에는 "서사는 추론 유형에 못 쓴다" 고 적혀 있었고, 그 말은 **절반만 맞다.**
     * 빈칸·요지·주제에 이야기를 대면 논지가 안 서는 것은 맞지만, 수능에는 **서사여야만
     * 서는 유형**이 따로 있다 — 19번 심경과 43~45번 장문이다.
     *
     * 시장 실측이 그것을 요구한다(`market-spec.json` 고등 쪽당 등장률):
     *
     *   mood            0.0113
     *   long_reference  0.0073
     *
     * 그런데 이 한 줄이 서사를 통째로 막아, 그 두 유형의 지문이 재고에서 사라졌다.
     * 실측 2026-09-06 — Gutenberg 36,480편 중 조합 풀에 드는 것이 **19편**이었고,
     * `narrative/biography` **1,134편** · `narrative/history` **909편**이 이 게이트에
     * `archived` 로 내려가 있었다. 그래서 V7 권의 `mood`·`long_reference` 가 **늘 0** 이었다.
     *
     * 서사가 추론 유형에 섞이는 것은 **고르는 쪽**이 막는다 — 드레인은 유형을 지정해
     * 뽑고(`item-drain-export --type`), 조합기는 유형별 풀에서 고른다. 실을 수 있는 글을
     * 게이트에서 통째로 버리는 것과, 유형마다 알맞은 글을 고르는 것은 다른 일이다.
     */
    verdicts: new Set(['use', 'narrative']),
    allowPoetry: false,
    requireCleanCodes: true, // 문서 잔재가 하나라도 있으면 자족성이 깨진다
    label: '수능 지문',
  },
  kids: {
    verdicts: new Set(['use', 'narrative']), // 초·중 독해 교재는 이야기를 싣는다
    allowPoetry: false,
    requireCleanCodes: true,
    label: '초·중 교재',
  },
  library: {
    verdicts: new Set(['use', 'narrative']),
    allowPoetry: true, // 읽기 자료로는 운문도 정당하다
    // ⚠️ 읽기 자료는 **문항을 만들지 않으므로** 자족성 요구가 약하다. 그래도 사전 항목·
    //   성경 절 번호·캡션 잔재는 읽을 글이 아니라서 아래 STRUCT_BLOCK 만 막는다.
    requireCleanCodes: false,
    label: '도서관 읽기',
  },
  raw: {
    verdicts: new Set([]), // 자르기 전에는 무엇도 게시 불가
    allowPoetry: false,
    requireCleanCodes: true,
    label: '미절단 원본',
  },
}

/** 읽기 자료에서도 막는 구조 코드 — "읽을 수 있는 글" 이 아닌 것만. */
export const STRUCT_BLOCK = new Set(['doc-verse', 'doc-caption', 'doc-glyph', 'lex-entry', 'lex-list'])

/**
 * 최종 판정. `{publishable, blockedBy}` 를 준다.
 * `verdict` 는 책 단위 LLM 판정(없으면 null), `codes` 는 기계 규칙 적중.
 */
export function decide({ purpose, verdict, genre, codes }) {
  const rule = PURPOSE_RULE[purpose] ?? PURPOSE_RULE.library
  if (purpose === 'raw') return { publishable: false, blockedBy: 'oversize-raw' }
  if (verdict === 'reject') {
    if (HARMFUL.has(genre)) return { publishable: false, blockedBy: genre }
    if (UNFIT.has(genre)) return { publishable: false, blockedBy: genre }
    if (genre === 'poetry-drama' && !rule.allowPoetry) return { publishable: false, blockedBy: genre }
    if (genre === 'poetry-drama' && rule.allowPoetry) {
      // 운문은 도서관에서만 통과 — 구조 코드 검사는 계속 받는다
    } else {
      return { publishable: false, blockedBy: genre || 'reject' }
    }
  } else if (verdict && !rule.verdicts.has(verdict)) {
    return { publishable: false, blockedBy: `verdict:${verdict}` }
  }
  const blocking = rule.requireCleanCodes ? codes : codes.filter((c) => STRUCT_BLOCK.has(c))
  if (blocking.length) return { publishable: false, blockedBy: blocking[0] }
  return { publishable: true, blockedBy: null }
}

/**
 * **규칙 판(版). 판정 결과를 바꾸는 수정을 하면 반드시 올린다.**
 *
 * ⚠️ 이게 없으면 **규칙을 고쳐도 데이터가 안 바뀐다.** 실제로 그랬다(2026-09-06):
 *   `csat` 이 `narrative` 를 받도록 고쳤는데, `gate-import` 의 재실행 최적화(`settled()`)가
 *   "저장된 판정과 지금 용도가 같으면 건너뛴다" 로 되어 있어 **4,401편이 격리에 그대로 남았다.**
 *   실행은 성공하고 "이미 같음 90,327" 을 정상 보고했다 — 아무도 안 틀렸는데 반영이 안 됐다.
 *
 * 판을 올리면 저장된 `gate.rv` 와 어긋나므로 전량이 다시 판정된다.
 *
 * | 판 | 무엇이 바뀌었나 |
 * |---|---|
 * | 1 | 최초 (기계 규칙 11개 + 책 단위 판정) |
 * | 2 | 용도 4종(csat·kids·library·raw)으로 기준 분리 |
 * | 3 | `plos-extract` 를 `raw` 보다 먼저 판정 · `csat` 이 `narrative` 를 받는다 |
 */
export const RULES_VERSION = 3

/**
 * **기계 규칙(`HARD_RULES`)의 판.** `RULES_VERSION` 과 따로 둔다.
 *
 * ⚠️ 판이 하나면 **판정 논리만 바꿔도 본문 9만 편을 다시 받는다.** 실제로 그랬다 —
 *   `RULES_VERSION` 3(용도 순서·서사 허용)은 `HARD_RULES` 를 건드리지 않았는데도
 *   전량 재판정이 회차당 1,600편으로 기어갔다. 42회가 더 필요한 속도였다.
 *
 * 저장된 `gate.codes` 는 이 판이 그대로면 **여전히 유효하다.** 그래서 본문을 안 받고
 * 그대로 쓴다. `HARD_RULES` 를 고칠 때만 이 판을 올린다 — 그때는 본문이 정말 필요하다.
 */
export const CODES_VERSION = 1

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

// apps/web/src/lib/textbook/source-guide.ts
//
// 지문 **출처 갈래**의 학습자 표기 — 서가의 4번째 분류 축.
//
// ⚠️ `server-only`/`react.cache` 금지 — 클라이언트 컴포넌트와 vitest 가 함께 쓴다.
//
// ── 왜 이 축인가 ────────────────────────────────────────────────────────
// 같은 '고2 · 순서/삽입' 권이라도 지문이 백과에서 온 것과 논문에서 온 것은 다른 책이다.
// 시중 교재가 표지에 "과학 지문 중심" 이라고 적는 자리가 이것이고,
// 학습자가 권을 고를 때 학령·수준·유형 다음으로 묻는 것이다.
//
// ⚠️ **라벨을 SQL 이 들지 않는다.** RPC(`textbook_shelf_sources`)는 `simple_wikipedia` 같은
//    갈래 키만 돌려주고, 한국어 표기는 코드가 소유한다 — `SERIES_SPINE` 이 권 제목을
//    소유하는 것과 같은 이유다. 양쪽이 이름을 들면 반드시 갈린다.
//
// ⚠️ **없는 갈래를 미리 적어 두지 않는다.** 서가의 축 값은 재고에서 뽑으므로
//    (`shelf-filter.buildFacets`), 이 표에 있어도 재고가 없으면 화면에 안 나온다.
//    반대로 표에 없는 갈래가 들어오면 키가 그대로 보이므로 테스트가 막는다.

export interface SourceGuide {
  /** 학습자가 읽는 이름 */
  label: string
  /** 이 출처가 어떤 글인지 — 라벨이 말하지 않는 것만 */
  says: string
}

/**
 * 갈래 → 표기.
 *
 * 실측 2026-08-22 기준 재고가 있는 15갈래를 모두 덮는다
 * (original 1,358 · simple_wikipedia 1,128 · book 808 · plos 551 · wikipedia 520 ·
 *  wikivoyage 491 · owid 248 · noaa 241 · voa 212 · usgs 152 · nasa 149 ·
 *  compose 43 · adapt 23 · factbook 17 · elife 11).
 */
export const SOURCE_GUIDE: Record<string, SourceGuide> = {
  original: {
    label: '창작',
    says: '레벨에 맞춰 새로 쓴 지문입니다. 어휘와 문장 길이가 그 계단에 맞춰져 있어요.',
  },
  compose: {
    label: '창작',
    says: '레벨에 맞춰 새로 쓴 지문입니다. 어휘와 문장 길이가 그 계단에 맞춰져 있어요.',
  },
  adapt: {
    label: '개작',
    says: '원문을 그 계단의 어휘로 다시 쓴 지문입니다.',
  },
  book: {
    label: '도서',
    says: '큐레이션 장서에서 발췌했습니다. 문학·논픽션의 실제 문장이에요.',
  },
  simple_wikipedia: {
    label: '쉬운 백과',
    says: '쉬운 영어 위키백과. 설명문의 기본 골격을 가진 글입니다.',
  },
  wikipedia: {
    label: '백과',
    says: '영어 위키백과. 정의와 분류가 촘촘해 어휘 밀도가 높습니다.',
  },
  wikivoyage: {
    label: '여행',
    says: '여행 안내 글. 장소·절차를 설명하는 실용문입니다.',
  },
  plos: {
    label: '논문',
    says: '오픈액세스 학술지(PLOS). 학술 영어의 문장 구조를 그대로 만납니다.',
  },
  elife: {
    label: '논문',
    says: '오픈액세스 학술지(eLife). 학술 영어의 문장 구조를 그대로 만납니다.',
  },
  nasa: {
    label: '우주·항공',
    says: 'NASA 공개 자료. 관측과 임무를 서술하는 글입니다.',
  },
  noaa: {
    label: '기후·해양',
    says: 'NOAA 공개 자료. 자료와 추세를 다루는 글입니다.',
  },
  usgs: {
    label: '지구·재난',
    says: 'USGS 공개 자료. 지질·재해를 설명하는 글입니다.',
  },
  owid: {
    label: '데이터·사회',
    says: 'Our World in Data. 통계로 사회 현상을 설명하는 글입니다.',
  },
  voa: {
    label: '뉴스',
    says: 'VOA 학습자용 뉴스. 문장이 짧고 시사 어휘가 반복됩니다.',
  },
  factbook: {
    label: '국가 정보',
    says: 'CIA World Factbook. 항목이 정형화된 자료문입니다.',
  },
  unknown: {
    label: '출처 미상',
    says: '원문 연결이 끊긴 지문입니다.',
  },
}

/** 표기 — 모르는 갈래는 키를 그대로 돌려준다(테스트가 이 상황을 막는다). */
export function sourceLabel(family: string): string {
  return SOURCE_GUIDE[family]?.label ?? family
}

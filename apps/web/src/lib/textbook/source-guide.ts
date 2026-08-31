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

import type { SourceKey } from '@vocaflow/library-pipeline/curation-spec'

export interface SourceGuide {
  /** 학습자가 읽는 이름 */
  label: string
  /** 이 출처가 어떤 글인지 — 라벨이 말하지 않는 것만 */
  says: string
}

/**
 * 갈래 → 표기.
 *
 * 파이프라인이 아는 **모든** 수집 출처(`SOURCE_SPECS` 의 SourceKey)와, 수집이 아닌 방식으로
 * 생기는 갈래(book · compose · adapt · unknown)를 함께 덮는다. 앞의 절반은
 * `__tests__/source-guide.test.ts` 가 파이프라인에서 직접 읽어 대조하므로 손으로 셀 필요가 없다.
 *
 * ⚠️ **재고가 있는 것만 적어 두면 늦는다.** 2026-08-30 에 futurity 가 수집 출처로 열렸는데
 *    (마이그레이션 `20260830020000`) 이 표에 없어, 다음 날 서가의 지문 출처 칩 줄에
 *    한글 칩들 사이로 `futurity` 라는 **DB 키가 그대로** 학습자에게 나갔다.
 *    위 ⚠️ 가 "테스트가 막는다" 고 적어 두었지만 **그런 테스트는 없었다** — 그래서 지금 만들었다.
 */
/**
 * ⚠️ 타입이 **교집합**인 것이 핵심이다. `Record<string, …>` 하나였을 때는 키를 빠뜨려도
 *    tsc 가 아무 말을 안 했다 — futurity 가 그렇게 샜다. `Record<SourceKey, …>` 를 겹치면
 *    수집 출처는 컴파일이 막고, `Record<string, …>` 쪽이 수집이 아닌 갈래(book·compose·
 *    adapt·unknown)를 계속 허용한다.
 */
export const SOURCE_GUIDE: Record<SourceKey, SourceGuide> & Record<string, SourceGuide> = {
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
  nih: {
    label: '건강·의학',
    says: 'NIH MedlinePlus 공개 자료. 몸과 질병을 짧게 설명하는 글입니다.',
  },
  wikinews: {
    // voa 와 같은 '뉴스' 칩으로 접힌다 — 학습자에게 뉴스는 하나다(plos·elife → '논문' 과 같은 규칙).
    label: '뉴스',
    says: '위키뉴스. 사실만 짧게 전하는 보도문입니다.',
  },
  the_conversation: {
    label: '전문가 칼럼',
    says: '학자가 자기 분야를 대중에게 설명한 기고문. 주장과 근거가 뚜렷합니다.',
  },
  futurity: {
    label: '연구 소식',
    says: '대학이 자기 연구를 직접 풀어 쓴 기사. 소재는 학술인데 문장은 뉴스처럼 읽혀요.',
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

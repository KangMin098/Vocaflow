// apps/web/src/lib/library/vocab/set-kind.ts
//
// 단어장 **유형**을 학습자 말로 옮기는 곳 — 이름 하나당 정본 하나.
//
// 왜 필요한가 (실측 2026-08-15):
//   발행 29세트 중 24개가 '테마별' 한 칸에 있다. 학습자가 그 칸을 열면 제목 24개가
//   나란히 뜨는데, 제목만으로는 "함께 쓰는 말" 과 "비슷한 말 비교" 가 어떻게 다른지
//   알 수 없다. 무엇으로 묶은 책인지가 보이지 않으면 고를 수가 없다.
//
//   카테고리 칸을 늘려 해결할 수는 없다 — 칸은 학습 **단계**(초등~공무원)를 뜻하고,
//   이 24개는 단계가 아니라 **묶는 원리**가 서로 다른 것이기 때문이다. 그래서 칸이
//   아니라 카드에 원리를 적는다.
//
// 어드민 카탈로그(`lib/vcb/compose/blueprints.ts`)에도 같은 성격의 문구가 있지만 그쪽은
// **운영자용**이다("organizing_principle: 국제 말뭉치 빈도 — 자주 만나는 것부터").
// 여기 있는 것은 학습자가 카드에서 읽는 한 줄이라 말투와 길이가 다르다. 두 곳을 하나로
// 합치면 어느 한쪽이 반드시 어색해진다.

export interface SetKind {
  /** 카드에 붙는 짧은 유형 라벨 */
  label: string
  /** 무엇으로 묶었는지 한 줄 — 제목이 말하지 않는 것만 적는다 */
  principle: string
}

const KINDS: Record<string, SetKind> = {
  // 목록 기반 — 무엇을 넣을지 외부 목록이 정한다
  'freq-tier': { label: '빈도순', principle: '실제 영어에서 자주 나오는 순서대로' },
  'exam-list': { label: '시험 빈출', principle: '출제 기관 빈출 목록에서 뽑았어요' },
  'curriculum-grade': { label: '교육과정', principle: '2022 개정 교육과정 기본어휘' },
  'academic-awl': { label: '학술', principle: '논문·교재에 반복해서 나오는 말' },
  'level-band': { label: '난이도', principle: '한 난이도 구간만 모았어요' },
  'domain-specialty': { label: '분야', principle: '그 분야 글에만 집중적으로 쓰이는 말' },
  'exam-items': { label: '기출', principle: '실제 출제된 문항에서 뽑았어요' },

  // 구조 기반 — 단어 사이의 관계가 목차가 된다
  'root-etymology': { label: '어원', principle: '어근 하나에 딸린 단어를 한 묶음으로' },
  'word-family': { label: '파생어', principle: '한 단어에서 갈라져 나온 말끼리' },
  'pos-focus': { label: '품사', principle: '한 품사만 모아 쓰임을 익혀요' },
  'topic-field': { label: '주제', principle: '한 장면에서 같이 쓰는 말끼리' },
  'synonym-cluster': { label: '유의어', principle: '비슷한 말을 나란히 놓고 차이를 봐요' },
  'antonym-pair': { label: '반대말', principle: '짝을 이루는 반대말을 함께' },
  confusable: { label: '헷갈리는 짝', principle: '생김새가 닮아 자주 바뀌는 말끼리' },
  collocation: { label: '연어', principle: '늘 함께 붙어 다니는 말 단위로' },
  'phrasal-idiom': { label: '구·관용어', principle: '낱말이 아니라 덩어리째 외우는 표현' },
  polysemy: { label: '다의어', principle: '뜻이 여러 개인 단어를 뜻별로' },
  'rhyme-phonics': { label: '소리 규칙', principle: '끝소리가 같은 말끼리 묶어 규칙을 익혀요' },

  // 원서·글 기반 — 읽을 콘텐츠가 표제어를 정한다
  'book-companion': { label: '이 책 어휘', principle: '그 책에 실제로 나오는 말만' },
  'chapter-companion': { label: '이 장 어휘', principle: '읽을 장에 나오는 말만 미리' },
  'news-article': { label: '이 글 어휘', principle: '그 글에 나오는 말만' },
  'script-media': { label: '이 영상 어휘', principle: '그 스크립트에 나오는 말만' },

  // 전달 기반 — 같은 어휘를 어떤 형태로 주느냐
  'day-pacing': { label: 'N일 완성', principle: '하루치로 잘라 둬서 오늘 것만 하면 돼요' },
  'mnemonic-story': { label: '연상', principle: '외울 고리가 있는 단어만 골랐어요' },
  'picture-dict': { label: '그림', principle: '뜻을 글로 읽지 않고 그림으로' },
  'audio-only': { label: '듣기', principle: '화면 없이 듣기만으로' },

  // 플랫폼 고유 — 지면 단어장이 원리적으로 못 만드는 것
  unlock: { label: '해금', principle: '이 책의 문장을 가장 많이 열어 주는 순서로' },
  recycle: { label: '재등장', principle: '앞으로 그 책에서 다시 만날 말부터' },
  'facet-ladder': { label: '다면 학습', principle: '뜻·철자·조립·문맥까지 다 연습되는 단어만' },
  'confusion-log': { label: '내 오답', principle: '내가 실제로 틀린 단어와 그때 고른 말' },
  uncovered: { label: '미수록', principle: '다른 단어장이 다루지 않는 말' },
}

/** blueprint id → 학습자용 유형. 모르는 id 면 null (카드가 그 줄을 생략한다). */
export function setKindOf(blueprint: string | null | undefined): SetKind | null {
  if (!blueprint) return null
  return KINDS[blueprint] ?? null
}

/** 카탈로그에 등록된 유형 수 — 회귀가 카탈로그와의 동기를 확인한다. */
export const SET_KIND_COUNT = Object.keys(KINDS).length

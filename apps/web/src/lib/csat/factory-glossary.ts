// apps/web/src/lib/csat/factory-glossary.ts
//
// **교재 공장 용어집 — 툴팁과 용어집 화면이 읽는 단 하나의 출처.**
//
// 공장 화면은 오래 코드의 말로 적혀 있었다(게이트 · 청크 · 드레인 · 밴드 · 사다리 · 조판).
// 코드를 읽은 사람에게는 정확하지만, 처음 온 사람은 첫 줄에서 막힌다. 그래서 화면 위의 말은
// 쉬운 말로 바꾸고, 원래 말은 **여기 한 곳**에서 쉬운 말과 짝지어 둔다.
//
// ⚠️ 설명을 화면에서 새로 적지 않는다. 같은 낱말을 두 화면이 다르게 풀면 그 순간 용어집이
//   거짓말을 한다 — `<FactoryTerm id=…>` 는 여기서만 읽는다(회귀가 id 존재를 확인한다).

export interface GlossaryTerm {
  /** 화면에 보이는 쉬운 말. */
  word: string
  /** 한두 문장 설명 — 중학생이 읽고 알 수 있게. */
  plain: string
  /** 코드·스크립트·옛 화면에서 같은 것을 부르던 말. 용어집 화면에서만 보인다. */
  aka?: readonly string[]
  /** 예를 하나 들면. */
  example?: string
  /** 용어집에서 묶는 칸. */
  group: 'material' | 'making' | 'checking' | 'status' | 'how'
}

export const GLOSSARY_GROUPS: Record<GlossaryTerm['group'], string> = {
  material: '재료',
  making: '만들기',
  checking: '확인하기',
  status: '상태 표시',
  how: '일하는 방식',
}

export const GLOSSARY = {
  /* ── 재료 ── */
  source: {
    word: '글감',
    plain: '교재 지문의 재료가 되는 영어 글 원본이에요. 과학 기사, 뉴스, 이야기 같은 것들이죠.',
    aka: ['원문', 'article', 'library_articles'],
    example: 'NASA 누리집의 「화성 탐사 로봇」 기사 한 편이 글감 하나예요.',
    group: 'material',
  },
  origin: {
    word: '가져오는 곳',
    plain: '글감을 받아 오는 누리집이나 기관이에요. 곳마다 쓸 수 있는 조건이 달라요.',
    aka: ['원천', 'source', 'csat_source_registry'],
    example: 'NASA, VOA, PLOS 가 각각 가져오는 곳 하나예요.',
    group: 'material',
  },
  license: {
    word: '사용 허락',
    plain:
      '그 글을 어디까지 써도 되는지 글쓴이가 정해 둔 약속이에요. 고쳐 써도 되는지, 돈 받는 책에 넣어도 되는지가 여기서 갈려요.',
    aka: ['라이선스', 'license_class', 'CC BY', 'CC0'],
    example: 'CC BY 는 「출처만 밝히면 고쳐 쓰고 팔아도 된다」는 약속이에요.',
    group: 'material',
  },
  gradeStep: {
    word: '학년 단계',
    plain: '초등 저학년부터 고3까지를 일곱 칸으로 나눈 눈금이에요. 지문과 문제는 모두 이 칸 중 하나에 들어가요.',
    aka: ['밴드', 'band', 'V-Level', 'V2~V7'],
    example: '「중학 1-2학년」 칸의 지문은 보통 80~100 낱말이에요.',
    group: 'material',
  },
  series: {
    word: '시리즈',
    plain: '한 이름 아래 학년 단계마다 한 권씩 이어지는 책 묶음이에요. 지금은 독해 · 어휘 · 구문 셋이 있어요.',
    aka: ['SeriesDef', 'series-catalog'],
    example: 'Vocaflow Reading 은 초등 저학년부터 고3까지 7권이에요.',
    group: 'material',
  },
  ladder: {
    word: '학년 계단',
    plain: '한 시리즈가 학년 단계를 한 칸씩 올라가며 내는 권들의 순서예요. 계단 하나가 책 한 권이에요.',
    aka: ['사다리', 'rung', 'SERIES_SPINE'],
    group: 'material',
  },
  questionType: {
    word: '문제 유형',
    plain: '문제의 종류예요. 빈칸 채우기, 글의 순서, 주제 찾기처럼 묻는 방법이 다르면 다른 유형이에요.',
    aka: ['유형', 'type', 'csat_types'],
    example: '「주어진 문장이 들어갈 곳 찾기」는 문장 넣기 유형이에요.',
    group: 'material',
  },
  passage: {
    word: '지문',
    plain: '글감을 다듬어 문제 위에 싣는 글이에요. 글감 하나에서 지문 여러 개가 나올 수 있어요.',
    aka: ['원글', 'passage', 'excerpt'],
    group: 'material',
  },

  /* ── 만들기 ── */
  eligibility: {
    word: '실어도 되는지 판정',
    plain:
      '글감을 교재에 실어도 되는지 일곱 가지로 살펴본 결과예요. 사용 허락, 영어 글인지, 길이, 내용이 알맞은지 같은 것을 봐요.',
    aka: ['적격 판정', 'eligibility', 'G0~G3', 'csat_source_eligibility'],
    example: '사용 허락이 「고쳐 쓰기 금지」면 원문 그대로는 못 싣고 새로 써야 해요.',
    group: 'making',
  },
  rewrite: {
    word: '새로 쓰기',
    plain:
      '그대로 쓸 수 없는 글은 문장을 버리고 내용만 가져와 처음부터 다시 써요. 원문과 겹치는 표현이 하나도 없어야 통과예요.',
    aka: ['재저작', 'rewrite', 'write-drain'],
    group: 'making',
  },
  item: {
    word: '문제',
    plain: '지문 하나에 붙는 질문과 보기, 정답이에요.',
    aka: ['문항', 'item', 'csat_dcp_items'],
    group: 'making',
  },
  explanation: {
    word: '해설',
    plain: '왜 그게 정답이고 나머지는 왜 틀렸는지 한국어로 적은 설명이에요. 해설이 없는 문제는 책에 싣지 않아요.',
    aka: ['explanation_ko', '정답해설'],
    group: 'making',
  },
  printing: {
    word: '책으로 묶기',
    plain: '다 만든 문제를 골라 단원으로 나누고, 표지와 정답편까지 붙여 실제 책 모양으로 만드는 일이에요.',
    aka: ['조판', 'render-volume', 'press'],
    group: 'making',
  },
  spec: {
    word: '책 규격',
    plain: '표지 색, 글꼴, 쪽 모양 같은 책의 겉모습 약속이에요. 규격이 바뀌면 예전에 묶은 책은 다시 묶어야 해요.',
    aka: ['브랜드 지문', 'brand_fingerprint'],
    group: 'making',
  },
  colophon: {
    word: '출처 쪽',
    plain: '책 끝에 어떤 글감을 어디서 가져왔고 어떤 사용 허락으로 썼는지 적는 쪽이에요.',
    aka: ['판권면', 'colophon'],
    group: 'making',
  },

  /* ── 확인하기 ── */
  check: {
    word: '확인',
    plain: '문제에 틀린 곳이 없는지 네 겹으로 살펴보는 일이에요. 기계가 먼저 보고, 가상 검토자 셋이 보고, 정답 번호가 한쪽에 몰렸는지 보고, 시중 교재와 견줘 봐요.',
    aka: ['검수', 'L1~L4', 'review'],
    group: 'checking',
  },
  approval: {
    word: '사람 결재',
    plain: '책을 학습자에게 내보내기 전에 사람이 「내도 된다」를 직접 누르는 일이에요. 자동으로 넘어가지 않아요.',
    aka: ['발행 결재', 'csat_pipeline_approvals', 'publish'],
    group: 'checking',
  },
  shelf: {
    word: '매대',
    plain: '학습자가 고를 수 있게 책을 내놓은 자리예요.',
    aka: ['서가', 'shelf', 'published'],
    group: 'checking',
  },

  /* ── 상태 표시 ── */
  ok: {
    word: '순조로움',
    plain: '이 걸음은 지금 할 일이 없어요. 다음 걸음으로 넘어가도 돼요.',
    aka: ['통과', 'pass'],
    group: 'status',
  },
  piling: {
    word: '할 일 남음',
    plain: '움직이고는 있지만 아직 다 끝나지 않았어요. 남은 몫이 얼마인지 숫자로 보여요.',
    aka: ['몫 남음', 'short'],
    group: 'status',
  },
  stopped: {
    word: '멈춤',
    plain: '여기서 막혀 다음 걸음으로 아무것도 안 넘어가요. 가장 먼저 풀어야 하는 곳이에요.',
    aka: ['막힘', 'blocked'],
    group: 'status',
  },
  unknown: {
    word: '아직 못 셈',
    plain: '숫자를 읽지 못했어요. 0 이 아니라 「모른다」는 뜻이에요. 세는 방법부터 고쳐야 해요.',
    aka: ['못 잼', 'unmeasured'],
    group: 'status',
  },

  /* ── 일하는 방식 ── */
  batch: {
    word: '한꺼번에 처리',
    plain:
      '많은 일을 작은 묶음으로 나눠 Claude 가 차례로 채우는 방식이에요. 묶음 파일을 만들고, 채우고, 다시 넣는 세 번에 끝나요.',
    aka: ['드레인', 'drain', '청크', 'chunk'],
    group: 'how',
  },
  claudeTurn: {
    word: 'Claude 차례',
    plain: '사람 대신 Claude Code 가 글을 쓰거나 판정하는 일이에요. 화면에서 명령을 복사해 Claude 에게 맡기면 돼요.',
    aka: ['Claude Code 배치'],
    group: 'how',
  },
  command: {
    word: '실행 줄',
    plain:
      '터미널에 붙여 넣어 돌리는 한 줄이에요. 책 전체를 훑는 일은 오래 걸려서 화면 버튼 대신 이 줄로 돌려요. 「기록함」 표시가 있으면 데이터가 바뀌어요.',
    aka: ['명령', 'command', 'script'],
    group: 'how',
  },
  standard: {
    word: '통과 기준',
    plain: '이 걸음을 끝냈다고 말하려면 넘어야 하는 선이에요.',
    aka: ['게이트', 'gate'],
    group: 'how',
  },
} as const satisfies Record<string, GlossaryTerm>

export type TermId = keyof typeof GLOSSARY

export function termOf(id: TermId): GlossaryTerm {
  return GLOSSARY[id]
}

/**
 * 화면에 보이면 안 되는 개발 말. 쉬운 말 층(지도 · 머리띠 · 용어집의 쉬운 칸)을 회귀가 이 목록으로 훑는다.
 * 원래 말은 용어집의 `aka` 에만 산다.
 */
export const JARGON = [
  '게이트',
  '청크',
  '드레인',
  '파이프라인',
  '슬롯',
  '스키마',
  '인제스트',
  '밴드',
  '사다리',
  '조판',
  '페르소나',
  'RPC',
  'MV',
] as const

// apps/web/src/lib/csat/teaching-contract.ts
//
// **유형별 교수 계약 — 출제 설계를 무엇으로 가르치는가.** (2026-10-11 · M2)
//
// `/csat/item/[slug]` 는 문제를 푸는 곳이 아니라 출제 설계와 읽기 원리를 배우는 곳이다. 그런데 지금까지 모든
// 유형을 같은 그릇(문장 역할 · 정답 근거 문장 · 오답 배제)에 담았다 — 어법은 「문장 역할」이 아니라 절 구조이고,
// 도표는 문장이 아니라 범주 · 값이고, 순서는 단락 사이의 선행 조건이다. 같은 그릇을 억지로 씌우면 지도는 그려져도
// 학습자가 배울 관계가 빠진다(F06 · F07 · F09).
//
// 이 파일이 **정본**이다. 생산(드레인 프롬프트) · 검수 · 화면 · 이해 확인 과제가 같은 모델을 읽는다.
//   · `units`      — 이 유형의 근거 단위. 문장만이 아니다(단락 · 밑줄 · 표 셀 · 도표 계열 · 빈칸).
//   · `relation`   — 학습자가 문항을 마치고 설명할 수 있어야 하는 중심 관계(한 문장).
//   · `answerDesign` — 정답이 발문을 충족하는 조건을 무엇으로 설명하는가.
//   · `lureDesign`   — 오답이 그럴듯한 이유와 배제 조건을 무엇으로 설명하는가.
//   · `choiceTruth`  — 「정답 선택」과 「선지 내용의 참·거짓」이 갈리는 유형(어법 · 어휘 · 불일치). 화면이 둘을 따로 표시한다.
//   · `visual`       — 원본 시각 자료(도표 · 표) 없이는 수치 판단을 확정하지 않는다(F11). 확인 못 하면 방법만 가르친다.
//   · `passageDesign` — 기존 `answer_locus.passage_design`(문장 역할 · 뼈대 · 변환)이 맞는 유형인가. 아니면 씌우지 않는다.
//   · `pitfalls`     — 이 유형에서 「무조건 규칙」으로 굳기 쉬운 요령 — 적용 조건과 반례 없이 가르치지 않는다.
//
// ⚠️ 여기에는 정답 번호 분포 · 위치 통계 같은 「찍기 규칙」을 넣지 않는다(CSAT_TYPE_BLUEPRINTS 의 생성 기준도 아니다).

import choicePolarity from './choice-polarity.json'

export type EvidenceUnit = 'sentence' | 'paragraph' | 'underline' | 'blank' | 'choice' | 'table_cell' | 'chart_series' | 'notice_item' | 'summary_slot'

export interface TeachingModel {
  /** 화면 이름 — 유형 레지스트리 이름과 같지 않아도 된다(학습자에게 관계를 말하는 이름) */
  label: string
  units: EvidenceUnit[]
  relation: string
  answerDesign: string
  lureDesign: string
  choiceTruth: boolean
  visual: boolean
  passageDesign: boolean
  pitfalls: string[]
}

const GIST: Omit<TeachingModel, 'label'> = {
  units: ['sentence', 'choice'],
  relation: '중심 명제(범위 · 관점)가 선지에서 어떻게 추상화 · 압축되는가',
  answerDesign: '중심 명제의 성분(주체 · 주장 · 범위)과 선지 성분의 대응 · 표현 변환(추상화 · 환언)',
  lureDesign: '지문 낱말 재사용 · 범위 확대/축소 · 부분 진술의 전체화 · 관점 뒤집기',
  choiceTruth: false,
  visual: false,
  passageDesign: true,
  pitfalls: ['「주제문은 첫 문장/마지막 문장」 — 통념 반박 · 사례 선행 구조에서 깨진다', '「반복 낱말이 주제」 — 진 쪽 낱말이 더 자주 나올 수 있다'],
}

/** 26유형 — 키는 csat_items.type_id */
export const TEACHING_MODELS: Record<string, TeachingModel> = {
  'R-PURPOSE': {
    label: '글의 목적',
    units: ['sentence', 'choice'],
    relation: '배경 → 요청/행동 요구 문장이 글의 목적을 정하고, 선지가 그 화행을 어떤 동사로 옮기는가',
    answerDesign: '요청 문장의 주체 · 동사 · 목적어와 선지 동사(요청하다 · 안내하다 · 항의하다)의 대응',
    lureDesign: '배경 사실을 목적으로 착각 · 화행 동사 바꿈(감사 ↔ 요청)',
    choiceTruth: false,
    visual: false,
    passageDesign: true,
    pitfalls: ['「목적은 마지막 단락」 — 요청이 앞에 오고 뒤에 세부가 붙는 글이 있다'],
  },
  'R-CLAIM': {
    label: '필자의 주장',
    units: ['sentence', 'choice'],
    relation: '당위 · 판단 표현(should · must · 평가어)이 주장을 만들고, 선지가 그 판단을 어떻게 옮기는가',
    answerDesign: '당위 문장의 주체 · 행위 · 근거와 선지의 대응',
    lureDesign: '사례 속 행동을 주장으로 · 일반 상식으로 대체 · 판단 방향 뒤집기',
    choiceTruth: false,
    visual: false,
    passageDesign: true,
    pitfalls: ['「should 가 있으면 주장」 — 반박 대상의 주장에도 쓰인다'],
  },
  'R-GIST': { label: '글의 요지', ...GIST },
  'R-TOPIC': { label: '글의 주제', ...GIST },
  'R-TITLE': { label: '글의 제목', ...GIST, answerDesign: GIST.answerDesign + ' · 제목 형식(비유 · 의문형)의 함의' },
  'X-TITLE': { label: '장문 제목', ...GIST, units: ['paragraph', 'sentence', 'choice'] },
  'R-MOOD': {
    label: '심경 변화',
    units: ['sentence', 'choice'],
    relation: '사건 전환점을 기준으로 앞뒤 감정 근거 표현이 어떻게 바뀌는가',
    answerDesign: '전환 사건 · 전/후 감정 근거 표현 · 강도와 시점의 대응',
    lureDesign: '한쪽 감정만 맞음 · 강도 과장 · 시점 뒤바뀜',
    choiceTruth: false,
    visual: false,
    passageDesign: false,
    pitfalls: ['「마지막 문장 감정이 후반 심경」 — 마지막이 회상 · 타인 감정일 수 있다'],
  },
  'R-IMPLY': {
    label: '함축 의미',
    units: ['underline', 'sentence', 'choice'],
    relation: '밑줄 표현의 비유가 문맥에서 가리키는 원관념이 무엇인가',
    answerDesign: '밑줄 앞뒤의 설명 문장 · 비유 → 원관념 대응',
    lureDesign: '밑줄 낱말의 축자 의미 · 결과와 의미 혼동 · 문맥 밖 일반론',
    choiceTruth: false,
    visual: false,
    passageDesign: false,
    pitfalls: ['「밑줄 바로 뒤가 풀이」 — 앞에서 풀거나 글 전체 대조로 풀리는 경우가 있다'],
  },
  'R-BLANK': {
    label: '빈칸 추론',
    units: ['blank', 'sentence', 'choice'],
    relation: '빈칸 문장이 요구하는 논리 조건(무엇의 재진술인가)과 그 조건을 채우는 앞뒤 근거',
    answerDesign: '빈칸의 논리 요구 · 재진술 근거 문장 · 정답 표현으로의 변환',
    lureDesign: '지문 낱말 재사용 · 방향 반대 · 범위 어긋남 · 그럴듯한 일반론',
    choiceTruth: false,
    visual: false,
    passageDesign: true,
    pitfalls: ['「빈칸 문장 = 주제문」 — 세부 재진술 빈칸이 있다', '「예시 사이면 일반 진술」 — 대조 · 양보 구조에서 깨진다'],
  },
  'R-BLANK2': {
    label: '빈칸 두 개',
    units: ['blank', 'sentence', 'choice'],
    relation: '두 빈칸이 각각 독립 제약을 갖고, 선지 쌍이 그 교집합에서만 성립한다',
    answerDesign: '칸마다의 논리 요구와 근거 · 두 제약의 교차',
    lureDesign: '한 칸만 맞는 쌍 · 두 칸의 방향이 서로 바뀐 쌍',
    choiceTruth: false,
    visual: false,
    passageDesign: true,
    pitfalls: ['「한 칸만 확정하면 끝」 — 두 칸 모두 확인해야 성립한다'],
  },
  'X-BLANK': {
    label: '장문 빈칸',
    units: ['blank', 'paragraph', 'sentence', 'choice'],
    relation: '장문의 단락 흐름 속에서 빈칸이 요구하는 결론 · 원리',
    answerDesign: '단락 요지 → 빈칸 요구 · 재진술 근거',
    lureDesign: '한 단락에만 맞는 진술 · 반대 방향',
    choiceTruth: false,
    visual: false,
    passageDesign: false,
    pitfalls: ['「빈칸 단락만 읽으면 된다」 — 다른 단락의 대조가 조건을 정하는 경우'],
  },
  'X-BLANK2': {
    label: '장문 빈칸 두 개',
    units: ['blank', 'paragraph', 'choice'],
    relation: '장문에서 두 빈칸의 독립 제약과 교차',
    answerDesign: '칸마다 단락 근거 · 교차',
    lureDesign: '한 칸만 맞는 쌍',
    choiceTruth: false,
    visual: false,
    passageDesign: false,
    pitfalls: [],
  },
  'R-GRAMMAR': {
    label: '어법',
    units: ['underline', 'choice'],
    relation: '밑줄 자리가 절 구조(주어 · 정동사 · 수식 · 지배)에서 요구하는 형태와 실제 형태의 일치',
    answerDesign: '틀린 자리의 구조 진단 · 수정 전/후 · 성립 이유',
    lureDesign: '형태가 낯설지만 구조상 맞는 자리 — 왜 맞는지(선지 내용은 참)',
    choiceTruth: true,
    visual: false,
    passageDesign: false,
    pitfalls: ['「that 뒤가 완전하면 접속사」 — 동격 · 관계부사 구분 조건이 필요하다', '「주어 바로 뒤 동사」 — 삽입 · 수식이 낀 문장'],
  },
  'R-VOCAB': {
    label: '어휘',
    units: ['underline', 'sentence', 'choice'],
    relation: '밑줄 낱말의 극성이 문맥의 조건 · 인과 · 목적 방향과 맞는가',
    answerDesign: '문맥 방향 근거 · 낱말 극성 · 바른 낱말(수정 전/후)',
    lureDesign: '낯설지만 문맥과 맞는 낱말 — 맞는 이유(선지 내용은 참)',
    choiceTruth: true,
    visual: false,
    passageDesign: false,
    pitfalls: ['「부정적 낱말이 답」 — 극성이 아니라 문맥 방향과의 불일치다'],
  },
  'X-VOCAB': {
    label: '장문 어휘',
    units: ['underline', 'paragraph', 'choice'],
    relation: '장문 흐름의 방향과 밑줄 낱말 극성의 일치',
    answerDesign: '단락 방향 근거 · 극성 · 수정 전/후',
    lureDesign: '문맥과 맞는 낱말의 성립 이유',
    choiceTruth: true,
    visual: false,
    passageDesign: false,
    pitfalls: [],
  },
  'R-REFER': {
    label: '지칭',
    units: ['underline', 'sentence', 'choice'],
    relation: '등장 대상 · 행위자 · 소유자를 따라 각 대명사가 누구에 연결되는가',
    answerDesign: '대상 목록 · 각 밑줄의 연결 근거 · 다른 하나가 가리키는 대상',
    lureDesign: '가까운 명사에 붙이기 · 화자 시점 혼동',
    choiceTruth: false,
    visual: false,
    passageDesign: false,
    pitfalls: ['「가장 가까운 명사」 — 행위 주체 일관성이 우선하는 경우'],
  },
  'X-REFER': {
    label: '장문 지칭',
    units: ['underline', 'paragraph', 'choice'],
    relation: '단락을 넘는 인물 · 행위자 연결',
    answerDesign: '인물 목록 · 단락별 행위자 · 다른 하나',
    lureDesign: '단락 전환 뒤 대상 착각',
    choiceTruth: false,
    visual: false,
    passageDesign: false,
    pitfalls: [],
  },
  'R-ORDER': {
    label: '글의 순서',
    units: ['paragraph', 'choice'],
    relation: '각 단락이 앞에 요구하는 선행 조건(지시어 · 연결어 · 관사 · 시제)의 사슬',
    answerDesign: '단락별 머리 단서 → 앞 단락 꼬리와의 연결 · 후보 순열 배제',
    lureDesign: '한 연결만 맞는 순열 · 내용상 그럴듯한 시간 순',
    choiceTruth: false,
    visual: false,
    passageDesign: false,
    pitfalls: ['「연결어만 보면 된다」 — 관사 · 지시 대상이 결정하는 문항이 있다'],
  },
  'X-ORDER': {
    label: '장문 순서',
    units: ['paragraph', 'choice'],
    relation: '이야기 단락의 사건 · 인물 · 시점 사슬',
    answerDesign: '단락별 사건 선후 · 인물 등장 조건',
    lureDesign: '시간 표현만 맞는 순열',
    choiceTruth: false,
    visual: false,
    passageDesign: false,
    pitfalls: [],
  },
  'R-INSERT': {
    label: '문장 삽입',
    units: ['sentence', 'choice'],
    relation: '삽입문이 앞 · 뒤에 요구하는 조건과 그 자리 양쪽의 연결',
    answerDesign: '삽입문의 앞 조건 · 뒤 조건 · 해당 위치의 끊긴 연결',
    lureDesign: '한쪽 연결만 맞는 자리 · 내용상 비슷한 자리',
    choiceTruth: false,
    visual: false,
    passageDesign: false,
    pitfalls: ['「주어진 문장 바로 다음이 근거」 — 앞 문장이 결정하는 경우가 있다'],
  },
  'R-IRRELEVANT': {
    label: '무관한 문장',
    units: ['sentence', 'choice'],
    relation: '유지되는 논리 사슬과, 한 문장이 그 사슬의 관계를 바꾸는 지점',
    answerDesign: '화제 · 사슬 요약 · 무관 문장이 바꾼 관계 · 제거 전/후 흐름',
    lureDesign: '소재는 다르지만 사슬을 잇는 문장 · 같은 소재의 무관 문장',
    choiceTruth: false,
    visual: false,
    passageDesign: true,
    pitfalls: ['「소재가 다르면 무관」 — 같은 낱말을 쓰며 관계만 바꾸는 문장이 답이다'],
  },
  'R-SUMMARY': {
    label: '요약문',
    units: ['summary_slot', 'sentence', 'choice'],
    relation: '원문 명제의 성분이 요약문 각 칸(의미 · 극성 · 한정)으로 어떻게 압축되는가',
    answerDesign: '칸마다 대응 원문 명제 · 극성 · 한정어',
    lureDesign: '한 칸만 맞음 · 극성 반대 · 지문 낱말 그대로',
    choiceTruth: false,
    visual: false,
    passageDesign: true,
    pitfalls: [],
  },
  'R-NOTICE': {
    label: '안내문 일치',
    units: ['notice_item', 'choice'],
    relation: '선지 항목과 안내문 항목의 주체 · 행동 · 수치 · 시점 · 허용/금지 조건 대조',
    answerDesign: '어긋난 항목과 바뀐 성분',
    lureDesign: '맞는 선지의 대응 항목(선지 내용은 참)',
    choiceTruth: true,
    visual: false,
    passageDesign: false,
    pitfalls: ['「숫자만 대조」 — 대상 · 조건(예약 필수 · 무료 대상)이 바뀐 선지'],
  },
  'R-FACT': {
    label: '내용 일치',
    units: ['sentence', 'choice'],
    relation: '선지 진술과 지문 진술의 성분별 대조(주체 · 행동 · 시점 · 수치)',
    answerDesign: '불일치 선지의 바뀐 성분 · 대응 문장',
    lureDesign: '맞는 선지의 대응 문장(선지 내용은 참)',
    choiceTruth: true,
    visual: false,
    passageDesign: false,
    pitfalls: [],
  },
  'X-FACT': {
    label: '장문 내용 일치',
    units: ['paragraph', 'sentence', 'choice'],
    relation: '이야기 단락의 사실과 선지 진술의 성분별 대조',
    answerDesign: '불일치 선지의 바뀐 성분 · 대응 위치',
    lureDesign: '맞는 선지의 대응 위치',
    choiceTruth: true,
    visual: false,
    passageDesign: false,
    pitfalls: [],
  },
  'R-CHART': {
    label: '도표',
    units: ['chart_series', 'table_cell', 'choice'],
    relation: '선지의 비교 · 배수 · 순위 · 전칭 조건을 실제 도표의 범주 · 단위 · 값으로 계산해 대조',
    answerDesign: '어긋난 선지의 조건과 해당 범주 · 값(원본 시각 확인 시에만 수치 확정)',
    lureDesign: '맞는 선지의 계산 과정 — 값은 원본 확인 시에만',
    choiceTruth: true,
    visual: true,
    passageDesign: false,
    pitfalls: ['정답표로 그래프 값을 역추정하지 않는다', '「배수」 · 「차이」 · 「퍼센트포인트」 구분 없이 계산'],
  },
}

export function teachingModelOf(typeId: string | null | undefined): TeachingModel | null {
  return typeId ? (TEACHING_MODELS[typeId] ?? null) : null
}

const POSITIVE_STEM = new Set<string>(choicePolarity.positive)

/**
 * 정답 아닌 선지가 **내용이 맞는** 진술인가 — choiceTruth 유형이면서 발문이 부정형(「일치하지 않는 것은?」)일 때만.
 * 긍정형 발문(「일치하는 것은?」 · 네모 어휘 「가장 적절한 것은?」)은 오답이 틀린 진술이다(2026-10-11 실측 155문항).
 * 발문은 학습자 쪽에 숨겨 두므로 구운 id 목록(`choice-polarity.json`)으로 가른다 — 드레인 validate 와 같은 규칙.
 */
export function distractorsAreTrue(typeId: string | null | undefined, itemId: string | null | undefined): boolean {
  return teachingModelOf(typeId)?.choiceTruth === true && !(itemId && POSITIVE_STEM.has(itemId))
}

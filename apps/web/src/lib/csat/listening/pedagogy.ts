// apps/web/src/lib/csat/listening/pedagogy.ts
// 수능·모평 듣기 18개 유형별 교수 설계 정본(설명: docs/csat-listening/PEDAGOGY.md).
// 유형 id 는 scripts/csat/data/listening/*.json 의 typeGuess 와 같다.
// L-RESPONSE 만 번호로 나눈다(1·2번 = SHORT, 13·14번 = LONG).
// 상호작용은 화면 상태만 바꾸며 채점·이해도 판정·자유서술 평가를 하지 않는다.

export const LISTENING_TYPE_IDS = [
  'L-RESPONSE-SHORT',
  'L-RESPONSE-LONG',
  'L-PURPOSE',
  'L-OPINION',
  'L-MAIN',
  'L-TOPIC',
  'L-RELATION',
  'L-PICTURE',
  'L-TODO',
  'L-FAVOR',
  'L-REASON',
  'L-MONEY',
  'L-NOTMENTION',
  'L-ANNOUNCE',
  'L-TABLE',
  'L-SITUATION',
  'L-SET-TOPIC',
  'L-SET-NOT',
] as const;

export type ListeningPedagogyTypeId = (typeof LISTENING_TYPE_IDS)[number];

export type JudgmentKind =
  | 'utterance-purpose' // 발화 목적
  | 'speaker-intent' // 화자 의도
  | 'relation-role' // 관계·역할
  | 'request-offer-agree' // 부탁·제안·동의
  | 'number-time-place' // 수치·시간·장소
  | 'whole-gist' // 대화 전체 중심
  | 'adjacent-link' // 앞뒤 발화 연결
  | 'evidence-vs-distractor'; // 근거↔오답 충돌

export type DistractorPattern =
  | 'partial-match'
  | 'role-reversal'
  | 'mentioned-not-asked'
  | 'timing-trap'
  | 'numeric-calc-trap';

export type InteractionMode =
  | 'turn-pair-match' // 마지막 발화와 응답 후보를 짝지어 대조
  | 'turn-chain-rewind' // 앞 발화로 되감아 응답 근거 고리 잇기
  | 'signal-pivot' // 전환 신호(So/make sure) 위치 고르기
  | 'stance-sort' // 화자별 주장 줄 분류
  | 'role-clue-board' // 호칭·업무 단서로 역할 배치
  | 'picture-hotspot' // 그림 영역 ↔ 발화 대조
  | 'task-ledger' // 할 일 목록에서 담당자 이동
  | 'cause-elimination' // 제시된 이유 후보 소거
  | 'price-builder' // 단가·수량·할인 조립
  | 'checklist-strike' // 항목 등장 위치 표시
  | 'claim-line-diff' // 선택지 ↔ 원문 줄 차이 대조
  | 'table-filter' // 조건 순서대로 표 행 걸러내기
  | 'situation-frame' // 상황 단계 → 말할 의도 선택
  | 'structure-map'; // 담화 구조(열거) 도식

export interface ListeningPedagogy {
  /** 실제로 재는 듣기 인지 기능 */
  skill: string;
  /** 학습자가 내려야 하는 판단 */
  judgmentTask: string;
  /** 지배적인 판단 종류(앞이 더 지배적) */
  judgmentKinds: JudgmentKind[];
  distractorPatterns: DistractorPattern[];
  interaction: {
    mode: InteractionMode;
    prompt: string;
    learnerAction: string;
  };
  /** 근거 문항(회차#번호) */
  refs: string[];
}

export const LISTENING_PEDAGOGY: Record<ListeningPedagogyTypeId, ListeningPedagogy> = {
  'L-RESPONSE-SHORT': {
    skill: '직전 한 발화의 화행(제안·질문·사과) 즉시 인식',
    judgmentTask: '마지막 발화가 무엇을 요구하는지 보고 그에 맞는 응답 화행 고르기',
    judgmentKinds: ['adjacent-link', 'request-offer-agree'],
    distractorPatterns: ['partial-match', 'role-reversal'],
    interaction: {
      mode: 'turn-pair-match',
      prompt: '마지막 말은 어떤 요청인가요? 그 요청에 답하는 응답만 이어 보세요.',
      learnerAction: '마지막 발화의 화행 꼬리표(제안/질문/사과)를 고르고, 응답 후보를 그 꼬리표에 끌어 붙여 맞지 않는 짝을 대조한다',
    },
    refs: ['2017#1', '2017#2'],
  },
  'L-RESPONSE-LONG': {
    skill: '여러 차례 오간 대화의 흐름을 유지해 마지막 발화에 이어 말하기',
    judgmentTask: '마지막 발화 + 앞선 맥락(문제·조건)을 모두 만족하는 응답 고르기',
    judgmentKinds: ['adjacent-link', 'whole-gist', 'evidence-vs-distractor'],
    distractorPatterns: ['partial-match', 'mentioned-not-asked'],
    interaction: {
      mode: 'turn-chain-rewind',
      prompt: '이 응답이 맞으려면 앞의 어느 말과 이어져야 하나요?',
      learnerAction: '응답 후보를 고르면 그 후보가 기대는 앞 발화를 직접 짚고, 짚은 줄이 없거나 어긋나는 후보를 비교한다',
    },
    refs: ['2023#11', '2017#13'],
  },
  'L-PURPOSE': {
    skill: '담화의 서두(배경)와 행동 촉구 구간 구별',
    judgmentTask: '세부 정보가 아니라 화자가 청자에게 시키려는 행동 판별',
    judgmentKinds: ['utterance-purpose', 'speaker-intent', 'whole-gist'],
    distractorPatterns: ['mentioned-not-asked', 'partial-match'],
    interaction: {
      mode: 'signal-pivot',
      prompt: '배경 설명이 끝나고 "해 달라"가 시작되는 줄은 어디인가요?',
      learnerAction: '대본 줄 사이의 전환점을 하나 고르고, 그 앞(배경)과 뒤(요청)에서 각각 선택지가 어느 쪽 내용인지 나눈다',
    },
    refs: ['2023#1'],
  },
  'L-OPINION': {
    skill: '두 화자 중 지정 화자의 주장과 근거를 추적',
    judgmentTask: '지정 화자가 반복·강조하는 주장 판별(상대 화자 말과 분리)',
    judgmentKinds: ['speaker-intent', 'whole-gist', 'evidence-vs-distractor'],
    distractorPatterns: ['role-reversal', 'partial-match'],
    interaction: {
      mode: 'stance-sort',
      prompt: '이 줄은 누구의 주장인가요? 주장인가요, 근거인가요?',
      learnerAction: '대본 줄을 화자별 두 칸·주장/근거 두 층으로 분류하고, 지정 화자 주장 칸에 모인 줄과 선택지를 대조한다',
    },
    refs: ['2023#2', '2017#4'],
  },
  'L-MAIN': {
    skill: '독백에서 사례·예시를 넘어 일반화된 요지 추출',
    judgmentTask: '예시(캠핑·원예 등)가 아닌 그 예시들이 받치는 주장 고르기',
    judgmentKinds: ['whole-gist', 'utterance-purpose'],
    distractorPatterns: ['partial-match', 'mentioned-not-asked'],
    interaction: {
      mode: 'structure-map',
      prompt: '예시들은 어느 문장을 받치고 있나요?',
      learnerAction: '예시 줄들을 하나의 상위 문장 아래로 연결하고, 하나의 예시만 다루는 선택지가 상위 문장과 어떻게 다른지 본다',
    },
    refs: ['M2406#3', 'M2409#3'],
  },
  'L-TOPIC': {
    skill: '대화 전체가 맴도는 화제 묶기',
    judgmentTask: '두 화자가 나눈 장점·사례를 포괄하는 화제 고르기',
    judgmentKinds: ['whole-gist', 'evidence-vs-distractor'],
    distractorPatterns: ['partial-match', 'mentioned-not-asked'],
    interaction: {
      mode: 'structure-map',
      prompt: '대화에 나온 장점들을 모두 덮는 말은 무엇인가요?',
      learnerAction: '대화에서 나온 하위 항목(비용·공간·환경)을 화제 후보 위에 올려 다 덮는 후보와 일부만 덮는 후보를 비교한다',
    },
    refs: ['M1909#4'],
  },
  'L-RELATION': {
    skill: '호칭·업무 어휘·요청 방향으로 두 사람의 역할 추론',
    judgmentTask: '각 화자의 직업·역할을 단서 조합으로 결정(누가 누구에게)',
    judgmentKinds: ['relation-role', 'evidence-vs-distractor'],
    distractorPatterns: ['role-reversal', 'partial-match'],
    interaction: {
      mode: 'role-clue-board',
      prompt: '이 단서는 어느 사람의 역할을 알려 주나요?',
      learnerAction: '단서 구절을 화자 A/B 칸에 배치하면 남는 역할 쌍만 열리고, 역할이 뒤바뀐 쌍과 대조한다',
    },
    refs: ['2023#3'],
  },
  'L-PICTURE': {
    skill: '공간·속성(무늬·위치·개수) 묘사를 시각 정보와 대응',
    judgmentTask: '그림 요소 다섯 중 발화와 어긋나는 하나 찾기',
    judgmentKinds: ['number-time-place', 'evidence-vs-distractor'],
    distractorPatterns: ['partial-match', 'numeric-calc-trap'],
    interaction: {
      mode: 'picture-hotspot',
      prompt: '이 말은 그림의 어디를 말하나요? 무엇이 다른가요?',
      learnerAction: '발화를 들으며 그림 영역을 하나씩 눌러 짝을 짓고, 속성(무늬·개수·위치) 하나가 다른 영역을 표시한다',
    },
    refs: ['2023#4'],
  },
  'L-TODO': {
    skill: '여러 할 일 중 담당자와 시점이 확정된 것 추적',
    judgmentTask: '이미 끝난 일·상대가 맡은 일을 지우고 지정 화자가 할 일 고르기',
    judgmentKinds: ['request-offer-agree', 'adjacent-link', 'number-time-place'],
    distractorPatterns: ['role-reversal', 'timing-trap', 'mentioned-not-asked'],
    interaction: {
      mode: 'task-ledger',
      prompt: '이 일은 이미 끝났나요, 누가 하기로 했나요?',
      learnerAction: '대화 속 할 일 카드를 「완료 / 남자 / 여자」 세 칸으로 옮기고, 지정 화자 칸에 남은 카드를 확인한다',
    },
    refs: ['2023#5', '2018#7'],
  },
  'L-FAVOR': {
    skill: '제안 거절과 실제 부탁 구별',
    judgmentTask: '상대의 호의 제안이 아니라 화자가 최종적으로 부탁한 일 고르기',
    judgmentKinds: ['request-offer-agree', 'adjacent-link', 'relation-role'],
    distractorPatterns: ['role-reversal', 'mentioned-not-asked'],
    interaction: {
      mode: 'task-ledger',
      prompt: '누가 누구에게 무엇을 제안·부탁했고, 받아들여졌나요?',
      learnerAction: '제안/부탁 발화마다 방향 화살표(누가→누구)와 수락·거절을 표시하고, 수락된 부탁만 남긴다',
    },
    refs: ['2019#7'],
  },
  'L-REASON': {
    skill: '상대의 추측을 부정하며 진짜 이유가 나오는 구간 포착',
    judgmentTask: '대화에 나온 이유 후보를 하나씩 소거해 실제 이유 고르기',
    judgmentKinds: ['evidence-vs-distractor', 'adjacent-link'],
    distractorPatterns: ['mentioned-not-asked', 'timing-trap'],
    interaction: {
      mode: 'cause-elimination',
      prompt: '이 이유는 대화에서 인정됐나요, 부정됐나요?',
      learnerAction: '상대가 추측한 이유 카드마다 부정 발화를 짚어 지우고(No / Actually), 마지막 남은 이유의 근거 줄을 연결한다',
    },
    refs: ['2023#7', '2017#8'],
  },
  'L-MONEY': {
    skill: '단가·수량·할인 정보를 들으며 계산식 구성',
    judgmentTask: '최종 확정된 품목·수량으로 금액 계산(취소·변경 반영)',
    judgmentKinds: ['number-time-place', 'adjacent-link'],
    distractorPatterns: ['numeric-calc-trap', 'timing-trap'],
    interaction: {
      mode: 'price-builder',
      prompt: '이 숫자는 단가인가요, 수량인가요, 할인인가요?',
      learnerAction: '들은 숫자를 단가·수량·할인 칸에 끼워 계산식을 조립하고, 할인 누락·바뀐 수량 식과 결과를 나란히 비교한다',
    },
    refs: ['2023#6', '2017#9'],
  },
  'L-NOTMENTION': {
    skill: '대화에서 언급된 항목을 목록과 대조하며 추적',
    judgmentTask: '선택지 다섯 중 대화에 등장하지 않은 항목 찾기',
    judgmentKinds: ['number-time-place', 'evidence-vs-distractor'],
    distractorPatterns: ['mentioned-not-asked', 'partial-match'],
    interaction: {
      mode: 'checklist-strike',
      prompt: '이 항목은 대화의 어느 줄에 나왔나요?',
      learnerAction: '선택지 항목을 근거 줄에 하나씩 연결해 지우고, 연결 줄이 없는 항목만 남는 것을 확인한다',
    },
    refs: ['2023#8', '2017#10'],
  },
  'L-ANNOUNCE': {
    skill: '안내문 독백의 세부(일정·방법·조건) 정확 대조',
    judgmentTask: '선택지 진술과 원문의 차이(only·첫날·온라인만 등 한정어) 찾기',
    judgmentKinds: ['number-time-place', 'evidence-vs-distractor'],
    distractorPatterns: ['partial-match', 'numeric-calc-trap', 'timing-trap'],
    interaction: {
      mode: 'claim-line-diff',
      prompt: '선택지와 원문 줄 중 바뀐 낱말은 무엇인가요?',
      learnerAction: '선택지마다 원문 줄을 고르면 두 줄이 나란히 놓이고, 다른 한정어(날짜·only·방법)를 직접 표시한다',
    },
    refs: ['2023#9', '2017#11'],
  },
  'L-TABLE': {
    skill: '조건을 순서대로 적용해 후보를 좁히는 듣기',
    judgmentTask: '예산·재질·길이·부가 기능 조건을 차례로 걸러 하나 고르기',
    judgmentKinds: ['number-time-place', 'request-offer-agree', 'adjacent-link'],
    distractorPatterns: ['numeric-calc-trap', 'partial-match', 'timing-trap'],
    interaction: {
      mode: 'table-filter',
      prompt: '이 말은 표의 어느 열 조건인가요? 몇 행이 남나요?',
      learnerAction: '들은 조건을 표 열에 걸어 행을 흐리게 지우고, 조건 순서를 바꾸거나 하나를 빼면 남는 행이 어떻게 달라지는지 본다',
    },
    refs: ['2023#10', '2017#12'],
  },
  'L-SITUATION': {
    skill: '3인칭 상황 서술에서 화자의 의도 단계 추출',
    judgmentTask: '상황 끝의 "wants to suggest/ask" 의도에 맞는 한 마디 고르기',
    judgmentKinds: ['speaker-intent', 'utterance-purpose', 'whole-gist'],
    distractorPatterns: ['partial-match', 'role-reversal', 'timing-trap'],
    interaction: {
      mode: 'situation-frame',
      prompt: '상황 → 문제 → 말할 사람의 의도, 의도는 무엇인가요?',
      learnerAction: '서술 문장을 상황/문제/의도 세 칸에 놓고, 의도 칸 문장과 각 선택지를 맞대어 의도가 다른 말(위로·거절 등)을 가린다',
    },
    refs: ['2023#15', '2017#15'],
  },
  'L-SET-TOPIC': {
    skill: '긴 강의의 도입부 주제 선언과 열거 구조 파악',
    judgmentTask: '열거 항목 전체를 포괄하는 주제 고르기',
    judgmentKinds: ['whole-gist', 'utterance-purpose'],
    distractorPatterns: ['partial-match', 'mentioned-not-asked'],
    interaction: {
      mode: 'structure-map',
      prompt: '"First / Second / Next" 항목들은 무엇의 예인가요?',
      learnerAction: '열거 신호 줄을 가지로 펼쳐 도식을 만들고, 가지 하나만 덮는 주제 후보와 전체를 덮는 후보를 비교한다',
    },
    refs: ['2023#16', '2017#16'],
  },
  'L-SET-NOT': {
    skill: '같은 강의에서 열거된 개체를 빠짐없이 추적',
    judgmentTask: '선택지 개체 중 강의에 나오지 않은 것 찾기',
    judgmentKinds: ['evidence-vs-distractor', 'number-time-place'],
    distractorPatterns: ['mentioned-not-asked', 'partial-match'],
    interaction: {
      mode: 'checklist-strike',
      prompt: '이 개체는 열거의 몇 번째 가지에 있었나요?',
      learnerAction: 'SET-TOPIC 도식의 가지에 선택지 개체를 끼워 넣고, 들어갈 가지가 없는 개체를 남긴다',
    },
    refs: ['2023#17', '2017#17'],
  },
};

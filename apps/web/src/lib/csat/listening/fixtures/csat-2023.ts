// apps/web/src/lib/csat/listening/fixtures/csat-2023.ts
//
// 2023 수능 듣기 7번(L-REASON) · 10번(L-TABLE) 근거 추적 픽스처.
// - 발화: `scripts/csat/data/listening/2023.json` 턴을 글자 그대로 옮겼다(테스트가 원본과 대조한다). 전사 검수는 NOT_VERIFIED.
// - 정답 번호: `scripts/csat/data/answers.json`(readiness.json items[].answer) — 홀수형, 형별 결속 UNVERIFIED.
// - 선지 문구 · 표 행: 어느 검증된 출처에도 없다 → 선지 층 BLOCKED_EVIDENCE.
//   7번 이유 카드는 대본에서 나온 이유 후보(선지 아님), 10번 표 행은 「테스트용 합성 자료」(조건 적용 연습용 재구성).
// - 음원: 공식 음원 없음 → kind 'none'.

import { LISTENING_PEDAGOGY } from '../pedagogy'
import { spanOf, utterancesFromTurns, type RawTurn } from './build'
import type { ListeningTraceFixture } from './types'

const SPEAKER_LABELS = { W: '여자', M: '남자' } as const

const NO_AUDIO = { kind: 'none', rights: 'unverified' } as const

const BLOCKED = {
  status: 'BLOCKED_EVIDENCE',
  reason: '선지 문구가 로컬 자료·DB 어디에도 없다(readiness.json choices DATA_GAP). 공식 선지를 지어내지 않는다.',
} as const

export const TURNS_2023_L07: readonly RawTurn[] = [
  { who: 'W', text: 'Sam, do you want to go to the K-Trend Festival with me this Saturday?' },
  { who: 'M', text: 'Hi, Olivia. Is that the festival held at Central Square?' },
  { who: 'W', text: 'Yeah, that’s it. There’ll be many attractions including Taekwondo performances that incorporate K-pop dance moves.' },
  { who: 'M', text: 'Really? Sounds cool! What time does it start?' },
  { who: 'W', text: 'It starts at 5 p.m. Will you be working at the movie theater at that time?' },
  { who: 'M', text: 'No, I’m not working this Saturday. But I can’t come to the festival.' },
  { who: 'W', text: 'Too bad. Do you have to study for your economics exam?' },
  { who: 'M', text: 'Actually, I already took the exam yesterday.' },
  { who: 'W', text: 'Then, what’s the matter?' },
  { who: 'M', text: 'I have to take my younger sister to the airport on Saturday evening.' },
  { who: 'W', text: 'Where’s she going?' },
  { who: 'M', text: 'She’s going to Canada to study abroad.' },
  { who: 'W', text: 'That’s awesome. I hope she has a good experience there.' },
]

export const TURNS_2023_L10: readonly RawTurn[] = [
  { who: 'M', text: 'Welcome to Uptown Music Shop. How can I help you?' },
  { who: 'W', text: 'Hi, I’m looking for a hard cello case.' },
  { who: 'M', text: 'All right. Here’s our catalog. These are the ones we have in stock. How much are you willing to spend?' },
  { who: 'W', text: 'I can spend up to $200.' },
  { who: 'M', text: 'Okay. How about the interior material? Do you have a preference?' },
  { who: 'W', text: 'Well, I don’t want the velvet one. It seems difficult to take care of.' },
  { who: 'M', text: 'Right. Then how about the length?' },
  { who: 'W', text: 'I have a full-size cello, so I want a case that’s at least 50 inches long.' },
  { who: 'M', text: 'Now you have two options left. Do you need wheels on your case?' },
  { who: 'W', text: 'No, I don’t need them. I won’t carry it around a lot.' },
  { who: 'M', text: 'Then this is the one for you.' },
  { who: 'W', text: 'Thank you. I’ll take it.' },
]

function build07(): ListeningTraceFixture {
  const u = utterancesFromTurns('2023-L07', TURNS_2023_L07)
  const ev = [
    spanOf(u, 'e-guess-work', '2023-L07-u5', 'Will you be working at the movie theater at that time?', 'contrast'),
    spanOf(u, 'e-deny-work', '2023-L07-u6', 'No, I’m not working this Saturday.', 'supporting'),
    spanOf(u, 'e-cant', '2023-L07-u6', 'But I can’t come to the festival.', 'supporting'),
    spanOf(u, 'e-guess-exam', '2023-L07-u7', 'Do you have to study for your economics exam?', 'contrast'),
    spanOf(u, 'e-deny-exam', '2023-L07-u8', 'Actually, I already took the exam yesterday.', 'supporting'),
    spanOf(u, 'e-real', '2023-L07-u10', 'I have to take my younger sister to the airport on Saturday evening.', 'decisive'),
    spanOf(u, 'e-canada', '2023-L07-u12', 'She’s going to Canada to study abroad.', 'contrast'),
  ]
  return {
    key: '2023-L07',
    examId: '2023',
    itemNo: 7,
    typeId: 'L-REASON',
    stem: '대화를 듣고, 남자가 K-Trend Festival에 갈 수 없는 이유를 고르시오.',
    speakers: ['W', 'M'],
    speakerLabels: SPEAKER_LABELS,
    utterances: u,
    evidence: ev,
    audio: NO_AUDIO,
    provenance: {
      transcriptSource: 'local-json:scripts/csat/data/listening/2023.json',
      sha256: '1ebdf7891799f9758547efdea8c1c19767ab6434f5245df6f17126a513766c80',
      reviewStatus: 'draft',
    },
    readiness: 'local-fixture',
    transcriptReview: 'NOT_VERIFIED',
    mode: 'cause-elimination',
    prompt: LISTENING_PEDAGOGY['L-REASON'].interaction.prompt,
    candidatesSource: 'transcript-derived',
    candidates: [
      {
        id: 'work',
        label: '영화관 아르바이트',
        expected: 'eliminated',
        keyUtteranceIds: ['2023-L07-u6'],
        evidenceIds: ['e-guess-work', 'e-deny-work'],
        note: '여자의 추측(5번 발화)을 남자가 「No, I’m not working」으로 부정한다.',
      },
      {
        id: 'exam',
        label: '경제학 시험 공부',
        expected: 'eliminated',
        keyUtteranceIds: ['2023-L07-u8'],
        evidenceIds: ['e-guess-exam', 'e-deny-exam'],
        note: '두 번째 추측(7번 발화)을 「Actually, I already took the exam」으로 부정한다.',
      },
      {
        id: 'sister',
        label: '여동생 공항 배웅',
        expected: 'remaining',
        keyUtteranceIds: ['2023-L07-u10'],
        evidenceIds: ['e-real'],
        note: '「Then, what’s the matter?」 바로 뒤 10번 발화가 진짜 이유다.',
      },
      {
        id: 'canada',
        label: '캐나다 유학 준비',
        expected: 'eliminated',
        keyUtteranceIds: ['2023-L07-u12'],
        evidenceIds: ['e-canada'],
        note: '유학을 가는 사람은 여동생이다 — 언급됐지만 남자가 못 가는 이유가 아니다.',
      },
    ],
    choiceLayer: BLOCKED,
    officialAnswer: { choice: 5, form: '홀수', formBinding: 'UNVERIFIED', source: 'scripts/csat/data/answers.json' },
  }
}

function build10(): ListeningTraceFixture {
  const u = utterancesFromTurns('2023-L10', TURNS_2023_L10)
  const ev = [
    spanOf(u, 'e-price', '2023-L10-u4', 'I can spend up to $200.', 'decisive'),
    spanOf(u, 'e-velvet', '2023-L10-u6', 'I don’t want the velvet one.', 'decisive'),
    spanOf(u, 'e-length', '2023-L10-u8', 'at least 50 inches long', 'decisive'),
    spanOf(u, 'e-two-left', '2023-L10-u9', 'Now you have two options left.', 'supporting'),
    spanOf(u, 'e-wheels', '2023-L10-u10', 'No, I don’t need them.', 'decisive'),
  ]
  return {
    key: '2023-L10',
    examId: '2023',
    itemNo: 10,
    typeId: 'L-TABLE',
    stem: '다음 표를 보면서 대화를 듣고, 여자가 구매할 첼로 케이스를 고르시오.',
    speakers: ['M', 'W'],
    speakerLabels: SPEAKER_LABELS,
    utterances: u,
    evidence: ev,
    audio: NO_AUDIO,
    provenance: {
      transcriptSource: 'local-json:scripts/csat/data/listening/2023.json',
      sha256: '31c6f5558becaf8a0d8e493601f1e54f0f33c7ce241fbff2cb2ff0443adb7735',
      reviewStatus: 'draft',
    },
    readiness: 'local-fixture',
    transcriptReview: 'NOT_VERIFIED',
    mode: 'table-filter',
    prompt: LISTENING_PEDAGOGY['L-TABLE'].interaction.prompt,
    // 공식 표는 어디에도 없다. 아래 행은 조건 적용을 연습하려고 대본 조건에 맞춰 만든 재구성이다(공식 선지 아님).
    candidatesSource: 'synthetic-reconstruction',
    candidateColumns: ['가격', '내부 재질', '길이', '바퀴'],
    candidates: [
      { id: 'A', label: '행 A', cells: ['$180', '벨벳', '52인치', '있음'], expected: 'eliminated', keyUtteranceIds: ['2023-L10-u6'], evidenceIds: ['e-velvet'], note: '벨벳은 원하지 않는다(6번 발화).' },
      { id: 'B', label: '행 B', cells: ['$230', '폴리에스터', '51인치', '없음'], expected: 'eliminated', keyUtteranceIds: ['2023-L10-u4'], evidenceIds: ['e-price'], note: '예산 $200 초과(4번 발화).' },
      { id: 'C', label: '행 C', cells: ['$160', '나일론', '48인치', '없음'], expected: 'eliminated', keyUtteranceIds: ['2023-L10-u8'], evidenceIds: ['e-length'], note: '50인치 미만(8번 발화).' },
      { id: 'D', label: '행 D', cells: ['$190', '폴리에스터', '50인치', '있음'], expected: 'eliminated', keyUtteranceIds: ['2023-L10-u10'], evidenceIds: ['e-wheels'], note: '바퀴가 필요 없다(10번 발화). 9번 「두 개 남았다」 시점에는 D·E 가 남는다.' },
      { id: 'E', label: '행 E', cells: ['$170', '나일론', '53인치', '없음'], expected: 'remaining', keyUtteranceIds: ['2023-L10-u10'], evidenceIds: ['e-price', 'e-velvet', 'e-length', 'e-wheels'], note: '네 조건을 모두 통과하고 마지막 바퀴 조건(10번 발화)으로 확정된다.' },
    ],
    choiceLayer: BLOCKED,
    officialAnswer: { choice: 1, form: '홀수', formBinding: 'UNVERIFIED', source: 'scripts/csat/data/answers.json' },
  }
}

export const FIXTURE_2023_L07 = build07()
export const FIXTURE_2023_L10 = build10()

// apps/web/src/components/game/scriptquiz/mock-data.ts
// 영어 immersion 기본 + 한국어 번역 fallback (showKorean 토글 시 노출)
// Phase 2에서 OpenAI 기반 생성으로 교체

import type { QuizSession } from './types'

export const MOCK_SESSION: QuizSession = {
  textTitle: 'The Great Gatsby',
  textChapter: 'Chapter 1',
  questions: [
    {
      id: 'q1',
      type: 'multiple',
      question:
        'What is the central piece of advice the narrator received from his father?',
      questionKo: '화자(Nick Carraway)가 아버지로부터 받은 조언의 핵심은?',
      options: [
        {
          text: 'Try to understand others before judging them',
          textKo: '비판하기 전에 상대방의 처지를 헤아려라',
        },
        {
          text: 'Always work hard at everything you do',
          textKo: '항상 최선을 다해 노력하라',
        },
        { text: 'Manage your money wisely', textKo: '돈을 잘 관리하라' },
        { text: 'Choose your friends carefully', textKo: '친구를 신중하게 사귀어라' },
      ],
      correctIndex: 0,
      sourceSnippet:
        '“Whenever you feel like criticizing any one,” he told me, “just remember that all the people in this world haven’t had the advantages that you’ve had.”',
    },
    {
      id: 'q2',
      type: 'multiple',
      question: 'Which word does Nick use to describe himself?',
      questionKo: 'Nick이 자신을 묘사할 때 사용한 단어는?',
      options: [
        { text: 'Reserved', textKo: '내성적인 / 신중한' },
        { text: 'Outgoing', textKo: '외향적인' },
        { text: 'Aggressive', textKo: '공격적인' },
        { text: 'Indifferent', textKo: '무관심한' },
      ],
      correctIndex: 0,
      sourceSnippet:
        'In consequence, I’m inclined to reserve all judgments, a habit that has opened up many curious natures to me...',
    },
    {
      id: 'q3',
      type: 'truefalse',
      question: 'Nick believes that everyone in life starts with equal advantages.',
      questionKo: 'Nick은 모든 사람이 동등한 조건에서 출발한다고 생각한다.',
      options: [
        { text: 'True', textKo: '참' },
        { text: 'False', textKo: '거짓' },
      ],
      correctIndex: 1,
      sourceSnippet:
        '“...all the people in this world haven’t had the advantages that you’ve had.”',
    },
    {
      id: 'q4',
      type: 'multiple',
      question:
        'In the line "we’ve always been unusually communicative in a reserved way," who does Nick refer to?',
      questionKo: 'Nick이 "unusually communicative in a reserved way"라고 말한 대상은?',
      options: [
        { text: 'Himself and his family', textKo: '본인과 가족' },
        { text: 'Himself and his friends', textKo: '본인과 친구들' },
        { text: 'Himself and his colleagues', textKo: '본인과 동료들' },
        { text: 'Himself and his neighbours', textKo: '본인과 이웃들' },
      ],
      correctIndex: 0,
      sourceSnippet:
        '...we’ve always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that.',
    },
    {
      id: 'q5',
      type: 'multiple',
      question:
        'In the context of the text, the word "unmistakable" most closely means:',
      questionKo: '본문에서 "unmistakable"의 문맥상 의미로 가장 적절한 것은?',
      options: [
        { text: 'Clear and impossible to confuse', textKo: '오해의 여지가 없는, 분명한' },
        { text: 'Full of mistakes', textKo: '실수투성이의' },
        { text: 'Mysterious or unknown', textKo: '신비로운' },
        { text: 'Strange or unfamiliar', textKo: '낯선' },
      ],
      correctIndex: 0,
      sourceSnippet: 'There was something unmistakable about the way he held himself...',
    },
  ],
}

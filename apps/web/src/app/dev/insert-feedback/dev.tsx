// apps/web/src/app/dev/insert-feedback/dev.tsx
// 합성 지문 · 합성 문항(실제 자료 아님). 해설 문장은 실제 생성기(explainInsertSeam · explainShortInsertSeam)가 이 지문으로 낸 그대로다.
// 채점은 로컬 — 서버 채점과 같은 모양(맞히면 해설만, 틀리면 정답 키 전체).
'use client'

import { DcpPlayer } from '@/components/practice/DcpPlayer'
import type { DcpGradeResult, DcpItem } from '@/lib/learner/dcp'

const GARDEN = [
  'Mina planted a small garden behind her school last spring.',
  'She chose tomatoes because they grow quickly in warm weather.',
  'Every morning she carried water from the gym to the garden.',
  'By June the plants were taller than the fence around them.',
  'Her classmates began to stop by and ask for advice.',
  'Soon the science teacher asked her to lead a garden club.',
  'Today twenty students take care of the garden together.',
]
const OWLS = ['Owls hunt mostly at night.', 'Their soft feathers make almost no sound in the air.', 'This silence lets them surprise mice and other small animals.']
const GUITAR = ['Tom wanted to learn the guitar.', 'He watched short lessons online every evening.', 'After a month, he could play three simple songs.', 'Now he plays for his family every weekend.']

const insert = (id: string, remaining: string[], sentence: string): DcpItem => ({
  id,
  type: 'insert',
  paragraphIdx: 0,
  payload: { remaining, insert_sentence: sentence, gap_count: remaining.length + 1 },
})

const ITEMS: DcpItem[] = [
  insert('if-garden', GARDEN, 'At first, however, nobody else seemed to notice her work.'),
  insert('if-owls', OWLS, 'Because of this, their prey rarely hears them coming.'),
  insert('if-guitar', GUITAR, 'His fingers hurt at first, but he did not give up.'),
  insert('if-batch', GUITAR, 'His fingers hurt at first, but he did not give up.'),
]
const KEYS: Record<string, { position: number; explanation_ko: string; explanation_writer: string }> = {
  'if-garden': {
    position: 4,
    explanation_writer: 'insert_seam',
    explanation_ko:
      '정답은 ③ 다. 거기 넣으면 "…than the fence around them." → "At first, however, nobody else seemed to…" → "Her classmates began to stop…" 로 이어진다. ① 는 "…her school last spring." 와 "She chose tomatoes…" 사이를 가른다; ② 는 "…the gym to the garden." 와 "By June the plants were…" 사이를 가른다; ④ 는 "…to lead a garden club." 와 "Today twenty students…" 사이를 가른다.',
  },
  'if-owls': {
    position: 3,
    explanation_writer: 'insert_seam',
    explanation_ko:
      '정답은 ③ 다. 글의 끝자리다 — 앞 문장 "… mice and other small animals." 뒤에 놓인다. ① 는 "Owls hunt mostly at night." 와 "Their soft feathers make…" 사이를 가른다; ② 는 "…no sound in the air." 와 "This silence lets them…" 사이를 가른다.',
  },
  'if-guitar': {
    position: 2,
    explanation_writer: 'insert_seam',
    explanation_ko:
      '정답은 ② 다. 거기 넣으면 "… lessons online every evening." → "His fingers hurt at first, but he did not…" → "After a month, he could play…" 로 이어진다. ① 는 "…to learn the guitar." 와 "He watched short lessons…" 사이를 가른다; ③ 는 "…play three simple songs." 와 "Now he plays for his…" 사이를 가른다.',
  },
  // 배치 해설(다른 writer) — 대응을 증명할 수 없어 표시하지 않는다
  'if-batch': { position: 2, explanation_writer: 'batch_llm', explanation_ko: '연습을 꾸준히 했다는 흐름 앞에 손가락이 아팠다는 어려움이 와야 한다(②).' },
}

async function grade(itemId: string, answer: Record<string, unknown>): Promise<DcpGradeResult> {
  const key = KEYS[itemId]
  if (!key) return { ok: false, error: '합성 문항을 찾지 못했어요.' }
  const correct = Number(answer.position) === key.position
  return { ok: true, correct, attemptId: null, answerKey: correct ? { explanation_ko: key.explanation_ko } : { ...key } }
}

export function InsertFeedbackDev() {
  return <DcpPlayer items={ITEMS} backHref="/dev" backCta="개발 목록으로" grade={grade} recordCause={async () => ({ ok: true })} />
}

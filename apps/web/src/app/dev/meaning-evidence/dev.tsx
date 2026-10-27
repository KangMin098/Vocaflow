// apps/web/src/app/dev/meaning-evidence/dev.tsx
// 합성 지문 · 합성 문항(실제 자료 아님). 채점은 로컬 — 서버 채점과 같은 모양(맞히면 해설만, 틀리면 정답 키 전체).
'use client'

import { DcpPlayer } from '@/components/practice/DcpPlayer'
import type { DcpGradeResult, DcpItem } from '@/lib/learner/dcp'

const PASSAGE =
  'Every morning the small town wakes up to the smell of fresh bread. The bakery on the corner has been open for fifty years.\nPeople line up before sunrise because the owner bakes everything by hand. She says the slow way keeps the bread soft and warm.'

const ITEMS: DcpItem[] = [
  { id: 'me-title', type: 'title', paragraphIdx: 0, payload: { passage: PASSAGE, choices: ['A Bakery Loved for Its Slow Bread', 'How to Build a Town', 'Why Mornings Are Cold', 'The History of Corners', 'Fast Food in Small Towns'], stemKo: '글의 제목으로 가장 알맞은 것은?', underline: null, summarySentence: null } },
  { id: 'me-topic', type: 'topic', paragraphIdx: 0, payload: { passage: PASSAGE, choices: ['handmade bread and its loyal customers', 'the weather of small towns', 'opening hours of shops', 'how to sell cakes online', 'city traffic in the morning'], stemKo: '글의 주제로 가장 적절한 것은?', underline: null, summarySentence: null } },
  { id: 'me-blank', type: 'blank', paragraphIdx: 0, payload: { passage: PASSAGE, choices: ['by hand', 'by machine', 'at night', 'for free', 'in cans'], stemKo: '빈칸에 들어갈 말로 가장 적절한 것은?', underline: null, summarySentence: null } },
  { id: 'me-title-noexp', type: 'title', paragraphIdx: 0, payload: { passage: PASSAGE, choices: ['Bread Made the Slow Way', 'A Noisy Factory', 'Lost in the City', 'A Rainy Sunday', 'Shopping Online'], stemKo: '(해설 없는 문항) 글의 제목으로 가장 알맞은 것은?', underline: null, summarySentence: null } },
]
const KEYS: Record<string, { answer: number; explanation_ko?: string }> = {
  'me-title': { answer: 1, explanation_ko: '빵을 손으로 천천히 굽는 가게와 그 빵을 찾는 사람들 이야기가 글 전체에 이어진다.' },
  'me-topic': { answer: 1, explanation_ko: '손으로 구운 빵 때문에 사람들이 해 뜨기 전부터 줄을 선다는 내용이 중심이다.' },
  'me-blank': { answer: 1, explanation_ko: '주인이 모든 것을 손으로 굽는다.' },
  'me-title-noexp': { answer: 1 },
}

async function grade(itemId: string, answer: Record<string, unknown>): Promise<DcpGradeResult> {
  const key = KEYS[itemId]
  if (!key) return { ok: false, error: '합성 문항을 찾지 못했어요.' }
  const correct = Number(answer.choice) === key.answer
  const explanation = key.explanation_ko ? { explanation_ko: key.explanation_ko } : null
  return { ok: true, correct, attemptId: null, answerKey: correct ? explanation : { ...key } }
}

export function MeaningEvidenceDev() {
  return <DcpPlayer items={ITEMS} backHref="/dev" backCta="개발 목록으로" grade={grade} recordCause={async () => ({ ok: true })} />
}

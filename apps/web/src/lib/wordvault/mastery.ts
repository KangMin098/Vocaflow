// apps/web/src/lib/wordvault/mastery.ts
//
// WordVault 학습 단계 분류 — module_history 기반 3그룹.
//
// 근거 (CLAUDE.md §17):
//   - Generation Effect (Slamecka & Graf 1978):
//     생성 인출(SpellForge·Dictation)을 거친 단어 = 강한 부호화
//     → multichannel 그룹 가시화가 자기효능감 강화
//   - Triple Coding (Paivio):
//     시각·청각·운동 3채널 동시 = 장기 기억의 결정적 요인
//   - SDT 유능감:
//     "여러 채널로 익힌 단어" 수치 확인 = 학습 역량 시각화
//
// 분류 규칙 (인지 부하 순서):
//   - unmet         : module_history 비어있음 (아직 만나지 않음 / new)
//   - recognizing   : flashcard 또는 wordblitz 만 있음 (재인 단계)
//   - multichannel  : spellforge 또는 dictation 포함 (생성 인출 도달)

export type MasteryStage = 'unmet' | 'recognizing' | 'multichannel'

export interface MasteryGroup {
  stage: MasteryStage
  count: number
}

export function getMasteryStage(moduleHistory: readonly string[] | undefined | null): MasteryStage {
  const history = moduleHistory ?? []
  const hasGenerative =
    history.includes('spellforge') || history.includes('dictation')
  if (hasGenerative) return 'multichannel'
  const hasRecognition =
    history.includes('flashcard') || history.includes('wordblitz')
  if (hasRecognition) return 'recognizing'
  return 'unmet'
}

export function groupByMastery(
  items: ReadonlyArray<{ moduleHistory?: readonly string[] | null }>,
): MasteryGroup[] {
  const counts: Record<MasteryStage, number> = {
    unmet: 0,
    recognizing: 0,
    multichannel: 0,
  }
  for (const item of items) {
    counts[getMasteryStage(item.moduleHistory)] += 1
  }
  return [
    { stage: 'unmet', count: counts.unmet },
    { stage: 'recognizing', count: counts.recognizing },
    { stage: 'multichannel', count: counts.multichannel },
  ]
}

// apps/web/src/lib/learner/report-note.ts
// 주간 리포트 한 줄 코멘트 — **활동 기록만** 말한다.
//
// ⚠️ 예전 문구는 활동량만 보고 「꾸준함이 기억을 단단하게 만들고 있어요」「이 리듬이 실력이 돼요」라고 했다.
//    daily_activity 는 분·단어·복습 횟수다. 기억이 남았는지·실력이 늘었는지는 재지 않는다 —
//    재지 않은 변화를 단정하면 학습자가 다음 학습을 잘못 고른다(D1 F03 · D5).
//    위로는 남기되, 확인된 것(활동)과 확인하지 않은 것(기억·실력)을 섞지 않는다. 복습 상태(FSRS 추정)도
//    실제 유지의 측정으로 읽히게 쓰지 않는다 — 단어장은 「복습하러 가는 곳」으로만 안내한다(D3 S02 · D6).
//
// 화면은 저장된 empathetic_note 대신 저장된 합계로 이 함수를 다시 부른다 — 과거 행의 과장 문구를
// DB 를 고치지 않고 표시에서 걷어 낸다.

export function composeActivityNote(totalReviews: number, totalMinutes: number, totalWords: number): string {
  const reviews = Math.max(0, Math.round(totalReviews || 0))
  const minutes = Math.max(0, Math.round(totalMinutes || 0))
  const words = Math.max(0, Math.round(totalWords || 0))
  if (reviews === 0 && minutes === 0 && words === 0) {
    return '이번 주에는 기록된 학습 활동이 없어요. 다음 주에 가볍게 다시 시작해요.'
  }
  const parts = [minutes > 0 ? `${minutes}분` : null, words > 0 ? `단어 ${words}개` : null, reviews > 0 ? `복습 ${reviews}번` : null]
    .filter(Boolean)
    .join(' · ')
  return `이번 주 기록: ${parts}. 활동을 센 기록이라 기억·실력이 달라졌는지는 알 수 없어요. 이어서 복습하려면 단어장으로 가요.`
}

// apps/web/src/components/library/story/StoryGuidance.tsx
//
// 시작 전 선택 안내(D2 U1) — 발행본 자리의 편집 목표에서 온 부담 등급 한 줄 + 검수된 주의 문장(접힌 <details>).
// - 주의 문장은 저장값 그대로 · 순서 그대로다. 펼치기 전 요약에는 장면을 쓰지 않는다(일부 문장이 사건을 말한다).
// - 주의가 없으면 경고 요소를 만들지 않는다. 불러오지 못함 · 확인하지 못함은 「주의 없음」과 다른 한 줄이다.
// - 필수 확인 · 자동 모달 · 계측 이벤트 없음. 네이티브 <details> 라 키보드(Enter · Space)로 열고 닫는다.

import type { StoryReleaseGuidanceView } from '@/lib/library/story/learner-types'

import styles from './story.module.css'
import { cautionSummary, guidanceLoadLine, guidanceUnavailableText } from './story-view'

export function StoryGuidance({ view }: { view: StoryReleaseGuidanceView }) {
  if (view.status === 'unavailable') {
    return (
      <p className={styles.meta} data-story-guidance="unavailable" data-story-guidance-reason={view.reason}>
        {guidanceUnavailableText(view.reason)}
      </p>
    )
  }
  const { guidance } = view
  return (
    <div className={styles.guidance} data-story-guidance="ready">
      <p className={styles.meta} data-story-guidance-load>
        {guidanceLoadLine(guidance)}
      </p>
      {guidance.cautions.length > 0 ? (
        <details className={styles.cautions} data-story-cautions>
          <summary>{cautionSummary(guidance.cautions.length)}</summary>
          <ul>
            {guidance.cautions.map((caution, i) => (
              <li key={i}>{caution}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

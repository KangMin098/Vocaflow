// apps/web/src/app/(main)/csat/layout.tsx
//
// 홈 비교·분석 구조도는 넓게, 예측 학습·공식은 기존 읽기 폭으로 유지한다.
// 실제 화면 표식을 CSS :has로 판별해 client layout 없이 판면을 전환한다.

import styles from '@/components/csat/session/learning-home.module.css'

export default function CsatLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>{children}</div>
}

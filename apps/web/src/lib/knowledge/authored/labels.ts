// apps/web/src/lib/knowledge/authored/labels.ts
// 창작 자료 화면 문구(역할 이름) — 서버 컴포넌트(page.tsx)와 클라이언트(AuthoredRunner)가 같이 쓴다.
// 'use client' 모듈에서 값을 서버로 가져오면 클라이언트 참조(proxy)가 되어 읽을 때 오류가 난다 — 그래서 여기 둔다(2026-10-18 격리 e2e 발견).
export const AUTHORED_ROLE_LABEL: Record<string, string> = {
  model_explanation: '출제 원리 배우기',
  guided_practice: '안내 연습',
  independent_check: '혼자 확인',
  transfer: '다른 글에 적용',
  delayed_check: '다른 날 다시 확인',
}

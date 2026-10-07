# /hub — 끝나지 않는 이미지 요청이 다음 이동을 막는다 (2026-10-07 · 미수정 결함)

> 학습 지도 Phase 1 봉인 검증 중 발견. 학습 지도 커밋과 섞지 않고 별도 작업 단위로 고친다.

## 증상
- 로그인하면 `/hub` 로 간다. 그 탭이 열린 채 같은 브라우저(같은 호스트 연결 풀)에서 다른 페이지로 이동하면 **이동이 끝나지 않는다** — 서버에는 요청이 도착하지도 않는다(로그에 없음).
- 같은 시점 같은 쿠키의 `curl` 은 1.7초에 전체 HTML 을 받는다 → 서버 문제가 아니라 브라우저 연결 고갈.
- `/hub` 탭을 닫으면 같은 이동이 0.5–2.5초에 열린다.

## 끝나지 않은 요청(Playwright `request` − `requestfinished` · 2026-10-07, 개발 서버 3000)
- 외부 도서 표지 7개 — `https://standardebooks.org/ebooks/<저자>/<작품>/downloads/cover.jpg`(le-morte-darthur · les-miserables · anna-karenina · metamorphoses · don-quixote · the-diary · gil-blas)
- 개발 서버 이미지 최적화 5개 — `/_next/image?url=%2Fillustrations%2Ftines%2F{tile-comics,tile-wordblitz,spot-listening,spot-reading,spot-search}.webp&w=…`

## 재현
1. 테스트 계정으로 로그인(→ `/hub`).
2. 시험 기록 3회를 API 로 남긴다(기록 없는 계정에서는 재현이 약했다).
3. 같은 탭 또는 같은 컨텍스트의 새 탭에서 `/csat/diagnosis` 로 이동 → 90초 넘게 `domcontentloaded` 없음.

## 영향 · 다음 조치
- 실제 사용자도 `/hub` 를 연 채 다른 화면으로 가면 멈출 수 있다(브라우저 호스트당 연결 수 제한).
- 조사 후보: 외부 표지 이미지 지연 로딩 · 타임아웃, `/_next/image` 개발 최적화 경로가 끝나지 않는 이유(운영 빌드에서도 나는지).
- 학습 지도 E2E(`scripts/csat/map/e2e-map-states.mjs`)는 로그인 탭을 닫고 `/csat/diagnosis?tab=map` 으로 바로 들어가 이 결함을 피한다.

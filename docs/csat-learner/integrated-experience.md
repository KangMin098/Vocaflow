# 분석과 듣기 통합 — 2026-09-18

## 조사와 선택

Next 14 App Router / React 18 / pnpm 9 / CSS modules와 공용 토큰을 유지한다. `/csat`, `/csat/dissect`, `/csat/formulas`가 학습자 표면이고 관리자 분석은 `/admin/kice`에 남는다. PDF는 기존 PDF.js → 기기 IndexedDB → passage-model을 사용한다. 서버 분석은 기존 공개 분석 catalog를 사용한다. API·인증·DB 변경과 dependency 추가는 없다.

현재 예측 → 피드백 → 대조 → 전이는 유지할 가치가 있지만 돌아가기·문항 선택·이어하기가 없다. 강의 엔진 LecturePlayer/WebSpeechAdapter는 재사용할 수 있다. 관리자 LectureStage는 모든 큐에서 자동 스크롤하고 별도 원고를 읽으므로 학습자에 그대로 붙이지 않는다.

- A 기존 개선: 예측의 인출 기회를 보존하지만 탐색 요구를 충족하기 어렵다.
- B 허브+탐색: 추천과 문항 목록, 이어하기를 한 진입점에서 제공한다.
- C 분석 통합: 분석 section을 단일 데이터로 만들고 같은 텍스트를 TTS cue로 변환한다.

선택: A의 추천 학습 + B의 진입 구조 + C의 분석 읽기/듣기. 분석을 먼저 본 경우 예측 적중으로 기록하지 않는다. 사용자 스크롤은 자동으로 되돌리지 않으며 명시적인 현재 위치 버튼만 스크롤한다. 문항 변경과 unmount는 발화를 취소한다. 기기 음성이 없으면 무음 강조임을 표시한다.

KEEP: PDF/reflow, 저장소, 예측 규칙, 공용 TTS 엔진, 관리자 원고/API, 토큰.
MODIFY: SessionHome/Runner, ItemScreen 진입, 기기 진행 상태.
CREATE: 분석 section→cue 순수 변환, 통합 분석 읽기, 회귀 시나리오.
MOVE/REMOVE: 없음. 공용 사용처를 삭제하지 않는다.

## 연구 검토

[인출과 피드백 연구](https://pubmed.ncbi.nlm.nih.gov/32442801/)는 피드백을 동반한 인출의 학습 동기 가능성을 보고한다. 따라서 먼저 예측할 기회는 남긴다. 이 연구를 수능 성적 향상 보장으로 해석하지 않는다. [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)는 음성 목록과 pause/resume/cancel을 제공한다. 저장소 어댑터의 문장 단위 취소·재개 방식을 유지한다.

최신 요청은 이전 명세의 고정 순서 제한을 대체한다. 검증은 추천 완주와 자유 탐색을 별도로 수행한다.

## 렌더링과 회귀

- 375 / 768 / 1440: 허브 → 예측 → 허브 → 이어하기 → 분석 듣기 → 이전/다음 문항을 실제 PDF로 검증했다. 스크린샷에서 낮게 묻힌 이어하기를 위로 옮기고 탐색 바로가기를 첫 화면에 추가했다. 아이콘과 링크의 왼쪽 정렬도 맞췄다.
- Playwright 통합 3건 통과. 근거/오답/의도 구간 이동, 일시정지·재개, 사용자 스크롤 보존, 문항 변경 시 발화 취소, 선열람 후 예측 통계 제외, light/dark axe 위반 0, 가로 넘침 0, pageerror 0.
- 음성 테스트는 브라우저 발화 경계만 결정적으로 대체하고 실제 LecturePlayer와 WebSpeechAdapter를 실행한다. 실제 기기 음성의 청감 품질 검증을 의미하지 않는다. 한국어 음성이 없는 기기는 무음 강조를 명시한다.
- 관련 단위/계약 테스트 152건 통과(세션·강의 90 + reflow·analytics·API 호출·링크 계약 62). workspace lint/typecheck 10 작업 통과, 기존 경고 11개.
- 현재 분석 탐색은 검토된 빈칸 추론 7문항 범위다. 다른 문항의 메타데이터를 임의 생성하지 않았다. 기기 기록은 기존 IndexedDB이며 계정 간 동기화로 확장하지 않았다.
- 기존 전체 저장소 테스트 실패 내역은 [이전 검증 보고서](./dissection-report.md)에 남아 있다. 이번 관련 검증 통과를 전체 저장소 테스트 통과로 표시하지 않는다.

스크린샷: `apps/web/test-results/csat-integrated-final/` (원문을 포함하므로 git에 넣지 않는다).

최종 운영 검증: `NEXT_DIST_DIR=.next-integrated-verify` production build exit 0. 분리된 3102 서버에서 `47-csat-session.spec.ts` **8/8 통과**. 추천 3문항 완주·공식 저장·전이·PDF 재추출·캐시 후 3G 진입 10초 예산·공유 주요 라우트·production 관리자 거절을 포함한다. 최종 스크린샷은 `apps/web/test-results/csat-integrated-production/`에 있다. 검증 서버는 종료하고 사용자용 3000 개발 서버는 유지한다.

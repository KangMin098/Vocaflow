# 디자인 작업 환경 구축 · 2026-09-18

범위: 기존 디자인 정본을 연결하는 문서·Codex 스킬·로컬 Visual QA. 제품 화면·DB·라우트 변경 없음.
작업 중인 CSAT 재설계 파일과 에이전트 공용 설정은 별도 변경이며 이 커밋에 포함하지 않는다.

## 구성과 확인

- `DESIGN.md`: 디자인·학습·도메인 정본으로 가는 입구. 별도 학습 철학 문서를 복제하지 않음.
- `.agents/skills/vocaflow-design-loop`, `vocaflow-visual-critic`: 작업 범위·실제 렌더·근거 있는 비평·종료 기준.
- `docs/design/06-workflow.md`: PowerShell 실행법, 레퍼런스 사용, 수동 접근성, 기준선 운영과 저장 경계.
- `playwright.visual.config.ts` + `tests/visual`: `/fit` 기본 캡처, 선택적 `/csat`·`/csat/formulas`,
  5개 뷰포트 × 2개 테마, axe·넘침·페이지 예외·키보드 활성화, 경로별 로컬 픽셀 비교.

검증은 Windows의 기존 `localhost:3000` 개발 서버와 공유 작업 중인 화면에서 수행했다.
CSAT 확인은 당시 작업 트리의 `/csat`·`/csat/formulas` 구현과 기존 인증 상태를 사용했다.
프로덕션 빌드·실제 TTS·PDF 분석 흐름 전체를 검증한 것은 아니다.

| 확인 | 결과 |
|---|---|
| `/fit` 375·390·768·1280·1440 × light/dark | 최초 9/10, 나머지 개발 도구 오탐 수정 후 해당 조건 재실행 통과 |
| 가로 넘침·로그인 리다이렉트·누락 헤딩 가드 | 합성 정상/오류 화면 2개 테스트 통과 |
| 없는 픽셀 기준선 비교 | 의도대로 실패, 자동 생성 없음 |
| 390-light·1440-dark 기준선 생성 후 비교 | 2/2 통과, 첫 화면·전체 화면 모두 비교 |
| `/csat`·`/csat/formulas` 390-light·1280-dark | 4/4 통과 |
| web TypeScript · 변경 TS ESLint | 통과 |
| 공용 에이전트 설정 검사 | 9/9 통과 |
| 스킬 frontmatter·이름·설명·로컬 링크 | Node + js-yaml 검증 통과. Python 미설치로 bundled quick_validate.py 실행 불가 |

오탐: axe가 `nextjs-portal` 내부 개발 오류 배지의 흰 글씨/빨간 배경을 제품 결함으로 판정했다.
개발 도구만 캡처·axe에서 제외했다. 앱의 페이지 예외는 계속 실패하며 콘솔 오류는 감사 JSON에 남긴다.
가로 넘침 가드는 의도적으로 내부 스크롤을 허용한다. 내부 스크롤의 발견성은 시각 검토 대상이다.

## 실제 캡처 비평 예시

390px 밝은/어두운 화면, 1280px 밝은 화면, 1440px 어두운 화면을 직접 열어 확인했다.
아래는 기존 `/fit` 화면에서 발견한 후속 디자인 항목이며 환경 구축 중 화면을 재설계하지 않았다.

| 관찰 | 사용자 영향 · 제안 | 코드 위치 · 재검증 |
|---|---|---|
| 390px 헤더 오른쪽의 로그인 글자가 일부 잘림 | 기존 가로 스크롤 내비 정책에 따른 결과. 스크롤 가능성이 드러나지 않아 행동 발견이 어려움. 주요 행동을 유지하는 좁은 화면 내비 구조 검토 | `(marketing)/layout.tsx`의 header/nav. 375·390px 초기 화면과 Tab 이동 확인 |
| 한국어 판정 문장이 이탤릭으로 표시됨 | 프로젝트의 한국어 격려·설명 서체 규칙과 불일치. 기존 Hahmlet 역할로 정리할 후보 | `LevelProfilePanel.tsx`의 profileHeadline, inline fontFamily/fontStyle. 밝은/어두운 캡처 확인 |
| 영어 입력 원문이 UI 본문 서체로 표시됨 | 원문과 인터페이스의 서체 역할 구분이 약함. 영문 원문 토큰 적용 검토 | `PublicFitClient.tsx`의 textarea `font-body`. 한글 placeholder와 영문 입력을 함께 확인 |

현재 화면을 픽셀 기준선으로 남겼다는 것은 디자인 품질 승인과 다르다.
이 기록은 자동 검사로 잡히지 않는 디자인 문제를 다음 구현 작업에 전달하는 예다.

로컬 증거: `apps/web/test-results-csat-learner/design-setup/`의 `initial-matrix`, `devtools-check`,
`pixel-compare`, `csat-check`와 `design-baselines/`(상위 `test-results-csat-learner/` 기준).
스크린샷·인증 상태는 커밋하지 않는다. Figma 연결·Product Design 외부 플러그인 설치는 수행하지 않았다.

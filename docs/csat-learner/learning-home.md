# Learning Home 재설계 — 2026-09-18

## 조사와 비평

현행 Next14/React18, pnpm9, App Router, CSS module, 공용 토큰·Hahmlet/IBM Plex/Lora/lucide를 유지한다. SessionHome → composeDissection → SessionRunner, 기기 IndexedDB의 예측/공식/재확인 큐/초안, PDF.js reflow, analysis-sections → LecturePlayer/WebSpeechAdapter가 실제 연결이다. 관리자 API/분석자료와 원문 업로드 경계는 바꾸지 않는다. 현재 학습자 데이터는 검토된 빈칸 추론 7문항이다. 없는 순서·삽입 커리큘럼을 만들지 않는다.

실제 375/768/1440 렌더링을 상시 47번 스펙으로 저장했다(`test-results/csat-home-before`). 초기 화면이 제목·설명·아이콘 3개·파일 입력으로 채워져, 분석의 차별성을 확인하기 전에 안내를 읽어야 한다. 추천 이유는 개인 기록과 무관한 고정 문장이다. 기록이 공식 개수로만 축약되고, 전체 방향은 문항 목록으로만 나타난다. 자유 탐색과 TTS 동기화 자체는 정상이며 유지한다.

## 참고 원리와 적용 판단

- [Explorable Explanations](https://explorabl.es/): 학습자가 조작하며 관계를 발견하는 형식. 실제 기출 두 문항의 소재/형식/함정 관계를 바꾸어 보는 판면으로 해석한다. 게임·장식 애니메이션은 가져오지 않는다.
- [NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/): 자주 필요한 핵심 행동을 먼저, 보조 기능을 요청 시 노출한다. 시작은 항상 보이고 PDF 사전 준비는 접힌 영역으로 이동한다. 탐색·분석을 잠그는 강제 순서로 사용하지 않는다.
- [Khan Academy mastery goals](https://www.khanacademy.org/khan-for-educators/teacher-toolbox/getting-started-teacher-training-us/implementation-strategies-us/classroom-strategies/a/using-khan-academy-for-personalized-practice-and-mastery): 개별 학습 목표와 전체 방향을 연결하는 원리를 참고한다. Vocaflow 기록은 숙달 측정이 아니므로 '보관/읽음/예측/재확인'만 표시하며 숙달률은 만들지 않는다.

이는 설계 가설이며 사용자 연구로 동기나 학업 효과를 입증했다는 뜻은 아니다.

## 세 방향

A Clarity: 추천·이어하기·목록을 재정렬. 사용성은 좋아지지만 실제 출제 관계의 증명이 없다.
B Impact: 두 기출이 같은 원리로 이어지는 비교 판면. 차별성이 보이나 추천 행동이 뒤로 밀릴 수 있다.
C Synthesis(선택): 상단의 실제 비교 판면 + 인접한 오늘의 해부, 아래의 개인 패턴 지도와 문항 색인. 모바일은 짧은 비교 → 시작 → 지도 순서. 카드 반복 대신 괘선·타이포·관계선으로 위계를 만든다.

N1: 검토된 기출의 소재/형식/함정/공식 관계가 없으면 성립하지 않는다.
N2: 로컬 버튼으로 비교 관점이 즉시 바뀐다. 첫 관계는 SSR HTML에도 존재한다.
N3: 다른 소재의 공통 구조를 가까이 놓아 비교에 필요한 작업기억 부담을 줄이고, 예측→피드백→전이의 기존 기회를 유지한다.

KEEP: 추천 알고리즘, 세션/공식/초안 저장, PDF, TTS 엔진, 관리자 화면.
MODIFY: 홈 정보 구조·추천 설명·학습 상태 표면·분석 deep link.
CREATE: 홈용 순수 추천 설명/패턴 그룹 모델, 홈 CSS module, 상시 회귀.
REMOVE: 홈의 장식적 3아이콘 안내만 대체. 공용 컴포넌트 삭제 없음.

새 패키지/폰트/이미지는 필요 없다. native details, CSS Grid, 기존 Playwright/axe로 구현·검증한다. vocaflow-design이 기준이며 redesign-existing-projects는 감사 항목만 사용한다.

## 반복 평가

1. 첫 구현: 실제 두 문항의 비교, 추천 이유와 패턴 지도가 드러나 차별성과 전체 방향은 개선됐다. 그러나 375px에서 문항 일정이 시작 버튼보다 앞서 너무 길어졌다. `csat-home-iteration1`에 기록했다.
2. 일정보다 추천 이유와 시작을 앞세웠다. 원리별 상태는 세부 열람을 접고 한 줄로 보인다. 비교 예시의 문항 제목 길이가 달라도 관계 화살표가 같은 높이에 오도록 맞췄다.
3. 모바일 첫 화면에서 하단 내비게이션이 시작 버튼을 일부 가렸다. 제목을 ‘다른 지문, 같은 설계.’로 줄이고 여백과 행간을 보정했다. 최종 375×900 스크린샷에서 비교·추천 이유·시작 버튼이 모두 보인다. 최종 이미지: `apps/web/test-results/csat-home-final/`.

임팩트/호기심은 실제 기출 관계의 변화, 명확성은 단일 시작 버튼과 실제 문항 일정, 동기는 개인 기록에 근거한 이유, 자유는 원리/열람 필터와 분석 딥링크로 구현했다. 가짜 숙달, 불안 카피, 배지·장식 애니메이션을 추가하지 않았다. 판단은 디자인 평가이며 실제 학습자의 5초 테스트를 수행했다는 뜻은 아니다.

## 검증

- 홈 375/768/1440 실제 렌더링, 키보드 패턴 변경, 문항 필터·빈 상태 복귀, SSR 비교 내용, light/dark axe, 가로 넘침 검사 통과.
- 기존 탐색·이어하기·브라우저 TTS 3 viewport 회귀 통과.
- 관련 단위/계약 153건 통과. workspace lint/typecheck 10 작업 통과(기존 경고 11개).
- 다크 전환 직후의 중간 색을 axe가 읽은 일시적 실패를 확인했다. 공용 테마 전환이 끝났음을 검사한 후 대비를 측정하도록 상시 테스트를 수정했으며 대비 규칙은 유지했다.
- 상시 Playwright 47번 스펙에 신규 시나리오를 추가했다. 새 패키지 설치, DB/API/인증 변경 없음.

### 최종 운영 검증

- 최종 소스의 운영 빌드 종료 코드 0(2026-09-18 07:18 KST). 분리된 `.next-integrated-verify` 산출물을 3102 포트에서 실행했다.
- 운영 모드 Playwright **11/11 통과**: 홈 3크기, 분석 탐색·이어하기·듣기 3크기, 예측·설계도·공식·전이 완주 3크기, 공유 주요 라우트·다크 테마, 관리자 접근 경계. 실행 시간 1.2분.
- 스크린샷과 결과: `apps/web/test-results/csat-learning-home-production/`. 듣기는 브라우저 음성 경계를 모의한 제어·상태 검증이며 실제 음성 품질 평가는 아니다.
- 기존 개발 서버 3000의 `app/(main)/layout.js` 요청도 HTTP 200을 확인했다. 운영 검증은 개발 캐시와 분리했다.
- 저장소 전체 테스트의 기존 실패는 [해부 구현 보고서](./dissection-report.md)의 남은 검증 문제를 따른다. 이번 관련 검사 통과가 저장소 전체 통과를 뜻하지 않는다. 전체 회귀 실패 상태 및 누적 변경 30개 이상에 대한 AGENTS.md 확인 규칙 때문에 커밋·푸시는 진행하지 않았다.

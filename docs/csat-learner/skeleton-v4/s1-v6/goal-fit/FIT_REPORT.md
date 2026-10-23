# S1 G1~G5 목표 적합성 검증 — DRAFT / NOT_ACCEPTED

T-0134, 2026-10-23. [40대안별 기록](../FEATURE_DECISIONS.md) · [상태·독립성 감사](./STATUS_AUDIT.md) · [브라우저 원결과](./BROWSER_RESULTS.json) · [해시 결속](./MANIFEST.json).

## G1~G5 결과

| 항목 | 처리 | 근거와 수용 한계 |
|---|---|---|
| G1 네 대안 실질 비교 | 기능별 관측·반증·남은 위험·후속 실행 경로로 보완 | 같은 보류 문장10개를 제거. 6기능에 부분 분석 시연에서의 다음 검증 후보를 권고하고 F02/F06/F09/F10은 서로 다른 증거 공백으로 미정. 전역 적격 판정·교육적 최적안 확정 아님 |
| G2 F04 실제 실패 구분 | 기존 v3 원자료의 두 축을 보존 | 34② unknown+fails,22③ true+fails,38 n_a·④fails/⑤satisfies. 실제 distractors.operation과 decisive도 BROWSER_RESULTS.sourceFailures에 보존. v3가 두 축을 갖지 않는다는 주장은 하지 않음 |
| G3 F07/F08 REUSE | **ELIMINATED** | AnalysisTheater liveScene→selectScene 및 LectureStage scrollIntoView가 사용자 제어 필수조건과 충돌. 개선을 전제로 한 REUSE로 이름만 유지하지 않음 |
| G4 F06 정적/권한 분리 | 서버 정적·순수검사 PASS, 실제 인증/RLS NOT_VERIFIED | 공개 집합→projection·held/missing·양쪽version/hash6검사와 정상계정HTTP/RLS/비공개응답/비교내용감수를 별도로 기록 |
| G5 실제 대안 시연 | 격리 상호작용24조건, 캡처14개 | 3문항×4대안×1280/1440. 실제컴포넌트 A 및 B의 V3Judgment, C/D 프로토타입. 정상 서비스·PDF·실제 player/TTS·내용/학생 감수 통과 아님 |

## 같은 조건과 다른 조건

기존 `D:/workspace/Vocaflow-main-serving/tmp/csat-theater-review-browser.mjs`의 esbuild/React 실제컴포넌트·CSS·메모리 store shim·Playwright loopback 격리 방법을 확장했다. 기존 파일은 수정하지 않고 [compare.mjs](./compare.mjs)와 [fixture.tsx](./fixture.tsx)를 이 문서 영역에 두었다. A는 실제 AnalysisTheater/LectureStage/CsatRail이다. B는 실제 V3Judgment를 감싼 개선 시연, C는 유형별 두 선택 대조, D는 선택-요구-준비된 근거 연결 시연이다. 실제 서비스 구현 변경 없음.

모든 후보는 같은 보존 samples.json·lecture 원본, **정답 공개 후 OFFICIAL_ANSWER 단계**, 같은 창 크기/높이/동작 순서에서 비교한다. 34는②,22는③,38은④를 고르고, C는 각각③/①/⑤와 대조한다. 34①/③도 별도로 확인·캡처한다. PDF·전체 선지·정상 로그인은 모두 없다. C/D의 질문/한정 띠는 기준서의 설계 문구이고 영문 선지 전문이나 원문을 생성하지 않는다.

전체기능 단위 대안과 시연 패키지는 같지 않다. A~D 패키지는 F01~F08의 여러 아이디어를 묶은 실험이다. F02/F06/F09/F10의 전체 기능 구현을 시연한 것이 아니며, 패키지 전체 결과를 각 기능 모두의 PASS로 배분하지 않는다. F01/F03/F05의 권고는 시연상 조작 가능성과 근거 구조에 대한 작성자의 설계 판단이다. 실제 학습자 이해·인지 부담 우위의 관측이 아니다.

## 실제 조작과 관측

- 24조건에서 선택지의 truth와 requirement_fit 구분이 유지됐다. 34②의 원문만으로 확정 불가를 거짓으로 바꾸지 않았고,22③의 부분 참/요지 불충족과38의 참거짓 비적용을 확인했다. C에서34①/③의 서로 다른 성립 여부도 확인했다.
- B/C/D의18조건에서 근거 링크, 직접 장면 이동, Enter 키 조작, READ/SILENT/OFF 로컬 cue상태를 검사했다. cue 다음을 키보드로 선택한 뒤 장면·scrollY·포커스가 유지됐다. 이것은 실제 TTS/player 오류·취소 동작의 증거가 아니다.
- 판단 프로토타입 `.fit` 내부의 보이는 B/C/D 버튼은44×44px 이상, 가로 넘침≤1px, JavaScript pageerror0이었다. 기존 공통 레일이나 A의 접근성 전체를 새 PASS로 만들지 않았다. 스크린리더·고배율·색 대비 도구의 전체 감사는 NOT_RUN이다.
- 자체 loopback GET만 허용하고 다른 요청은 route에서 차단했다. 차단6요청은 원결과에 method/path로 남았다. 원문분석/강의/주요 실제컴포넌트5파일의 전후 해시가 동일했다. 인증/DB/분석 이벤트·학습기록은 실제 서버에 쓰지 않았다.
- main-serving에서 관련6파일98개 순수 테스트가 PASS/실패0/skip0이었다: compare-v3(6),map-return(8),learning-session(28),reveal-gate(6),lecture/core(45),InquiryV3Panels(5). 테스트·전이 의존성·설정/lockfile62개가 작업 브랜치와 같은 해시이고 기존 원천94파일도 변경0임을 확인했다(AI-Control `runtime/t0131-s1-fit-20261023/inputs-and-tests.json`). 이 테스트의 합성34② fixture는 false 값인 경우도 있어, 실문항 truth의 근거로 쓰지 않고 실제 samples/v3의 unknown 값을 별도로 대조했다.

## 캡처 직접 비평과 수정

같은1280의 A/B/C/D와1440의22/38 C를 직접 열어 봤다. 기존 A는 원문 부재 안내·문장 지도·v3·legacy 설명이 같이 차지한다. B는 질문/한정과 기존 판단을 붙이고, C는 두 판단축을 동시에 놓는다. D는 준비된 연결을 한 번 더 공개하므로 새 추론 활동이 자동으로 생기는 것은 아니다. C의 두 decisive 장문은1280에서 내부 스크롤을 요구하므로 PDF 전문/검수된 압축 근거 없이 가독성 우위를 확정할 수 없다.

가장 나쁜 실제 문제는 첫 B 시연에서 장면 왕복 후 선택이 정답 기본값으로 돌아간 점이었다. 프로토타입의 선택 상태를 Shell에 보존하고 selectedKey로 복원하도록 한 번 수정했다. 24조건을 다시 검사하고 최종 이미지를 교체했다. 새 제품 API/기능을 수정한 것은 아니다. D는 판단→근거 순서의 다른 골격으로 표시했고 연결 상태도 유지했다.

골든: 이 작업의 독립 골든 없음. 대신 같은 조건의 실제 A 캡처를 비교 기준으로 보존했다. 포트폴리오: 정본은 비어 있는 템플릿이므로 비교 기준 없음. 기존 CSS/CsatRail을 사용했지만3B 참조 기하 동일성을 측정하지 않았으므로 ‘참조와 동일’이라고 주장하지 않는다.

## F별 다음 검증 후보

| 기능 | 권고/미정 | 핵심 근거·남은 조건 |
|---|---|---|
| F01 | IMPROVE, 한정된 설계 권고 | 질문·필수 한정 고정+직접 이동. SOURCE_ONLY 공개 감사 필요 |
| F02 | 미정 | 실제 PDF/전체 선지의 추출·크롭·앵커 검증 없음 |
| F03 | IMPROVE, 한정된 설계 권고 | 기존 근거 단위/참조를 보존하며 관계 이유/출처를 명시. 관계별 내용 감수 필요 |
| F04 | REPLACE, 판단 영역 한정 | v3두축을 데이터로 유지하며 두 선택을 유형별 대조. 전문 명제/내용 감수 필요 |
| F05 | IMPROVE, 한정된 설계 권고 | 기존 원리와 limitation 왕복. 검수된 반례 부재/강의 일반화 위험 미해소 |
| F06 | 미정 | 서버정적6검사와 실제인증/RLS/비교내용감수 분리 |
| F07 | IMPROVE, 제어 분리 권고 | 그대로 재사용은 탈락. 기존player와 화면탐색 분리 검증을 다음 단계로. 실음성/오류 미검증 |
| F08 | REPLACE, 작업면 한정 | 2면 질문/근거/판단 배치. 실제PDF·세진입/복귀·스크린리더 미검증 |
| F09 | 미정 | 순수 복귀/분류36검사만으로 실계정 지도숙달 불변을 증명하지 않음 |
| F10 | 미정 | 원음·전사·화자·시간·권리의 결속이 없어청취 기능 비교 불가 |

필수조건의 위반 후보는 탈락했다. 나머지도 권한·전체내용·자료 검증이 미완료여서 전역 적격안 집합은 확정하지 않았다. 따라서 구현일수/유지비 수치나 효능 점수로 순위를 만들지 않았다. 특히 D의 새상태/새Shell 부담, C의 두판정 동시표현 부담, B의 기존검수배지/기본정답노출 문제는 개별 위험으로 남겼다. 적격안이 확인되면 같은 수직범위의 코드변경·회귀검사·운영책임으로 비용을 비교한다.

## 재현과 미검증

```powershell
node docs/csat-learner/skeleton-v4/s1-v6/goal-fit/compare.mjs --runtime-root D:/workspace/Vocaflow-main-serving
node docs/csat-learner/skeleton-v4/s1-v6/validate.mjs --check --source-root D:/workspace/Vocaflow-main-serving --samples D:/workspace/Vocaflow-main-serving/tmp/csat-item-review-20261023/samples.json
```

격리 소스의 iife 번들에는 PDF worker import.meta 경고가 있다. PDF 입력을 시연하지 않았으므로 이를 해결된 PDF 경로라고 보고하지 않는다. PDF검증은 실제 앱 ESM/worker와 허용된 로컬 원본에서 별도로 수행한다. 정상계정 인증/RLS·전문 PDF/선지·강의 내용 감수·실TTS/평가원음·학습자 사용성·전이·성적 효과는 NOT_VERIFIED/NOT_RUN이다. 37cue 원본과6개 수정안은 바꾸지 않았다.

**S2 전체 착수/완료 승인 없음.** 가능한 범위는 선택 상태·유형별 판단·공개·복귀·매체경계의 추가 격리 시연과 내용/권한 검증 준비다. 다음 실행도 owner·허용 경로·자료/권한을 먼저 확인해야 한다.

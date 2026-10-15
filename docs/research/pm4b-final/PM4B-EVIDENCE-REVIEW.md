# P-M4b 증거·실행·SKIP 감사

2026-10-15 · 실제 실행과 제출 증거 감사를 구별한다.

## 직접 실행

1. 최초 122개: 122 PASS/0 FAIL/0 SKIP. 원 fixture/단언은 보존하고 출력 경로를 새 ignored 폴더로 옮겼다. 원 GoalRecordBar 검사는 past 인자를 주지 않았으므로 이것만으로 수정된 과거 경계를 검증했다고 하지 않는다.
2. 종료 10개: 새 6개 + 제품 E 격리 4개, 모두 PASS. past/current 상단·기준일 필터·full 복귀 링크·과거 PLAN·실제 Node 30개 accessible name·V4 Inspector를 검사했다. Node는 실제 소스의 private 함수를 TS로 분리해 SSR했다. CSS/실제 포커스/클릭 실측이 아니다.
3. 제품 187파일: 실제 개별 상태 2184 PASS/52 SKIP/0 FAIL, 수집 오류 0. CSAT lib/components와 knowledge를 포함한다. 초기 작업 디렉터리·모듈 별칭 환경 오류를 수정하고 실패한 수집 파일만 재시도했다. 초기 원 결과와 두 재시도 결과를 보존하고 파일별 최신 결과만 합쳤다. 한 번에 모두 실행한 결과라고 표현하지 않는다.
4. 원본 PNG 픽셀 재측정과 입력 해시/원장 보존 검사를 실행했다. 실제 브라우저/DB 자격 증명은 사용하지 않았다. PGlite는 격리 메모리 SQL 검증이다.

SSR에서 GoalPopover trigger, router, analytics, 상세 learnerPath를 대체했다. 실제 GoalRecordBar/PlanSection/Inspector/Node·정규 판정 함수를 사용하되 저장/라우팅 성공이나 CSS·hydration을 증명하지 않는다. 런너 상위 PASS 수가 SKIP까지 포함하는 JSON 문제가 있어 assertionResults.status를 다시 센다. product-summary.json과 summarize.mjs가 분모를 재현한다. 코호트 중복 합산 금지.

## SKIP의 정당성과 한계

| 독립 코호트 SKIP | 개수 | 사유 |
|---|---:|---|
| live DB/자격 증명 의존 통합 | 50 | 환경 키가 없을 때 skipIf. 이 검토는 키를 주입하지 않음 |
| load/quality live | 2 | MAP_LIVE_USER 필요. 실제 계정·기록을 건드리지 않음 |

세부 파일·검사명 52개는 product-summary.json에 보존했다. 원 제품 파일의 skipIf 조건과 대조했다. 해당 검사가 PASS라는 뜻은 아니다. RLS·공장 공정·실자료 마크업·원문 공개 경계를 실제 DB에서 검증한 것으로 승격하지 않는다.

제출된 2066/68은 원 코호트 명령/검사 목록이 없어 같은 분모로 완전 대조하지 못했다. 독립 코호트는 지식/컴포넌트까지 포함해 다르다. 남은 16개를 추정으로 정당화하지 않는다. 별도 PR HEAD CI verify 로그는 web 5312 PASS/249 SKIP, 443파일 PASS/43파일 SKIP이며 lint/typecheck를 포함한 15 tasks 성공이다. 249 SKIP 전체 정당성을 이번에 전수 검토했다는 뜻도 아니다.

## 제출 브라우저 감사

세 JSON 모두 HEAD 922222a2b, trackedFilesModified 0을 기록한다. 코드가 PR HEAD/main과 일치함을 git diff로 확인했다.

| 묶음 | PASS/FAIL/SKIP | 직접 열람 PNG | 해석 |
|---|---|---:|---|
| 수용 | 16/0/0 | 12 | 영역/과거/키보드/full/두 합성 계정 격리. 1024/390은 별도 관찰 2 |
| learner | 12/0/1 | 13 | 목표·기록·선택·PLAN·진입/복귀. E는 SKIP |
| R5 | 6/0/0 | 7 | 기존 확인 공급, 다음 미노출 문항, 수요 유지·자료 부족 |
| return/study | 7 PASS / ALL PASS 보고 | 별도 원 결과 없음 | 콘솔 주장 감사만. 새 독립 실행 수에 넣지 않음 |

스크립트는 실제 화면 DOM·URL·응답을 검사하지만 모든 결과를 전수 보증하지는 않는다. H01은 absent selector를 null로 허용하여 실제 16종만 측정됐다. 키보드는 대표 Enter/Space·포커스 사례이며 완전한 Tab 순서 감사가 아니다. 뒤로가기 과거 검사는 완전 pastOk 또는 일부 띠/편집 차단의 대체식을 쓴다. PLAN 과거에는 저장 버튼 수를 검사했고 독립 SSR로 경계를 보강했다.

계정 격리는 서로 다른 두 합성 계정의 화면 목표/기록 확인이다. 모든 서버 API/RLS 공격을 검증한 것은 아니다. 실제 계정·기록 보존은 이번에 수정하지 않았으며 제출 정리 결과는 생성 계정 삭제 후 0이다. 그 정리 여부를 현재 DB에 다시 질의하지 않았다.

## E와 실제 연결

자연 학습자 브라우저 E: SKIP. 합성 지도 연습 4/4: ISOLATED_CONTRACT_PASS. 후보 재고·공급 자격·납품·CTA를 구별한다. delivered ref 0이 링크 대상 0의 근거이며 실제 브라우저 CTA 렌더 검사는 아니다. 최초 독립 SSR의 후보 DTO 표시 검사도 재실행했다. 화면은 여전히 factoryStock=null이다. 공장/DB에 자료를 추가하지 않았다.

## 재현

의존성 재사용 경로 VF_REVIEW_DEP_ROOT는 설치된 저장소 루트를 가리킨다. .env는 출력·복사하지 않는다.

    $env:VF_REVIEW_DEP_ROOT='D:/workspace/Vocaflow-map-v62'
    node <vitest/vitest.mjs> run --config scripts/research/pm4b-final/original-vitest.config.mjs
    node <vitest/vitest.mjs> run --config scripts/research/pm4b-final/closure-vitest.config.mjs

제품 코호트는 apps/web 작업 디렉터리에서 product-vitest.config.mjs 절대경로로 실행한다. 최초 실패 목록 10파일을 product-retry로, 남은 factory.integration 1파일을 product-factory-retry로 재시도한 원 결과가 data에 있다. 같은 3개 원 결과에서 다음 명령은 중복 없는 집계를 재현한다.

    node scripts/research/pm4b-final/summarize.mjs
    node scripts/research/pm4b-final/verify.mjs

참조 PNG가 별도 로컬 파일이므로 다른 환경에서는 그 원본과 최초 검토 worktree 또는 동등한 해시 파일이 필요하다. 공개 저장소에 참조 이미지를 새로 넣지 않았다.

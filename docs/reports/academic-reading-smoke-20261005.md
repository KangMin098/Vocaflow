# Academic Reading 실제 콘텐츠 smoke — F02 중1·고1

2026-10-05. 기존 FYM 각색 후보 8편에서 F02 두 버전을 골라 현재 DB 원문을 읽고 `source → target → draft → Claude Code/Codex 독립 검수 → 적재 예행`을 실행했다. 검수 불일치 때문에 실제 문항 export와 DB seed로는 승격하지 않았다. 문항 gate의 성공·실패 경로는 **검수 통과를 가정한 격리 시뮬레이션**으로만 확인했다.

## 입력과 결속

원문은 [What Is Our Most Important Sense?](https://kids.frontiersin.org/articles/10.3389/frym.2021.548120/full)의 DB UUID `80b57391-d511-4134-b8aa-8a22fe3f2ebc`, revision `2026-09-25T08:00:41.071424+00:00`, SHA-256 `be013e6a1cafece83b78f84a8de7ef31a578842000cce580dccea11caccda4dd`였다. 현재 DB 본문은 보존 규칙 F02-A1의 해시와 같았다. 원문 페이지는 저자 Hutmacher와 CC BY를 표시하며, [CC BY 4.0 조건](https://creativecommons.org/licenses/by/4.0/)에 따라 출처·라이선스 링크·변경 표시를 각색 출처 표기에 넣었다. 이 smoke는 본문 prose만 사용하며 그림을 복제하지 않았다.

| 후보 | target key | 완성 draft hash | 원문/target 분리 |
|---|---|---|---|
| F02-middle1 | `a7f5e450d09a4eb4e12ca4bb` | `b5cc79d2846903f244a70b83b4f18013aee3da2ed7e4d082cd89b8b4fec389fe` | 같은 원문, 별도 target |
| F02-high1 | `b117d0a5ee0a0fc72bc711da` | `c97a53cb9f224e35e6a188efcfc174caa604489c1e24cb3ebfd32f5b96d7de61` | 같은 원문, 별도 target |

두 target의 export는 각각 실제 DB에서 후보 4행을 읽었다. F02 두 `.out.json`에는 기존 [각색 예시](../../scripts/textbook/frym-precision/adaptation-pilot-1.json), 기사별 권리 근거, 출처 인용, 8축 profile, 보존 점검, target별 item plan을 채웠다. 나머지 3행은 비워 둔 채 보류 처리했다. `validateReadingDraft`는 두 건 모두 통과해 `awaiting_content_review` 상태를 반환했다. 이 profile 수치는 에이전트의 smoke 판단이며 학생 측정치가 아니다.

## 독립 검수와 실제 적재 예행

Claude Code와 별도 `codex exec -s read-only` 실행에 같은 원문·각색·목표·권리·**완성된 전체 `reading_analysis`/`item_plan`** 패킷을 주고 서로의 결과 파일은 제공하지 않았다. 먼저 본문·pilot focus question만 담은 제한 패킷에서 Claude Code가 두 편을 통과시켰으나, 그 판정은 실제 문항 계획을 보지 않았으므로 폐기하고 아래 완성 초안 검수만 운영 판정으로 사용했다. 각 검수 결과에는 packet의 source/target/draft hash를 다시 기입하고 양식과 대조했다.

| 후보 | Claude Code | Codex | 게이트 결과 |
|---|---|---|---|
| F02-middle1 | `reject` — 의미·권리는 유지, R4 기대 답의 일부가 지정 근거에 없고 분석축 근거가 반복됨 | `insufficient_evidence` — 의미·권리는 유지, 어휘·종합 수준의 운영 근거와 R4 근거 범위 부족 | 차단 |
| F02-high1 | `reject` — 의미·권리는 유지, preserved-claim 인용 짝과 R6 근거·R7 발문에 결함 | `insufficient_evidence` — 의미·권리는 유지, 어휘·종합 수준 및 R6/R8 난도 설명 근거 부족 | 차단 |

Claude Code는 공통 프로필에서 여러 축에 같은 문장을 근거로 되풀이한 점, 보존 점검 이유에 규칙 문구를 복사한 점도 지적했다. 고1 `speaker` 지시 대상과 R7 발문 문법, 중1의 재구성 논증 기록도 보완 대상으로 남았다. Codex는 고1의 지정된 focus-question 근거가 예상 답 전체보다 좁고, body-position 기능이 질문에만 명시된 점도 지적했다. 두 판정 모두 보존 규칙의 중대한 의미 왜곡은 기록하지 않았다. 현재 파이프라인은 불일치를 평균 내지 않는다. 두 target의 실제 `adapt-drain-import.mjs` 예행은 각각 **훑음 4·적재 가능 0·건너뜀 4**를 출력했다(빈 3행, `claude_code review did not pass` 1행). `--commit`은 실행하지 않았다. 별도의 사람 전문가·학생 응답도 없으므로 교육적 `gold` 승격과 DB seed는 0건이다.

## 실패 주입

실제 두 검수 기록은 그대로 보존했다. 별도 메모리 객체에서만 두 판정을 강제로 `pass`로 만든 **gate-only 기준선**을 구성해 `canExportReadingItem`과 `readingItemSourceFailure`의 정상 경로를 확인했다. 이것은 실제 승인이나 실제 DB 문항 생성 성공을 뜻하지 않는다. 주입 검사는 실제 verdict가 pass/reject/보류 중 무엇이든 계속 실행되도록 했다. 그 기준선에 아래 변조를 각각 주입했을 때 두 타겟 모두 차단됐다.

| 주입 코드 | 변조 | 두 타겟 결과 |
|---|---|---|
| `SOURCE_HASH_CHANGED` | 현재 원문 본문에 문장 추가 | 각색 재검증 거절 |
| `TARGET_PROFILE_CHANGED` | 중1/고1 reasoning band 변경 | export target 대조 거절 |
| `ADAPTATION_HASH_CHANGED` | 검수 후 각색 본문에 문장 추가 | 기존 이중검수 재사용 거절 |
| `POST_REVIEW_TRUNCATION_INVALIDATES_REVIEW` | 제시문 마지막 문단 절단 | 문항 원천 gate에서 제외 |
| `RIGHTS_REVOKED` | 현재 원문 `display_only=true` | 각색·문항 gate 모두 제외 |

기존 [academic-reading-drain 회귀 테스트](../../packages/library-pipeline/src/textbook/academic-reading-drain.test.ts)는 위 해시·권리·절단 거절 경로를 작은 합성 fixture로 이미 다룬다. 이번 실행은 실제 F02 본문·현재 DB revision·두 target을 쓴 추가 smoke다. [추적된 재현 절차와 실행기](../../scripts/textbook/academic-reading-smoke/README.md)는 DOI 메타데이터와 기존 pilot에서 입력을 재구성하고 현재 원문은 DB에서 다시 읽는다. 새 작업 디렉터리에서 export·draft·review 양식을 재생성했을 때 원문·target·draft 해시가 원 실행과 일치했고 실패 주입도 모두 통과했다. 재생성한 `.out.json`의 문항 계획 한 글자를 수정하고 이전 검수 양식으로 패킷 생성을 시도하자 `review template ... stale`로 거절됐으며 원본은 복원했다. 로컬 독립 검수 원문과 전체 FYM 본문은 ignored `.agent-logs/academic-reading-e2e-smoke/`에 남겨 두며, 통과 가정 검수를 실제 승인 파일로 커밋하지 않는다.

다음 진입 조건은 지적된 item plan·인용 짝·발문·프로필 근거를 수정해 **새 draft hash로 이중검수**를 다시 받는 것이다. 학년 목표의 운영 rubric과 학생 pilot 범위도 사전 봉인해야 한다. 실제 두 검수와 교육적 검증이 모두 통과한 뒤에만 staging seed 및 실제 문항 export를 실행할 수 있다.

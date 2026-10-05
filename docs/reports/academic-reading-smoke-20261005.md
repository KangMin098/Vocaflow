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

Claude Code와 별도 `codex exec -s read-only` 실행에 같은 원문·각색·목표·권리 패킷을 주고 서로의 결과 파일은 제공하지 않았다.

| 후보 | Claude Code | Codex | 게이트 결과 |
|---|---|---|---|
| F02-middle1 | `pass` — 의미·권리·목표 적합 판정 | `insufficient_evidence` — 의미·권리는 통과, 중1 어휘·구문·추론 목표의 운영 기준/학생 근거 부족 | 차단 |
| F02-high1 | `pass` — 의미·권리·목표 적합 판정 | `insufficient_evidence` — 의미·권리는 통과, 고1 추론 요구와 어휘·구문 목표의 실측 근거 부족 | 차단 |

Codex는 고1의 지정된 focus-question 근거가 예상 답 전체보다 좁고, body-position 기능이 질문에만 명시된 점도 지적했다. 두 판정 모두 보존 규칙의 중대한 의미 왜곡은 기록하지 않았다. 현재 파이프라인은 불일치를 평균 내지 않는다. 두 target의 실제 `adapt-drain-import.mjs` 예행은 각각 **훑음 4·적재 가능 0·건너뜀 4**를 출력했다(빈 3행, `codex review did not pass` 1행). `--commit`은 실행하지 않았다. 별도의 사람 전문가·학생 응답도 없으므로 교육적 `gold` 승격과 DB seed는 0건이다.

## 실패 주입

실제 두 검수 기록은 그대로 보존했다. 별도 메모리 객체에서만 두 판정을 강제로 `pass`로 만든 **gate-only 기준선**을 구성해 `canExportReadingItem`과 `readingItemSourceFailure`의 정상 경로를 확인했다. 이것은 실제 승인이나 실제 DB 문항 생성 성공을 뜻하지 않는다. 그 기준선에 아래 변조를 각각 주입했을 때 두 타겟 모두 차단됐다.

| 주입 코드 | 변조 | 두 타겟 결과 |
|---|---|---|
| `SOURCE_HASH_CHANGED` | 현재 원문 본문에 문장 추가 | 각색 재검증 거절 |
| `TARGET_PROFILE_CHANGED` | 중1/고1 reasoning band 변경 | export target 대조 거절 |
| `ADAPTATION_HASH_CHANGED` | 검수 후 각색 본문에 문장 추가 | 기존 이중검수 재사용 거절 |
| `POST_REVIEW_TRUNCATION_INVALIDATES_REVIEW` | 제시문 마지막 문단 절단 | 문항 원천 gate에서 제외 |
| `RIGHTS_REVOKED` | 현재 원문 `display_only=true` | 각색·문항 gate 모두 제외 |

기존 [academic-reading-drain 회귀 테스트](../../packages/library-pipeline/src/textbook/academic-reading-drain.test.ts)는 위 해시·권리·절단 거절 경로를 작은 합성 fixture로 이미 다룬다. 이번 실행은 실제 F02 본문·현재 DB revision·두 target을 쓴 추가 smoke다. 로컬 재현 입력과 독립 검수 원문은 ignored `.agent-logs/academic-reading-e2e-smoke/`에 있으며, 저작권 원문 전체와 승인으로 오해할 수 있는 시뮬레이션 검수 파일은 커밋하지 않는다.

다음 진입 조건은 학년 목표의 운영 rubric과 학생 pilot 범위를 사전 봉인하고, 보류 판정을 독립 재검수/조정으로 해결하는 것이다. 그 뒤 실제 두 검수가 모두 통과하고 교육적 검증도 통과해야 staging seed 및 실제 문항 export를 실행할 수 있다.

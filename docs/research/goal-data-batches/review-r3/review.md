# T-0097 목표 데이터 3차 독립 검증 (Codex)

입력은 `369381724`를 병합한 HEAD `a00c5c315fdf01a6946bc296930ec397d0ee1c07`다. D2·D3 22개 파일의 blob을 해당 입력 커밋과 대조해 모두 일치함을 확인했다. 명세 acceptance 0–4를 검증했다. 제품·DB 변경과 push는 수행하지 않았다.

판정은 **confirmed 55 · refuted 12 · unclear 24 (91행)** 이다. 주장과 표본이 중첩된 행 수이며 정확도가 아니다. 엔진 인계는 **12개**로 제한했다. `verdict.json`이 항목별 판정·근거·제한 범위의 정본이다. 수치상 일치 후보의 relevance는 unknown으로 유지한다.

## 0. 삽입 분리와 원문 표본

GET `csat_items`의 R-INSERT 전체 262개를 읽어 같은 정규식으로 **238 first_sentence / 24 uncertain**을 재현했다. 조회시각·쿼리·HTTP 상태·표본 해시는 `db-checks.json`에 있다. 자격증명은 출력하거나 저장하지 않았다.

id순 그룹 내 등간격으로 먼저 정한 분리 표본 20개 모두 첫 영어 문장이 주어진 문장이라는 해석을 지지한다. 사건 선후·지시·대조·예시 관계와 DB 정답 위치를 함께 대조했다. 일부 원문에는 한글 경계 표지가 남아, 반환 문자열을 깨끗한 문장으로 쓰려면 표지 정규화가 필요하다. 238개 전부의 의미적 정확성은 unclear다. 인쇄 원본은 대조하지 않았다.

uncertain 표본 10개는 모두 원문에 명시적 주어진 문장/본문 경계 표지가 있다. 따라서 **자동 uncertain을 실제 원문 경계 불명확으로 읽는 주장 10개는 refuted**다. 정규식은 마침표 뒤 대괄호를 문장 시작으로 인식하지 못한다. 이 10개를 나머지 14개에 일반화하지 않는다. 자동 제외 규칙 자체는 구현대로 재현된다. T-0088의 삽입 결손 정정은 검토 표본에서 지지되며, 원문이 있다는 것과 현재 분리기가 정확하다는 것은 별개다.

## 1. 출력 검증과 원문 의미 대조

지정 cwd에서 `d2-run.mjs b3-insert validate` 및 `b4-v21 validate`만 실행했다. 생성·agree 명령은 실행하지 않아 다른 워크트리를 수정하지 않았다. b3 A/B 각 8/8·b4 A/B 각 40/40, 결함 0, exit 0을 확인했다(`validation.json`). 이것은 형식·인용 존재·반사실 번호 검증이며 의미 판정과 다르다.

R1 링크는 b3/b4 결합 후보에서 등간격 20개를 원문과 대조했다. **confirmed 19 / unclear 1**이다. 보류는 M2606#38 R1: 두 분석자가 서로 다른 근거를 들고 일반 명사 반복과 지시 추적의 경계가 닫히지 않는다.

갈림은 같은 두 배치 E2 10개·V4 10개를 등간격으로 선정했다. **20개 모두 개별 관련성 확정은 unclear**다. 갈림의 존재는 재현했지만 그것을 한쪽 판정의 타당성으로 바꾸지 않았다. E2에서는 탐색 대상과 거리의 기준 단위가 다르고, V4에서는 표현 동등성을 E3의 선지 대응과 별도로 셀 조건이 없다. 각 원문에서 확인한 구체적 사유는 verdict의 mapping-sample-21~40에 있다.

원문 패킷은 `insert-packet.local.json`, `mapping-packet.local.json`, `d3-packet.local.json`이며 `.gitignore`의 `*.local.json`으로 제외한다. 커밋에는 원문 인용 대신 식별자·해시·한국어 판정 사유를 남긴다.

## 2. 결합 규칙 재계산

원본 A/B 출력, pilot 원자 링크, 제3 판정을 읽어 별도 코드로 재계산했다(`recomputed.json`). **120문항·2160쌍·R1 관련 링크428·갈림310**을 재현했고, 최종 링크/갈림 집합도 산출물과 일치했다. 고유 문항:TASK 2160개로 중복은 없다.

`40×18 + 40×18 + 8×18 + 40×18 − 8×18 = 2160`이다. 구 삽입 8문항의 144쌍이 제거되고 b3로 대체된다. 구판 잔존은 0이다.

**§8의 R3 다수6/갈림5는 refuted**다. 원본 제3 판정 11개는 다수7(관련6·무관1)/삼자 갈림4다. 그중 삽입 2025#38·39는 b3로 대체되어 제3 판정을 적용하지 않는다. 최종 적용 9개는 다수7/갈림2다. 2025#36의 무관 다수는 관련 링크를 만들지 않지만 갈림도 아니다. 이 설명 오류가 최종 2160/428/310 산술 오류를 뜻하지는 않는다.

## 3. §8 효과·후보 및 D3

| 주장 | 판정 | 범위 |
|---|---|---|
| b3 일치 .8472·κ .6957·주 TASK 6/8, b4 .8528·.6663·33/40 | confirmed | 원본 A/B 재계산 |
| R3 κ −.1458→.4702 | confirmed인 관측 | 계약 변경의 인과 효과는 unclear: 시험·문항·판정자가 함께 다름 |
| 안정 TASK R6·E1·R5·R4·E3 | confirmed | 두 배치의 상대적 안정 후보 설명만 가능 |
| v2.2 E2 탐색/인접 경계 개선 필요 | confirmed | 갈림 사유 확인, 제안 규칙의 성능 개선은 미검증 |
| v2.2 V4/E3 경계 개선 필요 | confirmed | 재진술은 실재하나 별도 수행 자격은 보류 |
| v2.2 E1 발문 표의 개선 효과 | unclear | 부정·복수 조건 direct 규칙은 이미 있음 |
| b3 R2·R3·R4 동시 direct 8/8 | refuted | 공동 direct R2 7/8·R3 7/8·R4 8/8, 교집합 7/8 |
| 삽입 정답 하나로 세 TASK 개별 측정 보류 | confirmed | 수행 중첩에 대한 주의. 분리 측정 불가능성의 실험적 증명은 아님 |
| V2·V3·S1–S3 direct 0–3 | confirmed | 결합 AI 후보 표본 분포 한정 |
| D3 285/468=.609 | confirmed | 도표 3문항의 12오답 제외. 전체 오답 480 |
| 순서·삽입 other 뭉침 | confirmed | 순서 공동other34/48, 삽입34/48. 일치한 분류 중에서는 각각34/34·34/35 |

D3는 주 TASK 일치96/120·동일 결정 지점47/120·어법 일치4/24도 재현했다. M2606#36·2024#37·M2606#38·2024#38의 원문과 오답16개를 대조했으며 지시 선행·대조·열거·전환 오류가 other에 합쳐짐을 확인했다. 어법에는 form_error가 이미 있으므로 범주 부재와 적용 경계 공백을 구분한다. 출제 의도에 관한 분석자의 가설은 사실로 확정하지 않는다.

## 4. 엔진 인계와 재현

`engine_handoff` 12개는 연구 근거·계약 개선·관찰 범위 설명에만 사용한다. 개별 링크를 NeedRank·진단·성취 입력으로 쓰거나 미관찰 문항으로 일반화하지 않는다. 불명확 판정, 인과 효과, 출시 적격은 인계 대상에서 제외했다.

재현은 저장소 루트에서 아래 순서로 실행한다. DB 명령은 GET만 수행하며 원문은 제외 패킷에만 쓴다.

```powershell
node --tls-max-v1.2 --env-file=D:/workspace/Vocaflow/apps/web/.env.local scripts/research/goal-data/review-r3/db-read.mjs
node scripts/research/goal-data/review-r3/packet.mjs
node scripts/research/goal-data/review-r3/recompute.mjs
node scripts/research/goal-data/review-r3/extra.mjs
node scripts/research/goal-data/review-r3/build-verdict.mjs
node scripts/research/goal-data/review-r3/validate-output.mjs
```

원본 로컬 입력·출력의 해시는 recomputed.json의 local_input_manifest에 남겼다. 의미 표본 판정은 이 세션에서 직접 대조한 결과이며 재현 스크립트는 그 판정을 직렬화한다. 앱 lint/typecheck/E2E, 원문 전량 의미 판정, 인쇄 원본 대조, 동일 문항 계약 전후 실험은 **미실행**이며 통과로 계산하지 않는다.

## 작업 절차 결과

최초 지정 task start는 exit 1, `[NO_AGENT_PID] 조상 프로세스에서 codex를 찾지 못했다`로 실패했다. 부모 식별을 위한 Get-CimInstance Win32_Process도 접근 거부였다. 여러 codex 프로세스 중 임의 PID를 지정하지 않았다. 사용자 지시대로 검증은 진행했다. task show에서는 READY·run_seq0을 확인했으며, 이 실행이 잠금을 획득했다는 주장은 하지 않는다.

`.agent-goal.md`는 T-0097과 review-r3 허용 범위로 갱신했다(로컬 제외 파일). 지정 두 경로의 git add는 `fatal: Unable to create 'D:/workspace/Vocaflow/.git/worktrees/Vocaflow-goal-data-review/index.lock': Permission denied`로 실패했다. 이어서 지정 메시지와 두 경로만의 commit --only도 미추적 경로 pathspec 오류로 실패했다. 생성된 커밋 SHA는 없다. 검증 산출물은 로컬에 남아 있다. evidence·submit 명령의 실제 결과는 최종 응답에 보고한다.

`ev.json`은 type=review, result=fail(커밋 절차 미완료), skip_count=0, covers=[0,1,2,3,4]로 작성했다. 최초 evidence 시도의 UTF-8 BOM 오류는 BOM 없는 JSON으로 수정하고 재시도했다. 최종 evidence 결과는 `[BAD_TRANSITION] READY 에서는 증거를 붙일 수 없다`, submit은 `[BAD_TRANSITION] READY → REVIEW 불가`다. task start가 실패해 READY인 상태를 수동으로 바꾸지 않았다. 등록·제출·커밋 모두 완료로 보고하지 않는다.

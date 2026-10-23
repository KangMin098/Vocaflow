# T-0136 R2 재제출 — D1·D2 및 이관 설계

기준 `9e73d7660`, 공식 PARTIAL/반려 기록을 보존한 두 번째 실행이다. 작성 owner `csat-v4-s0`의 자체 검증이며 공식 Claude 판정을 대신하지 않는다. **D1 A는 자체 검증 PASS / 독립 수용 대기, D1 B는 NOT_APPROVED**이다.

## D1 수정 전후와 직접 증거

R1에서는 승인 전 후보가 판단판의 일반 해설 서식으로 표시되고 승인 상태는 하단에만 있었다. R2에서는 서버 역할의 격리 projection에서 일반 학습자용 38⑤ 설명·관계·38 대본을 보류한다. 검토 전용 projection은 후보를 유지하되 판단 설명, 관계 설명, 원본 대조, 각 원본 강의 cue 바로 옆에 상태를 표시한다. 후보는 `검수 전 수정 후보`, 보정 대상 원본은 `내용 검수 전`, 대본은 `검수 전 참고 대본 · C1 영향 검토 중`이다. 상태는 텍스트·테두리·ARIA 명칭/설명으로 전달하며 색에만 의존하지 않는다.

`content-policy.mjs`는 학습자 bootstrap에서 후보 payload와 38 대본을 제외한다. `fixture.tsx`의 ContentRead가 내용 옆 라벨과 aria-labelledby/aria-describedby를 연결한다. 격리의 audience 분리는 실제 제품 인증/RLS 증명이 아니다. 제품 서버의 HTML/RSC/API/대본/접근성 노출 차단은 이관 명세에 별도 수용 조건으로 둔다.

직접 캡처는 AI-Control `runtime/t0135-correction-20261024/r2/run-01/`에 있다(해시: RESULTS/검증 manifest).

- `review-2026-38-improve-1280-candidate-judgment.png`: 후보 판단과 원본 대조의 인접 라벨.
- `review-2026-38-replace-1440-candidate-relation.png`: 관계 설명과 역방향 버튼의 후보 상태.
- `review-2026-38-improve-1280-lecture-status.png`: 원본 cue12 대본의 미검수 상태.
- `learner-2026-38-replace-1280-final.png`: 일반 화면 설명·관계 보류 및 미승인 강의 미제공.

위 네 장은 작성자가 직접 열어 확인했다. 전체 28캡처와 16개 DOM 접근성 snapshot은 자동 수집이다. 실제 스크린리더 실행은 아니다.

후보 본문은 4~5의 일반 서사 형성 설명과 6~7의 구체적 대학 사례를 포함하는 4~7 맥락을 구별한다. 뒤쪽 8의 정체성 예시와 6→7 연결 보존을 함께 본다. R1 공식 원문 대조와 승인 요청 입력으로서의 내용 수용을 재사용한다. 원본 v3, 후보 version1.0.0·base/source/payload SHA, 승인 요구, `appliedToOriginal:false`는 바꾸지 않았다. 공식 콘텐츠 승인 B는 별도 내용 검수·승인 없이는 완료할 수 없다.

## D2 및 34 제품 경로

[F08 사전 선정 계약](./F08_EVALUATION.md)은 12개 실제 판단 과업과 7영역의 절차·기록값·필수 조건·선정 규칙을 정의한다. 필수 조건 통과 후에만 사용성·유지 비용을 비교한다. 미측정은 null이며 F08은 **UNSELECTED**, IMPROVE/REPLACE 모두 유지한다. 실제 PDF나 학습 효과 우열을 주장하지 않는다.

[34 제품 경로 이관 명세](./PRODUCT_TRANSFER_2026_34.md)는 실제 코드의 공개 게이트, 기존 v3 패널, cue 자동 장면/스크롤, 지도·Workspace 복귀, 확인 활동 분기를 대조하고 기능별 책임·데이터·보류·구현 순서·수용 테스트를 정의한다. 문서 명세만 작성했으며 제품 코드 구현은 하지 않았다.

## 실제 실행 및 재사용

| 검증 | 이번 실행 결과 / 범위 |
|---|---|
| projection 단위 | node:test 9 PASS, 0 FAIL, 0 SKIP. 최초 실행은 테스트의 원본 lecture 경로가 한 단계 잘못되어 suite 로딩 실패(통과 0)했고 경로 수정 후 성공했다. 최초 실패는 도구 실행 이력에 남아 있으며 현재 unit.log는 수정 후 실행이다. |
| 격리 브라우저 | 16조건(일반 3문항×2작업면×2폭=12, 검토38×2작업면×2폭=4), 60 단언 PASS, 0 FAIL, 28캡처,16 DOM AX snapshot, JS오류0/외부·API 요청0. 실제 LecturePlayer + 수동 완료 무음 adapter. |
| D1 일반 노출 | 38⑤ 설명/관계 보류, 38 대본 payload·DOM 미제공, 보류≠UNREGISTERED PASS. |
| D1 검토 노출 | 후보·원본·관계·원본12cue의 인접 상태 및 접근성 명칭/설명 PASS. |
| 34·22 회귀 | 양축·조건 근거·등록 왕복/UNREGISTERED·조건 한계·cue/viewer 독립을 8조건에서 확인. 22③ true/fails 유지. |
| 원본·버전·해시 | R1 C1/SOURCE/RESULTS/MANIFEST 및 제품 원본 불변 검증. |
| 과거 증거 | 98검사(관련62파일 SHA 동일), 24조건14캡처,42조건18캡처, R1의12조건100PASS/8 N/A/40캡처를 해당 범위에서 재사용. 재실행하거나 새 PASS 수에 합산하지 않았다. |

이전 R1 MANIFEST는 **9e73d7660의 역사적 실행용**이다. 현재 fixture hash 검증은 `r2/MANIFEST.json`과 상위 `validate.mjs`→R2 검증기를 사용한다. R1 실행/실패/증거는 삭제하지 않았다. R2 검사에 N/A를 PASS로 바꾼 항목은 없다.

R2 무결성 검증기 최초 실행은 Node의 spec reporter 접두사 `ℹ`를 TAP의 `#`로만 예상하여 로그 형식 검사에서 실패했다. 실제 단위 검증 결과를 바꾸지 않고 두 reporter 형식을 읽도록 수정했다. 이 실패도 도구 실행 이력에 남는다.

## BLOCKED_EVIDENCE와 수용 요청 범위

미검증: 색 대비, 전체 키보드 경로, 실제 스크린리더, 정상 인증/RLS, 실제 로컬 PDF/worker/권한, 실제 TTS, 학생 사용성·학습 효과, 실제 구현/유지 비용. F02/F06/F09/F10은 BLOCKED_EVIDENCE 유지. 38 C1 콘텐츠 승인 B도 미완료이다.

Claude Code 공식 owner `csat-v4-s0-claude-review`에게 D1 표시 계약 A, D2 선정 절차, 34 이관 **설계** 및 기존 수용/회귀 보존을 재검증 요청한다. D1 B, F08 최종 승자, S1 전체 제품 수용, S2 전체 착수, main 통합을 수용 요청에 포함하지 않는다. 제출은 REVIEW이며 작성자가 COMPLETED로 전이하지 않는다.
